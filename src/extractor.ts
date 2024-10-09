import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logInfo, logError } from './logger';
import { Page } from 'puppeteer';
import { MetadataExtractionRule, MetadataField} from './interfaces/task'

// Универсальная функция для извлечения любых свойств элемента
async function extractMetafields(page: Page, metaRule: MetadataExtractionRule): Promise<Record<string, string | null>> {
    if (!metaRule) return {};

    const fields: Record<string, string | null> = {};

    for (const [key, fieldRule] of Object.entries(metaRule.fields)) {
        const selectors = Array.isArray(fieldRule.selector) ? fieldRule.selector : [fieldRule.selector];
        const { property = 'textContent', collectAll = false, delimiter = ' ' } = fieldRule;

        let fieldValue = '';

        try {
            for (const selector of selectors) {
                if (collectAll) {
                    // Extract all matching elements' properties and join them with the delimiter
                    fieldValue = await page.$$eval(selector, (elements: Element[], prop: string, delim: string) => {
                        return elements
                            .map(el => (prop in el ? (el as any)[prop]?.trim() : el.getAttribute(prop)) || "")
                            .filter(Boolean)
                            .join(delim);
                    }, property, delimiter);

                    if (fieldValue) break; // Stop if we found data for any selector
                } else {
                    // Extract the first matching element's property
                    fieldValue = await page.$eval(selector, (el: Element, prop: string) => {
                        return prop in el ? (el as any)[prop]?.trim() : el.getAttribute(prop) || "";
                    }, property);
                    
                    if (fieldValue) break; // Stop if we found data for any selector
                }
            }
        } catch (error) {
            // logError(`Error extracting ${key}: ${error}`);
            fieldValue = "";
        }

        fields[key] = fieldValue;
    }

    return fields;
}


// Функция для извлечения данных с каждой страницы
export async function extractData(page: Page, jsonFolderPath: string, htmlFolderPath: string, matchingMetadataExtraction: MetadataExtractionRule[], url: string): Promise<void> {
    // Используем первое совпадение с URL-паттерном для извлечения данных
    const task = matchingMetadataExtraction[0];
    const meta_data = await extractMetafields(page, task);

    if (!meta_data) {
        logInfo(`Skipping extraction from ${url} - due to lack of metadata.`);
        return;
    }

    // Добавляем URL в метаданные
    meta_data["url"] = url;

    // Генерация уникального имени файла на основе URL
    const encodedUrl = encodeURIComponent(url);
    const baseFileName = crypto.createHash('md5').update(encodedUrl).digest('hex');
    const jsonFileName = `${baseFileName}.json`;
    const jsonFilePath = path.join(jsonFolderPath, jsonFileName);

    // Сохранение метаданных в JSON-файл
    fs.writeFileSync(jsonFilePath, JSON.stringify(meta_data, null, 2));
    logInfo(`Successful extraction from ${url}: ${jsonFilePath}`);

    // Сохранение HTML-страницы для дальнейшего анализа
    const htmlFilePath = path.join(htmlFolderPath, `${baseFileName}.html`);
    const htmlSource = await page.content();
    fs.writeFile(htmlFilePath, htmlSource, (err) => {
        if (err) console.log(err);
    });
    logInfo(`HTML Successful saved from ${url}: ${htmlFilePath}`);
}
