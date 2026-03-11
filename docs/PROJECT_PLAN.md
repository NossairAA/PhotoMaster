# Project Plan

## Product Objective

Build a web app that lets users upload photos, adjust metadata safely, and download processed results.

## Current Architecture

- `apps/web`: React + Vite frontend
- `apps/api`: Node/Fastify backend
- `scripts`: repository-level helper scripts

## Deployment Shape

- Dokploy uses two separate apps from this monorepo.
- `apps/api` deploys with Nixpacks as the backend service.
- `apps/web` deploys with Nixpacks as a static Vite build plus a lightweight Node SPA server.
- The worker is intentionally excluded from the first production deployment until its processing pipeline is completed.

## Functional Areas

1. Authentication and profile management
2. File upload and processing job pipeline
3. Metadata editing (guided + advanced)
4. Result packaging and download

## Quality Priorities

- Security: never commit secrets or credentials
- Reliability: deterministic job status and downloads
- UX: clear hierarchy, accessible forms, responsive layout

## Next Milestones

- Improve bundle splitting for web build size warnings
- Add richer E2E coverage for auth and upload flows
- Expand metadata presets and validation rules
- Add worker deployment once the queue processing path is fully implemented
