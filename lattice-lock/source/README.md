# Lattice Lock: Crystal Defender

A 3D tower-defence / materials-physics puzzle for GCSE and A-Level Chemistry (AQA, OCR, WJEC structure & bonding).
Defend the core crystal with barrier towers built from real lattices. Each barrier responds to thermal, electrical,
shear and solvent attacks exactly as its structure and bonding predict. Every outcome is explained in mark-scheme
language in the **Spectroscopy / Failure Log**.

```bash
npm install
npm run dev          # game at http://localhost:5173 (proxies /api to the scoreboard)
npm run dev:server   # scoreboard API at http://localhost:8787 (second terminal)
npm run build        # typecheck + production bundle in dist/
npm start            # production: one Node process serves dist/ AND the scoreboard API
npm run test:shared  # name-filter, scoring and wave-data consistency checks (Node ≥ 22.18)
```

Without the scoreboard server the game still works: scores are kept on the device and the
scoreboard shows "offline".

## Controls
**Desktop:** click a lattice, then a free tile · drag to orbit · scroll to zoom · `1`–`9` quick-select ·
`Space` launch wave / pause · `I` inspect · `U` upgrade · `Esc` cancel / pause menu.

**Touch (phones & tablets):** tap a lattice in the tray, tap a tile to preview, tap again (or **Build**) to
confirm · one-finger drag orbits · pinch zooms · tap a barrier for upgrade / inspect / reclaim · the
scroll icon opens the Failure Log (new entries also pop up briefly).

Layouts: **desktop** (≥1100×640) side panels · **portrait** bottom tray, board rotated upright ·
**landscape** (phones sideways, small tablets) left rail. Safe-area insets, a PWA manifest
(Add to Home Screen = full screen on iOS) and auto-pause when the app is backgrounded are included.

## Settings, audio & music
Settings (BGM volume, SFX volume, mute, full screen, graphics Low/High) persist per device.
Background music is two instrumental tracks in `public/audio/` ("Crystal Build" for menus and
the build phase, "Lattice Under Siege" for combat), generated with Suno on the Alchemix Pro plan
and re-encoded to 112 kbps MP3 (~2 MB each). `src/engine/music.ts` streams them through `<audio>`
elements into Web Audio, so playback runs off the main thread and can't stutter when the 3D scene
is busy. Each track loops with a 4 s equal-power crossfade, build/combat crossfade with the game
phase, and menus/defeat use a low-pass filtered version of the build track.

## Online scoreboard & safety

**Live:** the global scoreboard runs on Cloudflare as the Worker `lattice-lock-scores`
(`worker/`, D1 database `lattice-lock-scores`) at
https://lattice-lock-scores.lattice-lock.workers.dev. `npm run build:alchemix` points the game at it.

```bash
npm run worker:dev            # local Worker + simulated D1 on :8787 (dev server proxies /api to it)
npm run worker:migrate:local  # create local tables (first time)
npm run worker:deploy         # deploy changes (needs `npx wrangler login`)
npm run worker:migrate        # apply new migrations to the live database
npx wrangler secret put ADMIN_TOKEN --config worker/wrangler.toml   # enable DELETE moderation
npx wrangler d1 execute lattice-lock-scores --remote --config worker/wrangler.toml \
  --command "SELECT id, name, score, created_at FROM scores ORDER BY score DESC LIMIT 20"
```

To allow another site to use the API, add its origin to `ALLOWED_ORIGINS` in `worker/wrangler.toml`
and redeploy. The Node server below is an alternative for self-hosting; both share the same rules.
`server/index.mjs` is a zero-dependency Node server (JSON file storage in `server/data/`).
- **Name filter** (`shared/nameFilter.js`, enforced by client *and* server): profanity and slurs with
  leetspeak, accent and stretched-letter normalisation, Scunthorpe-safe whole-word handling,
  personal info (phone numbers, URLs, emails), social-media/contact keywords and impersonation
  (admin, teacher…). The list is base64-encoded and rejection messages are deliberately generic.
  Players can roll a safe random alias.
