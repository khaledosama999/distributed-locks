/* eslint-disable template-curly-spacing */
/* eslint-disable no-unused-expressions */
/* eslint-disable import/prefer-default-export */
// eslint-disable-next-line import/no-extraneous-dependencies
import postgres, { Sql } from 'postgres';
import { IStorage, StorageOptions } from 'distributed-locks-common';

export class PostgresqlStorage implements IStorage {
  private keyPrefix: string;

  private tableName: string;

  private primaryKeyConstraint: string;

  private client: Sql;

  constructor(options: {
    url?: string,
     keyPrefix?:string,
     port: number,
     host: string,
     database: string,
     username: string,
     password: string,
     tableName?: string
    }) {
    const { keyPrefix, tableName } = options;

    this.tableName = tableName ?? 'locks';
    this.primaryKeyConstraint = `${this.tableName}_pkey`;
    this.keyPrefix = keyPrefix ?? 'distributed-locks';

    this.client = postgres(options);
  }

  async init() {
    await this.client`
        CREATE TABLE IF NOT EXISTS ${ this.client(this.tableName) } (
            key varchar(50),
            value varchar(100) NOT NULL,
            ttl integer NOT NULL,
            obtained_at timestamp DEFAULT current_timestamp,
            CONSTRAINT ${ this.client(this.primaryKeyConstraint) } PRIMARY KEY (key)
          );`;
  }

  /**
   *
   * @param key
   * @param {{ttl: number}} options make sure ttl is more than the time it takes to complete the operation
   * so the lock won't unlock until the operation is done
   * @returns
   */
  async set(key: string, value: string, options: StorageOptions): Promise<boolean> {
    const { ttl } = options;
    const postgresKey = this.constructKey(key);

    const x = await this.client.begin('ISOLATION LEVEL REPEATABLE READ', (sql) => sql`
        INSERT INTO ${sql(this.tableName)} (key, value, ttl, obtained_at)
        VALUES (${postgresKey}, ${value}, ${ttl}, current_timestamp)
        ON CONFLICT ON CONSTRAINT ${sql(this.primaryKeyConstraint)}
        DO
            UPDATE SET value = ${value}, ttl = ${ttl.toString()}
            WHERE locks.obtained_at + interval '1' second * locks.ttl  < current_timestamp
        returning *
        `);

    return x.length !== 0;
  }

  async unSet(key: string, value: string): Promise<boolean> {
    const postgresKey = this.constructKey(key);

    await this.client.begin('ISOLATION LEVEL REPEATABLE READ', async (sql) => sql`
     DELETE FROM ${this.client(this.tableName)}
     where key = ${postgresKey} AND value = ${value};
    `);

    return true;
  }

  close(): Promise<void> {
    return this.client.end();
  }

  private constructKey(key:string) {
    return `${this.keyPrefix}:${key}`;
  }
}
