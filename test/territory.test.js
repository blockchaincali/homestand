'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Game}=require('../src/engine');
const {STRUCTURES,CATALOG}=require('../src/config');
const maps=require('../public/maps');
const L=maps.layouts.frontier;

// Two human commanders (no AI) so every action in these tests is explicit.
function war({prepMinutes=5,mode='pvp'}={}){const g=new Game({mode,scenario:'territory',prepMinutes,theatreId:'jos'});g.addParticipant('d','Defence',0);g.addParticipant('r','Raiders',1);g.start();g.incomeClock=-1e9;return g}
const run=(g,seconds)=>{for(let t=0;t<seconds;t+=.05)g.step(.05)};
const engineers=(g,team)=>g.units.filter(u=>u.team===team&&u.type==='engineer');
const plot=id=>L.plots.find(p=>p.id===id);
function finish(g,structure){for(let t=0;t<60&&structure.status==='building';t+=.05){for(const e of g.units.filter(u=>u.targetId===structure.id&&u.order==='construct')){e.x=structure.x+structure.radius+10;e.y=structure.y}g.step(.05)}assert.equal(structure.status,'active')}

test('every faction starts with a deployed HQ, two engineers and a guard in its own territory',()=>{
 const g=war();
 assert.equal(g.mapId,'frontier');assert.equal(g.scenario,'territory');
 for(const team of [0,1]){const hq=g.bases.find(b=>b.team===team&&b.kind==='hq');assert.ok(hq);assert.equal(maps.territoryOf('frontier',hq),team);
  assert.equal(engineers(g,team).length,2);assert.equal(g.units.filter(u=>u.team===team&&u.type==='rifle').length,3);
  assert.ok(g.units.filter(u=>u.team===team).every(u=>maps.territoryOf('frontier',u)===team))}
 assert.equal(g.supplyCap(0),CATALOG.BASE_SUPPLY);assert.equal(g.facilities.length,6);assert.ok(g.facilities.every(f=>f.name&&!/outpost(North|South)/.test(f.name)));
 assert.equal(g.facilities.find(f=>f.kind==='market').name,'Terminus Market');
});

test('the layout gives each side ten home plots, a home resource site and shared forward plots',()=>{
 for(const team of [0,1]){assert.equal(L.plots.filter(p=>p.team===team&&p.kind==='base').length,10);assert.equal(L.plots.filter(p=>p.team===team&&p.kind==='resource').length,1)}
 assert.equal(L.plots.filter(p=>p.team===null&&p.kind==='forward').length,4);assert.equal(L.checkpointNodes.length,3);
 assert.deepEqual(Object.keys(L.routes).sort(),['central','north','south']);
});

test('preparation lasts five minutes (or three), then a two-minute warning, then the battle goes live',()=>{
 const g=war();assert.equal(g.territory.stage,'prepare');assert.equal(g.territorySnapshot().remaining,300);
 run(g,299.9);assert.equal(g.territory.stage,'prepare');run(g,.2);assert.equal(g.territory.stage,'warning');
 run(g,119.8);assert.equal(g.territory.stage,'warning');assert.equal(g.ceasefire(),true);run(g,.3);assert.equal(g.territory.stage,'live');assert.equal(g.ceasefire(),false);
 const fast=war({prepMinutes:3});assert.equal(fast.territorySnapshot().remaining,180);
 assert.equal(new Game({scenario:'territory',prepMinutes:9}).prepMinutes,5,'only 3 or 5 minutes are accepted');
});

test('ready-up never skips the warning, and in multiplayer needs both commanders',()=>{
 const g=war();assert.equal(g.completeTraining(0).waiting,true);assert.equal(g.territory.stage,'prepare');assert.equal(g.completeTraining(1).ok,true);assert.equal(g.territory.stage,'warning');
 assert.equal(g.completeTraining(0).ok,false,'the warning cannot be skipped in multiplayer');
 const solo=war({mode:'solo'});solo.completeTraining(0);assert.equal(solo.territory.stage,'warning');solo.completeTraining(0);assert.equal(solo.territory.stage,'live');
});

