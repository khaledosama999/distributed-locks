/* eslint-disable import/prefer-default-export */
export class FailedToObtainKey extends Error {
  constructor(key:string, metaData?: any) {
    super(`Failed to obtain lock for key ${key}, metaData:${metaData}`);
  }
}
