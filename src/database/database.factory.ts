import { DatabaseClient } from './database.interface';
import { ArangoClient } from './arangodb.client';
import { DatabaseConfig } from './database.interface';

export type DatabaseType = 'arango';

export class DatabaseFactory {
    static createClient(type: DatabaseType, config: DatabaseConfig): DatabaseClient {
        switch (type) {
            case 'arango':
                return new ArangoClient(config);
            default:
                throw new Error(`Unsupported database type: ${type}`);
        }
    }
}