test('the ceasefire blocks damage, strikes, attack orders and entry into enemy territory',()=>{
 const g=war(),rifle=g.units.find(u=>u.team===0&&u.type==='rifle'),enemy=g.units.find(u=>u.team===1&&u.type==='rifle');
 assert.match(g.command(0,[rifle.id],'move',2000,675).reason,/Ceasefire/);
 assert.match(g.command(0,[rifle.id],'focus',0,0,enemy.id).reason,/Ceasefire/);
 g.teams[0].energy=180;assert.match(g.orbital(0,2000,675).reason,/Ceasefire/);
 assert.equal(g.command(0,[rifle.id],'move',1200,675).ok,true,'the contested ground stays open for staging');
 enemy.x=rifle.x+40;enemy.y=rifle.y;run(g,3);assert.equal(enemy.hp,enemy.maxHp);assert.equal(g.projectiles.length,0);
 // A unit walking toward the border stops at it instead of crossing.
 rifle.x=1700;rifle.y=900;rifle.order='move';rifle.hold=false;rifle.dest={x:1900,y:900};run(g,4);assert.ok(rifle.x<=1750,'stopped at the enemy border');
});

test('once live, units invade the opposing territory and attack its HQ with the same rules',()=>{
 const g=war();g.completeTraining(0);g.completeTraining(1);run(g,120.2);assert.equal(g.territory.stage,'live');
 const squad=g.units.filter(u=>u.team===0&&u.type==='rifle').map(u=>u.id),hq=g.bases.find(b=>b.team===1);
 assert.equal(g.command(0,squad,'focus',0,0,hq.id).ok,true);
 for(const id of squad){const u=g.units.find(v=>v.id===id);u.x=hq.x-120;u.y=hq.y}
 const before=hq.hp;run(g,4);assert.ok(hq.hp<before,'the raider HQ takes damage');
});

test('large buildings fit any free plot or open ground in your territory; enemy plots, roads and missing tech are refused',()=>{
 const g=war();for(let i=0;i<4;i++)g.spawnAt(0,'engineer',300,560+i*30);g.teams[0].credits=5000;g.teams[1].credits=5000;
 assert.match(g.constructionSite(0,'barracks',300,675).reason,/road/i,'never on the highway');
 const open=g.constructionSite(0,'depot',200,1180);assert.equal(open.ok,true,open.reason);assert.equal(open.structure.plotId,null,'open ground works');
 assert.match(g.constructionSite(0,'barracks',plot('rA').x,plot('rA').y).reason,/other faction/);
 const anywhere=g.constructionSite(0,'collector',plot('dJ').x,plot('dJ').y);assert.equal(anywhere.ok,true,'a collector fits an ordinary plot');
 assert.match(g.constructionSite(0,'barracks',2000,980).reason,/territory|other faction/);
 assert.match(g.constructionSite(0,'workshop',plot('dA').x,plot('dA').y).reason,/Requires Barracks/);
 const barracks=g.constructionSite(0,'barracks',plot('dA').x+20,plot('dA').y-10);assert.equal(barracks.ok,true,barracks.reason);assert.equal(barracks.structure.x,plot('dA').x);assert.equal(barracks.structure.plotId,'dA');
 assert.match(g.constructionSite(0,'depot',plot('dA').x,plot('dA').y).reason,/already built/);
 assert.match(g.constructionSite(0,'depot',plot('fNW').x,plot('fNW').y).reason,/checkpoint/);
 const node=g.nodes.find(n=>n.id==='cpN');node.owner=0;node.progress=-100;
 assert.equal(g.constructionSite(0,'depot',plot('fNW').x,plot('fNW').y).ok,true,'holding the checkpoint unlocks the forward plot');
 assert.equal(g.constructionSite(1,'shelter',2000,400).reason,'Your faction cannot build that');
});

