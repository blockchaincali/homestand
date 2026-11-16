import * as THREE from '/vendor/three.module.js';
import {mergeGeometries} from '/vendor/BufferGeometryUtils.js';

// HOMESTAND town kit. Every building, prop and vehicle is authored here from simple
// primitives, baked with vertex colour and height-based ambient occlusion, then merged
// per material. The whole district renders in a handful of draw calls and is
// shared by the battle renderer and the cinematic homepage.
const W=2400,H=1350,S=30,TAU=Math.PI*2;
export const toX=x=>(x-W/2)/S,toZ=y=>(y-H/2)/S;
const MAPS=globalThis.IronMaps;
// The authored layout in use: Safe Haven's town or the Territory War frontier.
let layoutId='safe-haven';
export function setLayout(id){layoutId=MAPS.layouts[id]?id:'safe-haven';return layoutId}
export const layout=()=>MAPS.layouts[layoutId];

export const C={cream:0xeadcc0,peach:0xe2b088,sky:0x9fc6d2,mint:0xb7d3b0,ochre:0xd9a85c,rose:0xdba59c,white:0xf1ede3,lime:0xc9cf8a,
 zinc:0x96a2a8,rust:0x9a5b3b,red:0xa8432f,green:0x4d7d58,blue:0x41708f,teal:0x2f8f86,
 cement:0xc9bea5,concrete:0xa9a597,darkConcrete:0x6c6a64,steel:0x5f6c72,black:0x24282b,tank:0x1d2124,wood:0x6e4b2e,plank:0x9b7448,
 leafA:0x2e6a37,leafB:0x3e7c3c,leafC:0x5b8a37,leafDry:0x86884a,trunk:0x5a4030,laterite:0xa3542f,granite:0x9b8f86,sand:0xc7a679,
 hazard:0xf0b632,azure:0x2f86b4,azureDark:0x1d4c66,crimson:0xa83a2c,olive:0x6b6a43,khaki:0xa59a6b,yellow:0xf2c230,orange:0xe27b2e};
const WALLS=[C.cream,C.peach,C.sky,C.mint,C.ochre,C.rose],ROOFS=[C.zinc,C.rust,C.red,C.green,C.blue,C.zinc],GATES=[0x2d5a43,0x2b4a6b,0x3a3a3a,0x6b2f2a,0x2d5a43,0x445a2a];
const CLOTH=[0xd8452f,0x2d78c4,0xf2c230,0x3a9b5c,0xe27b2e,0x8d3fa8,0xf1ede3,0x1f9aa0];

export function rngFrom(seed){let s=(seed>>>0)||1;return ()=>((s=Math.imul(s,1664525)+1013904223>>>0)/4294967296)}

// Unit geometries. Boxes, cylinders and cones stand on y=0 so heights read naturally.
const base=new Map();
function unitGeo(key,make){if(!base.has(key)){let g=make();if(g.index){const flat=g.toNonIndexed();g.dispose();g=flat}for(const name of Object.keys(g.attributes))if(name!=='position'&&name!=='normal')g.deleteAttribute(name);g.computeBoundingBox();base.set(key,g)}return base.get(key)}
const G={
 box:()=>unitGeo('box',()=>new THREE.BoxGeometry(1,1,1).translate(0,.5,0)),
 cyl:(n=10,top=1)=>unitGeo('cyl'+n+':'+top,()=>new THREE.CylinderGeometry(.5*top,.5,1,n).translate(0,.5,0)),
 cone:(n=8)=>unitGeo('cone'+n,()=>new THREE.ConeGeometry(.5,1,n).translate(0,.5,0)),
 blob:(detail=1)=>unitGeo('blob'+detail,()=>new THREE.IcosahedronGeometry(.5,detail)),
 sphere:()=>unitGeo('sphere',()=>new THREE.SphereGeometry(.5,10,7)),
 prism:()=>unitGeo('prism',()=>{const g=new THREE.BufferGeometry(),p=[-.5,0,.5,.5,0,.5,.5,1,0, -.5,0,.5,.5,1,0,-.5,1,0, .5,0,-.5,-.5,0,-.5,-.5,1,0, .5,0,-.5,-.5,1,0,.5,1,0, -.5,0,-.5,-.5,0,.5,-.5,1,0, .5,0,.5,.5,0,-.5,.5,1,0];g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.computeVertexNormals();return g}),
 hip:(ridge=.3)=>unitGeo('hip'+ridge.toFixed(2),()=>{const r=ridge,g=new THREE.BufferGeometry(),a=[-.5,0,.5],b=[.5,0,.5],c=[.5,0,-.5],d=[-.5,0,-.5],e=[-r,1,0],f=[r,1,0],p=[...a,...b,...f,...a,...f,...e,...c,...d,...e,...c,...e,...f,...d,...a,...e,...b,...c,...f];g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.computeVertexNormals();return g})
};

const MATERIALS={matte:{roughness:.92,metalness:0},paint:{roughness:.66,metalness:.05},metal:{roughness:.45,metalness:.45},glass:{roughness:.16,metalness:.6},glow:null},SHARED=new Map();
function kitMaterial(name,shared){if(shared&&SHARED.has(name))return SHARED.get(name);const spec=MATERIALS[name],material=spec?new THREE.MeshStandardMaterial({vertexColors:true,...spec}):new THREE.MeshBasicMaterial({vertexColors:true});if(shared){material.userData.shared=true;SHARED.set(name,material)}return material}
export class Kit{
 constructor(seed=0x51ab){this.parts={matte:[],paint:[],metal:[],glass:[],glow:[]};this.stack=[new THREE.Matrix4()];this.rng=rngFrom(seed);this._m=new THREE.Matrix4();this._q=new THREE.Quaternion();this._e=new THREE.Euler();this._p=new THREE.Vector3();this._s=new THREE.Vector3();this._c=new THREE.Color()}
 push(x=0,z=0,ry=0,y=0,scale=1){this._e.set(0,ry,0);this._q.setFromEuler(this._e);const m=new THREE.Matrix4().compose(this._p.set(x,y,z),this._q,this._s.set(scale,scale,scale));this.stack.push(this.stack.at(-1).clone().multiply(m));return this}
 pop(){if(this.stack.length>1)this.stack.pop();return this}
 // ao darkens the lower part of each piece, faking contact shadow and weathering.
 add(bucket,geo,color,x,y,z,sx,sy,sz,ry=0,rx=0,rz=0,ao=.32,jitter=.05){
  this._e.set(rx,ry,rz);this._q.setFromEuler(this._e);this._m.compose(this._p.set(x,y,z),this._q,this._s.set(sx,sy,sz)).premultiply(this.stack.at(-1));
  const g=geo.clone(),pos=geo.attributes.position,count=pos.count,colors=new Float32Array(count*3),box=geo.boundingBox,span=box.max.y-box.min.y||1,tint=1+(this.rng()-.5)*jitter*2;this._c.setHex(color);
  for(let i=0;i<count;i++){const h=(pos.getY(i)-box.min.y)/span,f=tint*(1-ao*(1-h));colors[i*3]=this._c.r*f;colors[i*3+1]=this._c.g*f;colors[i*3+2]=this._c.b*f}
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.applyMatrix4(this._m);this.parts[bucket].push(g);return this}
 box(b,c,x,y,z,w,h,d,ry=0,ao,j){return this.add(b,G.box(),c,x,y,z,w,h,d,ry,0,0,ao,j)}
 cyl(b,c,x,y,z,r,h,n=10,ry=0,rx=0,rz=0,top=1){return this.add(b,G.cyl(n,top),c,x,y,z,r*2,h,r*2,ry,rx,rz,.25)}
 cone(b,c,x,y,z,r,h,n=8,ry=0,rx=0,rz=0){return this.add(b,G.cone(n),c,x,y,z,r*2,h,r*2,ry,rx,rz,.2)}
 blob(b,c,x,y,z,sx,sy,sz,ry=0,ao=.35){return this.add(b,G.blob(1),c,x,y,z,sx,sy,sz,ry,0,0,ao,.08)}
 rock(b,c,x,y,z,sx,sy,sz,ry=0){return this.add(b,G.blob(0),c,x,y,z,sx,sy,sz,ry,(this.rng()-.5)*.4,0,.4,.1)}
 prism(b,c,x,y,z,w,h,d,ry=0){return this.add(b,G.prism(),c,x,y,z,w,h,d,ry,0,0,.12)}
 hip(b,c,x,y,z,w,h,d,ry=0){const ridge=Math.max(0,Math.round((.5-d/w*.5)*20)/20);return this.add(b,G.hip(ridge),c,x,y,z,w,h,d,ry,0,0,.12)}
 build({shadows=false,receive=true,shared=false}={}){
  const group=new THREE.Group();
  for(const [name,list] of Object.entries(this.parts)){if(!list.length)continue;const merged=mergeGeometries(list,false);for(const g of list)g.dispose();this.parts[name]=[];if(!merged)continue;merged.computeBoundingSphere();
   const material=kitMaterial(name,shared),mesh=new THREE.Mesh(merged,material);mesh.castShadow=shadows&&name!=='glow'&&name!=='glass';mesh.receiveShadow=receive;mesh.userData.townPart=name;group.add(mesh)}
  return group}
}
export function disposeTree(root){root?.traverse(o=>{if(o.isMesh||o.isPoints||o.isInstancedMesh){o.geometry?.dispose();for(const m of [].concat(o.material||[])){if(m.userData?.shared)continue;m.map?.dispose();m.bumpMap?.dispose();m.dispose()}}})}

