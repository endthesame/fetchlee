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
    selector: string;  // Селектор для извлечения
    property?: string; // Опциональное свойство для указания атрибута или свойства откуда извлекать. По умолчанию textContent
}

interface MetadataExtractionRule {
    url_pattern: string; // Паттерн URL для применения правила
    fields: Record<string, MetadataField>; // Поля с соответствующими селекторами
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