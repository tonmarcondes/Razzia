# Acceptance and capacity review: 2026-11-12

## Revision and environment

Application source `f1d07b252497452dfc12e77d11db1bebc0d351e0`, merged into fork `dev` through PR #19. The container image is `razzia-local:node26-f1d07b2`; its image ID and sanitized measurements are in [the measurement record](validation/capacity-2026-11-12.json). Builder: Node 26.13.0, pnpm 11.28.7. Actual Alpine runner: Node 26.12.1.

The rehearsal used separate containers and fresh synthetic local-account databases, restricted to 2 CPUs, 1 GiB RAM and 256 processes. The generator ran on another computer, using a loopback-only port through an SSH tunnel. The live POC received no load traffic. Production configuration, accounts, quizzes and reports were not mounted into the capacity containers.

## Functional acceptance

- Frozen dependency installation, Oxfmt, lint and build passed.
- 305 unit/integration tests passed under Node 26.
- All 57 legacy browser scenarios and the local-account scenario passed. These include touch scrolling in portrait/landscape, single/multiple answer submission, XLSX review/import/export, media, explanations, reports, two simultaneous classes and revocation.
- A separate private rehearsal completed the supplied 20-question EWIS quiz with a mobile browser. All 20 presenter explanations appeared and were preserved in the final one-player report, with all 20 answers correct. No supplied training content was committed.
- The supplied adapted Portuguese XLSX imported 30 questions; the current official template also imported. The official sample's export/import round trip preserved question text, alternatives, solution indices and supported time values.

Real game-report XLSX import and acceptance by the signed-in Kahoot product remain unverified. The available supplied XLSX is a question workbook, not a game report.

## Capacity workload and results

Each stage used one host per class and 30 anonymous authenticated player sessions per class. Every class completed ten single-choice questions. Setup created synthetic teacher accounts sequentially; this does not benchmark simultaneous password logins. WebSockets remained connected through lobby, answers, rankings and final reports. At the 300-player target, all 310 sockets also remained connected during a 60-second pre-game hold.

| Classes | Players | Sent / persisted answers | HTTP p95 | Join p95 | Answer-to-result p95 | Sampled peak RAM |
| ------- | ------- | ------------------------ | -------- | -------- | -------------------- | ---------------- |
| 1       | 30      | 300 / 300                | 392 ms   | 610 ms   | 1,087 ms             | 75.12 MiB        |
| 5       | 150     | 1,500 / 1,500            | 325 ms   | 551 ms   | 1,045 ms             | 78.96 MiB        |
| 10      | 300     | 3,000 / 3,000            | 324 ms   | 484 ms   | 1,346 ms             | 83.47 MiB        |

All three valid stages had zero HTTP errors, unexpected socket disconnects or game errors. Each teacher saw exactly one report with 30 players, ten questions and only that teacher's synthetic student-name prefix. Every expected answer was present and correct in storage. PINs were unique across concurrent rooms.

The longest valid stage lasted 169.9 seconds, including setup, hold, question-reading phases and reports. Sampled peak CPU was 96% of one logical CPU at the target stage; the container allowance was two CPUs. Docker statistics include setup/password work and are sampled peaks, not instantaneous maxima. The sanitized record retains the full aggregate metrics and harness hash.

Answer-to-result measures client emission until reception of the result event. It includes the class/game flow and its deliberate transition delay, not just network round-trip or server acknowledgment. Join time includes player session issuance, join-ticket creation, WebSocket connection and successful game entry.

## Scope of the capacity conclusion

The requested 10 classes / 300 players passed this bounded backend rehearsal. This is not an unlimited-capacity, sustained-production or full-device certification. It did not measure 300 rendered browser UIs, real mobile/Wi-Fi loss, video/audio bandwidth, browser fallback transports, a login storm or hours of operation. The measured stage used synthetic text questions, WebSocket transport, local mode and the default game timing speed.

Use a monitored real-class pilot before institutional rollout at the full target, especially when media or constrained networks are involved. Persistent courses/classes, learner identity across sessions, data retention and SSO remain separate product/operational work.

## Publication and rollback

The Node 26 image was published to the POC after verification. The complete config, environment and Compose definition were backed up, with a separate consistent SQLite backup. A restored copy passed account-storage integrity/readiness checks in a networkless container before replacement. The previous `razzia-local:mobile-scroll-1529191` image was retained. No schema migration was required; runtime branding and private deployment settings were preserved.

A rollback changes the Compose image back to that previous compatible image and recreates only the application service. Do not overwrite newer user data with the backup as part of a routine image rollback.

See [the Kahoot comparison](kahoot-comparison.md) for implemented differences and product priorities.
