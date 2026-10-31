# Contributing

Thanks for helping improve OpenPass, a self-hosted, end-to-end encrypted password
manager. The repository has two parts: `server/` (the API and database) and `web/`
(the browser app, where all encryption happens).

## Development setup

Requires Node.js 20 or newer. Docker is optional, needed only for the PostgreSQL tests
and for trying the production image.

```bash
git clone https://github.com/bthanhtung/pwd-manager.git && cd pwd-manager
npm run setup      # install server + web dependencies
npm run dev        # API on :8080, web app on http://localhost:5173
```

## Before you open a pull request

```bash
npm test                       # API tests (SQLite + PostgreSQL) and web tests
npm run build                  # production build of web and server
docker compose up -d --build   # optional: the image self-hosters run
```

## Guidelines

- **The server must never see secrets.** Vault items, master passwords, and keys
  are encrypted and decrypted in the browser. A change that sends plaintext or key
  material to the server will not be merged.
- **No home-made cryptography.** Use the Web Crypto API and the primitives already
  in the codebase. Changes to key derivation, encryption formats, or sharing must
  explain the threat they address, keep old vaults readable (or ship a migration),
  and come with tests.
- **Both databases.** Schema changes need a migration that works on SQLite and on
  PostgreSQL; `npm test` runs the API suite against both.
- **Strings.** New UI text goes through `t('key', 'English')`, with a Vietnamese
  entry in `web/src/i18n/vi.ts`. A new language is one file in the same folder.
- **No telemetry.** Do not add analytics, external fonts, or third-party requests to
  the web app.
- **Security issues** go through [SECURITY.md](./SECURITY.md), never a public issue
  or pull request.

## Reporting bugs and requesting features

Open an issue with what you did, what you expected, what happened, your OpenPass
version or commit, and how you run it (Docker, from source). Never paste real vault
data, master passwords, or recovery keys.
