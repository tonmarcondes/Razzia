# Upstream review: 2026-11-12

Reference: upstream `dev` at `a073544` (read-only). The common baseline was `222168a`.

## Integrated changes

- `c4f9530`: npm dependency updates.
- `ce916bb`: pinned Node image update.
- `5ddaa4a`: GitHub Actions updates.
- `6f515b3`: Node 26 in the local toolchain, CI and container.
- `040e916`: replace Prettier with Oxfmt, including import and Tailwind ordering.
- `a073544`: move upstream unit tests into source `test/` folders.

These are maintenance changes, not new game modes. Import-order/format conflicts keep the fork's full authentication, authorization, game-stop and branding implementations. The fork's native mobile scrolling fix and Kahoot action layout remain in place. The lockfile merges upstream dependency versions with the fork's XLSX dependency; it is then installed frozen.

The E2E locale loader now selects actual language directories and JSON namespaces, so the new `locales/test` directory is never parsed as translations. Generated local-account fixtures are excluded from formatting. Technical documentation follows Node 26 and Oxfmt; historical review records are retained as dated records.

## Verification

Use Node 26.13.0 and pnpm 11.28.7. Required checks are frozen installation, Oxfmt, lint, build, all unit/integration tests, the complete legacy browser suite and the local-account browser scenario. Verify the actual Alpine runtime and account-storage integrity before deployment. No database schema or data migration is part of this update.

The supplied Portuguese question workbook (30 questions) and the freshly downloaded official Kahoot template were accepted by the actual adapter. The official sample was exported and read back with matching question text, alternatives, solutions and time. No real training workbook is committed.

A game-report XLSX is a different format. No real game-report sample or authenticated import into Kahoot was available during this review. Do not claim complete interoperability or historical-result import based on question-template tests.

Capacity testing and the comparison with Kahoot are documented separately, with synthetic data only.
