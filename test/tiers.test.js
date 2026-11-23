'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Game}=require('../src/engine');
const {UNITS,CATALOG}=require('../src/config');
const maps=require('../public/maps');
const L=maps.layouts.frontier;
function war(){const g=new Game({mode:'pvp',scenario:'territory',prepMinutes:5,theatreId:'jos'});g.addParticipant('d','Defence',0);g.addParticipant('r','Raiders',1);g.start();g.incomeClock=-1e9;return g}
const run=(g,seconds)=>{for(let t=0;t<seconds;t+=.05)g.step(.05)};
const plot=id=>L.plots.find(p=>p.id===id);
function finish(g,s){for(let t=0;t<60&&s.status==='building';t+=.05){for(const e of g.units.filter(u=>u.targetId===s.id&&u.order==='construct')){e.x=s.x+s.radius+10;e.y=s.y}g.step(.05)}assert.equal(s.status,'active')}
function upgrade(g,s){assert.equal(g.upgradeStructure(0,s.id).ok,true);run(g,5.2)}

test('every production line has three or more units and tiers 2-3 exist for soldiers and machines',()=>{
 const P=CATALOG.PRODUCTION,soldiers=['rifle','gunner','rpg','sniper'],machines=['patrol','apc','tank','rocket','heavytank','artillery'];
 for(const type of [...soldiers,...machines]){assert.ok(UNITS[type],type);assert.ok(P[type],type);assert.ok(CATALOG.UNIT_NAMES[0][type]&&CATALOG.UNIT_NAMES[1][type],type)}
 assert.deepEqual(soldiers.map(CATALOG.unitLevel),[1,2,2,3]);assert.equal(CATALOG.unitLevel('artillery'),3);assert.equal(CATALOG.unitLevel('heavytank'),2);
});

test('upgrading the barracks unlocks heavier teams level by level, up to level 3',()=>{
 const g=war();g.teams[0].credits=5000;
 const barracks=g.constructionSite(0,'barracks',plot('dA').x,plot('dA').y).structure;finish(g,barracks);
 assert.match(g.produce(0,barracks.id,'gunner').reason,/level 2/);
 upgrade(g,barracks);assert.equal(barracks.level,2);
 assert.equal(g.produce(0,barracks.id,'gunner').ok,true);assert.match(g.produce(0,barracks.id,'sniper').reason,/level 3/);
 const before=g.teams[0].credits;upgrade(g,barracks);assert.equal(barracks.level,3);assert.equal(before-g.teams[0].credits>=160,true,'level 3 costs 160');
 assert.equal(g.produce(0,barracks.id,'sniper').ok,true);
 assert.match(g.upgradeStructure(0,barracks.id).reason,/max level/);
});

test('anti-armour teams hit vehicles harder than infantry',()=>{
 const g=war();const at=g.spawnAt(0,'rpg',1000,600),tank=g.spawnAt(1,'tank',1100,600),rifle=g.spawnAt(1,'rifle',1100,700);
 const hits=[];const fire=g.fire.bind(g);g.fire=(src,target,damage,...rest)=>{if(src===at)hits.push([target.type,damage]);return fire(src,target,damage,...rest)};
 g.ceasefire=()=>false;for(const target of [tank,rifle]){hits.length=0;at.cd=0;at.targetId=target.id;at.order='attack';at.hold=false;for(let i=0;i<40&&!hits.length;i++)g.step(.05);if(hits.length)assert.equal(hits[0][1],UNITS.rpg.damage*(target.type==='tank'?UNITS.rpg.vsArmour:1))}
});

test('campaign (Safe Haven) barracks and workshop also unlock their higher tiers',()=>{
 const g=new Game({mode:'solo',roomCode:'TIERS',difficulty:'recruit',missionId:'safe-haven'});g.addParticipant('p0','Coordinator',0);g.addParticipant('bot','Bot',1,true);g.start();g.tutorialComplete(0);
 const engineer=g.units.find(u=>u.type==='engineer');g.teams[0].credits=5000;
 const build=(type,x,y)=>{const r=g.constructionSite(0,type,x,y,[engineer.id]);assert.equal(r.ok,true,r.reason);engineer.x=x;engineer.y=y;for(let t=0;t<r.structure.buildTime+.2;t+=.05)g.step(.05);return r.structure};
 const barracks=build('barracks',650,760),workshop=build('workshop',650,610);
 assert.match(g.produce(0,barracks.id,'gunner').reason,/level 2/);
 for(const s of [barracks,workshop]){assert.equal(g.upgradeStructure(0,s.id).ok,true);run(g,5.2)}
 assert.equal(g.produce(0,barracks.id,'gunner').ok,true);assert.equal(g.produce(0,workshop.id,'apc').ok,true);
 assert.equal(g.upgradeStructure(0,barracks.id).ok,true);run(g,5.2);assert.equal(barracks.level,3);assert.equal(g.produce(0,barracks.id,'sniper').ok,true);
});
