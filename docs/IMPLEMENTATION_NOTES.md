# IRON FRONTIER implementation notes

## Operation Safe Haven - civilian defense mission

- Added one solo mission in a fictional Nigerian town without changing the standard solo or multiplayer map catalog. A protected preparation phase transitions through civilian-facility defense, evacuation-route control, and a final assault with explicit win/loss rules.
- Added server-authoritative engineer construction, placement/collision/resource checks, build timers, structure health, one-level upgrades, workshop production, and protected patrol vehicles. Barricades block movement, watchtowers fire, clinics heal, and workshops produce units through the existing snapshot protocol.
- Added an original instanced town environment, civilian facilities, response-force vehicles, build previews, structure selection, mission guidance, compact landscape controls, portrait rotation guidance, minimap coverage, and matching 2D rendering. Shared geometry/materials and bounded effects preserve the optimized renderer lifecycle.
- Added engine, room/protocol, renderer, and real-browser mission regression coverage. `npm run qa:safe-haven` captures desktop and landscape-mobile evidence plus a short gameplay demonstration. Detailed controls, provenance, measurements, and limitations are in `SAFE_HAVEN_MISSION.md`.

## Release stabilization - renderer lifecycle and protected training

- Batched static submeshes by material, pooled spark/smoke particles, removed shader-churning transient lights, throttled the tactical minimap, and made HUD rendering state-differential. Renderer teardown now disposes merged buffers and mount-owned resources.
- Added an automatic balanced tier for constrained devices without removing the high-quality option or the 2D fallback.
- Added an authoritative solo-only training state to the engine and protocol. It freezes the match clock and hostile behavior while preserving enough resources and units for every onboarding step, then cleanly hands control to normal battle rules on completion or skip.
- Added renderer lifecycle, batching/pooling, server protocol, three-minute training protection, and browser onboarding regressions. `npm run qa:performance` records a two-minute CDP trace and machine-readable performance report.
- See `RELEASE_PERFORMANCE_REPORT.md` for measured before/after results and remaining hardware-validation limits.

## Milestone 1 — architecture stabilization

### Baseline (October 24, 2026)

- The clean Git tree did not contain `server.js`, `src/config.js`, `public/style.css`, the menu artwork, or the core engine/room tests as normal source files.
- Both `npm start` and `npm test` invoked `boot.js`. It unpacked `source.bundle.b64`, created missing files, and rewrote `server.js` on disk to add difficulty handling and Three.js routes.
- The generated baseline passed 14 tests, but a fresh working tree was mutated before any server or test code could run.
- The client already supported a Three.js view, a 2D fallback, solo difficulty selection, private room codes, reconnect identity in session storage, mouse/touch input and rematches.
- Known UX gaps intentionally remain for the next milestone: dense first screen/HUD, right-click-oriented guidance, no interactive tutorial, incomplete mobile-first control explanation, and no visual-regression test harness.

### Stabilized runtime

- `npm start` now launches the checked-in `server.js` directly.
- `npm test` uses Node's test discovery and does not generate or patch files.
- All runtime source, styles, local artwork and baseline tests are normal tracked files.
- Foundation tests cover direct-source startup, health/static routes, MIME types, source-file non-exposure, and a real WebSocket upgrade that starts a Recruit match.
- Render remains a single Node web service with `npm install --omit=dev`, `npm start`, and `/healthz`; no production configuration or deployment was changed.

### Back-out

If this milestone must be reverted, revert its Git commit. The prior revision restores `boot.js` and `source.bundle.b64` together; those two files must never be restored independently because the old bootstrap depends on the bundle and mutates `server.js` during startup.

### Deferred risks

- Rooms are in memory and intentionally require one server replica.
- Reconnect identity is convenient rather than cryptographically hardened.
- The server broadcasts full snapshots at roughly 8 Hz and has no per-client command rate limiter yet.
- Playwright interaction coverage and two-browser-context gameplay remain future QA work; Milestone 1 uses endpoint/protocol tests plus headless Chrome desktop and mobile screenshot evidence in the local `artifacts/milestone-1/` directory.

## Milestone 2 — beginner-first UX

