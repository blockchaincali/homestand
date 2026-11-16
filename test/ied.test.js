'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Game}=require('../src/engine');
const {IED,UNITS}=require('../src/config');
const maps=require('../public/maps');

// A quiet skirmish: the bot never acts, so tests drive every unit explicitly.
function quiet(){const g=new Game({mode:'pvp',roomCode:'IEDS'});g.addParticipant('a','A',0);g.addParticipant('b','B',1);g.start();g.units=[];g.teams.forEach(t=>{t.credits=600});g.incomeClock=-1e9;return g}
const place=(g,team,type,x,y)=>{const u=g.spawnAt(team,type,x,y);u.hold=true;u.order='hold';return u};
const run=(g,seconds)=>{for(let i=0;i<seconds/0.05;i++)g.step(0.05)};

test('a rifle squad walks to the site, plants a charge and pays for it',()=>{
 const g=quiet(),rifle=place(g,0,'rifle',700,500);
 assert.equal(g.plantIed(0,[rifle.id],800,520).ok,true);
 run(g,4.5);
 assert.equal(g.mines.length,1);assert.equal(g.mines[0].team,0);assert.equal(g.teams[0].credits,600-IED.cost);
 assert.equal(g.stats[0].planted,1);assert.equal(rifle.order,'hold');
});

test('only rifle squads and engineers can plant, within the active-charge limit',()=>{
 const g=quiet(),tank=place(g,0,'tank',700,500),rifle=place(g,0,'rifle',700,560);
 assert.equal(g.plantIed(0,[tank.id],800,520).ok,false);
 for(let i=0;i<IED.maxActive;i++)g.mines.push({id:'m'+i,team:0,x:300+i*80,y:300,armedAt:0,revealed:[false,false]});
 assert.match(g.plantIed(0,[rifle.id],900,900).reason,/limit/);
});

test('charges stay hidden from the other side until an Eagle-Eye scanner sweeps them',()=>{
 const g=quiet();g.mines.push({id:'x',team:1,x:1000,y:600,armedAt:0,revealed:[false,false]});
 assert.equal(g.visibleMines(0).length,0);assert.equal(g.visibleMines(1).length,1);
 assert.equal(g.snapshot(0).mines.length,0,'snapshot for the victim side must not leak the charge');
 place(g,0,'scanner',1000-UNITS.scanner.scan+20,600);run(g,.1);
 assert.equal(g.visibleMines(0).length,1);assert.equal(g.stats[0].detected,1);
});

test('an armed charge detonates under a hostile vehicle and damages everything nearby',()=>{
 const g=quiet();g.mines.push({id:'x',team:1,x:1000,y:600,armedAt:0,revealed:[false,false]});
 const victim=place(g,0,'rifle',1000,600),bystander=place(g,0,'rifle',1060,600),far=place(g,0,'rifle',1400,600);
 run(g,.1);
 assert.equal(g.mines.length,0);assert.ok(g.blasts.some(b=>b.kind==='ied'));
 assert.ok(!g.units.includes(victim)||victim.hp<victim.maxHp);assert.ok(bystander.hp<bystander.maxHp);assert.equal(far.hp,far.maxHp);
});

test('charges do not trigger for their owner, before arming, or under a scanner',()=>{
 const g=quiet();g.mines.push({id:'own',team:0,x:600,y:600,armedAt:0,revealed:[false,false]},{id:'cold',team:1,x:900,y:600,armedAt:99,revealed:[false,false]},{id:'eod',team:1,x:1200,y:600,armedAt:0,revealed:[false,false]});
 place(g,0,'rifle',600,600);place(g,0,'rifle',900,600);place(g,0,'scanner',1200,600);
 run(g,.1);assert.deepEqual(g.mines.map(m=>m.id).sort(),['cold','eod','own']);
});

