import { IStorage } from 'distributed-locks-common';
import Lock from './lock';

export type LockFactoryOptions = {
  machineId?: string
}

class LockFactory {
  private storage: IStorage;

  private locksFactoryOptions: LockFactoryOptions;

  /**
   *
   * @param storage The storage engine used to store locks information
   * @param {{machineId: string}} locksFactoryOptions
   */
  constructor(storage: IStorage, locksFactoryOptions: LockFactoryOptions = {}) {
    this.locksFactoryOptions = locksFactoryOptions;
    this.storage = storage;
  }

  async init() {
    await this.storage.init();
  }

  createLock(key: string) {
    return new Lock(key, this.locksFactoryOptions.machineId ?? '1', this.storage);
  }

  close() {
    return this.storage.close();
  }
}

export default LockFactory;
