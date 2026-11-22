# CODEX MASTER IMPLEMENTATION BRIEF — HOMESTAND v1: Competition Edition

## Mission
You are the lead implementation engineer and game UX specialist for **HOMESTAND**, an original, browser-based, real-time strategy (RTS) game competing in Handshake × OpenAI's **Create a Multiplayer Game** mission.

**Repository:** https://github.com/blockchaincali/homestand  
**Current deployment:** https://homestand.onrender.com  
**Separate unrelated project:** NEON HEIST, hosted from `blockchaincali/blindspot-multiplayer`. **Never modify NEON HEIST.**

**Your job is to IMPLEMENT, test, document, and prepare HOMESTAND v1 for deployment—not merely suggest a plan.** Begin by inspecting the actual repository and reproducing the current game. Work incrementally and preserve a working deployment. If you lack deployment credentials, finish changes in a testable branch/PR and explain the exact deployment action needed. Do not falsely report deployment or browser testing.

**Creative direction:** An original, stylish near-future strategy game with the excitement and visual legibility of polished mobile RTS titles. Reference screenshots from Art of War establish an *ambition for visual fidelity and cinematic combat*, not permission to reproduce any copyrighted art, characters, factions, iconography, UI layouts, sounds, or branding. Create a distinct visual identity, environments, faction silhouettes, and UI.

**Hard deadline:** Public challenge advertises October 31, 2026. We aim for a feature freeze by October 28, final QA by October 29, and submission readiness by October 30. Verify the legal contest rules and exact cutoff/time zone inside the entrant's Handshake account; do not assume the promotional date overrides official rules.

## Definition of success
A first-time player on a phone or laptop can open the URL, tap **Play vs AI**, understand the game and issue a useful first order within 20–30 seconds, follow a guided 60–90-second introduction, win an appropriately balanced Recruit match, and replay. Two human players must be able to create/join a room with a short code, play a synchronized 1v1 match without signing in, recover from an ordinary network interruption, and rematch. Everything should remain readable and responsive in desktop and mobile browser landscape modes.

Game scope is deliberately narrow: **one unforgettable battlefield, two original factions, three clearly differentiated units, three relay objectives, one cinematic ultimate/strike mechanic, and two modes (AI and private online 1v1).** Do not expand into a world map, global clan system, 2v2, persistence/accounts, meta-economy, skins shop, or campaign unless all core gates are already met and time remains.

## Current architecture: inspect, don't assume
Known pieces at time of brief:
- Node.js HTTP + `ws` WebSocket room server, repository `server.js`; Render single-instance service.
- Server-authoritative deterministic-ish simulation in `src/engine.js`, supporting teams, recruitment, unit combat, neutral relays, resources, orbital strike, win conditions, and AI difficulty `recruit/standard/veteran`.
- Current browser client `public/game.js` with dense DOM/HUD and both tactical and 3D views; `public/3d.js` built on `three@0.180.0`; `public/style.css`, `public/3d.css`, `public/index.html`.
- Legacy bootstrap `boot.js` extracts a compressed `source.bundle.b64` and patches part of `server.js` at runtime. **This is a maintainability/reproducibility risk.**
- Existing tests in `test/` including `test/difficulty.test.js`, `test/engine.test.js`, `test/rooms.test.js` (verify actual paths).
- Production hosting: `homestand` Render free web service; one replica because rooms are in memory. No changes to existing service configuration unless necessary and documented.

FIRST: audit Git tree, build and run scripts, static serving, asset paths, module loading, WebSockets, reconnects, game-state data contract, current controls, mobile layout and known race conditions. Document baseline behavior/screenshot, run `npm install && npm test`, and open the local app with browser automation. **Normalize the source layout** by making checked-in, editable source authoritative; remove the runtime source patching/unpacking dependency safely, while preserving all existing game behavior and a clean `npm start` and `npm test`. Keep back-out instructions and a working branch. Avoid a rewrite of the simulation/network layer.

