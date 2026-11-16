# HOMESTAND architecture assessment (asymmetrical RTS expansion)

## What exists today

| Layer | File(s) | Shape | Notes for the expansion |
|---|---|---|---|
| Simulation | `src/engine.js` (one `Game` class, ~44 KB), `src/config.js` | Server-authoritative fixed-step (50 ms) simulation; 2400 × 1350 world; exactly two teams (`0` defence/Azure, `1` hostile/Crimson) | All validation already lives here: spending, construction, production, commands, IEDs. New systems must extend it rather than bypass it. |
| Shared data | `public/maps.js` (UMD: browser + CommonJS) | Map registry, the authored Safe Haven street plan, theatres, scenery blockers | The right home for anything both client and server must agree on (layouts, plots, build-area rules). |
| Server | `server.js` | Static files + one WebSocket endpoint; `rooms` map; `create` / `join` / action switch; 150 ms state broadcast; reconnect by stored player id; rematch via `start` | Rooms are capped at one human per team; join hard-codes team 1; the action switch is the only path from client to simulation (good for security). |
| Client shell | `public/game.js` (~105 KB IIFE) | Home, lobby, HUD, 2D tactical renderer, tutorial, results; sends intents only | Safe Haven HUD is gated by `safeMission()` in 22 places; the construction/production dock can be generalised into a "build mode". |
| 3D | `public/3d.js`, `public/town.js`, `public/home.js` | Three.js r180; town kit merges primitives per material; entity models are procedural groups | Town scenery reads one hard-wired layout; must take a layout id. Humans are primitive capsules — Milestone 5 needs rigged characters. |
| Audio | `public/audio.js` | Procedural WebAudio | No changes needed for M1. |
| Tests | `test/*.test.js` (node:test), `scripts/*-smoke.js` (Playwright) | Engine, rooms, renderer, IED suites | Every new mechanic gets engine tests; browser smoke per milestone. |

## Constraints and risks found

1. **Two hard-coded teams.** Many paths assume `team` ∈ {0,1}. Keeping exactly two *factions* (0 = Community Defence, 1 = Raiders) and adding a separate **role** field per participant (`commander`, later `civilian`) avoids a rewrite. Multiple players per faction (M3) attach to the same team with per-unit ownership.
2. **One human per team.** `addParticipant` rejects a second player on a team and `join` forces team 1. M1 lets the host choose a faction and gives the guest the free one; M3 lifts the cap.
3. **No fog of war.** Every snapshot sends every unit. Intelligence (M4) only makes sense once snapshots are filtered per team; the IED code already shows the pattern (`visibleMines(team)`).
4. **Straight-line movement.** Units steer directly to targets with separation; houses are not physical obstacles. M1 adds waypoint paths for AI routes; true road-graph pathing is an M4 item.
5. **Single-mission mode flags.** Safe Haven is wired through `missionId` / `training`. Territory War is added as a separate `scenario` with its own phase machine instead of overloading `training`.
6. **Monolithic client.** `game.js` is large; new client systems (territory HUD, chat, lobby roles) should be added as clearly delimited sections, and later split into modules when the PWA build lands (M5).
7. **Scenery tied to one layout.** `town.js` scenery helpers read `MAPS.layouts['safe-haven']` and several hard-coded coordinates. M1 makes the layout selectable and moves those coordinates into layout data.

## Integration plan

- **M1 (this change):** `frontier` map with two territories, construction plots, build-area rules shared through `maps.js`; HQ-based start with two engineers; structure catalogue with categories, tech requirements and supply; parallel construction with diminishing-returns assist; Territory War scenario with prepare (3 or 5 min) → 2 min warning → live phases and ceasefire; a faction-agnostic builder AI (`src/ai.js`) that can play either side; faction selection in the lobby. Safe Haven also gets two engineers, auto-assigned builders and the new prep/warning timers.
- **M2:** NPC civilian agents in the simulation (not just renderer crowds), civilian role, capture/escort/holding, rescue missions, projectiles that can hit civilians.
- **M3:** N players per faction with unit ownership, chat channels (rate-limited, never touching game state), pings and markers, restore on reconnect.
- **M4:** per-team snapshot filtering (fog), intelligence and countermeasures, raider-specific machinery, road-graph pathing.
- **M5:** PWA, landscape-first HUD, rigged human characters with LOD/instanced skinning, homepage and tutorial.

## Security posture

The client never decides outcomes: all new messages (`construct`, `assist`, `produce`, `phase`) are validated by the engine against faction, ownership, plot availability, build area, tech requirements, credits and supply. Room creation validates scenario, faction, prep length, difficulty and theatre against allow-lists.
