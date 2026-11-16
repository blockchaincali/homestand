# Operation Safe Haven

Operation Safe Haven is the civilian-defense mission behind the **Defend the North** campaign. Since the campaign update it is played in six real Nigerian cities (see `DEFEND_THE_NORTH.md`); the hostile force and every scenario remain fictional, and no mission depicts a real attack or its victims. The player commands a community protection and emergency-response force defending residents from a fictional insurgent force.

## Mission flow

1. **Prepare defenses** — a protected preparation phase gives the player an automatically selected engineer, four response squads, resources, and unlimited time to place defenses. The player builds a barricade, watchtower, response barracks, and vehicle workshop, may add a field clinic, and can train infantry or manufacture a patrol vehicle before pressing the prominent **Begin Defense** action. Hostile attacks, capture pressure, and the match timer remain paused until the player starts the assault.
2. **Protect community facilities** — defend Amina Community Clinic, Unity Market, and Safe Haven Centre through a timed series of balanced attacks. At least two facilities must survive.
3. **Secure the evacuation route** — hold the eastern evacuation point long enough to establish a safe corridor.
4. **Survive the final assault** — withstand the last coordinated wave while keeping the town's headquarters and at least two civilian facilities operational.

The mission is won after the final assault. It is lost if the headquarters falls or fewer than two civilian facilities remain.

## Construction and unit controls

- Select the engineer, choose a structure, then tap or click a valid location. A green placement preview confirms clear ground; an invalid preview explains collisions or range limits.
- Barricades block and separate ground forces.
- Watchtowers automatically engage hostiles in range.
- Response barracks train rifle infantry through a visible timed production queue.
- Field clinics heal nearby friendly units.
- Vehicle workshops produce protected patrol vehicles.
- Engineers can be dispatched to damaged completed structures for paid maintenance; repair movement, range, resource use, and restored health are simulated by the server.
- Completed structures can be selected, inspected, repaired, and upgraded once. Costs, build time, production queues, supply limits, health, collision checks, repairs, and upgrades are validated by the server simulation.

The mission supports mouse, touch, drag panning, pinch zoom, fullscreen/orientation lock where supported, the existing camera controls, balanced/high renderer tiers, and the 2D tactical fallback. In mobile landscape, the battlefield owns the viewport while objectives, resources, construction, and contextual controls sit in translucent corner overlays. The fixed-viewport layout is also the Safari fallback when orientation locking is unavailable.

## Environment and provenance

The town is an original composite environment rather than a recreation of a specific place. Its residential compounds, market stalls, painted roofs, local road markings, elevated water tanks, clinic, community centre, vegetation, and security infrastructure are code-authored in `public/3d.js`. They reuse the repository's existing local material system and Three.js geometry; the mission introduces no third-party models, textures, logos, runtime downloads, or proprietary reference-game assets.

## Validation snapshot

Validated October 27, 2026 in installed Chromium with real WebGL 2 through ANGLE on Intel UHD Graphics 620:

- All five structure types were placed through real pointer input and completed authoritatively. The required four unlocked Begin Defense only after construction finished.
- Infantry was trained from the barracks, a patrol vehicle was produced from the workshop, and the watchtower was upgraded before visible combat.
- The simulation suite separately exercised engineer repair, escalating stages, victory, civilian-network defeat, replay reset, supply validation, and multiplayer room regressions.
- Desktop sustained combat averaged 59 FPS with a 55 FPS minimum, 359 average/438 maximum draw calls, 96,374 maximum triangles, and a 15.4 MB JavaScript heap.
- The cold-start-to-combat run averaged 58 FPS with a 15 FPS 1% low and a 33.3 ms p99 frame time; shader/scene initialization remained the largest long task at 2,206 ms.
- Chromium landscape touch emulation at 844 × 390 averaged 59 FPS with a 54 FPS minimum, 244 maximum draw calls, 54 px construction targets, a full-height 390 px battlefield, and no horizontal or vertical gameplay-page overflow.

These are measurements from one browser and GPU, not guarantees for every desktop or a physical phone. The cold-start spike remains the primary performance limitation; warmed sustained combat met the 30 FPS goal on the measured integrated GPU.

Evidence is stored in `artifacts/safe-haven/`: homepage, defense, combat, and landscape-mobile screenshots; `operation-safe-haven-demo.webm`; and the machine-readable `report.json`.
