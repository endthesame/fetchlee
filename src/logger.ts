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
function log(message: string, level: 'INFO' | 'ERROR' = 'INFO'): void {
    const timestamp = new Date().toLocaleString();
    const logMessage = `[${timestamp}] [${level}] ${message}\n`;
    
    fs.appendFileSync(logFilePath, logMessage);

    if (level === 'ERROR') {
        console.error(logMessage);
    } else {
        console.log(logMessage);
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

export { logInfo, logError };