- Replaced the dense launch form with three explicit paths: Quick Battle, Guided Tutorial, and Play With Friend. Recruit is the first-time default and each difficulty explains its intended experience.
- Added a six-stage, skippable tutorial driven by live match state. Recruitment, selection, move, attack-move, and capture steps advance only after the relevant action or authoritative snapshot; completion is stored locally and can be replayed with `?`.
- Added tap/click contextual controls, selection and command feedback, dynamic dismissible mission guidance, clearer faction/resource/objective hierarchy, unit roles, and disabled-production explanations.
- Reworked the battle layout for desktop, 360px portrait, and short landscape screens while preserving the Three.js/2D switch, room protocol, reconnect behavior, and keyboard shortcuts.
- Added a repeated Recruit newcomer test plus a Playwright-based `npm run qa:ux` flow using installed Chrome/Chromium. It completes onboarding, monitors console/request failures, checks document overflow at 360px, and captures home/tutorial/battle screenshots for desktop and mobile.

## Milestone 3 — cinematic 3D battlefield

- Replaced the basic renderer with an original coastal command theatre: procedural terrain texture, layered roads and shoreline, water, concrete pads, instanced grass and rocks, palms, barricades, supply crates, fog, ACES tone mapping, warm key light and cool rim light.
- Rebuilt every gameplay silhouette. Rifle entities are armored multi-soldier formations with helmets, visors, packs, weapons and gait motion; tanks have tracks, wheels, sloped armor and recoiling cannons; batteries have tracked chassis and individual missiles; faction HQs and turrets have distinct Azure/Crimson profiles.
- Connected muzzle flashes, recoil, projectile trails, rocket smoke, hit sparks, impacts, destruction, relay capture energy and the orbital beam/shockwave to authoritative snapshots. Projectile snapshots now expose only the source identifier needed to associate the effect with its firing unit.
- Added smoothly interpolated perspective camera zoom/pan, pinch input, reset/focus controls, keyboard rotation, WebGL context-loss handling, adaptive high/balanced quality and live renderer telemetry.
- Added `npm run qa:3d` for real WebGL desktop/mobile execution, console and request-failure monitoring, 360px overflow validation, renderer telemetry and before/after, close-up, combat, orbital, mobile and 2D-fallback screenshots. Headless results use Chromium SwiftShader and therefore document a software-rendering lower bound, not representative hardware performance.
- Added renderer regression tests for lifecycle/quality APIs, instancing, local-only assets, 2D and contextual-control preservation, and projectile/VFX integration. See `ART_DIRECTION.md` and `ASSET_CREDITS.md` for the visual system and provenance.

## Milestone 3.5 - premium visual quality gate

- Added original local 1024 px terrain and faction armor art plus a transparent cinematic impact sprite. The renderer applies the surfaces with metal/rough materials, bump detail, anisotropic filtering, faction-specific panels, emissive identification, and no runtime network dependency.
- Re-authored unit and structure assemblies with chamfered armor, vents, lamps, kneepads, visors, muzzle brakes, wheel hubs, missile fins, stabilizers, conduits, beacons, and visibly different Azure/Crimson HQ crowns. Added type/team identification sprites, layered selection rings and deterministic spacing offsets.
- Enriched the coastal theatre with tactile ground, cracked road surfacing, lane marks, layered shoreline foam, physical water, stronger atmospheric depth, three-point faction-readable lighting, and camera framing that keeps HQs and selected forces inside the view.
- Reworked impact presentation around authoritative events: bounded muzzle sparks, smoke, recoil, projectile impacts, destruction flashes, debris, persistent scorches, and a three-beat orbital telegraph/impact/aftermath with camera impulse. Effects are capped by family to avoid runaway crowded-battle cost.
- Fixed the blank 3D tactical minimap by continuing its 2D paint loop while WebGL owns the main battlefield. Expanded the 360 px battle viewport and compacted supporting controls without shrinking primary touch targets below 40 px.
- Added mouse-wheel and pinch assertions, minimap pixel validation, an orbital-impact capture, identical default-camera A/B capture, and five sustained one-second crowded-battle performance samples to the WebGL QA harness.
- High-quality soft shadows update at a controlled cadence; balanced mobile mode keeps full gameplay silhouettes and effect categories with fewer meshes, no dynamic shadows, and a 1x pixel ratio.
- Final headless Chrome measurements used real WebGL 2 through ANGLE on Intel UHD Graphics 620. The latest high-quality desktop samples were 2, 55, and 61 FPS (a cold-start stall followed by a 58 FPS warm average); 360 px balanced emulation sampled 8, 60, 61, 60, and 61 FPS (50 average including warm-up); and a 14-15-unit high-quality crowded battle sampled 57, 53, 42, 42, and 44 FPS (48 average, 42 minimum). These are browser/hardware-specific measurements, not claims about physical mobile devices or all desktop systems.
- Final-quality classification and the remaining authored-GLB/skinned-animation gap are recorded in `ASSET_CREDITS.md`. `ASSET_PRODUCTION_WORKFLOW.md` defines the original Blender/glTF asset contract needed to close that gap without mislabeling procedural meshes as final hero art.

