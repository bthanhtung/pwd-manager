# Open Pass Manager — Backend 🔐

NestJS REST API for a team password/secret manager. Handles authentication, AES-256-GCM encrypted vault storage, and group-based access control.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Framework | NestJS 11 |
| Database | MongoDB (via Mongoose) |
| Auth | JWT + Passport + Argon2 |
| Encryption | AES-256-GCM (Node.js `crypto`) |
| Validation | `class-validator` + `class-transformer` |
| Docs | Swagger / OpenAPI (`/docs`) |

---

## Project Structure

```
src/
├── app.module.ts          # Root module — wires ConfigModule, MongooseModule, feature modules
├── main.ts                # Bootstrap: ValidationPipe, Swagger, listen
│
├── auth/                  # Authentication module
│   ├── auth.module.ts
│   ├── auth.controller.ts # POST /auth/register, POST /auth/login
│   ├── auth.service.ts    # Argon2 hashing, JWT signing
│   ├── dto/
│   │   └── register.dto.ts  # RegisterDto, LoginDto
│   ├── guards/
│   │   └── jwt-auth.guard.ts  # @UseGuards(JwtAuthGuard)
│   └── strategies/
│       └── jwt.strategy.ts    # Passport JWT strategy → populates req.user
│
├── users/                 # User persistence (used internally by AuthModule)
│   ├── users.service.ts
│   └── schemas/
│       └── user.schema.ts
│
├── groups/                # Team groups module
│   ├── groups.module.ts
│   ├── groups.service.ts  # create, addMember, isUserInGroup
│   ├── dto/
│   │   └── create-group.dto.ts  # CreateGroupDto, AddMemberDto
│   └── schemas/
│       └── group.schema.ts  # Group + embedded GroupMember[]
│
├── vault/                 # Password vault module
│   ├── vault.module.ts
│   ├── vault.controller.ts  # POST /vault, GET /vault  (JWT protected)
│   ├── vault.service.ts     # encrypt-on-write, query by owner or group
│   ├── dto/
│   │   └── create-vault.dto.ts
│   └── schemas/
│       ├── vault.schema.ts
│       └── audit-log.schema.ts
│
└── common/
    ├── crypto.service.ts  # AES-256-GCM encrypt / decrypt
    └── constants.ts       # ROLES, CRYPTO_CONFIG
```

---

## Prerequisites

- **Node.js** ≥ 20
- **npm** ≥ 10
- **MongoDB** running locally on `27017` **or** a MongoDB Atlas URI

---

## Local Setup

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment

```bash
cp ../.env.example .env
```

Open `backend/.env` and fill in the values:

```dotenv
# App
NODE_ENV=development
PORT=3000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/passmanager

# JWT — generate with: openssl rand -base64 32
JWT_SECRET=your_jwt_secret_here

# AES-256-GCM key — must be exactly 32 ASCII chars
# Generate with: openssl rand -hex 16
SERVER_ENCRYPTION_KEY=your_32_char_encryption_key_here
```

> **Quick key generation:**
> ```bash
> sh ../scripts/generate-keys.sh
> ```
> Copy the output values into your `.env`.

### 3. Start MongoDB (choose one)

```bash
# Option A — Docker (recommended)
docker compose -f ../docker-compose.yml up -d mongodb

# Option B — Homebrew
brew services start mongodb-community

# Option C — MongoDB Atlas
# Just set MONGODB_URI to your atlas connection string
```

### 4. Run the server

```bash
# Development (watch mode — auto-restarts on file change)
npm run start:dev

# Standard start
npm start

# Production (requires build first)
npm run build && npm run start:prod
```

Server starts at **http://localhost:3000**
Swagger docs at **http://localhost:3000/docs**

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | No | `development` / `production` |
| `PORT` | No | HTTP port (default `3000`) |
| `MONGODB_URI` | **Yes** | Full MongoDB connection string |
| `JWT_SECRET` | **Yes** | Secret for signing JWTs (min 32 chars) |
| `SERVER_ENCRYPTION_KEY` | **Yes** | AES-256 key — **exactly 32 ASCII characters** |

---

## API Reference

