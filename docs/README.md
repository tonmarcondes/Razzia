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
- [Multi-user design](multi-user-design.md): accounts, permissions, sharing and delivery gates; account activation remains pending.

- [Account storage](account-storage.md): offline inventory, transactional migration and consistent backup tooling; local accounts remain disabled.

- [Local accounts](local-accounts.md): authentication, password policy and user administration, still behind the isolation release gate.

Back to the [main README](../README.md).
