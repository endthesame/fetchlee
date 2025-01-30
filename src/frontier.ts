import Database from 'better-sqlite3';
import { logInfo, logError, logWarn } from './logger';
import fs from 'fs';
import path from 'path';

interface FrontierOptions {
    frontierStatePath?: string;
    collName: string;
}

class SQLiteFrontier {
    private db: Database.Database;
    private collName: string;
    private dbPath: string;

    constructor(options: FrontierOptions) {
        this.collName = options.collName;
        this.dbPath = this.resolveDbPath(options.frontierStatePath);
        this.validatePathPermissions();
        this.db = new Database(this.dbPath);
        this.initSchema();
    }

    private resolveDbPath(customPath?: string): string {
        const defaultDir = path.join(process.cwd(), 'data');
        const defaultPath = path.join(defaultDir, 'frontier.db');
        
        if (!customPath) {
            if (!fs.existsSync(defaultDir)) {
                fs.mkdirSync(defaultDir, { recursive: true });
            }
            return defaultPath;
        }
        
        if (path.extname(customPath) === '') {
            return path.join(customPath, 'frontier.db');
        }
        
        return customPath;
    }

    private validatePathPermissions(): void {
        try {
            fs.accessSync(path.dirname(this.dbPath), fs.constants.W_OK);
        } catch (error) {
            logError(`No write permissions to database path: ${this.dbPath}`);
            throw new Error('Database path inaccessible');
        }
    }

    private initSchema(): void {
        this.db.exec(`
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS urls (
                url TEXT PRIMARY KEY,
                status TEXT CHECK(status IN ('queued', 'processing', 'visited', 'failed')),
                collection TEXT NOT NULL,
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                processing_started_at DATETIME,
                retries INTEGER DEFAULT 0
            );
            
            CREATE INDEX IF NOT EXISTS idx_status 
            ON urls(collection, status);
        `);
    }

    async addUrls(urls: string[]): Promise<void> {
        const insert = this.db.prepare(`
            INSERT OR IGNORE INTO urls (url, status, collection)
            VALUES (?, 'queued', ?)
        `);

        const batchSize = 1000;
        try {
            for (let i = 0; i < urls.length; i += batchSize) {
                const batch = urls.slice(i, i + batchSize)
                    .map(url => url.trim())
                    .filter(url => url.length > 0);
                
                this.db.transaction(() => {
                    batch.forEach(url => {
                        insert.run(url, this.collName);
                    });
                })();
            }
        } catch (error) {
            const errorMessage = (error instanceof Error) ? error.message : 'Unknown error';
            logError(`Failed to add URLs: ${errorMessage}`);
            throw error;
        }
    }

    async getNextUrl(timeoutMinutes: number = 30): Promise<string | null> {
        return this.db.transaction(() => {
            // Возвращаем зависшие URL в очередь
            this.db.prepare(`
                UPDATE urls
                SET status = 'queued', retries = retries + 1
                WHERE 
                    status = 'processing' AND 
                    collection = ? AND 
                    datetime(processing_started_at) < datetime('now', ?)
            `).run(this.collName, `-${timeoutMinutes} minutes`);
    
            // Получаем следующий URL
            const row = this.db.prepare(`
                SELECT url FROM urls
                WHERE 
                    collection = ? AND 
                    status = 'queued'
                ORDER BY added_at ASC
                LIMIT 1
            `).get(this.collName) as { url: string } | undefined;;
    
            if (!row) return null;
    
            // Помечаем как "в обработке"
            this.db.prepare(`
                UPDATE urls
                SET 
                    status = 'processing',
                    processing_started_at = CURRENT_TIMESTAMP
                WHERE url = ? AND collection = ?
            `).run(row.url, this.collName);
    
            return row.url;
        })();
    }

    async markCompleted(url: string): Promise<void> {
        this.db.prepare(`
            UPDATE urls
            SET status = 'visited'
            WHERE url = ? AND collection = ?
        `).run(url, this.collName);
    }
    
    async markFailed(url: string, maxRetries: number = 3): Promise<void> {
        const result = this.db.prepare(`
            UPDATE urls
            SET 
                status = CASE WHEN retries >= ? THEN 'failed' ELSE 'queued' END,
                retries = retries + 1
            WHERE url = ? AND collection = ?
        `).run(maxRetries, url, this.collName);
    
        if (result.changes === 0) {
            logError(`Failed to mark URL as failed: ${url}`);
        }
    }

    hasMoreUrls(): boolean {
        const result = this.db.prepare(`
            SELECT 1 FROM urls
            WHERE collection = ? AND status = 'queued'
            LIMIT 1
        `).get(this.collName);
        
        return !!result;
    }

    async clearCollection(): Promise<void> {
        try {
            this.db.prepare(`
                DELETE FROM urls
                WHERE collection = ?
            `).run(this.collName);
            logInfo(`Cleared history for collection "${this.collName}"`);
        } catch (error) {
            const errorMessage = (error instanceof Error) ? error.message : 'Unknown error';
            logError(`Failed to clear collection: ${errorMessage}`);
            throw error;
        }
    }

    getStats() {
        const stmt = this.db.prepare(`
            SELECT 
                SUM(status = 'queued') as queued,
                SUM(status = 'visited') as visited,
                SUM(status = 'failed') as failed
            FROM urls
            WHERE collection = ?
        `);
        
        return stmt.get(this.collName);
    }

    close(): void {
        if (this.db) {
            this.db.prepare('PRAGMA optimize').run();
            this.db.close();
            logInfo(`Database connection closed for ${this.collName}`);
        }
    }
}

export default SQLiteFrontier;