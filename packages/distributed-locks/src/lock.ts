import { randomUUID } from 'crypto';
import { IStorage } from 'distributed-locks-common';

import { FailedToObtainKey } from './errors';

export const DEFAULT_TTL = 10;
export const DEFAULT_RETIRES = 3;
export const DEFAULT_INTERVAL = 1;

export type LockOptions = {
    ttl?: number,
    retries?: number,
    interval?: number,
}

class Lock {
  private storage: IStorage;

  private key: string;

  private value: string;

  constructor(key: string, machineId: string, storage: IStorage) {
    this.storage = storage;
    const uuid = randomUUID();
    this.key = key;
    this.value = `${key}-${machineId}-${uuid}`;
  }

  /**
   *
   * @param lockOptions the options for the lock
   * @param lockOptions.key the string value for the key that will identify the lock
   * @param {number} [lockOptions.ttl=10] the time in seconds for the lock to live after it will be deleted
   * regardless if the critical section finished or not
   * @param {number} [lockOptions.retires=3] number of retires to obtain a lock with the given key
   * @param {number} [lockOptions.interval=1] the interval in seconds between each retry to obtain a lock
   */
  async lock(lockOptions: LockOptions = {
    ttl: DEFAULT_TTL, retries: DEFAULT_RETIRES, interval: DEFAULT_INTERVAL,
  }) {
    const {
      ttl = DEFAULT_TTL, retries = DEFAULT_RETIRES, interval = DEFAULT_INTERVAL,
    } = lockOptions;

    return new Promise((resolve, reject) => {
      this.tryToObtainLock({
        ttl,
        retries,
        interval,
      }, 0, resolve, reject);
    });
  }

  private async tryToObtainLock(
    lockOptions: Required<LockOptions>,
    currentRetry: number,
    resolve: (value: unknown) => any,
    reject: (value:unknown) => any,
  ) {
    const {
      ttl, retries, interval,
    } = lockOptions;

    if (currentRetry === retries) { reject(new FailedToObtainKey(this.key, lockOptions)); return; }

    const obtainedLock = await this.storage.set(this.key, this.value, { ttl });
    if (obtainedLock) { resolve(obtainedLock); return; }

    setTimeout(() => {
      this.tryToObtainLock(lockOptions, currentRetry + 1, resolve, reject);
    }, interval * 1000);
  }

  async unlock() {
    return this.storage.unSet(this.key, this.value);
  }
}

export default Lock;
