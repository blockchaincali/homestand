'use strict';
// Territory War variants. Same map, factions, economy and rules; different objectives.
//  - war:      destroy the enemy HQ (the default; nobody loses until their HQ falls).
//  - rescue:   Rescue Ops. Eight residents are already held at the raider camp. Bring six home to
//              win; lose if the HQ falls or too many hostages die for six to be saved.
//  - survival: Civilian Survival. Hold out for 12 minutes against an aggressive raider force
//              hunting civilians. Win with at least 12 of 24 residents free at the end; lose if
//              the HQ falls or the dead make that impossible.
// Both special modes are always Community Defence (humans) against Raider AI.
const MODES={
 // The defence holds the line for 20 live minutes; the raiders must take the community HQ before then.
 war:{id:'war',name:'Territory War',liveSeconds:20*60},
 rescue:{id:'rescue',name:'Rescue Ops',hostages:8,target:6,prepMinutes:3},
 survival:{id:'survival',name:'Civilian Survival',liveSeconds:12*60,minSafe:12,prepMinutes:3}
};
const modes={
 setupVariant(){
  const v=this.variant;if(v==='war'||!this.civilians)return;
  const t=this.territory;t.objective={mode:v};
  if(v==='rescue'){const camp=this.campOf(1);let n=0;
   for(const c of this.civilians){if(n>=MODES.rescue.hostages)break;c.state='held';c.x=camp.x+((n%4)-1.5)*16;c.y=camp.y+(Math.floor(n/4)-.5)*18;c.dest={...camp};n++}
   t.objective={mode:v,target:MODES.rescue.target,hostages:MODES.rescue.hostages};
   this.event('RESCUE OPS - '+MODES.rescue.hostages+' RESIDENTS ARE HELD AT THE RAIDER CAMP. BRING '+MODES.rescue.target+' HOME',null)}
  if(v==='survival'){t.objective={mode:v,duration:MODES.survival.liveSeconds,minSafe:MODES.survival.minSafe};
   this.event('CIVILIAN SURVIVAL - KEEP '+MODES.survival.minSafe+' RESIDENTS FREE FOR '+MODES.survival.liveSeconds/60+' MINUTES',null)}
 },
 // AI raiders lean into the objective: guard hostages, or hunt civilians relentlessly.
 variantProfile(p){if(this.variant==='survival')return {...p,snatch:p.snatch+2,attackEvery:Math.round(p.attackEvery*.75),firstAttack:Math.min(p.firstAttack,40)};if(this.variant==='rescue')return {...p,snatch:Math.max(1,p.snatch-1)};return p},
 civilianTally(){const n=this.civilianCounts();return {free:n.free+n.sheltered+n.safe,dead:n.dead,taken:n.held+n.captive+n.rescued,total:(this.civilians||[]).length}},
 stepVariant(){
  const v=this.variant,t=this.territory;if(this.phase!=='playing'||!t||t.stage!=='live')return;
  if(v==='war'){const left=Math.max(0,MODES.war.liveSeconds-t.liveTime);t.objective={mode:'war',remaining:Math.ceil(left),duration:MODES.war.liveSeconds};if(left<=0)this.end(0,'THE COMMUNITY HELD THE LINE - THE RAIDERS RAN OUT OF TIME');return}
  const tally=this.civilianTally();
  if(v==='rescue'){const target=MODES.rescue.target,rescued=this.civStats.rescued,stillHeld=this.civilians.filter(c=>['held','captive','rescued'].includes(c.state)).length;
   t.objective={...t.objective,rescued,stillHeld};
   if(rescued>=target)return this.end(0,'HOSTAGES RESCUED - '+rescued+' RESIDENTS ARE HOME');
   if(rescued+stillHeld<target)return this.end(1,'TOO MANY HOSTAGES LOST');}
  if(v==='survival'){const rule=MODES.survival,left=Math.max(0,rule.liveSeconds-t.liveTime);t.objective={...t.objective,remaining:Math.ceil(left),free:tally.free};
   if(tally.total-tally.dead<rule.minSafe)return this.end(1,'TOO MANY CIVILIANS KILLED');
   if(left<=0)return tally.free>=rule.minSafe?this.end(0,'THE COMMUNITY SURVIVED - '+tally.free+' RESIDENTS FREE'):this.end(1,'TOO MANY RESIDENTS TAKEN - ONLY '+tally.free+' FREE');}
 }
};
module.exports={modes,MODES};
