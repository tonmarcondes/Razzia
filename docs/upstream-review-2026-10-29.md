# Upstream review: 2026-10-29

## Revisions and scope

This review compared upstream `dev` at `222168a52144e1567af78751f393cf735f5c4510` with the fork's starting `dev` at `dfdda278489191beb977aff955f78ce5ebe8a8ce`. The latest published upstream release was [4.0.2](https://github.com/Ralex91/Razzia/releases/tag/4.0.2), published on 2026-10-28; upstream `main` pointed to `8345663f7f47a8d466964fcf5b642cc7a4ed90fb`.

The Portuguese contribution [PR #261](https://github.com/Ralex91/Razzia/pull/261) was still open and not merged at the time of this review. Preserve it in the fork; do not assume that pulling the official image includes Portuguese.

## Changes to adopt before starting the next feature

| Upstream change since the previous baseline                                                                    | Consequence for this fork                                                                                             |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Node 24 alignment, `.nvmrc`, `engines.node: ^24`, and `packageManager: pnpm@11.28.7`                           | Use the pinned current toolchain, not the earlier Node 26 CI environment.                                             |
| Docker image changes, pinned base digests, s6 instead of supervisord, and updated dependencies                 | Build new images from the upstream Dockerfile. Check the actual runtime command when preparing a later POC update.    |
| Docker scanning workflow and security checks                                                                   | Preserve them. Security PR checks target `main`; do not claim that a `dev` PR automatically executes those jobs.      |
| Polish locale                                                                                                  | Preserve both Polish and Portuguese. Add the new language name in both directions so locale key parity remains valid. |
| Username validation text corrected to describe an empty name, rather than a nonexistent four-character minimum | Apply the same correction to Portuguese. The validator already accepts names of 1-24 characters.                      |

The synchronization must keep the existing Portuguese files, selector entry, and browser tests. It should not introduce accounts, sharing, or a branding editor.

## Capabilities already available to reuse

| Existing capability                                                | Evidence                                                                         | Use in the planned work                                                                                                                                               |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP authentication and JWT sessions                               | `packages/socket/src/api/routes/auth.ts`, `services/auth.ts`, `docs/http-api.md` | Extend this system; do not copy the pre-REST socket authentication from an old fork.                                                                                  |
| Several in-memory games and a manager client attached to each game | `packages/socket/src/services/registry.ts`, `services/game/index.ts`             | Add persistent account ownership and isolation around the existing game engine. Multiple teacher accounts are not implemented merely because several games can exist. |
| Serialized question content and player answers in saved results    | `packages/common/src/types/game/index.ts`, `services/game/round-manager.ts`      | Preserve and identify the applied quiz version, rather than re-reading a quiz that may have changed.                                                                  |
| Quiz JSON import/export                                            | `docs/quiz.md`, existing manager/editor flows                                    | Retain portability and use the same validation when implementing copies and migration.                                                                                |
| Media storage and runtime branding                                 | `docs/branding.md`, `packages/web/src/branding.ts`                               | Add management UI and authorization around existing mechanisms; avoid hardcoded institutional branding.                                                               |

The current manager login still uses one `MANAGER_PASSWORD`. Quiz, result, and media lists are not partitioned by teacher. No account-management, ownership, private sharing, or dynamic branding administration was found in the reviewed upstream revision.

## Related work that is not an integrated feature

- [Issue #34: Multiuser support](https://github.com/Ralex91/Razzia/issues/34) is open and also requests OpenID/SSO.
- [Issue #169: User limitation and multiple managers](https://github.com/Ralex91/Razzia/issues/169) requests separate managers and quiz isolation. It is directly relevant to the training center.
- [PR #184](https://github.com/Ralex91/Razzia/pull/184) proposed accounts and organization-specific branding, but was closed without merging. It predates the current REST auth architecture and is background material, not an implementation to import wholesale.
- [Issue #174](https://github.com/Ralex91/Razzia/issues/174) requests read-only quiz previews. This overlaps with sharing, but does not provide account-level permissions or private class reports.
- [Issue #256](https://github.com/Ralex91/Razzia/issues/256) offers separate fork branches for mobile media dismissal, copying join links/larger QR information, audio control, and in-game settings. These are useful training-room candidates, especially projector-only audio, but were not integrated in the reviewed `dev`.
- [PR #257](https://github.com/Ralex91/Razzia/pull/257), improving mobile media dismissal, remained open. [PR #171](https://github.com/Ralex91/Razzia/pull/171), proposing text/order questions and Kahoot import, remained a draft. Do not describe either as released functionality.

## Decision

Adopt the current upstream foundation in a separate synchronization PR, then document the multi-user extension before writing authentication or migration code. Keep accounts/permissions, sharing/copying, and appearance administration as separate delivery units. Coordinate any future upstream proposal with the existing issues; this review does not claim maintainer endorsement or post messages on the user's behalf.

The POC was checked read-only and was still running `razzia-local:c6cbd3e`, with a healthy `/api/health` response. This planning work does not update the running instance. A later deployment must preserve its current credentials, quizzes, results, and branding, with a verified backup and rollback plan.
