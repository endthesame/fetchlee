module.exports = {
    extractMetadata: function () {
    // Ваш код для извлечения метаданных здесь
    // Верните результат в виде объекта
        const getMetaAttribute = (selector, attribute, childSelector) => {
            const element = document.querySelector(selector);
            if (element) {
                const targetElement = childSelector ? element.querySelector(childSelector) : element;
                return targetElement.getAttribute(attribute) || "";
            }
            return "";
        };
        
        const getMetaAttributes = (selectors, attribute, childSelector) => {
            let values = [];
            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    values = Array.from(elements).map(element => {
                        const targetElement = childSelector ? element.querySelector(childSelector) : element;
                        return targetElement.getAttribute(attribute);
                    });
                    break; // Прерываем цикл после первого успешного поиска
                }
            }
            // if (values.length === 0) {
            //     return "";
            // }
            return values.join('; ');
        };

        function romanToNumberOrReturn(input) {
            const romanNumerals = {
                'I': 1,
                'V': 5,
                'X': 10,
                'L': 50,
                'C': 100,
                'D': 500,
                'M': 1000,
                'i': 1,
                'v': 5,
                'x': 10,
                'l': 50,
                'c': 100,
                'd': 500,
                'm': 1000

            };
        
            // Проверка, является ли входное значение римской цифрой
            function isRoman(input) {
                return /^[IVXLCDMivxlcdm]+$/i.test(input);
            }
        
            // Если входное значение не является римской цифрой, возвращаем его без изменений
            if (!isRoman(input)) {
                return input;
            }
        
            let result = 0;
            let prevValue = 0;
        
            // Преобразование римской цифры в число
            for (let i = input.length - 1; i >= 0; i--) {
                let currentValue = romanNumerals[input[i]];
        
                if (currentValue < prevValue) {
                    result -= currentValue;
                } else {
                    result += currentValue;
                }
        
                prevValue = currentValue;
            }
        
            // Преобразование числа в строку и возвращение результата
            return result.toString();
        }

        function getMFDict(){
            let scriptElement = document.querySelector('script[type="application/ld+json"]');
            let scriptText, dictionary
            try {
                scriptText = scriptElement.textContent;
                dictionary = JSON.parse(scriptText);
            } catch (error){
                dictionary = null
            }
            return dictionary
        }
        let mf_dict = getMFDict();

        let title = document.querySelector('.product-title')? document.querySelector('.product-title').innerText.trim() : "";
        if (title == ""){
            title = mf_dict?.name || "";
        }
        let mf_book = title;

        let date = document.querySelector('#product-publication-date-feature')? document.querySelector('#product-publication-date-feature').innerText.match(/\d{4}/)? document.querySelector('#product-publication-date-feature').innerText.match(/\d{4}/)[0] : "" : "";
        if (date.length == 4){
            date = `${date}-01-01`;
        }

        let authors = "";
        if (authors == ""){
            mf_dict?.author?.forEach(function(author, index) {
                // Проверяем, есть ли у автора аффиляции
                if (author?.name?.length > 0) {
                    // Добавляем в переменную affiliations имя автора и его аффиляции в нужном формате
                    authors += author.name;
                    // Добавляем ";;" после каждого автора, кроме последнего
                    if (index !== mf_dict.author.length - 1) {
                        authors += '; ';
                    }
                }
            });
            authors = authors.trim()
        }

        let edition = document.querySelector('#product-edition-number-feature')? document.querySelector('#product-edition-number-feature').innerText.replace("Edition:","").trim() : "";

        let mf_doi = "";

        let mf_isbn = "";
        let isbnArr = Array.from(document.querySelectorAll('.product-medium-ean13-feature')).filter(elem => elem.innerText.includes("hardcopy") || elem.innerText.includes("Paper")).map(elem => elem.innerText.match(/: ([0-9-]+)/)?elem.innerText.match(/: ([0-9-]+)/)[1] : "")
        if (isbnArr.length > 0){
            mf_isbn = isbnArr[0];
        }

        let mf_eisbn = "";
        let eisbnArr = Array.from(document.querySelectorAll('.product-medium-ean13-feature')).filter(elem => elem.innerText.includes("PDF") || elem.innerText.includes("eBook")).map(elem => elem.innerText.match(/: ([0-9-]+)/)?elem.innerText.match(/: ([0-9-]+)/)[1] : "")
        if (eisbnArr.length > 0){
            mf_eisbn = eisbnArr[0];
        }

        if (mf_eisbn == "" && mf_isbn == ""){
            mf_eisbn = mf_dict?.isbn || "";
        }
        
        let publisher = document.querySelector('#product-publisher-feature')? document.querySelector('#product-publisher-feature').innerText.replace("Publisher:","").trim() : "";
        if (publisher == ""){
            publisher = mf_dict["publisher"] || "";
        }
        let pages = document.querySelector('div[data-type="product-features-media-page-counts"]')? document.querySelector('div[data-type="product-features-media-page-counts"]').innerText.trim().match(/: (\d+)/)? document.querySelector('div[data-type="product-features-media-page-counts"]').innerText.trim().match(/: (\d+)/)[1] : "" : "";
        const type = "$#DT2"

        let language = document.querySelector('#product-languages-feature')? document.querySelector('#product-languages-feature').innerText.replace("Language(s):","").trim() : "";
        if (language == "English"){
            language = "eng"
        }

        let abstract = document.querySelector('div[data-type="product-description"]')? document.querySelector('div[data-type="product-description"]').innerText.trim() : "";
        if (abstract == ""){
            abstract = mf_dict?.description || "";
        }

        var metadata = { '202': title, '200': authors, '203': date, '81': abstract, '240': mf_isbn, '241': mf_eisbn, '239': type, '235': publisher, '242': mf_book, '193': pages, '233': mf_doi, '205': language, '199': edition};
        // log(`Data extracted from ${url}`);
        // log(`Metadata: ${JSON.stringify(metadata)}`);
        return metadata;
    }
};