(()=>{'use strict';
const WORLD={w:1600,h:900},PALETTE=['#60cffa','#ff786e'],CLASSES={rifle:{cost:60,label:'RIFLE SQUAD',icon:'♟',key:'1'},tank:{cost:165,label:'SIEGE TANK',icon:'▰',key:'2'},rocket:{cost:130,label:'ROCKET BATTERY',icon:'🚀',key:'3'}};
const $=s=>document.querySelector(s),escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
let socket=null,game=null,me='',team=0,room='',isHost=false,connected=false,reconnectTimer=null,view='home',prevPhase=null,animation=null;
let selected=new Set(),action='attackmove',zoom=innerWidth<700?1.6:1,camera={x:800,y:450},pointer=null,dragBox=null,canvas=null,ctx=null,background=null,minimap=null,minictx=null,lastDraw=0;
let lastUpdate=Date.now(),toastTimer=null,soundEnabled=true,clickPending=false;
let prefer3d=localStorage.getItem('iron-frontier-view')!=='2d';
const app=$('#app');
function toast(message){const element=$('#toast');element.textContent=message;element.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>element.classList.remove('visible'),2600)}
const send=payload=>{if(socket?.readyState!==WebSocket.OPEN){toast('Connecting to battle server…');return false}socket.send(JSON.stringify(payload));return true};
const sessionKey='iron-frontier-session';
function saveSession(){sessionStorage.setItem(sessionKey,JSON.stringify({room,id:me,team,name:localStorage.getItem('iron-frontier-name')||'Commander'}))}
function clearSession(){sessionStorage.removeItem(sessionKey)}
function connect(){if(socket&&socket.readyState===WebSocket.OPEN)return;const url=(location.protocol==='https:'?'wss':'ws')+'://'+location.host+'/ws';socket=new WebSocket(url);
 socket.onopen=()=>{connected=true;$('#network-indicator')?.replaceChildren(document.createTextNode('● SERVER CONNECTED'));clearTimeout(reconnectTimer);const sess=JSON.parse(sessionStorage.getItem(sessionKey)||'null');if(sess?.room&&sess?.id){send({type:'join',...sess});}};
 socket.onclose=()=>{connected=false;if($('#network-indicator'))$('#network-indicator').textContent='○ RECONNECTING';reconnectTimer=setTimeout(connect,1300)};
 socket.onerror=()=>{};
 socket.onmessage=e=>{let data;try{data=JSON.parse(e.data)}catch{return}if(data.type==='joined'){room=data.code;me=data.id;team=data.team;saveSession();history.replaceState({},'',location.pathname+'?room='+room);return}
  if(data.type==='notice'){toast(data.message);return}
  if(data.type==='error'){toast(data.message);if(data.message.includes('expired')||data.message.includes('not found')){clearSession();room='';me='';game=null;renderHome()}return}
  if(data.type==='state'){const prev=game?.phase;game=data;room=data.code;me=data.me;team=data.team;isHost=data.host;lastUpdate=Date.now();selected=new Set([...selected].filter(id=>game.units.some(u=>u.id===id&&u.team===team)));
   if(data.phase!==prev||view!==data.phase){if(data.phase==='playing')renderBattle();else if(data.phase==='results')renderResults();else renderLobby()}
   if(data.phase==='playing'){updateHud();window.Iron3D?.sync(game,selected)}
  }
 };
}
function shell(){return '<div class="shell"><header class="topbar"><div class="logo"><span>◆</span> HOMESTAND <span style="font-size:10px;color:#acc0c9;font-weight:600;letter-spacing:1px">RTS</span></div><div class="status" id="network-indicator">'+(connected?'● SERVER CONNECTED':'○ CONNECTING')+'</div></header><div id="content"></div><footer class="footer"><span>HOMESTAND — AN ORIGINAL REAL-TIME STRATEGY GAME</span><span>COMMAND · CAPTURE · CONQUER</span></footer></div>'}
function mount(body){app.innerHTML=shell();$('#content').innerHTML=body}
function renderHome(){window.Iron3D?.unmount();view='home';prevPhase=null;game=null;selected.clear();
 mount('<div class="home"><section><div class="eyebrow">⚔ REAL-TIME TACTICAL WARFARE</div><h1>BUILD YOUR ARMY.<br><em>CONTROL THE FRONTIER.</em></h1><p>Deploy rifle squads, heavy tanks and rocket batteries. Capture three resource relays, launch devastating orbital strikes, and destroy the opposing command center. Every second changes the battlefield.</p><p style="font-size:13px;color:#ffda91">◆ SOLO VS ENEMY AI &nbsp; ◆ LIVE 1V1 ROOMS &nbsp; ◆ NO ACCOUNTS</p><form id="startForm" class="panel form"><label for="commander">COMMANDER CALL SIGN</label><input id="commander" maxlength="18" required autocomplete="nickname" placeholder="Enter a name" value="'+escapeHTML(localStorage.getItem('iron-frontier-name')||'')+'"><div class="difficulty-row"><label for="difficulty">ENEMY COMMANDER <select id="difficulty"><option value="recruit">Recruit · Easy</option><option value="standard">Standard · Medium</option><option value="veteran">Veteran · Hard</option></select></label></div><div class="form-actions"><button type="button" id="solo" class="btn primary">⚔ PLAY VS AI</button><button type="button" id="host" class="btn secondary">⌁ CREATE 1V1 ROOM</button></div><label for="roomField">JOIN A FRIEND — ENTER ROOM CODE</label><input id="roomField" maxlength="4" style="text-transform:uppercase" placeholder="ROOM CODE" value="'+escapeHTML(new URLSearchParams(location.search).get('room')||'')+'"><div class="form-actions"><button class="btn wide" type="submit">JOIN MULTIPLAYER BATTLE →</button></div></form><p class="small">DESKTOP: Click or drag to select troops, right-click to command. MOBILE: Tap your units, then tap a destination.</p></section><section class="hero-art"><img src="/assets/concept-battle.webp" alt="Concept battlefield featuring futuristic armored vehicles, infantry, bases and coastal warfare"><div class="hero-overlay"><strong>MISSION: SEIZE THE FRONTIER</strong>3 strategic relays · dynamic resources · 6-minute battle · difficulty-selectable enemy commander</div></section></div>');
 const name=()=>$('#commander').value.trim().slice(0,18);
 const begin=mode=>{if(!name())return $('#startForm').reportValidity();localStorage.setItem('iron-frontier-name',name());clearSession();send({type:'create',mode,name:name(),difficulty:$('#difficulty')?.value||'recruit'})};
 $('#solo').onclick=()=>begin('solo');$('#host').onclick=()=>begin('pvp');$('#startForm').onsubmit=e=>{e.preventDefault();if(!name())return $('#startForm').reportValidity();const code=$('#roomField').value.trim().toUpperCase();if(code.length!==4)return toast('Enter the 4-character room code');localStorage.setItem('iron-frontier-name',name());clearSession();send({type:'join',code,name:name()})};
}
function renderLobby(){window.Iron3D?.unmount();view='lobby';const roster=game.participants;
 mount('<section class="panel lobby"><div class="eyebrow">COMMANDER BRIEFING · PRIVATE 1V1</div><h1>PREPARE FOR DEPLOYMENT.</h1><p class="muted">Share this code with one opposing commander. Their troops will be marked Crimson.</p><div class="roomcode">'+escapeHTML(room)+'</div><div class="crew">'+roster.map(p=>'<div class="crew-item"><span class="swatch" style="background:'+PALETTE[p.team]+'"></span><b>'+escapeHTML(p.name)+'</b><div class="muted small">'+(p.team?'CRIMSON LEGION':'AZURE UNION')+(p.bot?' · BOT':'')+'</div></div>').join('')+(roster.length<2?'<div class="crew-item" style="border-style:dashed">WAITING FOR RIVAL…</div>':'')+'</div><p class="small muted">Victory requires destroying the enemy HQ or winning the relay-control score.</p><div class="form-actions"><button id="copy" class="btn secondary">⧉ COPY INVITE LINK</button>'+(isHost?'<button id="launch" class="btn primary" '+(roster.length<2?'disabled':'')+'>⚔ LAUNCH BATTLE</button>':'<span class="muted">WAITING FOR HOST TO LAUNCH</span>')+'<button id="leave" class="btn">EXIT LOBBY</button></div></section>');
 $('#copy').onclick=()=>navigator.clipboard.writeText(location.origin+location.pathname+'?room='+room).then(()=>toast('Invite copied'));
 $('#launch')?.addEventListener('click',()=>send({type:'start'}));$('#leave').onclick=exitGame;
}
function battleMarkup(){const side=team===0?'AZURE UNION':'CRIMSON LEGION';return '<div class="battle-header"><div class="hud-stats"><div class="stat teamstat" style="color:'+PALETTE[team]+'">◆ '+side+'</div><div class="stat">🟡 <strong id="credits">0</strong> CREDITS</div><div class="stat">⚡ <strong id="energy">0</strong> ENERGY</div><div class="stat">◈ <strong id="supply">0/50</strong></div></div><div class="hud-stats"><div class="stat">⏳ <strong id="timer">6:00</strong></div><div class="stat">🏁 <strong id="points">0 - 0</strong></div><button id="surrender" class="btn danger icon">⚑ Surrender</button></div></div><div class="score-wrap"><section><div class="arena-frame"><canvas id="world" width="1600" height="900" aria-label="Tactical battlefield; click units to select and right click to issue commands"></canvas><div class="arena-legend"><b id="selected-label">SELECT TROOPS</b><div>DRAG BOX TO SELECT · RIGHT CLICK TO COMMAND</div></div></div><div class="control-panel"><div class="buildbar">'+Object.entries(CLASSES).map(([type,u])=>'<button data-build="'+type+'" class="unit-card" title="Recruit '+u.label+' (key '+u.key+')"><span class="unit-symbol">'+u.icon+'</span><span><strong>'+u.label+'</strong><small>🟡 '+u.cost+' · '+u.key+'</small></span></button>').join('')+'</div><div class="commandbar"><button id="select-all" class="btn" title="Select all troops (Q)">◉ ALL</button><button data-action="attackmove" class="btn active">⚔ ATTACK</button><button data-action="move" class="btn">➜ MOVE</button><button data-action="hold" class="btn">⬡ HOLD</button><button data-action="orbital" class="btn" title="Orbital strike 110 energy (B)">☄ STRIKE</button><button id="view-mode" class="btn">◈ 3D</button><button id="zoom-out" class="btn">−</button><button id="zoom-in" class="btn">+</button></div></div><div class="instruction" id="help">Select your blue units with a click or drag, then right-click the terrain or an enemy. Capture three relays for credits and points.</div></section><aside class="side"><div class="panel"><h3>◎ TACTICAL MAP</h3><canvas id="minimap" width="260" height="146" class="minimap"></canvas><div class="small muted" style="margin-top:8px">Click map to navigate · + / − to zoom</div></div><div class="panel"><h3>▣ FRONTLINE STATUS</h3><div id="objectives"></div><div class="small muted" style="margin-top:12px">SUPPLY CAPACITY</div><div class="supplybar"><div id="supplybar" style="width:0%"></div></div></div><div class="panel"><h3>▸ COMMAND FEED</h3><div class="feed" id="feed"></div></div></aside></div>'}
function renderBattle(){view='playing';mount(battleMarkup());canvas=$('#world');ctx=canvas.getContext('2d');minimap=$('#minimap');minictx=minimap.getContext('2d');if(!background)background=createTerrain();
 selected.clear();pointer=null;dragBox=null;action='attackmove';bindBattle();updateHud();if(animation===null)animation=requestAnimationFrame(drawLoop);
 applyViewMode();
}
function applyViewMode(){
 if(view!=='playing')return;
 $('#view-mode').textContent=prefer3d?'▣ 2D MAP':'◈ 3D BATTLE';
 if(prefer3d&&window.Iron3D){window.Iron3D.mount();window.Iron3D.sync(game,selected)}
 else window.Iron3D?.unmount();
}
window.addEventListener('iron3d-ready',()=>{if(view==='playing'&&prefer3d)applyViewMode()});
window.IronBridge={snapshot:()=>game,team:()=>team,selected:()=>selected,handle:(p,right,shift)=>handleWorldTap(p,right,shift),selectAll,zoom:(delta)=>{if(prefer3d&&window.Iron3D)window.Iron3D.zoom(delta);else setZoom(zoom+delta)},notify:toast};

function updateHud(){if(view!=='playing'||!game)return;
 const t=game.teams[team];$('#credits').textContent=Math.floor(t.credits);$('#energy').textContent=Math.floor(t.energy);$('#supply').textContent=t.supply+'/50';$('#supplybar').style.width=clamp(100*t.supply/50,0,100)+'%';
 const sec=game.timeLeft;$('#timer').textContent=Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');$('#points').textContent=game.teams[0].points+' - '+game.teams[1].points;
 $('#objectives').innerHTML=game.nodes.map(n=>'<div class="objective"><span>'+escapeHTML(n.name)+'</span><b style="color:'+ (n.owner===0?PALETTE[0]:n.owner===1?PALETTE[1]:'#ffe4ad')+'">'+(n.owner===-1?'NEUTRAL':n.owner===team?'YOUR CONTROL':'ENEMY CONTROL')+'</b></div>').join('')+'<div class="objective"><span>ENEMY HQ</span><b>'+Math.ceil(game.bases.find(b=>b.kind==='hq'&&b.team!==team)?.hp||0)+' HP</b></div>';
 $('#feed').innerHTML=[...game.events].reverse().slice(0,7).map(e=>'<div><span style="color:'+ (e.team===null?'#ffd88e':PALETTE[e.team])+'">▸</span> '+escapeHTML(e.text)+'</div>').join('');
 $('#selected-label').textContent=selected.size?selected.size+' TROOP'+(selected.size>1?'S':'')+' SELECTED':'SELECT TROOPS';
 for(const btn of document.querySelectorAll('[data-action]'))btn.classList.toggle('active',btn.dataset.action===action);
 for(const btn of document.querySelectorAll('[data-build]'))btn.disabled=t.credits<CLASSES[btn.dataset.build].cost||t.supply>=50;
}
function renderResults(){window.Iron3D?.unmount();view='results';const winner=game.win?.team,winnerName=winner===0?'AZURE UNION':'CRIMSON LEGION';
 mount('<div class="panel result" style="margin:60px auto"><div class="eyebrow">OPERATION COMPLETE · ROUND '+game.round+'</div><h1>'+(winner===team?'VICTORY!':'DEFEAT.')+'</h1><div class="winner">'+winnerName+' TRIUMPHS</div><p class="muted">'+escapeHTML(game.win?.reason||'Battle complete')+'</p><div class="breakdown"><div class="stat"><div class="eyebrow">AZURE CONTROL</div><strong>'+game.teams[0].points+' PTS</strong><small>'+game.teams[0].kills+' KILLS</small></div><div class="stat"><div class="eyebrow">CRIMSON CONTROL</div><strong>'+game.teams[1].points+' PTS</strong><small>'+game.teams[1].kills+' KILLS</small></div></div><div class="form-actions" style="justify-content:center">'+(isHost?'<button class="btn primary" id="again">↻ PLAY AGAIN</button>':'<span class="stat">Waiting for host to restart…</span>')+'<button class="btn" id="exit">EXIT TO MENU</button></div></div>');
 $('#again')?.addEventListener('click',()=>send({type:'start'}));$('#exit').onclick=exitGame;
}
function exitGame(){window.Iron3D?.unmount();if(room)send({type:'leave'});clearSession();room='';me='';team=0;game=null;selected.clear();history.replaceState({},'',location.pathname);renderHome()}
function bindBattle(){
 $('#surrender').onclick=()=>{if(confirm('Surrender this battle?'))send({type:'surrender'})};
 for(const btn of document.querySelectorAll('[data-build]'))btn.onclick=()=>send({type:'build',unitType:btn.dataset.build});
 for(const btn of document.querySelectorAll('[data-action]'))btn.onclick=()=>{
  const a=btn.dataset.action;if(a==='hold'){if(selected.size)send({type:'command',action:'hold',unitIds:[...selected]});else toast('Select a unit first');return}
  action=a;toast(a==='orbital'?'TARGETING ORBITAL STRIKE — TAP THE BATTLEFIELD':a==='move'?'MOVE ORDERS ACTIVE':'ATTACK-MOVE ACTIVE');updateHud()};
 $('#select-all').onclick=selectAll;$('#view-mode').onclick=()=>{prefer3d=!prefer3d;localStorage.setItem('iron-frontier-view',prefer3d?'3d':'2d');applyViewMode()};
 $('#zoom-in').onclick=()=>window.IronBridge.zoom(.35);$('#zoom-out').onclick=()=>window.IronBridge.zoom(-.35);
 canvas.addEventListener('contextmenu',e=>e.preventDefault());
 canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.setPointerCapture(e.pointerId);const p=screenToWorld(e);pointer={screenX:e.clientX,screenY:e.clientY,start:p,button:e.button,moved:false,shift:e.shiftKey,alt:e.altKey};dragBox=null});
 canvas.addEventListener('pointermove',e=>{if(!pointer)return;const dx=e.clientX-pointer.screenX,dy=e.clientY-pointer.screenY;if(Math.hypot(dx,dy)>9){pointer.moved=true;if(pointer.button===0&&!pointer.alt){dragBox={a:pointer.start,b:screenToWorld(e)}} else if(pointer.button===1||pointer.alt){camera.x-=dx/(canvas.getBoundingClientRect().width/W*zoom);camera.y-=dy/(canvas.getBoundingClientRect().height/H*zoom);restrictCamera();pointer.screenX=e.clientX;pointer.screenY=e.clientY}}});
 canvas.addEventListener('pointerup',e=>{if(!pointer)return;const p=screenToWorld(e),was=pointer;pointer=null;
  if(dragBox){selectBox(dragBox,was.shift);dragBox=null;return}
  if(was.button===1||was.alt)return;
  handleWorldTap(p,was.button===2,was.shift);
 });
 canvas.addEventListener('pointercancel',()=>{pointer=null;dragBox=null});
 minimap.addEventListener('click',e=>{const r=minimap.getBoundingClientRect();camera.x=clamp((e.clientX-r.left)/r.width*WORLD.w,0,WORLD.w);camera.y=clamp((e.clientY-r.top)/r.height*WORLD.h,0,WORLD.h);if(prefer3d&&window.Iron3D?.active()){window.Iron3D.center(camera.x,camera.y)}else {setZoom(Math.max(1.2,zoom));restrictCamera()}});
}
function setZoom(z){zoom=clamp(z,1,3);restrictCamera();toast('ZOOM '+Math.round(zoom*100)+'%')}
function restrictCamera(){const hw=WORLD.w/(zoom*2),hh=WORLD.h/(zoom*2);camera.x=clamp(camera.x,hw,WORLD.w-hw);camera.y=clamp(camera.y,hh,WORLD.h-hh)}
function screenToWorld(e){const r=canvas.getBoundingClientRect();return {x:((e.clientX-r.left)/r.width*WORLD.w-WORLD.w/2)/zoom+camera.x,y:((e.clientY-r.top)/r.height*WORLD.h-WORLD.h/2)/zoom+camera.y}}
function nearestSelectable(p){return [...game.units,...game.bases].filter(u=>distance(u,p)<(u.radius||19)+24/zoom).sort((a,b)=>distance(a,p)-distance(b,p))[0]}
function handleWorldTap(p,right=false,shift=false){if(!game||game.phase!=='playing')return;
 if(action==='orbital'){send({type:'ability',x:p.x,y:p.y});action='attackmove';updateHud();return}
 const hit=nearestSelectable(p);
 if(!right&&hit?.team===team&&hit.type){if(!shift)selected.clear();if(shift&&selected.has(hit.id))selected.delete(hit.id);else selected.add(hit.id);updateHud();return}
 if(selected.size){if(hit&&hit.team!==team)send({type:'command',action:'focus',unitIds:[...selected],targetId:hit.id});else send({type:'command',action,x:p.x,y:p.y,unitIds:[...selected]});if(!right)updateHud();return}
 if(hit&&hit.team!==team)toast('Select your troops before targeting enemies');else toast('Select one of your troops or use ALL');
}
function selectBox(box,shift){if(!shift)selected.clear();const xmin=Math.min(box.a.x,box.b.x),xmax=Math.max(box.a.x,box.b.x),ymin=Math.min(box.a.y,box.b.y),ymax=Math.max(box.a.y,box.b.y);
 for(const u of game.units)if(u.team===team&&u.x>=xmin&&u.x<=xmax&&u.y>=ymin&&u.y<=ymax)selected.add(u.id);updateHud();}
