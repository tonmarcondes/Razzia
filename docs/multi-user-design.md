# Multi-user training-center design

Status: implementation in stages. The appearance editor is delivered; the offline account-storage foundation is implemented. Authentication, resource isolation and sharing remain planned and unavailable. No institutional identity provider or production capacity has been confirmed.

## Implementation status

The appearance editor was delivered ahead of account management at the user's request. See [branding](branding.md). It is currently restricted to the existing manager session; account roles remain planned. When local accounts are introduced, restrict global appearance management to administrators. The account/storage/privacy release gates below still apply.

The first account-storage stage provides a transactional schema, read-only inventory, explicit legacy migration and SQLite-consistent backup/restore tooling. See [account storage](account-storage.md) and [ADR 0001](adr/0001-local-account-storage.md). It does not switch the running application away from JSON or enable local accounts.

## Goals and baseline

Support several teachers independently preparing quizzes and running simultaneous classes in one instance. Participants continue joining with the existing six-digit PIN, without accounts. Teachers can reuse shared quizzes while keeping class results separate.

The foundation is upstream 4.0.2 plus this fork's Portuguese support. See [the upstream review](upstream-review-2026-10-29.md) and [contribution rules](../.github/CONTRIBUTING.md).

Preserve React, Hono, Socket.IO, the pnpm package boundaries, Zod contracts, current question/scoring logic, and JSON import/export. Extend the current backend services; do not introduce another server, game engine, public registration service, or identity provider.

## What the current system already does

- The registry can hold several games; each has a manager client, players, settings, and a PIN. It does not provide persistent teacher accounts or private resource ownership.
- HTTP handles authentication and persistent resources. Socket.IO handles live game commands and state.
- A manager session has a browser/client identity in JWT `sub`. This is not a persistent person or organization identity.
- Saved results already contain questions and player answers. Preserve that snapshot behavior and add explicit source-version and owner metadata.
- Quizzes/results are currently JSON files, and media/branding live under `config`. Manager access to these resources is global.
- Login has no rate limiting, and legacy logout does not revoke an already-issued manager token. Neither behavior is sufficient for account disablement.

## Access model

One instance serves one training center initially. Separate organizational tenants, department hierarchies, and delegated administration are outside the first release.

| Capability                                      | Administrator                                            | Teacher                                            | Participant                     |
| ----------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------- | ------------------------------- |
| Create, disable, and reset accounts             | Yes                                                      | No                                                 | No                              |
| Configure global appearance and instance policy | Yes                                                      | No                                                 | No                              |
| Create and edit quizzes                         | All, with audit                                          | Own only                                           | No                              |
| Apply or copy a quiz                            | All                                                      | Own or explicitly granted                          | No                              |
| Change visibility and sharing grants            | All, with audit                                          | Own only                                           | No                              |
| Read/export class reports                       | All, with audit                                          | Own hosted classes only                            | No                              |
| Run a class                                     | Yes                                                      | Yes                                                | No                              |
| Control a running game                          | Its hosting session; separate explicit admin stop action | Its hosting session only                           | No                              |
| Join/respond to a game                          | Through a separate player session when appropriate       | Through a separate player session when appropriate | With PIN and seat authorization |

An administrator's ability to inspect content does not automatically attach their socket to another host's game. Do not change the current rule preventing a host client from joining its own game as a player.

Quizzes are private by default. Visibility is one of:

- `private`: owner and administrators;
- `selected`: owner, administrators, and selected active teacher accounts with explicit grants;
- `library`: all active teachers in this instance, with use and copy permissions.

For selected sharing, model `canUse` and `canCopy` separately. `canCopy` permits a new independent private quiz with a new ID and owner; it does not confer editing or re-sharing rights on the source. Permission to use includes the teacher's ability to review the quiz and its solutions. There are no public preview links or anonymous access to the library in the first release.

Sharing never shares class reports. Hosting a shared quiz makes the hosting teacher the result owner, not the quiz author. Copies are not synchronized with later source edits. Revoking a grant blocks new reads/copies/game creation but does not rewrite a class already started from its authorized snapshot or a copy already created.

Account removal initially means disablement, not hard deletion. Keep ownership/history intact and permit explicit administrator reassignment. Protect the last active administrator from accidental disablement or demotion.

## Persistence decision

Propose SQLite as the transactional store for local-account mode on the current single-server deployment. It lives in the existing persistent config volume, is not served by nginx, and is accessed through backend storage interfaces. This is an explicit extension of persistence, not a replacement of the HTTP/socket architecture.