## Workstream A — beginner-first UX (P0)
Build a cohesive responsive user journey, not additional scattered panels.

**A1. Home/start screen:** prominent `Quick Battle vs AI` primary CTA, `Play With Friend` (room code) secondary CTA, `How to Play` and settings. Difficulty appears as three clearly explained cards: `Recruit — learn & win`, `Standard — balanced`, `Veteran — tough`. Recruit default for first-time users. No registration. Brief estimated match length. Tell player which color is theirs. Original key art and a concise one-sentence game objective: "Capture the relays. Build your squad. Take down the enemy HQ."

**A2. Interactive onboarding (60–90 sec, skippable):** 5 contextual steps within live gameplay: (1) camera + your HQ, (2) recruit a Rifle Squad, (3) tap/click to select a unit, (4) tap/click relay to send unit to capture, (5) defend your relay or deploy an orbital strike; finish with an optional "You're ready" CTA. Each step should highlight the actual interaction target and advance only when the corresponding game action succeeds. Offer `Skip tutorial`, `Replay tutorial` and a permanent compact `?` help. Save only non-sensitive completion state locally. Do not artificially block the match, create duplicate orders, or desync the server.

**A3. Input clarity:** on desktop support click to select and right-click to move/attack, but **also provide a beginner-safe left-click / tap pathway**: tap unit to select, then tap destination/enemy to issue context-sensitive move/attack/capture order. A selected unit shows prominent outline, selection count, destination marker, and a clear action state. On touch, provide drag/pinch to pan/zoom without accidentally ordering; distinguish tap from drag by a movement threshold. Add a visible `Select All` action, one-tap training buttons, optional keyboard hotkeys, and a responsive `Deselect`/`Cancel` affordance. Add useful labels/tooltips and on-screen feedback when an action is invalid (insufficient credits, supply cap, cooldown, blocked path).

**A4. Minimal HUD:** keep battlefield at least ~65% of gameplay viewport on 1366×768 desktop and readable on 390×844/mobile landscape. Primary top bar: credits, supply, 1 victory progress indicator, time, team. Compact objectives/missions in a corner. Bottom contextual unit tray: 3 unit cards with cost, role and counter (Rifle: capture/general, Tank: frontline, Rocket: anti-armor). Hide advanced commands unless a unit/group is selected. Minimap collapses to a compact widget on small devices. Clear at-a-glance faction/enemy/neutral iconography beyond color alone. Provide always visible `2D tactical map` escape hatch if WebGL is unavailable.

**A5. Explain winning:** one visible mission strip with "Capture 2/3 relays" and "Enemy HQ 1500 HP", contextual tips based on actual state, non-blocking error/success toasts, clearly animated capture status, end-of-match results (win/loss, who won, time, useful stat highlights, and `Play Again` or `Rematch`). No empty-screen dead ends.

## Workstream B — cinematic but performant visual system (P0/P1)
Replace the toy-block aesthetic with **original cohesive RTS art**, while keeping real-time strategy readability. Use Three.js rendering and actual 3D mesh/material/texture/environment lighting. A gorgeous static promotional image alone does not satisfy this requirement.

**B1. Visual bible:** write a short `docs/ART_DIRECTION.md` specifying a distinctive science-fiction coastal frontier: warm desert/coast terrain, cool Azure alloy army, ember-orange Crimson army, weathered metal, strong 3/4 isometric camera, dramatic directional light, subtle fog of war, clear game-grid movement paths. Use supplied Art of War screenshots only to benchmark visual *quality*, not to trace/copy.

**B2. Asset pipeline:** replace primitives with original low-/mid-poly GLB/GLTF models for: 2 faction HQ silhouettes, 3 unit classes × 2 faction colorways, one relay tower, 2 defensive assets, 4 natural props (rocks, palms/trees, crates, debris). Prefer reproducible Blender-generated assets or reputable CC0/permissively licensed assets with license and source recorded in `ASSET_CREDITS.md`. No hotlinked external textures/assets at runtime. Keep assets compressed, geometry instanced/pooled, reasonable texture sizes. If custom Blender production isn't possible, deliver consistently authored stylized mesh assemblies instead of misleading claims of AAA visual fidelity.

