export interface DatabaseConfig {
    table?: string;
    collection?: string;
    [key: string]: any;
}

export interface DatabaseClient {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    saveMetadata(metadata: Record<string, any>, options?: { table?: string, url?: string, baseFileName?: string }): Promise<void>;
}