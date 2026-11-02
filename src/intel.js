'use strict';
// Intelligence and electronic warfare (Territory War). Cyber teams (defence) and hack cells (raiders)
// are trained at a Communications Centre / Radio Shack and break into enemy buildings:
//  - production buildings and HQs stop producing (and HQ guns go quiet) while offline;
//  - defences stop firing; collectors stop earning;
//  - a hacked comms centre jams that side: no pings, a scrambled minimap and no threat intel.
//    When the defence breaks into the raiders' radio shack it also intercepts their plans:
//    every raider charge is exposed and the next assault route is reported.
// A friendly hacker within firewall range of the target blocks the intrusion; damage to the hacker
// resets its progress.
const HACK={range:150,time:5,duration:20,cooldown:8,firewall:210};

const intel={
 online(s){return s.status!=='building'&&!(s.hackedUntil>this.time)},
 jammed(team){return this.teams[team]?.jammedUntil>this.time},
 hackTargets(u){return [...this.structures.filter(s=>s.team!==u.team&&s.hp>0&&s.status==='active'),...this.bases.filter(b=>b.team!==u.team&&b.hp>0)]},
 stepIntel(dt){
  if(this.scenario!=='territory')return;
  const live=!this.ceasefire();
  for(const u of this.units){
   if(u.type!=='hacker')continue;
   u.hackCd=Math.max(0,(u.hackCd||0)-dt);
   if(u.lastHp!==undefined&&u.hp<u.lastHp&&u.hack){u.hack=null;this.event('INTRUSION INTERRUPTED',u.team)}u.lastHp=u.hp;
   if(!live||u.hackCd>0||u.order==='move'&&u.dest&&Math.hypot(u.dest.x-u.x,u.dest.y-u.y)>40){u.hack=null;continue}
   let target=u.hack&&this.hackTargets(u).find(t=>t.id===u.hack.id);
   if(!target||Math.hypot(target.x-u.x,target.y-u.y)>HACK.range+target.radius){
    const ordered=u.targetId&&this.hackTargets(u).find(t=>t.id===u.targetId);
    const pool=ordered?[ordered]:this.hackTargets(u).filter(t=>!(t.hackedUntil>this.time));
    target=pool.filter(t=>Math.hypot(t.x-u.x,t.y-u.y)<=HACK.range+t.radius).sort((a,b)=>Math.hypot(a.x-u.x,a.y-u.y)-Math.hypot(b.x-u.x,b.y-u.y))[0];
    if(!target){u.hack=null;continue}
    u.hack={id:target.id,progress:0};
   }
   u.angle=Math.atan2(target.y-u.y,target.x-u.x);u.hold=true;
   const firewall=this.units.some(v=>v.type==='hacker'&&v.team===target.team&&Math.hypot(v.x-target.x,v.y-target.y)<HACK.firewall);
   if(firewall){if(!u.hack.blocked){u.hack.blocked=true;this.event('FIREWALL HOLDING - INTRUSION BLOCKED',target.team)}continue}
   u.hack.blocked=false;u.hack.progress+=dt;
   if(u.hack.progress>=HACK.time){this.applyHack(u,target);u.hack=null;u.hackCd=HACK.cooldown;u.targetId=null}
  }
 },
 applyHack(u,target){
  target.hackedUntil=this.time+HACK.duration;const enemy=target.team,label=target.kind==='hq'?CATALOG_NAME(this,'hq',enemy):CATALOG_NAME(this,target.type,enemy);
  this.stats[u.team].hacks=(this.stats[u.team].hacks||0)+1;
  this.event(label.toUpperCase()+' HACKED - OFFLINE FOR '+HACK.duration+'S',null);
  if(target.type==='comms'){
   this.teams[enemy].jammedUntil=this.time+HACK.duration;this.event('COMMUNICATIONS JAMMED',enemy);
   if(u.team===0){for(const mine of this.mines)if(mine.team===1)mine.revealed[0]=true;
    const ai=this.ais?.get(1),route=ai?.opening||(['north','central','south'][Math.floor(this.time)%3]);
    if(this.territory){this.territory.threat={...(this.territory.threat||{}),team:1,route,confidence:'confirmed',intercepted:true,targets:ai?this.likelyTargets(ai,route):[],path:ai?this.threatPath(ai,route):null,at:this.time}}
    this.event('INTERCEPT: RAIDER CHARGES EXPOSED - NEXT ASSAULT ON THE '+route.toUpperCase()+' ROUTE',0)}
   else this.event('RAIDERS ARE LISTENING - DEFENCE COMMS COMPROMISED',1);
  }
 },
 intelSnapshot(team){return {jammed:[0,1].map(t=>this.jammed(t)?Math.ceil(this.teams[t].jammedUntil-this.time):0)}}
};
function CATALOG_NAME(game,type,team){return require('./config').CATALOG.name(type,team)}
module.exports={intel,HACK};
