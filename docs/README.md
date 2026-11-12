# 📚 Documentation

This folder covers the basic setup (config, quizzes, branding) as well as more advanced usage, like running behind a reverse proxy or building your own client.

- [Configuration](configuration.md): environment variables and the `config` folder.
- [Quiz](quiz.md): creating and structuring quizzes via `config/quizz/*.json`.
- [Branding](branding.md): optional custom theming via `config/branding/`.
- [Reverse Proxy](reverse-proxy.md): running Razzia behind Traefik, Nginx, Caddy, or another reverse proxy.
- [WebSocket Protocol](websocket-protocol.md): the player-facing event protocol, for building custom clients (e.g. a physical buzzer).
- [HTTP API](http-api.md): the `/api` surface — sessions, quiz and result CRUD, game creation.
- [Testing](testing.md): running and writing the unit, integration and e2e tests.

## Fork development

- [Agent instructions](../AGENTS.md): architecture, contribution conventions, verification and deployment rules for this fork.
- [Upstream review, 2026-10-29](upstream-review-2026-10-29.md): available changes, reusable capabilities and related proposals.
- [Multi-user design](multi-user-design.md): accounts, permissions, sharing and delivery gates; the original plan, with implementation status described in the local-account and isolation guides.

- [Account storage](account-storage.md): offline inventory, transactional migration and consistent backup tooling; offline storage foundation and tooling.

- [Local accounts](local-accounts.md): authentication, password policy and user administration.

- [Teacher isolation](teacher-isolation.md): private quizzes/results/media, simultaneous-class acceptance and controlled local-mode activation.

- [Upstream review, 2026-11-12](upstream-review-2026-11-12.md): Node 26, Oxfmt and test layout synchronization.
- [Acceptance and capacity, 2026-11-12](acceptance-and-capacity-2026-11-12.md): functional checks and the measured 300-player rehearsal.
- [Kahoot comparison](kahoot-comparison.md): implemented capabilities, differences and next product priorities.

Back to the [main README](../README.md).
