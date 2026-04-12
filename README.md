# Open Pass Manager 🛡️

A self-hosted, team-oriented password and secret manager. Passwords are **encrypted at rest** with AES-256-GCM and never exposed in plaintext. Built for individuals and teams that need fine-grained access control over shared credentials.

---

## Features

- 🔐 **AES-256-GCM** encryption — industry-standard authenticated encryption for all stored secrets
- 🔑 **Argon2id** password hashing — GPU-resistant, modern replacement for bcrypt
- 👥 **Group-based access** — share vaults with teams; role-based members (Admin / Member)
- 🪪 **JWT authentication** — stateless, short-lived tokens
- 📖 **Swagger docs** — auto-generated API documentation at `/docs`
- 🐳 **Docker Compose** — one-command full-stack deployment

---

## Architecture

```
pwd-manager/
├── backend/          # NestJS REST API (Port 3000)
│   └── src/
│       ├── auth/     # JWT auth, Passport, Argon2
│       ├── users/    # User persistence
│       ├── groups/   # Team groups + member roles
│       ├── vault/    # Encrypted password store
│       └── common/   # AES-256-GCM crypto service
│
├── frontend/         # Next.js 16 UI (Port 3001)
│
├── scripts/
│   └── generate-keys.sh   # Helper to generate secure .env keys
│
├── docker-compose.yml     # Full stack: MongoDB, Redis, backend, frontend
└── .env.example           # Environment variable template
```

### Service Map

| Service | Technology | Port |
|---|---|---|
| REST API | NestJS 11 + TypeScript | 3000 |
| Frontend | Next.js 16 + TailwindCSS | 3001 |
| Database | MongoDB | 27017 |
| Cache / Session | Redis | 6379 |

---

## Quick Start — Docker (Recommended)

The fastest way to run the full stack.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### Steps

**1. Clone the repository**

```bash
git clone https://github.com/your-user/pwd-manager.git
cd pwd-manager
```

**2. Generate secure keys**

```bash
sh scripts/generate-keys.sh
```

Output:
```
Generating secure keys for .env...
SERVER_ENCRYPTION_KEY: a1b2c3d4e5f6...   ← copy this
JWT_SECRET: X9kL3mN8...                  ← copy this
```

**3. Configure environment**

```bash
cp .env.example .env
```

Edit `.env` and fill in the generated values:

```dotenv
NODE_ENV=production
PORT=3000

MONGODB_URI=mongodb://mongodb:27017/passmanager
REDIS_HOST=redis
REDIS_PORT=6379

SERVER_ENCRYPTION_KEY=<paste from step 2>   # exactly 32 chars
JWT_SECRET=<paste from step 2>

NEXT_PUBLIC_API_URL=http://localhost:3000
```

**4. Build and run**

```bash
docker compose up --build
```

**5. Open the app**

| Service | URL |
|---|---|
| Frontend UI | http://localhost:3001 |
| Backend API | http://localhost:3000 |
| Swagger Docs | http://localhost:3000/docs |

---

## Quick Start — Local Development

Run backend and frontend separately without Docker.

### Prerequisites

- Node.js ≥ 20
- npm ≥ 10
- MongoDB running locally (or Atlas URI)

### Backend

```bash
cd backend
npm install

# Create and configure .env
cp ../.env.example .env
# Edit backend/.env — set MONGODB_URI, JWT_SECRET, SERVER_ENCRYPTION_KEY

# Start MongoDB (if running locally)
docker compose up -d mongodb   # or: brew services start mongodb-community

# Start API server (hot reload)
npm run start:dev
```

→ API available at **http://localhost:3000**  
→ Swagger at **http://localhost:3000/docs**

> See [`backend/README.md`](./backend/README.md) for full backend documentation.

### Frontend

```bash
cd frontend
npm install

# Create frontend env
echo "NEXT_PUBLIC_API_URL=http://localhost:3000" > .env.local

# Start dev server
npm run dev
```

