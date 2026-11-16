'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Game}=require('../src/engine');
const {CIV}=require('../src/civilians');
const maps=require('../public/maps');

function war(){const g=new Game({mode:'pvp',scenario:'territory',prepMinutes:3,theatreId:'kano'});g.addParticipant('d','Defence',0);g.addParticipant('r','Raiders',1);g.start();g.incomeClock=-1e9;g.civClock=-1e9;return g}
const live=g=>{g.territory.stage='live';g.territory.stageTime=0};
const run=(g,seconds)=>{for(let t=0;t<seconds;t+=.05)g.step(.05)};
// Freeze everyone else so a test only exercises the civilians it sets up.
function isolate(g,keep){for(const c of g.civilians)if(!keep.includes(c))c.state='safe';g.units=g.units.filter(u=>u.type==='engineer'&&false)}

test('the town starts with civilians who cannot be taken during the ceasefire',()=>{
 const g=war();
 assert.equal(g.civilians.length,CIV.count);
 assert.ok(g.civilians.every(c=>c.x>650&&c.x<1750),'everyone lives in the contested town');
 const c=g.civilians[0];const raider=g.spawnAt(1,'rifle',c.x+5,c.y);raider.hold=true;
 run(g,4);assert.equal(c.state,'free','no captures before the battle is live');
 assert.equal(g.snapshot().civilians.list.length,CIV.count);
});

test('raiders seize a civilian, escort them home and are paid on delivery',()=>{
 const g=war();live(g);const c=g.civilians[0];isolate(g,[c]);
 const raider=g.spawnAt(1,'rifle',c.x+8,c.y);raider.hold=true;raider.order='hold';
 run(g,CIV.captureTime+.3);
 assert.equal(c.state,'captive');assert.equal(c.by,raider.id);
 assert.equal(raider.order,'move','a full escort heads for the camp automatically');
 const before=g.teams[1].credits;
 const camp=g.campOf(1);raider.x=camp.x+20;raider.y=camp.y;c.x=camp.x+30;c.y=camp.y;run(g,.2);
 assert.equal(c.state,'held');assert.equal(g.civStats.captured,1);
 assert.ok(g.teams[1].credits>=before+CIV.deliveryReward);
});

test('killing the escort frees the captive, and defenders rescue held civilians to safety',()=>{
 const g=war();live(g);const [a,b]=g.civilians;isolate(g,[a,b]);
 const raider=g.spawnAt(1,'rifle',a.x+8,a.y);raider.hold=true;run(g,CIV.captureTime+.3);assert.equal(a.state,'captive');
 g.applyDamage(raider,999,0);run(g,.1);assert.equal(a.state,'fleeing','the captive breaks free when the escort falls');
 const camp=g.campOf(1);b.state='held';b.x=camp.x;b.y=camp.y;g.bases[1].range=0;
 const rescuer=g.spawnAt(0,'rifle',camp.x+10,camp.y);rescuer.hold=true;
 run(g,CIV.rescueTime+.3);assert.equal(b.state,'rescued');assert.equal(rescuer.order,'move');
 const before=g.teams[0].credits;rescuer.x=400;rescuer.y=675;b.x=410;b.y=675;run(g,.2);
 assert.equal(b.state,'safe');assert.equal(g.civStats.rescued,1);assert.ok(g.teams[0].credits>=before+CIV.rescueReward);
 assert.equal(maps.territoryOf('frontier',b),0);
});

test('stray splash fire kills civilians and costs the side that fired; never during the ceasefire',()=>{
 const g=war();const c=g.civilians[3];
 g.strayFire(c.x,c.y,40,500,0);assert.equal(c.state,'free','ceasefire protects everyone');
 live(g);const credits=g.teams[0].credits;g.strayFire(c.x,c.y,40,500,0);
 assert.equal(c.state,'dead');assert.deepEqual(g.civStats.casualties,[1,0]);assert.equal(g.teams[0].credits,credits-CIV.casualtyPenalty);
 assert.ok(g.events.some(e=>/CIVILIAN CASUALTY/.test(e.text)));
 // A shell landing in the street goes through the same path.
 const d=g.civilians[4];d.x=1200;d.y=675;const tank=g.spawnAt(1,'tank',1200,640),target=g.spawnAt(0,'rifle',1200,672);
 g.fire(tank,target,400,460,31);run(g,.5);assert.equal(d.state,'dead');assert.equal(g.civStats.casualties[1],1);
});

test('civilians flee raiders into shelters and come out when it is calm',()=>{
 const g=war();live(g);const c=g.civilians[0];isolate(g,[c]);
 const clinic=g.facilities.find(f=>f.kind==='civilianClinic');c.x=clinic.x+60;c.y=clinic.y;
 const raider=g.spawnAt(1,'tank',c.x+120,c.y);raider.hold=true;
 run(g,4);assert.equal(c.state,'sheltered');assert.ok(!g.snapshot().civilians.list.some(v=>v.id===c.id),'sheltered civilians are hidden');
 g.units=[];run(g,CIV.calm+1.5);assert.equal(c.state,'free');
});

test('AI raiders send snatch teams and the AI defence goes after captives',()=>{
 const g=new Game({mode:'solo',scenario:'territory',difficulty:'veteran',prepMinutes:3,theatreId:'kano'});g.addParticipant('a','A',0,true);g.addParticipant('b','B',1,true);g.start();
 g.territory.prepDuration=1;g.territory.warningDuration=1;let snatched=false,rescuing=false;
 for(let t=0;t<420&&g.phase==='playing';t+=.05){g.step(.05);if(g.units.some(u=>u.team===1&&u.civTask))snatched=true;if(g.units.some(u=>u.team===0&&u.civTask))rescuing=true;if(snatched&&rescuing)break}
 assert.ok(snatched,'raider AI targets civilians');
 assert.ok(rescuing||!g.civilians.some(c=>['captive','held'].includes(c.state)),'defence AI responds to captives');
});
