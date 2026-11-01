# HOMESTAND — Real-time Strategy Game

_Formerly known as Iron Frontier._

An original browser RTS separate from NEON HEIST. Build armies, capture relays, command units, launch orbital strikes and defeat an AI opponent or a human rival in a private 1v1 room.

## Quick start

```bash
npm install
npm start
```

The initial deployment includes a compressed source snapshot in `source.bundle.b64`, unpacked automatically by `boot.js`. Run `node boot.js --extract` to extract the full editable source.

- WebSocket multiplayer server
- Tactical game simulation in `src/engine.js`
- Desktop/mobile client in `public/`
- AI opponent, unit building, 3 capture points and artillery
- Automated tests, original artwork and architecture documentation

Functional 2D prototype; not yet a production 3D RTS. Run one instance on Render free for testing.
