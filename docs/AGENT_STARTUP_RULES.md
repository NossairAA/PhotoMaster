# Agent Startup Rules

This document lists the expected startup behavior for assistant sessions in this repository.

## Goals

- Keep local secrets out of version control.
- Prefer safe defaults when uncertain.
- Avoid destructive actions unless explicitly requested.
- Keep commit messages concise and purpose-driven.

## Session Checklist

1. Check repository status first.
2. Confirm `.env` and key files are ignored.
3. Make targeted changes only.
4. Run the relevant build/tests.
5. Summarize exactly what changed.

## Security Notes

- Never commit real credentials.
- Use `.env.example` for shared configuration keys.
- Treat service account files as local-only.
