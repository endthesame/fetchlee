import { InteractionRule } from './interactor'

interface LinkRuleTo {
    pattern: string; // The regexp is specified by which links will be selected
    selector?: string; // The selector is specified by which links will be selected
    ignoreInnerLinks?: boolean; // Additional parameter for managing internal links
}

interface CrawlRule {
    from: string; // the pattern of the link on which subsequent actions will take place is indicated
    to?: LinkRuleTo[];
    waitFor?: WaitForOptions; // used to load and wait for a page from "from"
    blockRule?: BlockRule
}

interface BlockRule {
    url_patterns?: string[]; // Check URL
    selectors?: string[]; // Check selector
    xpaths?: string[]; // Check XPath
};

interface WaitForOptions {
    selector?: string; // selector to wait for if any
    timeout?: number;  // timeout for waiting
    load?: "networkidle0" | "networkidle2" | "domcontentloaded"; // type of loading
}

interface MetadataField {
    selector: string | string[]; // // Selector or list of selectors to retrieve (list: the first one found that returns neither null nor "" is used)
    property?: string; // specifying an attribute or property
    collectAll?: boolean; // Flag for collecting all data by selector
    delimiter?: string; // Separator for data if collectAll = true
}

interface MetadataExtractionRule {
    url_pattern: string; // Pattern for matching URL
    fields: Record<string, MetadataField>; // Fields with corresponding selectors
    js_extraction_path?: string; // Optional path to a JS file for custom extraction logic
}

interface LinkTransformationRule {
    pattern: string; // Pattern for finding links to convert
    transform: string; // // Template for transform. May contain $1, $2, etc. for groups
    baseUrl?: string; // Optional base URL for relative links
}

interface Interaction {
    url_pattern: string;
    rules: InteractionRule[];
}

interface TaskConfig {
    crawl_rules: CrawlRule[];
    metadata_extraction: MetadataExtractionRule[];
    links_transformation?: LinkTransformationRule[];
    interaction_rules?: Interaction[];
}

export {
    LinkRuleTo,
    CrawlRule,
    MetadataField,
    MetadataExtractionRule,
    TaskConfig,
    WaitForOptions,
    LinkTransformationRule,
    Interaction,
    BlockRule
}