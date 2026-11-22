# HOMESTAND — Defend What Matters

An original browser RTS separate from NEON HEIST. Build armies, capture relays, command units, launch orbital strikes and defeat an AI opponent or a human rival in a private 1v1 room.

**Play it:** [Browser edition (GitHub Pages)](https://blockchaincali.github.io/homestand/) · [Live server with online rooms (Railway)](https://homestand.up.railway.app/)

## Browser edition (GitHub Pages)

A static build that needs no server: every mode against the AI (Territory War, the Defend the North campaign, Operation Safe Haven, quick battles) runs entirely in the page. The room server in `src/rooms.js` and the engine are bundled into `local.js`, and the client talks to them through an in-page socket instead of a WebSocket, so battles play exactly as they do online. Online rooms (versus, co-op) and Vatar features need the Node server.

`.github/workflows/pages.yml` builds and publishes it on every push to `main`. Build it locally with `npm install && node scripts/build-pages.js`, then serve `dist/` from any path.

## Quick start

```bash
npm install
npm start
```

The checked-in JavaScript, styles, tests and assets are the authoritative source. `npm start` launches `server.js` directly; startup never generates or rewrites repository files.

Run the complete test suite with:

```bash
npm test
```

- WebSocket multiplayer server
- Tactical game simulation in `src/engine.js`
- Desktop/mobile client in `public/`
- AI opponent, unit building, 3 capture points and orbital artillery
- Coastal, desert and frozen 3D battlegrounds with a tactical 2D fallback
- Operation Safe Haven, a solo civilian-defense mission with engineer construction, functional defenses, protected patrol production, community facilities, and staged evacuation objectives
- **Defend the North** campaign: six real Nigerian cities (Abuja, Kaduna, Jos, Kano, Damaturu, Maiduguri) with real localities, landmarks, slogans and radio chatter, against a fictional insurgent force
- IEDs for both sides, hidden until swept, and the **Eagle-Eye** scanner that detects, routes around and defuses them
- Procedural WebAudio sound with no audio files
- **Territory War**: two opposing territories, HQ-based start with two engineers, construction plots, 13 structures in three categories, parallel/assisted engineering, playable Community Defence or Raiders vs AI (Easy/Standard/Veteran) or a friend, 5- or 3-minute ceasefire plus a 2-minute threat warning (`docs/TERRITORY_WAR.md`, `docs/ARCHITECTURE_ASSESSMENT.md`)
- Automated tests, original artwork and architecture documentation

## Beginner controls

- Tap or click a cyan unit to select it, then tap terrain to move or a red target to attack.
- `Select All` is always available; desktop shortcuts are `1–3` to recruit, `Q` select all, `M` move, `A` attack-move, `H` hold, and `B` orbital strike.
- Choose **Guided Tutorial** from the home screen, or use the in-battle `?` button to replay it.
- Switch between the Three.js battlefield and the 2D tactical map at any time.

## Defend the North

Open **Missions**, pick a city on the map of Nigeria, choose a threat level and **Deploy**. Every city starts with an Eagle-Eye scanner: sweep the roads before the assault, plant your own charges on enemy approaches (`I`), and defuse what you find (`X`). Design notes, balance values and content guardrails are in `docs/DEFEND_THE_NORTH.md`.

## Operation Safe Haven

Choose **Operation Safe Haven** on the home screen to play the focused civilian-defense mission. Select the engineer, choose a structure, and tap or click clear ground to preview and confirm placement. Barricades block attackers, watchtowers engage them, field clinics heal nearby units, and workshops produce protected patrol vehicles. Preparation is protected until the required defenses are ready or training is explicitly skipped.

Run its browser interaction and performance check with `npm run qa:safe-haven` while the local server is running. Mission details and measured limitations are documented in `docs/SAFE_HAVEN_MISSION.md`.

The current build includes a Three.js battlefield and a fully playable 2D tactical fallback. Run one instance on Render because active room state is held in memory.

Additional browser validation commands are `npm run qa:ux`, `npm run qa:3d`, `npm run qa:world`, and `npm run qa:final`. Start the local server first and set `HOMESTAND_URL` when it is not running at the script default.

## HOMESTAND release notes

HOMESTAND is the game's name everywhere: the package, storage keys, scripts and assets all use `homestand`. The game was first built as Iron Frontier; settings saved under the old `iron-frontier-*` browser keys are moved to the new keys automatically the first time a returning player opens the game. Operation Safe Haven is the civilian-protection mission; the original battlegrounds and private multiplayer remain available.


## Install as an app

HOMESTAND is a Progressive Web App: `manifest.webmanifest`, icons in `public/icons/` and a network-first service worker (`public/sw.js`) that caches the shell for offline start-up and never touches live WebSocket traffic. Chrome and Edge show **Install app** on the home screen; on iPhone use Share → Add to Home Screen. Installed, it opens full screen in landscape; in the browser, launching a battle on a phone requests full screen and a landscape lock where the browser allows it.
