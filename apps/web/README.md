# Web App

Frontend for PhotoMaster, built with React and Vite.

## Local development

- Install dependencies with `npm ci` inside `apps/web`.
- Start the dev server with `npm run dev`.
- Build production assets with `npm run build`.
- Preview the production bundle with `npm run start` after building.

## Environment variables

Create `apps/web/.env` from `apps/web/.env.example` for local development.

- Use `apps/web/.env.example` as the source of truth for the required client variables.
- Keep secrets and deployment-specific values out of markdown docs and store them only in local `.env` files or Dokploy variables.

## Dokploy deployment

- Dokploy app root: `apps/web`
- Build system: `Nixpacks`
- Build and start config live in `apps/web/nixpacks.toml`
- Production server entrypoint is `apps/web/server.mjs`
- The app serves `dist` and falls back to `index.html` for SPA routes
- `.dockerignore` excludes local files like `node_modules`, `dist`, and `.env`

Suggested Dokploy env values:

- `PORT=3000`
- Set the API base URL to your public backend domain.

## Notes

- `VITE_*` values are compiled into the frontend bundle at build time.
- Any environment change for the frontend requires a rebuild and redeploy.
