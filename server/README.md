# Server

The server is optionnal and use to store progress and attempts.

## Setup

### Dependencies

- [Deno](https://deno.land/#installation)
- [RipGrep](https://github.com/BurntSushi/ripgrep#installation)

### Start the server

```bash
deno run -A 'https://nan-academy.github.io/server/mod.js'
```

#### ENV

```bash
PORT=7777 # optional, default to 7777
CERT=path/to/file.cert # optional, only for SSL
KEY=path/to/file.key # optional, only for SSL
```
