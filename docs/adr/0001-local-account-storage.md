# ADR 0001: local-account persistence foundation

Status: accepted for the storage foundation; local authentication remains disabled.

## Context

The application currently persists quizzes and results as JSON and has no persistent user identity. Local accounts require transactional ownership, revocable sessions, immutable applied versions and a migration that does not silently discard training material. HTTP and Socket.IO remain the existing application boundaries.

## Decision

Use Node's built-in `node:sqlite` behind a backend-only storage module, with `DatabaseSync` for short parameterized transactions and the asynchronous SQLite backup API for consistent backups. The file is `config/accounts/accounts.sqlite`, separate from public media and branding. No account database is opened by the running application in this delivery.

The pinned runtime is Node 24.22.1. Its [version-specific SQLite documentation](https://github.com/nodejs/node/blob/v24.22.1/doc/api/sqlite.md) labels this API release candidate, not stable. The implementation uses only documented APIs, disables loadable extensions and double-quoted string literals, enables foreign keys and defensive defaults, and verifies the runtime in both local Node and the actual Alpine runner. Retest when changing the Node version or image.

The alternative evaluated was [better-sqlite3](https://github.com/WiseLibs/better-sqlite3), whose documented synchronous statements, transactions and backup API fit this workload. It adds a native package and an additional native binary/build compatibility requirement for the current bundled Alpine runner. The built-in driver avoids that dependency. This decision is conditional on successful runner verification; it is not a claim that synchronous SQLite provides unlimited game capacity.

## Storage invariants

- Versioned transactional schema; unknown versions are rejected without downgrading or recreating data.
- WAL, `synchronous=FULL`, foreign keys and a 5,000 ms busy timeout. The current deployment is one process on a local volume, not a network filesystem or horizontally scaled service.
- Database directory mode 0700 and file mode 0600. Symlinks and special files inside storage paths are rejected. Backups require a new path and never overwrite an existing file.
- Stable user, session, client, quiz, revision and game-run identities remain distinct. The schema does not change JWT `sub` or wire roles.
- Quiz revisions and saved result payloads cannot be rewritten. Quiz archival and result deletion metadata are separate from historical content. Transactional ownership/authorization operations will be added with the account and isolation features.
- Legacy data is held privately by a disabled administrator placeholder with no password. Bootstrap must explicitly initialize this holding identity before any teacher gains access. This is not a usable login or a default credential.
- Media is inventoried with hashes, size and references and classified `holding`. It is not declared private while legacy static media serving remains public. No media is deleted or republished by migration.
- Audit rows contain actor/action/resource/time only, never hashes of passwords, tokens or question payloads.

## Migration and rollback

`account-storage inspect` is read-only and does not invoke the existing loader that assigns quiz IDs on disk. It reports invalid records, duplicate IDs, unsupported fields, missing media and unsafe paths. Equal titles receive a warning but retain distinct IDs. Quiz IDs absent from old files are derived deterministically from their relative path and reported; original files are not rewritten.

Migration requires the exact reviewed file-manifest hash, an empty account store and a complete valid inventory. All inserts, the migration manifest and the audit event commit together. Repeating the identical import is idempotent; changed source content is rejected. Quizzes and results retain their current validated JSON shapes, with explicit legacy normalization. Original JSON and media stay untouched. Snapshot sources must be quiescent; this tool is not a replacement for a maintenance window.

SQLite-consistent backups include committed WAL data and pass database and foreign-key integrity checks. Restore tests open the resulting backup and verify records and metadata. Do not back up by copying only the main database file while it is open.

No authoritative-store switch occurs in this delivery. The POC keeps using JSON. Once local mode is implemented, its activation must also require authentication, HTTP/socket isolation, private asset serving and an explicit migration. A return to a legacy image after new local-mode writes will need a tested data recovery/export procedure; this foundation does not make such a downgrade safe.

## Validation boundaries

Unit/integration tests cover foreign keys, permissions, schema versions, rollback, immutable payloads, migration preservation, duplicate/unsupported inputs, symlinks and WAL backup/restore. The compiled CLI must be exercised on the pinned Alpine runner with isolated data. Existing application build and full browser tests must remain green. Neither storage tests nor a dry migration claim teacher isolation or institutional readiness.
