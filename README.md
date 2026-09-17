# Poker Polacco

A self-hosted multiplayer browser prototype for the Italian bluffing card game Poker Polacco. Two to six players share a private room, make increasingly strong declarations about the combined hidden card pool, challenge bluffs, gain cards after losses, and play until one player remains.

The presentation is a real React Three Fiber scene built from deliberately simple primitives. All rules and multiplayer authority live outside the 3D components, so placeholder meshes can later be replaced by GLB/GLTF assets without changing gameplay.

## Quick start for development

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Vite serves the client and proxies Socket.IO to the authoritative server on `http://localhost:3000`. Open a second browser, private window, or device to join the room.

Useful commands:

```bash
npm run dev          # client and server with live reload
npm run check        # TypeScript plus all automated tests
npm test             # tests only
npm run build        # production client and server bundles
npm start            # serve the built client and Socket.IO on one origin
```

For a local production check, run `npm run build`, set `NODE_ENV=production`, then run `npm start` and open `http://localhost:3000`.

Copy `.env.example` to `.env` when using Docker Compose or export the variables in your shell. The main settings are:

- `TURN_SECONDS` — authoritative turn timer, default 45.
- `RECONNECT_SECONDS` — reserved-seat grace period, default 60.
- `REVEAL_SECONDS` and `RESULT_SECONDS` — presentation phase durations.
- `ENABLE_DEBUG` — enables the public-state-only `/debug/rooms` route in non-production mode. It is always suppressed in production and never exposes hidden cards.

## How to play

Everyone begins with one hidden card. A declaration claims that a poker-style combination exists somewhere among all active players' cards together. On your turn, make a strictly higher declaration or call the previous player a liar. A challenge reveals the whole table:

- If the declaration is true, the challenger loses.
- If it is false, the declarer loses.
- A loss increases that player's next hand by one card.
- A player who loses while already holding five cards is eliminated.
- The last active player wins.

The in-game Cheatsheet explains every hand and highlights the current declaration category.

## The special ranking order

Poker Polacco intentionally does not use standard poker hand order. Lowest to highest:

1. Carta Alta — High Card
2. Coppia — Pair
3. Scala — Straight
4. Doppia Coppia — Two Pair
5. Tris — Three of a Kind
6. Full — Full House
7. Poker — Four of a Kind
8. Scala Reale — Royal Flush

In particular, `Straight < Two Pair < Three of a Kind`. Within a category, ranks determine strength. Two Pair compares its higher pair and then lower pair. Full House compares trips and then its pair. A–2–3–4–5 is the lowest Straight; 10–J–Q–K–A is the highest. Scala Reale means 10–J–Q–K–A in one suit, with no suit ranking.

Declarations that require more physical cards than are currently in play are unavailable, but players may bluff about any physically possible declaration.

## Architecture and privacy

```text
client/                  React HUD, screens, Zustand and 3D presentation
  game3d/                replaceable visual components and seat/camera anchors
server/
  game/GameRoom.ts       authoritative phase machine, turns, deals and timers
  rooms/RoomManager.ts   in-memory rooms and private per-socket synchronization
  socket/                validated Socket.IO commands
shared/
  game/                  pure cards, bids, evaluation and progression rules
  protocol/              Zod payload schemas
tests/                   rule and authoritative room-flow tests
```

The server shuffles and deals the deck. During bidding it broadcasts a sanitized public view containing identities, seats, card counts, phase, turn, and current declaration. Each socket separately receives only its own private cards. Opponent card identities are added to public state only during reveal/result. Clients can never submit card counts, turn owners, challenge truth, elimination, or winners.

All incoming room codes, nicknames, reconnect tokens, and bids are validated. Membership comes from the socket's server-side session—not a client-provided player ID. The server rejects out-of-turn and phase-inappropriate actions and rate-limits rapid commands. Reconnect identity uses a random private token stored in local storage; nicknames are not credentials.

