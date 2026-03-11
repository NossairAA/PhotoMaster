# Web App

Frontend for PhotoMaster, built with React and Vite.

## Local development

- Install dependencies with `npm ci` inside `apps/web`.
- Start the dev server with `npm run dev`.
- Build production assets with `npm run build`.
- Preview the production bundle with `npm run start` after building.

## Environment variables

Create `apps/web/.env` from `apps/web/.env.example` for local development.

Required client variables:

- `VITE_API_URL`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

Optional:

- `VITE_AUTH_BEARER_TOKEN` for local testing paths that need a static bearer token.

## Dokploy deployment

- Dokploy app root: `apps/web`
- Build system: `Nixpacks`
- Build and start config live in `apps/web/nixpacks.toml`
- Production server entrypoint is `apps/web/server.mjs`
- The app serves `dist` and falls back to `index.html` for SPA routes
- `.dockerignore` excludes local files like `node_modules`, `dist`, and `.env`

Suggested Dokploy env values:

- `PORT=3000`
- `VITE_API_URL=https://your-api-domain.example.com`

## Notes

- `VITE_*` values are compiled into the frontend bundle at build time.
- Any change to `VITE_API_URL` or Firebase client vars requires a rebuild and redeploy.
