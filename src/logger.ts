import fs from 'fs';
import path from 'path';
import { PROJECT_ROOT } from './../config';

const logsFolderPath = path.join(PROJECT_ROOT, 'logs');

// Создать структуру папок для логов, если она не существует
if (!fs.existsSync(logsFolderPath)) fs.mkdirSync(logsFolderPath);

// Создать файл для логов с текущим временем в названии
const logFileName = `log_${new Date().toLocaleString().replace(/[/:,\s]/g, '_')}.log`;
const logFilePath = path.join(logsFolderPath, logFileName);

// Универсальная функция для логирования с указанием типа сообщения (INFO или ERROR)
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

// Функция для логирования информационных сообщений
function logInfo(message: string): void {
    log(message, 'INFO');
}

// Функция для логирования сообщений об ошибках
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