# Defend the North — campaign, IEDs and the Eagle-Eye scanner

## Campaign theatres

Operation Safe Haven is now a six-city campaign, **Defend the North**, chosen from a map of Nigeria in the Command Centre. Each theatre is a real city that has lived through insurgent violence. The street plan is shared; each theatre re-skins it with real places and its own light, soil and landmark.

| # | City (State) | Operation | Localities and landmarks used | Landmark | Threat |
|---|---|---|---|---|---|
| 1 | Abuja (FCT) | Unity Gate | Nyanya, Karu, AYA junction, Abuja–Keffi Expressway, Nyanya General Hospital, Nyanya Motor Park | Granite inselbergs | ×1.0 assault · low IED risk |
| 2 | Kaduna | Crocodile Shield | Kawo, Ungwan Rimi, Barau Dikko Hospital, Murtala Square, Ahmadu Bello Way | Kaduna River and bridge | ×1.1 · elevated |
| 3 | Jos (Plateau) | Plateau Watch | Terminus Market, Rayfield, Plateau Specialist Hospital, Rwang Pam Stadium, Bukuru Expressway | Stacked granite boulders, plateau mist | ×1.15 · elevated · enemy sweepers |
| 4 | Kano | Dala Wall | Kofar Mata dye pits, Kurmi Market, Murtala Specialist Hospital, Zaria Road, Dala Hill | Old city wall and gate, indigo dye pits, harmattan haze | ×1.2 · high · sweepers |
| 5 | Damaturu (Yobe) | Sahel Lantern | Pompomari, Nayinawa, Yobe Specialist Hospital, Potiskum Road | Sahel dunes, water towers | ×1.3 · high · sweepers |
| 6 | Maiduguri (Borno) | Home of Peace | Monday Market, UMTH, Shehu's Palace Square, Gwange, Baga Road, Kano Road | City defence trench and berm | ×1.45 · extreme · sweepers |

Each city also carries its state's real slogan on a roadside welcome board ("Home of Peace", "Centre of Commerce", "Pride of the Sahel" …), Pidgin and Hausa radio chatter, and city-specific wave copy. Stars are stored per city in `localStorage['homestand-campaign']`; a win offers **Next city** on the results screen.

### Content guardrails

- The hostile force, the **Black Harmattan**, is fictional. No real armed group is named or depicted.
- No mission re-enacts a specific real attack, date or set of victims. The player always defends; civilians are never targets the player can harm.
- Real hospitals, markets and squares appear only as places to protect.
- These choices keep the authenticity of real places while avoiding a submission that reads as exploiting real tragedies. They are worth confirming with the Vatar team's content-rating requirements (see `PLATFORM_INTEGRATION.md`).

## Improvised explosive devices (both sides)

| Setting | Value |
|---|---|
| Cost | 45 credits, charged when the charge is placed |
| Planters | Rifle squads and engineers (players); infiltrators and rifle squads (AI) |
| Plant time | 2.2 s on site; arms 2.5 s later |
| Active limit | 6 per side, including charges being planted |
| Trigger | A hostile ground unit within 36 px (Eagle-Eye scanners never trigger) |
| Blast | 110 px radius, 210 damage with falloff; vehicles, structures and buildings take 60% |

- **Hidden information:** the server sends each player only their own charges and hostile charges their scanners have detected (`Game.visibleMines(team)`). A planter's destination is stripped from the shared snapshot so an opponent cannot read where a charge is going.
- **Insurgent infiltrators** bury charges on the roads into town before the first wave and between waves, scaled by the theatre's IED risk.
- **Skirmish AI** plants charges on approaches to relays it holds and fields its own scanner.
- Radio-feed events name the real road a charge was found on or exploded on (e.g. "IED DETONATED - BAGA ROAD").

## Eagle-Eye scanner

A six-wheeled EOD rig with a mine roller and spinning radar dish (110 credits, recruit key **4** in Quick Battle; built at the Vehicle Workshop in the campaign; every campaign starts with one).

- **Detect:** reveals hostile charges within 235 px. A pulsing scan ring shows its reach.
- **Avoid (mark & reroute):** once detected, friendly units automatically steer around the charge, choosing a consistent side so columns flow past it.
- **Defuse:** select the scanner, then tap a marked charge or press **Defuse** (key **X**) for the nearest one. Defusing takes 3.4 s and recovers 30 credits of salvage.
- Enemy sweepers do the same to your charges in Jos, Kano, Damaturu and Maiduguri.

## Controls

| Action | Desktop | Touch |
|---|---|---|
| Plant IED | Select a rifle squad or engineer, press **I**, click the spot | IED button, then tap |
| Defuse | Select scanner, press **X** or click a red-marked charge | Defuse button, or tap the charge |
| Sound on/off | Speaker button | Speaker button |

## Audio

`public/audio.js` synthesises every sound with WebAudio — gunfire, cannon, IED blast, orbital strike, scanner ping, wave alarm, radio squelch and a harmattan-wind ambience. No audio files ship and nothing is downloaded. Mute state persists in `localStorage['homestand-muted']`.

## Tests

`test/ied.test.js` covers planting cost and limits, hidden-information snapshots, detection, detonation and falloff, owner/arming/scanner immunity, defusal and salvage, rerouting around marked charges, theatre identity for all six cities, infiltrator seeding, and workshop production of scanners.