function selectAll(){for(const u of game.units)if(u.team===team)selected.add(u.id);updateHud();window.Iron3D?.sync(game,selected);toast(selected.size+' UNITS SELECTED')}
window.addEventListener('keydown',e=>{if(view!=='playing'||['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))return;const k=e.key.toLowerCase();if(['1','2','3'].includes(k)){const typ=['rifle','tank','rocket'][Number(k)-1];send({type:'build',unitType:typ})}else if(k==='q')selectAll();else if(k==='m'||k==='a'){action=k==='m'?'move':'attackmove';updateHud()}else if(k==='h'){if(selected.size)send({type:'command',action:'hold',unitIds:[...selected]})}else if(k==='b'){action='orbital';updateHud();toast('CLICK THE MAP TO CALL STRIKE')}else if(k==='escape'){selected.clear();action='attackmove';updateHud()}else if(k==='+'||k==='=')setZoom(zoom+.3);else if(k==='-')setZoom(zoom-.3)});
// Deterministic procedural terrain. No external sprite or texture dependencies.
function createTerrain(){const bg=document.createElement('canvas');bg.width=WORLD.w;bg.height=WORLD.h;const c=bg.getContext('2d');let seed=378291;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 let g=c.createLinearGradient(0,0,WORLD.w,WORLD.h);g.addColorStop(0,'#35543e');g.addColorStop(.3,'#677552');g.addColorStop(.58,'#7c8050');g.addColorStop(1,'#45644b');c.fillStyle=g;c.fillRect(0,0,WORLD.w,WORLD.h);
 // Tropical shallows along the northern coast, framed above the playable land.
 c.fillStyle='#12586a';c.beginPath();c.moveTo(0,0);c.lineTo(1600,0);c.lineTo(1600,52);for(let x=1600;x>=0;x-=25)c.lineTo(x,65+Math.sin(x/60)*14);c.closePath();c.fill();
 c.lineWidth=6;c.strokeStyle='#a9dfcd';c.beginPath();for(let x=0;x<=1600;x+=12){const y=69+Math.sin(x/60)*14;if(x===0)c.moveTo(x,y);else c.lineTo(x,y)}c.stroke();
 for(let i=0;i<950;i++){const x=rnd()*1600,y=90+rnd()*800,rad=7+rnd()*50;c.fillStyle=i%4===0?'#ae9d6640':i%3===0?'#29492a29':'#aab26b24';c.beginPath();c.ellipse(x,y,rad,rad/2,rnd()*6.28,0,6.283);c.fill()}
 // Roads, wheel tracks and strategic junctions.
 function road(points,width,color){c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.strokeStyle='#3b3526aa';c.lineWidth=width+11;c.lineCap='round';c.lineJoin='round';c.stroke();c.strokeStyle=color;c.lineWidth=width;c.stroke();c.lineWidth=2;c.strokeStyle='#f0d69b33';c.stroke()}
 road([[170,445],[500,453],[770,449],[1120,452],[1430,448]],108,'#b2a272');
 road([[730,85],[746,285],[810,458],[779,680],[805,815]],55,'#af9b69');
 road([[250,185],[475,250],[700,231],[920,240],[1320,218]],32,'#857b55');
 road([[251,720],[570,693],[860,727],[1125,662],[1360,710]],38,'#907a52');
 for(let side=0;side<2;side++){const x=side===0?200:1400;c.fillStyle='#34464b';c.save();c.translate(x,450);c.rotate(.03);c.fillRect(-145,-225,290,450);c.strokeStyle='#a1bac0';c.lineWidth=5;c.strokeRect(-145,-225,290,450);c.strokeStyle='#586b68';c.lineWidth=3;for(let y=-210;y<=200;y+=40){c.beginPath();c.moveTo(-140,y);c.lineTo(140,y);c.stroke()}c.restore()}
 for(const n of [{x:800,y:200},{x:800,y:450},{x:800,y:700}]){c.fillStyle='#3b423e';c.beginPath();c.arc(n.x,n.y,84,0,6.283);c.fill();c.strokeStyle='#c5bd93';c.lineWidth=7;c.beginPath();c.arc(n.x,n.y,73,0,6.283);c.stroke();c.strokeStyle='#d9cfb954';c.lineWidth=2;c.beginPath();c.arc(n.x,n.y,57,0,6.283);c.stroke()}
 // Forest and palms biased away from main roads and bases.
 for(let i=0;i<230;i++){const x=rnd()*1600,y=105+rnd()*680;if(Math.abs(y-450)<65||Math.abs(x-800)<82||Math.abs(x-215)<170||Math.abs(x-1385)<170||Math.abs(y-200)<35||Math.abs(y-700)<35)continue;
   const size=8+rnd()*14;c.fillStyle='#203b2b70';c.beginPath();c.ellipse(x+4,y+6,size*1.3,size*.55,0,0,6.283);c.fill();c.strokeStyle='#6a5035';c.lineWidth=3;c.beginPath();c.moveTo(x,y+8);c.lineTo(x-2,y-2);c.stroke();
   for(let a=0;a<6;a++){const angle=a*Math.PI/3+rnd()*.16,len=size*(.85+rnd()*.6);c.fillStyle=a%2?'#235d38':'#3b7846';c.beginPath();c.moveTo(x-2,y-4);c.lineTo(x-2+Math.cos(angle-.4)*len*.45,y-4+Math.sin(angle-.4)*len*.45);c.lineTo(x-2+Math.cos(angle)*len,y-4+Math.sin(angle)*len);c.lineTo(x-2+Math.cos(angle+.4)*len*.45,y-4+Math.sin(angle+.4)*len*.45);c.closePath();c.fill()}
 }
 for(let i=0;i<160;i++){const x=rnd()*1600,y=85+rnd()*730;c.fillStyle=['#a09a7d','#57685b','#dfc999'][i%3];c.beginPath();c.ellipse(x,y,2+rnd()*5,1.5+rnd()*3,rnd()*3,0,6.283);c.fill()}
 return bg;}
function drawLoop(t){animation=requestAnimationFrame(drawLoop);if(view!=='playing'||!ctx||!game)return;if(prefer3d&&window.Iron3D?.active())return;lastDraw=t;const c=ctx;c.clearRect(0,0,WORLD.w,WORLD.h);c.save();c.translate(WORLD.w/2,WORLD.h/2);c.scale(zoom,zoom);c.translate(-camera.x,-camera.y);c.drawImage(background,0,0);
 for(const n of game.nodes)drawNode(c,n,t);for(const b of game.bases)if(b.hp>0)drawBase(c,b,t);for(const u of game.units)drawUnit(c,u,t);for(const p of game.projectiles)drawProjectile(c,p);for(const b of game.blasts)drawBlast(c,b,t);
 if(dragBox){c.strokeStyle='#70edee';c.fillStyle='#60fafa1a';c.lineWidth=2;c.fillRect(Math.min(dragBox.a.x,dragBox.b.x),Math.min(dragBox.a.y,dragBox.b.y),Math.abs(dragBox.a.x-dragBox.b.x),Math.abs(dragBox.a.y-dragBox.b.y));c.strokeRect(Math.min(dragBox.a.x,dragBox.b.x),Math.min(dragBox.a.y,dragBox.b.y),Math.abs(dragBox.a.x-dragBox.b.x),Math.abs(dragBox.a.y-dragBox.b.y))}
 c.restore();drawMinimap()}
function drawHp(c,v,width,offset){const ratio=clamp(v.hp/v.maxHp,0,1);if(ratio>.99)return;c.fillStyle='#092126b8';c.fillRect(v.x-width/2,v.y-offset,width,6);c.fillStyle=ratio>.4?'#69eb98':'#ff695d';c.fillRect(v.x-width/2,v.y-offset,width*ratio,6)}
function drawNode(c,n,t){c.save();c.translate(n.x,n.y);const pulse=1+Math.sin(t/400)*.09;const color=n.owner===-1?'#ffe6a0':PALETTE[n.owner];c.strokeStyle=color;c.lineWidth=5;c.globalAlpha=.9;c.beginPath();c.arc(0,0,65*pulse,0,6.283);c.stroke();c.strokeStyle='#0c2528';c.lineWidth=20;c.beginPath();c.arc(0,0,32,0,6.283);c.stroke();c.fillStyle='#263d3f';c.fillRect(-29,-31,58,62);c.fillStyle=color;c.fillRect(-18,-18,36,36);c.fillStyle='#ffffffbb';c.fillRect(-8,-8,16,16);c.fillStyle='#061c25d9';c.fillRect(-95,78,190,29);c.fillStyle=color;c.font='bold 13px sans-serif';c.textAlign='center';c.fillText(n.name,0,97);c.fillStyle=n.progress<0?PALETTE[0]:PALETTE[1];c.fillRect(-55,56,110*Math.abs(n.progress)/100,4);c.restore()}
function drawBase(c,b,t){const blue=b.team===0,main=blue?'#3a90ba':'#bf5b45',trim=blue?'#69daee':'#ffae7c';c.save();c.translate(b.x,b.y);c.fillStyle='#061d2790';c.beginPath();c.ellipse(10,23,b.kind==='hq'?80:45,b.kind==='hq'?52:27,0,0,6.283);c.fill();
 if(b.kind==='hq'){c.fillStyle='#29393b';c.fillRect(-63,-48,126,97);c.fillStyle=main;c.fillRect(-54,-58,108,102);c.fillStyle='#273f4b';c.fillRect(-36,-43,72,70);c.strokeStyle=trim;c.lineWidth=7;c.strokeRect(-36,-43,72,70);c.fillStyle=trim;c.beginPath();c.arc(0,-7,16,0,6.283);c.fill();c.fillStyle='#17333b';c.fillRect(-60,40,120,22);c.fillStyle=trim;c.fillRect(-57,45,114,7);c.fillStyle='#071721';c.font='bold 13px sans-serif';c.textAlign='center';c.fillText('HQ',0,-8)}
 else{c.fillStyle='#243a40';c.fillRect(-32,-24,64,50);c.fillStyle=main;c.fillRect(-28,-18,56,44);c.fillStyle='#294758';c.fillRect(-13,-30,26,43);c.strokeStyle=trim;c.lineWidth=5;c.beginPath();c.moveTo(0,-11);c.lineTo(b.team===0?31:-31,-39);c.stroke();c.fillStyle=trim;c.fillRect(-9,-16,18,21)}
 c.restore();drawHp(c,b,b.kind==='hq'?122:60,b.kind==='hq'?80:47)}
function drawUnit(c,u,t){const blue=u.team===0,main=blue?'#3993c8':'#d95544',trim=blue?'#a5edfc':'#ffc2a1',angle=u.angle||0,selectedNow=selected.has(u.id);
 c.save();c.translate(u.x,u.y);c.fillStyle='#0718208c';c.beginPath();c.ellipse(4,8,u.type==='tank'?24:17,u.type==='tank'?17:11,0,0,6.283);c.fill();c.rotate(angle);
 if(u.type==='rifle'){c.fillStyle='#223f48';c.fillRect(-9,-7,18,14);c.fillStyle=main;c.beginPath();c.arc(-2,0,10,0,6.283);c.fill();c.fillStyle=trim;c.fillRect(-4,-7,8,7);c.strokeStyle='#142527';c.lineWidth=3;c.beginPath();c.moveTo(5,1);c.lineTo(18,1);c.stroke();c.fillStyle='#122a35';c.fillRect(-9,-11,10,4)}
 else if(u.type==='tank'){c.fillStyle='#152d2e';c.fillRect(-20,-21,41,12);c.fillRect(-20,11,41,12);c.fillStyle=main;c.fillRect(-19,-15,38,30);c.fillStyle='#d4d0a2';c.fillRect(-14,-11,12,22);c.fillStyle='#294954';c.beginPath();c.arc(3,0,12,0,6.283);c.fill();c.strokeStyle=trim;c.lineWidth=7;c.beginPath();c.moveTo(8,0);c.lineTo(37,0);c.stroke();c.strokeStyle='#162c39';c.lineWidth=3;c.beginPath();c.moveTo(20,0);c.lineTo(38,0);c.stroke()}
 else {c.fillStyle='#152e37';c.fillRect(-21,-13,41,26);c.fillStyle=main;c.fillRect(-16,-15,32,30);c.fillStyle='#263a3f';c.fillRect(-7,-13,20,28);c.strokeStyle=trim;c.lineWidth=6;for(let i=-1;i<=1;i++){c.beginPath();c.moveTo(1,i*8);c.lineTo(29,i*8);c.stroke()}}
 c.restore();if(selectedNow){c.strokeStyle='#80faff';c.lineWidth=2;c.beginPath();c.arc(u.x,u.y,u.radius+11+Math.sin(t/230)*2,0,6.283);c.stroke();if(u.order&&u.order!=='hold'){c.strokeStyle='#b4f6ef88';c.setLineDash([7,6]);const other=game.units.find(e=>e.id===u.id);if(other?.dest){c.beginPath();c.moveTo(u.x,u.y);c.lineTo(other.dest.x,other.dest.y);c.stroke()}c.setLineDash([])}}drawHp(c,u,u.radius*2.6,u.radius+17)}
function drawProjectile(c,p){c.strokeStyle=p.from===0?'#f6de88':'#ff9e6d';c.lineWidth=p.type==='rocket'||p.type==='tank'?7:3;c.shadowColor=c.strokeStyle;c.shadowBlur=16;c.beginPath();c.moveTo(p.x,p.y);const dx=p.toX-p.x,dy=p.toY-p.y,d=Math.hypot(dx,dy)||1;c.lineTo(p.x-dx/d*17,p.y-dy/d*17);c.stroke();c.shadowBlur=0}
function drawBlast(c,b,t){const rel=b.age-b.delay;if(rel<0){c.strokeStyle='#ffb46a';c.lineWidth=3;c.setLineDash([10,6]);c.beginPath();c.arc(b.x,b.y,b.radius,0,6.283);c.stroke();c.setLineDash([]);c.fillStyle='#ff6d6099';c.beginPath();c.arc(b.x,b.y,8+Math.sin(t/90)*4,0,6.283);c.fill();return}
 const ratio=clamp(rel/.9,0,1),size=b.radius*(.4+ratio*.7);c.fillStyle='rgba(255,146,61,'+(1-ratio)*.6+')';c.beginPath();c.arc(b.x,b.y,size,0,6.283);c.fill();c.strokeStyle='rgba(255,226,100,'+(1-ratio)+')';c.lineWidth=7;c.beginPath();c.arc(b.x,b.y,size,0,6.283);c.stroke()}
function drawMinimap(){if(!minictx||!game)return;const c=minictx;c.clearRect(0,0,260,146);c.fillStyle='#26473a';c.fillRect(0,0,260,146);c.strokeStyle='#bda987aa';c.lineWidth=9;c.beginPath();c.moveTo(0,73);c.lineTo(260,73);c.stroke();for(const n of game.nodes){c.fillStyle=n.owner===-1?'#ffc96a':PALETTE[n.owner];c.beginPath();c.arc(n.x/WORLD.w*260,n.y/WORLD.h*146,5,0,6.283);c.fill()}for(const b of game.bases)if(b.hp>0){c.fillStyle=PALETTE[b.team];c.fillRect(b.x/WORLD.w*260-4,b.y/WORLD.h*146-4,8,8)}for(const u of game.units){c.fillStyle=PALETTE[u.team];c.fillRect(u.x/WORLD.w*260-1,u.y/WORLD.h*146-1,3,3)}
 const vw=260/zoom,vh=146/zoom;c.strokeStyle='#fff';c.lineWidth=1.3;c.strokeRect(camera.x/WORLD.w*260-vw/2,camera.y/WORLD.h*146-vh/2,vw,vh)}
connect();renderHome();
})();