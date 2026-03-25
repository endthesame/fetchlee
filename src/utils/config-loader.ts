import { BrowserConfig } from '../interfaces/browser';
import fs from 'fs';
import path from 'path';
import { logInfo, logError } from '../logger';

const DEFAULT_BROWSER_CONFIG: BrowserConfig = {
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: {width: 1280, height: 720},
    timeout: 30000
};

export function loadBrowserConfig(configPath?: string): BrowserConfig {
    if (!configPath) return DEFAULT_BROWSER_CONFIG;

    try {
        const fullPath = path.resolve(configPath);
        if (!fs.existsSync(fullPath)) {
            logError(`Config file not found: ${fullPath}`);
            return DEFAULT_BROWSER_CONFIG;
        }

        const rawConfig = fs.readFileSync(fullPath, 'utf-8');
        const userConfig = JSON.parse(rawConfig) as BrowserConfig;
        
        // Полная замена дефолтного конфига
        logInfo(`Browser\`s config successfully loaded from ${fullPath}`)
        return {
            ...userConfig,
            args: userConfig.args || DEFAULT_BROWSER_CONFIG.args
        };
        
    } catch (error) {
        const errorMessage = (error instanceof Error)? error.message : "Unknown error";
        logError(`Error loading browser config: ${errorMessage}`);
        return DEFAULT_BROWSER_CONFIG;
    }
}