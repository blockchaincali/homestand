'use strict';
// A faction commander that plays either side of Territory War with the same rules as a human:
// it trains engineers at its HQ, builds on its own plots, produces from its own facilities,
// captures checkpoints and only attacks once the ceasefire ends. Difficulty changes decisions,
// not stats: build parallelism, economy discipline, timing, routes and coordination.
const {UNITS,STRUCTURES,CATALOG}=require('./config');
const MAPS=require('../public/maps');

const PROFILES={
 recruit:{hackers:0,snatch:1,rescue:0,period:3.6,engineers:2,parallel:1,assist:false,repair:false,reserve:40,attackSupply:6,firstAttack:110,attackEvery:130,maxSupply:22,captureSquads:1,mix:['rifle','rifle','rifle','patrol'],ied:0,split:false,announce:true,orderLength:7},
 standard:{hackers:1,snatch:2,rescue:2,period:2.2,engineers:3,parallel:2,assist:false,repair:true,reserve:110,attackSupply:12,firstAttack:45,attackEvery:85,maxSupply:40,captureSquads:2,mix:['rifle','rifle','patrol','tank','rocket'],ied:.08,split:false,announce:true,orderLength:11},
 veteran:{hackers:2,snatch:3,rescue:3,period:1.2,engineers:4,parallel:3,assist:true,repair:true,reserve:150,attackSupply:18,firstAttack:12,attackEvery:60,maxSupply:56,captureSquads:3,mix:['rifle','patrol','tank','tank','rocket','rocket'],ied:.2,split:true,announce:false,orderLength:99}
};
const BUILD_ORDER={
 0:['barracks','collector','depot','watchtower','workshop','comms','guardpost','bunker','factory','depot','emplacement','clinic','watchtower','bunker','emplacement','depot'],
 1:['barracks','collector','depot','guardpost','workshop','comms','watchtower','factory','depot','bunker','emplacement','guardpost','emplacement','clinic','depot']
};
const ROUTES=['north','central','south'];
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