test('small defences go anywhere in your build area (plots included) but not across the border or on roads',()=>{
 const g=war();for(let i=0;i<4;i++)g.spawnAt(0,'engineer',300,560+i*30);g.teams[0].credits=5000;
 assert.equal(g.constructionSite(0,'barricade',200,1180).ok,true);
 assert.match(g.constructionSite(0,'barricade',2000,980).reason,/territory/);
 assert.equal(g.constructionSite(0,'guardpost',plot('dB').x,plot('dB').y).ok,true,'plots take any building');
 assert.match(g.constructionSite(0,'guardpost',500,675).reason,/road/i);assert.equal(g.constructionSite(0,'barricade',560,675).ok,true,'barricades may block a road');
 assert.match(g.constructionSite(0,'barricade',1200,675).reason,/territory|blocked/);
});

test('engineers build different structures at the same time, and assisting speeds a build with diminishing returns',()=>{
 const g=war();g.teams[0].credits=5000;const [a,b]=engineers(g,0);
 const barracks=g.constructionSite(0,'barracks',plot('dA').x,plot('dA').y,[a.id]).structure,depot=g.constructionSite(0,'depot',plot('dB').x,plot('dB').y,[b.id]).structure;
 assert.notEqual(barracks.builderId,depot.builderId);
 assert.match(g.constructionSite(0,'clinic',plot('dC').x,plot('dC').y).reason,/busy/);
 a.x=barracks.x+barracks.radius;a.y=barracks.y;b.x=depot.x+depot.radius;b.y=depot.y;run(g,1);
 assert.ok(barracks.progress>.9&&depot.progress>.9,'both projects advance in parallel');
 assert.equal(g.buildRate(1),1);assert.ok(Math.abs(g.buildRate(2)-1.65)<1e-9);assert.ok(g.buildRate(3)<2.1);assert.equal(g.buildRate(9),g.buildRate(CATALOG.ASSIST_MAX));
 // Solo vs assisted timing on fresh projects.
 const h=war();h.teams[0].credits=5000;const [c,d]=engineers(h,0);const solo=h.constructionSite(0,'depot',plot('dA').x,plot('dA').y,[c.id]).structure;c.x=solo.x+solo.radius;c.y=solo.y;
 let tSolo=0;while(solo.status==='building'&&tSolo<30){h.step(.05);tSolo+=.05}
 const pair=h.constructionSite(0,'depot',plot('dB').x,plot('dB').y,[c.id]).structure;assert.equal(h.assistStructure(0,pair.id,[d.id]).ok,true);for(const e of [c,d]){e.x=pair.x+pair.radius;e.y=pair.y}
 let tPair=0;while(pair.status==='building'&&tPair<30){h.step(.05);tPair+=.05}
 assert.ok(Math.abs(tSolo-STRUCTURES.depot.buildTime)<.2,'one engineer: base build time');assert.ok(tPair<tSolo/1.5&&tPair>tSolo/1.7,'two engineers: about 1.65x faster');
 assert.equal(h.assistStructure(1,pair.id,[d.id]).ok,false,'cannot assist the other faction');
});

test('the HQ trains engineers and production buildings make everything else; direct recruiting is closed',()=>{
 const g=war();g.teams[0].credits=5000;
 assert.match(g.spawn(0,'tank').reason,/barracks|workshop|factory/);
 assert.equal(g.spawn(0,'engineer').ok,true,'recruiting an engineer queues it at the HQ');run(g,6.2);assert.equal(engineers(g,0).length,3);
 const barracks=g.constructionSite(0,'barracks',plot('dA').x,plot('dA').y).structure;finish(g,barracks);
 assert.equal(g.produce(0,barracks.id,'tank').ok,false);assert.equal(g.produce(0,barracks.id,'rifle').ok,true);run(g,4.7);
 assert.equal(g.units.filter(u=>u.team===0&&u.type==='rifle').length,4);
 assert.equal(g.produce(1,barracks.id,'rifle').ok,false,'cannot use the other faction’s buildings');
});

