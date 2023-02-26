export type StorageOptions = {
 ttl: number
}

export interface IStorage {
    set(key: string, globalKey:string, options: StorageOptions): Promise<boolean>
    unSet(key: string, globalKey: string): Promise<boolean>
    close(): Promise<void>
}
