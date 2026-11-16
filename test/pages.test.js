'use strict';
// The GitHub Pages browser edition: the build succeeds, leaves no root-absolute paths, and its
// bundled in-page room server plays a solo match through the WebSocket look-alike.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const root=path.join(__dirname,'..'),dist=path.join(root,'dist');

test('the browser edition builds with relative paths only',()=>{
 execFileSync(process.execPath,[path.join(root,'scripts','build-pages.js')],{stdio:'pipe'});
 for(const f of ['index.html','404.html','local.js','game.js','vendor/three.module.js','vendor/three.core.min.js','.nojekyll'])assert.ok(fs.existsSync(path.join(dist,f)),f+' is built');
 const index=fs.readFileSync(path.join(dist,'index.html'),'utf8');
 assert.ok(index.indexOf('src="./local.js"')<index.indexOf('src="./game.js"'),'the in-page server loads before the game');
 assert.ok(!/(src|href)="\/[a-z]/.test(index),'no root-absolute src/href');
 assert.ok(!fs.existsSync(path.join(dist,'sw.js')),'no service worker on Pages');
 const manifest=JSON.parse(fs.readFileSync(path.join(dist,'manifest.webmanifest'),'utf8'));
 assert.equal(manifest.scope,'./');
 assert.ok(!/require\(['"]node:/.test(fs.readFileSync(path.join(dist,'local.js'),'utf8')),'no Node built-ins in the bundle');
});

test('the bundled in-page server runs a solo Territory War and refuses online rooms',async()=>{
 const timers=[];
 const ctx={console,crypto:globalThis.crypto,TextEncoder,performance,queueMicrotask,setTimeout,clearTimeout,
  setInterval:(fn,ms)=>{const t=setInterval(fn,ms);t.unref();timers.push(t);return t}};
 ctx.globalThis=ctx;vm.createContext(ctx);
 for(const f of ['maps.js','catalog.js','local.js'])vm.runInContext(fs.readFileSync(path.join(dist,f),'utf8'),ctx,{filename:f});
 const {Socket,hub}=ctx.HomestandLocal;
 const ws=new Socket(),got=[];ws.onmessage=e=>got.push(JSON.parse(e.data));
 await new Promise(r=>{ws.onopen=r});
 ws.send(JSON.stringify({type:'create',mode:'pvp',scenario:'territory',name:'Ada'}));
 await new Promise(r=>setTimeout(r,10));
 assert.ok(got.some(m=>m.type==='notice'&&/live server/.test(m.message)),'online rooms are explained, not opened');
 assert.equal(hub.rooms.size,0);
 ws.send(JSON.stringify({type:'create',mode:'solo',scenario:'territory',name:'Ada',difficulty:'standard',theatreId:'kano'}));
 await new Promise(r=>setTimeout(r,10));
 const joined=got.find(m=>m.type==='joined');assert.ok(joined,'joined a room');
 const room=hub.rooms.get(joined.code);assert.equal(room.game.phase,'playing');
 assert.ok(got.some(m=>m.type==='state'&&m.me===joined.id),'state snapshots arrive');
 const engineer=room.game.units.find(u=>u.team===0&&u.type==='engineer');
 ws.send(JSON.stringify({type:'command',unitIds:[engineer.id],action:'move',x:engineer.x+80,y:engineer.y}));
 await new Promise(r=>setTimeout(r,10));
 assert.equal(engineer.order,'move','commands reach the simulation');
 const now=performance.now();hub.tick(now);const before=room.game.time;hub.tick(now+400);assert.ok(room.game.time>before,'ticks advance the battle');
 ws.close();for(const t of timers)clearInterval(t);
});