test('a scanner defuses a revealed charge and recovers salvage credits',()=>{
 const g=quiet();g.mines.push({id:'x',team:1,x:1000,y:600,armedAt:0,revealed:[false,false]});
 const scanner=place(g,0,'scanner',800,600);
 assert.equal(g.defuseIed(0,[scanner.id]).ok,false,'cannot defuse what has not been detected');
 run(g,.1);assert.equal(g.defuseIed(0,[scanner.id]).ok,true);
 run(g,8);
 assert.equal(g.mines.length,0);assert.equal(g.stats[0].defused,1);assert.equal(g.teams[0].credits,600+IED.salvage);
});

test('units route around revealed hostile charges instead of driving over them',()=>{
 const g=quiet();g.mines.push({id:'x',team:1,x:1000,y:600,armedAt:0,revealed:[true,false]});
 const rifle=place(g,0,'rifle',800,600);assert.equal(g.command(0,[rifle.id],'move',1200,600).ok,true);
 let closest=Infinity;for(let i=0;i<120;i++){g.step(.05);closest=Math.min(closest,Math.hypot(rifle.x-1000,rifle.y-600))}
 assert.equal(g.mines.length,1,'the marked charge must survive the detour');assert.ok(closest>IED.trigger);assert.ok(rifle.x>1100);
});

test('a planter\'s destination is not broadcast to the opposing commander',()=>{
 const g=quiet(),rifle=place(g,0,'rifle',700,500);g.plantIed(0,[rifle.id],900,520);
 assert.equal(g.snapshot(1).units.find(u=>u.id===rifle.id).dest,null);
});

test('every Safe Haven theatre is a real Nigerian city with its own facilities and roads',()=>{
 assert.deepEqual(maps.theatreIds,['abuja','kaduna','jos','kano','damaturu','maiduguri']);
 for(const id of maps.theatreIds){
  const t=maps.theatre(id),g=new Game({mode:'solo',missionId:'safe-haven',theatreId:id});g.addParticipant('p','P',0);g.addParticipant('bot','Bot',1,true);g.start();
  assert.equal(g.snapshot().theatreId,id);assert.equal(g.facilities.find(f=>f.kind==='market').name,t.facilities.market);assert.equal(g.nodes[0].name,t.nodes[0]);
  assert.ok(g.units.some(u=>u.type==='scanner'),'each theatre starts with an Eagle-Eye scanner');
  for(const road of maps.layouts['safe-haven'].roads)assert.ok(t.roads[road.id]||!['highway','avenue','evacuation','school-road','market-street'].includes(road.id));
 }
 assert.equal(new Game({mode:'solo',missionId:'safe-haven',theatreId:'atlantis'}).theatreId,'abuja');
 assert.equal(new Game({mode:'solo',mapId:'desert'}).theatreId,null);
});

test('northern theatres seed hidden insurgent charges on the roads into town',()=>{
 const g=new Game({mode:'solo',missionId:'safe-haven',theatreId:'maiduguri'});g.addParticipant('p','P',0);g.addParticipant('bot','Bot',1,true);g.start();
 const charges=g.mines.filter(m=>m.team===1);assert.ok(charges.length>=2);
 assert.ok(charges.every(m=>m.x>=1000&&m.x<=1980));assert.equal(g.visibleMines(0).length,0);
 assert.match(g.placeName(charges[0]),/ROAD|WAY|LANE/);
});

test('the workshop can produce Eagle-Eye scanners',()=>{
 const g=new Game({mode:'solo',missionId:'safe-haven',theatreId:'jos'});g.addParticipant('p','P',0);g.addParticipant('bot','Bot',1,true);g.start();
 g.structures.push({id:'w',team:0,type:'workshop',x:600,y:400,hp:720,maxHp:720,radius:48,status:'active',progress:10,buildTime:10,level:1,cd:0,production:null,upgradeProgress:0});
 const before=g.units.filter(u=>u.type==='scanner').length;assert.equal(g.produce(0,'w','scanner').ok,true);g.training=false;g.mission.stage='protect';run(g,7.5);
 assert.equal(g.units.filter(u=>u.type==='scanner'&&u.team===0).length,before+1);
});