Use one authoritative store per mode. In local-account mode, account, session, quiz ownership, grants, quiz content/revisions, and result snapshots are committed in SQLite transactions. Keep quiz definitions and result payloads in their existing validated JSON shapes inside that store, rather than redesigning every question into a new relational format. Keep media files and branding assets on disk.

Retain legacy JSON-file mode for existing standalone installations until an explicit migration. After migration, the original JSON files are retained as a read-only backup; do not keep two independently writable versions of the same quiz. Preserve JSON import/export as the portable interchange format.

The implementation ADR must validate a SQLite driver with the pinned Node 24 runtime, bundler, and Alpine runner before adding a dependency. Evaluate the built-in driver against a small maintained alternative; do not assume API stability or copy the old PR #184 dependency choices. Use parameterized SQL, foreign keys, transactional schema migrations, a local-volume WAL configuration, and a documented busy-timeout policy. Keep expensive password work off the event loop.

### Logical records

| Record                          | Required responsibility                                                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`                         | Stable ID, normalized unique login, display name, administrator/teacher role, active state, versioned password hash, forced-reset state, timestamps |
| `sessions`                      | Session ID, user ID, client ID, issue/expiry/revocation times; support immediate invalidation                                                       |
| `quizzes`                       | Stable quiz ID, owner ID, visibility, current revision, archive/deletion state                                                                      |
| `quiz_revisions`                | Immutable validated quiz payload, sequence, hash, author and creation time                                                                          |
| `quiz_grants`                   | Quiz/user pair with explicit use/copy permissions                                                                                                   |
| `game_runs` / `results`         | Host user/session, source quiz/revision, applied snapshot, existing result payload and timestamps                                                   |
| `media` and revision references | Immutable stored asset identity, ownership and every reference that prevents deletion                                                               |
| `audit_events`                  | Actor, action, resource ID and time; exclude passwords, tokens, and full question/answer payloads                                                   |

Existing IDs and supported quiz fields must survive migration. New copies receive new IDs; matching quiz titles must not overwrite each other. Imports cannot choose an owner, grant permissions, or replace another teacher's quiz by supplying an ID.

Media writes must finish to a temporary file and be atomically finalized before a database record makes them visible. A failed transaction may leave an unreferenced file for conservative cleanup, never a visible reference to an incomplete upload. Garbage collection must consider copies, shared quizzes, active games, and retained reports before deleting an asset.

## Identity and sessions

Keep these identities distinct:

1. `userId`: persistent teacher/administrator account;
2. `sessionId`: a revocable login session;
3. `clientId`: browser/client identity currently carried in JWT `sub`;
4. `socket.id`: transient connection identifier;
5. `gameId`: class/room identity.

Preserve `sub` as the client identity so two browser sessions for one teacher cannot silently take over each other's sockets. Bind authenticated manager claims to a stored session and account. Keep the current player and manager wire roles if possible; administrator/teacher authorization comes from the account, not a new unverified client-supplied role.

Validate account/session state on privileged HTTP requests, socket connection/reconnection, and privileged manager commands. Logout, reset, and disablement revoke relevant sessions and disconnect their manager sockets. Expired or disabled sessions cannot continue controlling a game through an already-open socket. Reuse the existing disconnect/grace cleanup; do not silently transfer the room to another teacher or disrupt unrelated classes.

Participants retain anonymous signed sessions and per-game join tickets. An old manager token without a valid account/session mapping cannot be treated as a privileged local-account session.

### Passwords and first administrator

All names below are proposed configuration, not existing environment variables:

- `AUTH_MODE=legacy|local`, defaulting to `legacy` for an unmodified installation;
- a database path resolved inside the persistent config directory;
- bootstrap administrator login and password supplied through deployment secrets, or an offline first-run command;
- `AUTH_PASSWORD_MIN_LENGTH`, proposed default 15 for password-only local accounts;
- optional composition switches if institutional policy requires them, disabled by default.

Allow long passphrases, spaces, password-manager paste and at least 64 characters. Do not trim/truncate passwords, impose periodic changes without cause, or reveal whether a login exists. Validate policy on account creation/reset/change, not by retroactively locking users out during a routine restart. The first account is created transactionally only when no account exists; bootstrap credentials do not remain an alternate login after setup.

Use a salted, parameterized, versioned password hash. Prefer Argon2id if an appropriate runtime-compatible implementation is accepted; otherwise assess asynchronous scrypt. Benchmark cost and bound concurrent login work. Do not use a fast general-purpose hash, reversible encryption, a shared salt, or the JWT secret as a password-hashing key. Check a local common-password blocklist and rate-limit login/reset/bootstrap paths by account and request source, with proxy configuration defined explicitly.

These defaults are a design baseline informed by [NIST password guidance](https://pages.nist.gov/800-63-4/sp800-63b.html#passwordver) and [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), not a declaration of institutional approval or certification. Parameters and limits must be documented with the implementation.

In local mode, `MANAGER_PASSWORD` cannot upgrade anonymous sessions or act as a hidden administrator login. Require an explicit durable JWT secret and a successful migration/bootstrap before enabling local mode. A migration failure must not automatically fall back to unrestricted legacy access. An administrator can create teachers and issue a one-time reset mechanism with forced password change; no self-registration or external email delivery is included initially.

## API and UI extension points

Continue using the current API error contract: symbolic translation keys and appropriate HTTP status codes. New labels and keys use the existing locale mechanism, with complete `pt` coverage and locale parity tests.

Proposed HTTP surfaces, to be finalized alongside the shared validators:

- Account login/logout/session validation and current-user lookup under `/api/auth`; local mode adds a username/password login, while the legacy shared-password route is only enabled in legacy mode.
- Administrator-only account listing, creation, role/status changes, and reset initiation under `/api/users`.
- Current-user password change with reauthentication and session rotation; a forced-reset session cannot access manager resources before completing the change.
- Owner-aware existing `/api/quizz` and `/api/results` routes. Check authorization on list, detail, edit, delete, import, and export.
- Separate quiz grant and copy endpoints, with server-assigned ownership and transactional copy creation.
- Authorized `/api/media` operations and scoped media retrieval. Do not infer permission from the ability to guess a filename.
- Administrator-only appearance management, later, using the existing theme schema and asset-serving mechanism. Validate asset types, sizes, names and theme values; do not expose arbitrary filesystem writes or executable markup. Preserve the existing config-file fallback.

Extend the current manager screen with identity/logout, user administration for administrators, and quiz sections for own quizzes, selected shares, and the instance library. Keep class reports distinct from the quiz library. Use the existing query/store/component patterns.

Teacher lists and serializers must not leak password hashes, session tokens, private quiz names, or another teacher's report metadata. Enforce permissions in the backend even if someone bypasses the UI or sends another resource ID directly. Return a consistent not-found response for inaccessible private resources where appropriate.

### Private media is part of authorization

The current static `/media/` route is public. Adding account-protected JSON endpoints alone does not make quiz media private. Before enabling private quizzes in local mode, protect that route or move private assets to an authorized serving path. Existing legacy-public media needs an explicit classification step, not a misleading privacy label.

HTML image/audio/video requests need an implementation-compatible mechanism: an authenticated serving path or short-lived, narrowly scoped asset capability, never a manager JWT in a media URL. If capabilities are used, define expiry, revocation, range requests, download limits, and log redaction. Only authorized teachers and participants in the applicable active game receive the necessary access. Branding assets remain intentionally public and separate from private training material.

Copies may reference immutable media already used by the source, with access derived from the copy; deleting the source must not break the copy. Sharing revocation and asset retention rules must be tested together. Authorized users can still download content they are permitted to view; do not promise technical prevention of redistribution.

## Simultaneous classes and immutable content

Reuse the current game registry. At game creation, atomically verify the actor's session, quiz permission, and revision, then create an immutable applied snapshot and associate the hosting user/session. Do not authorize only once in the UI.

Keep PINs at six digits. Ensure a newly allocated PIN is unique among active games, using bounded retries and an appropriate random source; the current random generator does not check uniqueness. Test collisions deterministically. This is not a request to configure PIN length.

A teacher's login in another browser must not impersonate a different teacher's host session. Participants and commands must remain scoped to the correct room. Editing, archiving, changing grants, or deleting a source quiz must not alter an ongoing class or a saved report. Record the exact quiz revision and source identity in reports, extending the snapshot already saved upstream.

Live games remain process-local and end on server restart, as upstream does today. Do not claim durable class resumption, horizontal scaling, collaborative editing, or zero-downtime migration. Establish a measured capacity target with the training center before making concurrency guarantees.

## Migration and rollback

1. Inventory the exact running image, toolchain, config paths, quizzes, results, media and branding. Confirm that no class is active before a disruptive migration.
2. Create a consistent backup and restore it into an isolated rehearsal environment. Record file counts, hashes, and record IDs without exposing training content in logs.
3. Run a dry migration first. Report invalid JSON, duplicate IDs, missing references, conflicting titles and unsupported fields; do not silently overwrite, discard, or reassign them.
4. Initialize the local store in a transaction with a schema version and import manifest. Preserve valid IDs and complete supported payloads; test source-file hashes before and after.
5. Assign legacy quizzes and results to the bootstrap administrator in an administrator-only holding area. Do not infer their teacher from titles or player names, and do not publish them automatically in the library.
6. Have an administrator explicitly assign ownership. Validate media classification/access and complete reset/setup before granting other accounts access.
7. Enable local mode only after migration, account/session controls, resource authorization, and private asset serving are all present. A partially implemented feature remains disabled.
8. Keep the old source data read-only. For rollback before new writes, restore the complete matching image/config/data backup. After new writes, require a tested export/recovery plan; restoring only an old image would lose or misinterpret local-mode changes.

Use a SQLite-consistent backup method that accounts for WAL state; a raw copy of only the database file is insufficient. Store account/session data outside public asset directories and restrict its filesystem permissions. Keep backups and secrets out of Git.

## Delivery sequence

Each item is a separate coherent branch/PR from updated fork `dev`, with relevant unit/integration tests and the full required CI before review:

1. `chore/sync-upstream-4-0-2`: upstream foundation and Portuguese/Polish compatibility only.
2. `docs/multi-user-design`: this specification, the upstream inventory, and root agent instructions; no runtime behavior changes.
3. `feat/account-storage`: driver ADR/prototype, transactional schemas/storage interfaces, migration dry run and restore tests. Local-account mode remains unavailable to users until its authorization gates are complete.
4. `feat/local-accounts`: password policy, bootstrap, account administration, login/reset and revocable sessions, using the same backend auth system.
5. `feat/teacher-isolation`: ownership on all resource and host paths, protected media, legacy ownership assignment and the local-mode activation gate. Account disablement and direct unauthorized requests are tested end to end.
6. `feat/quiz-sharing`: selected/library visibility, use/copy, immutable versions and per-host reports, with independent content ownership.
7. `feat/branding-settings`: administrator UI for identity, colors and backgrounds by screen, preview/reset, persistence through the existing branding mechanism and an explicit next-game application policy.
8. Operational hardening/rehearsal: HTTPS, backup restoration, agreed capacity/load test, monitoring, retention and access policy. OIDC depends on the organization's identity provider and TI approval; do not implement a guessed provider or tenant.

The account feature is not deployable in local mode merely because storage or login has merged. Steps 3-5 form a release gate. Sharing and appearance do not need to be bundled into authentication PRs.

Original issues [#34](https://github.com/Ralex91/Razzia/issues/34) and [#169](https://github.com/Ralex91/Razzia/issues/169) are background references only. All implementation and PRs stay in this fork; do not contact upstream maintainers. Keep institutional names/assets configurable, and do not assume the closed PR #184 is accepted precedent.

## Acceptance scenarios

- Two teachers in separate browser contexts run two classes at once, with separate PINs, players, settings, answers, reconnections and results. Neither can operate the other's room through a forged HTTP request or socket command.
- A teacher cannot discover another teacher's private quizzes, reports, or media by list, ID, export, filename, download URL, or stale grant. An administrator's authorized inspection is auditable.
- Disablement, logout, password reset and expiry invalidate the applicable HTTP and socket privileges. The legacy shared password cannot bypass local mode. A forced-reset session cannot start a class.
- A selected share can be applied without editing the original. A permitted copy is independently editable; revoking source sharing does not remove a completed copy or its assets.
- Editing/deleting the source after a class starts leaves the applied questions and historical scoring unchanged. Shared quizzes never reveal another host's reports.
- A deterministic PIN collision is retried without routing participants to another class.
- Failed/cancelled migrations leave source data intact and local mode disabled. Dry runs do not expose or reassign content. Rehearsed backup restore preserves all records/assets and account isolation.
- Portuguese labels, validation errors, ordinals and interpolation remain correct; existing game/question/branding tests continue to pass.
- Local-account mode is unavailable until every required privacy boundary is implemented. No load or institutional-readiness claim is made based only on these functional tests.

## Inputs needed before institutional release

Confirm initial administrator provisioning, the desired number of simultaneous classes/participants, hosting and HTTPS ownership, report access/retention, the policy for shared training material, and whether the organization offers OIDC. These inputs do not block isolated development with synthetic accounts and quizzes. They do block declaring the deployment ready for real institutional data.
