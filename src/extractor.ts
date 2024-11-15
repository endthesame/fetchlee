import { Page } from 'puppeteer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logInfo, logError } from './logger';
import { MetadataExtractionRule, MetadataField } from './interfaces/task';
import { DatabaseClient } from './database/database.interface';
import { pathToFileURL } from 'url';

// Function to dynamically import and run custom JS extraction logic
async function executeJsExtractor(page: Page, jsFilePath: string, url: string): Promise<Record<string, string | null>> {
    try {
        // Преобразование пути в формат file://
        const jsFileUrl = pathToFileURL(jsFilePath).href;
        const jsModule = await import(jsFileUrl);
        
        if (typeof jsModule.extractMetadata !== 'function') {
            throw new Error(`No extractMetadata function found in ${jsFilePath}`);
        }
        // Call the `extractMetadata` function from the JS module
        return await page.evaluate(jsModule.extractMetadata, { url });
    } catch (error) {
        const errorMessage = (error instanceof Error) ? error.message : 'Unknown error';
        logError(`Error executing JS extraction file: ${errorMessage}`);
        return {};
    }
}

// Universal function to extract fields using selectors
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

// Function to extract data from each page
export async function extractData(
    page: Page, 
    jsonFolderPath: string, 
    htmlFolderPath: string, 
    matchingMetadataExtraction: MetadataExtractionRule[], 
    url: string, 
    dbClient?: DatabaseClient
): Promise<void> {
    
    const task = matchingMetadataExtraction[0];

    let meta_data: Record<string, string | null> = {};

    // If a JS extraction path is provided, use custom extraction logic
    if (task.js_extraction_path) {
        const jsFilePath = path.resolve(__dirname, task.js_extraction_path);
        logInfo(`Using custom JS extraction from ${jsFilePath}`);
        meta_data = await executeJsExtractor(page, jsFilePath, url);
    } else {
        // Otherwise, use the standard selector-based extraction
        logInfo(`Using selector-based extraction for ${url}`);
        meta_data = await extractMetafields(page, task);
    }

    if (!meta_data || Object.keys(meta_data).length === 0) {
        logInfo(`Skipping extraction from ${url} - due to lack of metadata.`);
        return;
    }

    // Generate a unique filename based on the URL
    const encodedUrl = encodeURIComponent(url);
    const baseFileName = crypto.createHash('md5').update(encodedUrl).digest('hex');
    const jsonFileName = `${baseFileName}.json`;
    const jsonFilePath = path.join(jsonFolderPath, jsonFileName);

    // Save metadata to JSON file
    fs.writeFileSync(jsonFilePath, JSON.stringify(meta_data, null, 2));
    logInfo(`Successful extraction from ${url}: ${jsonFilePath}`);

    if (dbClient) {
        try {
            await dbClient.saveMetadata(meta_data, {url: url, baseFileName: baseFileName});
            logInfo(`Metadata saved to database for ${url}`);
        } catch (error) {
            logError(`Failed to save metadata to database for ${url}: ${error}`);
        }
    }

    // Save the HTML page for further analysis
    const htmlFilePath = path.join(htmlFolderPath, `${baseFileName}.html`);
    const htmlSource = await page.content();
    fs.writeFile(htmlFilePath, htmlSource, (err) => {
        if (err) logError(`Error saving HTML from ${url}: ${err.message}`);
    });
    logInfo(`HTML successfully saved from ${url}: ${htmlFilePath}`);
}
