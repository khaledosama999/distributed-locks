/* eslint-disable import/prefer-default-export */
// eslint-disable-next-line import/no-extraneous-dependencies
import redisClient, { createClient, defineScript } from '@redis/client';
import { SHA1 } from '@redis/client/dist/lib/lua-script';
import { IStorage, StorageOptions } from './IStorage';

export class RedisStorage implements IStorage {
  private keyPrefix: string;

  private client: redisClient.RedisClientType<redisClient.RedisModules, redisClient.RedisFunctions, {
    setLock: {
        NUMBER_OF_KEYS: number;
        SCRIPT: string;
        transformArguments: (key: string, globalKey: string, ttl: number) => string[];
    } & SHA1,
    deleteLock: {
      NUMBER_OF_KEYS: number;
      SCRIPT: string;
      transformArguments: (key: string, globalKey: string) => string[];
  } & SHA1;
}>;

  constructor(options: {url?: string, keyPrefix?:string }) {
    const { url, keyPrefix } = options;

    this.client = createClient({
      url,
      scripts: {
        setLock: defineScript({
          NUMBER_OF_KEYS: 1,
          SCRIPT: `local key = redis.call('GET', KEYS[1])
          if (not key)
          then
            redis.call('SET',KEYS[1], ARGV[1], 'NX', 'EX', ARGV[2])
            return 'OK'
          else
          return nil
          end
          `,
          transformArguments: (key: string, value:string, ttl: number) => [key, value, `${ttl}`],
        }),

        deleteLock: defineScript({
          NUMBER_OF_KEYS: 1,
          SCRIPT: `local key = redis.call('GET', KEYS[1])
          if (key == ARGV[1])
          then
            redis.call('DEL', KEYS[1])
          end
            return 'OK'
          `,
          transformArguments: (key: string, value:string) => [key, value],
        }),
      },
    });
    this.keyPrefix = keyPrefix ?? 'distributed-locks';
    this.client.connect();
  }

  async init() {
    return Promise.resolve();
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
    const redisKey = this.constructKey(key);

    const result = await this.client.setLock(redisKey, value, ttl);
    return result === 'OK';
  }

  async unSet(key: string, value: string): Promise<boolean> {
    const redisKey = this.constructKey(key);

    await this.client.deleteLock(redisKey, value);

    return true;
  }

  close(): Promise<void> {
    return this.client.disconnect();
  }

  private constructKey(key:string) {
    return `${this.keyPrefix}:${key}`;
  }
}
