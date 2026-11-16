# IRON FRONTIER map system

## Authoritative identity

`public/maps.js` is the shared environment registry. It runs as a browser module and as CommonJS on the server, so both sides validate the same `coastal`, `desert`, and `frozen` identifiers. Each definition owns presentation metadata, palette, atmosphere, and a stable base seed.

The room host supplies a map ID when creating a match. The server validates it and derives a deterministic terrain seed from the map base seed and room code. Both values are stored by the simulation and included in every snapshot. A joining client's local selection is never consulted, so multiplayer participants cannot render different environments for one room. Rematches preserve both values.

## Coordinate layers

- Simulation space remains `1600 × 900`; unit orders, AI, combat, relays, scoring, and balance are identical on all maps.
- The Three.js playable conversion remains 30 simulation units per world unit.
- Visual terrain is a finite `220 × 180` world-unit apron. It extends beyond gameplay and all legal camera rays, but is not infinite geometry.
- Natural perimeter formations sit outside the playable corridor. Decorative meshes are never registered as pickable gameplay entities and cannot intercept unit selection or orders.
- Camera targets use zoom- and aspect-aware limits. Maximum zoom-out recenters automatically; closer views allow exploration while retaining authored terrain coverage.

## Determinism and performance

The authoritative terrain seed initializes a local linear-congruential generator before scenery creation. Rocks, vegetation, trees, and perimeter formations therefore match for every client without transmitting prop data. Rocks, plants, trunks, crowns, and boundary formations use instancing. Balanced/mobile quality reduces instance counts, model sub-parts, shadow work, and pixel ratio while preserving map identity and gameplay feedback.

## Adding a map

1. Add its metadata, colors, atmosphere, and unique integer seed to `public/maps.js`.
2. Add 2D terrain and minimap treatments in `public/game.js`.
3. Add its ground, boundary, vegetation, lighting, and atmosphere branches in `public/3d.js`.
4. Keep simulation coordinates and relay/base layout unchanged unless a separately tested gameplay variant is intended.
5. Extend engine, room synchronization, renderer, browser coverage, mobile, and fallback tests before shipping.
