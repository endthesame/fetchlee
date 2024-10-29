interface LinkRuleTo {
    pattern: string;
    selector?: string;
    ignoreInnerLinks?: boolean; // Дополнительный параметр для управления внутренними ссылками
}

interface CrawlRule {
    from: string;
    to: LinkRuleTo[];
}

interface MetadataField {
    selector: string | string[];  // Селектор или список селекторов для извлечения (список: используется первый найденный, который вернул не null и не "")
    property?: string;            // Опциональное свойство для указания атрибута или свойства
    collectAll?: boolean;         // Флаг для сбора всех данных по селектору
    delimiter?: string;           // Разделитель для данных, если collectAll = true
}

interface MetadataExtractionRule {
    url_pattern: string; // Pattern for matching URL
    fields: Record<string, MetadataField>; // Fields with corresponding selectors
    js_extraction_path?: string; // Optional path to a JS file for custom extraction logic
}

interface TaskConfig {
    crawl_rules: CrawlRule[];
    metadata_extraction: MetadataExtractionRule[]; // Массив правил извлечения метаданных
}

export {
    LinkRuleTo,
    CrawlRule,
    MetadataField,
    MetadataExtractionRule,
    TaskConfig,
}