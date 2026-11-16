# Asset credits and provenance

## Milestone 3.5 runtime art

The four runtime images below were generated specifically for IRON FRONTIER on October 25, 2026 with OpenAI image generation, then resized/compressed locally for the stated runtime budget. They were not copied from a reference game and contain no third-party logos or characters. The repository owns the resulting project files; no external stock-asset license or attribution is required.

| Runtime asset | Size | Purpose |
| --- | ---: | --- |
| `public/assets/3d/coastal-ground-albedo.jpg` | 1024 x 1024, 454 KB | Repeatable grass, earth, and pebble surface |
| `public/assets/3d/azure-armor-albedo.jpg` | 1024 x 1024, 243 KB | Azure Union weathered alloy surface |
| `public/assets/3d/crimson-armor-albedo.jpg` | 1024 x 1024, 276 KB | Crimson Legion weathered alloy surface |
| `public/assets/3d/impact-explosion.png` | 768 x 768, 1.27 MB | Transparent impact/fire/smoke sprite |
| `public/assets/iron-frontier-hero.webp` | 1200 x 1200, 574 KB | Original high-resolution homepage key art |

Generation prompts, preserved for reproducibility:

1. `Seamless top-down olive coastal grass, packed earth and tiny pebble military terrain texture; flat albedo lighting; natural irregular variation; no objects, roads, symbols, text, borders, or perspective.`
2. `Seamless weathered teal and naval-blue near-future military alloy armor panel texture; layered panel seams, rivets, scratches, edge wear and restrained amber warning marks; original design; flat PBR albedo; no logos, text, objects, or perspective.`
3. `Seamless weathered ember-red, oxblood and graphite near-future military alloy armor panel texture; angular seams, recessed vents, bolts, scratches, edge wear and restrained ivory warning stripes; original design; flat PBR albedo; no logos, text, objects, or perspective.`
4. `Transparent-background single cinematic high-angle military sci-fi ground-impact explosion sprite; white-hot center, orange fire, radial sparks, dark smoke, flying soil and metal debris; original game VFX; isolated effect with no scenery, vehicle, people, text, border, or watermark.`
5. `Original near-future military science-fiction battlefield from a high three-quarter isometric angle; weathered Azure armor advancing from a tropical coastal base against Crimson forces; recognizable tanks, infantry, rocket batteries, relay towers, roads, ocean, restrained explosions and atmospheric smoke; sharp commercial game key art; no text, logos, watermark, real-world insignia, or copied game designs.`

The source images produced by the generator are retained in the local Codex generated-image cache for this workstation; the optimized derivatives above are the canonical checked-in runtime files.

## Original renderer assets

All meshes, structures, environment dressing, road markings, procedural road texture, selection indicators, badges, projectile trails, smoke, sparks, lighting, animation parameters, and camera behavior in `public/3d.js` were created specifically for IRON FRONTIER. They use reusable Three.js geometry plus the local art above. There are no network-loaded models, textures, animations, particles, sounds, or other third-party battlefield assets.

Milestone 3.6 adds only original code-authored environment forms: instanced desert mesas and cacti, frozen cliffs/river/ice marks, expanded coastal water and shoreline, biome vegetation, deterministic scenery placement, atmosphere palettes, and CSS-drawn map preview cards. No third-party map, texture, model, or preview asset was introduced.

Operation Safe Haven adds only original code-authored assets: the engineer crane vehicle, protected patrol vehicle, barricade, watchtower, vehicle workshop, field clinic, civilian facilities, residential compounds, market stalls, elevated water tanks, road dressing, and town vegetation. The assets are procedural Three.js assemblies built from shared geometry and materials in `public/3d.js`; they introduce no third-party model, texture, logo, audio, runtime request, or copied reference-game design. The fictional setting is a composite inspired by broad Nigerian built-environment cues and does not reproduce a specific town or real incident.

The renderer uses the repository's installed `three` package, served locally as `/vendor/three.module.js`. Three.js is distributed under the MIT License; its license is included at `node_modules/three/LICENSE` after dependency installation.

## Retired project artwork

`public/assets/concept-battle.webp` predated Milestone 3, was only 8 KB, appeared visibly blurred at homepage size, and had unresolved provenance. Milestone 4 removes it from the runtime in favor of the documented original hero above.

## Quality classification and limitation

Final-quality for this gate: the faction surface texture set, terrain surface, lighting treatment, selection/badge language, impact sprite, gameplay-driven VFX sequence, and authored environment composition.

Production-interim rather than final hero art: infantry, tanks, rocket batteries, HQs, turrets, vegetation, and props are detailed custom procedural assemblies. They now have readable armor, weapons, tracks, panels, mechanical components, faction silhouettes, motion, recoil, and PBR treatment, but they are not UV-authored/skinned GLB models. In particular, infantry lacks a skeletal animation rig and the vegetation retains a deliberately stylized low-poly silhouette. The required GLB replacement workflow is specified in `ASSET_PRODUCTION_WORKFLOW.md`; these meshes must not be represented as final cinematic character assets.

The Safe Haven engineer, patrol vehicle, town structures, and civilian buildings share that production-interim procedural classification. They are original, optimized, readable gameplay assets, but not UV-authored hero GLBs.

## Immersive v2 (HOMESTAND) assets

No external models, textures, fonts, audio or libraries were added. Every new visual is code-authored in this repository:

| Asset | Source | Size / runtime impact |
| --- | --- | --- |
| `public/town.js` — Kachia town kit: walled compounds, hip-roof houses, water tanks, market stalls, umbrellas, kiosk containers, clinic, school, community centre, checkpoint, staging camp, power lines, streetlights, billboards, trees, inselbergs, danfo buses, kekes, cars, convoy vehicles, mission structures | Original primitives, vertex-coloured and merged per material | ~35 KB source; the whole district renders in ~5 draw calls |
| Painted Safe Haven ground (laterite and asphalt roads, yards, field, evacuation arrows) | Generated at runtime on a canvas from the shared layout in `public/maps.js` | 1024–2048 px texture, cached per session |
| `public/assets/homestand-poster.jpg` | Rendered from the in-engine homepage scene with `npm run render:poster` | 2400 x 1350, ~520 KB, preloaded |
| Interface icons (inline SVG paths in `public/game.js`) and the HOMESTAND emblem | Original | Inline, no requests |

The legacy `iron-frontier-hero.webp` is still served for compatibility but is no longer referenced by the interface.
