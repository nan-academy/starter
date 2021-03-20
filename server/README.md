# Server

The server is optionnal and use to store progress and attempts.

## Setup

### Dependencies

- [NodeJS](https://nodejs.org/en/download/)
- [RipGrep](https://github.com/BurntSushi/ripgrep#installation)

### Start the server

```bash
wget https://nan-academy.github.io/server/index.js
node index.js
```

#### ENV

```bash
PORT=7777 # optional, default to 7777
TLS_PATH=path/to/files # optional, only for SSL
# will append -key.pem & -cert.pem
```