**B3. Battlefield:** readable landscape terrain with path/road junctions, distinct base footprints, physically coherent props, believable materials, baked shadows or efficient real-time shadowing, ambient occlusion/contrast, gentle animated water/coastline if budget permits. Visible unit state and selection overlays must remain stronger than explosions.

**B4. Combat VFX:** projectile trails, muzzle flashes, shell impacts, a restrained particle/smoke pool, tank recoil/movement dust, hit flashes and health bar reactions, relay takeover pulse, and an impressive but short cinematic orbital strike. VFX reflect authoritative events (do not make up damage or server state). Camera shake and bloom should be optional/reduced-motion compatible. Avoid full-screen visual clutter. Add muted-by-default or user-controllable lightweight licensed SFX only if stable.

**B5. Camera:** default compelling 3/4 RTS framing showing important objectives; orbit limited to avoid upside-down play, wheel/pinch zoom clamped, drag pan, reset-camera button, follow-selection/focus objective control. Make visual focus predictable after selections and major events.

**B6. Performance/fallback:** 60 FPS target on normal laptop, >=30 FPS on representative midrange mobile, no fatal console errors, no frame-stalling effects. Use instanced meshes, LOD, disposal of Three resources, throttled snapshots and texture budgets. Add a quality toggle and fully functional 2D fallback. Gracefully handle WebGL context loss and unavailable GPU. Measure rather than claim.

## Workstream C — compelling fair gameplay (P0)
- Keep one match approximately 4–7 minutes for ordinary AI play, with a fast first action and regular encounter feedback. Do not unnecessarily lengthen the 1v1 mode.
- Recruit should give player a brief safe opening (see existing difficulty logic); test scripted newcomer path. Target a *directionally forgiving* game, not guaranteed win: in repeated scripted Recruit scenarios, player should be able to take and hold a relay before enemy snowballs. Standard balanced, Veteran aggressive, with meaningful explanation.
- Give each of the three unit classes a visibly different movement/combat role and show one icon/short line telling beginners when to use it. Ensure fair damage and resource economy; disable impossible/unaffordable commands with explanation.
- Make strategic relays consequential with distinct battlefield feedback; optionally one memorable choice: controlling center relay powers a dramatic **Signal Surge**, a short tactical buff/cooldown accessible to both sides, but add only if the core loop is polished and testable.
- Preserve server-authoritative damage, income, unit spawning, victory and room state; clients send intents, never arbitrary authoritative coordinates or scores. Keep message validation, per-client throttling and disconnect resilience.
- Preserve a replayable 1v1 human experience, join code sharing and no signup. Host disconnect or refresh should not leave a permanent unplayable room. Ensure both sides see consistent captured relays, health, resources and result; test two browsers concurrently.

## Workstream D — reliability, testing, deployment and submission (P0)
- Introduce small pure systems/components incrementally with regression tests. Prefer focused commits/PRs: `foundation/refactor`, `beginner-onboarding`, `visual-3d`, `combat-polish`, `submission-qa`. Avoid mixing unrelated redesigns.
- Make `npm test` work in a fresh clone with no hidden prior extracted files. Add tests for AI difficulty, room creation/join/leave, rejoin/reconnect, player action permissions, capture points, server authority, round end/rematch, 2D fallback, and post-round cleanup.
- Add Playwright (or equivalent) E2E smoke coverage: load homepage, start Recruit AI, recruit one unit, issue command, capture relay in a feasible test game, return to menu/rematch; two different browser contexts create/join a room and see synchronized state. Include desktop 1366×768, phone 390×844 and landscape phone 844×390 tests, and capture actual screenshots.
- Audit HTTP static paths and MIME types, module imports for `three.module.js`/`three.core.js`, CSP if applicable, and Render build output. Avoid security/privacy pitfalls and accidental file exposure. `GET /healthz` returns 200 JSON, game page 200, WebSocket upgrades work.
- Produce `docs/IMPLEMENTATION_NOTES.md`, `docs/QA_REPORT.md`, `docs/ART_DIRECTION.md`, `docs/ASSET_CREDITS.md`, `docs/DEMO_SCRIPT.md`, and `docs/SUBMISSION_CHECKLIST.md` with accurate evidence. Document any bug not fixed and fallback instructions.
- Do not blindly deploy to production until tests and smoke test pass; preserve a working 2D fallback. If connected credentials are available, deploy to the existing Render service `homestand`, not NEON HEIST. Confirm live commit SHA, Render healthy, game start, reconnect and rematch.
- Record 30–60 seconds of real in-game action (not mocked gameplay). Produce three true screenshots: menu, hero battlefield and clear multiplayer room screen. Crop/resolution for Handshake after checking submission requirements.

