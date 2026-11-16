'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),Module=require('node:module');
class FakeWebSocket extends EventEmitter{constructor(){super();this.readyState=1;this.received=[];this.alive=true}send(message){this.received.push(JSON.parse(message))}close(){this.readyState=3;this.emit('close')}ping(){this.emit('pong')}receive(payload){this.emit('message',Buffer.from(JSON.stringify(payload)))}last(type){return [...this.received].reverse().find(m=>m.type===type)}}
FakeWebSocket.OPEN=1;
class FakeWSS extends EventEmitter{constructor(){super();this.clients=new Set();globalThis.__testWss=this}connect(){const ws=new FakeWebSocket();this.clients.add(ws);this.emit('connection',ws);return ws}}
const originalLoad=Module._load;Module._load=function(request,parent,isMain){if(request==='ws')return {WebSocket:FakeWebSocket,WebSocketServer:FakeWSS};return originalLoad.call(this,request,parent,isMain)};
const {rooms,server}=require('../server');Module._load=originalLoad;
const wss=globalThis.__testWss;
function create(ws,mode='solo'){ws.receive({type:'create',mode,name:'Tester'});const joined=ws.last('joined');assert.ok(joined);return joined}
test('Solo server creates playable game and relays purchases and commands',()=>{
 const ws=wss.connect(),j=create(ws);const room=rooms.get(j.code);assert.equal(room.game.phase,'playing');assert.equal(room.game.participants.length,2);
 const credits=room.game.teams[0].credits;ws.receive({type:'build',unitType:'rifle'});assert.equal(room.game.teams[0].credits,credits-60);
 const own=room.game.units.find(u=>u.team===0);ws.receive({type:'command',action:'move',unitIds:[own.id],x:700,y:300});assert.equal(own.order,'move');
 ws.receive({type:'ability',x:820,y:450});assert.ok(room.game.blasts.length>0);
 room.game.end(0,'TEST');ws.receive({type:'start'});assert.equal(room.game.phase,'playing');assert.equal(room.game.round,2);
 ws.receive({type:'leave'});assert.equal(ws.room,null);assert.equal(room.game.participants[0].connected,false);
});
test('Online 1v1 host and guest can enter a room and launch',()=>{
 const a=wss.connect(),b=wss.connect();const roomCode=create(a,'pvp').code;
 assert.equal(rooms.get(roomCode).game.phase,'lobby');b.receive({type:'join',code:roomCode,name:'Opponent'});
 assert.equal(b.last('joined').team,1);const room=rooms.get(roomCode);assert.equal(room.game.participants.length,2);
 b.receive({type:'start'});assert.equal(room.game.phase,'lobby');assert.equal(b.last('error').message,'Only host can start');
 a.receive({type:'start'});assert.equal(room.game.phase,'playing');
 const rival=room.game.units.find(u=>u.team===0),own=room.game.units.find(u=>u.team===1);
 b.receive({type:'command',action:'move',unitIds:[rival.id],x:900,y:450});assert.equal(b.last('notice').message,'Select your units first');
 b.receive({type:'command',action:'move',unitIds:[own.id],x:950,y:450});assert.equal(own.order,'move');
});
test('Reconnect from a second socket recovers existing participant instead of creating duplicates',()=>{
 const a=wss.connect();const first=create(a,'pvp');const newcomer=wss.connect();newcomer.receive({type:'join',code:first.code,id:first.id,name:'Tester'});
 assert.equal(newcomer.last('joined').existing,true);assert.equal(rooms.get(first.code).game.participants.length,1);
 assert.equal(a.readyState,3);
});
test('Multiplayer host map and terrain seed are authoritative for every participant',()=>{
 const host=wss.connect(),guest=wss.connect();host.receive({type:'create',mode:'pvp',name:'Host',mapId:'desert'});const joined=host.last('joined');guest.receive({type:'join',code:joined.code,name:'Guest',mapId:'frozen'});
 const hostState=host.last('state'),guestState=guest.last('state');assert.equal(hostState.mapId,'desert');assert.equal(guestState.mapId,'desert');assert.equal(hostState.terrainSeed,guestState.terrainSeed);assert.ok(Number.isInteger(hostState.terrainSeed));
});
test('Solo tutorial protection is authoritative and ends only on trainee command',()=>{
 const ws=wss.connect();ws.receive({type:'create',mode:'solo',difficulty:'recruit',training:true,name:'Trainee'});const joined=ws.last('joined'),room=rooms.get(joined.code);assert.equal(room.game.training,true);room.game.step(5);assert.equal(room.game.time,0);assert.equal(ws.last('state').training,true);
 ws.receive({type:'trainingComplete'});assert.equal(room.game.training,false);assert.equal(ws.last('state').training,false);
});
test('Safe Haven mission identity and construction commands remain server authoritative',()=>{
 const ws=wss.connect();ws.receive({type:'create',mode:'solo',difficulty:'recruit',missionId:'safe-haven',mapId:'frozen',name:'Coordinator'});const joined=ws.last('joined'),room=rooms.get(joined.code),engineer=room.game.units.find(unit=>unit.type==='engineer');assert.equal(room.game.missionId,'safe-haven');assert.equal(room.game.mapId,'safe-haven');assert.equal(room.game.training,true);
 ws.receive({type:'construct',structureType:'barricade',x:420,y:680,builderIds:['forged']});assert.equal(room.game.structures.length,1);assert.equal(room.game.structures[0].team,0);assert.ok(room.game.units.some(unit=>unit.id===room.game.structures[0].builderId&&unit.team===0&&unit.type==='engineer'),'forged ids never build; the server assigns one of your own engineers');ws.receive({type:'construct',structureType:'watchtower',x:4000,y:680});assert.match(ws.last('notice').message,/boundary/i);assert.equal(room.game.structures.length,1);
});
test('Territory War rooms honour the chosen faction, give the guest the other side and validate options',()=>{
 const solo=wss.connect();solo.receive({type:'create',mode:'solo',scenario:'territory',faction:'raiders',prepMinutes:3,difficulty:'veteran',theatreId:'kano',name:'Raider'});
 const room=rooms.get(solo.last('joined').code),g=room.game;assert.equal(g.scenario,'territory');assert.equal(g.mapId,'frontier');assert.equal(solo.last('joined').team,1);
 assert.equal(g.participants.find(p=>p.bot).team,0,'the AI takes the defence');assert.equal(g.territory.prepDuration,180);assert.equal(g.theatreId,'kano');assert.equal(g.difficulty,'veteran');
 const state=solo.last('state');assert.equal(state.team,1);assert.equal(state.territory.stage,'prepare');assert.equal(state.teams[1].supplyCap,20);
 solo.receive({type:'build',unitType:'engineer'});assert.equal(g.bases.find(b=>b.team===1).production?.type,'engineer');
 solo.receive({type:'construct',structureType:'barracks',x:0,y:0,plotId:'rA'});assert.ok(g.structures.some(s=>s.team===1&&s.plotId==='rA'));
 solo.receive({type:'construct',structureType:'depot',x:0,y:0,plotId:'dA'});assert.match(solo.last('notice').message,/other faction/);
 const host=wss.connect(),guest=wss.connect();host.receive({type:'create',mode:'pvp',scenario:'territory',faction:'raiders',prepMinutes:7,name:'Host'});const code=host.last('joined').code;
 guest.receive({type:'join',code,name:'Guest'});assert.equal(guest.last('joined').team,0);const pvp=rooms.get(code).game;assert.equal(pvp.prepMinutes,5,'invalid prep falls back to five minutes');
 host.receive({type:'start'});assert.equal(pvp.phase,'playing');host.receive({type:'trainingComplete'});assert.equal(pvp.territory.stage,'prepare');guest.receive({type:'trainingComplete'});assert.equal(pvp.territory.stage,'warning');
 // Reconnect restores the same faction and match.
 const id=guest.last('joined').id,again=wss.connect();again.receive({type:'join',code,id});assert.equal(again.last('joined').team,0);assert.equal(again.last('state').territory.stage,'warning');
});
test('the results state is pushed to players the moment a match ends, without any player action',()=>{
 const ws=wss.connect();ws.receive({type:'create',mode:'solo',scenario:'territory',name:'Watcher'});const room=rooms.get(ws.last('joined').code);ws.received.length=0;
 room.game.end(1,'COMMUNITY HQ DESTROYED');
 return new Promise(resolve=>setTimeout(resolve,200)).then(()=>{assert.ok(ws.received.some(m=>m.type==='state'&&m.phase==='results'),'results broadcast without an action')});
});
