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
        if (!this.visited.has(url)) {
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
}

export default URLFrontier;
