# Working on this Razzia fork

## Purpose and priority

Evolve Razzia for a training center with several teachers and simultaneous classes, while preserving its upstream architecture, MIT license, attribution, and portability. Use Kahoot as a reference for usability and reliability; keep an independent identity.

The golden rule is to follow the original project's conventions for commits, branches, pull requests, code, tests, and technical documentation. Read `.github/CONTRIBUTING.md` and the relevant `docs/` guides before changing behavior. These instructions add fork-specific context; they do not replace upstream guidance or the user's instructions.

## Architecture

- Keep the pnpm monorepo: React in `packages/web`, Hono and Socket.IO in `packages/socket`, shared contracts and Zod validators in `packages/common`, and Playwright in `packages/e2e`.
- Keep authentication, persistence, and resource management in the HTTP API. Keep live game state and events in Socket.IO. Follow the existing API, event, query, and store patterns.
- Reuse the in-memory game registry, per-game ownership checks, reconnection behavior, result snapshots, import/export, and runtime branding. Do not introduce a second game engine or a parallel authentication stack.
- Introduce persistence through the existing backend services and narrow storage interfaces. Database migrations and changes to identity or access control need a documented design, compatibility plan, and migration tests as part of the change.
- Preserve existing question types, scoring, quiz JSON compatibility, and player entry through a six-digit PIN unless a task explicitly changes them.
- Keep company identity configurable at runtime. Do not hardcode an organization's name, artwork, passwords, or deployment addresses into application defaults.

## Git and contribution workflow

- `origin` is the user's fork. `upstream` is `Ralex91/Razzia`. Check the actual remotes before pushing.
- Fetch and inspect upstream `dev` before each new feature. Update the fork's `dev` through a separate, reviewed synchronization change when necessary; preserve fork changes such as Portuguese.
- Create each branch from the current fork `dev`. An upstream contribution should use the current upstream `dev` as its base and include only its intended changes.
- Use `feat/`, `fix/`, `chore/`, `docs/`, or `test/` as appropriate. Keep one coherent feature or fix per PR. Infrastructure synchronization and product features belong in separate PRs.
- Use Conventional Commits in English, following the repository's history, for example `feat(auth): add teacher accounts` or `docs: define multi-user access model`.
- Keep PR titles, descriptions, identifiers, comments, and technical documentation in the repository's existing English style. Communicate with the user in their preferred language.
- Target `dev`, not `main`, for ordinary contributions. Do not rewrite published `main` or `dev` history to clean up a feature branch.
- Coordinate an upstream multi-user proposal with issues #34 and #169; do not assume a fork feature is accepted upstream. Do not send maintainer messages unless the user has authorized them.
- Link related issues accurately. Use `Closes` only when the PR actually fulfills the issue; a design document does not close a feature request.

## Toolchain and verification

- Use the Node major selected by `.nvmrc` and `package.json`, and the exact pnpm version declared in `packageManager`. The baseline on 2026-10-29 uses Node 24 and pnpm 11.28.7; those files remain authoritative.
- Install dependencies from the repository root with `pnpm install --frozen-lockfile`. Never update a lockfile merely to make a different local tool version work.
- Before committing, run `pnpm format:fix` and `pnpm lint:fix`, and inspect the resulting diff for unrelated changes. Check `pnpm format` and `pnpm lint`.
- For behavior changes, run `pnpm build`, `pnpm test`, and the full `pnpm test:e2e`. Install the Playwright browser as described in `docs/testing.md`.
- Add meaningful tests for changed behavior. Use the E2E fixtures and helpers, including `t()` for UI strings, and role/label/text locators.
- For documentation-only changes, verify formatting, links, and agreement with the code; do not add tests that merely mirror documentation. Required CI must still pass before requesting review.
- Do not remove assertions, lower security rules, skip tests, or change timers just to obtain a green result. Record local failures, distinguish them from CI results, and investigate regressions.
- Verify the PR's current head and actual check results. Do not describe an unexecuted check, a skipped job, or another revision as passed. If validation uses a separate branch, disclose the exact difference and check source equivalence.
- Keep a PR as a draft while required CI is pending or blocked by maintainer approval. Once the checks pass, mark it ready only within the user's authorized scope.

## Identity and data boundaries

- Treat the multi-user design as planned until implemented and verified. See `docs/multi-user-design.md` for the permission model and delivery gates.
- Distinguish an account ID, a login session, a browser/client identity, a socket ID, and a game ID. Do not replace the current JWT `sub` with an account ID without preserving client isolation and reconnection semantics.
- Enforce authorization on the server for every relevant HTTP route and socket event, including lists, exports, media, reports, settings, and reconnects. UI visibility is not an access-control boundary.
- A shared quiz does not grant access to its owner's class results. A copy has its own owner and identity. A running game and historical report must retain the version that was applied.
- In multi-user mode, a revoked or disabled account must lose access through existing HTTP sessions and live sockets. Do not leave the legacy shared password as an administrator backdoor.
- Keep secrets out of source control, browser branding payloads, logs, screenshots, and documentation. Never return passwords, hashes, bootstrap secrets, or signing keys in API responses. Return session/join tokens only through their intended authentication contracts. Store individual passwords as salted, versioned password hashes, never plaintext or reversible encryption.
- Translate new UI and error keys through the existing locale system. Portuguese uses `pt` with Brazilian wording. Maintain every locale's keys and interpolation variables according to the existing tests.

## POC and deployment

- The existing POC is on the SSH host `rjserver`, under `/root/containers/razzia`. Discover its current Compose file, image, mounts, and health before changing it; do not infer its state from an old report.
- Keep `.env` and the persistent `config` volume intact. Build a versioned image from a known commit before switching the running service.
- For an authorized deployment or migration, create and verify a backup, retain a usable previous image/configuration, perform health and public browser checks, and document rollback. A Git merge alone does not deploy a container.
- Never run the ordinary unit or E2E suite against the live POC data. Public smoke tests must use disposable, clearly identified records and remove only their own records.
- Database rollback must account for writes made after migration. Do not switch back to a legacy image against incompatible data and assume it is a safe rollback.
- Use synthetic accounts and training content while validating this work. Institutional release depends on HTTPS, access policy, restore testing, and an agreed concurrency target.
- Honor existing user authorization; do not ask for repeated confirmation for work already in scope. Report external blockers and unfinished operational work explicitly.
