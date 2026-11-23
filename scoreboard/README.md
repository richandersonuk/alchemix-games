# Alchemix Arcade — global scoreboards

One Cloudflare Worker + D1 database serves every game's leaderboard. Each game has its **own,
separate** boards.

Live API: https://lattice-lock-scores.lattice-lock.workers.dev

| Game | Board(s) | Endpoint |
|---|---|---|
| Bondlatro (Godot) | main; meta `ante` 1–20, `mode` `STANDARD`/`CHALLENGE` | `/api/games/bondlatro/scores` |
| Lattice Lock | main | `/api/scores` (server recomputes the score from the run summary) |
| Orbital Blitz (`econfigs`) | `BLITZ`, `GAUNTLET`, `DAILY-YYYY-MM-DD`; class code = `tag` | `/api/games/econfigs/scores` |
| QAD | main | `/api/games/qad/scores` |
| Science Saviour | main | `/api/games/science-saviour/scores` |
| Subatomic Sorter (Godot) | main | `/api/games/subatomic-sorter/scores` |
| Titration Rush (Godot) | `SOLO-GCSE`, `SOLO-KS3`, `COOP-GCSE`, `COOP-KS3`, `CAREER` | `/api/games/titration-rush/scores` |

- `worker/src/rooms.js` — online co-op relay: a Durable Object per 4-letter room code at
  `GET /api/rooms/:CODE/ws?role=host|guest` (WebSocket). It pairs one host with one guest and forwards
  their messages; used by Titration Rush. Idle rooms hibernate and cost nothing.
- `client.js` — tiny browser helper the web games load (`<script src="/scoreboard/client.js">`).
- `worker/` — the Worker. Per-game rules (score caps, allowed boards, whitelisted display fields)
  are in `worker/src/games.js`. Player names (and class codes) go through the shared safety filter
  in `lattice-lock/source/shared/nameFilter.js`. No IP addresses are stored; rate limiting uses a
  daily-salted hash kept for an hour.
- Games keep an on-device copy and fall back to it when the scoreboard can't be reached.

## Deploy / maintain (needs `npx wrangler login`)

```bash
cd scoreboard/worker && npm install
npm run dev            # local Worker + simulated D1 on :8787 (run `npm run migrate:local` first)
npm run migrate        # apply new migrations to the live database
npm run deploy         # deploy Worker changes
npx wrangler secret put ADMIN_TOKEN    # enables DELETE …/scores/<id> with "Authorization: Bearer <token>"
npx wrangler d1 execute lattice-lock-scores --remote \
  --command "SELECT game, board, name, score, created_at FROM game_scores ORDER BY created_at DESC LIMIT 20"
```

To add a game: add its rules to `worker/src/games.js`, deploy, then call `ArcadeScores.submit()` /
`ArcadeScores.top()` from the game. To allow another website, add its origin to `ALLOWED_ORIGINS`
in `worker/wrangler.toml` and redeploy.
