import fs from 'fs';
import path from 'path';
import { crawl } from './src/crawler';
//import { parsing } from './src/parser';
import { logInfo, logError } from './src/logger';
//import { downloadPDFs } from './src/download-utils-puppeteer';
import { Command } from 'commander';

interface SetupOptions {
    coll_name: string;
    output: string;
    links?: string;
    task?: string;
}

async function setupDirectories(options: SetupOptions) {
    const { coll_name, output, links } = options;
    const siteFolderPath = path.join(output, coll_name);
    const jsonFolderPath = path.join(siteFolderPath, 'jsons');
    const pdfFolderPath = path.join(siteFolderPath, 'pdfs');
    const htmlFolderPath = path.join(siteFolderPath, 'htmls');
    const linksFilePath = path.join(siteFolderPath, 'remaining_links.txt');

    // Create folder structure if it doesn't exist
    if (!fs.existsSync(output)) fs.mkdirSync(output);
    if (!fs.existsSync(siteFolderPath)) fs.mkdirSync(siteFolderPath);
    if (!fs.existsSync(jsonFolderPath)) fs.mkdirSync(jsonFolderPath);
    if (!fs.existsSync(pdfFolderPath)) fs.mkdirSync(pdfFolderPath);
    if (!fs.existsSync(htmlFolderPath)) fs.mkdirSync(htmlFolderPath);

    // Copy file with links
    if (links) {
        fs.copyFileSync(links, linksFilePath);
    }

    return { siteFolderPath, jsonFolderPath, pdfFolderPath, htmlFolderPath, linksFilePath };
}

async function main() {
    const program = new Command();

    program
        .name('Crawler')
        .description('Puppeteer crawler using Node.js. You can crawl metadata, download PDFs, check open access, etc.')
        .version('0.0.1')
        .option('-c, --coll_name <string>', 'collection name', 'default_host_name')
        .option('-o, --output <path>', 'path to output folder', path.join(__dirname, 'output'))
        .option('-e, --task <path>', 'path to task extractor', path.join(__dirname, 'tasks/sample_task.json'))
        .option('-l, --links <path>', 'path to file with links', path.join(__dirname, 'your_links_file.txt'))
        .helpOption('-h, --HELP', 'read more information');

    // Crawling command
    program
        .command('crawl')
        .description('Run the crawler and optionally download PDFs')
        .option('-p, --download_pdf', 'download PDFs after crawling')
        .option('-a, --open_access', 'check open access before download')
        .option('-t, --use_tor', 'use Tor for crawling')
        .option('-s, --upload_ssh', 'upload source data via SSH')
        .option('-d, --delay <number>', 'delay between requests', '0')
        .action(async (options) => {
            const globalOptions = program.opts<SetupOptions>();
            const { siteFolderPath, jsonFolderPath, pdfFolderPath, htmlFolderPath, linksFilePath } = await setupDirectories(globalOptions);

            logInfo(`Crawling started. Collection name: ${globalOptions.coll_name}; Output folder: ${globalOptions.output}`);
            logInfo("Directories are set up.");
            await crawl(jsonFolderPath, pdfFolderPath, htmlFolderPath, siteFolderPath, linksFilePath, {
                taskPath: path.resolve(__dirname, globalOptions.task || path.join(__dirname, 'tasks/sample_task.json')),
                downloadPDFmark: options.download_pdf,
                checkOpenAccess: options.open_access,
                useTor: options.use_tor,
                uploadViaSSH: options.upload_ssh,
                crawlDelay: parseInt(options.delay)
            });

            // if (options.download_pdf) {
            //     await downloadPDFs(path.join(siteFolderPath, "Links.txt"), pdfFolderPath);
            // }
        });

    // Parsing command
    program
        .command('parsing')
        .description('Run parsing of metadata and HTML files')
        .action(async () => {
            const globalOptions = program.opts<SetupOptions>();
            const { jsonFolderPath, htmlFolderPath } = await setupDirectories(globalOptions);

            //await parsing(jsonFolderPath, htmlFolderPath, globalOptions.task);
        });

    await program.parseAsync(process.argv);
}

main().catch((error) => {
    logError(`Error during crawling: ${error.message}`);
});