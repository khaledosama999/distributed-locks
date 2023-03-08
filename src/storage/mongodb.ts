/* eslint-disable import/prefer-default-export */
// eslint-disable-next-line import/no-extraneous-dependencies
import {
  Db,
  Document, MongoClient,
} from 'mongodb';
import { IStorage, StorageOptions } from './IStorage';

interface MongoDocument extends Document {
  _id: string,
  ttl: number,
  obtained_at: Date,
  current_date: Date
}

export class MongoStorage implements IStorage {
  private client: MongoClient;

  private collectionName: string;

  private dbName: string;

  private db?: Db;

  constructor(options: {url: string, dbName: string, collectionName?: string }) {
    const { url, collectionName, dbName } = options;

    this.client = new MongoClient(url);
    this.collectionName = collectionName ?? 'locks';
    this.dbName = dbName;
  }

  async init() {
    await this.client.connect();
    this.db = this.client.db(this.dbName);
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

    const sameLockValue = await this.db?.collection<MongoDocument>(this.collectionName)
      .findOne({ _id: key }, {
        projection: {
          _id: 1, value: 1, ttl: 1, obtained_at: 1, current_date: '$$NOW',
        },
      });

    if (!sameLockValue) {
      try {
        await this.db?.collection<Omit<MongoDocument, 'created_at'>>(this.collectionName).updateOne({
          _id: key as any,
          value,
        }, {
          $set: {
            _id: key as any,
            value,
            ttl,
          },
          $currentDate: {
            obtained_at: { $type: 'date' },
          },
        }, { upsert: true });

        return true;
      } catch (error) {
        return false;
      }
    }

    const expirationDate = new Date(sameLockValue.obtained_at);
    expirationDate.setSeconds(expirationDate.getSeconds() + sameLockValue.ttl);

    if (sameLockValue.current_date > expirationDate) {
      try {
        const result = await this.db?.collection<Omit<MongoDocument, 'created_at'>>(this.collectionName).updateOne({
          _id: key as any,
          value: sameLockValue.value,
          obtained_at: sameLockValue.obtained_at,
        }, {
          $set: {
            _id: key as any,
            value,
            ttl,
          },
          $currentDate: {
            obtained_at: { $type: 'date' },
          },
        }, { upsert: true });

        return (result?.modifiedCount ?? 0) > 0 || (result?.upsertedCount ?? 0) > 0;
      } catch (err) {
        return false;
      }
    }

    return false;
  }

  async unSet(key: string, value: string): Promise<boolean> {
    await this.db?.collection<MongoDocument>(this.collectionName)
      .deleteOne({
        _id: key,
        value,
      });

    return true;
  }

  close(): Promise<void> {
    return this.client.close();
  }
}
