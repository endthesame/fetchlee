import { PuppeteerExtra } from "puppeteer-extra";
import { Browser, Page, PuppeteerLaunchOptions } from "puppeteer";
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import { extractData } from './extractor';
import SQLiteFrontier from './frontier';
import { logInfo, logError, logWarn } from './logger';
import { delay } from './utils/utils';
import { changeTorIp, shouldChangeIP } from './utils/tor-config';
import { CrawlRule, MetadataExtractionRule, WaitForOptions, LinkTransformationRule, Interaction, BlockRule} from './interfaces/task'
import path from "path";
import { DatabaseClient } from './database/database.interface';
import { DatabaseFactory } from './database/database.factory';
import { getDatabaseConfig } from './config/database.config';
import { CloudflareHandler } from './utils/cloudflare-handler';
import { MouseSimulator } from './utils/mouse-simulator';
import { PageInteractionManager } from './interactor';
import { loadBrowserConfig } from './utils/config-loader'

const puppeteer: PuppeteerExtra = require('puppeteer-extra');
puppeteer.use(StealthPlugin());

interface CrawlOptions {
    taskPath: string;
    downloadPDFmark?: boolean;
    checkOpenAccess?: boolean;
    useTor?: boolean;
    uploadViaSSH?: boolean;
    crawlDelay?: number;
    headless?: boolean;
    frontierStatePath?: string;
    clearHistory?: boolean;
    useDatabase?: boolean;
    collName: string;
    handleCloudflare?: boolean;
    simulateMouse?: boolean;
    browserConfigPath?: string;
}

function initializeFrontier(
    seedFilePath: string,
    options: {
        frontierStatePath?: string;
        collName: string;
        clearHistory?: boolean;
    }
): SQLiteFrontier {
    const frontier = new SQLiteFrontier({
        frontierStatePath: options.frontierStatePath,
        collName: options.collName
    });

    try {
        // Очистка истории при наличии флага
        if (options.clearHistory) {
            frontier.clearCollection();
        }

        const seeds = fs.readFileSync(seedFilePath, 'utf-8')
            .split('\n')
            .filter(url => url.trim() !== '');
        
        frontier.addUrls(seeds);
        logInfo(`Initialized frontier for collection "${options.collName}" with ${seeds.length} seeds`);
    } catch (error) {
        const errorMessage = (error instanceof Error) ? error.message : 'Unknown error';
        logError(`Failed to initialize frontier: ${errorMessage}`);
        throw error;
    }

    return frontier;
}

async function initializeBrowser(
    options: CrawlOptions
): Promise<{ browser: Browser; page: Page }> {
    const config = loadBrowserConfig(options.browserConfigPath);
    // Базовые настройки запуска
    const launchOptions: PuppeteerLaunchOptions = {
        headless: options.headless || config.headless,
        args: config.args,
        timeout: config.timeout,
        executablePath: config.executablePath,
        userDataDir: config.userDataDir
    };

    // Обработка Tor (добавляем поверх конфига)
    if (options.useTor) {
        const isTorEnabled = await changeTorIp();
        if (isTorEnabled) {
            launchOptions.args?.push('--proxy-server=127.0.0.1:8118');
            logInfo('Tor proxy enabled');
        }
    }

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    if (config.defaultViewport) {
        await page.setViewport({
            width: config.defaultViewport.width,
            height: config.defaultViewport.height
        });
    }

    return { browser, page };
}

function transformUrl(url: string, transformations: LinkTransformationRule[]): string {
    if (!url) return url;
    
    // Применяем все подходящие трансформации
    for (const transform of transformations) {
        const regex = new RegExp(transform.pattern);
        if (regex.test(url)) {
            
            if (transform.baseUrl) {
                url = `${transform.baseUrl.replace(/\/$/, '')}${url}`;
            }
            
            url = url.replace(regex, transform.transform);
            break;
        }
    }

    return url;
}

async function extractLinks(page: Page, rules: CrawlRule[], transformations: LinkTransformationRule[]): Promise<string[]> {
    const allLinks: string[] = [];

    for (const rule of rules) {
        if (rule.to) for (const toRule of rule.to) {
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

            const transformedLinks = uniqueLinks.map(link => {
                if (transformations) {
                    return transformUrl(link, transformations);
                }
                return link;
            });

            // Filter links by the regex pattern specified in the "pattern" field
            const filteredLinks = transformedLinks.filter(link => new RegExp(toRule.pattern).test(link));

            allLinks.push(...filteredLinks);
        }
    }

    return allLinks;
}

async function handleBlockDetection(page: Page, blockRule: BlockRule): Promise<boolean> {
    if (blockRule && await shouldChangeIP(page, blockRule)) {
        logInfo(`Block detected. Changing IP...`);
        await changeTorIp();
        return true;
    }
    return false;
}

