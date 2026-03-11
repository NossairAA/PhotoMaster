# Implementation Checklist

Use this checklist when shipping feature work.

## Planning

- [ ] Define scope and acceptance criteria.
- [ ] Identify impacted files and modules.
- [ ] Verify any API/data dependencies.

## Implementation

- [ ] Add or update code with clear structure.
- [ ] Keep styles/components consistent with the existing system.
- [ ] Preserve accessibility semantics.

## Validation

- [ ] Run build commands.
- [ ] Run unit tests.
- [ ] Manually verify critical user flows.

## Release

- [ ] Review diff for accidental secrets.
- [ ] Confirm Dokploy roots and env vars for `apps/api` and `apps/web`.
- [ ] Verify `.dockerignore` or equivalent build-context exclusions are in place.
- [ ] Write clear commit message(s).
- [ ] Push and verify remote branch state.
