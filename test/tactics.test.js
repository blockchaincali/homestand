'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Game}=require('../src/engine');
const {GUARD}=require('../src/tactics');

function war(){const g=new Game({mode:'pvp',scenario:'territory',prepMinutes:3,theatreId:'kano'});g.addParticipant('d','D',0);g.addParticipant('r','R',1);g.start();g.incomeClock=-1e9;g.civilians=[];g.bases.forEach(b=>b.range=0);return g}
const run=(g,s)=>{for(let t=0;t<s;t+=.05)g.step(.05)};
const live=g=>{g.territory.stage='live';g.territory.stageTime=0};

test('idle units spot enemies within scan range, engage, and return to their post',()=>{
 const g=war();live(g);g.units=[];const tank=g.spawnAt(0,'tank',600,400);tank.order='hold';tank.hold=true;
 const raider=g.spawnAt(1,'rifle',600+GUARD.scan-20,400);raider.order='hold';raider.hold=true;raider.stance='hold';
 run(g,.1);assert.equal(tank.order,'engage');assert.equal(tank.targetId,raider.id);
 run(g,6);assert.ok(!g.units.includes(raider),'the threat is destroyed');
 run(g,8);assert.ok(Math.hypot(tank.x-600,tank.y-400)<30,'back at its post');assert.equal(tank.order,'hold');
});

test('Hold keeps a unit in place, and nothing engages during the ceasefire',()=>{
 const g=war();g.units=[];const a=g.spawnAt(0,'rifle',600,400),b=g.spawnAt(1,'rifle',600+200,400);b.hold=true;b.stance='hold';
 g.command(0,[a.id],'hold');run(g,1);assert.equal(a.order,'hold','ceasefire');
 live(g);run(g,.2);assert.equal(a.order,'hold','hold stance never chases');assert.ok(Math.hypot(a.x-600,a.y-400)<2);
 g.command(0,[a.id],'stop');run(g,.1);assert.equal(a.order,'engage','guard stance does');
});

test('production buildings send new units to their rally point',()=>{
 const g=war();g.teams[0].credits=5000;const hq=g.bases[0];assert.ok(g.setRally(0,hq.id,500,300).ok);
 assert.equal(g.setRally(1,hq.id,500,300).ok,false,'only your own buildings');
 g.produce(0,hq.id,'engineer');run(g,7);const fresh=g.units.filter(u=>u.team===0&&u.type==='engineer').at(-1);
 assert.equal(fresh.order,'attackmove');assert.deepEqual(fresh.dest&&{x:Math.round(g.bases[0].rally.x),y:Math.round(g.bases[0].rally.y)},{x:500,y:300});
});

test('units route around buildings instead of grinding into them',()=>{
 const g=war();g.teams[0].credits=9000;for(let i=0;i<4;i++)g.spawnAt(0,'engineer',200,600+i*20);
 const eng=()=>g.units.find(u=>u.team===0&&u.type==='engineer'&&u.order!=='construct').id;
 for(const [x,y] of [[440,520],[440,830]]){const r=g.constructionSite(0,'barracks',x,y,[eng()]);const s=r.structure;s.status='active';s.hp=s.maxHp}
 g.units=g.units.filter(u=>u.team!==0);const rifle=g.spawnAt(0,'rifle',360,520);
 assert.ok(g.segmentBlocked({x:360,y:520},{x:540,y:520}),'the straight line hits the barracks');
 g.command(0,[rifle.id],'move',540,520);run(g,8);assert.ok(Math.hypot(rifle.x-540,rifle.y-520)<25,'arrived: '+Math.round(rifle.x)+','+Math.round(rifle.y));
});

test('barricades are rotatable walls that units cannot pass through',()=>{
 const g=war();g.teams[0].credits=5000;const eng=g.units.find(u=>u.team===0&&u.type==='engineer');
 const r=g.constructionSite(0,'barricade',600,950,[eng.id],null,1);assert.ok(r.ok,r.reason);const wall=r.structure;wall.status='active';wall.hp=wall.maxHp;assert.equal(wall.rot,1);
 const [a,b]=g.wallSegment(wall);assert.equal(a.x,b.x,'vertical');
 g.units=[];live(g);const runner=g.spawnAt(1,'rifle',650,950);runner.stance='hold';runner.order='move';runner.hold=false;runner.dest={x:520,y:950};runner.path=null;
 let crossed=false;for(let t=0;t<6;t+=.05){const before=runner.x;g.step(.05);if(before>=600&&runner.x<600&&runner.y>a.y-8&&runner.y<b.y+8)crossed=true}
 assert.ok(!crossed,'never cuts straight through the wall');assert.ok(runner.x<590,'went around: '+Math.round(runner.x)+','+Math.round(runner.y));
});
