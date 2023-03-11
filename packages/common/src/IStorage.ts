export type StorageOptions = {
 ttl: number
}

export interface IStorage {
    init(): Promise<void>
    set(key: string, globalKey:string, options: StorageOptions): Promise<boolean>
    unSet(key: string, globalKey: string): Promise<boolean>
    close(): Promise<void>
}
