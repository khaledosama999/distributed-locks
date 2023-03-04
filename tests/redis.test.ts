/* eslint-disable import/no-extraneous-dependencies */
import { RedisMemoryServer } from 'redis-memory-server';
import LockFactory from '../src';
import { FailedToObtainKey } from '../src/errors';
import { RedisStorage } from '../src/storage';
import { pause } from './utils';

describe('Locks factory REDIS', () => {
  let locksFactory: LockFactory;
  let redisServer: RedisMemoryServer = new RedisMemoryServer();
  const keyPrefix = 'prefix';

  beforeEach(async () => {
    redisServer = new RedisMemoryServer();
    await redisServer.start();
    const redisUrl = `redis://${await redisServer.getHost()}:${await redisServer.getPort()}`;

    const storage = new RedisStorage({ keyPrefix, url: redisUrl });
    locksFactory = new LockFactory(storage);
  });

  afterEach(async () => {
    await locksFactory.close();
    await redisServer.stop();
  });

  test('Should obtain lock successfully', async () => {
    const lock = locksFactory.createLock('key');

    const result = await lock.lock();
    expect(result).toEqual(true);
    await lock.unlock();
  });

  test('Should obtain lock once for the same key', async () => {
    const lock = locksFactory.createLock('key');
    const result = await lock.lock({ ttl: 10 });
    expect(result).toEqual(true);

    const failedLock = locksFactory.createLock('key');
    await expect(() => failedLock.lock({ retries: 3, interval: 0.5 })).rejects.toBeInstanceOf(FailedToObtainKey);

    await lock.unlock();
  });

  test('Should obtain lock once it is released', async () => {
    const lock = locksFactory.createLock('key');
    const result = await lock.lock({ ttl: 10 });
    expect(result).toEqual(true);

    const deleteResult = await lock.unlock();
    expect(deleteResult).toEqual(true);

    const secondLock = locksFactory.createLock('key');
    const secondResult = await secondLock.lock();
    expect(secondResult).toEqual(true);
  });

  test('Should obtain lock after ttl is over', async () => {
    const lock = locksFactory.createLock('key');
    const result = await lock.lock({ ttl: 2 });
    expect(result).toEqual(true);

    // Pause for at least 2 seconds
    await pause(3);

    const secondLock = locksFactory.createLock('key');
    const secondResult = await secondLock.lock();
    expect(secondResult).toEqual(true);
  });

  test('Should obtain lock after ttl is over using the retry mechanism', async () => {
    const lock = locksFactory.createLock('key');
    const result = await lock.lock({ ttl: 2 });
    expect(result).toEqual(true);

    const secondLock = locksFactory.createLock('key');
    const secondResult = await secondLock.lock({ retries: 10, interval: 1 });
    expect(secondResult).toEqual(true);
  });

  test('Should delete lock if it was already released', async () => {
    const lock = locksFactory.createLock('key');
    const result = await lock.lock({ ttl: 1 });

    expect(result).toEqual(true);

    // Simulate expiration of lock
    await pause(3);

    const secondLock = locksFactory.createLock('key');
    const secondResult = await secondLock.lock({ ttl: 10 });

    expect(secondResult).toEqual(true);

    // Try to delete the first lock, should not affect the second lock
    await lock.unlock();

    // Lock should fail since second lock is still active
    const failedLock = locksFactory.createLock('key');
    await expect(() => failedLock.lock({ retries: 3, interval: 0.5 })).rejects.toBeInstanceOf(FailedToObtainKey);

    await secondLock.unlock();

    const thirdLock = locksFactory.createLock('key');
    const thirdResult = await thirdLock.lock({ ttl: 10 });

    expect(thirdResult).toEqual(true);
  });
});
