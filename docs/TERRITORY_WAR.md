# Territory War

Asymmetrical RTS mode: **Community Defence** (team 0, west) against the fictional **Black Harmattan Raiders** (team 1, east), with the community's town and two outposts between them. Choose it from **Missions → Territory War**: pick a side, a 5-minute (recommended) or 3-minute preparation and an AI difficulty, then **Play vs AI** or **Host vs friend**. The city skin follows the campaign city selected on the map.

## Modes (`src/modes.js`)

Pick a mode on the Territory War card. All modes share the map, factions, economy, civilians and hacking.

| Mode | Sides | Objective | Defeat |
|---|---|---|---|
| Territory War | Either side; solo, co-op or up to 2v2 | Defence: hold the line for **20 live minutes** or destroy the raider camp. Raiders: take the community HQ before time runs out | Defence: only if its HQ falls. Raiders: if time runs out or their camp falls |
| Rescue Ops | Community Defence vs Raider AI (solo or co-op), 3 min prep | Eight residents start held at the raider camp; free them (rifle squad or patrol beside them for 2 s) and escort **six** home | HQ falls, or too few hostages remain alive to reach six |
| Civilian Survival | Community Defence vs Raider AI (solo or co-op), 3 min prep | Survive 12 live minutes with at least **12 of 24** residents free (free, sheltered or rescued) | HQ falls, more than 12 residents killed, or fewer than 12 free at the end |

Raider AI adapts: in Survival it sends two extra snatch teams and attacks a quarter more often; in Rescue Ops it keeps more fighters home guarding the camp. The objective chip shows live progress (rescued / still held, or time left / residents free).

## First battle: fly-over and field briefing

Each Territory War opens with a short camera fly-over from the enemy camp across the town to your HQ. First-time players then get a six-step field briefing (barracks → collector → training → checkpoint → ready → protect civilians) that advances as they do each step and can be skipped.

## Map (`public/maps.js` → `layouts.frontier`)

| Area | Contents |
|---|---|
| Defence territory (x 125–650) | Command HQ, 10 construction plots, home resource site (Brick kiln) |
| Raider territory (x 1750–2275) | Raider camp HQ, 10 plots, home resource site (Sand pit) |
| Town (x 700–1080) | Clinic, school, market and community centre, homes, market stalls |
| Outposts | North (Tudun Wada) and South (Rafin Gari), exposed to raids |
| Contested ground | North, Central and South checkpoints; two neutral resource sites; four forward plots |
| Routes | North road, central highway, south road; all reach both HQs — no invisible walls |

## Phases

1. **Prepare** (5:00 or 3:00): ceasefire. Build, train, capture neutral checkpoints and stage at the border. Units cannot cross into enemy territory, and no damage is dealt. *Ready* (solo) or both commanders ready (PvP) jumps straight to the warning — never to combat.
2. **Threat warning** (2:00): still a ceasefire. The AI attacker commits to a route; defenders get an intelligence estimate (Easy: confirmed, Standard: ~75% reliable, Veteran: unknown). Solo players may start early; multiplayer cannot skip it.
3. **Live**: full combat, invasion of either territory, orbital strikes, IEDs. There is no score or time limit: **a faction is defeated only when its Command HQ is destroyed**. Lost buildings, units or checkpoints never end the match. The results screen is pushed to both players the instant an HQ falls.

Safe Haven uses the same timing: 5:00 preparation (3:00 configurable on the server), then a 2:00 warning before the first wave.

## Tactics (`src/tactics.js`)

| Feature | Detail |
|---|---|
| Guard stance | Idle combat units scan 300 px for enemy units, move in to engage and return to their post when the threat is gone or they are pulled 560 px away. **Hold** pins a unit in place; any other order returns it to guard. Not during the ceasefire. |
| Eagle-Eye rocket pod | Scanners automatically fire anti-vehicle rockets (34 damage, splash) at any enemy vehicle within 300 px, wherever they are, every 2.2 s. Infantry is left to the rest of the army. |
| Rally points | Select a production building or the HQ → **Rally point** → tap the map. New units head there instead of piling up at the door. |
| Navigation | A 25 px grid of buildings, homes, market stalls and barricades with A* paths and stuck recovery; new units step out onto open ground. |
| Barricades | 116 px walls, horizontal or vertical (**Rotate** button or **R** while placing). They block movement for everyone and may be placed across roads. |
| Threat routes | Warnings and announced assaults draw animated red arrows along the attack road and pop up the route and the buildings most likely to be hit. Safe Haven's evacuation road gets teal arrows. |

