'use strict';
// Unit tactics shared by every side in Territory War:
//  - Guard stance: idle combat units scan ~300 px for enemy units, move in to engage, then return to
//    their post once the threat is gone or they are dragged too far (leash). The Hold command pins a
//    unit in place instead.
//  - Rally points: production buildings send new units to a point the commander chose.
//  - Navigation: a coarse grid of buildings, homes and barricades with A* paths and stuck recovery,
//    so units route around bases instead of grinding against walls.
//  - Barricades are walls (horizontal or vertical) that block movement, not round posts.
const MAPS=require('../public/maps');
const GUARD={scan:300,leash:560};
const NAV={cell:25,clearance:14,maxPerTick:6,stuckTime:1.2,stuckDistance:7};
const WALL={half:58,thick:13};

const tactics={
 // ---------- Barricade walls ----------
 wallSegment(s){const half=WALL.half*(s.level>1?1.15:1),vertical=s.rot===1;return vertical?[{x:s.x,y:s.y-half},{x:s.x,y:s.y+half}]:[{x:s.x-half,y:s.y},{x:s.x+half,y:s.y}]},
 // Push vector (dx,dy) away from a wall when within limit of its centreline, else null.
 wallPush(u,s,limit){const [a,b]=this.wallSegment(s),dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=Math.max(0,Math.min(1,((u.x-a.x)*dx+(u.y-a.y)*dy)/l)),px=a.x+dx*t,py=a.y+dy*t,ox=u.x-px,oy=u.y-py,d=Math.hypot(ox,oy);if(d>=limit)return null;if(d<.01)return {x:-dy/Math.sqrt(l),y:dx/Math.sqrt(l),near:d};return {x:ox/d,y:oy/d,near:d}},

 // ---------- Guard stance ----------
 guardStep(u,d,ceasefire){
  if(ceasefire||!d.damage||['engineer','hacker'].includes(u.type)||u.escort||u.civTask||['plant','defuse','construct','repair','focus'].includes(u.order))return;
  if(u.order==='engage'){
   const target=this.units.find(v=>v.id===u.targetId&&v.hp>0);
   const post=u.post||{x:u.x,y:u.y};
   if(!target||Math.hypot(u.x-post.x,u.y-post.y)>GUARD.leash||Math.hypot(target.x-post.x,target.y-post.y)>GUARD.leash+GUARD.scan){u.order='move';u.dest={x:post.x,y:post.y};u.path=null;u.targetId=null;u.hold=false;u.returning=true;return}
   u.dest={x:target.x,y:target.y};u.hold=false;return;
  }
  const idle=(u.order==='hold'||u.order==='stop')&&u.stance!=='hold'||u.order==='attackmove'&&(!u.dest||Math.hypot(u.dest.x-u.x,u.dest.y-u.y)<30&&!u.path?.length);
  if(!idle)return;
  let enemy=null,best=GUARD.scan;for(const v of this.units){if(v.team===u.team||v.hp<=0)continue;const dist=Math.hypot(v.x-u.x,v.y-u.y);if(dist<best){best=dist;enemy=v}}
  if(!enemy||best<=d.range||this.ceasefireBlocks?.(u.team,enemy.x,enemy.y))return;
  u.post={x:u.x,y:u.y};u.order='engage';u.targetId=enemy.id;u.hold=false;u.dest={x:enemy.x,y:enemy.y};u.path=null;
 },

 // ---------- Rally points ----------
 setRally(team,structureId,x,y){
  const producer=[...this.structures,...this.bases].find(s=>s.id===structureId&&s.team===team&&s.hp>0);
  if(!producer)return {ok:false,reason:'Select one of your buildings'};
  const px=Number(x),py=Number(y);if(!Number.isFinite(px)||!Number.isFinite(py))return {ok:false,reason:'Tap the map to set a rally point'};
  producer.rally={x:Math.max(130,Math.min(2270,px)),y:Math.max(110,Math.min(1240,py))};
  return {ok:true};
 },
 // New units never appear inside a neighbouring building: step them to the nearest open cell.
 clearSpawn(unit){if(!unit||this.scenario!=='territory')return;const g=this.navGrid(),c=this.cellOf(unit);if(!g.blocked[c.cy*g.w+c.cx])return;const free=this.freeNear(c.cx,c.cy);if(free){unit.x=(free.cx+.5)*NAV.cell;unit.y=(free.cy+.5)*NAV.cell}},
 sendToRally(producer,unit){if(!producer.rally||!unit)return;unit.order='attackmove';unit.hold=false;unit.dest={...producer.rally};unit.path=null},

 // ---------- Navigation grid ----------
 navObstacles(){
  const list=[];
  for(const s of this.structures)if(s.hp>0){if(s.type==='barricade')list.push({wall:this.wallSegment(s)});else list.push({x:s.x,y:s.y,r:s.radius})}
  for(const b of this.bases)if(b.hp>0)list.push({x:b.x,y:b.y,r:b.radius});
  for(const f of this.facilities)if(f.hp>0)list.push({x:f.x,y:f.y,r:f.radius});
  for(const o of MAPS.blockers(this.mapId))list.push({x:o.x,y:o.y,r:o.radius});
  return list;
 },
 navGrid(){
  const key=this.structures.map(s=>s.id+(s.hp>0?'':'x')+(s.rot||0)).join()+'|'+this.bases.map(b=>b.hp>0?1:0).join()+'|'+this.facilities.map(f=>f.hp>0?1:0).join();
  if(this.nav&&this.nav.key===key)return this.nav;
  const C=NAV.cell,w=Math.ceil(2400/C),h=Math.ceil(1350/C),blocked=new Uint8Array(w*h);
  for(const o of this.navObstacles()){
   if(o.wall){const [a,b]=o.wall,steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/(C/2));for(let i=0;i<=steps;i++){const x=a.x+(b.x-a.x)*i/steps,y=a.y+(b.y-a.y)*i/steps;this.markDisc(blocked,w,h,x,y,WALL.thick+NAV.clearance)}continue}
   this.markDisc(blocked,w,h,o.x,o.y,o.r+NAV.clearance-6);
  }
  this.nav={key,w,h,blocked};return this.nav;
 },
 markDisc(blocked,w,h,x,y,r){const C=NAV.cell;for(let cy=Math.max(0,Math.floor((y-r)/C));cy<=Math.min(h-1,Math.floor((y+r)/C));cy++)for(let cx=Math.max(0,Math.floor((x-r)/C));cx<=Math.min(w-1,Math.floor((x+r)/C));cx++){const px=(cx+.5)*C,py=(cy+.5)*C;if(Math.hypot(px-x,py-y)<=r)blocked[cy*w+cx]=1}},
 cellOf(p){const C=NAV.cell,g=this.nav;return {cx:Math.max(0,Math.min(g.w-1,Math.floor(p.x/C))),cy:Math.max(0,Math.min(g.h-1,Math.floor(p.y/C)))}},
 freeNear(cx,cy){const g=this.nav;if(!g.blocked[cy*g.w+cx])return {cx,cy};for(let r=1;r<8;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;const x=cx+dx,y=cy+dy;if(x>=0&&y>=0&&x<g.w&&y<g.h&&!g.blocked[y*g.w+x])return {cx:x,cy:y}}return null},
 // True when the straight line crosses blocked cells away from both ends (ends may sit beside obstacles).
 segmentBlocked(a,b){const g=this.navGrid(),C=NAV.cell,len=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.ceil(len/(C/2));for(let i=1;i<steps;i++){const t=i/steps,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;if(t*len<C*1.4||(1-t)*len<C*1.4)continue;const cx=Math.floor(x/C),cy=Math.floor(y/C);if(cx>=0&&cy>=0&&cx<g.w&&cy<g.h&&g.blocked[cy*g.w+cx])return true}return false},
 findPath(from,to){
  const g=this.navGrid(),w=g.w,start=this.freeNear(this.cellOf(from).cx,this.cellOf(from).cy),goal=this.freeNear(this.cellOf(to).cx,this.cellOf(to).cy);
  if(!start||!goal)return null;const si=start.cy*w+start.cx,gi=goal.cy*w+goal.cx;if(si===gi)return [];
  const gScore=new Float32Array(w*g.h).fill(Infinity),came=new Int32Array(w*g.h).fill(-1),closed=new Uint8Array(w*g.h),heap=[];
  const hcost=i=>{const x=i%w,y=(i/w)|0,dx=Math.abs(x-goal.cx),dy=Math.abs(y-goal.cy);return Math.max(dx,dy)+.414*Math.min(dx,dy)};
  const push=(i,f)=>{heap.push([f,i]);let k=heap.length-1;while(k>0){const p=(k-1)>>1;if(heap[p][0]<=heap[k][0])break;[heap[p],heap[k]]=[heap[k],heap[p]];k=p}};
  const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let k=0;for(;;){const l=2*k+1,r=l+1;let m=k;if(l<heap.length&&heap[l][0]<heap[m][0])m=l;if(r<heap.length&&heap[r][0]<heap[m][0])m=r;if(m===k)break;[heap[m],heap[k]]=[heap[k],heap[m]];k=m}}return top};
  gScore[si]=0;push(si,hcost(si));let found=false,iterations=0;
  while(heap.length&&iterations++<9000){const [,i]=pop();if(closed[i])continue;closed[i]=1;if(i===gi){found=true;break}const x=i%w,y=(i/w)|0;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=g.h)continue;const n=ny*w+nx;if(g.blocked[n]||closed[n])continue;if(dx&&dy&&(g.blocked[y*w+nx]||g.blocked[ny*w+x]))continue;
    const cost=gScore[i]+(dx&&dy?1.414:1);if(cost<gScore[n]){gScore[n]=cost;came[n]=i;push(n,cost+hcost(n))}}}
  if(!found)return null;
  const cells=[];for(let i=gi;i!==-1&&i!==si;i=came[i])cells.push(i);cells.reverse();
  const C=NAV.cell,pts=cells.map(i=>({x:(i%w+.5)*C,y:(((i/w)|0)+.5)*C}));
  // String-pull: keep only the corners needed for clear straight runs.
  const out=[];let anchor={x:from.x,y:from.y};for(let k=0;k<pts.length;k++){const next=pts[k+1];if(!next)break;if(this.segmentBlocked(anchor,next)){out.push(pts[k]);anchor=pts[k]}}
  return out;
 },
 // Called per moving unit before it steps: route around obstacles and recover from getting stuck.
 navigate(u,dest,dt,budget){
  if(this.scenario!=='territory')return;
  const moved=u.navLast?Math.hypot(u.x-u.navLast.x,u.y-u.navLast.y):0;u.navLast={x:u.x,y:u.y};
  u.stuckFor=moved<NAV.stuckDistance*dt?(u.stuckFor||0)+dt:0;
  if(u.navDest===dest&&u.stuckFor<NAV.stuckTime)return;
  if(budget.count>=NAV.maxPerTick)return;
  const stuck=u.stuckFor>=NAV.stuckTime;u.stuckFor=0;u.navDest=dest;
  if(!stuck&&!this.segmentBlocked(u,dest))return;
  budget.count++;const pts=this.findPath(u,dest);
  if(!pts||!pts.length){if(stuck){u.dest={x:u.x+(Math.random()-.5)*60,y:u.y+(Math.random()-.5)*60};u.path=[dest,...(u.path||[])];u.navDest=u.dest}return}
  u.path=[...pts.slice(1),dest,...(u.path||[])];u.dest=pts[0];u.navDest=u.dest;
 }
};
module.exports={tactics,GUARD,NAV,WALL};
