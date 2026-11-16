# Hero asset production workflow

## Why this workflow is required

Milestone 3.5 materially improves the in-engine result with original surface art, lighting, environmental composition, selection language, animation, and event-driven VFX. The current custom assemblies are a strong production-interim solution, but code-authored geometry cannot efficiently supply the UV continuity, sculpted forms, skeletal infantry motion, and baked detail expected of final cinematic hero assets. Blender was not installed in the implementation environment, so no unreviewed placeholder GLB files were substituted.

## Required original asset set

- One shared infantry skeleton with Azure and Crimson armor meshes; idle, run, fire, hit, and death clips.
- Azure and Crimson tank variants with named `turret`, `barrel`, `muzzle`, track, wheel, and destruction nodes.
- Azure and Crimson rocket batteries with named `rack`, `missile_*`, `muzzle_*`, and stabilizer nodes.
- Faction-specific HQ and defensive-tower models with intact and damaged states.
- Relay tower plus a compact environment kit: cliff modules, two tree families, shrubs, rocks, barricades, crates, and shoreline debris.

No silhouette, emblem, costume, weapon, or interface element should be traced from another commercial game. Concept sheets, source `.blend` files, texture sources, artist name, creation date, license/assignment, and export version must accompany every delivery.

## Budgets and authoring targets

| Asset | LOD0 target | Texture target |
| --- | ---: | --- |
| Infantry soldier | 3k-5k triangles | shared 1024 px armor atlas |
| Tank | 12k-18k triangles | shared 1024-2048 px atlas |
| Rocket battery | 14k-20k triangles | shared 1024-2048 px atlas |
| HQ | 25k-35k triangles | 2048 px atlas |
| Defensive tower / relay | 8k-15k triangles | shared 1024 px atlas |
| Environment props | 300-4k triangles | shared 1024 px atlas |

Each gameplay asset needs LOD1 at roughly 50% and LOD2 at 15-25% of LOD0, clean pivots, meter scale, +Y up, forward-axis consistency, non-overlapping lightmap UVs if baked lighting is introduced, and no hidden or duplicated geometry. Materials should use metal/rough PBR with packed ORM where practical; faction variants should share geometry and atlases whenever silhouette requirements allow.

## Export and integration contract

1. Author and review silhouettes at the game's default isometric camera before adding micro-detail.
2. Bake normal/AO detail from the original high-resolution source; keep wear restrained around edges and moving parts.
3. Export binary glTF (`.glb`) from Blender 4.x with textures embedded, animation names preserved, and mesh compression enabled only after browser compatibility validation.
4. Validate with the Khronos glTF Validator: no errors, no missing tangents, no non-finite transforms, and documented warnings only.
5. Integrate through one cached `GLTFLoader` path with cloned scene instances, shared materials, LOD selection, abortable loading, fallback to the current assemblies, and explicit disposal on renderer unmount.
6. Measure default and crowded battles on real desktop and representative Android hardware. Gate by frame-time percentiles and draw calls, not file size alone.
7. Capture identical-camera A/B frames and close-ups for art approval before replacing the procedural fallback.

## Acceptance gate for hero models

An authored asset is final only when its source/provenance is archived, validation is clean, the default-camera silhouette is immediately recognizable, its animation events align with authoritative gameplay fire/hit/destruction events, the fallback remains functional, and measured crowded-battle performance stays within the selected device quality tier.