## Construction (`public/catalog.js`)

- Every faction starts with a deployed HQ, **two engineers** and three rifle squads. The HQ trains more engineers (120 CR, 6 s).
- Tap **Build**, pick a category tab (Command / Defence / Production) and a structure. Any building fits any free plot (resource sites included), or open ground anywhere in your **build area** (your territory, within 260 px of a checkpoint you hold, or within 200 px of your completed forward structures). Roads stay open: only barricades can be placed across them.
- The nearest free engineer is assigned automatically; select engineers first to choose them. Engineers build different projects in parallel. Tap one of your unfinished buildings with engineers selected to **assist**: rate = Σ 0.65ⁱ (1×, 1.65×, 2.07×, 2.35× cap at four).

| Category | Structures (raider name) | Notes |
|---|---|---|
| Command | Supply Depot (Supply Cache), Resource Collector (Scavenger Yard), Communications Centre (Radio Shack) | Depot +15 army cap (base 20, max 60); collector +5 CR/s anywhere, +8 on a resource site; comms requires Barracks, adds energy and unlocks armour |
| Defence | Barricade, Guard Post (Lookout Post), Watchtower (Sniper Nest), Bunker (Dugout), Weapon Emplacement (Gun Pit), Civilian Shelter (defence only), Field Clinic (Aid Tent) | Bunker needs Barracks; emplacement needs Comms |
| Production | Barracks (Training Camp) → infantry; Vehicle Workshop (Technical Yard) → patrol vehicles, scanners; Armoured Vehicle Factory (Heavy Garage) → tanks, rocket batteries | Workshop needs Barracks; factory needs Workshop + Comms |

Direct recruiting from the HQ is closed in this mode: units come from production buildings.

### Production queues

Every producer (HQ for engineers, barracks, workshop, factory) has a queue of up to 20 orders. Set the quantity (1, 5, 10 or a typed number) before tapping a unit and the building trains them back to back. Each order is charged when it starts, so a queue never spends credits in advance; if supply or credits run short the building shows *Waiting* and resumes automatically. **Clear queue** cancels unstarted orders.

## Civilians, capture and rescue (`src/civilians.js`)

24 residents live in the contested town and go about their day until the battle is live.

| Rule | Detail |
|---|---|
| Panic | Raiders within 150 px or a nearby blast send civilians running to the nearest Civilian Shelter (6 places) or intact community facility (4 places). Sheltered people are hidden and safe; they come out after 14 s of calm. A destroyed shelter turns them out again. |
| Guarding | A civilian within 90 px of any defence unit (except hackers) cannot be seized. |
| Seizing | A raider rifle squad (carries 1) or patrol vehicle (carries 3) standing next to a civilian grabs them in 2.2 s. A full escort heads for the raider camp automatically. Delivery pays raiders 150 CR; each civilian held at the camp moves 1 CR/s from the defence to the raiders. |
| Interception | Destroy the escort and the captive breaks free and runs for shelter. |
| Rescue | Captives are held in a pen deep in raider territory, outside the camp HQ's gun range. A defence rifle squad or patrol beside a held captive frees them in 2.2 s and escorts them home; reaching defence territory or a refuge pays 120 CR. |
| Stray fire | Splash weapons (tank shells, rockets, patrol cannon, orbital strikes, IEDs) hurt any civilian in the blast radius, whichever side fired. Each civilian killed by defence fire costs the defence 60 CR. Plain rifle fire never hits bystanders. Nobody is harmed during the ceasefire. |
| AI | Raider AI sends snatch teams (Easy 1, Standard 2, Veteran 3); defence AI sends rescue teams after captives (Standard 2, Veteran 3), on the same pacing as their first assault. |

The objective chip shows how many civilians are safe, taken and lost; results show civilians safe, captives rescued or seized, and casualties from your own fire.

## Intelligence and electronic warfare (`src/intel.js`)

The Communications Centre (raiders: Radio Shack) trains a **Cyber Team** (raiders: **Hack Cell**): 130 CR, 1 supply, 70 HP, unarmed, 7 s.

