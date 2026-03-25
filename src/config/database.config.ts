import dotenv from 'dotenv';
import { DatabaseType } from '../database/database.factory';
import { DatabaseConfig } from '../database/database.interface';

dotenv.config();

export interface DatabaseConfiguration {
    type: DatabaseType;
    config: DatabaseConfig;
}

export function getDatabaseConfig(): DatabaseConfiguration {
    const rawDbType = (process.env.DATABASE_TYPE || 'arango').toLowerCase();
    const dbType = rawDbType as DatabaseType;

    if (dbType !== 'arango') {
        throw new Error(`Unsupported database type: ${rawDbType}. Only "arango" is supported.`);
    }

    const requiredEnv = ['ARANGO_URL', 'ARANGO_DB', 'ARANGO_COLLECTION', 'ARANGO_USER'] as const;
    const missing = requiredEnv.filter((key) => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required ArangoDB env vars: ${missing.join(', ')}`);
    }

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
}