test('supply depots raise the army cap and production respects it',()=>{
 const g=war();g.teams[0].credits=5000;assert.equal(g.supplyCap(0),20);
 const depot=g.constructionSite(0,'depot',plot('dA').x,plot('dA').y).structure;finish(g,depot);assert.equal(g.supplyCap(0),35);
 for(let i=0;i<10;i++)g.spawnAt(0,'tank',300,300);assert.ok(g.supply(0)>35);
 const barracks=g.constructionSite(0,'barracks',plot('dB').x,plot('dB').y).structure;finish(g,barracks);assert.match(g.produce(0,barracks.id,'rifle').reason,/supply/i);
});

test('the raider faction has its own named buildings, units and economy',()=>{
 const g=war();g.teams[1].credits=5000;const camp=g.constructionSite(1,'barracks',plot('rA').x,plot('rA').y).structure;finish(g,camp);
 assert.ok(g.events.some(e=>e.text==='TRAINING CAMP READY'));assert.equal(g.produce(1,camp.id,'rifle').ok,true);assert.ok(g.events.some(e=>e.text==='FIGHTERS IN PRODUCTION'));
 const yard=g.constructionSite(1,'collector',plot('res1').x,plot('res1').y).structure;finish(g,yard);g.incomeClock=0;g.teams[1].credits=0;g.teams[0].credits=0;run(g,1.01);
 assert.ok(g.teams[1].credits>g.teams[0].credits,'a collector adds income');
});

test('destroying civilian facilities scores for raiders; a destroyed HQ ends the match',()=>{
 const g=war();g.completeTraining(0);g.completeTraining(1);run(g,120.2);
 const clinic=g.facilities.find(f=>f.kind==='civilianClinic');g.applyDamage(clinic,clinic.hp+1,1);assert.equal(g.teams[1].points,120);assert.equal(g.phase,'playing');
 const hq=g.bases.find(b=>b.team===0);g.applyDamage(hq,hq.hp+1,1);assert.equal(g.phase,'results');assert.deepEqual(g.win,{team:1,reason:'COMMUNITY HQ DESTROYED'});
 g.start();assert.equal(g.phase,'playing');assert.equal(g.territory.stage,'prepare');assert.equal(g.facilities.every(f=>f.hp>0),true,'rematch restores the world');
});

test('the AI builds a real base, respects the ceasefire, and difficulty changes its decisions',()=>{
 const results={};
 for(const level of ['recruit','veteran']){
  const g=new Game({mode:'solo',scenario:'territory',difficulty:level,prepMinutes:3});g.addParticipant('h','Human',0);g.addParticipant('ai','AI',1,true);g.start();
  let crossed=null;for(let t=0;t<600&&g.phase==='playing';t+=.05){g.step(.05);if(crossed===null&&g.units.some(u=>u.team===1&&u.x<1000))crossed=g.territory.stage==='live'?g.territory.liveTime:-1}
  const structures=g.structures.filter(s=>s.team===1);
  assert.ok(structures.length>=5,level+' AI builds a base');assert.ok(structures.every(s=>!s.plotId||plot(s.plotId).team!==0),'only on legal plots');
  assert.ok(crossed===null||crossed>=0,level+' never advances during the ceasefire');results[level]={crossed,structures:structures.length,engineers:engineers(g,1).length};
 }
 assert.ok(results.veteran.crossed!==null&&(results.recruit.crossed===null||results.veteran.crossed<results.recruit.crossed),JSON.stringify(results));
 assert.ok(results.veteran.engineers>results.recruit.engineers,JSON.stringify(results));
});

