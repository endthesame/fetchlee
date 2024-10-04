import path from 'path';
import { exec } from 'child_process';
import { logInfo, logError } from '../logger';
import { getCurrentIP } from './utils';
import { changingIPProcess } from './changeTorIp';
import { Page } from "puppeteer";

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

export async function shouldChangeIP(page: Page): Promise<boolean> {
    const status = await page.evaluate(() => {
        return document.readyState; // Используйте любые данные или свойства, которые позволяют вам определить состояние страницы.
    });
    const currentURL = page.url();

    // const isTitleAvailable = await page.evaluate(() => {
    //     if (document.querySelector('.uk-article-title')){
    //         return true;
    //     } else {
    //         return false;
    //     }
    // });

    // const error403 = await page.evaluate(() => {
    //     if (document.querySelector('.explanation-message')){
    //         return true
    //     }
    //     else if (document.querySelector('h1')){
    //         if (document.querySelector('h1')?.textContent === "403 Forbidden"){
    //             return true;
    //         }
    //     }
    //     else {
    //         return false
    //     }
    // });

    // Условие для смены IP-адреса, включая статус код и паттерн в URL
    if (Number(status) > 399 || currentURL.includes("hcvalidate.perfdrive")) {
        logInfo('Changing IP address...');
        await new Promise(resolve => setTimeout(resolve, 15000)); // чтобы тор не таймаутил
        await changeTorIp();
        logInfo('IP address changed successfully.');
        await getCurrentIP();
        return true;
    }
    return false;
}
