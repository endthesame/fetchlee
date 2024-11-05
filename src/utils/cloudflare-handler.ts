import { Page } from 'puppeteer';
import { logInfo, logError } from '../logger';
import { delay } from './utils';

export class CloudflareHandler {
  private page: Page;
  private maxAttempts: number;
  private timeout: number;

  constructor(page: Page, maxAttempts: number = 3, timeout: number = 30000) {
    this.page = page;
    this.maxAttempts = maxAttempts;
    this.timeout = timeout;
  }

  async detectCloudflare(): Promise<boolean> {
    try {
      return await this.page.evaluate(() => {
        const cfChallenge = document.getElementById('challenge-form');
        const cfRayId = document.querySelector('[data-ray]');
        const cfTitle = document.title.toLowerCase().includes('cloudflare') || document.title.includes('Just a moment...');
        const turnstileFrame = document.querySelector('iframe[src*="challenges.cloudflare.com"]');
        return !!(cfChallenge || cfRayId || cfTitle || turnstileFrame);
      });
    } catch (error) {
      const errorMessage = (error instanceof Error) ? error.message : 'Unknown error';
      logError(`Error detecting Cloudflare: ${errorMessage}`);
      return false;
    }
  }

  async handleCloudflare(): Promise<boolean> {
    let attempts = 0;

    while (attempts < this.maxAttempts) {
      try {
        logInfo('Attempting to solve Cloudflare challenge...');
        
        // Ждем загрузки страницы с проверкой
        await delay(2000);

        // Проверяем наличие различных типов проверок Cloudflare
        const challengeExists = await this.page.evaluate(() => {
          const selectors = [
            '#challenge-stage',
            '[type="submit"]',
            '.ray-id button',
            '.challenge-button',
            'iframe[src*="challenges.cloudflare.com"]'
          ];
          return selectors.some(selector => document.querySelector(selector));
        });

        if (!challengeExists) {
          logInfo('No Cloudflare challenge detected');
          return true;
        }

        // Пытаемся найти и кликнуть по кнопке или выполнить действие
        await this.page.evaluate(() => {
          const button = document.querySelector('[type="submit"], .ray-id button, .challenge-button') as HTMLElement;
          if (button) button.click();
        });

        // Ждем исчезновения проверки
        await this.page.waitForFunction(
          () => {
            const elements = [
              '#challenge-stage',
              '[data-ray]',
              'iframe[src*="challenges.cloudflare.com"]'
            ];
            return !elements.some(selector => document.querySelector(selector));
          },
          { timeout: this.timeout }
        );

        logInfo('Successfully passed Cloudflare challenge');
        return true;

      } catch (error) {
        const errorMessage = (error instanceof Error) ? error.message : 'Unknown error';
        attempts++;
        logError(`Cloudflare challenge attempt ${attempts} failed: ${errorMessage}`,);
        if (attempts < this.maxAttempts) {
          await delay(2000);
        }
      }
    }

    return false;
  }

  async setupNavigationHandler() {
    this.page.on('load', async () => {
      const isCloudflare = await this.detectCloudflare();
      if (isCloudflare) {
        await this.handleCloudflare();
      }
    });
  }

  // Метод для использования в navigateWithRetry
  async handleNavigation(url: string): Promise<boolean> {
    const isCloudflare = await this.detectCloudflare();
    if (isCloudflare) {
      logInfo(`Detected Cloudflare challenge at ${url}`);
      return await this.handleCloudflare();
    }
    return true;
  }
}