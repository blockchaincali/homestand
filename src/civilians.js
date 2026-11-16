'use strict';
// Civilians of the contested town (Territory War). Server-authoritative and mixed into Game.
//
// States: free → (panic) fleeing → sheltered | captive (escorted by a raider) → held (raider camp)
//         held/captive → rescued (escorted by a defender) → safe. Any state on the field can be
//         killed by stray fire (splash from shells, rockets, orbital strikes and IEDs).
const MAPS=require('../public/maps');
const L=()=>MAPS.layouts.frontier;

const CIV={count:24,hp:40,walk:22,run:48,captureRange:26,captureTime:2.2,guardRange:90,rescueTime:2.2,panicRange:150,calm:14,
 carriers:{rifle:1,patrol:3},deliveryReward:150,rescueReward:120,heldIncome:1,casualtyPenalty:60,shelterCapacity:6};
const NAMES=['Aisha','Musa','Ngozi','Emeka','Fatima','Ibrahim','Zainab','Tunde','Hauwa','Chinedu','Amina','Sani','Kemi','Yusuf','Blessing','Bala','Halima','Obi','Rakiya','Danjuma','Grace','Usman','Hadiza','Segun'];
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

const civilians={
 resetCivilians(){
  const layout=L(),homes=[...layout.compounds.filter(c=>c.x>650&&c.x<1700),...layout.facilities.filter(f=>!f.outpost),layout.market];
  this.civilians=[];this.civStats={saved:0,captured:0,rescued:0,casualties:[0,0],held:0};
  for(let i=0;i<CIV.count;i++){const home=homes[i%homes.length],x=home.x+((i*37)%60)-30,y=home.y+((i*53)%50)-25;
   this.civilians.push({id:'c'+i,name:NAMES[i%NAMES.length],x,y,hp:CIV.hp,state:'free',home:{x:home.x,y:home.y},dest:null,wait:(i%5)*.7,progress:0,by:null,calm:0,shelter:null})}
 },
 // Refuges: defence civilian shelters first, then intact community facilities.
 civRefuges(){
  const shelters=this.structures.filter(s=>s.team===0&&s.type==='shelter'&&s.status==='active'&&s.hp>0).map(s=>({id:s.id,x:s.x,y:s.y,cap:CIV.shelterCapacity}));
  const facilities=this.facilities.filter(f=>f.hp>0&&!f.outpost).map(f=>({id:f.id,x:f.x,y:f.y,cap:4}));
  return [...shelters,...facilities];
 },
 // The raider holding pen sits deep in raider territory but outside the camp HQ's gun range, so a
 // rescue is a fight against the guards rather than a suicide run under the HQ.
 campOf(team){const hq=this.bases[team];return team===1?{x:hq.x-30,y:hq.y+300}:{x:hq.x+70,y:hq.y+110}},
 carrierLoad(unit){return this.civilians.filter(c=>c.by===unit.id&&(c.state==='captive'||c.state==='rescued')).length},
 stepCivilians(dt){
  if(!this.civilians)return;
  const live=this.territory?.stage==='live',raiders=this.units.filter(u=>u.team===1),defenders=this.units.filter(u=>u.team===0);
  const refuges=live?this.civRefuges():[],occupancy=new Map();
  for(const c of this.civilians)if(c.state==='sheltered')occupancy.set(c.shelter,(occupancy.get(c.shelter)||0)+1);
  for(const c of this.civilians){
   if(c.state==='dead'||c.state==='safe')continue;
   if(c.state==='sheltered'){
    const refuge=refuges.find(r=>r.id===c.shelter);
    if(!refuge){c.state='fleeing';c.shelter=null;c.calm=0;continue}
    const threat=raiders.some(u=>dist(u,c)<CIV.panicRange*1.4);c.calm=threat?0:c.calm+dt;
    if(c.calm>CIV.calm){c.state='free';occupancy.set(c.shelter,occupancy.get(c.shelter)-1);c.shelter=null;c.dest=null}
    continue;
   }
   if(c.state==='captive'||c.state==='rescued'){
    const carrier=this.units.find(u=>u.id===c.by);
    if(!carrier){const was=c.state;c.state='fleeing';c.by=null;c.progress=0;c.calm=0;this.event((was==='captive'?'ESCORT DOWN - '+c.name.toUpperCase()+' BROKE FREE':c.name.toUpperCase()+' LOST THE ESCORT - FLEEING'),null);continue}
    this.civFollow(c,carrier,dt);
    if(c.state==='captive'&&MAPS.territoryOf('frontier',c)===1&&dist(c,this.campOf(1))<140){c.state='held';c.by=null;c.dest=this.campOf(1);this.civStats.captured++;this.teams[1].credits+=CIV.deliveryReward;this.event(c.name.toUpperCase()+' TAKEN TO THE RAIDER CAMP',null);this.civReturnCarrier(carrier)}
    else if(c.state==='rescued'&&(MAPS.territoryOf('frontier',c)===0||refuges.some(r=>dist(r,c)<70))){c.state='safe';c.by=null;this.civStats.rescued++;this.civStats.saved++;this.teams[0].credits+=CIV.rescueReward;this.event(c.name.toUpperCase()+' RESCUED AND SAFE',null);this.civReturnCarrier(carrier)}
    continue;
   }
   if(c.state==='held'){
    // Defenders standing beside a captive free them after a short struggle.
    const rescuer=defenders.find(u=>CIV.carriers[u.type]&&dist(u,c)<CIV.captureRange+u.radius&&this.carrierLoad(u)<CIV.carriers[u.type]);
    c.progress=rescuer?c.progress+dt:Math.max(0,c.progress-dt);
    if(rescuer&&c.progress>=CIV.rescueTime)this.civTake(c,rescuer,'rescued');
    else this.civWalk(c,this.campOf(1),CIV.walk*.4,dt,14);
    continue;
   }
   // free / fleeing
   if(live){
    // Civilians standing near defence troops are protected from being seized.
    const guarded=defenders.some(u=>u.type!=='hacker'&&dist(u,c)<CIV.guardRange);
    const captor=!guarded&&raiders.find(u=>CIV.carriers[u.type]&&dist(u,c)<CIV.captureRange+u.radius&&this.carrierLoad(u)<CIV.carriers[u.type]);
    if(captor){c.progress+=dt;c.state='fleeing';if(c.progress>=CIV.captureTime)this.civTake(c,captor,'captive');continue}else c.progress=Math.max(0,c.progress-dt*.5);
    const danger=raiders.some(u=>dist(u,c)<CIV.panicRange)||this.blasts.some(b=>b.hit&&b.radius>30&&dist(b,c)<CIV.panicRange);
    if(danger&&c.state==='free'){c.state='fleeing';c.dest=null}
    if(c.state==='fleeing'){
     const open=refuges.filter(r=>(occupancy.get(r.id)||0)<r.cap).sort((a,b)=>dist(a,c)-dist(b,c))[0];
     if(open){if(dist(open,c)<34){c.state='sheltered';c.shelter=open.id;c.calm=0;occupancy.set(open.id,(occupancy.get(open.id)||0)+1);continue}this.civWalk(c,open,CIV.run,dt)}
     else{c.calm=danger?0:c.calm+dt;if(c.calm>CIV.calm)c.state='free';this.civWalk(c,this.campOf(0),CIV.run,dt)}
     continue;
    }
   }
   c.wait-=dt;
   if(!c.dest||c.wait>0&&dist(c,c.dest)<8){if(c.wait<=0){c.dest={x:c.home.x+Math.sin(this.time*1.3+c.x)*70,y:c.home.y+Math.cos(this.time*.9+c.y)*55};c.wait=3+((c.x*7+c.y)%5)}continue}
   this.civWalk(c,c.dest,CIV.walk,dt,6);
  }
  if(this.civClock===undefined)this.civClock=0;this.civClock+=dt;
  if(this.civClock>=1){const s=Math.floor(this.civClock);this.civClock-=s;const held=this.civilians.filter(c=>c.state==='held').length;this.civStats.held=held;
   if(held&&live){this.teams[1].credits+=held*CIV.heldIncome*s;this.teams[0].credits=Math.max(0,this.teams[0].credits-held*CIV.heldIncome*s)}}
 },
 civWalk(c,goal,speed,dt,stop=4){const dx=goal.x-c.x,dy=goal.y-c.y,d=Math.hypot(dx,dy);if(d<stop)return;const step=Math.min(speed*dt,d);c.x+=dx/d*step;c.y+=dy/d*step},
 civFollow(c,carrier,dt){const slot=this.civilians.filter(o=>o.by===carrier.id).indexOf(c),angle=(carrier.angle||0)+Math.PI+(slot-1)*.6,goal={x:carrier.x+Math.cos(angle)*26,y:carrier.y+Math.sin(angle)*26};this.civWalk(c,goal,Math.max(CIV.run,80),dt,3)},
 civTake(c,unit,state){
  c.state=state;c.by=unit.id;c.progress=0;c.dest=null;
  if(state==='captive')this.event('RAIDERS SEIZED '+c.name.toUpperCase()+' - INTERCEPT THE ESCORT',null);
  else this.event(c.name.toUpperCase()+' FREED - ESCORT TO SAFETY',null);
  // Escorts head home automatically; the commander can still redirect them.
  const home=state==='captive'?this.campOf(1):this.campOf(0);
  if(this.carrierLoad(unit)>=CIV.carriers[unit.type]||this.participants.find(p=>p.team===unit.team)?.bot){unit.order='move';unit.dest={...home};unit.path=null;unit.hold=false;unit.targetId=null;unit.escort=true}
 },
 civReturnCarrier(unit){if(unit.escort){unit.escort=false;unit.order='hold';unit.dest=null;unit.hold=true}},
 // Stray fire: splash weapons hurt any civilian caught in the radius, whichever side fired.
 strayFire(x,y,radius,damage,team){
  if(!this.civilians||!radius||this.ceasefire())return;
  for(const c of this.civilians){
   if(['dead','safe','sheltered'].includes(c.state))continue;
   const d=Math.hypot(c.x-x,c.y-y);if(d>radius+6)continue;
   c.hp-=damage*(1-.5*Math.min(1,d/radius));
   if(c.state==='free')c.state='fleeing';
   if(c.hp>0)continue;
   c.state='dead';c.by=null;
   if(team===0||team===1){this.civStats.casualties[team]++;if(team===0)this.teams[0].credits=Math.max(0,this.teams[0].credits-CIV.casualtyPenalty)}
   this.event('CIVILIAN CASUALTY - '+c.name.toUpperCase()+(team===0?' (DEFENCE FIRE)':team===1?' (RAIDER FIRE)':''),null);
  }
 },
 civilianSnapshot(){
  if(!this.civilians)return null;
  return {list:this.civilians.filter(c=>c.state!=='safe'&&c.state!=='sheltered').map(c=>({id:c.id,x:Math.round(c.x),y:Math.round(c.y),s:c.state,p:c.progress>0?Math.round(c.progress*10)/10:0})),
   counts:this.civilianCounts(),stats:this.civStats};
 },
 civilianCounts(){const n={free:0,sheltered:0,captive:0,held:0,rescued:0,safe:0,dead:0};for(const c of this.civilians||[]){const k=c.state==='fleeing'?'free':c.state;n[k]=(n[k]||0)+1}return n}
};
module.exports={civilians,CIV};
