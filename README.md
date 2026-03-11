# Photo Metadata Override App

Public web app to read and override photo metadata safely.

## What this app does

- Reads existing metadata from uploaded photos
- Lets users override EXIF basics and IPTC/XMP fields
- Produces edited copies only (never overwrites originals)
- Generates downloadable ZIP results for processed photos

## Core features

- Batch upload
- Metadata preview before applying changes
- Field editing for common EXIF and IPTC/XMP values
- Presets/templates for repeated metadata changes
- Per-file success and error reporting

## Tech stack (planned)

- Frontend: React (or Next.js)
- Backend API: Node.js (Fastify)
- Worker queue: Redis + BullMQ
- Metadata engine: ExifTool
- Storage: S3-compatible object storage
- Database: Postgres

## Quick start

1. Install root dependencies (already created for scripts):

   `npm install`

2. Install app dependencies:

   `npm install --prefix apps/api`

   `npm install --prefix apps/web`

3. Copy environment templates:

   `copy apps\\api\\.env.example apps\\api\\.env`

   `copy apps\\web\\.env.example apps\\web\\.env`

   Fill Firebase client keys in `apps/web/.env` and Firebase Admin keys in `apps/api/.env`.

4. Run API server:

   `npm run dev:api`

5. Run web app in another terminal:

   `npm run dev:web`

## Current starter endpoints

- `GET /health`
- `GET /api/config`
- `POST /api/uploads/init`
- `POST /api/uploads/complete`
- `POST /api/uploads/proxy`
- `POST /api/jobs`
- `GET /api/jobs/:id`
- `GET /api/jobs/:id/download`
- `DELETE /api/jobs/:id`

## Tests

- One command from repo root (starts API, runs unit + E2E, then stops API):

  `npm run test:all`

- Web unit tests:

  `npm run test --prefix apps/web`

- API unit tests:

  `npm run test --prefix apps/api`

- API E2E test against local running API + R2:

  `npm run test:e2e:r2 --prefix apps/api`

- API E2E proxy upload path test:

  `npm run test:e2e:r2:proxy --prefix apps/api`

Notes:

- E2E requires `apps/api/.env` to contain valid R2 credentials.
- API auth is enforced on `/api/*`; for local automated tests, `AUTH_TEST_BYPASS_TOKEN` is used by the test runner.
- Firebase Admin can be configured either with env vars (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) or with `FIREBASE_SERVICE_ACCOUNT_PATH`.
- E2E writes a temporary zip under `apps/api/tests/` and the script reports its path.

## Dokploy deployment

- Create two Dokploy apps from this repo, not one combined app.
- Set the API app root directory to `apps/api`.
- Set the web app root directory to `apps/web`.
- Both apps now include a `nixpacks.toml` file so Dokploy can install, build, and start them with Nixpacks.
- Each app also includes a local `.dockerignore` so Dokploy sends a smaller build context.

### Dokploy API app

- App name suggestion: `photomaster-api`
- Root directory: `apps/api`
- Build type: `Nixpacks`
- Port: `4000` internally, or any Dokploy-assigned `PORT`
- Start command comes from `apps/api/nixpacks.toml`

Required env vars:

- `PORT`
- `WEB_ORIGIN`
- `WEB_ORIGINS`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Optional now, required later if you deploy the queue and worker flow:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `QSTASH_TOKEN`
- `WORKER_URL`
- `WORKER_SHARED_SECRET`

Recommended values:

- `PORT=4000`
- `WEB_ORIGIN=https://metadatamaster.xyz`
- `WEB_ORIGINS=http://localhost:5173,https://metadatamaster.xyz,https://www.metadatamaster.xyz`
- `FIREBASE_PRIVATE_KEY` should be stored with `\n` escapes if Dokploy keeps it on one line.

### Dokploy web app

- App name suggestion: `photomaster-web`
- Root directory: `apps/web`
- Build type: `Nixpacks`
- Port: `3000` internally, or any Dokploy-assigned `PORT`
- Start command comes from `apps/web/nixpacks.toml`
- The production server is `apps/web/server.mjs`

Required env vars:

- `PORT`
- `VITE_API_URL`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

Recommended values:

- `PORT=3000`
- `VITE_API_URL=https://your-api-domain.example.com`

### Deploy order

1. Deploy `apps/api` first.
2. Copy the public API URL into the web app's `VITE_API_URL`.
3. Deploy `apps/web`.
4. Update the API app's `WEB_ORIGIN` to match the final web URL if needed.

Notes:

- Store all secrets in Dokploy env vars or secrets, not in committed `.env` files.
- Do not deploy `apps/api/serviceAccountKey.json`; prefer Firebase admin env vars.
- The web app is served by `apps/web/server.mjs`, which serves `dist` and falls back to `index.html` for SPA routes.
- The worker is not part of this Dokploy setup yet; it still needs its processing pipeline completed before deployment.

## Roadmap

- MVP: upload, preview, override, download edited copies
- Public hardening: auth, rate limits, signed URLs, retention cleanup
- Growth: presets, billing/quotas, expanded format support

## Current UX contract (web)

- Treatment workspace uses a guided flow:
  - Left: upload + preview
  - Right: Date, Device, Location
  - Advanced fields in a modal
- Auth UX uses a split pattern:
  - Sign in/sign up in modal
  - Account actions in header dropdown
- Primary workspace action buttons use consistent height/weight for visual alignment.
- Backend processing contract remains unchanged:
  signed upload -> complete -> job -> poll -> one-time download.
