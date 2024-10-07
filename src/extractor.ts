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
    // TODO: 1) Если первый селектор не нашелся - ищем по второму; 2) Сделать метку чтобы можно было собирать все данные по 1 селектору и сделать разделитель для нее
    // Обход каждого поля и селектора для извлечения данных
    for (const [key, fieldRule] of Object.entries(metaRule.fields)) {
        const { selector, property = 'textContent' } = fieldRule as MetadataField;

        try {
            fields[key] = await page.$eval(selector, (el: Element, prop: string) => {
                // Сначала проверяем, если у элемента есть прямое свойство с указанным именем
                if (prop in el) {
                    // @ts-ignore для работы с динамическими свойствами
                    return (el as any)[prop]?.trim() || "";
                } else {
                    // Если свойства нет, пробуем получить атрибут
                    return el.getAttribute(prop) || "";
                }
            }, property);
        } catch (error) {
            //logError(`Error extracting ${key}: ${error}`);
            fields[key] = "";
        }
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
