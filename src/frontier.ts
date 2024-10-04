class URLFrontier {
    private visited: Set<string>;
    private stack: string[]; // Стек для обхода в глубину (DFS)

    constructor() {
        this.visited = new Set();
        this.stack = [];
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
}

export default URLFrontier;
