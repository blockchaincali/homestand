'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),Module=require('node:module');
class FakeWebSocket extends EventEmitter{constructor(){super();this.readyState=1;this.received=[];this.bufferedAmount=0}send(m){this.received.push(JSON.parse(m))}close(){this.readyState=3;this.emit('close')}ping(){}terminate(){this.close()}
 receive(msg){this.emit('message',Buffer.from(JSON.stringify(msg)))}last(type){return [...this.received].reverse().find(m=>m.type===type)}all(type){return this.received.filter(m=>m.type===type)}}
FakeWebSocket.OPEN=1;
class FakeWSS extends EventEmitter{constructor(){super();this.clients=new Set();globalThis.__commsWss=this}connect(){const ws=new FakeWebSocket();this.clients.add(ws);this.emit('connection',ws);return ws}}
const originalLoad=Module._load;Module._load=function(request,parent,isMain){if(request==='ws')return {WebSocket:FakeWebSocket,WebSocketServer:FakeWSS};return originalLoad.call(this,request,parent,isMain)};
delete require.cache[require.resolve('../server')];const {rooms}=require('../server');Module._load=originalLoad;
const wss=globalThis.__commsWss;

function versus(){const host=wss.connect();host.receive({type:'create',mode:'pvp',scenario:'territory',faction:'defence',name:'Ada'});const code=host.last('joined').code;
 const others=['Bayo','Chi','Dami'].map(name=>{const ws=wss.connect();ws.receive({type:'join',code,name});return ws});return {host,others,code,room:rooms.get(code)}}

test('Territory versus seats two commanders per side and refuses a fifth',()=>{
 const {others,code,room}=versus();
 assert.deepEqual(room.game.participants.map(p=>p.team).sort(),[0,0,1,1]);
 assert.deepEqual(others.map(ws=>ws.last('joined').team),[1,0,1],'joiners fill the side with fewer commanders');
 const fifth=wss.connect();fifth.receive({type:'join',code,name:'Eze'});assert.equal(fifth.last('error').message,'This room is full');
});

test('Co-op vs AI waits in the lobby and seats a friend on the host side only',()=>{
 const host=wss.connect();host.receive({type:'create',mode:'solo',coop:true,scenario:'territory',faction:'raiders',difficulty:'standard',name:'Ada'});
 const {code}=host.last('joined'),room=rooms.get(code);assert.equal(room.game.phase,'lobby');
 const friend=wss.connect();friend.receive({type:'join',code,name:'Bayo'});assert.equal(friend.last('joined').team,1);
 const third=wss.connect();third.receive({type:'join',code,name:'Chi'});assert.equal(third.last('error').message,'This room is full');
 host.receive({type:'start'});assert.equal(room.game.phase,'playing');assert.ok(room.game.ais.has(0),'the AI commands the other side');
 // Both co-commanders control the shared army.
 const unit=room.game.units.find(u=>u.team===1&&u.type==='rifle');friend.receive({type:'command',action:'move',unitIds:[unit.id],x:1900,y:700});assert.equal(unit.order,'move');
 // Ready-up needs both co-commanders.
 host.receive({type:'trainingComplete'});assert.equal(room.game.territory.stage,'prepare');friend.receive({type:'trainingComplete'});assert.equal(room.game.territory.stage,'warning');
});

test('Team chat stays on the team, all-chat reaches everyone, text is cleaned and rate-limited',()=>{
 const {host,others,room}=versus();const [enemy,mate]=others;host.receive({type:'start'});assert.equal(room.game.phase,'playing');
 host.receive({type:'chat',text:'  push   north\u0000 <b>now</b> ',scope:'team'});
 const got=mate.last('chat');assert.equal(got.text,'push north <b>now</b>','control characters removed; markup is left as text for textContent');assert.equal(got.scope,'team');
 assert.equal(enemy.all('chat').filter(m=>!m.history).length,0,'the other side never sees team chat');
 host.receive({type:'chat',text:'gg all',scope:'all'});assert.equal(enemy.last('chat').text,'gg all');
 host.receive({type:'chat',text:'x'.repeat(400),scope:'team'});assert.equal(mate.last('chat').text.length,140);
 for(let i=0;i<8;i++)host.receive({type:'chat',text:'spam '+i,scope:'team'});
 assert.ok(mate.all('chat').length<=5+3,'burst limit');assert.match(host.last('notice').message,/Slow down/);
 const late=wss.connect();late.receive({type:'join',code:room.code,id:mate.last('joined').id});assert.ok(late.all('chat').some(m=>m.history),'reconnecting players get recent history');
});