Rooms and reconnect tokens exist only in memory. Restarting the app intentionally clears active matches.

The Leave room button is available in the lobby, during a match, and after the result. Leaving during a match immediately forfeits that player's seat; temporary connection loss still uses the reconnect grace period. When the host leaves, ownership passes clockwise to the next connected room member. An unfinished round is redealt after an active player leaves because the combined hidden-card pool has changed. Completed challenge results are preserved. Departed seats stay fixed for the rest of the match and are removed for a rematch or return to the lobby.

## Replacing the placeholder art

The replaceable boundaries are:

- `client/game3d/environment/Environment.tsx`
- `client/game3d/table/PokerTable.tsx`
- `client/game3d/characters/Character.tsx`
- `client/game3d/cards/PlayingCard.tsx`

Their current implementations delegate to matching `Placeholder…` components. Put future assets under a new `client/assets/models/` folder, implement GLTF-backed equivalents with the same props, and swap only those boundary components. Seat positions and rotations are centralized in `client/game3d/seats/seatLayout.ts`; the player camera is isolated in `client/game3d/camera/PlayerCamera.tsx`.

Animations are presentation only. They never advance or decide server state.

The current declaration is illustrated with cards in the center of the table. Rank-only bids show all four suit symbols to mean any suit; the Royal Flush uses a single-suit example, not a claim about a specific hidden suit. Hand cards stay in portrait alignment, pointing toward the center. A challenge slides every revealed hand onto the gold ring and outlines the server-identified matching cards in green.

The declaration builder uses clickable rank cards rather than dropdowns. Choose the combination, then click a rank. Full House has separate rows for the three-of-a-kind and pair; Two Pair has higher-pair and lower-pair rows. Straights are selected by their high card, with a five-card preview. Illegal raises and duplicate/incompatible ranks are disabled. On narrow screens each rank row scrolls horizontally, so Full House still has exactly two card rows.

Every screen has a bottom-right version marker. GitHub Actions embeds the commit ID in the Docker build, so a deployed release reads, for example, `v0.2.0 · abcdef1`. Local builds show `local`. Compare the seven-character ID with the successful GitHub Actions run to confirm an update reached the browser.

## Docker deployment on a Linux VPS

The provided multi-stage image builds the Vite client and Node server, installs only production dependencies in the final image, runs as the unprivileged `node` user, and serves the frontend and Socket.IO together on port 3000.

```bash
cp .env.example .env
docker compose up -d --build
docker compose ps
docker compose logs -f poker-polacco
```

Update and rebuild after pulling or copying new source:

```bash
docker compose up -d --build
docker image prune
```

Compose binds Node to `127.0.0.1:3000`, so it is not directly exposed to the internet. Run Caddy (or your existing reverse proxy) on the VPS and proxy your hostname to that address. Copy `Caddyfile.example`, replace `game.example-ddns.net`, and reload Caddy. Caddy handles the Socket.IO WebSocket upgrade automatically because HTTP and WebSocket traffic share one origin.

If Caddy runs in Docker on the same user-defined network, proxy to `poker-polacco:3000` instead and attach both services to that network. You may then remove the host `ports` mapping and use `expose: ["3000"]`.

Typical network path:

```text
Internet → DDNS hostname → router TCP 80/443 → Linux VM → Caddy → 127.0.0.1:3000 → container
```

Before going live:

1. Point the DDNS record at the router's current public IP.
2. Forward router TCP ports 80 and 443 to the Linux VM running Caddy.
3. Permit those ports in the VM firewall; keep port 3000 bound to loopback or the private Docker network.
4. Confirm Caddy obtained a TLS certificate for the DDNS hostname.
5. Open the HTTPS URL and test with two devices. HTTPS gives Socket.IO secure WSS automatically on the same hostname.

The Docker health check calls `/health`. Inspect runtime issues with `docker compose logs -f poker-polacco`. No database, Redis, external account, or serverless platform is required.
