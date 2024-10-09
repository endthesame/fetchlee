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