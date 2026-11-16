'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Game}=require('../src/engine');
function fresh(level){const g=new Game({mode:'solo',difficulty:level});g.addParticipant('human','Player',0,false);g.addParticipant('bot','Bot',1,true);assert.ok(g.start());return g}
test('Recruit opens with player advantage and a limited enemy force',()=>{
 const recruit=fresh('recruit'),veteran=fresh('veteran');
 assert.equal(recruit.units.filter(u=>u.team===1).length,2);
 assert.equal(veteran.units.filter(u=>u.team===1).length,5);
 assert.ok(recruit.teams[0].credits>recruit.teams[1].credits);
});
test('Recruit AI has no production rush in opening grace period',()=>{
 const g=fresh('recruit');const initial=g.units.filter(u=>u.team===1).length;
 for(let i=0;i<200;i++)g.step(.05);
 assert.ok(g.units.filter(u=>u.team===1).length<=initial);
});
test('Difficulty survives state snapshots and rematches',()=>{
 const g=fresh('standard');assert.equal(g.snapshot().difficulty,'standard');
 g.end(0,'TEST');assert.equal(g.phase,'results');assert.ok(g.start());
 assert.equal(g.snapshot().difficulty,'standard');
});
test('Recruit gives a newcomer force time to secure a first relay',()=>{
 for(let attempt=0;attempt<5;attempt++){
  const g=fresh('recruit');
  assert.equal(g.spawn(0,'rifle').ok,true);
  assert.equal(g.spawn(0,'tank').ok,true);
  const ids=g.units.filter(u=>u.team===0).map(u=>u.id);
  assert.equal(g.command(0,ids,'move',g.nodes[0].x,g.nodes[0].y).ok,true);
  for(let i=0;i<900&&g.phase==='playing';i++)g.step(.05);
  assert.ok(g.nodes.some(node=>node.owner===0),'player should capture a relay inside 45 seconds');
  assert.ok(g.teams[0].credits>=g.teams[1].credits,'player economy should remain competitive');
 }
});
