<div align="center">

<img src="web/public/icon-192.png" width="72" alt="OpenPass logo" />

# OpenPass

**Your passwords, encrypted before they leave your device.**
Open-source, zero-knowledge password manager for you and your team — self-hosted in one command.

🇻🇳 [Hướng dẫn tiếng Việt](docs/vi/HUONG-DAN.md)

[![CI](https://github.com/bthanhtung/pwd-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/bthanhtung/pwd-manager/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-6d4aff.svg)](LICENSE)
![Languages](https://img.shields.io/badge/i18n-English%20·%20Tiếng%20Việt-3dd68c)

<img src="docs/media/demo.gif" alt="OpenPass demo: sign up, import, reveal and copy a password, generator, security report" width="900" />

</div>

---

## ✨ Why OpenPass

| | |
|---|---|
| 🔐 **Zero-knowledge** | Argon2id + AES-256-GCM in your browser. The server stores ciphertext only — not even item names. |
| 👥 **Teams** | Share with owner / admin / editor / viewer roles. Team keys are sealed to each member with ECDH. |
| 📥 **Move in fast** | Import Bitwarden, 1Password, LastPass, Chrome, Safari, Firefox. Encrypted export any time. |
| 🔢 **Authenticator built in** | Live TOTP codes for your logins, plus 2FA for your own account. |
| 🛡️ **Security report** | Weak, reused and old passwords; private breach check (Have I Been Pwned, k-anonymity). |
| 📱 **Every device** | Installable PWA, works offline (read-only), dark & light, English & Tiếng Việt. |
| 🐳 **One container** | SQLite by default, PostgreSQL when you grow. Runs on a $5 VPS, a Pi or a NAS. |

<p align="center">
  <img src="docs/media/vault-dark.png" width="49%" alt="Vault, dark theme" />
  <img src="docs/media/vault-light.png" width="49%" alt="Vault, light theme" />
</p>
<p align="center">
  <img src="docs/media/security-report.png" width="66%" alt="Security report" />
  <img src="docs/media/mobile-item.png" width="23%" alt="Mobile" />
</p>

---

## 🚀 Get started

Pick **one** of the three paths. Each step is a copy-paste.

### Path A — Try it on your computer (5 minutes)

1. **Install Docker Desktop** → <https://www.docker.com/products/docker-desktop/> and open it.
   Also install **Git** → <https://git-scm.com/downloads> (already there on most Macs and Linux).
2. **Open a terminal** (macOS: *Terminal*, Windows: *PowerShell*) and run:
   ```bash
   git clone https://github.com/bthanhtung/pwd-manager.git
   cd pwd-manager
   docker compose up -d --build
   ```
   The first build takes a few minutes; later starts are instant.
3. **Open** <http://localhost:8080> and click **Get started**.
4. Want sample data? Import [`docs/demo/demo-vault.json`](docs/demo/demo-vault.json) (all fake) — see [Use it](#-use-it).

Stop: `docker compose stop` · Start again: `docker compose start` · Your data stays in the `openpass-data` volume.

### Path B — Put it online for your family or team (15 minutes)

You need: a small Linux server (any VPS) and a domain name.

1. **DNS:** create an `A` record, e.g. `pass.example.com` → your server's IP.
2. **Install Docker** on the server:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
3. **Download the deploy files and set your domain:**
   ```bash
   git clone https://github.com/bthanhtung/pwd-manager.git && cd pwd-manager/deploy
   cp .env.example .env
   nano .env          # set DOMAIN=pass.example.com
   ```
4. **Build and start** (HTTPS certificate is issued automatically by Caddy):
   ```bash
   docker compose up -d --build
   ```
5. Open `https://pass.example.com`, create your account, then your teammates create theirs.
6. **Close registration** when everyone is in: set `SIGNUPS_ALLOWED=false` in `.env`, then `docker compose up -d`.

**Update** later: `git pull && docker compose up -d --build` (database migrations run automatically).
**Back up**: copy the `openpass-data` volume, *and* ask users to keep an encrypted export (below).

### Path C — Run from source (developers)

Requires Node.js 20+.
```bash
git clone https://github.com/bthanhtung/pwd-manager.git && cd pwd-manager
npm run setup      # install server + web
npm run dev        # API on :8080, web app on http://localhost:5173
npm test           # 12 API tests (SQLite + Postgres) + 16 web tests
npm run build && npm start   # production build on http://localhost:8080
```

---

## 🧭 Use it

1. **Create your vault** — pick a master password of 4–5 random words. ⚠️ Nobody can recover it if forgotten.
2. **Import** — *Import & export → Import*, drop your export file (or `docs/demo/demo-vault.json`), click **Import**. Then delete the plain export file from your computer.
3. **Add an item** — press <kbd>N</kbd>. Choose Login / Card / Identity / Note. Click 🪄 to generate a password; paste an authenticator key to get live 2FA codes.
4. **Copy fast** — click the copy icon; the clipboard clears itself after 30 s. Shortcuts: <kbd>/</kbd> search · <kbd>G</kbd> generator · <kbd>L</kbd> lock · <kbd>↑</kbd><kbd>↓</kbd> move.
5. **Share with a team** — *Teams → +*, name it, then **Add a member** by email (they must have an account). Choose a role. Compare the key fingerprint with your teammate (Settings → Account) to be sure.
6. **Check your health** — *Security report* lists weak/reused/old passwords; **Run check** to look for breaches privately.
7. **Protect your account** — *Settings → Security*: turn on two-step login, set auto-lock, see signed-in devices.
8. **Install as an app** — in Chrome/Edge click the install icon in the address bar; on iPhone use *Share → Add to Home Screen*.
9. **Back up** — *Import & export → Export → Encrypted backup*. Keep the file and its password somewhere safe.

---

## ⚙️ Configuration

| Variable | Default | What it does |
|---|---|---|
| `APP_URL` | `http://localhost:8080` | Public URL. Use `https://…` in production (enables Secure cookies & HSTS). |
| `SIGNUPS_ALLOWED` | `true` | Set `false` to close registration. |
| `DATABASE_URL` | `sqlite:///data/openpass.db` | Or `postgres://user:pass@host:5432/openpass`. |
| `PORT` | `8080` | HTTP port inside the container. |
| `SERVER_SECRET` | auto-generated | Persisted next to the SQLite file; set it explicitly with Postgres. |
| `AUTH_RATE_LIMIT` | `10` | Sign-in attempts per minute per IP. |
| `TRUST_PROXY` | `true` | Trust `X-Forwarded-*` from your reverse proxy. |

Postgres with the bundled compose file: `docker compose --profile postgres up -d` (see comments in [`docker-compose.yml`](docker-compose.yml)).

---

## 🔒 Security model

```
master password ─Argon2id(64 MiB, 3 passes)─▶ master key ─HKDF─┬─▶ auth key  → server stores argon2id(auth key)
                                                               └─▶ enc key   → never leaves the device
user key (random)      = AES-256-GCM(enc key)          stored on server as ciphertext
item                   = AES-256-GCM(user key, JSON, aad = item id)
team key (random)      = sealed to each member: ECDH P-256 ephemeral + HKDF + AES-GCM
```

- The server never sees your master password, your keys, or any item content.
- Sessions: opaque httpOnly `SameSite=Strict` cookies + custom CSRF header; login rate limiting; optional TOTP 2FA.
- Strict Content-Security-Policy, no third-party scripts, no trackers, no favicon fetching.
- Known limitations (v2.0): removing a team member revokes server access but does not yet rotate the team key; there is no browser extension yet.

Full threat model and crypto details: [SECURITY.md](SECURITY.md).

---

## 🧱 Architecture

```
server/   NestJS 11 + Kysely (SQLite / Postgres) — API, sessions, serves the web app
web/      React 19 + Vite + Tailwind v4 PWA — all cryptography lives in web/src/crypto
deploy/   docker compose + Caddy for one-command HTTPS
docs/     demo data and media
```
API docs (Swagger): `/api/docs` on any running instance.

## 🗺️ Roadmap

- Browser extension with autofill · Team key rotation on member removal · Passkeys / WebAuthn unlock · More languages (translations are one file: `web/src/i18n/vi.ts`).

## 🤝 Contributing

Issues and PRs welcome. Run `npm test` before opening a PR; new UI strings go through `t('key', 'English')` with a Vietnamese entry in `web/src/i18n/vi.ts`.

## 📄 License

[MIT](LICENSE)
