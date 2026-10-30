# Security

## Reporting a vulnerability

Please **do not open a public issue**. Email **bthanhtung.ite@gmail.com** with a description, steps to reproduce
and the affected version. You will get an answer within 72 hours. Fixes are released as a new image tag and noted
in the release notes, with credit if you want it.

## Threat model

OpenPass is designed so that **a fully compromised server (database + config + code at rest) does not reveal vault
contents**. The server stores only:

| Stored | What it is |
|---|---|
| `email`, `name` | account identity (plaintext) |
| `kdf` | Argon2id parameters and salt |
| `auth_hash` | `argon2id(authKey)` — `authKey` is derived from the master password on the client |
| `protected_user_key` | user key encrypted with the client-only encryption key |
| `public_key` / `protected_private_key` | ECDH P-256 key pair, private half encrypted with the user key |
| items, folders, team names | AES-256-GCM ciphertext |
| `protected_team_key` | team key sealed to each member's public key |

What OpenPass does **not** protect against:

- A malicious server operator who **changes the JavaScript** served to you (true of every web-based password manager).
  Self-host, or use a server you trust, and keep it behind HTTPS.
- Malware on your device, or someone who knows your master password.
- A server operator swapping a user's **public key** when you invite them. Compare the key fingerprint shown in
  *Teams* with the one your teammate sees in *Settings → Account* before sharing sensitive items.

## Cryptography

```
master key   = Argon2id(password NFKC, salt 16 B, m = 64 MiB, t = 3, p = 1) → 32 B
auth key     = HKDF-SHA256(master key, info "openpass/auth")   → sent to the server
enc key      = HKDF-SHA256(master key, info "openpass/enc")    → never leaves the device
user key     = random 32 B, stored as AES-256-GCM(enc key)
items        = AES-256-GCM(user key | team key, JSON, 96-bit random IV, AAD = item id)
team key     = random 32 B, sealed per member: ephemeral ECDH P-256 → HKDF → AES-256-GCM
exports      = AES-256-GCM(Argon2id(export password), JSON)
```

Formats: `1.<iv>.<ciphertext+tag>` and `e1.<ephemeral public key>.<iv>.<ciphertext+tag>` (base64url).
All primitives come from the browser's WebCrypto, except Argon2id (`hash-wasm`, WebAssembly).

Changing the master password re-wraps the user key only; items are not re-encrypted. Other sessions are revoked.

## Server hardening

- Opaque session tokens in `httpOnly`, `SameSite=Strict` cookies; only a SHA-256 of the token is stored.
- Every state-changing request needs the `X-OpenPass: 1` header (CSRF defence; CORS is not enabled).
- Sign-in, registration, password change and account deletion are rate limited per IP.
- `prelogin` returns stable fake KDF parameters for unknown emails, so it cannot be used to enumerate accounts.
- Strict Content-Security-Policy (`script-src 'self' 'wasm-unsafe-eval'`), no third-party scripts, no favicon
  fetching. The only optional outbound request is the Have I Been Pwned range API, run when the user clicks it.
- Optional TOTP two-step login.

## Known limitations

- Removing a team member stops the server from sending them the team's data, but the team key is not rotated yet.
  If a removed member may have kept a copy of the vault, rotate the shared passwords.
- No recovery: if the master password is lost, the vault cannot be decrypted. Keep an encrypted export.