// ---------- Architecture ----------
export function house(k,w,d,storeys=1,style=0){
 const wall=WALLS[style%WALLS.length],roof=ROOFS[style%ROOFS.length],h=storeys*1.02,trim=0x5c4a3c,rng=k.rng;
 k.box('matte',C.concrete,0,0,0,w+.16,.12,d+.16,0,.2);k.box('matte',wall,0,.12,0,w,h,d,0,.38);k.box('matte',new THREE.Color(wall).multiplyScalar(.72).getHex(),0,.12,0,w+.02,.16,d+.02,0,.1);
 const cols=Math.max(2,Math.round(w/.85));for(let s=0;s<storeys;s++)for(let i=0;i<cols;i++){const x=-w/2+(i+.5)*w/cols;if(s===0&&i===Math.floor(cols/2)){k.box('matte',C.wood,x,.12,d/2,.34,.66,.04,0,.15);continue}k.box('glass',0x334a55,x,.42+s*1.02,d/2,.3,.34,.035,0,0);k.box('paint',C.white,x,.39+s*1.02,d/2+.01,.38,.05,.05,0,0)}
 for(let s=0;s<storeys;s++){k.box('glass',0x334a55,w/2,.42+s*1.02,0,.035,.34,.3,0,0)}
 if(storeys>1){k.box('matte',C.concrete,0,1.08,d/2+.28,w*.55,.08,.56,0,.1);for(let i=0;i<5;i++)k.box('metal',C.black,-w*.27+i*w*.135,1.16,d/2+.54,.035,.32,.035,0,0);k.box('metal',C.black,0,1.46,d/2+.54,w*.55,.035,.035,0,0)}
 const over=.2;k.hip('metal',roof,0,.12+h,0,w+over*2,Math.min(w,d)*.36,d+over*2);
 if(rng()<.55){const tx=w/2-.32,tz=-d/2+.32;for(const [a,b] of [[-.18,-.18],[.18,-.18],[-.18,.18],[.18,.18]])k.box('metal',C.steel,tx+a,.12+h,tz+b,.04,.5,.04,0,0);k.box('metal',C.steel,tx,.6+h,tz,.42,.04,.42,0,0);k.cyl('paint',C.tank,tx,.64+h,tz,.22,.48,12)}
 if(rng()<.35)k.add('paint',G.cone(10),C.white,-w/2+.3,.16+h+Math.min(w,d)*.2,d/2-.1,.36,.06,.36,0,-.9,0,0);
 if(rng()<.5)k.box('paint',0xe9ece6,w/2+.06,.62,d*.2,.12,.22,.34,0,.2);
}
export function compound(k,c){
 const w=c.w/S,d=c.d/S,style=c.style||0,rng=k.rng;k.push(toX(c.x),toZ(c.y),-(c.rot||0));
 const wallC=[C.cement,0xd8cbb0,0xc4b494][style%3],gate=GATES[style%GATES.length],t=.13,wh=.64,gap=1.05;
 k.box('matte',wallC,0,0,-d/2,w,wh,t,0,.4);k.box('matte',wallC,-w/2,0,0,t,wh,d,0,.4);k.box('matte',wallC,w/2,0,0,t,wh,d,0,.4);
 const side=(w-gap)/2;k.box('matte',wallC,-gap/2-side/2,0,d/2,side,wh,t,0,.4);k.box('matte',wallC,gap/2+side/2,0,d/2,side,wh,t,0,.4);
 for(const [x,z,ww,dd] of [[0,-d/2,w+.04,t+.06],[-w/2,0,t+.06,d+.04],[w/2,0,t+.06,d+.04],[-gap/2-side/2,d/2,side,t+.06],[gap/2+side/2,d/2,side,t+.06]])k.box('matte',0xe8e0cc,x,wh,z,ww,.05,dd,0,0);
 for(const x of [-gap/2,gap/2])k.box('matte',wallC,x,0,d/2,.2,wh+.18,.2,0,.3);
 k.box('metal',gate,0,.02,d/2,gap*.96,wh*.98,.05,0,.15);
 k.push(0,-d*.12);house(k,w*.62,d*.5,c.storeys||1,style);k.pop();
 const tx=(rng()<.5?-1:1)*w*.34,tz=d*.28;if(rng()<.7)mango(k,tx,tz,.55+rng()*.2);else palm(k,tx,tz,.7);
 if(rng()<.55)car(k,-tx*.85,d*.3,CLOTH[Math.floor(rng()*CLOTH.length)],Math.PI/2+(rng()-.5)*.3);
 if(rng()<.6){const lx=-w*.35,lz=-d*.36;k.box('metal',C.steel,lx,0,lz,.03,.42,.03,0,0);k.box('metal',C.steel,lx+.8,0,lz,.03,.42,.03,0,0);for(let i=0;i<4;i++)k.box('matte',CLOTH[(i+style)%CLOTH.length],lx+.14+i*.17,.24,lz,.12,.16,.02,0,0)}
 k.pop();
}
export function mango(k,x,z,s=1){if(k.rich){k.cyl('matte',C.trunk,x,0,z,.1*s,1.0*s,6,0,0,0,.7);const tones=[0x2f6a2a,0x3f7d30,0x4f8a34,0x5e9636];for(let i=0;i<5;i++){const a=i/5*TAU+k.rng(),r=i?.55*s:0;k.blob('matte',tones[(i+Math.floor(k.rng()*4))%4],x+Math.cos(a)*r,(1.25+(i?.05:.35))*s,z+Math.sin(a)*r,(i?1.05:1.5)*s,(i?.85:1.1)*s,(i?1.0:1.45)*s,k.rng()*TAU,.5)}return}k.cyl('matte',C.trunk,x,0,z,.09*s,.9*s,6,0,0,0,.7);const g=k.rng()<.5?C.leafA:C.leafB;k.blob('matte',g,x,1.25*s,z,1.7*s,1.15*s,1.6*s,k.rng()*TAU);k.blob('matte',g===C.leafA?C.leafB:C.leafA,x+.35*s,1.55*s,z-.15*s,1.1*s,.85*s,1.05*s)}
export function neem(k,x,z,s=1){k.cyl('matte',C.trunk,x,0,z,.07*s,1.4*s,6,0,0,0,.7);k.blob('matte',C.leafC,x,1.85*s,z,1.15*s,1.45*s,1.1*s);k.blob('matte',C.leafB,x-.2*s,1.45*s,z+.15*s,.9*s,.8*s,.9*s)}
export function palm(k,x,z,s=1){const lean=(k.rng()-.5)*.25;for(let i=0;i<3;i++)k.cyl('matte',0x6d5640,x+lean*i*s*.35,i*.75*s,z,.075*s,.78*s,6,0,0,lean,.85);const tx=x+lean*s*1.05,ty=2.2*s;k.blob('matte',0x4a3a26,tx,ty,z,.28*s,.26*s,.28*s);for(let i=0;i<8;i++){const a=i/8*TAU+k.rng()*.3;k.add('matte',G.cone(4),i%2?C.leafB:C.leafC,tx+Math.cos(a)*.12*s,ty-.05*s,z+Math.sin(a)*.12*s,.32*s,1.35*s,.08*s,Math.PI-a,0,Math.PI/2+.35,0,.06)}}
export function shrub(k,x,z,s=1){if(k.rich){const n=2+Math.floor(k.rng()*3);for(let i=0;i<n;i++)k.blob('matte',[0x3f7a2c,0x5a8c34,0x6f9a3a,C.leafDry][Math.floor(k.rng()*4)],x+(k.rng()-.5)*.6*s,.16*s,z+(k.rng()-.5)*.6*s,(.5+k.rng()*.35)*s,(.38+k.rng()*.2)*s,(.5+k.rng()*.35)*s,k.rng()*TAU,.5);return}k.blob('matte',k.rng()<.5?C.leafB:C.leafDry,x,.18*s,z,.7*s,.45*s,.7*s,k.rng()*TAU,.45)}
export function grass(k,x,z,s=1){if(k.rich){for(let i=0;i<5;i++)k.cone('matte',[0x6b8f32,0x86a03e,0xa3a552][i%3],x+(k.rng()-.5)*.35*s,0,z+(k.rng()-.5)*.35*s,.05*s,.3*s+.25*k.rng()*s,4);return}for(let i=0;i<3;i++)k.cone('matte',i%2?C.leafDry:0x9a9a52,x+(k.rng()-.5)*.25*s,0,z+(k.rng()-.5)*.25*s,.06*s,.35*s+.2*k.rng()*s,4)}
export function termite(k,x,z,s=1){k.cone('matte',C.laterite,x,0,z,.42*s,1.3*s,7);k.cone('matte',0x9b4f2c,x+.22*s,0,z+.1*s,.22*s,.8*s,6)}
export function car(k,x,z,color,ry=0){k.push(x,z,ry);k.box('paint',color,0,.12,0,1.0,.28,.46,0,.25);k.box('glass',0x2c3c46,-.06,.4,0,.56,.22,.42,0,0);k.box('paint',color,-.06,.6,0,.5,.04,.4,0,0);for(const [a,b] of [[-.33,-.22],[.33,-.22],[-.33,.22],[.33,.22]])k.cyl('matte',C.black,a,.12,b,.12,.08,10,0,Math.PI/2,0);k.pop()}
export function danfo(k,x,z,ry=0){k.push(x,z,ry);k.box('paint',C.yellow,0,.14,0,1.65,.6,.62,0,.2);for(const y of [.24,.5])k.box('matte',C.black,0,y,0,1.66,.035,.63,0,0);k.box('glass',0x2c3c46,.1,.48,0,1.3,.18,.635,0,0);k.box('glass',0x2c3c46,.83,.42,0,.03,.26,.5,0,0);for(const [a,b] of [[-.52,-.3],[.52,-.3],[-.52,.3],[.52,.3]])k.cyl('matte',C.black,a,.14,b,.14,.09,10,0,Math.PI/2,0);k.pop()}
export function keke(k,x,z,ry=0){k.push(x,z,ry);k.box('paint',C.yellow,0,.1,0,.6,.32,.42,0,.2);k.box('matte',C.black,-.05,.58,0,.62,.05,.46,0,0);for(const a of [-.2,.2])k.box('metal',C.black,a,.42,0,.03,.18,.42,0,0);k.box('paint',0x2d78c4,.18,.42,0,.02,.12,.4,0,0);k.cyl('matte',C.black,.32,.09,0,.09,.06,8,0,Math.PI/2,0);for(const b of [-.2,.2])k.cyl('matte',C.black,-.22,.09,b,.09,.06,8,0,Math.PI/2,0);k.pop()}
function pole(k,x,z,h=3,ry=0){k.cyl('matte',0x4e3b2a,x,0,z,.05,h,6);k.box('matte',0x4e3b2a,x,h-.2,z,.06,.06,.75,ry,0)}

function roadPoints(road){return road.points.map(([x,y])=>[toX(x),toZ(y)])}
function walk(points,step,fn){for(let i=0;i<points.length-1;i++){const [ax,az]=points[i],[bx,bz]=points[i+1],len=Math.hypot(bx-ax,bz-az),nx=(bx-ax)/len,nz=(bz-az)/len;for(let t=step/2;t<len;t+=step)fn(ax+nx*t,az+nz*t,nx,nz,i)}}

