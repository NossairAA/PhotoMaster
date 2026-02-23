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