## Sprint order and decision gates
**Gate 0 (today):** verify baseline in fresh clone, remove fragile runtime code injection without regressions. Leave `npm test` green, deploy existing functionality. If normalizing startup is risky, isolate and document a safe incremental approach, but prioritize reproducibility.

**Gate 1:** begin-friendly UX & tutorial; screenshots; 1 minute to first understandable objective; desktop/mobile sanity.

**Gate 2:** attractive original 3D models and battlefield readability; optional polish. 2D fallback remains fully operational.

**Gate 3:** effects, AI fairness, balance, synchronization, rematch, sound/animations. A happy-path player demo must be convincing.

**Gate 4:** final QA, 1v1 on two browsers/real devices, accessible URLs, submission package and freeze.

If behind schedule, **cut features in this order**: cosmetic camera options → additional environment biome/props → sound → special Signal Surge ability → advanced stats → extra unit variants. **Never cut:** accessible onboarding, working 1v1, functioning room codes, visible unit control, stable rendering, clear victory/rematch, browser compatibility.

## Explicit acceptance checklist
- [ ] Fresh clone + `npm install && npm test` succeeds; no runtime generated source patches needed.
- [ ] Homepage first-time UX explains the goal without external instructions.
- [ ] Tutorial can be followed in <=90 sec and skipped/replayed.
- [ ] Recruit vs AI can be started and played completely, including victory/defeat/rematch.
- [ ] Click/tap select → click/tap issue order, keyboard shortcut optional, drag/pinch camera works.
- [ ] Rifle/Tank/Rocket differentiated; credits/supply/controls visible and accurate.
- [ ] Dramatically better original 3D models, environment, hit effects and cohesive readable UI; 2D fallback works.
- [ ] Desktop, mobile portrait, mobile landscape smoke tests; no page-crashing console errors.
- [ ] Two browser contexts can use code to join and play human 1v1; reconnect/rematch works.
- [ ] Production URL and actual deploy commit are confirmed; health checks/asset paths pass.
- [ ] README and submission docs reflect *actual verified* behavior, not aspirations.
- [ ] Accessibility: legible type, contrast, touch targets, keyboard help, reduced motion, non-color-only team cues.

## How to execute and report
1. Inspect repository and report baseline issues as a concise audit.
2. Create your working branch and commit an initial reproducible test result.
3. Implement working code **now**, proceeding milestone by milestone; don't stop at writing a design plan. When possible provide deployable increments rather than one huge change.
4. After each milestone run tests and summarize files changed, commands, result and screenshots.
5. If an asset or tool is unavailable, use the highest quality lawful fallback possible and label it transparently.
6. Before declaring completion, give the URL/commit/PR, exact tested flows, remaining defects, and the highest impact next step.

**Product test:** "I have never played an RTS. I just tapped Play. In under 30 seconds I can identify my army, train a unit, send it to a relay, and understand why it matters. The battles look exciting; the UI doesn't overwhelm me; I can challenge a friend without signing up." Build for that experience.