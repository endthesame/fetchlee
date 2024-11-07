import { logInfo, logError } from './logger';
import fs from 'fs';

class URLFrontier {
    private visited: Set<string>;
    private stack: string[]; // Стек для обхода в глубину (DFS)
    private failed: Set<string>; // Список URL, которые не удалось загрузить

    constructor() {
        this.visited = new Set();
        this.stack = [];
        this.failed = new Set();
    }

    addUrl(url: string): void {
        if (!this.visited.has(url) && !this.stack.includes(url)) {
            this.stack.push(url);
        }
    }

    getNextUrl(): string | undefined {
        return this.stack.pop();
    }

    markVisited(url: string): void {
        this.visited.add(url);
    }

    hasMoreUrls(): boolean {
        return this.stack.length > 0;
    }

    markFailed(url: string): void {
        this.failed.add(url);
    }

    saveState(filePath: string): void {
        const state = {
            visited: Array.from(this.visited),
            stack: this.stack,
            failed: Array.from(this.failed)
        };
        fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
        //logInfo(`Frontier state saved to ${filePath}`);
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
}

export default URLFrontier;