| Rule | Detail |
|---|---|
| Intrusion | A hacker within 150 px of an enemy building or HQ (or ordered to attack one) hacks it in 5 s, then cools down for 8 s. Only while the battle is live. |
| Offline (20 s) | Production and queues freeze; defences and HQ guns stop firing; collectors stop earning. Hacked buildings show a red ring and an *OFFLINE · HACKED* tag; hackers show a data beam to their target. |
| Comms hack | The victim is **jammed** for 20 s: scrambled minimap, pings refused. When the defence breaks into the raider Radio Shack it also **intercepts**: every raider IED is exposed and the next assault route is reported as confirmed. |
| Counters | Any of the target side's hackers within 210 px is a **firewall** (the beam turns amber and progress stops). Damaging a hacker resets its progress. |
| AI | Standard keeps 1 hacker, Veteran 2; they travel with assaults and hack whatever they reach. |

Raider systems overall: IED charges, kidnapping and ransom income, hack cells and comms jamming.

## AI (`src/ai.js`)

One `FactionAI` plays either side with the human rules (plots, tech, costs, supply, ceasefire).

| | Easy | Standard | Veteran |
|---|---|---|---|
| Engineers / parallel builds | 2 / 1 | 3 / 2 | 4 / 3 + assisting |
| First assault after ceasefire | ~110 s, 6 supply | ~45 s, 12 supply | ~12 s, 18 supply |
| Route | Always central, announced | Random, announced | Least-defended, split flank, silent |
| Other | No repairs | Repairs, occasional IEDs | Repairs, IEDs, scanners clear charges |

PvP matches never use AI or difficulty scaling.

## Multiplayer: co-commanders, chat and pings

- **Co-op vs AI** (Missions → Territory War → *Co-op vs AI*): the host's room waits in the lobby; one friend joins the host's faction and the AI commands the other side at the chosen difficulty.
- **Versus** (*Host versus*): up to four commanders, two seats per side. Joiners take the side with fewer commanders.
- Commanders on the same side share one army, treasury and supply. Ready-up needs every human commander (vs AI: only your own side). If one co-commander leaves mid-battle, the other keeps command and the match continues.
- **Chat**: team chat by default, *ALL* toggles to everyone; lobby chat goes to everyone. Quick phrases for touch play. Messages are plain text (rendered with `textContent`), capped at 140 characters, stripped of control characters, lightly filtered and limited to 5 messages per 8 seconds. Reconnecting players get the last 40 messages they are allowed to see.
- **Pings**: *Ping* → Attack / Defend / Help / Look, then tap the map. Teammates see a pulsing beacon with your name in 3D, a ring on the minimap and a toast; the other side never sees them. One ping per 1.2 s, coordinates validated.
- Press **Enter** in battle to open chat. The comms panel only appears when more than one human is in the room.

## Server and security

Every connection has a command budget (20 per second, bursts of 40); a flood beyond that is dropped with a single *Too many commands* notice.


`create` validates scenario, faction, prep length (3/5), difficulty and city; the guest of a private room takes the free faction. New `assist` action. Every construction, production, command and strike is validated server-side against faction, plot ownership, build area, tech and ceasefire. Each player only receives their own faction's private events (production, construction) and their own and detected IEDs.

## Performance and network

Snapshots use WebSocket per-message deflate (about 18 KB → 3–4 KB each). On a slow link the server drops a stale snapshot rather than queueing it, the client draws only the newest snapshot per frame, and if no update arrives for 2.5 s the HUD shows *SLOW LINK*; after 7 s the client reconnects to the same room.


Transient effect materials are retired without disposal so the GPU keeps compiled shader programs (disposal caused multi-second recompile stalls in large fights); bullet-impact sparks no longer spawn full blast models; render resolution and shadows drop automatically when the frame rate stays low.

## Tests

`test/territory.test.js` (16 tests) and new cases in `test/rooms.test.js` cover starting state, layout, phase timing, ready-up rules, ceasefire, invasion, plots and tech, build areas, parallel and assisted construction, HQ and building production, supply, raider naming and economy, HQ-only defeat, production queues, rematch, AI legality and difficulty differences, room faction assignment and reconnect.
