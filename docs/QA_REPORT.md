# Milestone 4 final QA report

Validated locally on October 26, 2026 against `http://127.0.0.1:3006` using installed Chromium with real WebGL 2 through ANGLE on Intel UHD Graphics 620.

## Automated results

- `npm test`: 26/26 passing.
- `npm run qa:ux`: tutorial completion, Recruit launch, desktop/mobile navigation, console/network monitoring, screenshots, and 360 px overflow checks passed.
- `npm run qa:3d`: desktop/mobile WebGL, interactions, combat effects, orbital impact, minimap, 2D fallback, screenshots, and sustained crowded-battle sampling passed with no harness failures.
- `npm run qa:world`: all three maps, seven camera states per desktop/portrait map, landscape fit, mouse/touch/pinch/minimap controls, WebGL recovery, 2D fallbacks, and multiplayer map synchronization passed. All 2,835 sampled viewport rays hit authored terrain.
- `npm run qa:final`: two independent browser contexts completed room join, authoritative map/seed sync, launch, recruitment, move, focus fire, guest refresh/reconnect, guest victory, host rematch, host victory, and exit. Portrait and landscape camera controls had zero rectangle intersections or horizontal overflow.

## Performance measurements

- World matrix: 52–60 FPS desktop high; 59–60 FPS emulated mobile balanced.
- 3D combat: desktop warmed to 55–56 FPS after a 3 FPS cold-start sample; emulated mobile held 60–61 FPS.
- Crowded combat: transition samples 1 and 0 FPS, then 41, 35, and 34 FPS; 1,203 maximum draw calls and 161,462 maximum triangles.

These results describe this browser and hardware only. The mobile figures use Chromium viewport/touch emulation, not a physical phone.

## Defects fixed during final QA

- Multiplayer refresh replay used the stored `room` property, while the server join contract requires `code`. Sessions now store `code` and continue accepting legacy `room` values.
- The homepage image was under-resolution and visibly soft. It has been replaced by a 1200 × 1200 self-produced original WebP.
- Portrait battlefield height and camera-control grid were audited and adjusted for usable play space without reducing primary touch targets below 40 px.

## Error audit

The final UX, 3D, world, and two-browser runs recorded no application console errors, page exceptions, or failed asset requests.

## Release-blocking performance and tutorial follow-up

- Added a 120-second Chromium/DevTools performance workload covering recruitment, commands, crowded combat, orbital strikes, rematch handling, WebSocket traffic, long tasks, heap use, input latency, draw calls, triangles, and a streamed trace.
- Effective frame rate improved from 23.3 to 59.3 FPS on the measured Intel UHD 620 environment. Average draw calls fell from 957 to 526, shader/program query time from 76.12 seconds to 0.73 seconds, long-task time from 77.91 seconds to 1.14 seconds, and average input-to-paint delay from 138.2 ms to 32.8 ms.
- Guided training is now protected by the authoritative simulation: its clock is frozen, enemy aggression/damage/capture is disabled, victory scoring is suspended, and resources remain sufficient. Completing or skipping explicitly starts normal battle conditions.
- The full measurements, methodology, limitations, and artifact names are in `docs/RELEASE_PERFORMANCE_REPORT.md`.

## Operation Safe Haven mission QA

- `npm test`: 33/33 tests pass, including server-authoritative placement, collision and resource rejection, timed construction, clinic healing, workshop patrol production, structure upgrades, mission progression, facility-loss conditions, protocol authorization, renderer lifecycle, and instanced-town coverage.
- `npm run qa:safe-haven`: real pointer placement completed all four structures, selected and upgraded a watchtower, produced a patrol vehicle, issued movement/combat/orbital commands, exercised active combat, and repeated touch placement at 844 x 390. No application errors, failed requests, or horizontal overflow were recorded.
- Existing `qa:ux`, `qa:3d`, `qa:world`, and `qa:final` suites pass. This preserves the protected tutorial, 2D fallback, three established battlegrounds, WebGL recovery, Recruit flow, and two-browser multiplayer synchronization/reconnect/rematch/victory coverage.
- On Intel UHD Graphics 620, warmed desktop combat averaged 51 FPS with a 42 FPS minimum, 373 average draw calls, 435 maximum draw calls, 83,640 maximum triangles, and an 11 MB heap. The full cold-start run had a 9.4 FPS 1% low and a 2,543 ms initialization long task. Landscape touch emulation averaged 54 FPS with a 29 FPS minimum and 244 maximum draw calls.
- Screenshots, a short WebM demonstration, and raw metrics are in `artifacts/safe-haven/`. Mobile validation is Chromium emulation rather than a physical handset.