export function marketStalls(k,m){
 const w=m.w/S,d=m.d/S,canopies=[C.red,C.blue,C.yellow,C.green,C.orange,0x2d78c4,0xd8452f,C.teal],goods=[0xd8452f,0x3a9b5c,0x8a5a2b,0xf2c230,0xe27b2e,0x7d3fa0];k.push(toX(m.x),toZ(m.y));
 const cols=Math.floor(w/1.25);for(let row=0;row<2;row++)for(let i=0;i<cols;i++){const x=-w/2+(i+.5)*w/cols,z=(row?1:-1)*d*.24,c=canopies[(i*3+row*5)%canopies.length];
  k.box('matte',C.plank,x,.38,z,.95,.07,.62,0,.1);for(const [a,b] of [[-.42,-.27],[.42,-.27],[-.42,.27],[.42,.27]])k.box('matte',C.wood,x+a,0,z+b,.05,b<0?1.18:1.02,.05,0,.2);
  k.add('metal',G.box(),c,x,1.08,z,1.08,.04,.82,0,row?-.16:.16,0,0,.04);for(let g=0;g<4;g++)k.blob('matte',goods[(i+g+row)%goods.length],x-.3+g*.2,.5,z+(k.rng()-.5)*.25,.18,.13,.18)}
 for(let i=0;i<3;i++){const x=-w/2+.9+i*1.55,col=[0x2d78c4,C.yellow,C.red][i];k.box('paint',col,x,0,d*.5+.55,1.45,.88,.72,0,.25);k.box('matte',C.black,x,.08,d*.5+.92,.9,.66,.02,0,0);k.add('metal',G.box(),C.zinc,x,.92,d*.5+1.02,1.5,.04,.5,0,-.2,0,0,0)}
 for(let i=0;i<5;i++){const a=i/5*TAU+.4,x=Math.cos(a)*w*.56,z=Math.sin(a)*d*.75;k.box('metal',C.steel,x,0,z,.035,1.15,.035,0,0);k.cone('paint',canopies[(i+2)%canopies.length],x,1.0,z,.62,.32,8)}
 for(let i=0;i<4;i++)keke(k,-w/2-.8+i*.75,d*.75+.3,Math.PI/2+.15);danfo(k,w/2+1.2,-d*.1,Math.PI/2);k.pop();
}
export function footballField(k,f){k.push(toX(f.x),toZ(f.y));const w=f.w/S;for(const s of [-1,1]){k.box('paint',C.white,s*w*.47,0,-.55,.05,.75,.05,0,0);k.box('paint',C.white,s*w*.47,0,.55,.05,.75,.05,0,0);k.box('paint',C.white,s*w*.47,.72,0,.05,.05,1.15,0,0)}k.pop()}
export function checkpoint(k,c){k.push(toX(c.x),toZ(c.y),-(c.rot||0));for(const s of [-1,1]){for(let i=0;i<6;i++)for(let r=0;r<2;r++)k.blob('matte',C.khaki,-.75+i*.3+r*.15,.09+r*.15,s*1.85,.34,.17,.24,0,.3);k.box('paint',C.white,s*.35,0,s*1.6,.62,.85,.62,0,.3);k.hip('metal',C.zinc,s*.35,.85,s*1.6,.8,.22,.8)}
 k.box('metal',C.black,-.9,0,-1.25,.08,.65,.08,0,0);for(let i=0;i<8;i++)k.box('paint',i%2?C.white:C.red,-.9+.06,.62,-1.08+i*.3,.06,.06,.3,0,0);k.pop()}
export function stagingCamp(k,s,avoid=[]){const rng=k.rng;k.push(toX(s.x),toZ(s.y));const w=s.w/S,d=s.d/S,blocked=(x,z)=>avoid.some(p=>Math.hypot(toX(p.x)-toX(s.x)-x,toZ(p.y)-toZ(s.y)-z)<p.r/S+1.4)||s.sparse&&Math.hypot(x+toX(s.x)-toX(2110),z)<5;
 for(let i=0;i<11;i++){const x=(rng()-.5)*w,z=(rng()-.5)*d;if(Math.abs(z)<1.6&&Math.abs(x)<3.4||blocked(x,z))continue;k.prism('matte',i%3?C.olive:C.khaki,x,0,z,1.4,.8,1.05,rng()*TAU)}
 for(let i=0;i<16;i++){const x=(rng()-.5)*w*1.1,z=(rng()-.5)*d,ry=rng()*TAU;if(Math.abs(z)<1.5&&Math.abs(x)<2.6||blocked(x,z))continue;if(i%2)k.cyl('paint',i%4===1?0x4a5a3a:0x7a4a2a,x,0,z,.16,.44,10);else k.box('matte',C.plank,x,0,z,.42,.34,.42,ry,.2)}
 for(let i=0;i<6;i++){const x=(rng()-.5)*w,z=(rng()-.5)*d;if(!blocked(x,z))k.rock('matte',C.laterite,x,0,z,1.1,.35,.7)}k.pop()}

export function townScenery(k,{quality='high',lite=false}={}){
 const L=layout(),rng=k.rng,dense=quality==='high'?1:quality==='balanced'?.7:.45;k.rich=!lite;
 for(const c of L.compounds)compound(k,c);marketStalls(k,L.market);if(!L.field.skip)footballField(k,L.field);for(const c of L.checkpoints)checkpoint(k,c);stagingCamp(k,L.staging,L.plots||[]);
 const road=L.roads.find(r=>r.id==='highway'),pts=roadPoints(road);let prev=null;walk(pts,4.2,(x,z,nx,nz)=>{const px=x-nz*1.75,pz=z+nx*1.75;pole(k,px,pz,3,Math.atan2(nx,nz)+Math.PI/2);if(prev)for(const off of [-.3,0,.3]){const dx=px-prev[0],dz=pz-prev[1],len=Math.hypot(dx,dz);k.box('matte',0x1c1c1c,(px+prev[0])/2-nz*off,2.78,(pz+prev[1])/2+nx*off,.018,.018,len,Math.atan2(dx,dz),0,0)}prev=[px,pz]});
 for(const id of ['avenue','evacuation'].filter(id=>L.roads.some(r=>r.id===id)))walk(roadPoints(L.roads.find(r=>r.id===id)),5.2,(x,z,nx,nz,i)=>{for(const s of [-1,1]){const w=L.roads.find(r=>r.id===id).width/S/2+.32,px=x-nz*w*s,pz=z+nx*w*s;k.box('metal',C.steel,px,0,pz,.06,2.4,.06,0,0);k.box('metal',C.steel,px+nz*s*.25,2.36,pz-nx*s*.25,.06,.05,.55,Math.atan2(nx,nz)+Math.PI/2,0);k.box('glow',0xfff1c4,px+nz*s*.48,2.3,pz-nx*s*.48,.18,.06,.12)}});
 // Concrete kerbs and drainage slabs edge the asphalt network.
 for(const r of L.roads.filter(r=>r.surface==='asphalt'))walk(roadPoints(r),1.6,(x,z,nx,nz)=>{const half=r.width/S/2;for(const s of [-1,1])k.box('matte',C.concrete,x-nz*half*s,0,z+nx*half*s,.12,.07,1.5,Math.atan2(nx,nz),.1,.06)});
 for(const [x,y,col] of (L.billboards||[[1330,612,'blue'],[820,740,'red'],[1690,742,'green']]).map(([x,y,c])=>[x,y,C[c]])){const bx=toX(x),bz=toZ(y);for(const s of [-1,1])k.box('metal',C.steel,bx+s*.9,0,bz,.08,1.6,.08,0,0);k.box('paint',col,bx,1.55,bz,2.3,1.0,.08,0,.05);k.box('paint',C.white,bx-.4,1.75,bz+.05,1.0,.5,.02,0,0)}
 for(const [x,y] of L.signs||[[940,676],[1120,676],[940,330],[940,880],[560,830]]){const bx=toX(x)+1.2,bz=toZ(y)-1.15;k.box('metal',C.steel,bx,0,bz,.05,1.4,.05,0,0);k.box('paint',0x2d7a4a,bx,1.25,bz,.75,.28,.04,0,0)}
 const T=look();for(const f of L.forests){const n=Math.round(f.r*f.r/900*dense*.55*T.trees);for(let i=0;i<n;i++){const a=rng()*TAU,r=Math.sqrt(rng())*f.r,x=toX(f.x+Math.cos(a)*r),z=toZ(f.y+Math.sin(a)*r*.8);const t=rng();if(t<.45)mango(k,x,z,.75+rng()*.5);else if(t<.75)neem(k,x,z,.8+rng()*.4);else palm(k,x,z,.85+rng()*.35)}}
 const clear=(x,y)=>L.compounds.every(c=>Math.hypot(c.x-x,c.y-y)>c.w*.7)&&L.roads.every(r=>r.points.every(([px,py],i)=>{const n=r.points[i+1];if(!n)return true;const dx=n[0]-px,dy=n[1]-py,len2=dx*dx+dy*dy,t=Math.max(0,Math.min(1,((x-px)*dx+(y-py)*dy)/len2));return Math.hypot(px+dx*t-x,py+dy*t-y)>r.width*.5+26}))&&Math.hypot(x-250,y-680)>120&&Math.hypot(x-2190,y-675)>110&&!(L.noScatter||[]).some(r=>x>r.x1&&x<r.x2&&y>r.y1&&y<r.y2)&&!(L.plots||[]).some(p=>Math.hypot(p.x-x,p.y-y)<p.r+30)&&!(L.facilities||[]).some(f=>Math.hypot(f.x-x,f.y-y)<80)&&!(L.checkpointNodes||[]).some(n=>Math.hypot(n.x-x,n.y-y)<110);
 const scatter=lite?160:Math.round(640*dense);for(let i=0;i<scatter;i++){const x=60+rng()*2280,y=60+rng()*1230;if(!clear(x,y))continue;const t=rng(),X=toX(x),Z=toZ(y);if(!L.territories&&x>300&&x<760&&y>320&&y<820&&t<.75)continue;if(t<.32&&rng()>T.trees)continue;if(t<.32&&rng()<T.dry)acacia(k,X,Z,.8+rng()*.4);else if(t<.16)mango(k,X,Z,.7+rng()*.45);else if(t<.26)palm(k,X,Z,.8+rng()*.3);else if(t<.32)neem(k,X,Z,.7+rng()*.3);else if(t<.62)shrub(k,X,Z,.7+rng()*.6);else if(t<.9)grass(k,X,Z,1+rng());else if(t<.95)termite(k,X,Z,.7+rng()*.5);else k.rock('matte',C.granite,X,.1,Z,.6+rng()*.6,.4,.5+rng()*.5,rng()*TAU)}
 // Granite inselbergs and low hills frame the district beyond the playable boundary.
 // Terraced escarpments and dense bush belts frame the battlefield beyond the playable area.
 const hills=lite?8:16;for(let i=0;i<hills;i++){const a=i/hills*TAU+rng()*.2,x=Math.cos(a)*(50+rng()*8),z=Math.sin(a)*(31+rng()*5),top=terrace(k,x,z,4+rng()*4,2+Math.floor(rng()*2),T.dry);if(!lite)for(let j=0;j<4;j++)(T.dry>.4?acacia:mango)(k,x+(rng()-.5)*4,z+(rng()-.5)*4,(.9+rng()*.5))}
 if(!lite)for(let i=0;i<Math.round(260*dense);i++){const a=rng()*TAU,x=Math.cos(a)*(42+rng()*14),z=Math.sin(a)*(25.5+rng()*9);const t=rng();if(t<.35*T.trees)(T.dry>.5?acacia:mango)(k,x,z,.8+rng()*.6);else if(t<.7)shrub(k,x,z,1+rng()*.8);else grass(k,x,z,1.2+rng())}
 // Base clutter: drums, crates, sandbags and tyres around the plots and HQs.
 for(const p of (L.plots||[]).filter(p=>p.kind!=='forward'))for(let i=0;i<(lite?1:2);i++){const a=rng()*TAU,d=p.r*1.15;clutter(k,toX(p.x+Math.cos(a)*d),toZ(p.y+Math.sin(a)*d),.9)}
 const ring=lite?20:44;for(let i=0;i<ring;i++){const a=i/ring*TAU+rng()*.1,rx=46+rng()*16,rz=29+rng()*12,x=Math.cos(a)*rx,z=Math.sin(a)*rz,s=2.5+rng()*4.5;if(i%3===0)k.rock('matte',C.granite,x,-.4,z,s*1.4,s*.9,s*1.2,rng()*TAU);else k.blob('matte',T.dry>.4?(i%2?0xc8a774:0xb9935f):i%2?0x7f7c4a:0x8a8150,x,-s*.35,z,s*2.2,s*.9,s*1.8,rng()*TAU,.25);if(rng()<.6*T.trees)(T.dry>.4?acacia:mango)(k,x*.92,z*.92,1+rng()*.6)}
 theatreLandmark(k);
}

