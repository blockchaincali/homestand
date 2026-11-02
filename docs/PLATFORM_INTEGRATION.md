# Platform integration (Vatar / Lagos Life)

HOMESTAND runs standalone on Railway and, unchanged, inside Vatar's Lagos Life Games app. The Vatar adapter follows the official developer docs (https://lagoslife.app/developers/docs, SDK `vatar-games-v1.js`). Gameplay stays server-authoritative; the platform layer never changes outcomes, and the standalone build keeps working without any partner script.

## How the game knows it is in Lagos Life

Register the game address with Vatar as `https://<host>/?host=vatar`. When the page is framed **and** carries `?host=vatar` (or the browser reports a Vatar ancestor origin), `public/platform.js` loads `https://lagoslife.app/sdk/vatar-games-v1.js` and calls `Vatar.init()`. If the SDK fails or refuses (`not_framed`, network), the game runs standalone.

## `window.HomestandPlatform` (`public/platform.js`)

| Member | Standalone | In Lagos Life |
| --- | --- | --- |
| `id` | `'standalone'` | `'vatar'` once `init()` resolves |
| `framed` | `false` | `true` |
| `player()` | Typed name, `verified:false` | `{id, name, avatar, verified:true}` from `Vatar.init()`; the name field becomes read-only |
| `capabilities` | accounts/leaderboards off; install, fullscreen, clipboard on | accounts + leaderboards on; install, fullscreen, clipboard off |
| `submitScore(n)` / `leaderboard()` | no-ops | `Vatar.submitScore` / `Vatar.leaderboard` |
| `on('pause' \| 'resume' \| 'identity')` | never fired | from `Vatar.onPause` / `onResume` / `init` |
| `emit(event)` | `launch`, `battle-start`, `battle-end` | same |

## Behaviour inside the frame

- **Framing:** every HTML response sends `Content-Security-Policy: frame-ancestors 'self'` plus the five Vatar origins; no `X-Frame-Options`. `FRAME_ANCESTORS_EXTRA` adds origins for a local test harness only.
- **Pause:** `onPause` suspends audio and, for a match with exactly one human, sends `{type:'pause'}`: the server stops stepping that room. `onResume` (or reconnecting) resumes it. Co-op and versus never pause.
- **Not used when framed:** service worker, install prompt, fullscreen and orientation lock, clipboard (room codes are shown instead).
- **Leaderboard:** each finished match submits one whole-number score: `(win 1000 | loss 150) + 150 × stars + 6 × kills + civilian score`, × 1 / 1.5 / 2.2 for Easy / Standard / Veteran. Civilian score: defence +20 per resident still free, +60 per rescue, −40 per resident killed by your fire; raiders +40 per resident seized. The board keeps each player's best. The Missions page shows the top 10 and your rank.
- **Identity data:** only the pseudonymous per-game id, display name and avatar (Developer Agreement §8). Nothing else is requested or stored server-side.

## Lagos Life edition (softer content)

Inside Lagos Life (or with `?edition=lagoslife` to preview anywhere), the game runs the **Lagos Life edition**. Gameplay is identical; only what players read changes:

| Standard build | Lagos Life edition |
| --- | --- |
| Real cities and districts (Abuja, Kano, Maiduguri, Nyanya, Baga …) and streets named after real people | Fictional towns (Kauna, Birnin Kasuwa, Garin Haske, Gidan Ruwa …) and generic street names |
| IED / bomb / charge | Trap |
| Raiders seize civilians, captives held at the raider camp, ransom | Raiders cut residents off, residents stranded behind raider lines, toll |
| Civilian casualties / killed | Injuries / injured |

The server stores the edition with the room (`create` → `edition`), so every event, facility name and result line is softened at the source; the client softens its own menus, HUD and toasts. Mapping lives in `public/maps.js` (`FICTION`, `SOFT`, `soften`, `theatre(id, edition)`); `test/edition.test.js` checks no real place name survives.

## Portrait phones

At phone width in portrait (Vatar tests at 375 × 812, no fullscreen) the battle works upright: no rotate prompt, the build menu and building controls open as bottom sheets above the command bar, and the ready banner leaves room for the camera buttons.

## Not built yet (waiting on Vatar's answers)

- Purchases (`Vatar.purchase`) and the server `/claim` + webhook. If added, cosmetics only, never gameplay advantage.
- `Vatar.match` for multiplayer; rooms currently use HOMESTAND's own server and 4-letter codes.
- Any further content changes Vatar requests under Agreement §4.
