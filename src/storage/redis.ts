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
          SCRIPT: `local check_global_key_exists = redis.call('GET', ARGV[1])
          if (not check_global_key_exists)
          then
            redis.call('SET',ARGV[1], '1', 'NX', 'EX', ARGV[2])
            redis.call('SET',KEYS[1], '1', 'NX', 'EX', ARGV[2])
            return 'OK'
          else
          return nil
          end
          `,
          transformArguments: (key: string, globalKey:string, ttl: number) => [key, globalKey, `${ttl}`],
        }),

        deleteLock: defineScript({
          NUMBER_OF_KEYS: 1,
          SCRIPT: `local check_local_key_exists = redis.call('GET', KEYS[1])
          if (check_local_key_exists)
          then
            redis.call('DEL', KEYS[1])
            redis.call('DEL', ARGV[1])
          end
            return 'OK'
          `,
          transformArguments: (key: string, globalKey:string) => [key, globalKey],
        }),
      },
    });
    this.keyPrefix = keyPrefix ?? 'distributed-locks';
    this.client.connect();
  }

  /**
   *
   * @param key
   * @param {{ttl: number}} options make sure ttl is more than the time it takes to complete the operation
   * so the lock won't unlock until the operation is done
   * @returns
   */
  async set(key: string, globalKey: string, options: StorageOptions): Promise<boolean> {
    const { ttl } = options;
    const redisKey = this.constructKey(key);
    const redisGlobalKey = this.constructKey(globalKey);

    const result = await this.client.setLock(redisKey, redisGlobalKey, ttl);
    return result === 'OK';
  }

  async unSet(key: string, globalKey: string): Promise<boolean> {
    const redisKey = this.constructKey(key);
    const redisGlobalKey = this.constructKey(globalKey);

    await this.client.deleteLock(redisKey, redisGlobalKey);

    return true;
  }

  close(): Promise<void> {
    return this.client.disconnect();
  }

  private constructKey(key:string) {
    return `${this.keyPrefix}:${key}`;
  }
}