// ---------- Mission buildings (entities) ----------
export function facilityMesh(kind,id){
 const k=new Kit(id?[...id].reduce((a,c)=>a*31+c.charCodeAt(0)>>>0,7):7);
 if(kind==='civilianClinic'){k.box('matte',C.concrete,0,0,0,3.4,.16,2.6,0,.1);k.box('matte',C.white,0,.16,0,3.1,1.3,2.1,0,.3);k.box('paint',C.teal,0,.16,0,3.12,.22,2.12,0,.1);k.hip('metal',C.green,0,1.46,0,3.5,.6,2.5);k.box('paint',C.white,0,1.46,1.08,1.6,.16,.6,0,0);for(const x of [-.7,.7])k.box('paint',C.white,x,.16,1.36,.1,1.3,.1,0,.2);k.box('paint',C.red,0,.58,1.07,.18,.62,.04,0,0);k.box('paint',C.red,0,.8,1.07,.62,.18,.04,0,0);for(const x of [-1.15,1.15])k.box('glass',0x2f4a55,x,.55,1.06,.5,.42,.03,0,0);
  k.box('paint',C.white,0,2.0,0,.24,.12,.9,0,0);k.box('paint',C.red,0,2.12,0,.9,.03,.24,0,0);k.box('paint',C.red,0,2.12,0,.24,.031,.9,0,0);
  k.push(-1.95,.9,Math.PI/2);k.box('paint',C.white,0,.14,0,1.25,.62,.58,0,.2);k.box('paint',C.red,0,.38,0,1.26,.08,.59,0,0);k.box('glass',0x2c3c46,.45,.48,0,.32,.2,.59,0,0);for(const [a,b] of [[-.4,-.28],[.4,-.28],[-.4,.28],[.4,.28]])k.cyl('matte',C.black,a,.13,b,.13,.08,10,0,Math.PI/2,0);k.pop();
  k.cyl('paint',C.tank,1.25,1.46,-.6,.3,.55,12)}
 else if(kind==='market'){k.box('matte',C.concrete,0,0,0,3.6,.14,2.8,0,.1);for(const x of [-1.5,-.5,.5,1.5])for(const z of [-1.15,1.15])k.box('metal',C.steel,x,.14,z,.1,1.7,.1,0,.1);k.prism('metal',C.rust,0,1.82,0,3.7,.75,2.9);k.box('matte',0x8a3c2a,0,1.8,0,3.75,.06,2.95,0,0);
  const goods=[0xd8452f,0x3a9b5c,0xf2c230,0xe27b2e,0x2d78c4,0x8a5a2b];for(let i=0;i<6;i++){const x=-1.3+i*.52;k.box('matte',C.plank,x,.38,-.4,.44,.1,.7,0,.1);k.box('matte',C.plank,x,.38,.55,.44,.1,.6,0,.1);for(let g=0;g<3;g++){k.blob('matte',goods[(i+g)%6],x-.1+g*.1,.55,-.4+(g-1)*.2,.16,.12,.16);k.blob('matte',goods[(i+g+3)%6],x-.1+g*.1,.55,.55,.14,.11,.14)}}
  for(const [x,c] of [[-1.9,C.red],[1.95,C.yellow]]){k.box('metal',C.steel,x,.14,1.45,.04,1.3,.04,0,0);k.cone('paint',c,x,1.15,1.45,.72,.34,8)}}
 else if(id==='facility-school'){k.box('matte',C.concrete,0,0,0,3.8,.14,2.7,0,.1);k.box('matte',C.sky,-.2,.14,-.45,3.3,1.08,1.25,0,.3);k.box('matte',C.sky,1.2,.14,.35,.95,1.08,1.6,0,.3);k.box('paint',C.blue,-.2,.14,-.45,3.32,.2,1.27,0,.1);k.box('matte',C.concrete,-.4,.14,.42,2.8,.08,.55,0,.1);for(let i=0;i<6;i++)k.box('paint',C.white,-1.65+i*.5,.22,.66,.08,.96,.08,0,.2);k.box('metal',C.zinc,-.4,1.18,.42,2.95,.05,.7,0,0);
  for(let i=0;i<5;i++)k.box('glass',0x2f4a55,-1.55+i*.6,.5,.19,.36,.36,.03,0,0);k.hip('metal',C.blue,-.2,1.22,-.45,3.55,.5,1.5);k.hip('metal',C.blue,1.2,1.22,.35,1.2,.48,1.85);k.box('metal',C.steel,-1.95,.14,1.2,.04,2.4,.04,0,0);k.box('paint',C.ochre,-1.75,2.2,1.2,.38,.24,.02,0,0)}
 else{k.box('matte',C.concrete,0,0,0,3.6,.14,2.8,0,.1);k.box('matte',C.ochre,0,.14,0,3.0,1.35,2.0,0,.3);k.box('matte',0xb88a4a,0,.14,0,3.02,.24,2.02,0,.1);k.prism('metal',C.red,0,1.49,0,3.3,.85,2.3);k.box('matte',C.concrete,0,.14,1.3,2.5,.08,.6,0,.1);for(let i=0;i<5;i++)k.box('paint',C.white,-1.1+i*.55,.22,1.52,.1,1.15,.1,0,.2);k.box('metal',C.rust,0,1.32,1.32,2.7,.05,.72,0,0);for(const x of [-.9,.9])k.box('glass',0x2f4a55,x,.55,1.01,.45,.45,.03,0,0);k.box('matte',C.wood,0,.14,1.01,.5,.8,.03,0,0);k.cyl('paint',C.tank,-1.25,1.49,-.6,.28,.5,12);mango(k,1.75,-.7,.6)}
 return k.build({shadows:true,shared:true})}

