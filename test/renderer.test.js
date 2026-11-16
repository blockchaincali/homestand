'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {Game}=require('../src/engine');

const renderer=fs.readFileSync(path.join(__dirname,'..','public','3d.js'),'utf8');
const gameUi=fs.readFileSync(path.join(__dirname,'..','public','game.js'),'utf8');
const maps=require('../public/maps');

function match(){const g=new Game({mode:'solo',roomCode:'VFX3'});g.addParticipant('p0','Commander',0);g.addParticipant('bot','Rival AI',1,true);g.start();return g}

test('3D renderer exposes camera, quality, inspection and telemetry controls',()=>{
 for(const api of ['focusSelection','focusObjective','resetCamera','fitBattlefield','viewportCoverage','inspect','screenPoint','metrics','quality'])assert.match(renderer,new RegExp(`${api}[:(]`));
 assert.match(renderer,/webglcontextlost/);
 assert.match(renderer,/InstancedMesh/);
 assert.match(renderer,/powerPreference:'high-performance'/);
});

test('map definitions drive three environments and bounded extended terrain',()=>{
 assert.deepEqual(maps.ids,['coastal','desert','frozen']);
 for(const id of maps.ids){const map=maps.get(id);assert.equal(map.id,id);assert.ok(map.name&&map.description&&Number.isInteger(map.seed))}
 assert.match(renderer,/geo\('plane',220,180\)/);
 assert.match(renderer,/desiredRange-delta\*17,11,86/);
 assert.match(renderer,/cameraBounds\(\)/);
 assert.match(renderer,/addBiomeBoundary\(\)/);
 assert.match(gameUi,/name="battlefield"/);
 assert.match(gameUi,/terrainSeed/);
});

test('3D art uses local original assets and reusable geometry without remote requests',()=>{
 assert.doesNotMatch(renderer,/https?:\/\//);
 assert.match(renderer,/terrainTexture\(\)/);
 assert.match(renderer,/rifleSquad|rocketBattery|hqModel/);
 assert.match(renderer,/coastal-ground-albedo\.jpg/);
 assert.match(renderer,/\$\{name\}-armor-albedo\.jpg/);
 assert.match(renderer,/impact-explosion\.png/);
 for(const asset of ['coastal-ground-albedo.jpg','azure-armor-albedo.jpg','crimson-armor-albedo.jpg','impact-explosion.png']){
  const file=path.join(__dirname,'..','public','assets','3d',asset);
  assert.equal(fs.existsSync(file),true,asset);
  assert.ok(fs.statSync(file).size>20_000,`${asset} should contain production art`);
  assert.ok(fs.statSync(file).size<1_500_000,`${asset} exceeds its runtime budget`);
 }
});

test('2D fallback and contextual input bridge remain wired',()=>{
 assert.match(gameUi,/iron-frontier-view/);
 assert.match(gameUi,/window\.IronBridge=/);
 assert.match(gameUi,/applyViewMode\(\)/);
 assert.match(gameUi,/handleWorldTap/);
 assert.match(gameUi,/active\(\)\)\{if\(t-lastDraw>=200\)/,'3D mode must continue painting the tactical minimap at a bounded cadence');
 assert.match(gameUi,/data\.phase==='lobby'&&rosterChanged/,'multiplayer lobby must rerender when its authoritative roster changes');
 assert.match(gameUi,/code=sess\?\.code\|\|sess\?\.room/,'reconnect must replay the server room-code contract and support legacy sessions');
});

test('high quality mode throttles shadow refresh and caps transient effect families',()=>{
 assert.match(renderer,/shadowMap\.autoUpdate=false/);
 assert.match(renderer,/shadowFrame\+\+%60/);
 for(const effect of ['sparks','smoke','scorch'])assert.match(renderer,new RegExp(`effect=>effect\\.type==='${effect}'`));
});

test('renderer batches detailed entities, pools particles, and disposes lifecycle resources',()=>{
 assert.match(renderer,/mergeGeometries/,'static unit submeshes should be batched');
 assert.match(renderer,/particlePool/,'combat particles should reuse GPU objects');
 assert.match(renderer,/disposeOwnedGeometry/,'merged entity buffers must be released');
 assert.doesNotMatch(renderer,/new THREE\.PointLight/,'transient explosions must not recompile lighting programs');
 assert.match(gameUi,/t-lastDraw>=200/,'the hidden 2D minimap must be throttled while 3D is active');
});
test('Safe Haven renderer keeps construction and town scenery in the optimized entity lifecycle',()=>{
 assert.match(renderer,/structureModel\(s\)/);assert.match(renderer,/facilityModel\(f\)/);assert.match(renderer,/addSafeHavenTown/);assert.match(renderer,/InstancedMesh/);assert.match(renderer,/syncPlacementGhost/);assert.match(renderer,/\['structure',data\.structures\|\|\[\]\]/);
 assert.match(renderer,/\['cache',data\.caches\|\|\[\]\]/);assert.match(renderer,/cacheModel/);
 assert.match(gameUi,/data-structure/);assert.match(gameUi,/placementValid/);assert.match(gameUi,/data-safe-build/);assert.match(gameUi,/landscape-suggestion/);
});

test('projectile snapshots identify their source for authoritative recoil and muzzle VFX',()=>{
 const g=match(),source=g.units.find(unit=>unit.team===0),target=g.units.find(unit=>unit.team===1);
 g.fire(source,target,23,900,0);
 const projectile=g.snapshot().projectiles.at(-1);
 assert.equal(projectile.sourceId,source.id);
 assert.equal(projectile.from,source.team);
 assert.equal(projectile.targetId,undefined,'private targeting data is not leaked in the snapshot');
});
