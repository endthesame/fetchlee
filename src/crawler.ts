import { PuppeteerExtra } from "puppeteer-extra";
import { Browser, Page, PuppeteerLaunchOptions } from "puppeteer";
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
//import { extractData } from './extractor';
import URLFrontier from './frontier';
import { logInfo, logError } from './logger';
import { delay } from './utils/utils';
import { changeTorIp } from './utils/tor-config';

const puppeteer: PuppeteerExtra = require('puppeteer-extra');
puppeteer.use(StealthPlugin());

interface Action {
    action: string;
    selector?: string;
    value?: string;
}

interface CrawlOptions {
    taskPath: string;
    downloadPDFmark?: boolean;
    checkOpenAccess?: boolean;
    useTor?: boolean;
    uploadViaSSH?: boolean;
}

function initializeFrontier(seedFilePath: string): URLFrontier {
    const frontier = new URLFrontier();
    const seeds = fs.readFileSync(seedFilePath, 'utf-8').split('\n').filter(url => url.trim() !== '');
    seeds.forEach(seed => frontier.addUrl(seed.trim()));
    logInfo(`Frontier initialized with ${seeds.length} seeds.`);
    return frontier;
}

async function initializeBrowser(useTor?: boolean): Promise<{ browser: Browser; page: Page }> {
    const launchOptions: PuppeteerLaunchOptions = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] };
    if (useTor) {
        const isTorEnabled = await changeTorIp();
        if (isTorEnabled) {
            launchOptions.args?.push('--proxy-server=127.0.0.1:8118');
            logInfo('Tor is enabled');
        } else {
            logError('Tor is not enabled, switching to normal mode');
        }
    }

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    logInfo('Browser initialized.');
    return { browser, page };
}

async function performActions(page: Page, actions: Action[]): Promise<void> {
    for (const action of actions) {
        switch (action.action) {
            case 'waitForSelector':
                if (action.selector) await page.waitForSelector(action.selector);
                break;
            case 'click':
                if (action.selector) {
                    await page.click(action.selector);
                    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
                }
                break;
            case 'type':
                if (action.selector && action.value) await page.type(action.selector, action.value);
                break;
            case 'waitForTimeout':
                if (action.value) await delay(parseInt(action.value, 10));
                break;
            default:
                logError(`Unknown action: ${action.action}`);
        }
    }
}

async function extractLinks(page: Page, rules: { to: string | string[] }[]): Promise<string[]> {
    const links = await page.evaluate(() => {
        return Array.from(document.links).map(link => link.href);
    });

    const uniqueLinks = [...new Set(links)];

    const filteredLinks = uniqueLinks.filter(link => {
        return rules.some(rule => {
            return Array.isArray(rule.to)
                ? rule.to.some(pattern => new RegExp(pattern).test(link))
                : new RegExp(rule.to).test(link);
        });
    });

    return filteredLinks;
}

async function navigateWithRetry(page: Page, url: string, maxRetries = 3): Promise<void> {
    let attempts = 0;
    while (attempts < maxRetries) {
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
            return;
        } catch (error: any) {
            logError(`Error loading ${url}: ${error.message}. Retrying (${attempts + 1}/${maxRetries})...`);
            attempts++;
            await delay(3000);
        }
    }
    throw new Error(`Failed to navigate to ${url} after ${maxRetries} attempts`);
}

export async function crawl(jsonFolderPath: string, pdfFolderPath: string, htmlFolderPath: string, siteFolderPath: string,seedFilePath: string,options: CrawlOptions): Promise<void> {
    const { taskPath, downloadPDFmark, checkOpenAccess, useTor, uploadViaSSH } = options;

    let browser: Browser | undefined, page: Page | undefined, url: string | undefined;
    try {
        const taskData = fs.readFileSync(taskPath, 'utf-8');
        const task = JSON.parse(taskData);
        const frontier = initializeFrontier(seedFilePath);

        const browserPage = await initializeBrowser(useTor);
        browser = browserPage.browser;
        page = browserPage.page;

        while (frontier.hasMoreUrls()) {
            try {
                url = frontier.getNextUrl();
                if (!url) break;

                frontier.markVisited(url);
                await navigateWithRetry(page, url);

                const actionsBeforeExtraction = task.actions_before_extraction?.filter((pattern: any) => url && new RegExp(pattern.url_pattern).test(url));
                if (actionsBeforeExtraction && actionsBeforeExtraction.length > 0) {
                    for (const action of actionsBeforeExtraction) {
                        await performActions(page, action.actions);
                        logInfo(`Performed actions before extraction for ${url}`);
                    }
                }

                const matchingRules = task.crawl_rules?.filter((rule: any) => url && new RegExp(rule.from).test(url));
                if (matchingRules && matchingRules.length > 0) {
                    const newLinks = await extractLinks(page, matchingRules);
                    newLinks.forEach(link => frontier.addUrl(link));
                }

                // const matchingMetadataExtraction = task.metadata_extraction?.filter((pattern: any) => url && new RegExp(pattern.url_pattern).test(url));
                // if (matchingMetadataExtraction && matchingMetadataExtraction.length > 0) {
                //     await extractData(page, jsonFolderPath, htmlFolderPath, task, url);
                // }

                const actionsAfterExtraction = task.actions_after_extraction?.filter((pattern: any) => url && new RegExp(pattern.url_pattern).test(url));
                if (actionsAfterExtraction && actionsAfterExtraction.length > 0) {
                    for (const action of actionsAfterExtraction) {
                        await performActions(page, action.actions);
                        logInfo(`Performed actions after extraction for ${url}`);
                    }
                }

                logInfo(`Successfully processed ${url}`);
            } catch (error) {
                const errorMessage = (error as any).stack || 'Unknown error';
                logError(`Error processing ${url || 'unknown URL'}: ${errorMessage}`);
            }
        }
    } catch (error) {
        const errorMessage = (error instanceof Error) ? error.stack : 'Unknown error';
        logError(`Critical error: ${errorMessage}`);
    } finally {
        if (browser) {
            logInfo('Closing browser.');
            await browser.close();
        }
    }
    logInfo('Crawling finished.');
}