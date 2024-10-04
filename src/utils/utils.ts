import request from 'request';
import { logInfo, logError } from '../logger';

export async function getCurrentIP(): Promise<string> {
    return new Promise((resolve, reject) => {
        const options = {
            url: 'https://api.ipify.org',
            proxy: 'http://127.0.0.1:8118', // Proxy
        };

        request(options, (error, response, body) => {
            if (!error && response.statusCode === 200) {
                resolve(body);
            } else {
                reject(error);
            }
        });
    });
}

export async function delay(time: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, time));
}
