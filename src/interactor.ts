// page-interaction.ts

import { Page } from "puppeteer";
import { logInfo, logError } from './logger';
import { delay } from './utils/utils';

import { WaitCondition, PageState, InteractionRule, PageAction, ValidationRule} from './interfaces/interactor'

export class PageInteractionManager {
    private page: Page;
    private pageStates: Map<string, PageState>;
    private currentState: PageState | null;

    constructor(page: Page) {
        this.page = page;
        this.pageStates = new Map();
        this.currentState = null;
        this.setupPageListeners();
    }

    private setupPageListeners() {
        this.page.on('load', () => this.savePageState());
        this.page.on('error', (err) => logError(`Page error: ${err}`));
    }

    private async savePageState() {
        const url = this.page.url();
        const state: PageState = {
            url,
            content: await this.page.content(),
            timestamp: Date.now()
        };
        this.pageStates.set(url, state);
        this.currentState = state;
    }

    async waitForCondition(condition: WaitCondition): Promise<boolean> {
        try {
            switch (condition.type) {
                case 'selector':
                    await this.page.waitForSelector(condition.value as string, {
                        timeout: condition.timeout || 30000
                    });
                    break;
                case 'xpath':
                    await this.page.waitForSelector(`::-p-xpath(${condition.value})`, {
                        timeout: condition.timeout || 30000
                    });
                    break;
                case 'function':
                    await this.page.waitForFunction(
                        condition.value as (...args: any[]) => boolean | Promise<boolean>,
                        { timeout: condition.timeout || 30000 }
                    );
                    break;
                case 'network':
                    await this.page.waitForNavigation({
                        waitUntil: condition.value as 'networkidle0' | 'networkidle2' | 'domcontentloaded',
                        timeout: condition.timeout || 30000
                    });
                    break;
                case 'timeout':
                    await delay(condition.value as number);
                    break;
            }
            return true;
        } catch (error) {
            logError(`Wait condition failed: ${error}`);
            return false;
        }
    }

    async executeAction(action: PageAction): Promise<boolean> {
        try {
            switch (action.type) {
                case 'click':
                    await this.page.click(action.target || '', action.options);
                    break;
                case 'type':
                    await this.page.type(action.target || '', action.value, action.options);
                    break;
                case 'scroll':
                    if (action.target) {
                        await this.page.evaluate((selector: string) => {
                            const element = document.querySelector(selector);
                            if (element) element.scrollIntoView(true);
                        }, action.target);
                    }
                    break;
                case 'hover':
                    await this.page.hover(action.target || '');
                    break;
                case 'evaluate':
                    await this.page.evaluate(action.value);
                    break;
                case 'extract':
                    return await this.extractContent(action.target || '', action.options);
            }
            return true;
        } catch (error) {
            logError(`Action execution failed: ${error}`);
            return false;
        }
    }

    async executeInteractionRule(rule: InteractionRule): Promise<boolean> {
        let attempts = 0;
        const maxAttempts = rule.retries || 3;

        while (attempts < maxAttempts) {
            try {
                logInfo(`Executing interaction rule: ${rule.name} (attempt ${attempts + 1}/${maxAttempts})`);
                
                if(rule.condition){
                    const conditionMet = await this.waitForCondition(rule.condition);
                    if (!conditionMet) throw new Error('Initial condition not met');
                }

                for (const action of rule.actions) {
                    const actionSuccess = await this.executeAction(action);
                    if (!actionSuccess) throw new Error(`Action ${action.type} failed`);
                }

                if (rule.validation) {
                    const isValid = await this.validateResult(rule.validation);
                    if (!isValid) throw new Error('Validation failed');
                }

                if (rule.afterDelay) {
                    await delay(rule.afterDelay);
                }

                await this.savePageState();
                return true;
            } catch (error) {
                logError(`Interaction rule failed: ${error}`);
                attempts++;
                if (attempts < maxAttempts) {
                    await delay(2000);
                }
            }
        }
        return false;
    }

    private async validateResult(validation: ValidationRule): Promise<boolean> {
        try {
            switch (validation.type) {
                case 'selector':
                    const element = await this.page.$(validation.value as string);
                    return !!element;
                case 'content':
                    const content = await this.page.content();
                    return (validation.value as RegExp).test(content);
                case 'url':
                    const url = this.page.url();
                    return (validation.value as RegExp).test(url);
                case 'custom':
                    const result = await this.page.evaluate(
                        validation.value as (...args: any[]) => boolean | Promise<boolean>
                    );
                    return !!result;
                default:
                    return false;
            }
        } catch (error) {
            logError(`Validation failed: ${error}`);
            return false;
        }
    }

    async extractContent(selector: string, options: any = {}): Promise<any> {
        try {
            const elements = await this.page.$$(selector);
            const results = await Promise.all(
                elements.map(element =>
                    this.page.evaluate(
                        (el, opts) => {
                            if (opts.attribute) return el.getAttribute(opts.attribute);
                            if (opts.property) return (el as any)[opts.property];
                            return el.textContent;
                        },
                        element,
                        options
                    )
                )
            );
            return options.multiple ? results : results[0];
        } catch (error) {
            logError(`Content extraction failed: ${error}`);
            return null;
        }
    }
}