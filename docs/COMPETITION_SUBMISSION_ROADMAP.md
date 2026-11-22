# HOMESTAND v1 — 2026 Competition Roadmap

**Prepared October 24, 2026.** Official mission promotional copy lists October 31; verify official contest rules/entrant eligibility and exact cutoff. **Internal target: submission-ready October 29**, preserving October 30 as buffer, not as extra feature day.

## North-star experience
A beginner can join/play in two clicks, grasp the objective within 30 seconds, and enjoy exciting original 3D battles. A friend joins by room code, with no app install or registration. Every match ends cleanly and can be replayed. A polished first five minutes beats a complicated game with many unfinished systems.

## Scorecard: objective release gates
| Dimension | Release threshold | How to verify |
| --- | --- | --- |
| Onboarding | Players understand goal and issue first order in <=30 sec; tutorial <=90 sec | 3 first-time user observations + Playwright smoke |
| Multiplayer | Two human browsers create/join via room code; commands/results sync; replay | E2E two-browser protocol test + manual real-device test |
| Visuals | Original cohesive 3D factions and environment; distinct units; legible effects | Real screenshots desktop & mobile, quality review |
| Reliability | No blocker console errors, critical bugs or 404 assets | Fresh-clone unit tests + Render logs + browser QA |
| Performance | Aim >=30 FPS typical mobile, 60 desktop; adaptive quality | Measure in DevTools on representative devices |
| Accessibility | Tap targets, legibility, keyboard, help, and 2D fallback | Mobile portrait/landscape + desktop review |
| Submission | Valid live URL, correct cover & description, participant eligibility, mission completed | Submission checklist reviewed in entrant account |

## October 24 — P0 audit and stabilize
**Do:** baseline full clone, identify/resolve compressed-source/bootstrap fragility (`boot.js`, `source.bundle.b64`), run tests, verify 3D asset paths, WebSockets, Render deployment. Capture baseline screenshots. Create working branch. Confirm contest participant eligibility and Work mission progress.

**Exit:** reproducible source/test pipeline and baseline game still works; no changes to NEON HEIST.

## October 25 — P0 first-time UX
**Do:** new home screen, default Recruit, clear mode choices, two-click Quick Battle, in-game objective/units HUD redesign, contextual tap-to-command. Tutorial steps 1–5 with skippable overlay, gentle tooltips, and non-blocking advice. Phone layout.

**Exit:** new player can recruit and capture first relay without asking how to control the game.

## October 26 — P0 3D art direction and production
**Do:** distinctive faction identity, original higher-quality HQ, rifle/tank/rocket meshes, relay assets, refined terrain and lighting; improved isometric camera, basic animation and selection. Document sources/licensing. Keep 2D fallback and performance guardrails.

**Exit:** one good true gameplay screenshot communicates a premium original strategy game at a glance.

## October 27 — P0 cinematic gameplay polish
**Do:** projectile tracers, impacts, recoil, explosions/particle pooling, capture/strike spectacle, health and damage feedback, victory presentation. Tune Recruit grace period, early bot pressure and training affordances. Avoid gratuitous effects.

**Exit:** impressive visual battle, clear gameplay, no frame stalls in normal scenarios.

## October 28 — P0 multiplayer and responsiveness
**Do:** 2-browser 1v1, no-login join code, state sync, network reconnect, host leave, end/rematch, anti-cheat sanity, input handling, phone landscape and desktop. Load-sanity at one Render replica.

**Exit:** invite a friend and finish/replay a match; no critical crash, softlock or desync. **Feature freeze after this gate.**

## October 29 — P0 final QA and submission package
**Do:** screenshots/recorded real gameplay, 30–60 sec highlight demo, cover and concise project description, updated README, proper credits, asset licenses, QA log and known limitations. Verify actual Render commit and free-tier cold-start behavior; inspect judging URL in a private/incognito browser. Review mission and submit through eligible entrant's Handshake account when ready.

**Exit:** externally accessible, stable, presentation-ready submission. If all gates pass, submit today rather than holding for the final deadline.

## October 30 — safety buffer ONLY
**Do:** fix critical bugs found after freeze, verify Handshake submission receipt/link and eligibility. Avoid new features; check official exact cutoff/time zone. If problems arise, use last stable build + 2D fallback and submit a playable game.

## P0/P1/P2 feature triage
**P0 — indispensable:** room-code multiplayer, solo Recruit, easy controls, 5-step tutorial, legible HUD, deploy stability, good 3D environment+unit clarity, victory/rematch, test coverage, submission.

**P1 — do if P0 working:** striking orbital-strike cinematics, higher quality particle/explosion system, custom faction art/sound, contextual strategy hints, compact mobile minimap, screenshot/demo package.

**P2 — defer after contest:** large campaign, 2v2, co-op mode, matchmaking, clans, global world map, progression system, unit tech tree, accounts/cloud persistence, extra factions/biomes, elaborate customization.

## Strategic guardrails
- Original inspired-by RTS rather than direct clone; honor art, audio, font and model licensing.
- Simplify to three memorable unit types and one easy-to-understand objective loop.
- Never sacrifice app stability for effects; quality settings and 2D fallback mandatory.
- Use Codex as implementation agent; retain decision-making and QA checkpoints, and ensure Handshake ChatGPT Work mission requirements are also fulfilled.
- Avoid claiming first place or guaranteed prize; prioritize the actually observable judge experience.

## Submission rehearsal — 90 seconds
**0–10s:** open a fast premium menu: "Quick Battle" and "Invite Friend" clear.  
**10–30s:** enter Recruit mission; short tip trains first troop and marks center relay.  
**30–60s:** camera follows squads, unit roles obvious, enemy advances; user captures relay, visible feedback.  
**60–75s:** a cinematic strike makes impact but doesn't obscure critical controls.  
**75–90s:** show invite-by-code in second device and synced multiplayer HUD; end or replay affordance.

## Judge-facing checklist
- Working public URL: https://homestand.onrender.com
- GitHub code: https://github.com/blockchaincali/homestand
- Room codes, no login, actual synchronized two-player gameplay
- Three genuine current-build screenshots (start, 3D battle, multiplayer)
- Distinctive cover art, project title and concise description
- README explaining controls and free-tier wakeup/limitations
- Credits and permission rights for all external assets
- Mission completed in required tool; eligibility verified against official rules
- Confirm exact submission deadline and evidence that entry was received