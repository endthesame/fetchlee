import { Pool, PoolConfig } from 'pg';
import { DatabaseClient, DatabaseConfig } from './database.interface';
import { logError, logInfo } from '../logger';

export class PostgresClient implements DatabaseClient {
    private pool: Pool;
    private defaultTable: string;

    constructor(config: PoolConfig & DatabaseConfig) {
        this.pool = new Pool({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            database: config.database,
        });
        this.defaultTable = config.table || 'crawled_metadata';
    }

    async connect(): Promise<void> {
        try {
            const client = await this.pool.connect();
            // Проверяем существование таблицы и создаем её при необходимости
            await this.ensureTable(this.defaultTable);
            client.release();
            logInfo(`Connected to PostgreSQL database, using table: ${this.defaultTable}`);
        } catch (error) {
            logError(`Failed to connect to PostgreSQL: ${error}`);
            throw error;
        }
    }

    private async ensureTable(tableName: string): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS ${tableName} (
                    id SERIAL PRIMARY KEY,
                    url TEXT UNIQUE NOT NULL,
                    metadata JSONB NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP,
                    CONSTRAINT ${tableName}_url_key UNIQUE (url)
                )
            `);
            logInfo(`Ensured table ${tableName} exists`);
        } catch (error) {
            logError(`Failed to create table ${tableName}: ${error}`);
            throw error;
        } finally {
            client.release();
        }
    }

    async disconnect(): Promise<void> {
        await this.pool.end();
        logInfo('Disconnected from PostgreSQL database');
    }

    async saveMetadata(metadata: Record<string, any>, options?: { table?: string }): Promise<void> {
        const tableName = options?.table || this.defaultTable;
        await this.ensureTable(tableName);

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const query = `
                INSERT INTO ${tableName} (url, metadata, created_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (url) DO UPDATE
                SET metadata = $2, updated_at = NOW()
            `;
            await client.query(query, [metadata['217'], metadata]);
            await client.query('COMMIT');
            logInfo(`Saved metadata to table ${tableName}`);
        } catch (error) {
            await client.query('ROLLBACK');
            logError(`Failed to save metadata to table ${tableName}: ${error}`);
            throw error;
        } finally {
            client.release();
        }
    }
}