→ UI available at **http://localhost:3000** (Next.js default)

> If running both locally at the same time, change the backend `PORT` to `3001` in `backend/.env` and update `NEXT_PUBLIC_API_URL` accordingly.

---

## Environment Variables

Variables are loaded from the `.env` file at the **project root** (used by Docker Compose and the backend).

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | No | `development` or `production` |
| `PORT` | No | Backend HTTP port (default: `3000`) |
| `MONGODB_URI` | **Yes** | MongoDB connection string |
| `REDIS_HOST` | No | Redis host (default: `redis` in Docker) |
| `REDIS_PORT` | No | Redis port (default: `6379`) |
| `SERVER_ENCRYPTION_KEY` | **Yes** | **Exactly 32 ASCII chars** — AES-256-GCM key |
| `JWT_SECRET` | **Yes** | JWT signing secret (min 32 chars recommended) |
| `NEXT_PUBLIC_API_URL` | **Yes** | Backend API base URL for frontend |

> ⚠️ **Never commit `.env`** — it is listed in `.gitignore`. Only `.env.example` is committed.

---

## How It Works

### Saving a Password

```
User submits: { title: "GitHub", plainTextValue: "my-secret-token" }
                    │
                    ▼
        CryptoService.encrypt(plainTextValue)
        ┌─────────────────────────────────┐
        │  Random 12-byte IV generated    │
        │  AES-256-GCM cipher created     │
        │  plainTextValue → encryptedData │
        │  Auth tag generated (16 bytes)  │
        └─────────────────────────────────┘
                    │
                    ▼
        MongoDB stores: { title, encryptedData, iv, tag, ownerId }
        ✅ plainTextValue is NEVER stored
```

### Retrieving Passwords

```
GET /vault  (Authorization: Bearer <token>)
      │
      ▼
  JwtAuthGuard validates token → req.user.id
      │
      ▼
  VaultService.findAllForUser(userId)
  ┌────────────────────────────────────────┐
  │  1. Find all groups user belongs to    │
  │  2. Return vaults where:               │
  │     - ownerId = userId  (personal)     │
  │     - groupId in userGroups (shared)   │
  └────────────────────────────────────────┘
```

### Team Groups Flow

```
POST /groups/create    → Creates group, user is ADMIN
POST /groups/:id/members → ADMIN adds members (userId + role)
POST /vault  { groupId } → Vault entry shared with that group
GET  /vault            → Member sees group vaults automatically
```

---

## API Overview

Full interactive docs at **http://localhost:3000/docs** (Swagger).

| Category | Endpoint | Description |
|---|---|---|
| **Auth** | `POST /auth/register` | Create account |
| **Auth** | `POST /auth/login` | Login → JWT token |
| **Vault** | `POST /vault` | Save encrypted secret |
| **Vault** | `GET /vault` | List my secrets + shared group secrets |

**Authentication header for protected routes:**
```
Authorization: Bearer <access_token>
```

---

## Scripts

```bash
# Generate secure keys for .env
sh scripts/generate-keys.sh

# Docker — start full stack
docker compose up --build

# Docker — start only infrastructure (MongoDB + Redis)
docker compose up -d mongodb redis

# Docker — stop and remove containers
docker compose down

# Docker — stop and remove containers + volumes (reset data)
docker compose down -v
```

---

## Security Design

| Concern | Approach |
|---|---|
| Password hashing | Argon2id — prevents rainbow tables and GPU attacks |
| Secret encryption | AES-256-GCM — authenticated, prevents tampering via auth tag |
| Unique IV per entry | Random 12-byte IV per encryption — prevents pattern analysis |
| Token security | JWT signed with `JWT_SECRET`; 7-day expiry |
| Input validation | All DTOs validated with `class-validator`; extra fields stripped |
| Key management | Keys in `.env` only — never hardcoded or committed |

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Follow the local development setup above
4. Open a pull request

---

## License

MIT