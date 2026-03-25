# Fetchlee

Fetchlee is a configurable web crawler built with TypeScript and Puppeteer.
It is focused on link discovery + metadata extraction pipelines driven by JSON task files.

## Features

- Headless/non-headless crawling with Puppeteer
- Persistent URL frontier based on SQLite (`queued/processing/visited/failed`)
- Configurable crawl rules and metadata extraction rules
- Page interaction engine (`click`, `type`, `scroll`, `waitFor`, etc.)
- Optional metadata persistence to ArangoDB
- Optional Tor-based crawling mode

## Project Status

This project is under active development.
Task format and crawler behavior are still evolving.

## Requirements

- Node.js 18+
- npm
- (Optional) Tor + Privoxy for `--use_tor`
- (Optional) ArangoDB for `--use_database`

## Installation

```bash
npm install
```

## Running In Development

Use `ts-node` directly:

```bash
npx ts-node main.ts crawl \
  -c my_collection \
  -o ./output \
  -e ./tasks/sample_task.json \
  -l ./your_links_file.txt \
  --headless
```

## Building And Running Production Build

Build TypeScript:

```bash
npm run build
```

Run compiled JavaScript:

```bash
node dist/main.js crawl \
  -c my_collection \
  -o ./output \
  -e ./tasks/sample_task.json \
  -l ./your_links_file.txt \
  --headless
```

You can also use:

```bash
npm run start -- crawl -c my_collection -o ./output -e ./tasks/sample_task.json -l ./your_links_file.txt --headless
```

## CLI

Global options:

- `-c, --coll_name <string>`: collection name (default: `default_host_name`)
- `-o, --output <path>`: output directory
- `-e, --task <path>`: task JSON path
- `-l, --links <path>`: seed links file path
- `-h, --HELP`: extended help

`crawl` command options:

- `--headless`: run browser in headless mode
- `-t, --use_tor`: route crawling through Tor (requires Tor/Privoxy setup)
- `-d, --delay <number>`: delay between processed URLs in ms
- `--use_database`: save extracted metadata to ArangoDB
- `--frontier_state <path>`: path to SQLite frontier DB
- `--clear_history`: clear URLs history for selected collection in frontier
- `--browser_config <path>`: path to browser JSON config

`parsing` command currently exists as a placeholder and is not fully implemented.

## Task Configuration

A task file defines:

- `crawl_rules`: URL pattern matching and next-link extraction rules
- `metadata_extraction`: extraction rules for target pages
- `links_transformation` (optional): URL transformation rules
- `interactions` (optional): pre/post interaction steps

Example task files:

- `tasks/sample_task.json`
- `tasks/emerald_test_task.json`

## Seed Links File

A plain text file with one URL per line.

Example:

```txt
https://www.emerald.com/journals/pages/journals_a-z
```

## ArangoDB Configuration

Create `.env` in project root:

```env
DATABASE_TYPE=arango

ARANGO_URL=http://localhost:8529
ARANGO_DB=crawler_db
ARANGO_COLLECTION=crawled_data
ARANGO_USER=root
ARANGO_PASSWORD=your_password
```

Then run crawler with `--use_database`.

## Tor And Privoxy Setup (Optional)

Install packages:

```bash
sudo apt-get install tor privoxy
```

### Tor config

Add to `/etc/tor/torrc`:

```txt
ControlPort 9051
CookieAuthentication 0
```

(If needed) allow cookie access:

```bash
sudo chmod +r /run/tor/control.authcookie
```

### Privoxy config

Add to `/etc/privoxy/config`:

```txt
forward-socks5 / 127.0.0.1:9050 .
```

Start services:

```bash
sudo service tor start
sudo service privoxy start
```

## Output

For each collection, Fetchlee creates:

- `jsons/`: extracted metadata
- `htmls/`: saved HTML pages
- `remaining_links.txt`: copied seed file

## Notes

- Respect website terms of service and robots policies.
- Add sensible delays and scope your crawl patterns responsibly.
