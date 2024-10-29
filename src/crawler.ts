import { PuppeteerExtra } from "puppeteer-extra";
import { Browser, Page, PuppeteerLaunchOptions } from "puppeteer";
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import { extractData } from './extractor';
import URLFrontier from './frontier';
import { logInfo, logError } from './logger';
import { delay } from './utils/utils';
import { changeTorIp } from './utils/tor-config';
import { CrawlRule, MetadataExtractionRule} from './interfaces/task'
import path from "path";
import { DatabaseClient } from './database/database.interface';
import { DatabaseFactory } from './database/database.factory';
import { getDatabaseConfig } from './config/database.config';

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
    crawlDelay?: number;
    headless?: boolean;
    frontierStatePath?: string;
    frontierSaveStatePath?: string | null;
    useDatabase?: boolean;
    coll_name: string;
}

function initializeFrontier(seedFilePath: string, frontierStatePath?: string): URLFrontier {
    const frontier = new URLFrontier();

    if (frontierStatePath && fs.existsSync(frontierStatePath)) {
        frontier.loadState(frontierStatePath);
    } else {
        const seeds = fs.readFileSync(seedFilePath, 'utf-8').split('\n').filter(url => url.trim() !== '');
        seeds.forEach(seed => frontier.addUrl(seed.trim()));
        logInfo(`Frontier initialized with ${seeds.length} seeds.`);
    }

    return frontier;
}

async function initializeBrowser(useTor?: boolean, headless?: boolean): Promise<{ browser: Browser; page: Page }> {
    const launchOptions: PuppeteerLaunchOptions = { headless: false, args: ['--no-sandbox', '--disable-setuid-sandbox'] };
    if (headless) launchOptions.headless = headless;
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

async function extractLinks(page: Page, rules: CrawlRule[]): Promise<string[]> {
    const allLinks: string[] = [];

    for (const rule of rules) {
        for (const toRule of rule.to) {
            let links: string[];

            // If a selector is provided in the "to" rule, extract links from that specific section
            if (toRule.selector) {
                links = await page.$$eval(toRule.selector, (elements: Element[], ignoreInnerLinks: boolean ) => {
                    return elements.flatMap(element => {
                        const linksInElement: string[] = [];

                        const elementHref = (element as HTMLAnchorElement).href; // Если сам элемент содержит href, добавляем его
                        if (elementHref) {
                            linksInElement.push(elementHref);
                        }

                        if (!ignoreInnerLinks) {
                            const innerLinks = Array.from(element.querySelectorAll('a')).map(link => link.href);
                            linksInElement.push(...innerLinks);
                        }

                        return linksInElement;
                    });
                }, toRule.ignoreInnerLinks || false);
            } else {
                // Otherwise, extract all links from the entire page
                links = await page.$$eval('a', (links: HTMLAnchorElement[]) => links.map(link => link.href));
            }

            const uniqueLinks = [...new Set(links)];

            // Filter links by the regex pattern specified in the "pattern" field
            const filteredLinks = uniqueLinks.filter(link => new RegExp(toRule.pattern).test(link));

            allLinks.push(...filteredLinks);
        }
    }

    return allLinks;
}

async function navigateWithRetry(page: Page, url: string, maxRetries = 3): Promise<Boolean> {
    let attempts = 0;
    while (attempts < maxRetries) {
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
            //await page.waitForNetworkIdle({ idleTime: 1000}); // set this only waitUntil: 'networkidle0'
            //await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }); //понять как правильно использовать
            return true;
        } catch (error: any) {
            const errorMessage = (error instanceof Error) ? error.message : 'Unknown error';
            logError(`Error loading ${url}: ${errorMessage}. Retrying (${attempts + 1}/${maxRetries})...`);
            attempts++;
            await delay(3000);
        }
    }
    logError(`Failed to navigate to ${url} after ${maxRetries} attempts`);
    return false;
}

export async function crawl(jsonFolderPath: string, pdfFolderPath: string, htmlFolderPath: string, siteFolderPath: string,seedFilePath: string,options: CrawlOptions): Promise<void> {
    const { taskPath, downloadPDFmark, checkOpenAccess, useTor, uploadViaSSH, crawlDelay, headless, frontierStatePath, frontierSaveStatePath, useDatabase, coll_name } = options;

    let browser: Browser | undefined, page: Page | undefined, url: string | undefined;
    let dbClient: DatabaseClient | undefined;
    try {
        if (options.useDatabase) {
            const dbConfig = getDatabaseConfig();
            dbConfig.config.table = options.coll_name;
            dbClient = DatabaseFactory.createClient(dbConfig.type, dbConfig.config);
            await dbClient.connect();
        }

        const taskData = fs.readFileSync(taskPath, 'utf-8');
        const task = JSON.parse(taskData);
        const frontier = initializeFrontier(seedFilePath, frontierStatePath);

        const browserPage = await initializeBrowser(useTor, headless);
        browser = browserPage.browser;
        page = browserPage.page;

        while (frontier.hasMoreUrls()) {
            try {
                url = frontier.getNextUrl();
                if (!url) break;

                frontier.markVisited(url);
                logInfo(`Processing ${url}`);
                const urlLoaded = await navigateWithRetry(page, url); // TODO: возможность в задании опционально указывать waitUntil и timeout
                if (!urlLoaded) {
                    frontier.markFailed(url);
                    continue;
                }
                
                await delay(crawlDelay || 0); // Delay between requests

                const actionsBeforeExtraction = task.actions_before_extraction?.filter((pattern: any) => url && new RegExp(pattern.url_pattern).test(url));
                if (actionsBeforeExtraction && actionsBeforeExtraction.length > 0) {
                    for (const action of actionsBeforeExtraction) {
                        await performActions(page, action.actions);
                        logInfo(`Performed actions before extraction for ${url}`);
                    }
                }

                const matchingRules = task.crawl_rules?.filter((rule: CrawlRule) => url && new RegExp(rule.from).test(url));
                if (matchingRules && matchingRules.length > 0) {
                    const newLinks = await extractLinks(page, matchingRules); // TODO: собирать ссылки из определенных селекторов
                    newLinks.forEach(link => frontier.addUrl(link));
                }

                const matchingMetadataExtraction = task.metadata_extraction?.filter((pattern: MetadataExtractionRule) => url && new RegExp(pattern.url_pattern).test(url));
                if (matchingMetadataExtraction && matchingMetadataExtraction.length > 0) {
                    await extractData(page, jsonFolderPath, htmlFolderPath, matchingMetadataExtraction, url, dbClient);
                }

                const actionsAfterExtraction = task.actions_after_extraction?.filter((pattern: any) => url && new RegExp(pattern.url_pattern).test(url));
                if (actionsAfterExtraction && actionsAfterExtraction.length > 0) {
                    for (const action of actionsAfterExtraction) {
                        await performActions(page, action.actions);
                        logInfo(`Performed actions after extraction for ${url}`);
                    }
                }

                logInfo(`Successfully processed ${url}`);
                // save state
                if (frontierSaveStatePath) {
                    const savePath = path.join(frontierSaveStatePath, 'frontier_state.json');
                    frontier.saveState(savePath);
                }

            } catch (error) {
                const errorMessage = (error instanceof Error) ? error.stack : 'Unknown error';
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
        if (dbClient) {
            await dbClient.disconnect();
        }
    }
    logInfo('Crawling finished.');
}