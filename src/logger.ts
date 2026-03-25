import fs from 'fs';
import path from 'path';
import { PROJECT_ROOT } from './../config';

const logsFolderPath = path.join(PROJECT_ROOT, 'logs');

// folder structure for logs if it doesn't exist
if (!fs.existsSync(logsFolderPath)) fs.mkdirSync(logsFolderPath);

// file for logs with current time in the name
const logFileName = `log_${new Date().toLocaleString().replace(/[/:,\s]/g, '_')}.log`;
const logFilePath = path.join(logsFolderPath, logFileName);

// function for logging with indication of message type (INFO / ERROR / WARNING)
function log(message: string, level: 'INFO' | 'WARNING' | 'ERROR' = 'INFO'): void {
    const timestamp = new Date().toLocaleString();
    const logMessage = `[${timestamp}] [${level}] ${message}\n`;
    
    fs.appendFileSync(logFilePath, logMessage);

    switch (level) {
        case 'ERROR':
            console.error(logMessage);
            break;
        case 'WARNING':
            console.warn(logMessage);
            break;
        default:
            console.log(logMessage);
            break;
    }
}


function logInfo(message: string): void {
    log(message, 'INFO');
}

function logError(message: string | Error): void {
    if (message instanceof Error) {
        log(message.stack || message.message, 'ERROR');
        return;
    } else {
        log(message, 'ERROR');
    }
}

function logWarn(message: string | Error): void {
    if (message instanceof Error) {
        log(message.stack || message.message, 'WARNING');
        return;
    } else {
        log(message, 'WARNING');
    }
}

export { logInfo, logError, logWarn };