All routes are prefixed at `http://localhost:3000`. Interactive docs available at `/docs`.

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | ❌ | Register a new user |
| `POST` | `/auth/login` | ❌ | Login → returns `access_token` |

**Register / Login body:**
```json
{
  "username": "alice",
  "password": "mypassword123"
}
```

**Login response:**
```json
{
  "access_token": "eyJ..."
}
```

Use the token in all protected requests:
```
Authorization: Bearer eyJ...
```

### Vault

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/vault` | ✅ JWT | Save an encrypted password/secret |
| `GET` | `/vault` | ✅ JWT | List all passwords owned by or shared with the user |

**Create vault entry body:**
```json
{
  "title": "Login Facebook",
  "plainTextValue": "my-secret-password-123",
  "groupId": "65f123456789abcdef012345"  // optional — share with a group
}
```

> `plainTextValue` is **never stored**. It is encrypted with AES-256-GCM before being saved. The response returns the encrypted record.

---

## How It Works

### Authentication Flow

```
Client → POST /auth/login
  └─ AuthService.login()
       ├─ UsersService.findByUsername()
       ├─ argon2.verify(storedHash, plainPassword)
       └─ JwtService.signAsync({ sub: userId, username })
            └─ Returns { access_token }

Client → Protected route (Authorization: Bearer <token>)
  └─ JwtAuthGuard → JwtStrategy.validate()
       └─ Populates req.user = { id, username }
```

### Password Save Flow

```
Client → POST /vault  { title, plainTextValue, groupId? }
  └─ VaultController.create(dto, req.user.id)
       └─ VaultService.create()
            ├─ CryptoService.encrypt(plainTextValue)
            │    └─ AES-256-GCM → { encryptedData, iv, tag }
            └─ Saved to MongoDB (plainTextValue never persisted)
```

### Password Retrieval Flow

```
Client → GET /vault
  └─ VaultService.findAllForUser(userId)
       ├─ Find all groups where user is a member
       └─ Query vault: ownerId=user OR groupId in userGroups
```

### Encryption Details

- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key:** 32-byte `SERVER_ENCRYPTION_KEY` from `.env`
- **IV:** 12 random bytes generated per encryption (stored alongside ciphertext)
- **Auth Tag:** 16 bytes stored with each record (prevents ciphertext tampering)
- **Password hashing:** Argon2id (resistant to GPU and side-channel attacks)

---

## Available Scripts

```bash
npm run start:dev     # Dev server with hot reload
npm run build         # Compile TypeScript → dist/
npm start             # Run compiled dist/main.js
npm run start:prod    # Run in production mode
npm run lint          # ESLint --fix
npm run format        # Prettier --write
npm test              # Unit tests (Jest)
npm run test:e2e      # End-to-end tests
npm run test:cov      # Coverage report
```

---

## Running with Docker

The backend has a `Dockerfile` included. To run the full stack:

```bash
# From the project root (pwd-manager/)
cp .env.example .env      # then edit .env with real keys
docker compose up --build
```

| Service | Port | URL |
|---|---|---|
| Backend API | 3000 | http://localhost:3000 |
| Frontend UI | 3001 | http://localhost:3001 |
| MongoDB | 27017 | mongodb://localhost:27017 |
| Redis | 6379 | redis://localhost:6379 |

---

## Integration with Frontend

The frontend (Next.js, port `3001`) calls this API via:

```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

**Typical frontend integration pattern:**

```typescript
// 1. Login
const res = await fetch(`${API_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password }),
});
const { access_token } = await res.json();

// 2. Authenticated request
const vault = await fetch(`${API_URL}/vault`, {
  headers: { Authorization: `Bearer ${access_token}` },
});
```

Store `access_token` in `localStorage` or an HTTP-only cookie (recommended for production).

---

## Security Notes

- **Never commit `.env`** — it is in `.gitignore`
- **Rotate keys** regularly in production
- `SERVER_ENCRYPTION_KEY` must be exactly **32 ASCII characters** for AES-256. Generate safely with `openssl rand -hex 16`
- JWT tokens expire in **7 days** (configurable in `auth.module.ts`)
- All request bodies are validated via `class-validator` — unknown fields are stripped automatically (`whitelist: true`)