async function navigateWithRetry(
    page: Page, 
    url: string, 
    waitForOptions: WaitForOptions = { load: "networkidle2", timeout: 60000 }, 
    handleCloudflare: boolean = false, 
    maxRetries: number = 3,
    useTor: boolean = false,
    blockRule: BlockRule
): Promise<Boolean> {
    let attempts = 0;
    const cloudflareHandler = handleCloudflare ? new CloudflareHandler(page) : null;
    const navigationOptions = { 
        waitUntil: waitForOptions.load || "networkidle2", 
        timeout: waitForOptions.timeout || 60000 
    };

    while (attempts < maxRetries) {
        try {
            
            await page.goto(url, navigationOptions);

            if (cloudflareHandler) {
                const result = await cloudflareHandler.handleNavigation(url);
                if (!result) {
                    throw new Error('Failed to handle Cloudflare challenge');
                }
            }

            if (waitForOptions.selector) {
                await page.waitForSelector(waitForOptions.selector, { timeout: waitForOptions.timeout });
            }

            // Проверяем блокировки после загрузки страницы
            if (useTor && (await handleBlockDetection(page, blockRule))) {
                continue; // Если IP сменился, пробуем снова
            }

            return true;
        } catch (error: any) {
            const errorMessage = (error instanceof Error) ? error.message : 'Unknown error';
            logError(`Error loading ${url}: ${errorMessage}. Retrying (${attempts + 1}/${maxRetries})...`);

            if (useTor && (await handleBlockDetection(page, blockRule))) {
                continue; // Если IP сменился, пробуем снова
            }

            attempts++;
            await delay(3000);
        }
    }
    logError(`Failed to navigate to ${url} after ${maxRetries} attempts`);
    return false;
}

export async function crawl(
    jsonFolderPath: string, 
    pdfFolderPath: string, 
    htmlFolderPath: string, 
    siteFolderPath: string, 
    seedFilePath: string, 
    options: CrawlOptions
): Promise<void> {

    let browser: Browser | undefined, page: Page | undefined, url: string | undefined;
    let dbClient: DatabaseClient | undefined;
    let mouseSimulator: MouseSimulator | undefined;
    let frontier: SQLiteFrontier | undefined;

    try {
        if (options.useDatabase) {
            const dbConfig = getDatabaseConfig();
            dbConfig.config.coll_name = options.collName;
            dbClient = DatabaseFactory.createClient(dbConfig.type, dbConfig.config);
            await dbClient.connect();
        }

        const taskData = fs.readFileSync(options.taskPath, 'utf-8');
        const task = JSON.parse(taskData);
        frontier = initializeFrontier(seedFilePath, {collName: options.collName, frontierStatePath: options.frontierStatePath, clearHistory: options.clearHistory});

        const viewportOptions = { width: 1280, height: 720 }
        const browserPage = await initializeBrowser(options);
        browser = browserPage.browser;
        page = browserPage.page;

        const pageInteractionManager = new PageInteractionManager(page);

        // Start simulating mouse movement
        if (options.simulateMouse) {
            mouseSimulator = new MouseSimulator(page);
        }

        while (frontier.hasMoreUrls()) {
            try {
                const url = await frontier.getNextUrl();
                if (!url) break;

                mouseSimulator?.simulateMouseMovement(0, viewportOptions.width, 0, viewportOptions.height, 50, 500);

                const matchingRules = task.crawl_rules?.filter((rule: CrawlRule) => url && new RegExp(rule.from).test(url));
                let waitForOptions: WaitForOptions = { load: "networkidle2", timeout: 60000 }; // дефолтные waitForOptions
                // Если найдено соответствующее правило, используем его waitFor настройки
                if (matchingRules && matchingRules.length > 0) {
                    waitForOptions = matchingRules[0].waitFor || waitForOptions; // Применяем waitFor из первого совпадения или дефолт
                }
                let blockRule: BlockRule = {};
                if (matchingRules && matchingRules.length > 0) {
                    blockRule = matchingRules[0].blockRule || blockRule;
                }

                logInfo(`Processing ${url}`);
                const urlLoaded = await navigateWithRetry(page, url, waitForOptions, options.handleCloudflare, 3, options.useTor, blockRule);
                if (!urlLoaded) {
                    frontier.markFailed(url);
                    continue;
                }

                await mouseSimulator?.stopMouseMovement();
                
                await delay(options.crawlDelay || 0); // Delay between requests

                // Interaction rules
                if (task.interaction_rules) {
                    const matchingInteractionRules = task.interaction_rules
                        .filter((rule: Interaction) => url && new RegExp(rule.url_pattern).test(url));
    
                    for (const ruleSet of matchingInteractionRules) {
                        for (const rule of ruleSet.rules) {
                            await pageInteractionManager.executeInteractionRule(rule);
                        }
                    }
                }

                // Links extraction
                if (matchingRules && matchingRules.length > 0) {
                    const newLinks = await extractLinks(page, matchingRules, task.links_transformation);
                    await frontier?.addUrls(newLinks);
                    logInfo(`Extracted ${newLinks.length} links from ${url}`);
                }

                // Metadata extraction
                const matchingMetadataExtraction = task.metadata_extraction?.filter(
                    (pattern: MetadataExtractionRule) => url && new RegExp(pattern.url_pattern).test(url)
                );
                
                if (matchingMetadataExtraction && matchingMetadataExtraction.length > 0) {
                    await extractData(page, jsonFolderPath, htmlFolderPath, matchingMetadataExtraction, url, dbClient);
                }

                await frontier.markCompleted(url);
                logInfo(`Successfully processed ${url}`);

            } catch (error) {
                if (url){
                    await frontier.markFailed(url);
                }
                await mouseSimulator?.stopMouseMovement();
                const errorMessage = (error instanceof Error) ? error.stack : 'Unknown error';
                logError(`Error processing ${url || 'unknown URL'}: ${errorMessage}`);
            }
        }
    } catch (error) {
        const errorMessage = (error instanceof Error) ? error.stack : 'Unknown error';
        logError(`Critical error: ${errorMessage}`);
    } finally {
        await mouseSimulator?.stopMouseMovement();

        if (browser) {
            logInfo('Closing browser.');
            await browser.close();
        }

        await dbClient?.disconnect();
    }
    logInfo('Crawling finished.');
}