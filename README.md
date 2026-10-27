# WorkHub backend

Node.js + Express 5 + TypeScript + MongoDB (Mongoose 9) API for projects, tasks, comments, activity logs and dashboard statistics.

## Local setup

```bash
npm install
cp .env.example .env      # then fill in the two JWT secrets (see comments inside)
npm run dev               # tsx watch, http://localhost:5000
```

Requires Node 22+ and a local MongoDB (default `mongodb://127.0.0.1:27017/workhub`).

The server validates configuration before it accepts requests and exits with a one-line message if anything is wrong (missing `MONGODB_URI`, JWT secrets shorter than 32 characters or identical, malformed `CORS_ORIGINS`, ...). Secret values are never printed.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run from TypeScript with auto-reload |
| `npm run build` | Compile `src/` to `dist/` (not committed) |
| `npm start` | Run the compiled server, `node dist/server.js` |
| `npm run typecheck` | Type-check `src/` and `tests/` without emitting |
| `npm test` | Run the automated test suite |

## API documentation

Swagger UI: `http://localhost:5000/api/docs` (raw spec at `/api/docs/openapi.json`). Enabled by default outside production; set `ENABLE_API_DOCS=true` to expose it in production.

## Tests

`npm test` uses Node's built-in test runner. Each test file boots the real app against a **throw-away database**: it starts its own temporary `mongod` (random port, temp directory, deleted afterwards), or uses `TEST_MONGODB_URI` if set. Database names are always `workhub_test_<random>` and the suite refuses to drop or modify any other database. Without `mongod` on `PATH` (and without `TEST_MONGODB_URI`) the integration suites are reported as *skipped*, never as passed.

## Security controls

Implemented in the app: Helmet headers, `X-Powered-By` disabled, explicit CORS allow-list, 100kb body limit, per-IP rate limits (strict on `/api/auth/*`, general on `/api/*`), JWT pinned to HS256 with issuer and audience, single-use rotating refresh tokens stored only as hashes, bcrypt password hashing, generic client-facing 500s, and test/debug routes registered only when `NODE_ENV=development`.

Still needed at the infrastructure level: TLS termination, a correct `TRUST_PROXY` value, network access control for MongoDB, secret management and rotation, backups, log shipping, and (optionally) a WAF.

## Deployment notes

- **Re-login after deploying the JWT hardening.** Tokens issued before the issuer/audience claims were added no longer verify. Access tokens last 15 minutes and refresh tokens 7 days, so every user signs in once. This is intentional; do not weaken verification to avoid it. Deploy at a quiet time and tell users to expect one sign-in.
- Set `NODE_ENV=production`, real `CORS_ORIGINS`, unique 48-byte JWT secrets and `TRUST_PROXY` to match your proxy count.
- Build with `npm ci && npm run build`, then start with `npm start`. Only `dist/`, `package*.json` and `node_modules` (production) are needed at runtime.
- `GET /health` returns 503 while MongoDB is disconnected; point load-balancer health checks at it.
