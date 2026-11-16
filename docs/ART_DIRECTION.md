# IRON FRONTIER — competition art direction

## Visual thesis

IRON FRONTIER is a near-future global conflict presented as a tabletop command theatre brought to life. The world uses clean, readable silhouettes, weathered military surfaces, cyan or ember-red faction technology, and warm kinetic weapon effects. It should feel serious and energetic without becoming visually noisy or photorealistic.

## Factions

- **Azure Union:** naval-industrial forms, upright antenna towers, cyan armor, pale identification panels, cool emissive technology.
- **Crimson Legion:** heavier angular forms, three-pronged HQ crown, ember armor, dark red structure, warm emissive technology.
- Faction color is never the only identifier. Headquarters profiles, lighting accents, and structure crowns differ in silhouette.

## Unit language

- Infantry appears as a three-soldier squad at high quality, with helmets, visors, chest armor, backpacks, limbs, and long rifles. Lower quality keeps a two-soldier formation rather than replacing it with a token.
- Siege tanks use continuous track housings, visible road wheels, sloped frontal armor, a rotating-form turret silhouette, hatch, antenna, cannon and muzzle brake.
- Rocket batteries use a tracked chassis and a visibly elevated rack of individually modeled missiles.
- All unit types preserve strong top-down recognition at the default isometric distance. Pale panels and emissive accents identify facing and team without obscuring the body shape.

## Battlefield language

All battlegrounds share the same fair relay corridor and readable concrete base pads, while the visual world extends well beyond simulation space and ends behind natural formations rather than a rectangular board edge. Scenery never participates in gameplay picking.

- **Coastal Frontier:** humid olive ground, palms and scrub, a broad tropical shoreline, open ocean, sun-washed service roads and green perimeter cliffs.
- **Desert Front:** ochre sand, wind-cut mesas, cacti, dry scrub, dusty roads and a warm amber atmosphere.
- **Frozen Territory:** pale snow, blue ice, a frozen river, winter pines, black-rock ice cliffs and cool polar light.

Relay towers use concentric energy rings and a floating core so their capture state reads instantly in every biome. The map-specific tactical map repeats the major terrain cue without reducing unit contrast.

## Lighting and effects

Warm directional sunlight provides form and long readable shadows; cool sky and rim lighting separate units from terrain. ACES tone mapping controls highlights. Combat effects are brief and gameplay-driven: a projectile event produces recoil and muzzle sparks, impacts produce debris and smoke, health loss flashes a unit, destruction produces a larger burst, relay ownership changes trigger an energy burst, and orbital strikes create a vertical beam, expanding core and shock ring.

Milestone 3.5 adds weathered faction armor albedos, a tactile coastal ground surface, panel seams, vents, lamps, identification sprites, layered selection chevrons, and a transparent fire/smoke/debris impact sprite. Orbital strikes deliberately read in three beats: pulsing ground telegraph and charge column, white-hot beam impact with camera impulse, then expanding shock, smoke, sparks, debris, and a persistent scorch.

## Camera and quality

The default perspective is a comfortable isometric overview with smooth target, zoom and rotation interpolation. Wheel/pinch zoom, touch/middle-mouse/alternate-drag pan, keyboard rotation, reset, fit-to-battlefield, focus-selection and focus-objective controls are supported. Camera limits tighten as the view pulls back and adapt to portrait viewports; the maximum overview is centered so the full playable field remains visible over authored terrain. High quality favors antialiasing, richer formations, vegetation and periodically refreshed soft shadows. Balanced quality reduces formation complexity, wheels, missiles, vegetation, pixel ratio and shadows while retaining every gameplay silhouette and effect category. Deterministic formation offsets keep friendlies from occupying exactly the same screen-space position.

## Guardrails

- Do not reproduce recognizable assets, characters, user-interface layouts or distinctive designs from another game.
- Tactical readability takes priority over particle count, surface detail, or environmental density.
- VFX must originate in authoritative gameplay state rather than run as unrelated ambience.
- The 2D tactical view remains a fully usable fallback, not a loading screen or degraded control mode.