test('buildings take a production quantity, pay per unit as each starts, and wait instead of failing',()=>{
 const g=war();g.teams[0].credits=5000;const barracks=g.constructionSite(0,'barracks',plot('dA').x,plot('dA').y).structure;finish(g,barracks);
 const depot=g.constructionSite(0,'depot',plot('dB').x,plot('dB').y).structure;finish(g,depot);
 g.teams[0].credits=130;const before=g.units.filter(u=>u.team===0&&u.type==='rifle').length;
 assert.equal(g.produce(0,barracks.id,'rifle',5).queued,5);assert.equal(g.teams[0].credits,70,'only the first unit is paid up front');assert.equal(barracks.queue.length,4);
 run(g,4.6);assert.equal(g.units.filter(u=>u.team===0&&u.type==='rifle').length,before+1);assert.equal(barracks.production?.type,'rifle','the next order starts automatically');
 run(g,4.6);g.teams[0].credits=0;run(g,4.6);assert.equal(barracks.production,null);assert.match(barracks.waiting,/credits/,'the queue waits for money');
 g.teams[0].credits=1000;run(g,.1);assert.ok(barracks.production,'and resumes when it can pay');
 const room=20-barracks.queue.length-1;assert.equal(g.produce(0,barracks.id,'rifle',50).queued,room,'queues cap at 20');assert.match(g.produce(0,barracks.id,'rifle').reason,/full/);
 assert.equal(g.cancelQueue(0,barracks.id).ok,true);assert.equal(barracks.queue.length,0);assert.equal(g.cancelQueue(1,barracks.id).ok,false);
 const snap=g.snapshot();assert.ok(Array.isArray(snap.structures.find(s=>s.id===barracks.id).queue));
});

test('Territory War: the raiders must take the HQ in time - the defence wins by holding the line',()=>{
 const g=war();g.completeTraining(0);g.completeTraining(1);run(g,120.2);g.teams[1].points=99999;run(g,1);assert.equal(g.phase,'playing','score never ends it');
 for(const f of g.facilities)g.applyDamage(f,f.hp+1,1);assert.equal(g.phase,'playing','losing every civilian site is not a defeat');
 assert.equal(g.snapshot().territory.objective.mode,'war');assert.ok(g.snapshot().territory.remaining<=20*60);
 g.territory.liveTime=20*60;run(g,.1);assert.equal(g.win.team,0);assert.match(g.win.reason,/HELD THE LINE/);
 const h=war();h.completeTraining(0);h.completeTraining(1);run(h,120.2);const hq=h.bases.find(b=>b.team===1);h.applyDamage(hq,hq.hp+1,0);assert.deepEqual(h.win,{team:0,reason:'RAIDER CAMP DESTROYED'});
 const r=war();r.completeTraining(0);r.completeTraining(1);run(r,120.2);const home=r.bases.find(b=>b.team===0);r.applyDamage(home,home.hp+1,1);assert.equal(r.win.team,1,'raiders win only by taking the community HQ');
});

test('the Eagle-Eye fires rockets at enemy vehicles within range on its own, but not at infantry or in the ceasefire',()=>{
 const g=war();const scanner=g.spawnAt(0,'scanner',600,500);scanner.hold=true;scanner.order='hold';
 const tank=g.spawnAt(1,'tank',600+280,500);tank.hold=true;tank.order='hold';
 run(g,1);assert.ok(!g.projectiles.some(p=>p.sourceId===scanner.id),'ceasefire');
 g.territory.stage='live';g.projectiles=[];run(g,.1);const rocket=g.projectiles.find(p=>p.sourceId===scanner.id);
 assert.ok(rocket,'rocket launched at 280px');assert.equal(rocket.type,'rocket');assert.equal(rocket.targetId,tank.id);
 g.units=g.units.filter(u=>u!==tank);g.projectiles=[];const rifle=g.spawnAt(1,'rifle',600+250,500);rifle.hold=true;scanner.rocketCd=0;run(g,.1);
 assert.ok(!g.projectiles.some(p=>p.sourceId===scanner.id&&p.type==='rocket'),'infantry is not a rocket target');
});

test('threat reports carry the route path and the names of the likely targets',()=>{
 const g=new Game({mode:'solo',scenario:'territory',difficulty:'recruit',prepMinutes:3,theatreId:'jos'});g.addParticipant('h','H',0);g.addParticipant('ai','AI',1,true);g.start();
 g.completeTraining(0,'h');const threat=g.snapshot().territory.threat;
 assert.ok(threat.route);assert.ok(threat.targets.length>=1&&threat.targets.every(n=>typeof n==='string'&&n.length));
 assert.ok(threat.path.length>=4);assert.equal(threat.path[0].x,g.bases[1].x,'starts at the raider camp');
});
