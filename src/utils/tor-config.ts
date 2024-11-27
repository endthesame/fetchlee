import path from 'path';
import { exec } from 'child_process';
import { logInfo, logError, logWarn } from '../logger';
import { getCurrentIP } from './utils';
import { changingIPProcess } from './changeTorIp';
import { Page } from "puppeteer";
import { BlockRule } from '../interfaces/task'

export async function changeTorIp(): Promise<Boolean> {
    try {
        const result = await changingIPProcess();
        const newIP = await getCurrentIP();
        logInfo(`${result}: ${newIP}`); 
        return true;
    } catch (error) {
        logError(`Error changing IP: ${(error as Error).message}`);
        return false;
    }
}

export async function shouldChangeIP(page: Page, blockRule: BlockRule): Promise<boolean> {
    const currentUrl = page.url();

    if (blockRule.url_patterns){
        for (const url_pattern of blockRule.url_patterns){
            if (url_pattern && new RegExp(url_pattern).test(currentUrl)) {
                logInfo(`${currentUrl}: URL block rule matched: ${currentUrl}`);
                return true;
            }
        }
    }
    
    if (blockRule.selectors){
        for (const selector of blockRule.selectors){
            const isNegation = selector.startsWith('!');
            const actualSelector = isNegation ? selector.slice(1) : selector;
    
            const elementExists = await page.$(actualSelector);
            if ((isNegation && !elementExists) || (!isNegation && elementExists)) {
                logInfo(`${currentUrl}: Selector block rule matched: ${selector}`);
                return true;
            }
        }
    }

    if (blockRule.xpaths){
        for (const xpath of blockRule.xpaths) {
            const isNegation = xpath.startsWith('!');
            const actualXPath = isNegation ? xpath.slice(1) : xpath;
    
            const elementExists = await page.$$(`::-p-xpath(${actualXPath})`);
            if ((!isNegation && elementExists.length > 0) || (isNegation && elementExists.length === 0)) {
                logInfo(`${currentUrl}: XPath block rule matched: ${xpath}`);
                return true;
            }
        }
    }

    return false; // Блокировки нет
}
