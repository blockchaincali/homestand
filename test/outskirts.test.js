'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Game}=require('../src/engine');
const MAPS=require('../public/maps');
const L=MAPS.layouts.outskirts;
const run=(g,seconds)=>{for(let t=0;t<seconds;t+=.1)g.step(.1)};

test('Frontier Outskirts is a larger map with bases outside the city',()=>{
 assert.deepEqual(MAPS.size('outskirts'),{w:4000,h:2000});assert.deepEqual(MAPS.size('frontier'),{w:2400,h:1350});
 const [def,raid]=L.territories;assert.ok(def.x2<1350&&raid.x1>2650,'territories stop well short of the city');
 for(const c of [...L.compounds,...L.facilities])assert.equal(MAPS.territoryOf('outskirts',c),null,'city buildings sit outside both bases');
 for(const p of L.plots){if(p.team!==null)assert.equal(MAPS.territoryOf('outskirts',p),p.team,p.id+' inside its own base');
  assert.ok(MAPS.clearOfRoads('outskirts',p,p.r*.6),p.id+' off the roads');
  for(const c of L.compounds)assert.ok(Math.hypot(c.x-p.x,c.y-p.y)>p.r+60,p.id+' clear of houses')}
 for(const w of L.walls){const t=L.territories.find(t=>t.team===w.team);assert.ok(w.x1>=t.x1&&w.x2<=t.x2,'walls inside their territory')}
 for(const n of L.checkpointNodes)assert.ok(L.roads.some(r=>r.points.some(([x,y])=>x===n.x&&y===n.y)),n.id+' on a road');
 assert.ok(L.roads.filter(r=>r.surface==='asphalt').every(r=>r.width>=84),'main city streets are wide');
});

test('a match on Frontier Outskirts uses the larger world and the AI builds, upgrades and fights there',()=>{
 const g=new Game({mode:'solo',scenario:'territory',prepMinutes:3,theatreId:'jos',difficulty:'veteran',layout:'outskirts'});
 g.addParticipant('a','A',0,true);g.addParticipant('b','B',1,true);g.start();
 assert.equal(g.mapId,'outskirts');assert.deepEqual(g.snapshot().world,{w:4000,h:2000,bounds:{left:125,right:3875,top:105,bottom:1895}});
 for(const team of [0,1])assert.equal(MAPS.territoryOf('outskirts',g.bases.find(b=>b.team===team&&b.kind==='hq')),team);
 run(g,420);
 for(const team of [0,1])assert.ok(g.structures.filter(s=>s.team===team&&s.hp>0).length>=6,'team '+team+' built a base');
 assert.ok(g.structures.some(s=>(s.level||1)>1),'production upgraded');
 assert.ok(g.nodes.filter(n=>!n.kind).some(n=>n.owner!==-1),'checkpoints contested');
 assert.ok(g.units.every(u=>u.x>=124&&u.x<=3876&&u.y>=104&&u.y<=1896),'units stay on the map');
});

test('the classic Territory War map is unchanged and remains the default',()=>{
 const g=new Game({mode:'solo',scenario:'territory',theatreId:'jos'});g.addParticipant('a','A',0);g.start();
 assert.equal(g.mapId,'frontier');assert.deepEqual(g.snapshot().world.bounds,{left:125,right:2275,top:105,bottom:1245});
});
