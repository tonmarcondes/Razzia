# Local account authentication

Status: authentication and teacher isolation implemented. Legacy login remains the default. Local mode requires explicit migration, bootstrap and activation; see [teacher isolation](teacher-isolation.md). Do not enable it by changing environment variables alone.

## Identity and administration

Accounts use a normalized, case-insensitive login (3–64 ASCII letters/numbers plus `.`, `_`, `@`, `-`), display name, administrator/teacher role and active state. There is no self-registration or email dependency. Only an administrator may create, disable, change roles or reset accounts. At least one active administrator must remain.

The administrator supplies a temporary password when creating/resetting an account. The user must change it before accessing manager resources or opening a manager socket. Password change revokes every existing login session and returns the browser to anonymous access. The user signs in again with the new password. Reset and disablement revoke sessions; logout revokes its own session. No passwords/hashes are returned by account-list or identity endpoints.

JWT `sub` remains a browser/client identity. Each local login creates a new client identity and stored session; `sid` links the JWT to that session. This prevents a different login from taking over an existing host identity. Account state and revocation are checked on privileged HTTP requests, socket connection and manager commands. Open manager sockets are disconnected on revocation and expire at the JWT deadline.

## Password configuration

- `AUTH_PASSWORD_MIN_LENGTH`: default 15 Unicode code points, configurable from 8 to 128.
- `AUTH_PASSWORD_REQUIRE_UPPER`, `AUTH_PASSWORD_REQUIRE_LOWER`, `AUTH_PASSWORD_REQUIRE_DIGIT`, `AUTH_PASSWORD_REQUIRE_SYMBOL`: `true` or `false`, default false.
- Maximum input length: 256 UTF-16 code units; passwords are not trimmed or truncated. Spaces and password-manager paste work.
- A compact local blocklist rejects common/repeated passwords. This starter list is not a comprehensive breached-password corpus.

Passwords use asynchronous Node scrypt with a random 16-byte salt, 32-byte output and versioned parameters `N=32768, r=8, p=3` (an [OWASP-listed scrypt work factor](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt)). At most two derivations run concurrently in a process; excess work returns 429 rather than blocking the game event loop. Retest latency/memory on the target runtime before institutional capacity claims. Existing valid passwords are not retroactively rejected when policy changes; policy applies to creation/reset/change.

Login limits are process-local: eight attempts per account and 100 per direct request source per 15 minutes, with bounded limiter storage. Successful login clears its account counter. Forwarded-IP headers are not trusted. Behind the current reverse proxy, the direct source can represent several users; tune or extend trusted-proxy handling only with an explicit deployment policy. Restart clears counters; this is not a distributed rate limiter.

## Offline administrator initialization

Run migration first on a reviewed, backed-up config tree. The following command reads JSON `{ "displayName": "...", "password": "..." }` from standard input. Supply it through a protected file/secret mechanism, never a command-line password argument or committed file:

```sh
node packages/socket/dist/account-storage.cjs bootstrap /absolute/config admin < /absolute/private-secret.json
```

Bootstrap initializes the disabled holding administrator once, with a forced password change. It is not a second login mechanism and cannot be replayed after initialization. Local mode also requires an explicit durable `JWT_SECRET` of at least 32 characters. `MANAGER_PASSWORD` is not accepted in local mode.

## API and UI

- Public `GET /api/auth/config` returns mode and password policy.
- Local `POST /api/auth/login` accepts login/password and returns the existing session contract.
- `GET /api/auth/me` returns the current account projection.
- `POST /api/auth/password` reauthenticates and changes the current password.
- Administrator `/api/users` list/create, `PATCH /api/users/:id` and `POST /api/users/:id/reset`.
- Manager settings add **Account and users**. Teachers see their own password form; administrators also see user administration. Portuguese is complete; other untranslated locales use English labels with full key parity.

Authentication/account administration alone is not the privacy boundary. The startup gate now requires the explicit activation state documented in [teacher isolation](teacher-isolation.md); quiz/result/media routes enforce ownership and live-game scope.