class FactionAI{
 constructor(game,team,level='standard'){this.game=game;this.team=team;this.level=PROFILES[level]?level:'standard';this.p=game.variantProfile?game.variantProfile(PROFILES[this.level]):PROFILES[this.level];this.clock=0;this.lastAttack=-1e9;this.opening=null;this.attackers=new Set();this.attackCount=0}
 get layout(){return MAPS.layouts.frontier}
 get hq(){return this.game.bases.find(b=>b.team===this.team&&b.kind==='hq'&&b.hp>0)}
 get enemyHq(){return this.game.bases.find(b=>b.team!==this.team&&b.kind==='hq'&&b.hp>0)}
 own(type){return this.game.units.filter(u=>u.team===this.team&&(!type||u.type===type))}
 structures(){return this.game.structures.filter(s=>s.team===this.team&&s.hp>0)}
 credits(){return this.game.teams[this.team].credits}
 // Chooses the opening route when the warning starts. Veteran reads the defence and picks the
 // least-defended approach; easier levels are predictable.
 planOpening(){
  if(this.opening)return this.opening;
  if(this.level==='recruit')this.opening='central';
  else if(this.level==='standard')this.opening=ROUTES[Math.floor(Math.random()*ROUTES.length)];
  else{const enemy=[...this.game.structures,...this.game.units].filter(e=>e.team!==this.team&&e.hp>0);this.opening=ROUTES.map(r=>({r,w:this.layout.routes[r].reduce((sum,p)=>sum+enemy.filter(e=>dist(e,p)<320).length,0)})).sort((a,b)=>a.w-b.w)[0].r}
  return this.opening;
 }
 tick(dt){
  this.clock+=dt;if(this.clock<this.p.period)return;this.clock=0;
  const g=this.game;if(g.phase!=='playing'||!this.hq)return;
  this.economy();this.construction();this.production();this.military();
 }
 economy(){
  const engineers=this.own('engineer').length,hq=this.hq,queued=hq.production?.type==='engineer';
  if(engineers<this.p.engineers&&!queued&&this.credits()>=UNITS.engineer.cost+this.p.reserve*.5)this.game.produce(this.team,hq.id,'engineer');
 }
 nextBuild(){
  const counts={},have={};for(const s of this.structures())have[s.type]=(have[s.type]||0)+1;
  const order=BUILD_ORDER[this.team].slice(0,this.p.orderLength);
  for(const type of order){counts[type]=(counts[type]||0)+1;if((have[type]||0)>=counts[type])continue;
   if(!CATALOG.allowed(type,this.team))continue;
   const missing=CATALOG.missing(type,this.game.builtTypes(this.team));if(missing.length)continue;
   return type}
  return null;
 }
 siteFor(type){
  const g=this.game,def=STRUCTURES[type],state={nodes:g.nodes,structures:g.structures},hq=this.hq;
  if(def.size==='large'){
   const usable=this.layout.plots.filter(p=>MAPS.plotStatus('frontier',p,this.team,state).ok),preferred=usable.filter(p=>type==='collector'?p.kind==='resource':p.kind!=='resource'),plots=(preferred.length?preferred:usable).sort((a,b)=>(a.team===this.team?0:1)-(b.team===this.team?0:1)||dist(a,hq)-dist(b,hq));
   return plots[0]?{x:plots[0].x,y:plots[0].y,plotId:plots[0].id}:null;
  }
  for(const spot of this.layout.defenceSpots[this.team]){if(g.structures.some(s=>s.hp>0&&dist(s,spot)<70))continue;if(g.territorySite(this.team,type,spot.x,spot.y).ok)return {x:spot.x,y:spot.y}}
  return null;
 }
 construction(){
  const g=this.game,idle=this.own('engineer').filter(e=>e.order!=='construct'&&e.order!=='repair');if(!idle.length)return;
  const building=this.structures().filter(s=>s.status==='building');
  for(const engineer of idle){
   if(this.p.repair){const damaged=this.structures().find(s=>s.status==='active'&&s.hp<s.maxHp*.6);if(damaged&&this.credits()>40){g.repairStructure(this.team,damaged.id,[engineer.id]);continue}}
   const unfinished=building.filter(s=>!g.buildersOn(s).length&&!this.own('engineer').some(e=>e.targetId===s.id&&e.order==='construct'));
   if(unfinished.length){g.assistStructure(this.team,unfinished[0].id,[engineer.id]);continue}
   if(building.length<this.p.parallel){const type=this.nextBuild();if(type&&this.credits()>=STRUCTURES[type].cost){const site=this.siteFor(type);if(site){const result=g.constructionSite(this.team,type,site.x,site.y,[engineer.id],site.plotId);if(result.ok){building.push(result.structure);continue}}}}
   if(this.p.assist&&building.length){g.assistStructure(this.team,building[0].id,[engineer.id]);continue}
  }
 }
 production(){
  const g=this.game,cap=Math.min(this.p.maxSupply,g.supplyCap(this.team)),pending=this.structures().some(s=>s.status==='building')||Boolean(this.nextBuild());
  for(const producer of this.structures().filter(s=>s.status==='active'&&STRUCTURES[s.type].produces&&!s.production)){
   const options=STRUCTURES[producer.type].produces.filter(type=>(type!=='scanner'||!this.own('scanner').length&&this.level!=='recruit')&&(type!=='hacker'||this.own('hacker').length+(producer.queue?.length||0)<this.p.hackers));
   const preferred=this.p.mix.filter(type=>options.includes(type)),type=(preferred.length?preferred:options)[Math.floor(Math.random()*(preferred.length||options.length))];
   if(!type)continue;const reserve=pending?this.p.reserve:0;
   if(g.supply(this.team)+UNITS[type].supply>cap||this.credits()<UNITS[type].cost+reserve)continue;
   g.produce(this.team,producer.id,type);
  }
 }
 army(){return this.own().filter(u=>u.type!=='engineer'&&u.type!=='scanner')}
 send(units,points,order='attackmove'){
  for(const u of units){const path=points.map(p=>({x:p.x+(Math.random()-.5)*50,y:p.y+(Math.random()-.5)*50}));u.order=order;u.hold=false;u.targetId=null;u.job=null;u.dest=path.shift();u.path=path}
 }
 routePath(route){const pts=[...this.layout.routes[route]];return this.team===0?pts:pts.reverse()}
 pickTarget(route){
  const g=this.game,end=this.routePath(route).at(-1);
  if(this.team===1){
   const facilities=g.facilities.filter(f=>f.hp>0).sort((a,b)=>dist(a,end)-dist(b,end));if(facilities.length)return facilities[0];
  }else{
   const checkpoint=g.nodes.find(n=>n.route===route&&n.owner!==this.team);if(checkpoint&&this.attackCount%2===0)return checkpoint;
  }
  const structures=g.structures.filter(s=>s.team!==this.team&&s.hp>0).sort((a,b)=>dist(a,end)-dist(b,end));
  return structures[0]||this.enemyHq;
 }
 military(){
  const g=this.game,t=g.territory,army=this.army(),rally=this.layout.rally[this.team];
  // Scanners stay with the army and clear any charges they detect.
  for(const scanner of this.own('scanner')){if(scanner.order==='defuse')continue;const charge=g.mines.find(m=>m.team!==this.team&&m.revealed[this.team]&&dist(scanner,m)<560);if(charge){g.defuseIed(this.team,[scanner.id],charge.id);continue}const lead=army.find(u=>this.attackers.has(u.id))||army[0];if(lead&&dist(scanner,lead)>120){scanner.order='move';scanner.dest={x:lead.x-60,y:lead.y};scanner.hold=false}}
  // Checkpoint squads: capture neutral or enemy checkpoints (allowed during the ceasefire).
  const squads=army.filter(u=>u.type==='rifle'&&!this.attackers.has(u.id)&&!u.civTask&&!u.escort).slice(0,this.p.captureSquads),targets=g.nodes.filter(n=>n.owner!==this.team).sort((a,b)=>dist(a,rally)-dist(b,rally));
  squads.forEach((u,i)=>{const node=targets[i%Math.max(1,targets.length)];if(node&&(!u.dest||dist(u.dest,node)>60)&&!g.ceasefireBlocks(this.team,node.x,node.y)){u.order='move';u.hold=false;u.dest={x:node.x+(i-1)*24,y:node.y};u.path=null;u.captureSquad=true}});
  // Snatch and rescue teams follow the same difficulty pacing as the first assault.
  if(t.stage==='live'&&t.liveTime>=this.p.firstAttack*.6)this.civilianOps(army);
  const home=army.filter(u=>!this.attackers.has(u.id)&&!u.captureSquad&&!u.civTask&&!u.escort);
  if(t.stage!=='live'){for(const u of home)if(!u.dest||dist(u.dest,rally)>160){u.order='move';u.hold=false;u.dest={x:rally.x+(Math.random()-.5)*120,y:rally.y+(Math.random()-.5)*160};u.path=null}return}
  // Defend home territory first.
  // The defence also treats the town and its outposts as home ground.
  const guarded=this.team===0?g.facilities.filter(f=>f.hp>0):[];
  const intruders=g.units.filter(u=>u.team!==this.team&&(MAPS.territoryOf('frontier',u)===this.team||guarded.some(f=>dist(f,u)<300)));
  if(intruders.length){const c={x:intruders.reduce((s,u)=>s+u.x,0)/intruders.length,y:intruders.reduce((s,u)=>s+u.y,0)/intruders.length};this.send(home.filter(u=>dist(u,c)<900),[c])}
  // Re-target attackers that reached their objective.
  for(const u of army.filter(u=>this.attackers.has(u.id)&&(!u.dest||dist(u,u.dest)<40)&&!u.path?.length)){const target=this.pickTarget(this.opening||'central');if(target)this.send([u],[target])}
  for(const id of [...this.attackers])if(!g.units.some(u=>u.id===id))this.attackers.delete(id);
  // Launch an assault when the army is ready.
  const supply=home.reduce((s,u)=>s+UNITS[u.type].supply,0),due=t.liveTime>=this.p.firstAttack&&g.time-this.lastAttack>=this.p.attackEvery;
  if(due&&supply>=this.p.attackSupply){
   const route=this.attackCount===0&&this.opening?this.opening:this.level==='recruit'?'central':this.level==='veteran'?this.planWeakest():ROUTES[Math.floor(Math.random()*ROUTES.length)];
   const groups=this.p.split&&home.length>=6?[home.slice(0,Math.ceil(home.length/2)),home.slice(Math.ceil(home.length/2))]:[home];
   groups.forEach((group,i)=>{const r=i===0?route:ROUTES.filter(x=>x!==route)[Math.floor(Math.random()*2)],target=this.pickTarget(r);this.send(group,[...this.routePath(r),target]);for(const u of group)this.attackers.add(u.id);if(this.p.announce){g.event((this.team===1?'RAIDERS':'DEFENCE FORCES')+' ADVANCING ON THE '+r.toUpperCase()+' ROUTE',1-this.team);g.reportThreat(this.team,r,'confirmed',[target])}});
   this.lastAttack=g.time;this.attackCount++;this.opening=null;
   if(this.p.ied&&Math.random()<this.p.ied*3){const planter=home.find(u=>u.type==='rifle');const spot=this.routePath(route)[0];if(planter&&spot)g.plantIed(this.team,[planter.id],spot.x+(this.team===1?-120:120),spot.y+(Math.random()-.5)*60)}
  }
 }
 // Raiders send snatch teams into the town; the defence sends rescue teams after captives.
 civilianOps(army){
  const g=this.game;if(!g.civilians)return;
  const raider=this.team===1,want=raider?this.p.snatch:this.p.rescue;
  for(const u of army)if(u.civTask&&!g.civilians.some(c=>c.id===u.civTask&&(raider?['free','fleeing']:['captive','held']).includes(c.state)))u.civTask=null;
  const targets=g.civilians.filter(c=>raider?['free','fleeing'].includes(c.state):['captive','held'].includes(c.state));
  if(!targets.length||!want)return;
  const busy=army.filter(u=>u.civTask),free=army.filter(u=>!u.civTask&&!u.escort&&!this.attackers.has(u.id)&&['rifle','patrol'].includes(u.type));
  for(const u of free.slice(0,Math.max(0,want-busy.length))){
   const taken=new Set(army.map(v=>v.civTask)),c=targets.filter(c=>!taken.has(c.id)).sort((a,b)=>dist(a,u)-dist(b,u))[0]||targets[0];
   u.civTask=c.id;
  }
  for(const u of army.filter(u=>u.civTask&&!u.escort)){const c=g.civilians.find(c=>c.id===u.civTask);if(!c)continue;
   const carrier=c.by&&g.units.find(v=>v.id===c.by);
   if(carrier&&carrier.team!==this.team){u.order='attackmove';u.targetId=carrier.id;u.dest={x:carrier.x,y:carrier.y}}else{u.order='move';u.dest={x:c.x,y:c.y};u.targetId=null}
   u.hold=false;u.path=null}
 }
 planWeakest(){this.opening=null;return this.planOpening()}
}
module.exports={FactionAI,PROFILES};