export function structureParts(type,team=0){
 const body=new Kit(type.length*97+team),found=new Kit(type.length*13),acc=team===0?C.azure:C.crimson,dark=team===0?C.azureDark:0x5a1d16;
 if(type==='barricade'){found.box('matte',C.darkConcrete,0,0,0,2.4,.06,.9,0,.1);for(const x of [-.78,0,.78]){body.add('matte',G.prism(),C.concrete,x,0,0,.74,.62,.5,0,0,0,.35);body.box('paint',C.hazard,x,.42,.12,.5,.07,.02,0,0)}for(let i=0;i<7;i++)for(let r=0;r<2;r++)body.blob('matte',C.khaki,-1.05+i*.35+r*.17,.1+r*.15,-.45,.38,.18,.26,0,.3)}
 else if(type==='watchtower'){found.box('matte',C.darkConcrete,0,0,0,1.8,.08,1.8,0,.1);for(const [x,z] of [[-.6,-.6],[.6,-.6],[-.6,.6],[.6,.6]])body.box('metal',C.steel,x,0,z,.13,2.1,.13,0,.2);for(const y of [.6,1.3])for(const s of [-1,1]){body.box('metal',C.steel,0,y,s*.6,1.2,.05,.05,0,0);body.box('metal',C.steel,s*.6,y,0,.05,.05,1.2,0,0)}body.box('matte',C.plank,0,2.1,0,1.6,.12,1.6,0,.1);for(let i=0;i<4;i++){const a=i*Math.PI/2;for(let j=0;j<4;j++)body.blob('matte',C.khaki,Math.cos(a)*.72+Math.sin(a)*(-.55+j*.37),2.3,Math.sin(a)*.72-Math.cos(a)*(-.55+j*.37),.4,.2,.28,a)}body.box('metal',C.steel,-.7,2.2,-.7,.06,1.0,.06,0,0);body.box('metal',C.steel,.7,2.2,.7,.06,1.0,.06,0,0);body.hip('metal',acc,0,3.15,0,1.9,.4,1.9);body.cyl('paint',0xe9ece6,.55,2.5,.55,.12,.18,8,0,Math.PI/2,0)}
 else if(type==='barracks'){found.box('matte',C.darkConcrete,0,0,0,2.9,.1,2.2,0,.1);body.box('matte',0x7d8a6a,0,.1,0,2.6,1.15,1.6,0,.35);body.box('paint',acc,0,.1,0,2.62,.2,1.62,0,.1);body.prism('metal',C.zinc,0,1.25,0,2.85,.6,1.85);for(const x of [-.85,0,.85])body.box('glass',0x2f4a55,x,.55,.81,.42,.32,.03,0,0);body.box('matte',C.wood,-.42,.1,.81,.34,.72,.03,0,0);for(let i=0;i<5;i++)body.blob('matte',C.khaki,.25+i*.28,.12,1.05,.32,.2,.22,0,.3);body.box('metal',C.steel,1.35,.1,.95,.04,2.2,.04,0,0);body.box('paint',acc,1.52,2.0,.95,.32,.2,.02,0,0)}
 else if(type==='workshop'){found.box('matte',C.darkConcrete,0,0,0,3.2,.1,2.5,0,.1);body.box('matte',0x8a9096,0,.1,-.1,2.9,1.65,2.0,0,.35);body.box('paint',acc,0,1.55,-.1,2.92,.2,2.02,0,0);body.prism('metal',C.zinc,0,1.75,-.1,3.1,.55,2.2);body.box('metal',0x5b6268,-.35,.1,.91,1.5,1.25,.04,0,.2);for(let i=0;i<7;i++)body.box('metal',0x41474c,-.35,.2+i*.16,.94,1.5,.03,.02,0,0);for(const s of [-1,1])body.box('paint',C.hazard,-.35+s*.79,.1,.93,.08,1.25,.02,0,0);body.box('metal',C.hazard,1.25,.1,1.0,.08,1.9,.08,0,0);body.box('metal',C.hazard,1.25,1.95,.55,.08,.08,1.0,0,0);for(let i=0;i<3;i++)body.cyl('paint',[0x2d5a43,C.rust,0x2b4a6b][i],-1.25+i*.28,.1,1.15,.14,.42,10)}
 else if(type==='clinic'){found.box('matte',C.darkConcrete,0,0,0,2.6,.06,2.0,0,.1);body.prism('matte',0xeeeee6,0,0,0,2.3,1.3,1.7);body.box('paint',C.red,0,.55,.86,.16,.5,.03,0,0);body.box('paint',C.red,0,.72,.86,.5,.16,.03,0,0);body.box('paint',C.red,0,1.1,0,.6,.02,.16,0,0);for(let i=0;i<3;i++)body.box('paint',C.white,-1.0+i*.32,0,.95,.26,.24,.3,0,.2);body.box('metal',C.steel,1.1,0,.85,.04,1.9,.04,0,0);body.box('paint',C.white,1.27,1.7,.85,.32,.22,.02,0,0);body.box('paint',C.red,1.27,1.7,.86,.12,.06,.02,0,0)}
 else if(type==='hq'){found.box('matte',C.darkConcrete,0,0,0,4.6,.12,3.8,0,.1);body.box('matte',0x7f8a7a,0,.12,0,3.4,1.25,2.4,0,.35);body.box('matte',0x8d977f,-.4,1.37,-.2,2.2,1.0,1.7,0,.3);body.box('paint',acc,0,.12,0,3.42,.24,2.42,0,.1);body.box('paint',acc,-.4,2.3,-.2,2.22,.12,1.72,0,0);for(const x of [-1.1,-.4,.3,1.0])body.box('glass',0x2f4a55,x,.6,1.21,.42,.36,.03,0,0);for(const x of [-1.1,-.4,.3])body.box('glass',0x2f4a55,x-.15,1.7,.66,.42,.32,.03,0,0);body.box('matte',C.wood,1.25,.12,1.21,.4,.75,.03,0,0);
  for(let i=0;i<12;i++){const a=i/12*TAU;body.blob('matte',C.khaki,Math.cos(a)*2.15,.12,Math.sin(a)*1.8,.55,.32,.32,-a,.3)}body.box('metal',C.steel,1.2,1.37,-.7,.08,2.6,.08,0,0);body.box('metal',C.steel,1.2,3.6,-.7,.6,.04,.04,0,0);body.add('paint',G.cone(14),0xe9ece6,-1.2,2.5,-.65,.7,.12,.7,0,.6,0,0);body.box('metal',C.steel,-1.6,1.37,.8,.05,2.0,.05,0,0);body.box('paint',acc,-1.42,3.1,.8,.38,.24,.02,0,0)}
 else if(type==='camp'){found.box('matte',0x6e5a3e,0,0,0,4.2,.06,3.6,0,.1);for(const [x,z,r] of [[-1,-.6,.2],[.9,-.8,-.3],[0,.9,.1]])body.prism('matte',C.olive,x,0,z,1.6,.95,1.2,r);for(let i=0;i<5;i++)body.cyl('paint',0x4a5a3a,-1.6+i*.35,0,1.5,.16,.44,10);body.box('metal',C.steel,1.6,0,.9,.06,2.4,.06,0,0);body.box('paint',C.crimson,1.8,2.1,.9,.42,.28,.02,0,0);body.box('paint',0x3d3a32,.2,0,-1.7,1.6,.55,.7,0,.2)}
 // Territory War structures. Raider builds swap paint for rust, khaki tarps and scrap.
 const raider=team===1,paint=raider?0x8a5a3b:0x7f8a7a,tarp=raider?C.khaki:C.olive,metal=raider?C.rust:C.zinc;
 if(type==='depot'){found.box('matte',C.darkConcrete,0,0,0,2.7,.08,2.1,0,.1);for(let i=0;i<6;i++)body.box('matte',raider?0x7a5a36:C.plank,-.9+(i%3)*.6,(i>2?.5:0)+.08,-.4,.5,.46,.5,(i%2)*.2,.25);for(let i=0;i<4;i++)body.cyl('paint',[0x2d5a43,C.rust,0x2b4a6b,0x4a5a3a][i],.4+(i%2)*.36,.08,.45+Math.floor(i/2)*.36,.16,.46,10);body.prism('matte',tarp,0,1.1,-.2,2.4,.55,1.6);for(const [x,z] of [[-1.1,-.95],[1.1,-.95],[-1.1,.55],[1.1,.55]])body.box('metal',C.steel,x,.08,z,.06,1.05,.06,0,0);body.box('paint',acc,1.1,.08,.95,.06,1.5,.06,0,0);body.box('paint',acc,1.28,1.4,.95,.34,.22,.02,0,0)}
 else if(type==='collector'){found.box('matte',0x7a6648,0,0,0,2.9,.06,2.3,0,.1);body.cyl('metal',raider?C.rust:0xb7b9ba,-.75,.06,-.3,.6,1.9,14);body.cone('metal',metal,-.75,1.96,-.3,.64,.4,14);body.box('metal',C.steel,.1,.06,.2,.9,.9,.8,0,.3);const belt=body.box('matte',C.black,.75,.7,.2,1.3,.08,.3,0,0);body.box('metal',C.hazard,.75,.06,.55,.08,.75,.08,0,0);for(let i=0;i<5;i++)body.rock('matte',raider?C.laterite:C.granite,.9+(i%3)*.25,.06,-.55+Math.floor(i/3)*.3,.42,.28,.38);body.box('paint',acc,.1,.96,.2,.92,.08,.82,0,0)}
 else if(type==='comms'){found.box('matte',C.darkConcrete,0,0,0,2.6,.08,2.0,0,.1);body.box('matte',paint,-.3,.08,0,1.7,1.0,1.4,0,.35);body.box('paint',acc,-.3,.08,0,1.72,.18,1.42,0,.1);body.hip('metal',metal,-.3,1.08,0,1.9,.35,1.6);for(let y=0;y<4;y++)for(const [x,z] of [[.8,-.35],[1.15,-.35],[.8,0],[1.15,0]])body.box('metal',C.steel,x,.08+y*.85,z,.05,.86,.05,0,0);for(let y=1;y<5;y++)body.box('metal',C.steel,.98,y*.85,-.18,.4,.04,.4,0,0);body.add('paint',G.cone(14),0xe9ece6,.98,3.55,-.18,.8,.18,.8,0,.9,0,0);body.box('glow',0xff3a2a,.98,3.82,-.18,.08,.08,.08,0,0);for(const x of [-.75,-.15])body.box('glass',0x2f4a55,x,.45,.71,.36,.3,.03,0,0)}
 else if(type==='guardpost'){found.box('matte',C.darkConcrete,0,0,0,1.4,.05,1.4,0,.1);for(let i=0;i<10;i++){const a=i/10*TAU;if(i===7)continue;body.blob('matte',C.khaki,Math.cos(a)*.6,.08,Math.sin(a)*.6,.4,.24,.26,-a,.3);body.blob('matte',C.khaki,Math.cos(a)*.6,.28,Math.sin(a)*.6,.36,.2,.24,-a,.3)}for(const [x,z] of [[-.4,-.4],[.4,-.4],[-.4,.4],[.4,.4]])body.box('metal',C.steel,x,.05,z,.06,1.25,.06,0,0);body.hip('metal',metal,0,1.3,0,1.15,.25,1.15)}
 else if(type==='bunker'){found.box('matte',C.darkConcrete,0,0,0,2.0,.06,1.8,0,.1);body.box('matte',raider?0x8e7a5c:C.concrete,0,.06,0,1.6,.75,1.4,0,.4);body.box('matte',raider?0x7a6a50:0x8f8c80,0,.81,0,1.75,.16,1.55,0,.2);body.box('matte',C.black,.0,.42,.71,1.1,.12,.02,0,0);for(let i=0;i<8;i++)body.blob('matte',C.khaki,-.85+i*.24,.06,.92,.34,.22,.26,0,.3);body.box('paint',acc,-.6,.97,-.5,.3,.04,.3,0,0)}
 else if(type==='emplacement'){found.box('matte',C.darkConcrete,0,0,0,2.0,.05,2.0,0,.1);for(let i=0;i<14;i++){const a=i/14*TAU;for(let r=0;r<2;r++)body.blob('matte',C.khaki,Math.cos(a)*.85,.08+r*.2,Math.sin(a)*.85,.4,.22,.28,-a,.3)}body.cyl('metal',C.steelDark,0,.05,0,.35,.3,12);for(let i=0;i<4;i++)body.box('matte',raider?0x7a5a36:C.plank,-.6+i*.18,.05,-.55,.14,.22,.3,0,.2)}
 else if(type==='shelter'){found.box('matte',C.darkConcrete,0,0,0,2.3,.06,1.8,0,.1);body.add('matte',G.cyl(14,1),C.concrete,0,.06,0,1.9,1.9,1.5,0,0,Math.PI/2,.2);body.box('matte',C.darkConcrete,0,.06,-.75,1.9,.08,.02,0,0);body.box('paint',0x2d5a43,0,.06,.76,.5,.68,.03,0,0);body.box('paint',C.white,0,.95,.77,.9,.26,.02,0,0);body.box('paint',0x2d7a4a,-.3,.98,.78,.12,.18,.02,0,0);body.box('paint',0x2d7a4a,.3,.98,.78,.12,.18,.02,0,0);for(let i=0;i<6;i++)body.blob('matte',C.khaki,-.95+i*.38,.06,1.05,.36,.2,.24,0,.3)}
 else if(type==='factory'){found.box('matte',C.darkConcrete,0,0,0,3.6,.1,2.9,0,.1);body.box('matte',paint,0,.1,-.1,3.2,1.75,2.3,0,.35);for(let i=0;i<4;i++)body.prism('metal',metal,-1.2+i*.8,1.85,-.1,.8,.45,2.35,Math.PI/2);body.box('paint',acc,0,1.65,-.1,3.22,.18,2.32,0,0);body.box('metal',0x41474c,-.5,.1,1.06,1.6,1.3,.04,0,.2);for(let i=0;i<8;i++)body.box('metal',0x2f3438,-.5,.18+i*.15,1.09,1.6,.03,.02,0,0);for(const s of [-1,1])body.box('paint',C.hazard,-.5+s*.84,.1,1.08,.08,1.3,.02,0,0);body.box('metal',C.hazard,1.45,.1,1.15,.1,2.4,.1,0,0);body.box('metal',C.hazard,1.0,2.45,1.15,1.0,.1,.1,0,0);body.cyl('metal',C.steelDark,.6,1.9,1.15,.03,.55,6);body.box('metal',C.steel,.6,1.35,1.15,.2,.12,.2,0,0)}
 const scaffold=new Kit(5);if(type!=='barricade'){const w=type==='workshop'?1.6:type==='hq'?2.2:type==='factory'?1.9:['guardpost','emplacement'].includes(type)?.8:1.3,d=type==='workshop'?1.3:type==='factory'?1.5:['guardpost','emplacement'].includes(type)?.8:1.1;for(const [x,z] of [[-w,-d],[w,-d],[-w,d],[w,d]])scaffold.box('metal',C.hazard,x,0,z,.07,2.0,.07,0,0);for(const y of [.7,1.4])for(const s of [-1,1]){scaffold.box('matte',C.plank,0,y,s*d,w*2,.05,.18,0,0);scaffold.box('matte',C.plank,s*w,y,0,.18,.05,d*2,0,0)}}
 return {foundation:found.build({shadows:false,shared:true}),body:body.build({shadows:true,shared:true}),scaffold:scaffold.build({shadows:false,shared:true})}}

