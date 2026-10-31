# Account storage tools

The offline storage foundation now supports the [local account](local-accounts.md) and [teacher isolation](teacher-isolation.md) implementation. The application defaults to legacy JSON/shared-password mode; local mode requires an explicit reviewed migration, administrator bootstrap and activation.

See [ADR 0001](adr/0001-local-account-storage.md) for the driver, schema, limitations and rollback decision, and [the multi-user design](multi-user-design.md) for the remaining release gates.

## Offline rehearsal

Build with the pinned Node/pnpm versions. The backend build produces `packages/socket/dist/account-storage.cjs` in addition to the server. Docker includes the CLI at `/app/socket/account-storage.cjs`.

Use an isolated copy of the complete config directory for rehearsal. Do not run ordinary test suites against POC data. Use a maintenance window and a verified complete backup before a real migration; follow the explicit [activation procedure](teacher-isolation.md) for the final account-mode switch.

```sh
node packages/socket/dist/account-storage.cjs inspect /absolute/rehearsal/config
```

The JSON report contains counts, paths, diagnostic codes and a manifest hash, not question content or participant names. Treat source filenames as potentially sensitive. `inspect` makes no filesystem changes. Blocking errors produce exit status 1; resolve them in a reviewed source copy. It does not silently repair broken data. Unknown non-JSON files in quiz/result directories are reported as warnings and retained outside the import.

```sh
node packages/socket/dist/account-storage.cjs migrate /absolute/rehearsal/config MANIFEST_HASH_FROM_INSPECT
node packages/socket/dist/account-storage.cjs check /absolute/rehearsal/config
node packages/socket/dist/account-storage.cjs backup /absolute/rehearsal/config /absolute/private-backups/new-copy.sqlite
```

Migration preserves source files and stable IDs. Imported quizzes are private, media is held for classification, and the holding administrator is disabled without a password. Before bootstrap/activation, no teacher can log in to this store. After explicit activation, local-mode HTTP/socket/media authorization uses SQLite and the original JSON is retained only as a migration snapshot.

`backup` uses SQLite's consistent backup API and checks database/foreign-key integrity. The destination must be a new file in real directories. Keep it in a private directory, outside branding/media or any web root, along with the matching media and branding files for a full recovery. It is not a standalone backup of the whole installation.

To rehearse restore, open the SQLite backup read-only, check its integrity and compare the migration records, quiz/result IDs and payloads, account state and media hashes with the rehearsal. Restore the matching asset files into another isolated config tree. Never replace an open live database with a raw copied file.

## Diagnostics

| Code                     | Meaning                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| `invalid-record`         | Unreadable JSON or a record that fails existing quiz/result validation.                     |
| `invalid-id`             | Missing/invalid result ID or invalid explicit quiz ID.                                      |
| `duplicate-id`           | Two source records of the same kind claim the same ID.                                      |
| `unsupported-fields`     | A quiz field would be discarded by validation.                                              |
| `missing-media`          | A local media reference has no inventoried file.                                            |
| `unsupported-media-url`  | A local media URL cannot be represented safely.                                             |
| `unsafe-path`            | Symlink, directory or special file found where a regular file/directory is required.        |
| `file-too-large`         | A source file exceeds the offline import limit of 64 MiB.                                   |
| `unsupported-media-name` | A media filename cannot be served by the existing media naming contract.                    |
| `duplicate-title`        | Distinct IDs have the same normalized title; both are preserved.                            |
| `generated-id`           | An old quiz lacks an ID; the import assigns a deterministic ID without changing the source. |
| `unrecognized-file`      | A non-JSON file in the quiz/result directory is retained but not imported.                  |

Sessions, account administration and protected quiz/result/media routes are described in [local accounts](local-accounts.md) and [teacher isolation](teacher-isolation.md). Sharing remains separate. Do not infer release readiness from the schema alone.
