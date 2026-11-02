'use strict';
const {W,H,BOUNDS,UNITS,STRUCTURES,IED,START_CREDITS,MAX_SUPPLY,MAX_TIME,WIN_SCORE,NODES}=require('./config');
const {blockers:sceneryBlockers,theatre:getTheatre,theatreIds,layouts,territoryOf}=require('../public/maps');
const {territory:territoryMethods,PREP_CHOICES}=require('./territory');
const {civilians:civilianMethods}=require('./civilians');
const {intel:intelMethods}=require('./intel');
const {modes:modeMethods,MODES}=require('./modes');
const {tactics:tacticMethods,WALL}=require('./tactics');
const {CATALOG}=require('./config');
// Safe Haven assault pacing per difficulty: seconds between waves, opening size, growth per wave and cap.
const WAVE_PLAN={recruit:{gap:24,base:2,grow:1,max:6},standard:{gap:18,base:3,grow:1.4,max:9},veteran:{gap:13,base:4,grow:2,max:12}};
const LANES=[360,675,960],QUEUE_LIMIT=20;
const rnum=(min,max)=>min+Math.random()*(max-min);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const hypot=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

class Game {
 constructor({mode='solo',roomCode='TEST',duration=MAX_TIME,difficulty='veteran',mapId='coastal',terrainSeed=0x43a91f2d,training=false,missionId=null,guided=false,theatreId=null,scenario=null,prepMinutes=5,variant='war'}={}){
  this.code=roomCode;this.mode=mode;this.missionId=mode==='solo'&&missionId==='safe-haven'?'safe-haven':null;this.scenario=!this.missionId&&scenario==='territory'?'territory':null;this.prepMinutes=PREP_CHOICES.includes(Number(prepMinutes))?Number(prepMinutes):5;this.variant=scenario==='territory'&&MODES[variant]?variant:'war';if(this.variant!=='war')this.prepMinutes=MODES[this.variant].prepMinutes;this.maxSupply=MAX_SUPPLY;this.mapId=this.missionId||(this.scenario?'frontier':['coastal','desert','frozen'].includes(mapId)?mapId:'coastal');this.theatreId=this.missionId||this.scenario?(theatreIds.includes(theatreId)?theatreId:theatreIds[0]):null;this.theatre=this.theatreId?getTheatre(this.theatreId):null;this.terrainSeed=Number(terrainSeed)>>>0;this.difficulty=['recruit','standard','veteran'].includes(difficulty)?difficulty:'recruit';this.training=mode==='solo'&&Boolean(training);this.guided=mode==='solo'&&Boolean(guided);this.duration=this.missionId?420:duration;this.phase='lobby';this.time=0;this.events=[];this.eventId=1;this.seq=1;
  this.teams=[];this.units=[];this.bases=[];this.nodes=[];this.structures=[];this.facilities=[];this.caches=[];this.mines=[];this.projectiles=[];this.blasts=[];this.participants=[];this.mission=null;
  this.win=null;this.aiClock=0;this.incomeClock=0;this.snapshotClock=0;this.round=0;
  this.resetWorld();
 }
 nextId(prefix='o'){return prefix+(this.seq++)}
 event(text,team=null){this.events.push({id:this.eventId++,text,team});if(this.events.length>12)this.events.shift()}
 // Territory War allows two commanders per faction sharing one army and treasury; other modes one.
 teamCapacity(){return this.scenario==='territory'?2:1}
 addParticipant(id,name,team,isBot=false){if(this.phase!=='lobby')return false;if(this.participants.filter(p=>p.team===team).length>=this.teamCapacity()||isBot&&this.participants.some(p=>p.team===team)||this.participants.some(p=>p.team===team&&p.bot))return false;this.participants.push({id,name:name.slice(0,18),team,bot:isBot,connected:true});return true}
 resetWorld(){
  this.civilians=null;this.paused=false;
  this.time=0;this.aiClock=0;this.incomeClock=0;this.seq=1;this.eventId=1;this.stats=[0,1].map(()=>({built:0,trained:0,caches:0,lost:0,planted:0,detected:0,defused:0}));this.units=[];this.bases=[];this.structures=[];this.facilities=[];this.caches=[];this.mines=[];this.projectiles=[];this.blasts=[];this.events=[];this.win=null;
  const recruit=this.mode==='solo'&&this.difficulty==='recruit';
  this.teams=[{credits:recruit?620:START_CREDITS,energy:130,points:0,kills:0,powerCooldown:0},{credits:recruit?160:START_CREDITS,energy:130,points:0,kills:0,powerCooldown:0}];
  this.nodes=NODES.map((n,i)=>({...n,id:'node'+i,owner:-1,progress:0}));
  this.bases=[{id:'hq0',kind:'hq',team:0,x:260,y:675,hp:1500,maxHp:1500,radius:58,cd:0,range:190},
              {id:'hq1',kind:'hq',team:1,x:2140,y:675,hp:1500,maxHp:1500,radius:58,cd:0,range:190},
              {id:'tur0a',kind:'turret',team:0,x:430,y:390,hp:280,maxHp:280,radius:28,cd:0,range:230},
              {id:'tur0b',kind:'turret',team:0,x:430,y:960,hp:280,maxHp:280,radius:28,cd:0,range:230},
              {id:'tur1a',kind:'turret',team:1,x:1970,y:390,hp:280,maxHp:280,radius:28,cd:0,range:230},
              {id:'tur1b',kind:'turret',team:1,x:1970,y:960,hp:280,maxHp:280,radius:28,cd:0,range:230}];
  if(this.missionId==='safe-haven')this.resetSafeHaven();
  if(this.scenario==='territory')this.resetTerritory();
 }
 resetSafeHaven(){
  this.training=true;this.teams=[{credits:760,energy:130,points:0,kills:0,powerCooldown:0},{credits:300,energy:130,points:0,kills:0,powerCooldown:0}];
  const T=this.theatre,N=T.nodes;this.nodes=[{id:'node0',x:825,y:335,name:N[0],owner:0,progress:-100},{id:'node1',x:1120,y:675,name:N[1],owner:-1,progress:0},{id:'node2',x:1780,y:1030,name:N[2],owner:-1,progress:0},{id:'node3',x:650,y:1050,name:N[3],kind:'outpost',reward:'credits',owner:-1,progress:0},{id:'node4',x:1570,y:320,name:N[4],kind:'outpost',reward:'energy',owner:-1,progress:0}];
  this.bases=[{id:'hq0',kind:'hq',team:0,x:250,y:680,hp:1800,maxHp:1800,radius:58,cd:0,range:190},{id:'hq1',kind:'hq',team:1,x:2190,y:675,hp:1300,maxHp:1300,radius:52,cd:0,range:170}];
  this.facilities=[{id:'facility-clinic',kind:'civilianClinic',team:0,x:790,y:480,hp:720,maxHp:720,radius:45,name:T.facilities.clinic},{id:'facility-market',kind:'market',team:0,x:1040,y:900,hp:660,maxHp:660,radius:48,name:T.facilities.market},{id:'facility-centre',kind:'community',team:0,x:560,y:830,hp:760,maxHp:760,radius:48,name:T.facilities.centre},{id:'facility-school',kind:'community',team:0,x:1260,y:430,hp:690,maxHp:690,radius:46,name:T.facilities.school}];
  this.caches=[{id:'cache-credits',kind:'cache',reward:'credits',x:520,y:390,radius:26,claimedBy:null},{id:'cache-repair',kind:'cache',reward:'repair',x:1320,y:880,radius:26,claimedBy:null},{id:'cache-defense',kind:'cache',reward:'defense',x:1680,y:565,radius:26,claimedBy:null}];
  this.mission={id:'safe-haven',stage:'tutorial',stageTime:0,prepDuration:this.prepMinutes*60,warningDuration:120,prepareRemaining:this.prepMinutes*60,wave:0,routeHeld:0,facilitiesRequired:3,guided:this.guided,waveClock:0,nextWaveIn:0,residents:240,evacuated:0};
 }
 start(){if(![0,1].every(t=>this.participants.some(p=>p.team===t)))return false;this.resetWorld();this.round++;this.phase='playing';
  if(this.scenario==='territory'){this.startTerritory();return true}
  if(this.missionId==='safe-haven'){
   this.spawn(0,'engineer',true);this.spawn(0,'rifle',true);this.spawn(0,'rifle',true);this.spawn(0,'rifle',true);this.spawn(0,'rifle',true);this.spawn(0,'scanner',true);this.spawn(0,'engineer',true);const formation=[[345,610],[330,705],[372,725],[330,765],[372,785],[400,640],[350,560]];this.units.forEach((unit,index)=>{[unit.x,unit.y]=formation[index]||[unit.x,unit.y];unit.order='hold';unit.dest=null;unit.hold=true;unit.angle=0});this.event(this.theatre.operation.toUpperCase()+' - '+this.theatre.city.toUpperCase()+', '+this.theatre.state.toUpperCase()+' STATE',0);this.plantInfiltrators(Math.round(this.theatre.threat.ied*3));return true;
  }
  for(let team=0;team<2;team++){
   const beginnerBot=this.mode==='solo'&&team===1&&this.difficulty==='recruit';
   for(let i=0;i<(beginnerBot?2:4);i++)this.spawn(team,'rifle',true);
   if(!beginnerBot)this.spawn(team,'tank',true);
  }
  if(this.training)for(const unit of this.units){unit.order='hold';unit.dest=null;unit.hold=true}
  this.event('THE FRONTIER IS CONTESTED — CAPTURE THE THREE RELAYS');return true;
 }
 tutorialComplete(team){if(!this.mission)return this.completeTraining(team);if(team!==0)return {ok:false,reason:'Only the trainee commander can complete onboarding'};if(this.mission.stage!=='tutorial')return {ok:true};this.mission.stage='prepare';this.mission.stageTime=0;this.mission.prepareRemaining=this.mission.prepDuration;this.event(Math.round(this.mission.prepDuration/60)+' MINUTES OF PROTECTED PREPARATION BEGIN',0);return {ok:true}}
 completeTraining(team,playerId=null){if(this.scenario==='territory')return this.territoryReady(team,playerId);if(!this.training)return {ok:true};if(team!==0)return {ok:false,reason:'Only the trainee commander can finish training'};if(this.mission?.stage==='tutorial')return {ok:false,reason:'Complete or skip the field tutorial first'};if(this.mission?.stage==='prepare'){this.mission.stage='warning';this.mission.stageTime=0;this.mission.prepareRemaining=this.mission.warningDuration;this.event('HOSTILES STAGING IN '+(this.theatre?.zones.staging||'THE EAST').toUpperCase()+' - FIRST ASSAULT IN 2:00',0);return {ok:true,warning:true}}this.training=false;this.aiClock=0;this.incomeClock=0;if(this.mission){this.mission.stage='protect';this.mission.stageTime=0;this.mission.prepareRemaining=0;this.spawnMissionWave(1);this.event('DEFENSE BEGUN - PROTECT CIVILIANS AND THE EVACUATION ROUTE',0)}else{for(const unit of this.units.filter(unit=>unit.team===1)){unit.hold=false;unit.order='attackmove';unit.dest={x:W/2,y:H/2}}this.event('FIELD TRAINING COMPLETE - LIVE BATTLE STARTED',0)}return {ok:true}}
 // Host-requested pause (app backgrounded). Only a match with a single human may pause: nobody
 // else's game is ever frozen, and it never applies to versus or co-op.
 setPaused(paused,playerId){if(this.phase!=='playing')return {ok:false,reason:'No active battle'};const humans=this.participants.filter(p=>!p.bot);if(paused&&(humans.length!==1||humans[0].id!==playerId))return {ok:false,reason:'Only solo battles can pause'};this.paused=Boolean(paused);return {ok:true,paused:this.paused}}
 supply(team){return this.units.filter(u=>u.team===team).reduce((sum,u)=>sum+UNITS[u.type].supply,0)}
 spawn(team,type,free=false){
  const d=UNITS[type],t=this.teams[team]; if(!d||!t||this.phase!=='playing'&&!free)return {ok:false,reason:'No battle running'};
  if(this.scenario==='territory'&&!free){if(type==='engineer'){const hq=this.bases.find(b=>b.team===team&&b.kind==='hq'&&b.hp>0);return hq?this.produce(team,hq.id,'engineer'):{ok:false,reason:'Command HQ destroyed'}}return {ok:false,reason:'Recruit from your barracks, workshop or factory'}}
  if(type==='engineer'&&this.missionId!=='safe-haven'&&this.scenario!=='territory')return {ok:false,reason:'Engineers are assigned to Operation Safe Haven'};if(type==='patrol'&&!free)return {ok:false,reason:'Produce patrol vehicles from a workshop'};
  if(this.supply(team)+d.supply>this.supplyCap(team))return {ok:false,reason:'Unit supply cap reached'};
  if(!free&&t.credits<d.cost)return {ok:false,reason:'Insufficient credits'};
  const base=this.bases.find(b=>b.kind==='hq'&&b.team===team&&b.hp>0);if(!base)return {ok:false,reason:'Command center destroyed'};
  if(!free){t.credits-=d.cost;this.stats[team].trained++}
  const side=team===0?1:-1;
  const x=base.x+side*rnum(68,104),y=clamp(base.y+rnum(-140,140),BOUNDS.top+15,BOUNDS.bottom-15);
  const objective=this.nodes[team===0?1:1];
  const u={id:this.nextId('u'),team,type,x,y,hp:d.hp,maxHp:d.hp,radius:d.radius,cd:rnum(0,0.6),order:'attackmove',dest:{x:objective.x+(team?60:-60),y:objective.y+rnum(-30,30)},targetId:null,hold:false,angle:team===0?0:Math.PI,vx:0,vy:0};
  this.units.push(u);return {ok:true,unit:u};
 }
 constructionSite(team,type,x,y,builderIds,plotId=null,rot=0){
  const territory=this.scenario==='territory';
  if(!(this.missionId==='safe-haven'||territory)||this.phase!=='playing')return {ok:false,reason:'Construction is only available in Safe Haven and Territory War'};
  const definition=STRUCTURES[type];if(!definition)return {ok:false,reason:'Unknown structure'};
  let px=Number(x),py=Number(y);
  const namedPlot=territory&&plotId?layouts.frontier.plots.find(p=>p.id===plotId):null;if(namedPlot){px=namedPlot.x;py=namedPlot.y}
  if(!Number.isFinite(px)||!Number.isFinite(py)||px<BOUNDS.left+45||px>BOUNDS.right-45||py<BOUNDS.top+45||py>BOUNDS.bottom-45)return {ok:false,reason:'Build inside the marked boundary'};
  let site=null;if(territory){site=this.territorySite(team,type,px,py,plotId);if(!site.ok)return site;px=site.x;py=site.y}
  // Explicitly selected free engineers all work on the new site; otherwise the nearest free one goes.
  const engineers=this.units.filter(unit=>unit.team===team&&unit.type==='engineer'),busy=unit=>unit.order==='repair'||unit.order==='construct'&&this.structures.some(s=>s.id===unit.targetId&&s.status==='building'),free=engineers.filter(unit=>!busy(unit));
  let builders=free.filter(unit=>Array.isArray(builderIds)&&builderIds.includes(unit.id));
  if(!builders.length)builders=[...free].sort((a,b)=>Math.hypot(a.x-px,a.y-py)-Math.hypot(b.x-px,b.y-py)).slice(0,1);
  if(!builders.length)return {ok:false,reason:engineers.length?'All engineers are busy - train another at the HQ or have one assist':'No engineers left - train one at the HQ'};
  const blockers=[...this.bases,...this.facilities,...this.structures,...this.nodes];if(blockers.some(object=>object.hp!==0&&Math.hypot(object.x-px,object.y-py)<(object.radius||44)+definition.radius+(site?.plotId?6:18)))return {ok:false,reason:'That location is blocked'};if(sceneryBlockers(this.mapId).some(object=>Math.hypot(object.x-px,object.y-py)<object.radius+definition.radius+10))return {ok:false,reason:'Homes and market stalls block that site'};
  if(this.teams[team].credits<definition.cost)return {ok:false,reason:'Need '+definition.cost+' credits'};this.teams[team].credits-=definition.cost;
  const structure={id:this.nextId('s'),team,type,x:px,y:py,hp:Math.ceil(definition.hp*.3),maxHp:definition.hp,radius:definition.radius,status:'building',progress:0,buildTime:definition.buildTime,level:1,cd:0,production:null,upgradeProgress:0,builderId:builders[0].id,builders:0,plotId:site?.plotId||null};if(type==='barricade')structure.rot=Number(rot)===1?1:0;this.structures.push(structure);
  for(const builder of builders){builder.order='construct';builder.dest={x:px,y:py};builder.targetId=structure.id;builder.hold=false;builder.job=null;builder.path=null}this.event('CONSTRUCTION STARTED - '+(territory?CATALOG.name(type,team):definition.label).toUpperCase(),team);return {ok:true,structure};
 }
 // Production queues: up to 20 orders per building. Each order is paid for when it starts, so a
 // long queue waits for credits and supply instead of failing.
 produce(team,structureId,type,count=1){
  const recipe=CATALOG.PRODUCTION[type],definition=UNITS[type];if(!recipe||!definition||recipe.from==='hq'&&this.scenario!=='territory')return {ok:false,reason:'That unit cannot be produced here'};
  const producer=recipe.from==='hq'?this.bases.find(b=>b.id===structureId&&b.team===team&&b.kind==='hq'&&b.hp>0):this.structures.find(s=>s.id===structureId&&s.team===team&&s.type===recipe.from&&s.status==='active'&&(STRUCTURES[s.type].produces||[]).includes(type));
  if(!producer)return {ok:false,reason:'Select an active '+(recipe.from==='hq'?'command HQ':CATALOG.name(recipe.from,team).toLowerCase())};
  const queue=producer.queue||(producer.queue=[]),used=queue.length+(producer.production?1:0),wanted=clamp(Math.floor(Number(count)||1),1,QUEUE_LIMIT);
  if(used>=QUEUE_LIMIT)return {ok:false,reason:'Queue full ('+QUEUE_LIMIT+')'};
  if(!used){const blocked=this.productionBlocked(team,type);if(blocked&&wanted===1)return {ok:false,reason:blocked}}
  const added=Math.min(wanted,QUEUE_LIMIT-used);for(let i=0;i<added;i++)queue.push(type);
  this.startNextProduction(producer);
  if(added>1)this.event((added>1?added+' × ':'')+(this.scenario==='territory'?CATALOG.UNIT_NAMES[team][type]:UNITS[type].label).toUpperCase()+' QUEUED',team);
  return {ok:true,queued:added};
 }
 productionBlocked(team,type){const definition=UNITS[type],queued=[...this.structures,...this.bases].filter(value=>value.team===team&&value.production).reduce((sum,value)=>sum+(UNITS[value.production.type]?.supply||0),0);
  if(this.supply(team)+queued+definition.supply>this.supplyCap(team))return 'Unit supply cap reached - build a supply depot';if(this.teams[team].credits<definition.cost)return 'Need '+definition.cost+' credits';return null}
 startNextProduction(producer){
  if(producer.production||!producer.queue?.length)return;const type=producer.queue[0],blocked=this.productionBlocked(producer.team,type);producer.waiting=blocked;if(blocked)return;
  producer.queue.shift();this.teams[producer.team].credits-=UNITS[type].cost;producer.production={type,progress:0,duration:CATALOG.PRODUCTION[type].time};
  if(this.scenario==='territory')this.event(CATALOG.UNIT_NAMES[producer.team][type].toUpperCase()+' IN PRODUCTION',producer.team);
  else if(!producer.queue.length)this.event(type==='rifle'?'INFANTRY SQUAD TRAINING':type==='scanner'?'EAGLE-EYE SCANNER IN PRODUCTION':'PROTECTED PATROL VEHICLE IN PRODUCTION',producer.team);
 }
 cancelQueue(team,structureId){const producer=[...this.structures,...this.bases].find(v=>v.id===structureId&&v.team===team);if(!producer)return {ok:false,reason:'Select one of your buildings'};const n=producer.queue?.length||0;producer.queue=[];producer.waiting=null;return {ok:true,cleared:n}}
 repairStructure(team,structureId,builderIds){
  const structure=this.structures.find(value=>value.id===structureId&&value.team===team&&value.status==='active');if(!structure)return {ok:false,reason:'Select a completed friendly defense'};if(structure.hp>=structure.maxHp)return {ok:false,reason:'This defense is already at full health'};const engineer=this.units.find(unit=>unit.team===team&&unit.type==='engineer'&&builderIds?.includes(unit.id));if(!engineer)return {ok:false,reason:'Select an engineer vehicle to repair'};engineer.order='repair';engineer.dest={x:structure.x,y:structure.y};engineer.targetId=structure.id;engineer.hold=false;this.event('ENGINEER DISPATCHED FOR MAINTENANCE',team);return {ok:true};
 }
 upgradeStructure(team,structureId){
  const structure=this.structures.find(value=>value.id===structureId&&value.team===team&&value.status==='active');if(!structure)return {ok:false,reason:'Select a completed structure'};if(structure.level>=2)return {ok:false,reason:'Structure already upgraded'};if(structure.upgradeProgress)return {ok:false,reason:'Upgrade already underway'};const cost=80;if(this.teams[team].credits<cost)return {ok:false,reason:'Need '+cost+' credits'};this.teams[team].credits-=cost;structure.upgradeProgress=.001;this.event('STRUCTURE UPGRADE STARTED',team);return {ok:true};
 }
 spawnAt(team,type,x,y){const definition=UNITS[type];if(!definition)return null;const unit={id:this.nextId('u'),team,type,x:clamp(x,BOUNDS.left,BOUNDS.right),y:clamp(y,BOUNDS.top,BOUNDS.bottom),hp:definition.hp,maxHp:definition.hp,radius:definition.radius,cd:0,order:'hold',dest:null,targetId:null,hold:true,angle:team===0?0:Math.PI,vx:0,vy:0};this.units.push(unit);return unit}
 command(team,ids,action,x,y,targetId){
  if(this.phase!=='playing')return {ok:false,reason:'No active battle'};
  if(!['move','attackmove','hold','focus','stop'].includes(action))return {ok:false,reason:'Invalid command'};
  if(!Array.isArray(ids)||ids.length>100)return {ok:false,reason:'Invalid selection'};
  const units=this.units.filter(u=>u.team===team&&ids.includes(u.id));if(!units.length)return {ok:false,reason:'Select your units first'};
  if(action==='focus'){
   const obj=this.combatants().find(v=>v.id===targetId&&v.team!==team&&v.hp>0);
   if(!obj)return {ok:false,reason:'Target unavailable'};if(this.ceasefire())return {ok:false,reason:'Ceasefire - attacks unlock when the battle goes live'};
  }
  if((action==='move'||action==='attackmove')&&this.ceasefireBlocks(team,Number(x),Number(y)))return {ok:false,reason:this.ceasefireBlocks(team,Number(x),Number(y))};
  units.forEach((u,i)=>{
   const spread=(i-(units.length-1)/2)*27;
   u.order=action;u.job=null;u.path=null;u.captureSquad=false;u.targetId=action==='focus'?targetId:null;
   u.hold=action==='hold'||action==='stop';u.stance=action==='hold'?'hold':'guard';u.post=null;u.returning=false;
   if(action==='move'||action==='attackmove')u.dest={x:clamp(Number(x)||u.x,BOUNDS.left,BOUNDS.right),y:clamp((Number(y)||u.y)+spread,BOUNDS.top,BOUNDS.bottom)};
   if(action==='focus')u.dest=null;
  });
  return {ok:true,count:units.length};
 }
 orbital(team,x,y){
  const t=this.teams[team];if(this.phase!=='playing')return {ok:false,reason:'Battle ended'};
  if(t.energy<110)return {ok:false,reason:'Need 110 energy'};
  if(t.powerCooldown>this.time)return {ok:false,reason:'Orbital strike cooling down'};
  if(this.ceasefire())return {ok:false,reason:'Ceasefire - strikes unlock when the battle goes live'};
  t.energy-=110;t.powerCooldown=this.time+24;
  const px=clamp(Number(x)||W/2,BOUNDS.left,BOUNDS.right),py=clamp(Number(y)||H/2,BOUNDS.top,BOUNDS.bottom);
  this.blasts.push({id:this.nextId('blast'),team,x:px,y:py,delay:1.25,age:0,radius:100,duration:0.9,hit:false});
  this.event((team===0?'AZURE':'CRIMSON')+' ORBITAL STRIKE INBOUND',team);
  return {ok:true};
 }
 // ---- IEDs and the Eagle-Eye scanner -------------------------------------------------
 // Charges are hidden from the opposing side until a scanner sweeps them. Revealed hostile
 // charges are steered around automatically, or a scanner can be sent in to defuse them.
 activeCharges(team){return this.mines.filter(mine=>mine.team===team).length+this.units.filter(unit=>unit.team===team&&unit.order==='plant').length}
 plantIed(team,ids,x,y){
  if(this.phase!=='playing')return {ok:false,reason:'No active battle'};
  const px=Number(x),py=Number(y);if(!Number.isFinite(px)||!Number.isFinite(py)||px<BOUNDS.left+20||px>BOUNDS.right-20||py<BOUNDS.top+20||py>BOUNDS.bottom-20)return {ok:false,reason:'Plant charges inside the battlefield'};
  const planters=this.units.filter(unit=>unit.team===team&&Array.isArray(ids)&&ids.includes(unit.id)&&IED.planters.includes(unit.type));if(!planters.length)return {ok:false,reason:'Select a rifle squad or engineer to plant a charge'};
  if(this.activeCharges(team)>=IED.maxActive)return {ok:false,reason:'Charge limit reached ('+IED.maxActive+' active)'};
  if(this.teams[team].credits<IED.cost)return {ok:false,reason:'Need '+IED.cost+' credits'};
  if(this.mines.some(mine=>Math.hypot(mine.x-px,mine.y-py)<56))return {ok:false,reason:'A charge is already planted there'};
  if([...this.bases,...this.facilities,...this.nodes].some(object=>object.hp!==0&&Math.hypot(object.x-px,object.y-py)<(object.radius||40)+30))return {ok:false,reason:'Too close to a building or objective'};
  const planter=planters.sort((a,b)=>Math.hypot(a.x-px,a.y-py)-Math.hypot(b.x-px,b.y-py))[0];
  planter.order='plant';planter.job={x:px,y:py,progress:0};planter.dest={x:px,y:py};planter.hold=false;planter.targetId=null;
  return {ok:true,unitId:planter.id};
 }
 defuseIed(team,ids,mineId){
  if(this.phase!=='playing')return {ok:false,reason:'No active battle'};
  const scanners=this.units.filter(unit=>unit.team===team&&Array.isArray(ids)&&ids.includes(unit.id)&&unit.type==='scanner');if(!scanners.length)return {ok:false,reason:'Only an Eagle-Eye scanner can defuse charges'};
  const known=this.mines.filter(mine=>mine.team!==team&&mine.revealed[team]);
  const mine=mineId?known.find(value=>value.id===mineId):known.sort((a,b)=>hypot(scanners[0],a)-hypot(scanners[0],b))[0];if(!mine)return {ok:false,reason:mineId?'That charge is no longer there':'No detected charges — sweep the roads first'};
  const scanner=scanners.sort((a,b)=>hypot(a,mine)-hypot(b,mine))[0];
  scanner.order='defuse';scanner.targetId=mine.id;scanner.job={progress:0};scanner.dest={x:mine.x,y:mine.y};scanner.hold=false;
  return {ok:true,unitId:scanner.id,mineId:mine.id};
 }
 // Runs a unit's plant/defuse job. 'busy' = working on the spot, 'move' = travelling there.
 stepIedJob(u,dt){
  if(u.order==='plant'){const job=u.job;if(!job){u.order='hold';u.hold=true;return null}
   if(Math.hypot(u.x-job.x,u.y-job.y)>IED.plantRange){u.dest={x:job.x,y:job.y};return 'move'}
   job.progress+=dt;u.angle+=dt*.6;if(job.progress<IED.plantTime)return 'busy';
   u.order='hold';u.hold=true;u.job=null;u.dest=null;
   if(this.teams[u.team].credits<IED.cost){this.event('CHARGE ABANDONED - NOT ENOUGH CREDITS',u.team);return 'busy'}
   this.teams[u.team].credits-=IED.cost;this.stats[u.team].planted++;
   this.mines.push({id:this.nextId('ied'),team:u.team,x:job.x,y:job.y,armedAt:this.time+IED.arm,revealed:[false,false]});
   this.event('CHARGE PLANTED - '+this.placeName(job),u.team);return 'busy';
  }
  if(u.order==='defuse'){const mine=this.mines.find(value=>value.id===u.targetId);if(!mine){u.order='hold';u.hold=true;u.job=null;u.targetId=null;u.dest=null;return null}
   if(Math.hypot(u.x-mine.x,u.y-mine.y)>IED.defuseRange+u.radius){u.dest={x:mine.x,y:mine.y};return 'move'}
   u.job=u.job||{progress:0};u.job.progress+=dt;u.angle=Math.atan2(mine.y-u.y,mine.x-u.x);if(u.job.progress<IED.defuseTime)return 'busy';
   this.mines=this.mines.filter(value=>value!==mine);this.teams[u.team].credits=Math.min(1100,this.teams[u.team].credits+IED.salvage);this.stats[u.team].defused++;
   u.order='hold';u.hold=true;u.job=null;u.targetId=null;u.dest=null;this.event('IED DEFUSED - '+this.placeName(mine)+' (+'+IED.salvage+' CR SALVAGE)',u.team);return 'busy';
  }
  return null;
 }
 stepMines(){
  const scan=UNITS.scanner.scan;
  for(const scanner of this.units){if(scanner.type!=='scanner')continue;for(const mine of this.mines)if(mine.team!==scanner.team&&!mine.revealed[scanner.team]&&Math.hypot(mine.x-scanner.x,mine.y-scanner.y)<=scan){mine.revealed[scanner.team]=true;this.stats[scanner.team].detected++;this.event('EAGLE-EYE DETECTED AN IED - '+this.placeName(mine),scanner.team)}}
  if(this.training||this.ceasefire())return;
  for(const mine of [...this.mines]){if(this.time<mine.armedAt)continue;if(this.units.some(unit=>unit.team!==mine.team&&unit.type!=='scanner'&&Math.hypot(unit.x-mine.x,unit.y-mine.y)<IED.trigger+unit.radius*.5))this.detonate(mine)}
 }
 detonate(mine){
  this.mines=this.mines.filter(value=>value!==mine);
  this.blasts.push({id:this.nextId('ied'),kind:'ied',team:mine.team,x:mine.x,y:mine.y,delay:0,age:0,radius:IED.radius,duration:1.15,hit:true});
  for(const target of this.combatants()){if(target.team===mine.team||target.hp<=0)continue;const d=Math.hypot(target.x-mine.x,target.y-mine.y);if(d>IED.radius+target.radius)continue;
   const falloff=1-.55*clamp(d/IED.radius,0,1),armor=['tank','patrol'].includes(target.type)||!this.units.includes(target)?.6:1;this.applyDamage(target,IED.damage*falloff*armor,mine.team)}
  this.strayFire(mine.x,mine.y,IED.radius,IED.damage,mine.team);
  this.event('IED DETONATED - '+this.placeName(mine),mine.team);
 }
 visibleMines(team){return this.mines.filter(mine=>mine.team===team||mine.revealed[team]).map(mine=>({id:mine.id,team:mine.team,x:Math.round(mine.x),y:Math.round(mine.y),armed:this.time>=mine.armedAt}))}
 // Plain-language location for the radio feed: road name in a theatre, else nearest objective.
 placeName(point){
  if(this.theatre){let best=null,nearest=80;for(const road of layouts['safe-haven'].roads){for(let i=1;i<road.points.length;i++){const [ax,ay]=road.points[i-1],[bx,by]=road.points[i],vx=bx-ax,vy=by-ay,t=clamp(((point.x-ax)*vx+(point.y-ay)*vy)/(vx*vx+vy*vy||1),0,1),d=Math.hypot(point.x-ax-vx*t,point.y-ay-vy*t);if(d<nearest){nearest=d;best=road}}}
   if(best&&this.theatre.roads[best.id])return this.theatre.roads[best.id].toUpperCase()}
  const node=[...this.nodes].sort((a,b)=>hypot(a,point)-hypot(b,point))[0];return node?'NEAR '+node.name:'IN THE FIELD';
 }
 // Insurgent infiltrators bury charges ahead of the assault on the roads into town.
 plantInfiltrators(count){
  if(!this.theatre||count<=0)return;const roads=layouts['safe-haven'].roads.filter(road=>['highway','evacuation','school-road','market-street'].includes(road.id));
  for(let n=0,tries=0;n<count&&tries<60&&this.mines.filter(mine=>mine.team===1).length<8;tries++){
   const road=roads[Math.floor(Math.random()*roads.length)],i=1+Math.floor(Math.random()*(road.points.length-1)),[ax,ay]=road.points[i-1],[bx,by]=road.points[i],t=Math.random(),x=ax+(bx-ax)*t,y=ay+(by-ay)*t;
   if(x<1000||x>1980)continue;if(this.mines.some(mine=>Math.hypot(mine.x-x,mine.y-y)<140))continue;if([...this.facilities,...this.nodes,...this.structures].some(object=>Math.hypot(object.x-x,object.y-y)<(object.radius||40)+40))continue;
   this.mines.push({id:this.nextId('ied'),team:1,x,y,armedAt:this.time+IED.arm,revealed:[false,false]});n++;
  }
 }
 applyDamage(target,damage,attacker){
  if(this.training&&target.team===0)return;
  if(this.ceasefire())return;
  if(this.mission?.guided&&this.mission.wave<=1&&target.team===0&&(this.facilities.includes(target)||target.kind==='hq'))damage=Math.min(damage,Math.max(0,target.hp-target.maxHp*.4));
  if(this.teams[target.team]?.defenseBoostUntil>this.time)damage*=.72;
  target.hp=Math.max(0,target.hp-damage);
  if(target.hp>0)return;
  if(this.units.includes(target)){this.units=this.units.filter(u=>u.id!==target.id);this.stats[target.team].lost++}
  else if(this.structures.includes(target)){this.structures=this.structures.filter(value=>value!==target);this.event((this.scenario==='territory'?CATALOG.name(target.type,target.team)+' DESTROYED':'DEFENSE DESTROYED - '+STRUCTURES[target.type].label).toUpperCase(),target.team);if(this.scenario==='territory'&&attacker!=null)this.teams[attacker].points+=40}
  else if(this.facilities.includes(target)){this.event(target.name.toUpperCase()+' HAS BEEN LOST',0);if(this.scenario==='territory'){this.territory.lost[0]++;if(attacker===1)this.teams[1].points+=120}else if(this.mission&&this.facilities.filter(value=>value.hp>0).length<this.mission.facilitiesRequired)this.end(1,'CIVILIAN SAFETY NETWORK COLLAPSED')}
  else{if(target.kind==='turret')this.event(this.teamName(target.team)+' LOST A TURRET',target.team);
  if(target.kind==='hq')this.end(1-target.team,this.scenario==='territory'?(target.team===0?'COMMUNITY HQ DESTROYED':'RAIDER CAMP DESTROYED'):this.missionId==='safe-haven'?(target.team===0?'SAFE HAVEN COMMAND POST LOST':'TOWN SECURED'):'COMMAND CENTER DESTROYED')}
  if(attacker!==null&&attacker!==undefined){this.teams[attacker].kills++;this.teams[attacker].credits+=target.type?9:40}
 }
 applyReward(team,reward,source){
  const squad=this.units.filter(unit=>unit.team===team);
  if(reward==='credits')this.teams[team].credits=Math.min(1100,this.teams[team].credits+120);
  else if(reward==='energy')this.teams[team].energy=Math.min(180,this.teams[team].energy+65);
  else if(reward==='repair')for(const unit of squad)unit.hp=Math.min(unit.maxHp,unit.hp+unit.maxHp*.3);
  else if(reward==='defense')this.teams[team].defenseBoostUntil=Math.max(this.teams[team].defenseBoostUntil||0,this.time+25);
  this.event((source||'SUPPLY CACHE')+' SECURED - '+reward.toUpperCase()+' SUPPORT RECEIVED',team);
 }
 fire(source,target,damage,speed,splash=0,kind=null){
  this.projectiles.push({id:this.nextId('p'),sourceId:source.id,x:source.x,y:source.y,from:source.team,toX:target.x,toY:target.y,targetId:target.id,damage,speed,splash,age:0,life:3,type:kind||source.type||source.kind});
 }
 step(dt=0.05){
  if(this.phase!=='playing')return;
  dt=clamp(dt,0,0.12);if(!this.training)this.time+=dt;this.aiClock+=dt;this.incomeClock+=dt;
  const ceasefire=this.ceasefire();
  for(const b of this.bases){if(b.hp<=0||b.hackedUntil>this.time)continue;b.cd-=dt;if(this.training||ceasefire)continue;const target=this.closestEnemy(b,b.team,b.range);if(target&&b.cd<=0){this.fire(b,target,b.kind==='hq'?22:25,575,9);b.cd=b.kind==='hq'?0.65:1.0}}
  this.stepStructures(dt);
  const navBudget={count:0};
  for(const u of [...this.units]){
   const d=UNITS[u.type];u.cd-=dt;
   if(this.training&&u.team===1)continue;
   if(u.type==='engineer'&&u.order==='repair'){
    const repairTarget=this.structures.find(value=>value.id===u.targetId&&value.team===u.team&&value.status==='active');if(!repairTarget||repairTarget.hp>=repairTarget.maxHp){u.order='hold';u.dest=null;u.targetId=null;u.hold=true;continue}const repairDistance=Math.hypot(u.x-repairTarget.x,u.y-repairTarget.y);if(repairDistance<=u.radius+repairTarget.radius+24){u.hold=true;const affordable=Math.min(32*dt,this.teams[u.team].credits*4);repairTarget.hp=Math.min(repairTarget.maxHp,repairTarget.hp+affordable);this.teams[u.team].credits=Math.max(0,this.teams[u.team].credits-affordable/4);if(repairTarget.hp>=repairTarget.maxHp){u.order='hold';u.dest=null;u.targetId=null;this.event(STRUCTURES[repairTarget.type].label.toUpperCase()+' REPAIRED',u.team)}continue}}
   if(this.scenario==='territory'&&!(this.training&&u.team===1))this.guardStep(u,d,ceasefire);
   const job=u.order==='plant'||u.order==='defuse'?this.stepIedJob(u,dt):null;if(job==='busy')continue;
   let target=job||ceasefire?null:u.targetId?this.combatants().find(t=>t.id===u.targetId&&t.hp>0&&t.team!==u.team):null;
   if(!job&&!ceasefire&&!target&&u.order!=='move')target=this.closestEnemy(u,u.team,d.range+(u.order==='focus'?220:35));
   // Eagle-Eye rocket pod: automatically fires on any enemy vehicle within range, wherever the scanner is.
   if(u.type==='scanner'){u.rocketCd=Math.max(0,(u.rocketCd||0)-dt);if(!job&&!ceasefire&&u.rocketCd<=0){const vehicle=this.closestVehicle(u,d.rocketRange);if(vehicle){this.fire(u,vehicle,d.rocketDamage,380,d.rocketSplash,'rocket');u.rocketCd=d.rocketRate;if(!target)u.angle=Math.atan2(vehicle.y-u.y,vehicle.x-u.x)}}}
   if(target&&hypot(u,target)<=d.range){
    u.angle=Math.atan2(target.y-u.y,target.x-u.x);
    if(u.cd<=0){this.fire(u,target,d.damage,d.bulletSpeed,d.splash);u.cd=d.fireRate}
    continue;
   }
   if(u.hold)continue;
   let dest=u.dest;
   if((u.order==='focus'||u.order==='engage')&&target)dest={x:target.x,y:target.y};
   if(dest&&dest===u.dest&&['move','attackmove','construct','repair'].includes(u.order)){this.navigate(u,dest,dt,navBudget);dest=u.dest}
   if(!dest||u.order==='attackmove'&&target&&hypot(u,target)<d.range*1.25&&u.type==='rocket')continue;
   const dx=dest.x-u.x,dy=dest.y-u.y,dist=Math.hypot(dx,dy);
   if(dist<d.radius*0.65){if(u.path?.length){u.dest=u.path.shift();continue}if(u.order==='move')u.order='hold';continue}
   const speed=Math.min(d.speed*dt,dist);
   let separationX=0,separationY=0;
   for(const other of this.units){if(other===u)continue;const ox=u.x-other.x,oy=u.y-other.y,near=Math.hypot(ox,oy);if(near>0&&near<d.radius+other.radius+6){separationX+=ox/near*.7;separationY+=oy/near*.7}}
   for(const obstacle of this.structures.filter(value=>value.hp>0)){if(obstacle.type==='barricade'&&this.scenario==='territory'){const push=this.wallPush(u,obstacle,d.radius+WALL.thick+3);if(push){separationX+=push.x*2.6;separationY+=push.y*2.6}continue}const ox=u.x-obstacle.x,oy=u.y-obstacle.y,near=Math.hypot(ox,oy),limit=d.radius+obstacle.radius+3;if(near>0&&near<limit){separationX+=ox/near*2.3;separationY+=oy/near*2.3}}
   for(const mine of this.mines){if(mine.team===u.team||!mine.revealed[u.team]||u.type==='scanner')continue;const ox=u.x-mine.x,oy=u.y-mine.y,near=Math.hypot(ox,oy),limit=IED.trigger+d.radius+30;if(near>0&&near<limit){const push=2.6*(1-near/limit)+.9,side=u.dodge?.id===mine.id?u.dodge.side:(u.dodge={id:mine.id,side:(dx*oy-dy*ox)>=0?1:-1}).side;separationX+=ox/near*push-side*oy/near*1.6;separationY+=oy/near*push+side*ox/near*1.6}}
   const ax=dx/dist+separationX,ay=dy/dist+separationY,len=Math.hypot(ax,ay)||1;
   const nx=clamp(u.x+ax/len*speed,BOUNDS.left,BOUNDS.right),ny=clamp(u.y+ay/len*speed,BOUNDS.top,BOUNDS.bottom);
   if(ceasefire&&this.ceasefireBlocks(u.team,nx,ny)){u.dest=null;u.path=null;u.hold=true;u.order='hold';continue}
   u.x=nx;u.y=ny;
   u.angle=Math.atan2(ay,ax);
  }
  if(this.scenario==='territory'){this.stepCivilians(dt);this.stepIntel(dt)}
  this.stepMines();
  for(const p of [...this.projectiles]){
   p.age+=dt;p.life-=dt;
   const target=this.combatants().find(t=>t.id===p.targetId&&t.hp>0);
   if(target){p.toX=target.x;p.toY=target.y}
   const dx=p.toX-p.x,dy=p.toY-p.y,dist=Math.hypot(dx,dy),advance=p.speed*dt;
   if(dist<advance+9||p.life<=0){
    const victims=this.combatants().filter(v=>v.team!==p.from&&v.hp>0&&Math.hypot(v.x-p.toX,v.y-p.toY)<(p.splash||10)+v.radius);
    for(const v of victims)this.applyDamage(v,p.damage*(v.id===p.targetId?1:p.splash?0.55:1),p.from);
    if(p.splash>=14)this.strayFire(p.toX,p.toY,p.splash,p.damage,p.from);
    this.blasts.push({id:this.nextId('spark'),x:p.toX,y:p.toY,radius:p.splash?Math.max(32,p.splash):17,age:0,delay:0,duration:0.32,hit:true,team:p.from});
    this.projectiles=this.projectiles.filter(o=>o!==p);
   }else{p.x+=dx/dist*advance;p.y+=dy/dist*advance}
  }
  for(const v of [...this.blasts]){
   v.age+=dt;
   if(!v.hit&&v.age>=v.delay){v.hit=true;this.strayFire(v.x,v.y,v.radius,235,v.team);
    for(const target of this.combatants())if(target.hp>0&&target.team!==v.team&&Math.hypot(target.x-v.x,target.y-v.y)<v.radius+target.radius)this.applyDamage(target,target.kind==='hq'?125:235,v.team);
   }
   if(v.age>=v.delay+v.duration)this.blasts=this.blasts.filter(b=>b!==v);
  }
  for(const node of this.nodes){
   const near=[0,1].map(team=>this.training&&team===1?0:this.units.filter(u=>u.team===team&&Math.hypot(u.x-node.x,u.y-node.y)<90).length);
   const direction=near[0]&&!near[1]?-1:near[1]&&!near[0]?1:0;
   if(direction){node.progress=clamp(node.progress+direction*(15+Math.min(near[direction===-1?0:1]-1,3)*4)*dt,-100,100)}
   const previous=node.owner;
   if(node.progress<=-96)node.owner=0;
   else if(node.progress>=96)node.owner=1;
   else if(Math.abs(node.progress)<32)node.owner=-1;
   if(previous!==node.owner){this.event(node.owner===-1?node.name+' CONTESTED':this.teamName(node.owner)+' CAPTURED '+node.name,node.owner);if(node.kind==='outpost'&&node.owner>=0&&previous!==node.owner)this.applyReward(node.owner,node.reward,node.name)}
  }
  for(const cache of this.caches){if(cache.claimedBy!==null)continue;for(let team=0;team<2;team++){if(this.units.some(unit=>unit.team===team&&Math.hypot(unit.x-cache.x,unit.y-cache.y)<70)){cache.claimedBy=team;this.stats[team].caches++;this.applyReward(team,cache.reward,'SUPPLY CACHE');break}}}
  if(this.incomeClock>=1&&this.scenario==='territory'){const seconds=Math.floor(this.incomeClock);this.incomeClock-=seconds;this.territoryIncome(seconds)}
  if(this.incomeClock>=1){const seconds=Math.floor(this.incomeClock);this.incomeClock-=seconds;
   for(let t=0;t<2;t++){const strategic=this.nodes.filter(n=>n.owner===t&&!n.kind).length,outposts=this.nodes.filter(n=>n.owner===t&&n.kind==='outpost').length;this.teams[t].credits=Math.min(1100,this.teams[t].credits+(13+strategic*13+outposts*5)*seconds);this.teams[t].energy=Math.min(180,this.teams[t].energy+(1.2+strategic*1.9+outposts*.8)*seconds);if(!this.training&&!this.scenario)this.teams[t].points+=strategic*seconds*2}
   if(this.facilities.some(facility=>facility.kind==='market'&&facility.hp>0))this.teams[0].credits=Math.min(1100,this.teams[0].credits+4*seconds);
   if(this.training){this.teams[0].credits=Math.max(this.teams[0].credits,620);this.teams[0].energy=Math.max(this.teams[0].energy,130)}
  }
  const aiPeriod=this.mode==='solo'?{recruit:5.2,standard:2.8,veteran:1.3}[this.difficulty]:1.3;
  if(this.scenario==='territory'){for(const ai of this.ais.values())ai.tick(dt)}
  else if(!this.training&&this.aiClock>=aiPeriod){this.aiClock=0;for(const p of this.participants.filter(p=>p.bot))this.aiAction(p.team)}
  for(const facility of this.facilities)if(facility.kind==='civilianClinic'&&facility.hp>0)for(const unit of this.units)if(unit.team===facility.team&&unit.hp<unit.maxHp&&Math.hypot(unit.x-facility.x,unit.y-facility.y)<150)unit.hp=Math.min(unit.maxHp,unit.hp+3*dt);
  if(this.mission)this.stepMission(dt);
  else if(this.scenario==='territory')this.stepTerritory(dt);
  else if(!this.training&&this.teams.some(t=>t.points>=WIN_SCORE))this.end(this.teams[0].points>this.teams[1].points?0:1,'CONTROL POINT VICTORY');
  if(!this.mission&&!this.scenario&&!this.training&&this.time>=this.duration)this.end(this.teams[0].points===this.teams[1].points?this.bases[0].hp>=this.bases[1].hp?0:1:this.teams[0].points>this.teams[1].points?0:1,'TIME LIMIT');
 }
 combatants(){return [...this.units,...this.bases,...this.structures,...this.facilities]}
 closestVehicle(actor,range){let best=null,nearest=Infinity;for(const v of this.units){if(v.team===actor.team||v.hp<=0||['rifle','hacker'].includes(v.type))continue;const d=hypot(actor,v);if(d<range&&d<nearest){nearest=d;best=v}}return best}
 closestEnemy(actor,team,range){let best=null,nearest=Infinity;
  for(const u of this.combatants()){if(u.team===team||u.hp<=0)continue;const d=hypot(actor,u);if(d<range&&d<nearest){nearest=d;best=u}}return best;
 }
 stepStructures(dt){
  for(const structure of [...this.structures]){
   if(structure.status==='building'){
    const builders=this.buildersOn(structure);structure.builders=builders.length;if(!builders.length)continue;
    const rate=this.buildRate(builders.length);for(const b of builders)b.hold=true;structure.progress=Math.min(structure.buildTime,structure.progress+dt*rate);structure.hp=Math.min(structure.maxHp,structure.hp+structure.maxHp*.7/structure.buildTime*dt*rate);
    if(structure.progress>=structure.buildTime){structure.status='active';structure.hp=structure.maxHp;structure.builders=0;for(const b of this.units.filter(u=>u.order==='construct'&&u.targetId===structure.id)){b.order='hold';b.targetId=null;b.dest=null;b.hold=true}this.stats[structure.team].built++;this.event((this.scenario==='territory'?CATALOG.name(structure.type,structure.team):STRUCTURES[structure.type].label).toUpperCase()+' READY',structure.team)}
    continue;
   }
   if(structure.upgradeProgress){structure.upgradeProgress+=dt;if(structure.upgradeProgress>=5){structure.upgradeProgress=0;structure.level=2;structure.maxHp=Math.ceil(structure.maxHp*1.35);structure.hp=structure.maxHp;this.event(STRUCTURES[structure.type].label.toUpperCase()+' UPGRADED',structure.team)}}
   const def=STRUCTURES[structure.type];if(structure.hackedUntil>this.time)continue;
   if(def.damage){structure.cd-=dt;if(!this.training&&!this.ceasefire()){const target=this.closestEnemy(structure,structure.team,def.range+(structure.level-1)*35);if(target&&structure.cd<=0){this.fire(structure,target,def.damage+(structure.level-1)*8,650,def.splash||4);structure.cd=def.fireRate}}}
   if(structure.type==='clinic'){const amount=STRUCTURES.clinic.heal*(structure.level===2?1.45:1)*dt;for(const unit of this.units.filter(unit=>unit.team===structure.team&&unit.hp<unit.maxHp&&Math.hypot(unit.x-structure.x,unit.y-structure.y)<155))unit.hp=Math.min(unit.maxHp,unit.hp+amount)}
  }
  for(const producer of [...this.structures.filter(s=>s.status==='active'),...this.bases.filter(b=>b.kind==='hq'&&b.hp>0)]){
   if(producer.hackedUntil>this.time)continue;
   if(!producer.production)this.startNextProduction(producer);
   if(!producer.production)continue;producer.production.progress+=dt;if(producer.production.progress<producer.production.duration)continue;
   const produced=producer.production.type,offset=producer.radius+36,dir=producer.team===0?1:-1;this.stats[producer.team].trained++;const unit=this.spawnAt(producer.team,produced,producer.x+dir*offset,producer.y+(producer.kind==='hq'?rnum(-50,50):0));if(unit){unit.angle=producer.team===0?0:Math.PI;this.clearSpawn(unit);this.sendToRally(producer,unit)}producer.production=null;this.startNextProduction(producer);
   this.event(this.scenario==='territory'?CATALOG.UNIT_NAMES[producer.team][produced].toUpperCase()+' READY':produced==='rifle'?'INFANTRY SQUAD READY':produced==='scanner'?'EAGLE-EYE SCANNER DEPLOYED':'PROTECTED PATROL VEHICLE DEPLOYED',producer.team);
  }
 }
 spawnMissionWave(intensity=0){
  if(!this.mission||this.training)return;const mission=this.mission,plan=WAVE_PLAN[this.difficulty]||WAVE_PLAN.recruit;mission.wave++;mission.waveClock=0;
  let count=Math.round((Math.min(plan.max,Math.round(plan.base+plan.grow*(mission.wave-1)))+intensity*2)*(this.theatre?.threat.waves||1));if(mission.guided&&mission.wave===1)count=2;
  const types=[];for(let index=0;index<count;index++)types.push(mission.wave>=3&&index%4===3?'tank':mission.wave>=2&&index%3===2?'rocket':'rifle');if(this.theatre?.threat.sweepers&&mission.wave>=3&&mission.wave%2===1)types.splice(1,0,'scanner');if(mission.wave>=2&&Math.random()<(this.theatre?.threat.ied||0)*.65)this.plantInfiltrators(mission.wave>=4?2:1);
  for(let index=0;index<types.length;index++){const lane=LANES[(index+mission.wave)%LANES.length],unit=this.spawnAt(1,types[index],2080+(index%3)*34,lane+((index*53)%90)-45);unit.order='attackmove';unit.hold=false;unit.dest=this.missionTarget(unit)}
  this.event('HOSTILE WAVE '+mission.wave+' APPROACHING THE TOWN',1);
 }
 // Each hostile role pressures a different part of the defense.
 missionTarget(unit){
  const alive=this.facilities.filter(value=>value.hp>0),near=list=>list.sort((a,b)=>hypot(unit,a)-hypot(unit,b))[0],hq=this.bases.find(value=>value.team===0&&value.kind==='hq');
  let target=null;if(unit.type==='rocket')target=near(this.structures.filter(value=>value.team===0&&value.hp>0&&hypot(unit,value)<900));
  else if(unit.type==='tank')target=alive.find(value=>value.kind==='civilianClinic')||near(alive);
  else if(['route','final'].includes(this.mission?.stage)&&(this.seq+unit.y)%3<1)target=this.nodes.find(node=>node.id==='node2');
  target=target||near(alive)||hq;return target?{x:target.x+rnum(-25,25),y:target.y+rnum(-25,25)}:{x:W/2,y:H/2};
 }
 stepMission(dt){
  if(!this.mission||this.phase!=='playing')return;const mission=this.mission,plan=WAVE_PLAN[this.difficulty]||WAVE_PLAN.recruit;
  if(mission.stage==='tutorial')return;
  if(mission.stage==='prepare'||mission.stage==='warning'){mission.stageTime+=dt;mission.prepareRemaining=Math.max(0,(mission.stage==='prepare'?mission.prepDuration:mission.warningDuration)-mission.stageTime);if(mission.prepareRemaining<=0)this.completeTraining(0);return}
  if(this.training)return;mission.stageTime+=dt;mission.waveClock+=dt;
  const gap=plan.gap*(mission.stage==='route'?1.15:mission.stage==='final'?.9:1);if(mission.waveClock>=gap)this.spawnMissionWave(mission.stage==='final'?2:mission.stage==='route'?1:0);mission.nextWaveIn=Math.max(0,gap-mission.waveClock);
  if(mission.stage==='protect'){if(mission.stageTime>=50){mission.stage='route';mission.stageTime=0;this.event('SECURE THE EASTERN EVACUATION ROUTE',0)}}
  else if(mission.stage==='route'){const route=this.nodes.find(node=>node.id==='node2');mission.routeHeld=route?.owner===0?mission.routeHeld+dt:0;if(mission.routeHeld>=8){mission.stage='final';mission.stageTime=0;this.spawnMissionWave(2);this.event('EVACUATION MOVING - SURVIVE THE FINAL ASSAULT',0)}}
  else if(mission.stage==='final'){const shelters=this.facilities.filter(value=>value.hp>0&&value.kind==='community').length;mission.evacuated=Math.min(mission.residents,mission.evacuated+dt*mission.residents/70*(.5+.25*shelters));if(mission.stageTime>=70&&this.facilities.filter(value=>value.hp>0).length>=mission.facilitiesRequired){mission.evacuated=Math.max(mission.evacuated,Math.round(mission.residents*this.facilities.filter(value=>value.hp>0).length/4));this.end(0,'CIVILIANS EVACUATED - SAFETY RESTORED')}}
 }
 aiAction(team){if(this.phase!=='playing')return;
  if(this.mission){for(const unit of this.units.filter(value=>value.team===team)){if(unit.order==='focus'&&unit.targetId||unit.order==='plant'||unit.order==='defuse')continue;if(unit.type==='scanner'){const charge=this.mines.filter(mine=>mine.team!==team&&mine.revealed[team]&&hypot(unit,mine)<520).sort((a,b)=>hypot(unit,a)-hypot(unit,b))[0];if(charge){this.defuseIed(team,[unit.id],charge.id);continue}}unit.order='attackmove';unit.dest=this.missionTarget(unit);unit.hold=false}return}
  const t=this.teams[team],supply=this.supply(team);
  const easy=this.mode==='solo'&&this.difficulty==='recruit';
  if(easy&&this.time<20)return;
  const maxAiSupply=easy?21:this.difficulty==='standard'?32:42;
  if(supply<maxAiSupply){const options=easy?['rifle','rifle','rifle','tank']:this.time>50?['tank','tank','rocket','rifle','rifle',...(this.units.some(u=>u.team===team&&u.type==='scanner')?[]:['scanner'])]:['rifle','rifle','tank','rocket'];
   const type=options[Math.floor(Math.random()*options.length)];if(t.credits>=UNITS[type].cost)this.spawn(team,type)}
  const owned=this.nodes.filter(n=>n.owner===team);const desired=this.nodes.filter(n=>n.owner!==team);
  if(!easy&&owned.length&&t.credits>=IED.cost+70&&this.activeCharges(team)<4&&Math.random()<.16){const node=owned[Math.floor(Math.random()*owned.length)],planter=this.units.filter(u=>u.team===team&&u.type==='rifle'&&u.order!=='plant').sort((a,b)=>hypot(a,node)-hypot(b,node))[0];if(planter&&hypot(planter,node)<420)this.plantIed(team,[planter.id],node.x+(team===1?-150:150)+rnum(-50,50),node.y+rnum(-90,90))}
  for(const scanner of this.units.filter(u=>u.team===team&&u.type==='scanner'&&u.order!=='defuse')){const charge=this.mines.find(mine=>mine.team!==team&&mine.revealed[team]&&hypot(scanner,mine)<560);if(charge)this.defuseIed(team,[scanner.id],charge.id)}
  for(const u of this.units.filter(u=>u.team===team)){
   if(u.order==='focus'&&u.targetId||u.order==='plant'||u.order==='defuse')continue;
   const dest=desired.length?desired.reduce((a,b)=>Math.abs(b.x-u.x)+Math.abs(b.y-u.y)<Math.abs(a.x-u.x)+Math.abs(a.y-u.y)?b:a):this.bases.find(b=>b.team!==team&&b.kind==='hq');
   if(!dest)continue;
   const nearDist=Math.hypot(u.x-dest.x,u.y-dest.y);
   if(nearDist>105||!u.dest||u.order==='hold'){
    u.order='attackmove';u.dest={x:dest.x+(team===0?-15:15)+rnum(-25,25),y:dest.y+rnum(-52,52)};u.hold=false;
   }
  }
  if(this.time>(easy?220:85)&&t.energy>=110&&t.powerCooldown<this.time&&Math.random()<(easy?0.04:0.17)){const center={x:W/2,y:H/2};const target=this.units.filter(u=>u.team!==team).sort((a,b)=>hypot(a,center)-hypot(b,center))[0];if(target)this.orbital(team,target.x,target.y)}
  if(!desired.length&&owned.length===this.nodes.length&&this.time>40){for(const u of this.units.filter(u=>u.team===team)){u.dest={x:team===0?2090:310,y:rnum(420,930)};u.order='attackmove'}}
 }
 end(winner,reason){if(this.phase!=='playing')return;this.phase='results';this.win={team:winner,reason};this.event(this.teamName(winner)+' WINS — '+reason,winner)}
 snapshot(viewTeam=null){return {difficulty:this.difficulty,mapId:this.mapId,missionId:this.missionId,scenario:this.scenario,territory:this.territorySnapshot(),theatreId:this.theatreId,mode:this.mode,mines:viewTeam===null?[]:this.visibleMines(viewTeam),mission:this.mission?{...this.mission,prepareRemaining:Math.ceil(this.mission.prepareRemaining||0),nextWaveIn:Math.ceil(this.mission.nextWaveIn||0),evacuated:Math.floor(this.mission.evacuated||0)}:null,stats:this.stats.map(value=>({...value})),world:{w:W,h:H,bounds:{...BOUNDS}},terrainSeed:this.terrainSeed,training:this.training,code:this.code,phase:this.phase,time:Math.round(this.time*10)/10,timeLeft:Math.max(0,Math.ceil(this.duration-this.time)),round:this.round,win:this.win,
  teams:this.teams.map((t,i)=>({...t,supply:this.supply(i),supplyCap:this.supplyCap(i),powerCooldown:Math.max(0,t.powerCooldown-this.time)})),
  units:this.units.map(u=>({id:u.id,team:u.team,type:u.type,x:Math.round(u.x),y:Math.round(u.y),hp:Math.ceil(u.hp),maxHp:u.maxHp,angle:Math.round(u.angle*100)/100,order:u.order,dest:u.dest&&u.order!=='plant'?{x:Math.round(u.dest.x),y:Math.round(u.dest.y)}:null,job:u.job&&(u.order==='plant'||u.order==='defuse')?Math.round(100*u.job.progress/(u.order==='plant'?IED.plantTime:IED.defuseTime)):null,hack:u.hack?{id:u.hack.id,p:Math.round(u.hack.progress*20)/100,blocked:Boolean(u.hack.blocked)}:undefined})),
  bases:this.bases.map(b=>({id:b.id,kind:b.kind,team:b.team,x:b.x,y:b.y,hp:Math.ceil(b.hp),maxHp:b.maxHp,radius:b.radius,production:b.production?{...b.production,progress:Math.round(b.production.progress*10)/10}:null,queue:b.queue?[...b.queue]:[],waiting:b.waiting||null,hacked:b.hackedUntil>this.time?Math.ceil(b.hackedUntil-this.time):0})),
  structures:this.structures.map(structure=>({...structure,hackedUntil:undefined,hacked:structure.hackedUntil>this.time?Math.ceil(structure.hackedUntil-this.time):0,queue:structure.queue?[...structure.queue]:[],hp:Math.ceil(structure.hp),progress:Math.round(structure.progress*10)/10,production:structure.production?{...structure.production,progress:Math.round(structure.production.progress*10)/10}:null})),facilities:this.facilities.map(facility=>({...facility,hp:Math.ceil(facility.hp)})),caches:this.caches.map(cache=>({...cache})),
  nodes:this.nodes.map(n=>({...n})),projectiles:this.projectiles.map(p=>({id:p.id,sourceId:p.sourceId,x:Math.round(p.x),y:Math.round(p.y),toX:p.toX,toY:p.toY,from:p.from,type:p.type})),
  blasts:this.blasts.map(b=>({id:b.id,kind:b.kind||null,x:b.x,y:b.y,age:b.age,delay:b.delay,radius:b.radius,team:b.team})),events:this.events.slice(-7),civilians:this.civilianSnapshot(),paused:Boolean(this.paused),intel:this.scenario==='territory'?this.intelSnapshot():null,variant:this.variant,participants:this.participants.map(p=>({id:p.id,name:p.name,team:p.team,bot:p.bot,connected:p.connected}))};
 }
}
Object.assign(Game.prototype,territoryMethods,civilianMethods,intelMethods,modeMethods,tacticMethods);
module.exports={Game};