// ---------- Ground painting ----------
const groundCache=new Map();
export function paintGround(size=2048){
 const cacheKey=size+':'+(theatreId||'')+':'+layoutId;if(groundCache.has(cacheKey))return groundCache.get(cacheKey);
 const L=layout(),cw=size,ch=Math.round(size*.5625),c=document.createElement('canvas');c.width=cw;c.height=ch;const x=c.getContext('2d'),rng=rngFrom(0x7a11),margin=.1,
  sx=v=>(v/W+margin)/(1+margin*2)*cw,sy=v=>(v/H+margin)/(1+margin*2)*ch,sc=cw/(W*(1+margin*2));
 const T0=look(),dry=T0.dry||0;
 // Base layer: two octaves of value noise blend lush grass, dry grass, bare soil and laterite into the
 // high-contrast patchwork of a strategy map, keyed to the theatre (Jos green, Maiduguri sandy).
 {const nw=320,nh=180,low=document.createElement('canvas');low.width=nw;low.height=nh;const lx=low.getContext('2d'),img=lx.createImageData(nw,nh),grid=(g,seed)=>{const r=rngFrom(seed),v=new Float32Array((g+1)*(g+1));for(let i=0;i<v.length;i++)v[i]=r();return (u,w)=>{const gx=u*g,gy=w*g,ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),at=(a,b)=>v[Math.min(g,b)*(g+1)+Math.min(g,a)];return (at(ix,iy)*(1-sx)+at(ix+1,iy)*sx)*(1-sy)+(at(ix,iy+1)*(1-sx)+at(ix+1,iy+1)*sx)*sy}};
  const n1=grid(9,0x51),n2=grid(23,0x93),n3=grid(57,0x17),m1=grid(13,0xa4);const soil=new THREE.Color(T0.soil),hexRGB=h=>[(h>>16)&255,(h>>8)&255,h&255],lush=hexRGB(0x5d8a2c),grassy=hexRGB(0x7f9a3a),straw=hexRGB(0xa9a457),earth=[Math.round(soil.r*255*1.08),Math.round(soil.g*255*1.02),Math.round(soil.b*255*.9)],red=hexRGB(0xab6a3c);
  const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t],band=(v,a,b)=>Math.max(0,Math.min(1,(v-a)/(b-a)));
  for(let j=0;j<nh;j++)for(let i=0;i<nw;i++){const u=i/nw,w=j/nh,h=n1(u,w)*.55+n2(u,w)*.3+n3(u,w)*.15,m=m1(u,w);let col=mix(lush,grassy,band(h,.32,.5));col=mix(col,straw,band(h,.48+.12*(1-dry),.6+.1*(1-dry))*(.55+dry*.45));col=mix(col,earth,band(h,.6-dry*.22,.74-dry*.2));col=mix(col,red,band(m,.72,.9)*.55);const k=(j*nw+i)*4,shade=.92+n3(u*1.7,w*1.7)*.16;img.data[k]=col[0]*shade;img.data[k+1]=col[1]*shade;img.data[k+2]=col[2]*shade;img.data[k+3]=255}
  lx.putImageData(img,0,0);x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(low,0,0,cw,ch)}
 const blob=(px,py,r,col,a)=>{const g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,col.replace('A',a));g.addColorStop(1,col.replace('A',0));x.fillStyle=g;x.beginPath();x.arc(px,py,r,0,TAU);x.fill()};
 for(let i=0;i<Math.round(140*dry);i++){const px=rng()*cw,py=rng()*ch,r=(12+rng()*40)*sc*3;blob(px,py,r,rng()<.6?'rgba(96,104,48,A)':'rgba(120,84,50,A)',.25+rng()*.2)}
 for(let i=0;i<260;i++){const px=rng()*cw,py=rng()*ch,r=(30+rng()*120)*sc*3;const t=rng();blob(px,py,r,t<.5?'rgba(70,104,40,A)':t<.8?'rgba(150,140,80,A)':'rgba(150,96,58,A)',.12+rng()*.12)}
 const T=look();for(const f of L.forests)for(let i=0;i<Math.round(40*Math.min(1,T.trees));i++){const a=rng()*TAU,r=Math.sqrt(rng())*f.r;blob(sx(f.x+Math.cos(a)*r),sy(f.y+Math.sin(a)*r),(40+rng()*50)*sc,'rgba(64,92,44,A)',.35)}
 // Theatre soil: Sahel sand drifts over the north-east, red laterite in Kano, green on the plateau.
 if(theatreLook){for(let i=0;i<Math.round(160*T.dry);i++){const px=rng()*cw,py=rng()*ch,r=(60+rng()*180)*sc*3;blob(px,py,r,rng()<.5?'rgba(214,180,126,A)':'rgba(196,158,104,A)',.1+rng()*.14)}}
 const rect=(cx,cy,w,d,rot,fill,blur=0)=>{x.save();x.translate(sx(cx),sy(cy));x.rotate(rot||0);x.shadowColor=fill;x.shadowBlur=blur*sc;x.fillStyle=fill;x.fillRect(-w*sc/2,-d*sc/2,w*sc,d*sc);x.restore()};
 for(const pad of L.pads||[{x:330,y:640,r:330,c:'rgba(150,128,96,A)'},{x:250,y:680,r:150,c:'rgba(124,118,108,A)'}])blob(sx(pad.x),sy(pad.y),pad.r*sc,pad.c,pad.r>200?.45:.7);
 for(const c of L.compounds)rect(c.x,c.y,c.w+24,c.d+24,c.rot,'rgba(196,164,118,.95)',18);
 rect(L.market.x,L.market.y,L.market.w+120,L.market.d+140,0,'rgba(150,112,76,.9)',30);
 for(const [fx,fy,r] of L.facilities?L.facilities.map(f=>[f.x,f.y,f.outpost?80:95]):[[790,480,95],[1040,900,95],[560,830,100],[1260,430,100]])blob(sx(fx),sy(fy),r*sc*1.5,'rgba(186,156,112,A)',.95);
 if(!L.pads)blob(sx(2150),sy(675),300*sc,'rgba(132,100,70,A)',.75);
 // Territory War: tinted borders and concrete construction plots painted into the ground.
 if(L.territories){for(const t of L.territories){const edge=t.team===0?t.x2:t.x1,g=x.createLinearGradient(sx(edge-(t.team===0?60:-60)),0,sx(edge),0);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,t.team===0?'rgba(70,170,210,.35)':'rgba(200,80,60,.35)');x.fillStyle=g;x.fillRect(Math.min(sx(edge-60),sx(edge+60)),sy(t.y1),Math.abs(sx(edge+60)-sx(edge-60))/2,sy(t.y2)-sy(t.y1));x.setLineDash([22*sc,14*sc]);x.strokeStyle=t.team===0?'rgba(120,220,240,.65)':'rgba(255,150,120,.65)';x.lineWidth=Math.max(1,5*sc);x.beginPath();x.moveTo(sx(edge),sy(t.y1));x.lineTo(sx(edge),sy(t.y2));x.stroke();x.setLineDash([])}
  for(const plot of L.plots){rect(plot.x,plot.y,plot.r*1.8,plot.r*1.8,0,plot.kind==='resource'?'rgba(170,130,80,.95)':'rgba(150,146,134,.95)',8);x.strokeStyle=plot.team===0?'rgba(110,210,235,.9)':plot.team===1?'rgba(240,140,110,.9)':'rgba(255,208,107,.9)';x.lineWidth=Math.max(1,4*sc);x.strokeRect(sx(plot.x-plot.r*.9),sy(plot.y-plot.r*.9),plot.r*1.8*sc,plot.r*1.8*sc);for(const [cx,cy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){x.fillStyle=x.strokeStyle;x.fillRect(sx(plot.x+cx*plot.r*.9)-3*sc,sy(plot.y+cy*plot.r*.9)-3*sc,6*sc,6*sc)}}}
 const f=L.field;if(f&&!f.skip){rect(f.x,f.y,f.w+20,f.d+20,0,'#6f8a3e',6);x.strokeStyle='rgba(240,240,230,.85)';x.lineWidth=Math.max(1,3*sc);x.strokeRect(sx(f.x-f.w/2),sy(f.y-f.d/2),f.w*sc,f.d*sc);x.beginPath();x.moveTo(sx(f.x),sy(f.y-f.d/2));x.lineTo(sx(f.x),sy(f.y+f.d/2));x.stroke();x.beginPath();x.arc(sx(f.x),sy(f.y),18*sc,0,TAU);x.stroke()}
 const stroke=(road,width,col,dash)=>{x.beginPath();road.points.forEach(([px,py],i)=>i?x.lineTo(sx(px),sy(py)):x.moveTo(sx(px),sy(py)));x.lineWidth=width*sc;x.strokeStyle=col;x.lineCap='round';x.lineJoin='round';x.setLineDash(dash?dash.map(v=>v*sc):[]);x.stroke();x.setLineDash([])};
 for(const r of L.roads.filter(r=>r.surface==='laterite')){stroke(r,r.width+22,'rgba(150,78,44,.55)');stroke(r,r.width,'#a85a33');stroke(r,r.width*.18,'rgba(110,52,30,.55)',[40,18])}
 for(const r of L.roads.filter(r=>r.surface==='asphalt')){stroke(r,r.width+30,'rgba(90,84,74,.7)');stroke(r,r.width+10,'#4a4844');stroke(r,r.width,'#3d3f41');for(const s of [-.24,.24]){const lane={points:r.points.map(([px,py],i)=>{const n=r.points[i+1]||r.points[i-1],k=r.points[i+1]?1:-1,dx=(n[0]-px)*k,dy=(n[1]-py)*k,len=Math.hypot(dx,dy)||1;return [px-dy/len*r.width*s,py+dx/len*r.width*s]})};stroke(lane,r.width*.16,'rgba(34,35,37,.55)')}}
 for(const r of L.roads.filter(r=>r.surface==='asphalt')){for(const s of [-1,1]){x.save();x.beginPath();r.points.forEach(([px,py],i)=>{const n=r.points[i+1]||r.points[i-1],dx=(n[0]-px)*(r.points[i+1]?1:-1),dy=(n[1]-py)*(r.points[i+1]?1:-1),len=Math.hypot(dx,dy)||1,ox=-dy/len*r.width*.43*s,oy=dx/len*r.width*.43*s;i?x.lineTo(sx(px+ox),sy(py+oy)):x.moveTo(sx(px+ox),sy(py+oy))});x.strokeStyle='rgba(236,232,220,.7)';x.lineWidth=Math.max(1,2.4*sc);x.stroke();x.restore()}
  stroke(r,3.4,r.evacuation?'rgba(80,220,140,.95)':'rgba(242,190,50,.95)',[34,26])}
 const evac=L.roads.find(r=>r.evacuation)||{points:[]};for(let i=0;i<evac.points.length-1;i++){const [ax,ay]=evac.points[i],[bx,by]=evac.points[i+1],len=Math.hypot(bx-ax,by-ay),a=Math.atan2(by-ay,bx-ax);for(let t=70;t<len;t+=150){x.save();x.translate(sx(ax+(bx-ax)*t/len),sy(ay+(by-ay)*t/len));x.rotate(a);x.fillStyle='rgba(90,230,150,.85)';x.beginPath();x.moveTo(14*sc,0);x.lineTo(-8*sc,-13*sc);x.lineTo(-2*sc,0);x.lineTo(-8*sc,13*sc);x.closePath();x.fill();x.restore()}}
 if(!L.territories)blob(sx(L.evacuationPoint.x),sy(L.evacuationPoint.y),90*sc,'rgba(90,220,150,A)',.35);
 // Tyre tracks on the laterite roads, then grass blades, pebbles and cracked earth for close-up detail.
 for(const r of L.roads.filter(r=>r.surface==='laterite'))for(const off of [-.22,.22]){const lane={points:r.points.map(([px,py],i)=>{const n=r.points[i+1]||r.points[i-1],k=r.points[i+1]?1:-1,dx=(n[0]-px)*k,dy=(n[1]-py)*k,len=Math.hypot(dx,dy)||1;return [px-dy/len*r.width*off,py+dx/len*r.width*off]})};stroke(lane,r.width*.1,'rgba(92,44,24,.45)',[26,6,10,4])}
 for(let i=0;i<Math.round(cw*ch/90);i++){const px=rng()*cw,py=rng()*ch,t=rng();if(t<.62){x.strokeStyle=t<.3?'rgba(58,92,30,.35)':t<.5?'rgba(120,142,58,.32)':'rgba(176,170,96,.28)';x.lineWidth=1;x.beginPath();x.moveTo(px,py);x.lineTo(px+(rng()-.5)*3,py-2-rng()*4);x.stroke()}else if(t<.9){x.fillStyle=rng()<.5?'rgba(60,54,40,.28)':'rgba(230,214,170,.24)';x.fillRect(px,py,1+rng()*2,1+rng()*1.5)}else{x.strokeStyle='rgba(90,64,40,.18)';x.lineWidth=1;x.beginPath();x.moveTo(px,py);for(let s=0;s<3;s++)x.lineTo(px+(rng()-.5)*14,py+(rng()-.5)*10);x.stroke()}}
 const data=x.getImageData(0,0,cw,ch),p=data.data;for(let i=0;i<p.length;i+=4){const n=(rng()-.5)*22;p[i]+=n;p[i+1]+=n;p[i+2]+=n*.8}x.putImageData(data,0,0);
 const fade=(x0,y0,x1,y1)=>{const g=x.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,'rgba(124,132,76,1)');g.addColorStop(1,'rgba(124,132,76,0)');x.fillStyle=g;x.fillRect(Math.min(x0,x1),Math.min(y0,y1),Math.abs(x1-x0)||cw,Math.abs(y1-y0)||ch)},mx=cw*margin/(1+margin*2)*.9,my=ch*margin/(1+margin*2)*.9;fade(0,0,mx,0);fade(cw,0,cw-mx,0);fade(0,0,0,my);fade(0,ch,0,ch-my);
 const result={canvas:c,width:(W*(1+margin*2))/S,depth:(H*(1+margin*2))/S};groundCache.set(cacheKey,result);return result}

