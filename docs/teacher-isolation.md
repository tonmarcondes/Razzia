# Teacher isolation and local-mode activation

Local accounts are supported after an explicit offline migration, administrator bootstrap and activation. Quizzes are private by default. Administrators may inspect/manage content with audit. Public quizzes form an authenticated teacher library: other teachers can read, export and apply them, while editing, archival and visibility changes remain restricted to their creator and administrators. Private quizzes and class reports remain isolated. Imported JSON/XLSX creates a new quiz owned by the current teacher; client-supplied IDs and owners cannot choose or replace stored ownership.

## Content and classes

SQLite is authoritative in local mode. JSON source files remain untouched migration snapshots and are not written by the application after cutover. New edits append immutable quiz revisions. Archival removes a quiz from normal lists without rewriting historical versions. A game records the exact source quiz/revision, host account/session and applied snapshot; editing or archiving the source cannot change an existing class. Saved results belong to the hosting account. Report JSON and source/version metadata are kept in the result/game-run records.

Six-digit PINs use cryptographic random generation, check the active registry for collisions and stop after bounded retries. A second login, even for the same account, cannot take over another hosting client/session. Live games remain process-local and end on restart. Database game-run records do not imply resumable classes.

Creators and administrators choose **Private** or **Public** in **Settings → Quizzes**. `PATCH /api/quizz/:id/visibility` accepts `private` or `public`; the existing schema maps public visibility to `library`. The former ownership-transfer UI and endpoint are removed. Ownership stays with the creator. Public means active signed-in teachers in this instance, never anonymous access. Reports remain attributed to their actual host; making a quiz public does not share class results.

Changing back to private blocks new foreign reads/exports/game creation. Already running games and their participants retain access to the applied snapshot and its referenced media. Quiz imports remain new private quizzes owned by the importer. Visibility is database metadata, not a client-controlled field in native quiz JSON. No schema migration is needed: version 1 already stores private/library visibility; existing private data stays private. A compatible older local-mode image hides library quizzes from other teachers rather than exposing private content.

## Media boundary

Both nginx and local-mode Vite forward `/media/` to the existing backend. No local-mode static alias bypasses authorization. Browser media requests use a host-only HttpOnly, SameSite=Strict cookie scoped to `/media`; the signed session token is never put in a URL. Cookie lifetime follows the session; the backend revalidates account/session state on every media request. Joining a class also refreshes this cookie for existing anonymous player sessions.

Teachers can access their own uploads, media referenced by their owned current quizzes/results, and media referenced by current public quizzes. Active participants can access media in their applicable game snapshot. Hosts retain media access for the applied snapshot even if the source is edited. Leaving/ending removal of the game removes that anonymous capability. Unauthorized requests return 404. Byte ranges are supported for audio/video, responses disable private caching, and content types use a fixed extension map with `nosniff`.

Uploads finish atomically on disk before the database makes them visible. Files referenced by retained quiz revisions, games or reports cannot be deleted. This conservative policy can retain old assets; no automatic garbage collection is introduced. Branding remains intentionally public and global changes require an administrator. Previously viewed/downloaded content cannot be erased from an authorized user's device.

`AUTH_COOKIE_SECURE` defaults to true. Only isolated HTTP development/tests should set it to false. HTTPS is required for the deployed local-mode browser flow. JWT-bearing URLs are not an alternative.

## Controlled activation

1. Stop class creation and verify no class is active. Stop the legacy service before taking the final consistent backup and performing cutover.
2. Back up `.env`, Compose, the complete config tree and matching deployment configuration. Verify restoration in an isolated environment first. Keep secrets/backups outside web roots and Git.
3. Run the offline `inspect` and `migrate` commands against the backed-up source, resolving every blocking diagnostic. Record the exact inventory manifest hash. Rehearse on a separate copy first.
4. Initialize the first administrator through the stdin-based `bootstrap` command. It remains subject to mandatory password change. Preserve the holding account ID so legacy ownership stays intact.
5. Run `account-storage activate CONFIG_DIRECTORY REVIEWED_MANIFEST_HASH`. It requires the matching migration, a bootstrapped active administrator and supported media files, then classifies held media as private and sets the durable activation marker in a transaction.
6. Set `AUTH_MODE=local`, an explicit durable `JWT_SECRET` and HTTPS cookie settings in protected deployment configuration. Start the reviewed image and verify health, login/forced password change, private media and administrator/teacher authorization.
7. A config marked active refuses to start in legacy mode on the new image. Do not change the mode back to gain shared access. Original JSON is no longer authoritative after local writes.

Before handoff, a failed initial cutover may return to its complete legacy backup only if no new training content, ownership changes, reports, media or teacher accounts have been written. Preserve the failed local database for diagnosis. After local-mode writes, use a compatible local-mode image and a SQLite-consistent database/asset backup or a reviewed owner-preserving recovery. A legacy image against old JSON would both lose new work and remove the ownership boundary. It is not a safe rollback.

## Verification

Unit/API tests cover direct unauthorized reads/writes/game creation, forged import ownership, administrator-only branding/users, private bytes and ranges, immutable snapshots, per-host reports, fractional estimation answers, referenced-media retention and deterministic PIN collisions. Existing legacy unit/browser tests remain required.

`pnpm test:e2e:local` runs a separate synthetic config on ports 3100/3101. It exercises administrator/teacher UI, mandatory password changes, two simultaneous classes, separate PINs/participants/reports, direct foreign requests, live host disablement and a mobile viewport. It does not use POC data or establish an institutional concurrency guarantee. Browser acceptance is one end-to-end scenario in addition to the existing legacy suite.

Selected-user grants, institutional identity integration, retention/cleanup policy and a measured deployment capacity remain separate follow-up work. Public library access is implemented; anonymous public links are not.