## Milestone 3.6 - world environments, selection, and camera

- Added the shared `public/maps.js` registry and a visual three-card battlefield selector for Coastal Frontier, Desert Front, and Frozen Territory. Solo matches and multiplayer hosts send the selected ID; the server validates it, derives an authoritative deterministic terrain seed, and preserves both through snapshots and rematches. Joiners cannot override the host environment.
- Kept the `1600 × 900` simulation, unit balance, relay positions, and command protocol identical across maps. Rendering now separates that playable space from a finite `220 × 180` visual apron with deterministic instanced scenery and natural perimeter formations. Coastal ocean/shore, desert mesas/scrub, and snow/ice terrain each have distinct lighting, fog, ground treatment, vegetation, and tactical-map cues.
- Added smooth rotation, fit-to-battlefield, objective focus, readable ASCII camera controls, zoom/aspect-aware pan constraints, selection-friendly touch hit targets, and deterministic unit spacing. At maximum zoom-out the camera recenters on the full playable field; closer views allow bounded exploration without revealing an unfinished board edge.
- Fixed three browser-only regressions found by the new harness: the 3D minimap's cross-module coordinate conversion, retained mobile scroll position on battle entry, and overlapping camera-control hit regions. The live multiplayer check also found and fixed a stale host lobby roster that left Launch disabled even after the authoritative state contained both players.
- Added `npm run qa:world`. It captures each map at default, maximum-in, maximum-out, and all four pan limits at 1440 × 900 and 360 × 800, plus landscape maximum-out and per-map 2D fallbacks. It verifies mouse/touch/pinch/minimap input, map-aware minimaps, zero horizontal overflow, WebGL recovery, console/request health, and real two-client host map synchronization.
- The final camera-coverage matrix sampled 63 viewport rays per state: every sample hit authored terrain for all 42 desktop/portrait map-camera combinations and all three landscape checks. Headless Chrome used real WebGL 2 through ANGLE on Intel UHD Graphics 620. High-quality desktop samples measured 56 FPS coastal, 59 FPS desert, and 59 FPS frozen; 360 px balanced emulation measured 60 FPS on all three. The separate 13–14-unit sustained combat run averaged 61 FPS with a 59 FPS minimum, peaking at 1,126 draw calls and 160,336 triangles. These are measurements from this browser/hardware run, not guarantees for physical phones or all GPUs.

## Milestone 4 - final competition polish

- Replaced the low-resolution homepage image with a self-produced 1200 px original campaign illustration, optimized locally to WebP and documented with its generation prompt in `ASSET_CREDITS.md`. The browser reserves its dimensions and requests it at high priority to avoid layout shift and soft upscaling.
- Expanded the 390 px portrait battlefield to roughly 52% of viewport height and retained 40 px touch controls. Automated rectangle audits confirm no camera-control overlap or horizontal overflow at 390 × 844 portrait and 844 × 390 landscape.
- Fixed multiplayer refresh recovery by persisting the server's `code` field and accepting the legacy `room` field during replay. A two-browser-context run verified host-authoritative Desert selection and seed, launch, synchronized recruitment, movement, focus fire, guest refresh/reconnect, victories for both factions, rematch reset, and return navigation.
- Re-ran the guided tutorial, Recruit simulation checks, full Node regression suite, real-WebGL combat harness, three-world camera matrix, mobile layout checks, WebGL recovery, 2D fallback, and final multiplayer flow. All automated suites completed without application console errors or failed asset requests.
- Final WebGL measurements on Intel UHD Graphics 620: map views measured 52–60 FPS on desktop high and 59–60 FPS in emulated mobile balanced mode. The crowded combat run contained two transition stalls (1 and 0 FPS) before sustaining 34–41 FPS; peak load was 1,203 draw calls and 161,462 triangles. Chrome emulation is not a substitute for physical-phone QA.
