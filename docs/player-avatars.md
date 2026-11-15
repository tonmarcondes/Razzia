# Player avatars

Avatars are optional per live game. In game settings, enable **Allow player avatars** and choose a creation window of 10–180 seconds (default 60). The default for new games is disabled. This is separate from generated nicknames: either nickname mode works with avatars.

After submitting a nickname, the player can edit an original block-style chest-up character, randomize it, confirm it or immediately join with a random avatar. Eight groups organize skin/ears, skin details, eyebrows, eyes/glasses/shadow, mouth/lipstick, hair, clothing/badge and accessories. The catalog includes pilot, chef and nursing hats, yellow hard hat, beanie, balaclava, straw/Panama/Santa hats, crown, headphones, gold chain, stethoscope, earrings, tools and recreational items. All catalog options are available; there is no rarity or payment system.

## Timing and validation

The existing authenticated join endpoint is two-phase only when enabled. The first request reserves a server-clock deadline and a random default for that client/game; repeated requests do not reset it. Responses include server time so browser-clock offsets do not extend the window. Nickname and pending choices survive a page reload in session storage; the server remains authoritative. Countdown expiry submits the original random default automatically instead of applying unconfirmed edits. The random model has no gender field or gender-specific body variants.

The second request uses `avatarReady: true`. Before expiry it may carry a strictly validated avatar selection; after expiry the server ignores that selection and signs the reserved default into the normal join ticket. Invalid catalog values, unknown avatar fields and image URLs are rejected. The socket consumes only the signed ticket. Disabled games ignore otherwise valid avatar selections and retain the previous entry flow.

The game keeps at most 1,000 pending/reserved avatar records, scoped by authenticated client ID and discarded with the game. This is an in-memory resource bound, not a license policy. Network/server failures receive bounded retries; the expired editor also offers a retry button. A closed/offline device cannot join until it reconnects and resumes. Host locks, ended rooms and access rules always take precedence. Teachers should wait for students to appear in the room before starting.

## Rendering and retention

The browser draws small original SVG layers using enumerated choices. No image-generation service, player upload or paid API is used. No official game artwork or organization logo is bundled. Uniform patches use the instance's configured public logo, if any; defaults use a generic mark. Hat/hair/handheld components are separate so new catalog items remain manageable.

Avatars appear in the teacher's lobby, the player's waiting screen, leaderboards and podium. Server player records preserve them on reconnect; optional fields in final player results preserve them with completed reports. Existing quizzes, reports and join tickets without an avatar remain compatible. There is no database schema change, new account identity or avatar persistence beyond the existing game/report lifecycle.

Portuguese and English catalog labels are supplied. Other existing locale namespaces keep matching keys with English labels for this new feature, pending native translations.

## Verification

Unit/API tests cover strict payloads, all catalog choices, creation-window bounds, fixed deadlines, expired fallback, signed selections, server player records and disabled mode. Browser scenarios cover mobile editing, draft reload, participant reconnection, ranking, persisted final avatars and automatic entry with generated nicknames after an actual ten-second window. The ordinary functional and account-isolation suites remain required. Capacity rehearsal uses synthetic classes and the production image, separately from live POC data.