export function groundMesh(size=2048,anisotropy=8){
 const painted=paintGround(size),texture=new THREE.CanvasTexture(painted.canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=anisotropy;
 const detail=detailTexture();const material=new THREE.MeshStandardMaterial({map:texture,bumpMap:detail,bumpScale:.6,roughness:.95,metalness:0}),mesh=new THREE.Mesh(new THREE.PlaneGeometry(painted.width,painted.depth),material);
 // Close-up detail: the painted map is ~25 texels per metre, so a tiled grain at two scales is multiplied
 // into the colour; up close the ground stays crisp instead of turning into a soft smear.
 const grain=grainTexture();material.customProgramCacheKey=()=>'homestand-ground-grain';
 material.onBeforeCompile=shader=>{shader.uniforms.grainMap={value:grain};shader.fragmentShader=shader.fragmentShader.replace('void main() {','uniform sampler2D grainMap;\nvoid main() {').replace('#include <map_fragment>','#include <map_fragment>\n{vec2 gu=vMapUv*vec2(96.,54.);float g=texture2D(grainMap,gu).r;float h=texture2D(grainMap,gu*.27+vec2(.37,.11)).g;diffuseColor.rgb*=mix(1.,g*1.1+h*.9,.34);}')};
 mesh.rotation.x=-Math.PI/2;mesh.position.y=-.04;mesh.receiveShadow=true;mesh.userData.townGround=true;return mesh}
function grainTexture(){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d'),rng=rngFrom(57);x.fillStyle='rgb(128,128,128)';x.fillRect(0,0,256,256);
 for(let i=0;i<900;i++){const r=2+rng()*9,v=80+Math.floor(rng()*96),g=x.createRadialGradient(0,0,0,0,0,r);  const px=rng()*256,py=rng()*256;g.addColorStop(0,`rgba(${v},${v+Math.floor(rng()*30-15)},${v},.55)`);g.addColorStop(1,'rgba(128,128,128,0)');for(const dx of [-256,0,256])for(const dy of [-256,0,256]){x.save();x.translate(px+dx,py+dy);x.fillStyle=g;x.fillRect(-r,-r,r*2,r*2);x.restore()}}
 for(let i=0;i<5200;i++){const v=70+Math.floor(rng()*120);x.fillStyle=`rgba(${v},${v},${v},.5)`;x.fillRect(rng()*256,rng()*256,1+rng()*2,1+rng()*1.5)}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;return t}
function detailTexture(){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d'),rng=rngFrom(91);x.fillStyle='#808080';x.fillRect(0,0,256,256);for(let i=0;i<2600;i++){const v=90+Math.floor(rng()*90);x.fillStyle=`rgb(${v},${v},${v})`;x.fillRect(rng()*256,rng()*256,1+rng()*3,1+rng()*2)}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(36,20);return t}

// ---------- People and traffic (homepage and evacuation) ----------
export function crowd(count,seed=3){
 const rng=rngFrom(seed),bodies=new THREE.InstancedMesh(new THREE.CapsuleGeometry(.11,.3,3,6).translate(0,.27,0),new THREE.MeshStandardMaterial({roughness:.8}),count),heads=new THREE.InstancedMesh(new THREE.SphereGeometry(.09,8,6).translate(0,.6,0),new THREE.MeshStandardMaterial({roughness:.7}),count),col=new THREE.Color();
 for(let i=0;i<count;i++){bodies.setColorAt(i,col.setHex(CLOTH[Math.floor(rng()*CLOTH.length)]));heads.setColorAt(i,col.setHex([0x4a2c1d,0x5c3824,0x3b2418,0x6b4129][i%4]))}
 bodies.castShadow=false;return {bodies,heads,count,rng}}
export function vehicleTemplate(kind,color){const k=new Kit(kind.length+(color||0));const build=()=>k.build({shadows:false,shared:true});if(kind==='danfo')danfo(k,0,0);else if(kind==='keke')keke(k,0,0);else if(kind==='patrol')patrolTruck(k);else if(kind==='engineer')engineerRig(k);else if(kind==='truck')supplyTruck(k);else car(k,0,0,color||C.white);return build()}
export function patrolTruck(k){k.box('paint',C.azure,0,.25,0,1.6,.55,.82,0,.25);k.box('paint',C.azureDark,-.5,.8,0,.55,.4,.78,0,.15);k.box('glass',0x2c3c46,-.2,.86,0,.04,.24,.66,0,0);k.box('paint',C.azure,.35,.8,0,.75,.32,.8,0,.2);k.cyl('metal',C.steel,.35,1.12,0,.22,.16,10);k.cyl('metal',C.steel,.62,1.2,0,.04,.55,6,0,0,Math.PI/2);for(const [a,b] of [[-.52,-.42],[.52,-.42],[-.52,.42],[.52,.42]])k.cyl('matte',C.black,a,.22,b,.22,.16,12,0,Math.PI/2,0);k.box('glow',0xbfeaff,-.82,.42,.28,.03,.08,.12);k.box('glow',0xbfeaff,-.82,.42,-.28,.03,.08,.12)}
export function engineerRig(k){k.box('paint',C.hazard,0,.2,0,1.4,.45,.8,0,.25);k.box('paint',0x3a3a34,-.15,.65,0,.6,.45,.62,0,.15);k.box('glass',0x2c3c46,-.15,.8,0,.62,.2,.5,0,0);k.box('metal',C.steel,-.95,.08,0,.16,.42,1.0,0,.2);k.add('paint',G.box(),C.hazard,.3,.95,0,1.2,.12,.12,0,0,0,.45,.05);for(const z of [-.4,.4])k.box('matte',C.black,0,.04,z,1.25,.32,.2,0,.2)}
export function supplyTruck(k){k.box('paint',0xe8e2d4,-.62,.2,0,.5,.62,.74,0,.2);k.box('glass',0x2c3c46,-.88,.52,0,.03,.22,.6,0,0);k.box('paint',C.azure,.28,.25,0,1.25,.68,.8,0,.2);k.box('paint',C.white,.28,.62,.41,.5,.2,.01,0,0);for(const [a,b] of [[-.6,-.36],[.1,-.36],[.6,-.36],[-.6,.36],[.1,.36],[.6,.36]])k.cyl('matte',C.black,a,.16,b,.16,.12,10,0,Math.PI/2,0)}

// ---------- Theatres: real-city character on the shared street plan ----------
let theatreId=null,theatreLook=null;
export function setTheatre(id){theatreId=MAPS.theatres?.[id]?id:null;theatreLook=theatreId?MAPS.theatre(theatreId):null;return theatreLook}
export const currentTheatre=()=>theatreLook;
const look=()=>theatreLook?.look||{soil:'#7c844c',dust:.1,trees:1,dry:0,haze:0};
const hex=v=>parseInt(String(v).replace('#',''),16);
// Terraced escarpment: stacked rock shelves with grassy tops, the layered relief that frames an
// Art of War-style battlefield. Built from a handful of merged prisms, so it costs few draw calls.
function terrace(k,x,z,r,levels,dry){const rocks=dry>.4?[0xb08a5a,0x9a7a52,0xc49a64]:[0x8c8170,0x7a7062,0x9a8e7c],tops=dry>.4?[0xb9a35c,0xa89650]:[0x5f8a2e,0x6f9234];let y=-.2;for(let i=0;i<levels;i++){const rr=r*(1-i*.22),h=.9+k.rng()*.7,n=7+Math.floor(k.rng()*4);k.cyl('matte',rocks[i%3],x+(k.rng()-.5)*.6,y,z+(k.rng()-.5)*.6,rr,h,n,k.rng()*TAU,0,0,.92);k.cyl('matte',tops[i%2],x,y+h,z,rr*.9,.12,n,k.rng()*TAU);y+=h}for(let i=0;i<6;i++){const a=k.rng()*TAU;k.rock('matte',rocks[i%3],x+Math.cos(a)*r*1.05,0,z+Math.sin(a)*r*.95,.8+k.rng(),.5+k.rng()*.5,.8+k.rng(),k.rng()*TAU)}return y}
function clutter(k,x,z,s=1){const t=k.rng();if(t<.3){for(let i=0;i<3;i++)k.cyl('paint',[0x2d5a43,C.rust,0x2b4a6b,0x4a5a3a][Math.floor(k.rng()*4)],x+(i%2)*.36*s,0,z+(i>1?.36:0)*s,.16*s,.44*s,10)}else if(t<.55){for(let i=0;i<3;i++)k.box('matte',i%2?C.plank:0x7a5a36,x+i*.42*s,i===2?.36*s:0,z,.4*s,.36*s,.4*s,k.rng()*.4,.25)}else if(t<.8){for(let i=0;i<5;i++)k.blob('matte',C.khaki,x+i*.3*s,.1*s,z,.34*s,.2*s,.24*s,0,.3)}else{for(let i=0;i<3;i++)k.cyl('matte',C.black,x,i*.12*s,z,.24*s,.11*s,12,0,0,0,.7)}}
// Flat-topped savanna acacia for the drier northern theatres.
function acacia(k,x,z,s=1){const lean=(k.rng()-.5)*.3;k.cyl('matte',C.trunk,x,0,z,.06*s,1.5*s,6,0,lean,0,.6);k.blob('matte',k.rng()<.5?0x6f7a3a:0x7d8240,x+lean*.8*s,1.6*s,z,2.1*s,.42*s,1.7*s,k.rng()*TAU,.3);k.blob('matte',0x5f6a33,x+lean*.8*s,1.48*s,z,1.5*s,.3*s,1.2*s,k.rng()*TAU,.3)}
function boulderStack(k,x,z,s=1){const n=2+Math.floor(k.rng()*3);let y=0;for(let i=0;i<n;i++){const w=(2.2-i*.45)*s*(.8+k.rng()*.4),h=w*.72;k.rock('matte',i%2?0x8d8478:C.granite,x+(k.rng()-.5)*.5*s,y+h*.42,z+(k.rng()-.5)*.5*s,w,h,w*.9,k.rng()*TAU);y+=h*.78}}
function dune(k,x,z,w,d){k.blob('matte',k.rng()<.5?0xd2b07a:0xc9a26c,x,-w*.12,z,w,w*.32,d,k.rng()*TAU,.18)}
function waterTower(k,x,z,col=C.white){for(const [a,b] of [[-.6,-.6],[.6,-.6],[-.6,.6],[.6,.6]])k.box('metal',C.steel,x+a,0,z+b,.12,4.2,.12,0,0);k.cyl('paint',col,x,4.2,z,1.15,1.5,14);k.cone('metal',C.zinc,x,5.7,z,1.2,.5,14)}
const LANDMARKS={
 inselberg(k){k.rock('matte',C.granite,24,-3.5,-35,30,19,15,.4);k.rock('matte',0x958a80,-6,-3,-37,22,14,12,1.2);k.rock('matte',0x8a8076,42,-2,-27,14,22,12,.1);for(let i=0;i<14;i++){const x=-30+k.rng()*70,z=-28-k.rng()*6;if(k.rng()<.6)mango(k,x,z,1.1+k.rng()*.6);else neem(k,x,z,1.2)}},
 river(k){for(let x=-62;x<62;x+=4){k.box('paint',0x3d7f8c,x+2,-.02,-26.4,4.2,.06,4.4,0,0,0);k.box('matte',0x6d6a45,x+2,-.04,-24,4.2,.08,1,0,0,0)}const bx=toX(940);k.box('matte',C.concrete,bx,.5,-26.4,3.2,.25,6.6,0,.15);for(const s of [-1,1]){k.box('paint',C.white,bx+s*1.5,.75,-26.4,.12,.4,6.6,0,0);for(const zz of [-28,-24.8])k.box('matte',C.darkConcrete,bx+s*1.2,-.2,zz,.5,.8,.5,0,.2)}for(let i=0;i<40;i++){const x=-55+k.rng()*110;grass(k,x,-23.6-k.rng()*.6,1.3)}},
 boulders(k){for(const [x,z,s] of [[-30,-27,1.6],[-14,-30,1.2],[6,-29,1.8],[26,-31,1.4],[44,-24,1.7],[-44,-14,1.3],[46,14,1.4],[-46,16,1.2],[20,28,1.1]])boulderStack(k,x,z,s);for(let i=0;i<6;i++){const x=-20+i*9,z=-33-k.rng()*3;k.rock('matte',0x7e776c,x,-1,z,9+k.rng()*5,6+k.rng()*3,6,k.rng()*TAU)}k.cyl('paint',0x4e7d7a,-38,-.05,-21,2.6,.08,18)},
 citywall(k){const z=-24.6,gate=toX(940);for(let x=-46;x<46;x+=2.2){if(Math.abs(x-gate)<2.4)continue;k.box('matte',0xb07a4c,x,0,z,2.3,2.3,1.3,0,.25);k.blob('matte',0xa8703f,x,2.2,z,1.2,.55,1.2,0,.2)}for(const s of [-1,1]){k.cyl('matte',0xa8703f,gate+s*2.4,0,z,1.1,3.6,10);k.cone('matte',0x99653a,gate+s*2.4,3.6,z,1.15,.9,10)}k.box('matte',0xb07a4c,gate,2.6,z,3.8,1.1,1.4,0,.15);k.box('paint',0x3a6b8c,gate,3.0,z+.71,1.6,.35,.02,0,0);
  for(let i=0;i<9;i++){const x=-36+(i%3)*1.4,zz=-20.4+Math.floor(i/3)*1.4;k.cyl('matte',0x8b6b4a,x,0,zz,.55,.16,12);k.cyl('paint',i%4?0x24305e:0x3b4f8f,x,.09,zz,.42,.09,12)}},
 sahel(k){for(let i=0;i<16;i++){const a=i/16*Math.PI+Math.PI,x=Math.cos(a)*(48+k.rng()*10),z=-26-k.rng()*8;dune(k,x,z,8+k.rng()*8,5+k.rng()*4)}for(let i=0;i<10;i++)dune(k,44+k.rng()*10,-20+i*4.5,6+k.rng()*5,5);waterTower(k,-28,-19,0x3f8f5a);waterTower(k,30,18.5,C.white)},
 trench(k){const x=toX(2368);for(let z=-23;z<23;z+=2){k.box('matte',0x3a2a1d,x,-.3,z+1,1.6,.34,2.05,0,.1);k.box('matte',0xb8925e,x-1.3,0,z+1,.9,.6,2.0,0,.3)}for(let z=-20;z<21;z+=7){for(let i=0;i<5;i++)k.blob('matte',0xa48a5a,x-2.2,.18+(i%2)*.22,z+i*.45,.6,.32,.45,0,.3)}for(let i=0;i<8;i++)acacia(k,x+3+k.rng()*8,-20+k.rng()*40,1.1)}
};
export function theatreLandmark(k){const t=theatreLook;if(!t)return;const build=LANDMARKS[t.landmark];if(build)build(k)}
// Roadside welcome billboard by the west entrance, lettered with the state's real slogan.
export function welcomeSign(text){
 const g=new THREE.Group(),x=toX(112),z=toZ(588),steel=new THREE.MeshStandardMaterial({color:0x4d5a60,roughness:.5,metalness:.55});
 for(const s of [-1,1]){const post=new THREE.Mesh(new THREE.BoxGeometry(.24,3.6,.24),steel);post.position.set(x+s*2.4,1.8,z);post.castShadow=true;g.add(post)}
 const beam=new THREE.Mesh(new THREE.BoxGeometry(5.6,.16,.16),steel);beam.position.set(x,3.0,z-.1);g.add(beam);
 const c=document.createElement('canvas');c.width=1024;c.height=192;const ctx=c.getContext('2d'),grad=ctx.createLinearGradient(0,0,0,192);grad.addColorStop(0,'#0f5a3c');grad.addColorStop(1,'#0a3f2b');ctx.fillStyle=grad;ctx.fillRect(0,0,1024,192);ctx.fillStyle='#f2f2ec';ctx.fillRect(0,0,1024,10);ctx.fillRect(0,182,1024,10);ctx.fillStyle='#ffffff';ctx.textAlign='center';ctx.textBaseline='middle';let size=80;ctx.font='900 '+size+'px Arial Black, Arial, sans-serif';while(ctx.measureText(text).width>820&&size>30){size-=4;ctx.font='900 '+size+'px Arial Black, Arial, sans-serif'}ctx.fillText(text,512,100);
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;const board=new THREE.Mesh(new THREE.PlaneGeometry(5.8,1.09),new THREE.MeshStandardMaterial({map:tex,roughness:.6,side:THREE.DoubleSide}));board.position.set(x,3.0,z+.02);board.rotation.x=-.12;board.castShadow=true;g.add(board);
 g.userData.dispose=()=>{tex.dispose();board.material.dispose();board.geometry.dispose();steel.dispose();g.traverse(o=>{if(o.isMesh&&o!==board)o.geometry.dispose()})};return g}
