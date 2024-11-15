import { DatabaseClient } from './database.interface';
import { PostgresClient } from './postgres.client';
import { ArangoClient } from './arangodb.client';

export type DatabaseType = 'postgres' | 'arango';

export class DatabaseFactory {
    static createClient(type: DatabaseType, config: any): DatabaseClient {
        switch (type) {
            case 'postgres':
                return new PostgresClient(config);
            case 'arango':
                return new ArangoClient(config);
            default:
                throw new Error(`Unsupported database type: ${type}`);
        }
    }
}