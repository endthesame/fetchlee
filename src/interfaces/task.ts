interface LinkRuleTo {
    pattern: string;
    selector?: string;
    ignoreInnerLinks?: boolean; // Дополнительный параметр для управления внутренними ссылками
}

interface CrawlRule {
    from: string;
    to?: LinkRuleTo[];
    waitFor?: WaitForOptions; // используется для загрузки и ожидания страницы из from
}

interface WaitForOptions {
    selector?: string; // селектор для ожидания, если есть
    timeout?: number;  // таймаут для ожидания
    load?: "networkidle0" | "networkidle2" | "domcontentloaded"; // опционально: тип загрузки
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

interface LinkTransformationRule {
    pattern: string;      // Паттерн для поиска ссылок, которые нужно преобразовать
    transform: string;    // Шаблон для преобразования. Может содержать $1, $2 и т.д. для групп
    baseUrl?: string;     // Опциональный базовый URL для относительных ссылок
}

interface TaskConfig {
    crawl_rules: CrawlRule[];
    metadata_extraction: MetadataExtractionRule[]; // Массив правил извлечения метаданных
    links_transformation?: LinkTransformationRule[];
}

export {
    LinkRuleTo,
    CrawlRule,
    MetadataField,
    MetadataExtractionRule,
    TaskConfig,
    WaitForOptions,
    LinkTransformationRule
}