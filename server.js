'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {WebSocket,WebSocketServer}=require('ws');
const {Game}=require('./src/engine');
const {get:getMap}=require('./public/maps');
const PORT=Number(process.env.PORT||3000),rooms=new Map(),STEP=0.05;
const uid=()=>crypto.randomBytes(9).toString('hex');
const newCode=()=>Array.from(crypto.randomBytes(4),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join('');
const send=(ws,data)=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data))};
// State snapshots supersede each other: on a slow connection drop the stale one instead of queueing it,
// otherwise the player's view falls further and further behind and the game appears to freeze.
const STATE_BACKLOG=48*1024;
const sendState=(ws,data)=>{if(ws?.readyState!==WebSocket.OPEN)return;if(ws.bufferedAmount>STATE_BACKLOG&&data.phase==='playing'){ws.skipped=(ws.skipped||0)+1;return}ws.send(JSON.stringify(data))};
const staticFiles={'/manifest.webmanifest':'manifest.webmanifest','/sw.js':'sw.js','/icons/icon-192.png':'icons/icon-192.png','/icons/icon-512.png':'icons/icon-512.png','/icons/maskable-512.png':'icons/maskable-512.png','/icons/apple-touch-icon.png':'icons/apple-touch-icon.png','/maps.js':'maps.js','/3d.js':'3d.js','/3d.css':'3d.css','/home.js':'home.js','/town.js':'town.js','/platform.js':'platform.js','/audio.js':'audio.js','/catalog.js':'catalog.js','/':'index.html','/index.html':'index.html','/style.css':'style.css','/game.js':'game.js','/assets/iron-frontier-hero.webp':'assets/iron-frontier-hero.webp','/assets/homestand-poster.jpg':'assets/homestand-poster.jpg','/assets/3d/coastal-ground-albedo.jpg':'assets/3d/coastal-ground-albedo.jpg','/assets/3d/azure-armor-albedo.jpg':'assets/3d/azure-armor-albedo.jpg','/assets/3d/crimson-armor-albedo.jpg':'assets/3d/crimson-armor-albedo.jpg','/assets/3d/impact-explosion.png':'assets/3d/impact-explosion.png'};
// Browsers receive the minified Three.js build; the stable /vendor/three.module.js URL keeps the import map unchanged.
const vendorFiles={'/vendor/three.module.js':['three','build','three.module.min.js'],'/vendor/three.core.min.js':['three','build','three.core.min.js'],'/vendor/three.core.js':['three','build','three.core.min.js'],'/vendor/BufferGeometryUtils.js':['three','examples','jsm','utils','BufferGeometryUtils.js']};
const compressible=/\.(html|css|js)$/,responseCache=new Map();
function serveFile(req,res,filePath,cacheControl){
 fs.stat(filePath,(statError,stat)=>{if(statError){res.writeHead(404);return res.end('Not found')}
  const type=contentType[path.extname(filePath)]||'application/octet-stream',etag='"'+stat.size.toString(36)+'-'+Math.floor(stat.mtimeMs).toString(36)+'"',gzip=compressible.test(filePath)&&/\bgzip\b/.test(req.headers['accept-encoding']||'');
  const headers={'Content-Type':type,'Cache-Control':cacheControl,ETag:etag,Vary:'Accept-Encoding'};
  // Vatar's Lagos Life Games app frames the game; only those origins (and ourselves) may embed it.
  if(type.startsWith('text/html'))headers['Content-Security-Policy']=FRAME_POLICY;
  if(req.headers['if-none-match']===etag){res.writeHead(304,headers);return res.end()}
  const key=filePath+(gzip?':gz':''),cached=responseCache.get(key),finish=body=>{if(gzip)headers['Content-Encoding']='gzip';headers['Content-Length']=body.length;res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:body)};
  if(cached?.etag===etag)return finish(cached.body);
  fs.readFile(filePath,(readError,data)=>{if(readError){res.writeHead(404);return res.end('Not found')}const body=gzip?zlib.gzipSync(data,{level:9}):data;responseCache.set(key,{etag,body});finish(body)})
 })
}
// FRAME_ANCESTORS_EXTRA (space-separated origins) lets a local test harness frame the game; unset in production.
const FRAME_POLICY="frame-ancestors 'self' https://lagoslife.app https://www.lagoslife.app https://naijalife.app https://www.naijalife.app https://lagoslife.eliysites.com https://vatarverse.com https://www.vatarverse.com"+(process.env.FRAME_ANCESTORS_EXTRA?' '+process.env.FRAME_ANCESTORS_EXTRA.split(/\s+/).filter(o=>/^https?:\/\/[a-z0-9.:-]+$/i.test(o)).join(' '):'');
const contentType={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(vendorFiles[pathname])return serveFile(req,res,path.join(__dirname,'node_modules',...vendorFiles[pathname]),'public, max-age=604800');
 if(pathname==='/healthz'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify({status:'ok',game:'HOMESTAND',rooms:rooms.size}))}
 const file=staticFiles[pathname];if(!file){res.writeHead(404);return res.end('Not found')}
 // The service worker must always be revalidated so new deploys take over promptly.
 serveFile(req,res,path.join(__dirname,'public',file),file==='sw.js'?'no-cache':'public,max-age=60')
});
// Snapshots are repetitive JSON: per-message deflate cuts bandwidth roughly five-fold.
const wss=new WebSocketServer({server,path:'/ws',maxPayload:8192,perMessageDeflate:{threshold:512,zlibDeflateOptions:{level:4,memLevel:7},concurrencyLimit:8}});
const participants=room=>room.game.participants;
const broadcast=(room,payload)=>{for(const p of participants(room))if(!p.bot)send(room.sockets.get(p.id),payload)};
const broadcastState=room=>{
 const snap=room.game.snapshot();room.sentPhase=room.game.phase;
 for(const p of participants(room))if(!p.bot)sendState(room.sockets.get(p.id),{type:'state',me:p.id,team:p.team,host:p.id===room.hostId,...snap,mines:room.game.visibleMines(p.team),events:room.game.scenario==='territory'?snap.events.filter(e=>e.team===null||e.team===undefined||e.team===p.team):snap.events});
};
// ---------- Chat and pings ----------
// Messages are plain text (rendered with textContent on the client), trimmed, length-capped,
// rate-limited per commander and lightly filtered. Team messages never reach the other side.
const ACTION_RATE=20,ACTION_BURST=40;
let chatSeq=0;
const CHAT_MAX=140,CHAT_BURST=5,CHAT_WINDOW=8000,PING_GAP=1200,PING_KINDS=['attack','defend','help','look'];
const BLOCKED=/\b(fuck|shit|bitch|cunt|nigger|faggot|bastard)\w*/gi;
const cleanText=value=>String(value??'').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e]/g,' ').replace(/\s+/g,' ').trim().slice(0,CHAT_MAX).replace(BLOCKED,m=>m[0]+'*'.repeat(m.length-1));
function broadcastChat(room,entry,team){
 const message={type:'chat',id:++chatSeq,at:Date.now(),scope:team===null||team===undefined?'all':'team',team:team??null,...entry};
 room.chat.push(message);if(room.chat.length>40)room.chat.shift();
 for(const p of participants(room))if(!p.bot&&(message.scope==='all'||p.team===team))send(room.sockets.get(p.id),message);
}
function chat(ws,room,player,msg){
 const text=cleanText(msg.text);if(!text)return;
 const now=Date.now(),log=(player.chatLog||[]).filter(t=>now-t<CHAT_WINDOW);
 if(log.length>=CHAT_BURST){player.chatLog=log;return send(ws,{type:'notice',message:'Slow down - wait a moment before sending more messages'})}
 if(player.lastChat===text&&now-(player.lastChatAt||0)<4000)return;
 log.push(now);player.chatLog=log;player.lastChat=text;player.lastChatAt=now;
 const scope=msg.scope==='all'||room.game.phase==='lobby'?'all':'team';
 broadcastChat(room,{from:player.id,name:player.name,sender:player.team,text},scope==='all'?null:player.team);
}
function ping(ws,room,player,msg){
 const x=Number(msg.x),y=Number(msg.y),kind=PING_KINDS.includes(msg.kind)?msg.kind:'look',now=Date.now();
 if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>2400||y>1350||room.game.phase!=='playing')return;
 if(room.game.jammed?.(player.team))return send(ws,{type:'notice',message:'Communications jammed - pings are down until the comms centre is back online'});
 if(now-(player.lastPing||0)<PING_GAP)return;player.lastPing=now;
 const message={type:'ping',x:Math.round(x),y:Math.round(y),kind,from:player.id,name:player.name,team:player.team,at:now};
 for(const p of participants(room))if(!p.bot&&p.team===player.team)send(room.sockets.get(p.id),message);
}
function register(ws,room,p,existing=false){
 const old=room.sockets.get(p.id);if(old&&old!==ws){try{old.close(4000,'Reconnected')}catch{}}
 ws.room=room.code;ws.playerId=p.id;room.sockets.set(p.id,ws);p.connected=true;room.lastActivity=Date.now();if(room.game.paused)room.game.setPaused(false,p.id);
 send(ws,{type:'joined',code:room.code,id:p.id,team:p.team,existing});
 for(const m of room.chat)if(m.scope==='all'||m.team===p.team)send(ws,{...m,history:true});
 broadcastState(room)
}
function create(ws,msg){
 if(ws.room)return send(ws,{type:'error',message:'Already in a room'});
 let code=newCode();while(rooms.has(code))code=newCode();
 const mode=msg.mode==='pvp'?'pvp':'solo',missionId=mode==='solo'&&msg.missionId==='safe-haven'?'safe-haven':null,scenario=!missionId&&msg.scenario==='territory'?'territory':null,variant=scenario&&mode==='solo'&&['rescue','survival'].includes(msg.variant)?msg.variant:'war',hostTeam=scenario&&msg.faction==='raiders'&&variant==='war'?1:0,prepMinutes=[3,5].includes(Number(msg.prepMinutes))?Number(msg.prepMinutes):5;const difficulty=mode==='solo'&&['recruit','standard','veteran'].includes(msg.difficulty)?msg.difficulty:'recruit';const map=getMap(missionId||(scenario?'frontier':String(msg.mapId||''))),terrainSeed=(map.seed^Buffer.from(code).reduce((value,byte)=>Math.imul(value^byte,16777619)>>>0,2166136261))>>>0;const game=new Game({mode,roomCode:code,difficulty,mapId:map.id,terrainSeed,missionId,scenario,prepMinutes,variant,edition:msg.edition==='lagoslife'?'lagoslife':'standard',theatreId:String(msg.theatreId||''),training:mode==='solo'&&(missionId==='safe-haven'||msg.training===true),guided:msg.guided===true});
 // Co-op: a Territory War against the AI that waits in the lobby for a second commander on the host's side.
 const coop=mode==='solo'&&scenario==='territory'&&msg.coop===true;
 const room={code,game,hostId:null,coop,sockets:new Map(),chat:[],lastActivity:Date.now()};rooms.set(code,room);
 const id=uid(),name=String(msg.name||'Commander').trim().slice(0,18)||'Commander';game.addParticipant(id,name,hostTeam,false);room.hostId=id;
 if(mode==='solo')game.addParticipant(uid(),scenario?(hostTeam===0?'RAIDER COMMAND AI':'DEFENCE COMMAND AI'):'CRIMSON BOT',1-hostTeam,true);
 register(ws,room,game.participants[0]);if(mode==='solo'&&!coop){game.start();broadcastState(room)}
}
function join(ws,msg){
 if(ws.room)return send(ws,{type:'error',message:'Already in a room'});
 const code=String(msg.code||'').toUpperCase();const room=rooms.get(code);
 if(!room)return send(ws,{type:'error',message:'Room expired or not found'});
 const id=String(msg.id||'');let p=room.game.participants.find(p=>p.id===id&&!p.bot);
 if(p){register(ws,room,p,true);return}
 if(room.game.phase!=='lobby')return send(ws,{type:'error',message:'Match already started; you need an existing player session'});
 const g=room.game,cap=g.teamCapacity(),humans=t=>g.participants.filter(p=>p.team===t&&!p.bot).length,open=t=>!g.participants.some(p=>p.team===t&&p.bot)&&humans(t)<cap;
 // Co-op rooms only seat the host's side; versus rooms seat the side with fewer commanders (or the one asked for).
 const hostTeam=g.participants.find(p=>p.id===room.hostId)?.team??0,wanted=msg.faction==='raiders'?1:msg.faction==='defence'?0:null;
 const candidates=room.coop?[hostTeam].filter(open):g.mode==='pvp'?[0,1].filter(open).sort((a,b)=>(a===wanted?-1:b===wanted?1:0)||humans(a)-humans(b)):[];
 if(!candidates.length)return send(ws,{type:'error',message:'This room is full'});
 const playerId=uid(),freeTeam=candidates[0];g.addParticipant(playerId,String(msg.name||'Commander').slice(0,18),freeTeam,false);
 p=room.game.participants.find(p=>p.id===playerId);register(ws,room,p)
}
function action(ws,msg){
 const room=rooms.get(ws.room),player=room?.game.participants.find(p=>p.id===ws.playerId&&!p.bot);
 if(!room||!player||room.sockets.get(player.id)!==ws)return;
 const game=room.game;let outcome;
 switch(msg.type){
  case 'chat':return chat(ws,room,player,msg);
  case 'pause':outcome=game.setPaused(Boolean(msg.paused),player.id);break;
  case 'ping':return ping(ws,room,player,msg);
  case 'start':if(room.hostId!==player.id)return send(ws,{type:'error',message:'Only host can start'});outcome=game.start()?{ok:true}:{ok:false,reason:'Waiting for opposing commander'};break;
  case 'build':outcome=game.spawn(player.team,String(msg.unitType||''));break;
  case 'construct':outcome=game.constructionSite(player.team,String(msg.structureType||''),msg.x,msg.y,msg.builderIds,msg.plotId?String(msg.plotId):null,msg.rot);break;
  case 'rally':outcome=game.setRally(player.team,String(msg.structureId||''),msg.x,msg.y);break;
  case 'assist':outcome=game.assistStructure(player.team,String(msg.structureId||''),msg.builderIds);break;
  case 'produce':outcome=game.produce(player.team,String(msg.structureId||''),String(msg.unitType||''),msg.count);break;
  case 'cancelQueue':outcome=game.cancelQueue(player.team,String(msg.structureId||''));break;
  case 'repair':outcome=game.repairStructure(player.team,String(msg.structureId||''),msg.builderIds);break;
  case 'upgrade':outcome=game.upgradeStructure(player.team,String(msg.structureId||''));break;
  case 'command':outcome=game.command(player.team,msg.unitIds,msg.action,msg.x,msg.y,msg.targetId);break;
  case 'ability':outcome=game.orbital(player.team,msg.x,msg.y);break;
  case 'plant':outcome=game.plantIed(player.team,msg.unitIds,msg.x,msg.y);if(outcome.ok)send(ws,{type:'notice',message:'Charge team moving to the site'});break;
  case 'defuse':outcome=game.defuseIed(player.team,msg.unitIds,msg.mineId?String(msg.mineId):null);if(outcome.ok)send(ws,{type:'notice',message:'Eagle-Eye moving in to defuse'});break;
  case 'trainingComplete':outcome=game.completeTraining(player.team,player.id);break;
  case 'tutorialComplete':outcome=game.tutorialComplete(player.team);break;
  case 'surrender':if(game.phase==='playing')game.end(1-player.team,'SURRENDER');outcome={ok:true};break;
  case 'leave':{
   const teammates=game.participants.filter(v=>v.team===player.team&&v.id!==player.id&&!v.bot&&v.connected);
   if(game.phase==='playing'&&!game.participants.some(v=>v.bot)&&!teammates.length)game.end(1-player.team,'OPPONENT LEFT');
   else if(teammates.length)broadcastChat(room,{system:true,text:player.name+' left the battle - '+teammates[0].name+' has command'},null);
   // Leaving a lobby frees the seat for someone else.
   if(game.phase==='lobby'&&player.id!==room.hostId)game.participants=game.participants.filter(v=>v.id!==player.id);
   room.sockets.delete(player.id);player.connected=false;room.lastActivity=Date.now();
   ws.room=null;ws.playerId=null;broadcastState(room);return;
  }
  default:return;
 }
 if(!outcome.ok)send(ws,{type:'notice',message:outcome.reason||'Not available'});
  else if(msg.type==='build')send(ws,{type:'notice',message:'Unit deployed: '+String(msg.unitType).toUpperCase()});
  else if(msg.type==='construct')send(ws,{type:'notice',message:'Construction team dispatched'});
 broadcastState(room)
}
wss.on('connection',ws=>{
 ws.alive=true;ws.on('pong',()=>{ws.alive=true});
 // Per-connection token bucket: generous for real play (taps, drags, hotkeys), but a script flooding
 // commands is throttled so one client cannot starve the simulation for everyone else.
 ws.tokens=ACTION_BURST;ws.refill=Date.now();
 ws.on('message',raw=>{const now=Date.now();ws.tokens=Math.min(ACTION_BURST,ws.tokens+(now-ws.refill)/1000*ACTION_RATE);ws.refill=now;
  if(ws.tokens<1){if(!ws.throttled){ws.throttled=true;send(ws,{type:'notice',message:'Too many commands - slow down'})}return}ws.tokens-=1;ws.throttled=false;
  let msg;try{msg=JSON.parse(raw.toString())}catch{return}
  if(!msg||typeof msg!=='object')return;
  if(msg.type==='create')return create(ws,msg);
  if(msg.type==='join')return join(ws,msg);
  action(ws,msg);
 });
 ws.on('close',()=>{
  const room=rooms.get(ws.room);const p=room?.game.participants.find(p=>p.id===ws.playerId);
  if(p&&room.sockets.get(p.id)===ws){room.sockets.delete(p.id);p.connected=false;room.lastActivity=Date.now();broadcastState(room)}
 });
});
let accumulator=0,last=performance.now(),broadcastClock=0;
const loop=setInterval(()=>{
 const now=performance.now();accumulator=Math.min(0.25,accumulator+(now-last)/1000);last=now;
 while(accumulator>=STEP){for(const room of rooms.values())if(room.game.phase==='playing'&&!room.game.paused)room.game.step(STEP);accumulator-=STEP;broadcastClock+=STEP}
 // Rooms that just changed phase (victory, defeat, rematch) are broadcast immediately so the
 // results screen appears the moment a match ends, not on the player's next action.
 for(const room of rooms.values())if(room.sentPhase!==undefined&&room.sentPhase!==room.game.phase)broadcastState(room);
 if(broadcastClock>=0.15){broadcastClock=0;for(const room of rooms.values())if(room.game.phase==='playing')broadcastState(room)}
 const age=Date.now();for(const [code,room] of rooms){if(![...room.sockets.values()].some(ws=>ws.readyState===WebSocket.OPEN)&&age-room.lastActivity>5*60*1000)rooms.delete(code)}
},50);loop.unref();
const keepalive=setInterval(()=>{for(const ws of wss.clients){if(ws.alive===false){ws.terminate();continue}ws.alive=false;ws.ping()}},25000);keepalive.unref();
if(require.main===module)server.listen(PORT,'0.0.0.0',()=>console.log(`HOMESTAND listening on ${PORT}`));
module.exports={server,rooms};
