# Release performance and tutorial stabilization

Validated locally on October 26, 2026 with installed Chromium, WebGL 2 through ANGLE, and Intel UHD Graphics 620. Measurements are from the same 120-second scripted match workload before and after the fixes. The workload continuously recruited units, issued movement and attack commands, triggered orbital strikes, and exercised a rematch when the first battle ended.

## Measured results

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Effective average frame rate | 23.3 FPS | 59.3 FPS | 2.54x |
| 1% low frame rate | 30.0 FPS* | 59.2 FPS | +97% |
| Long-task time | 77.91 s | 1.14 s | -98.5% |
| Longest task | 6.60 s | 0.88 s | -87% |
| Input-to-paint average | 138.2 ms | 32.8 ms | -76% |
| Average draw calls | 957 | 526 | -45% |
| Peak draw calls | 1,617 | 803 | -50% |
| Shader/program query time | 76.12 s | 0.73 s | -99% |
| DOM mutation records | 17,238 | 1,221 | -93% |
| Ending JavaScript heap | 25.4 MB | 16.9 MB | -33% |

*The original 1% low calculation excluded multi-second stalls and therefore overstated baseline smoothness. The effective average uses all observed frames and is the reliable baseline comparison. The corrected after run recorded a 16.9 ms p99 frame interval after warm-up, with one 1.12-second startup frame.

Artifacts are written to `artifacts/release-performance/`. The final report is `after-final.json`; its streamed DevTools trace is `after-final-trace.json.gz`. The baseline equivalents are `before.json` and `before-trace.json.gz`.

## Changes responsible

- Static entity geometry is merged by shared material while animated, selectable, health, badge, recoil, and capture components remain independent.
- Explosion sparks and smoke use reusable point-buffer pools instead of allocating many meshes and materials per impact.
- Dynamic explosion point lights were removed because changing light combinations forced repeated shader-program work. Additive impact sprites preserve the visible flash.
- HUD text, objectives, feed, buttons, and guidance update only when their state changes; the 2D tactical minimap beneath the 3D view refreshes at 5 Hz.
- Renderer-owned textures, materials, merged geometry, animation frames, observers, and WebGL resources are explicitly released on unmount.
- Constrained devices automatically start in balanced quality, while the user may still select high quality.
- Server snapshots run at a 150 ms cadence instead of 120 ms. Snapshot traffic was not lower in the final run because its battle contained more units, effects, and a rematch; no network-bandwidth improvement is claimed.

## Tutorial protection

Solo guided training is now an authoritative engine state. During training, the battle clock is frozen, enemy AI and weapons are inactive, enemy units cannot capture or contest relays, player damage is rejected, score victory is suspended, and beginner resources have a safe floor. Completing or skipping training sends an explicit server command, resets the battle clocks, and activates normal AI behavior. Multiplayer cannot enter training mode.

The engine regression runs three simulated minutes under protection and verifies unchanged player health, no enemy relay ownership, adequate resources, successful recruitment and capture, then confirms normal time and AI resume. The browser UX flow independently verifies the authoritative state before completing and skipping the tutorial.

## Limits

- These figures describe one local browser/GPU configuration, not every integrated GPU or the deployed network path.
- A cold shader/scene warm-up remains visible in the maximum frame time. Sustained performance after warm-up met the 30 FPS goal in this run.
- High quality remains more expensive than the automatic balanced tier. Balanced preserves models, combat effects, and gameplay readability but disables dynamic shadows and lowers pixel density.
- The test used browser touch emulation rather than a physical mobile device.