- **Score integrity**: the server recomputes the score from the run summary and rejects implausible
  runs (`shared/scoring.js`); each run can only be submitted once; 5 submissions per IP per minute.
- **Moderation**: set `ADMIN_TOKEN` and `DELETE /api/scores/<id>` with `Authorization: Bearer <token>`.
  Tightening the filter also removes matching old entries the next time the server starts.

Env: `PORT` (8787), `DATA_DIR`, `ALLOWED_ORIGINS` (CORS, default `*`), `ADMIN_TOKEN`, `TRUST_PROXY=1`
behind a reverse proxy, `SERVE_STATIC=0` for API-only. Point a separately hosted game at it with
`VITE_SCOREBOARD_URL=https://scores.example.org` at build time.

## Arcade hub integration
**Quit to Arcade** (main menu and pause menu) tries, in order:
1. Embedded in an iframe → `parent.postMessage({ type: 'arcade:quit', game: 'lattice-lock' })`
2. Opened with `?hub=<url>` → navigates there (same-origin, or listed in `VITE_ARCADE_HUB_ORIGINS`)
3. `VITE_ARCADE_HUB_URL` set at build time → navigates there
4. Otherwise `history.back()`

At the end of each run an embedded game also posts `{ type: 'arcade:score', game, score, summary }`.

## Architecture
| Path | Role |
| --- | --- |
| `src/types/chemistry.ts` | Domain types: lattices, unit cells, threats, interaction results, runtime state |
| `src/data/lattices.ts` | 11 lattices, each with physical properties and procedural unit-cell builders (rock salt, diamond cubic, graphite/graphene, FCC Cu, BCC Fe/steel, ice Ic, I₂, poly(ethene)) |
| `src/data/waves.ts` | 7 threat specs and 10 waves, each with a briefing and an examiner hint |
| `src/engine/damageCalculator.ts` | Resolves threat vs. bonding properties. Returns damage multipliers, slow, status effects and the mark-scheme rationale |
| `src/engine/waveManager.ts` | `GameEngine`: spawning, pathing, targeting, hydration, graphitisation, marks, win/loss |
| `src/engine/map.ts` / `audio.ts` / `music.ts` | Lane geometry; synthesised SFX; generative soundtrack |
| `src/engine/settings.ts` | Persisted player settings (volumes, mute, quality) |
| `src/services/*` | Scoreboard client (with on-device fallback), arcade-hub bridge |
| `shared/*` | Name filter + scoring rules used by both the browser and the server |
| `server/index.mjs` | Scoreboard API + static hosting |
| `src/components/canvas/*` | R3F stage, instanced unit-cell renderer (coordination polyhedra, electron seas), threat visuals |
| `src/components/ui/*` | Splash/menus, settings, scoreboard, shop, inspector, failure log, touch HUD |

## Teaching mechanics
- **Ionic** (NaCl, MgO): block arcs while dry. Shatter under shear because like charges are pushed together. Dissolve in polar
  jets and then *conduct* (hydrated status). MgO has double the thermal durability of NaCl.
- **Diamond**: the hardest barrier and the best heat sink, and it insulates. Under sustained plasma it **graphitises** (sp³ → sp²) and turns into a graphite tower.
- **Graphite**: grounds arcs and deflects glancing blows, but cleaves under parallel shear. Upgrades to **graphene**.
- **Metals**: ground arcs and deform rather than shatter. Iron rusts. Alloying **iron → steel** pins the slip planes.
- **Simple molecular** (ice, I₂, poly(ethene)): cheap insulators against low-voltage sparks. They vaporise in heat because only
  intermolecular forces are overcome, not covalent bonds.

The headless balance sim used during development lives outside the repo. To reproduce it, bundle a script that imports
`engine` with esbuild and call `engine.update(dt)` in a loop.
