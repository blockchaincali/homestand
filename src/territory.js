'use strict';
// Territory War: two playable factions, each with an HQ, construction plots, an economy and a
// phase timeline (prepare → threat warning → live). Methods are mixed into Game so they share
// the simulation's validation, damage and snapshot paths.
const {UNITS,STRUCTURES,CATALOG}=require('./config');
const MAPS=require('../public/maps');
const {FactionAI}=require('./ai');

const L=()=>MAPS.layouts.frontier;
const PREP_CHOICES=[3,5],WARNING_SECONDS=120,LIVE_SECONDS=20*60,WIN_POINTS=1500,CREDIT_CAP=2000;
const OUTPOST_NAMES={outpostNorth:'Tudun Wada Outpost',outpostSouth:'Rafin Gari Outpost'};
const FACILITY_HP={civilianClinic:1500,market:1400,community:1400},OUTPOST_HP=1000;

const territory={
 isTerritory(){return this.scenario==='territory'},
 ceasefire(){return this.scenario==='territory'&&this.territory?.stage!=='live'},
 teamName(t){return this.scenario==='territory'?(t===0?'COMMUNITY DEFENCE':'RAIDERS'):t===0?'AZURE UNION':'CRIMSON LEGION'},
 supplyCap(team){
  if(this.scenario!=='territory')return this.maxSupply;
  const depots=this.structures.filter(s=>s.team===team&&s.type==='depot'&&s.status==='active').length;
  return Math.min(CATALOG.SUPPLY_CAP,CATALOG.BASE_SUPPLY+depots*STRUCTURES.depot.supply);
 },
 builtTypes(team){return this.structures.filter(s=>s.team===team&&s.status==='active'&&s.hp>0).map(s=>s.type)},
 resetTerritory(){
  const layout=L(),T=this.theatre;
  this.teams=[0,1].map(()=>({credits:600,energy:100,points:0,kills:0,powerCooldown:0}));
  this.nodes=layout.checkpointNodes.map(n=>({...n,owner:-1,progress:0}));
  this.bases=layout.hq.map((p,team)=>({id:'hq'+team,kind:'hq',team,x:p.x,y:p.y,hp:2200,maxHp:2200,radius:58,cd:0,range:200,production:null}));
  this.facilities=layout.facilities.map(f=>({id:f.id,kind:f.kind,team:0,x:f.x,y:f.y,hp:f.outpost?OUTPOST_HP:FACILITY_HP[f.kind],maxHp:f.outpost?OUTPOST_HP:FACILITY_HP[f.kind],radius:f.outpost?42:46,outpost:Boolean(f.outpost),name:T?.facilities[f.slot]||OUTPOST_NAMES[f.slot]||f.slot}));
  this.caches=[{id:'cache-credits',kind:'cache',reward:'credits',x:1330,y:560,radius:26,claimedBy:null},{id:'cache-energy',kind:'cache',reward:'energy',x:1070,y:560,radius:26,claimedBy:null},{id:'cache-repair',kind:'cache',reward:'repair',x:1330,y:790,radius:26,claimedBy:null}];
  this.territory={stage:'prepare',stageTime:0,prepDuration:this.prepMinutes*60,warningDuration:WARNING_SECONDS,liveTime:0,liveDuration:LIVE_SECONDS,winPoints:WIN_POINTS,threat:null,lost:[0,0]};
  this.ais=new Map();
  this.resetCivilians();
 },
 startTerritory(){
  for(let team=0;team<2;team++){const hq=this.bases[team],side=team===0?1:-1;
   [['engineer',90,-40],['engineer',90,40],['rifle',130,-90],['rifle',150,0],['rifle',130,90]].forEach(([type,dx,dy])=>{const u=this.spawnAt(team,type,hq.x+side*dx,hq.y+dy);u.angle=team===0?0:Math.PI})}
  for(const p of this.participants)if(p.bot)this.ais.set(p.team,new FactionAI(this,p.team,this.mode==='solo'?this.difficulty:'standard'));
  this.setupVariant();
  this.event((this.theatre?this.theatre.city.toUpperCase()+' · ':'')+'PREPARE YOUR TERRITORY - '+Math.round(this.territory.prepDuration/60)+' MINUTES OF CEASEFIRE',null);
 },
 // Host (solo) or both commanders (PvP) may cut the preparation short; it always moves to the
 // two-minute warning, never straight into combat.
 // Every human commander must be ready. With a human opponent the warning can never be skipped.
 territoryReady(team,playerId=null){
  const t=this.territory;if(!t)return {ok:false,reason:'No territory battle'};
  // Against the AI only the commanders sharing the caller's side are asked.
  const humans=this.participants.filter(p=>!p.bot&&(this.mode==='pvp'||p.team===team)),me=humans.find(p=>p.id===playerId)||humans.find(p=>p.team===team);
  if(t.stage==='prepare'){
   t.readyBy=t.readyBy||[];if(me&&!t.readyBy.includes(me.id))t.readyBy.push(me.id);
   t.ready=[0,1].map(side=>{const own=this.participants.filter(p=>p.team===side);return own.length>0&&own.every(p=>p.bot||t.readyBy.includes(p.id))});
   const waiting=humans.filter(p=>!t.readyBy.includes(p.id));
   if(waiting.length){this.event((me?me.name.toUpperCase():this.teamName(team))+' IS READY - WAITING FOR '+(waiting.length===1?waiting[0].name.toUpperCase():waiting.length+' COMMANDERS'),null);return {ok:true,waiting:true}}
   this.toWarning();return {ok:true};
  }
  if(t.stage==='warning'){if(this.mode==='pvp')return {ok:false,reason:'The warning period cannot be skipped in multiplayer'};
   t.skipBy=t.skipBy||[];if(me&&!t.skipBy.includes(me.id))t.skipBy.push(me.id);const waiting=humans.filter(p=>!t.skipBy.includes(p.id));
   if(waiting.length){this.event((me?me.name.toUpperCase():'A COMMANDER')+' WANTS TO START - WAITING FOR '+waiting[0].name.toUpperCase(),null);return {ok:true,waiting:true}}
   this.toLive();return {ok:true}}
  return {ok:false,reason:'The battle is already live'};
 },
 toWarning(){
  const t=this.territory;t.stage='warning';t.stageTime=0;
  // The AI attacker commits to an opening route now; defenders get an intelligence estimate
  // whose reliability depends on difficulty.
  const attacker=[...this.ais.values()].find(ai=>ai.team===1)||[...this.ais.values()][0];
  if(attacker){const route=attacker.planOpening(),reliable={recruit:1,standard:.75,veteran:0}[attacker.level]??.75,wrong=['north','central','south'].filter(r=>r!==route);
   const reported=Math.random()<reliable?route:attacker.level==='veteran'?null:wrong[Math.floor(Math.random()*wrong.length)];
   t.threat={team:attacker.team,route:reported,confidence:attacker.level==='recruit'?'confirmed':attacker.level==='standard'?'likely':'unknown',targets:reported?this.likelyTargets(attacker,reported):[],path:reported?this.threatPath(attacker,reported):null,at:this.time};
   this.event((attacker.team===1?'RAIDER':'DEFENCE')+' FORCES ARE STAGING'+(reported?' - LIKELY ROUTE: '+reported.toUpperCase()+' ':' ')+'· ASSAULT IN 2:00',1-attacker.team);
  }else{t.threat={team:null,route:null,confidence:'none'};this.event('CEASEFIRE ENDS IN 2:00 - FINISH YOUR DEFENCES',null)}
 },
 // Names of what an attack along a route is most likely to hit, for the warning banner.
 likelyTargets(ai,route){const first=ai.pickTarget(route),end=ai.routePath(route).at(-1),list=[first,...this.facilities.filter(f=>f.hp>0&&f!==first).sort((a,b)=>Math.hypot(a.x-end.x,a.y-end.y)-Math.hypot(b.x-end.x,b.y-end.y)).slice(0,1)].filter(Boolean);return list.map(x=>this.targetName(x))},
 // The road an attack will follow: attacker HQ → route waypoints → first likely target, for map arrows.
 threatPath(ai,route,target=ai.pickTarget(route)){const hq=this.bases[ai.team],pts=[{x:hq.x,y:hq.y},...ai.routePath(route).map(p=>({x:p.x,y:p.y}))];if(target)pts.push({x:target.x,y:target.y});return pts.map(p=>({x:Math.round(p.x),y:Math.round(p.y)}))},
 targetName(x){if(x.name)return x.name;if(x.kind==='hq')return CATALOG.name('hq',x.team);if(x.type)return CATALOG.name(x.type,x.team);return 'Checkpoint'},
 reportThreat(team,route,confidence,targets){if(!this.territory)return;const ai=this.ais?.get(team),first=(targets||[]).find(x=>x&&typeof x==='object');this.territory.threat={team,route,confidence,targets:(targets||[]).filter(Boolean).map(x=>typeof x==='string'?x:this.targetName(x)),path:ai?this.threatPath(ai,route,first):null,at:this.time}},
 toLive(){const t=this.territory;t.stage='live';t.stageTime=0;this.event('CEASEFIRE OVER - THE BATTLE IS LIVE',null)},
 stepTerritory(dt){
  const t=this.territory;if(!t)return;t.stageTime+=dt;
  if(t.stage==='prepare'&&t.stageTime>=t.prepDuration)this.toWarning();
  else if(t.stage==='warning'&&t.stageTime>=t.warningDuration)this.toLive();
  else if(t.stage==='live'){t.liveTime+=dt;
   if(this.incomeClockTerritory===undefined)this.incomeClockTerritory=0;this.incomeClockTerritory+=dt;
   if(this.incomeClockTerritory>=1){this.incomeClockTerritory-=1;for(const n of this.nodes)if(n.owner>=0)this.teams[n.owner].points+=1}
   // Score is a running tally only: in Territory War a side is defeated solely when its HQ falls.
   this.stepVariant();
  }
 },
 territoryIncome(seconds){
  for(let team=0;team<2;team++){const own=this.structures.filter(s=>s.team===team&&s.status==='active'&&s.hp>0&&!(s.hackedUntil>this.time)),checkpoints=this.nodes.filter(n=>n.owner===team).length;
   const income=8+own.filter(s=>s.type==='collector').reduce((sum,s)=>sum+(L().plots.find(p=>p.id===s.plotId)?.kind==='resource'?STRUCTURES.collector.siteIncome:STRUCTURES.collector.income),0)+checkpoints*4+(team===0&&this.facilities.some(f=>f.kind==='market'&&f.hp>0)?3:0);
   this.teams[team].credits=Math.min(CREDIT_CAP,this.teams[team].credits+income*seconds);
   this.teams[team].energy=Math.min(180,this.teams[team].energy+(1+own.filter(s=>s.type==='comms').length*STRUCTURES.comms.energy)*seconds);
  }
 },
 // Finds the plot a large structure snaps to, validating ownership, occupancy and build area.
 // Placement: any building fits any plot (resource sites included), or free ground anywhere in your
 // territory / build area that keeps roads, homes and other buildings clear.
 resolvePlot(team,type,x,y,plotId){
  const layout=L(),state={nodes:this.nodes,structures:this.structures},point={x:Number(x),y:Number(y)};
  const plot=plotId?layout.plots.find(p=>p.id===plotId):layout.plots.filter(p=>Math.hypot(p.x-point.x,p.y-point.y)<=p.r+20).sort((a,b)=>Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(b.x-point.x,b.y-point.y))[0];
  if(plot){const status=MAPS.plotStatus('frontier',plot,team,state);if(!status.ok)return status;return {ok:true,x:plot.x,y:plot.y,plotId:plot.id}}
  return this.freeSite(team,type,point);
 },
 freeSite(team,type,point){
  const def=STRUCTURES[type];
  if(!MAPS.inBuildArea('frontier',team,point,{nodes:this.nodes,structures:this.structures}))return {ok:false,reason:'Build inside your territory, near a checkpoint you hold, or beside your forward structures'};
  if(!MAPS.clearOfRoads('frontier',point,def.radius))return {ok:false,reason:'Keep the roads open - move off the road'};
  return {ok:true,x:point.x,y:point.y,plotId:null};
 },
 territorySite(team,type,x,y,plotId){
  const def=STRUCTURES[type];if(!CATALOG.allowed(type,team))return {ok:false,reason:'Your faction cannot build that'};
  const missing=CATALOG.missing(type,this.builtTypes(team));if(missing.length)return {ok:false,reason:'Requires '+missing.map(m=>CATALOG.name(m,team)).join(' and ')};
  if(def.size==='large')return this.resolvePlot(team,type,x,y,plotId);
  const point={x:Number(x),y:Number(y)};
  if(!MAPS.inBuildArea('frontier',team,point,{nodes:this.nodes,structures:this.structures}))return {ok:false,reason:'Build inside your territory, near a checkpoint you hold, or beside your forward structures'};
  if(type!=='barricade'&&!MAPS.clearOfRoads('frontier',point,def.radius*.6))return {ok:false,reason:'Keep the roads open - only barricades go on a road'};
  return {ok:true,x:point.x,y:point.y,plotId:null};
 },
 assistStructure(team,structureId,builderIds){
  if(this.phase!=='playing')return {ok:false,reason:'No active battle'};
  const structure=this.structures.find(s=>s.id===structureId&&s.team===team&&s.status==='building');if(!structure)return {ok:false,reason:'Select a friendly building under construction'};
  const engineers=this.units.filter(u=>u.team===team&&u.type==='engineer'&&Array.isArray(builderIds)&&builderIds.includes(u.id));if(!engineers.length)return {ok:false,reason:'Select an engineer to assist'};
  for(const e of engineers){e.order='construct';e.targetId=structure.id;e.dest={x:structure.x,y:structure.y};e.hold=false;e.job=null;e.path=null}
  this.event(engineers.length+' ENGINEER'+(engineers.length>1?'S':'')+' ASSISTING - '+CATALOG.name(structure.type,team).toUpperCase(),team);return {ok:true};
 },
 // Engineers that are on site for a project; extra engineers speed it up with diminishing returns.
 buildersOn(structure){return this.units.filter(u=>u.team===structure.team&&u.type==='engineer'&&u.order==='construct'&&u.targetId===structure.id&&Math.hypot(u.x-structure.x,u.y-structure.y)<=structure.radius+u.radius+24)},
 buildRate(count){let rate=0;for(let i=0;i<Math.min(count,CATALOG.ASSIST_MAX);i++)rate+=Math.pow(CATALOG.ASSIST_FALLOFF,i);return rate},
 // Moves that would carry units into the enemy territory are refused while the ceasefire holds.
 ceasefireBlocks(team,x,y){
  if(!this.ceasefire())return null;const owner=MAPS.territoryOf('frontier',{x,y});
  return owner!==null&&owner!==team?'Ceasefire - you cannot enter enemy territory until the assault window opens':null;
 },
 territorySnapshot(){
  const t=this.territory;if(!t)return null;
  const remaining=t.stage==='prepare'?t.prepDuration-t.stageTime:t.stage==='warning'?t.warningDuration-t.stageTime:this.variant==='war'?Math.max(0,t.liveDuration-t.liveTime):t.liveTime;
  return {objective:t.objective||null,stage:t.stage,remaining:Math.max(0,Math.ceil(remaining)),prepDuration:t.prepDuration,warningDuration:t.warningDuration,liveDuration:t.liveDuration,winPoints:t.winPoints,threat:t.threat,ready:t.ready||null,readyBy:t.readyBy||[],skipBy:t.skipBy||[],
   ai:[...this.ais.values()].map(ai=>({team:ai.team,level:ai.level}))};
 }
};
module.exports={territory,PREP_CHOICES};
