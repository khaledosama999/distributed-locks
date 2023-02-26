import Lock from './lock';
import { IStorage } from './storage';

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

  createLock(key: string) {
    return new Lock(key, this.locksFactoryOptions.machineId ?? '1', this.storage);
  }

  close() {
    return this.storage.close();
  }
}

export default LockFactory;
