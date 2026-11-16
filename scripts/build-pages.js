'use strict';
// Builds a static, single-player (vs AI) version of HOMESTAND for GitHub Pages.
// The game engine runs in the browser and a small in-page "server" stands in for
// the WebSocket room server. Live 1v1 rooms still need the Node server (npm start).
// Run `node boot.js --extract` first so the bundled source files exist.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'dist');
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, 'public'), out, { recursive: true });

const rewrite = (file, edits) => {
  const p = path.join(out, file);
  let text = fs.readFileSync(p, 'utf8');
  for (const [from, to] of edits) text = text.split(from).join(to);
  fs.writeFileSync(p, text);
};

// GitHub Pages serves the site from /homestand/, so absolute paths become relative.
rewrite('index.html', [
  ['href="/style.css"', 'href="style.css"'],
  ['href="/3d.css"', 'href="3d.css"'],
  ['<script src="/game.js" defer></script>', '<script src="local-engine.js" defer></script><script src="local-server.js" defer></script><script src="game.js" defer></script>'],
  ['src="/3d.js"', 'src="3d.js"'],
]);
rewrite('game.js', [
  ['src="/assets/', 'src="assets/'],
  ['◆ LIVE 1V1 ROOMS', '◆ BROWSER EDITION'],
]);
rewrite('3d.js', [["from '/vendor/three.module.js'", `from '${THREE_URL}'`]]);

// Wrap the CommonJS engine so it runs in the browser.
const config = fs.readFileSync(path.join(root, 'src', 'config.js'), 'utf8');
const engine = fs.readFileSync(path.join(root, 'src', 'engine.js'), 'utf8');
fs.writeFileSync(path.join(out, 'local-engine.js'), `(function(){
var cfg={exports:{}};
(function(module,exports,require){${config}
})(cfg,cfg.exports,function(n){throw new Error('Missing module '+n)});
var eng={exports:{}};
(function(module,exports,require){${engine}
})(eng,eng.exports,function(n){if(n==='./config')return cfg.exports;throw new Error('Missing module '+n)});
window.HomestandEngine=eng.exports;
})();
`);

fs.copyFileSync(path.join(__dirname, 'local-server.js'), path.join(out, 'local-server.js'));
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log('HOMESTAND static build written to dist/');
