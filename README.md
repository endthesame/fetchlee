# Fetchlee - Puppeteer Crawler Using Tor

## Установка

```bash
pip install -r requirements.txt # Install python libraries
sudo apt install npm # npm install
sudo n 18 # nodeJS 18 install
npm i # Install JS libraries
```

## Установка и настройка Tor и прочего  (если необходимо)
```bash
sudo apt-get install tor # Install tor
sudo apt-get install privoxy # Install privoxy
```

### Настройка Tor
Добавить в файл `/etc/tor/torrc`:
```
ControlPort 9051
CookieAuthentication 0
```
предоставить доступ:
```
sudo chmod +r /run/tor/control.authcookie
```
### Настройка Privoxy
Добавить в файл `/etc/privoxy/config`:
```
forward-socks5 / 127.0.0.1:9050 .
```
### Запустите Privoxy
```
sudo service privoxy start
```

## Запуск (после компиляции)
```
node main.js
```

## Запуск (ts файлов)
```
npx ts-node main.ts
```

### Опции для запуска через консоль

При запуске `main.js`, вы можете использовать следующие опции:

#### Глобальные опции (доступны для всех команд)

| Опция                         | Описание                                                      | Значение по умолчанию                     |
|-------------------------------|---------------------------------------------------------------|-------------------------------------------|
| `-c, --coll_name <string>`     | Название коллекции                                            | `'default_host_name'`                     |
| `-o, --output <path>`          | Путь к папке для сохранения результатов                       | `output`                                  |
| `-e, --task <path>`            | Путь к файлу задачи для парсинга                              | `tasks/sample_task.js`                    |
| `-l, --links <path>`           | Путь к файлу со ссылками                                      | `your_links_file.txt`                     |
| `-h, --HELP`                   | Показать дополнительную информацию о доступных опциях         | `-`                                       |

#### Опции для команды `crawl`

| Опция                         | Описание                                                      | Значение по умолчанию                     |
|-------------------------------|---------------------------------------------------------------|-------------------------------------------|
| `-t, --use_tor`                | Укажите эту опцию, если нужно использовать Tor для парсинга   | `-`                                       |
| `--headless`                   | Укажите эту опцию, если запустить бразуер в headless режиме   | `-`                                       |
| `-d, --delay <number>`         | Укажите эту опцию, если нужно добавить делей между запросами  | `0`                                       |
| `--frontier_state_path [path]` | Укажите эту опцию, если нужно указать путь к существующей дб фронтира    | `data/frontier.db`  |
| `--clear_history`              | Укажите эту опцию, если при инициализации фронтира хотите начать обход для данной коллекции с начала   | `-`  |
| `--use_database`               | Укажите эту опцию, если метаданные нужно сохраняться в базу данных   | `-`  |
| `--simulate_mouse`             | Укажите эту опцию, если нужно запустить симуляцию движения мыши в браузере   | `-`  |

| Тестовые опции                | Описание                                                      | Значение по умолчанию                     |
|-------------------------------|---------------------------------------------------------------|-------------------------------------------|
| `--handle_cloudflare`         | Запускает обнаружение и последующую обработку обхода cloudflare   | `-`  |
| `-s, --upload_ssh`            | Укажите эту опцию, если нужно загружать исходные данные через SSH | `-`  |
| `-p, --download_pdf`          | Укажите эту опцию, если хотите загружать PDF-файлы                | `-`                                       |
| `-a, --open_access`           | Укажите эту опцию, если нужно проверять доступность перед загрузкой | `-`                                     |

#### Опции для команды `parsing`

| Опция                         | Описание                                                      | Значение по умолчанию                     |
|-------------------------------|---------------------------------------------------------------|-------------------------------------------|
| (Нет опций для этой команды)   |                                                               |                                           |

### Пример использования

```bash
# Пример запуска команды в режиме разработки
npx ts-node crawl -c my_collection -o /path/to/output

# Пример запуска команды crawl с использованием Tor и загрузкой PDF в готовом проекте
cd /path/to/build/project
node main.js crawl -c my_collection -o /path/to/output -p -t
```

### Использование базы данных для сохранения метаданных

Для использования базы данных нужно создать .env файл в котором нужно указать доступ к бд

Пример файла:
```txt
DATABASE_TYPE=arango #postgres/arango

#PostgresDB config
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password
POSTGRES_DB=crawler_db
POSTGRES_TABLE=crawled_metadata #by default using collection name for table

# ArangoDB config
ARANGO_URL=http://localhost:8529
ARANGO_DB=crawler_db
ARANGO_COLLECTION=crawled_data
ARANGO_USER=root
ARANGO_PASSWORD=your_password
```