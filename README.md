# Zero-Knowledge Identity Manager

A full-stack password and digital identity manager. Vault data is encrypted and decrypted in the browser with the Web Crypto API; the API stores ciphertext, IVs, and a bcrypt hash of a derived authentication key.

## Requirements

- Node.js 20+
- PostgreSQL 14+
- npm

## Local setup

1. Create a PostgreSQL database and copy `server/.env.example` to `server/.env`.
2. Set `DATABASE_URL` and a long, random `JWT_SECRET` in `server/.env`.
3. Copy `client/.env.example` to `client/.env`.
4. In one terminal:

   ```powershell
   cd server
   npm install
   npm run dev
   ```

5. In another terminal:

   ```powershell
   cd client
   npm install
   npm run dev
   ```

The client runs at <http://localhost:5173> and the API at <http://localhost:5000>. The server creates its tables at startup.

## Render deployment

### PostgreSQL

Create a managed PostgreSQL database (Render PostgreSQL, Neon, or Supabase) and copy its connection string. Production connections use SSL.

### API web service

Create a Render Web Service from this repository:

- **Root Directory:** `server`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Environment:** `DATABASE_URL` (managed database URL), `JWT_SECRET` (long random secret), `CLIENT_URL` (deployed frontend origin), `NODE_ENV=production`

The service binds to Render's `PORT` and exposes `/api/health`.

### Static frontend

Create a Render Static Site:

- **Root Directory:** `client`
- **Build Command:** `npm install && npm run build`
- **Publish Directory:** `dist`
- **Environment:** `VITE_API_URL` set to the API service origin, without a trailing slash (for example `https://your-api.onrender.com`)

Configure a rewrite from `/*` to `/index.html` with status `200` for client-side routing if routes are added later.

## Security notes

- PBKDF2-SHA-256 derives a master key with 600,000 iterations and a per-user random 16-byte salt. HKDF derives separate AES-GCM and authentication keys.
- The AES key is held only in application memory and is never sent to or persisted by the API. Each saved item uses a fresh 12-byte AES-GCM IV.
- The server cannot recover a vault if its master password is lost. Losing the password means losing access to encrypted vault contents.
- Email and item category are metadata visible to the server. This starter does not include account recovery, MFA, backups, refresh tokens, or a formal security audit. Use HTTPS in production and protect database backups.
- Production PostgreSQL connections use TLS. Certificate verification is disabled for compatibility with providers that use self-signed certificates; traffic remains encrypted, but the server certificate is not authenticated. Prefer configuring and verifying your database provider's CA certificate when one is available.
- A compromised browser, malicious extension, or compromised frontend deployment can access the unlocked vault. Review and harden deployment and supply-chain controls before handling sensitive production data.

