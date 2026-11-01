# Stopping an active class

A hosting teacher or administrator can choose **Stop game** during the opening countdown, question, response review or leaderboard. Confirmation ends that class for every participant, removes its PIN and returns the host to manager settings. Cancel keeps the game running. This is an irreversible end, not pause/resume. No partial report is generated; completed reports remain untouched. The confirmation states this limitation.

The existing validated Socket.IO manager contract adds `manager:stopGame` with a game ID. The backend checks the current manager role/session and exact hosting client, so another teacher, another login of the same account and a player cannot stop that class. It cancels auto-advance and question timers, prevents delayed continuations from publishing another status or report, removes the game from the registry and notifies its room. Ordinary network disconnect/reconnect behavior is unchanged.

In local-account mode, the existing game-run row is marked ended and a `game.stop` audit record attributes the action to its actual host/session. Snapshots and historical rows are retained. No database migration is required. Participants lose access to that game's private media capability after registry removal.

Unit and socket tests cover cancellation during opening/active question, absence of late status/report writes, host-only stop, participant notification and PIN invalidation. Browser tests exercise confirmation/cancel and a local-account class without changing completed report counts.
