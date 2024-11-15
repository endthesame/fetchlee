import dotenv from 'dotenv';
import { DatabaseType } from '../database/database.factory';
import { DatabaseConfig } from '../database/database.interface';

dotenv.config();

export interface DatabaseConfiguration {
    type: DatabaseType;
    config: DatabaseConfig;
}

export function getDatabaseConfig(): DatabaseConfiguration {
    const dbType = process.env.DATABASE_TYPE as DatabaseType;

    switch (dbType) {
        case 'postgres':
            return {
                type: 'postgres',
                config: {
                    host: process.env.POSTGRES_HOST,
                    port: parseInt(process.env.POSTGRES_PORT || '5432'),
                    user: process.env.POSTGRES_USER,
                    password: process.env.POSTGRES_PASSWORD,
                    database: process.env.POSTGRES_DB,
                    table: process.env.POSTGRES_TABLE,
                }
            };
        case 'arango':
            return {
                type: 'arango',
                config: {
                    url: process.env.ARANGO_URL,
                    database: process.env.ARANGO_DB,
                    collection: process.env.ARANGO_COLLECTION,
                    username: process.env.ARANGO_USER,
                    password: process.env.ARANGO_PASSWORD,
                }
            };
        default:
            throw new Error(`Unsupported database type: ${dbType}`);
    }
}