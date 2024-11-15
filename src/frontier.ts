import { logInfo, logError } from './logger';
import fs from 'fs';
import path from "path";


interface FrontierOptions {
    frontierSaveStatePath?: string | null;
}

class URLFrontier {
    private visited: Set<string>;
    private stack: string[]; // Стек для обхода в глубину (DFS)
    private failed: Set<string>; // Список URL, которые не удалось загрузить
    private saveStatePath: string | undefined;
    private autoSave: boolean;

    constructor(options: FrontierOptions = {}) {
        this.visited = new Set();
        this.stack = [];
        this.failed = new Set();

        this.saveStatePath = options.frontierSaveStatePath
            ? path.extname(options.frontierSaveStatePath)
                ? options.frontierSaveStatePath // Если указано имя файла
                : path.join(options.frontierSaveStatePath, 'frontier_state.json') // Если указана папка
            : undefined;
            
        this.autoSave = Boolean(this.saveStatePath);
    }

    private async autoSaveState(): Promise<void> {
        if (this.autoSave && this.saveStatePath) {
            try {
                this.saveState(this.saveStatePath);
            } catch (error) {
                logError(`Failed to auto-save frontier state: ${error}`);
            }
        }
    }

    private addUrl(url: string): void {
        if (!this.visited.has(url) && !this.stack.includes(url)) {
            this.stack.push(url);
        }
    }

    async addUrls(urls: string[]): Promise<void> {
        for (const url of urls) {
            this.addUrl(url.trim());
        }

        await this.autoSaveState();
    }

    async getNextUrl(): Promise<string | undefined> {
        const url = this.stack.pop();
        await this.autoSaveState();
        return url;
    }

    async markVisited(url: string): Promise<void> {
        this.visited.add(url);
        await this.autoSaveState();
    }

    hasMoreUrls(): boolean {
        return this.stack.length > 0;
    }

    async markFailed(url: string): Promise<void> {
        this.failed.add(url);
        await this.autoSaveState();
    }

    saveState(filePath: string): void {
        const state = {
            visited: Array.from(this.visited),
            stack: this.stack,
            failed: Array.from(this.failed)
        };
        fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
    }

    loadState(filePath: string): void {
        if (fs.existsSync(filePath)) {
            const state = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            this.visited = new Set(state.visited);
            this.stack = state.stack;
            this.failed = new Set(state.failed);
            logInfo(`Frontier state loaded from ${filePath}`);
        } else {
            logError(`State file not found: ${filePath}`);
        }
    }

    getStats(): { visited: number; queued: number; failed: number } {
        return {
            visited: this.visited.size,
            queued: this.stack.length,
            failed: this.failed.size
        };
    }

    isVisited(url: string): boolean {
        return this.visited.has(url);
    }

    isFailed(url: string): boolean {
        return this.failed.has(url);
    }
}

export default URLFrontier;
