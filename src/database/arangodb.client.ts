import { Database, aql } from 'arangojs';
import { DatabaseClient, DatabaseConfig } from './database.interface';
import { logError, logInfo } from '../logger';

export class ArangoClient implements DatabaseClient {
    private db: Database;
    private defaultCollection: string;

    constructor(config: DatabaseConfig) {
        this.db = new Database({
            url: config.url,
            auth: { username: config.username, password: config.password },
            databaseName: config.database,
        });
        this.defaultCollection = config.coll_name || config.collection || 'crawled_data';
    }

    async connect(): Promise<void> {
        try {
            await this.ensureCollection(this.defaultCollection);
            logInfo(`Connected to ArangoDB database, using collection: ${this.defaultCollection}`);
        } catch (error) {
            logError(`Failed to connect to ArangoDB: ${error}`);
            throw error;
        }
    }

    private async ensureCollection(collectionName: string): Promise<void> {
        const collections = await this.db.collections();
        if (!collections.find(c => c.name === collectionName)) {
            await this.db.createCollection(collectionName);
            logInfo(`Created collection ${collectionName}`);
        }
    }

    async disconnect(): Promise<void> {
        logInfo('Disconnected from ArangoDB database');
    }

    async saveMetadata(metadata: Record<string, any>, options?: { table?: string, url?: string, baseFileName?: string }): Promise<void> {
        const collectionName = options?.table || this.defaultCollection;
        await this.ensureCollection(collectionName);

        try {
            await this.db.collection(collectionName).save(
                {
                    //_key: metadata['217'].replace(/[^a-zA-Z0-9]/g, '_'),
                    _key: options?.baseFileName,
                    url: options?.url,
                    base_file_name: options?.baseFileName,
                    metadata,
                    created_at: new Date(),
                },
                { overwriteMode: 'update' }
            );
            logInfo(`Saved metadata to collection ${collectionName}`);
        } catch (error) {
            logError(`Failed to save metadata to collection ${collectionName}: ${error}`);
            throw error;
        }
    }
}