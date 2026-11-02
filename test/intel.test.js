'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Game}=require('../src/engine');
const {HACK}=require('../src/intel');

function war(){const g=new Game({mode:'pvp',scenario:'territory',prepMinutes:3,theatreId:'kano'});g.addParticipant('d','Defence',0);g.addParticipant('r','Raiders',1);g.start();g.incomeClock=-1e9;g.civilians=[];return g}
const live=g=>{g.territory.stage='live';g.territory.stageTime=0};
const run=(g,s)=>{for(let t=0;t<s;t+=.05)g.step(.05)};
function built(g,team,type,x,y){const s=g.constructionSite(team,type,x,y,[g.units.find(u=>u.team===team&&u.type==='engineer').id]);assert.ok(s.ok,s.reason);const st=g.structures.at(-1);st.status='active';st.progress=st.buildTime;st.hp=st.maxHp;return st}

test('comms centres train hackers; the catalogue names them per faction',()=>{
 const g=war();g.teams[0].credits=5000;built(g,0,'barracks',440,520);const comms=built(g,0,'comms',440,830);
 assert.ok(g.produce(0,comms.id,'hacker').ok);run(g,7.5);
 assert.ok(g.units.some(u=>u.team===0&&u.type==='hacker'));
 const CATALOG=require('../public/catalog');assert.equal(CATALOG.UNIT_NAMES[1].hacker,'Hack Cell');
});

test('a hacker takes a building offline: no production, no fire, then it recovers',()=>{
 const g=war();live(g);g.bases.forEach(b=>b.range=0);g.units=g.units.filter(u=>u.type==='engineer');
 g.teams[1].credits=5000;const camp=built(g,1,'barracks',1960,520);camp.production={type:'rifle',progress:1,duration:30};g.units=g.units.filter(u=>u.team===0);
 const hacker=g.spawnAt(0,'hacker',camp.x-camp.radius-60,camp.y);hacker.hold=true;hacker.order='hold';
 run(g,HACK.time+.3);assert.ok(camp.hackedUntil>g.time,'barracks hacked');
 const progress=camp.production?.progress;run(g,3);assert.equal(camp.production?.progress,progress,'production frozen while offline');
 assert.ok(g.snapshot().structures.find(s=>s.id===camp.id).hacked>0);
 g.units=g.units.filter(u=>u!==hacker);run(g,HACK.duration);assert.ok(!(camp.hackedUntil>g.time));
 camp.production.duration=camp.production.progress+1;run(g,2);assert.ok(g.units.some(u=>u.team===1&&u.type==='rifle'),'production resumes');
});

test('a friendly hacker near the target is a firewall, and damage interrupts an intrusion',()=>{
 const g=war();live(g);g.bases.forEach(b=>b.range=0);g.units=g.units.filter(u=>u.type==='engineer');
 const tower=built(g,1,'guardpost',1900,780);
 const attacker=g.spawnAt(0,'hacker',tower.x-120,tower.y);attacker.hold=true;attacker.order='hold';
 const guard=g.spawnAt(1,'hacker',tower.x+60,tower.y);guard.hold=true;guard.order='hold';
 run(g,HACK.time+1);assert.ok(!(tower.hackedUntil>g.time),'firewall blocks');assert.ok(g.events.some(e=>/FIREWALL/.test(e.text)));
 g.units=g.units.filter(u=>u!==guard);run(g,2);g.applyDamage(attacker,5,1);run(g,.1);assert.ok(!attacker.hack||attacker.hack.progress<.2,'a hit resets the hack');assert.ok(g.events.some(e=>/INTERRUPTED/.test(e.text)));
});

test('hacking the raider radio shack jams them, exposes their charges and reports the route',()=>{
 const g=war();live(g);g.bases.forEach(b=>b.range=0);g.units=g.units.filter(u=>u.type==='engineer');
 g.teams[1].credits=5000;built(g,1,'barracks',1960,520);const shack=built(g,1,'comms',1960,830);
 g.mines.push({id:'m1',team:1,x:1500,y:675,armed:true,revealed:[false,true],age:9});
 const hacker=g.spawnAt(0,'hacker',shack.x-shack.radius-60,shack.y);hacker.hold=true;hacker.order='hold';
 run(g,HACK.time+.3);
 assert.ok(g.jammed(1));assert.equal(g.mines[0].revealed[0],true);assert.equal(g.territory.threat.intercepted,true);
 assert.ok(g.snapshot().intel.jammed[1]>0);
});

test('no hacking during the ceasefire',()=>{
 const g=war();const st=built(g,1,'barracks',1960,520);const h=g.spawnAt(0,'hacker',st.x-st.radius-60,st.y);h.hold=true;
 run(g,HACK.time+1);assert.ok(!(st.hackedUntil>g.time));
});
