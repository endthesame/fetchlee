export interface WaitCondition {
    type: 'selector' | 'xpath' | 'function' | 'network' | 'timeout';
    value: string | number | ((...args: any[]) => boolean | Promise<boolean>);
    timeout?: number;
}

export interface PageState {
    url: string;
    content?: string;
    screenshot?: Buffer;
    timestamp: number;
}

export interface InteractionRule {
    name?: string;
    condition?: WaitCondition;
    actions: PageAction[];
    validation?: ValidationRule;
    retries?: number;
    afterDelay?: number;
}

export interface PageAction {
    type: 'click' | 'type' | 'scroll' | 'hover' | 'select' | 'evaluate' | 'waitFor' | 'extract';
    target?: string;
    value?: any;
    options?: any;
}

export interface ValidationRule {
    type: 'selector' | 'content' | 'url' | 'custom';
    value: string | RegExp | ((...args: any[]) => boolean | Promise<boolean>);
    timeout?: number;
}