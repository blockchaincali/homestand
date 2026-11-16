'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Game}=require('../src/engine');
const {MODES}=require('../src/modes');

function mode(variant,difficulty='standard'){const g=new Game({mode:'solo',scenario:'territory',variant,difficulty,theatreId:'jos'});g.addParticipant('h','Human',0);g.addParticipant('ai','AI',1,true);g.start();return g}
const live=g=>{g.territory.stage='live';g.territory.stageTime=0};

test('modes keep Territory War rules and only change the objective',()=>{
 const war=mode('war');assert.equal(war.variant,'war');assert.equal(war.territory.objective,undefined);
 const odd=new Game({scenario:'territory',variant:'nonsense'});assert.equal(odd.variant,'war');
 const r=mode('rescue');assert.equal(r.prepMinutes,3);assert.equal(r.snapshot().territory.objective.mode,'rescue');assert.equal(r.snapshot().variant,'rescue');
});

test('Rescue Ops starts with hostages at the raider camp and is won by bringing six home',()=>{
 const g=mode('rescue');const held=g.civilians.filter(c=>c.state==='held');assert.equal(held.length,MODES.rescue.hostages);
 assert.ok(held.every(c=>c.x>1750),'hostages are inside raider territory');
 live(g);g.ais.clear();g.civStats.rescued=MODES.rescue.target;g.step(.05);
 assert.equal(g.phase,'results');assert.equal(g.win.team,0);assert.match(g.win.reason,/RESCUED/);
});

test('Rescue Ops is lost when too few hostages survive',()=>{
 const g=mode('rescue');live(g);g.ais.clear();for(const c of g.civilians.filter(c=>c.state==='held').slice(0,3))c.state='dead';
 g.step(.05);assert.equal(g.phase,'results');assert.equal(g.win.team,1);
});

test('Civilian Survival is won by keeping enough residents free to the end, lost by casualties',()=>{
 const g=mode('survival');live(g);g.ais.clear();g.territory.liveTime=MODES.survival.liveSeconds-.01;g.step(.05);
 assert.equal(g.phase,'results');assert.equal(g.win.team,0);assert.match(g.win.reason,/SURVIVED/);
 const lost=mode('survival');live(lost);lost.ais.clear();lost.civilians.slice(0,13).forEach(c=>c.state='dead');lost.step(.05);
 assert.equal(lost.win.team,1);assert.match(lost.win.reason,/KILLED/);
});

test('survival raiders hunt civilians harder than in Territory War',()=>{
 const a=mode('war','veteran'),b=mode('survival','veteran');
 assert.ok(b.ais.get(1).p.snatch>a.ais.get(1).p.snatch);assert.ok(b.ais.get(1).p.attackEvery<a.ais.get(1).p.attackEvery);
});