test('Pings go to teammates only, are validated and throttled',()=>{
 const {host,others,room}=versus();const [enemy,mate]=others;host.receive({type:'start'});
 host.receive({type:'ping',x:900,y:500,kind:'attack'});const ping=mate.last('ping');assert.equal(ping.kind,'attack');assert.equal(ping.name,'Ada');
 assert.equal(enemy.last('ping'),undefined);
 host.receive({type:'ping',x:1000,y:500,kind:'help'});assert.equal(mate.all('ping').length,1,'throttled');
 const own=host.all('ping').length;assert.equal(own,1,'the sender sees their own ping');
 mate.receive({type:'ping',x:'nope',y:5});mate.receive({type:'ping',x:99999,y:5});assert.equal(host.all('ping').length,own,'invalid pings are dropped');
 mate.receive({type:'ping',x:300,y:300,kind:'<script>'});assert.equal(host.last('ping').kind,'look');
});

test('One teammate leaving hands command over instead of ending the match',()=>{
 const {host,others,room}=versus();const [,mate]=others;host.receive({type:'start'});
 mate.receive({type:'leave'});assert.equal(room.game.phase,'playing');assert.match(host.last('chat').text,/has command/);
});

test('A flood of commands is throttled per connection without dropping normal play',()=>{
 const ws=wss.connect();ws.receive({type:'create',mode:'solo',scenario:'territory',name:'Flood'});const room=rooms.get(ws.last('joined').code);
 const unit=room.game.units.find(u=>u.team===0&&u.type==='rifle');
 for(let i=0;i<30;i++)ws.receive({type:'command',action:'move',unitIds:[unit.id],x:300+i,y:600});
 assert.equal(unit.dest.x,329,'a burst of 30 normal commands all land');
 for(let i=0;i<200;i++)ws.receive({type:'command',action:'move',unitIds:[unit.id],x:400,y:600});
 assert.ok(ws.all('notice').some(n=>/Too many commands/.test(n.message)));
});

test('Pages may only be framed by Vatar origins and ourselves',async()=>{
 const {server}=require('../server');await new Promise(r=>server.listen(0,r));const port=server.address().port;
 try{const res=await fetch('http://127.0.0.1:'+port+'/');const policy=res.headers.get('content-security-policy')||'';
  assert.match(policy,/frame-ancestors 'self' https:\/\/lagoslife\.app/);assert.ok(!res.headers.get('x-frame-options'));
  const js=await fetch('http://127.0.0.1:'+port+'/platform.js');assert.equal(js.headers.get('content-security-policy'),null,'only documents carry the policy');}
 finally{server.close()}
});

test('A solo match pauses when the host backgrounds it; co-op and versus never pause',()=>{
 const ws=wss.connect();ws.receive({type:'create',mode:'solo',scenario:'territory',name:'Solo'});const room=rooms.get(ws.last('joined').code);
 ws.receive({type:'pause',paused:true});assert.equal(room.game.paused,true);assert.equal(ws.last('state').paused,true);
 const t=room.game.time;room.game.paused&&assert.equal(room.game.time,t);
 ws.receive({type:'pause',paused:false});assert.equal(room.game.paused,false);
 ws.receive({type:'pause',paused:true});const again=wss.connect();again.receive({type:'join',code:room.code,id:ws.last('joined').id});assert.equal(room.game.paused,false,'reconnecting resumes');
 const {host,room:versusRoom}=versus();host.receive({type:'start'});host.receive({type:'pause',paused:true});assert.ok(!versusRoom.game.paused);assert.match(host.last('notice').message,/solo/i);
});
