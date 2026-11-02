(function(root,factory){
 const value=factory();
 if(typeof module==='object'&&module.exports)module.exports=value;
 else root.IronMaps=value;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const maps={
  coastal:{id:'coastal',name:'Coastal Frontier',tagline:'Tropical command coast',description:'Fight from fortified shores through palms, relay roads, and a deep-water naval frontier.',seed:0x43a91f2d,colors:{ground:'#536348',road:'#4d5150',water:'#0d7086',accent:'#49d5c9',minimap:'#315d48'},atmosphere:{fog:0x718a8b,skyTop:'#183541',skyMid:'#53747a',skyLow:'#d4ae7b',sun:0xffd09a}},
  desert:{id:'desert',name:'Desert Front',tagline:'Canyon strike corridor',description:'Command armored columns between wind-cut mesas, dunes, dusty outposts, and sparse desert scrub.',seed:0xd35e7a11,colors:{ground:'#ad824c',road:'#655341',water:'#8f673d',accent:'#ffbb66',minimap:'#a47745'},atmosphere:{fog:0xc28d5e,skyTop:'#53382f',skyMid:'#c27d55',skyLow:'#f1c98b',sun:0xffbd78}},
  frozen:{id:'frozen',name:'Frozen Territory',tagline:'Glacial relay basin',description:'Advance across snowfields, frozen rivers, black-rock cliffs, winter pines, and isolated polar facilities.',seed:0xf20a6e91,colors:{ground:'#c5d5d7',road:'#58646a',water:'#83c7d8',accent:'#9cecff',minimap:'#a8c8cf'},atmosphere:{fog:0xa9c5ce,skyTop:'#233b55',skyMid:'#6f91a4',skyLow:'#dcecf0',sun:0xd9efff}}
  ,frontier:{id:'frontier',name:'Territory War',tagline:'Two territories, one community',description:'Build up your territory, hold the contested routes and protect or raid the town between the lines.',seed:0x7e3f0a51,colors:{ground:'#8b754f',road:'#b08d59',water:'#4d8b91',accent:'#ffd06b',minimap:'#7d7a4f'},atmosphere:{fog:0xc9a77c,skyTop:'#4a7b8f',skyMid:'#a9c2b4',skyLow:'#ecc58a',sun:0xffd9a0}}
  ,'safe-haven':{id:'safe-haven',name:'Operation Safe Haven',tagline:'Civilian protection mission',description:'Fortify a fictional Nigerian town, protect community facilities, and secure the evacuation road.',seed:0x9a17e2c4,colors:{ground:'#8b754f',road:'#b08d59',water:'#4d8b91',accent:'#49d5c9',minimap:'#7d7a4f'},atmosphere:{fog:0xc9a77c,skyTop:'#4a7b8f',skyMid:'#a9c2b4',skyLow:'#ecc58a',sun:0xffd9a0}}
 };
 // Authored district plan shared by every Safe Haven theatre (originally the composite town of Kachia). World units match the
 // 2400 x 1350 simulation. The renderer, cinematic homepage, minimap and server build
 // validation all read this one plan, so scenery and blocked ground can never disagree.
 const layouts={
  'safe-haven':{
   zones:[
    {id:'base',name:'Response Base',x:430,y:600,r:260},
    {id:'residential',name:'Residential Quarter',x:1250,y:190,r:260},
    {id:'market',name:'Unity Market',x:1060,y:960,r:170},
    {id:'clinic',name:'Clinic Quarter',x:790,y:470,r:130},
    {id:'school',name:'School & Community',x:1360,y:470,r:190},
    {id:'evacuation',name:'Evacuation Corridor',x:1820,y:1060,r:220},
    {id:'staging',name:'Hostile Staging Area',x:2140,y:660,r:240}
   ],
   roads:[
    {id:'highway',surface:'asphalt',width:74,points:[[60,682],[700,680],[1120,676],[1700,672],[2340,668]]},
    {id:'avenue',surface:'asphalt',width:54,points:[[940,150],[940,676],[940,1240]]},
    {id:'evacuation',surface:'asphalt',width:52,evacuation:true,points:[[1120,676],[1400,850],[1780,1030],[2340,1140]]},
    {id:'school-road',surface:'laterite',width:44,points:[[940,330],[1250,330],[1570,320],[1900,250],[2340,232]]},
    {id:'market-street',surface:'laterite',width:42,points:[[560,830],[760,860],[940,880],[1250,930],[1400,850]]},
    {id:'compound-lane',surface:'laterite',width:36,points:[[150,262],[600,250],[825,335],[940,330]]},
    {id:'forest-track',surface:'laterite',width:30,points:[[560,830],[620,960],[650,1050],[520,1240]]},
    {id:'base-track',surface:'laterite',width:36,points:[[250,680],[300,520],[330,262]]}
   ],
   compounds:[
    {x:240,y:178,w:150,d:118,rot:.05,style:0},{x:410,y:168,w:140,d:118,rot:-.04,style:1},{x:575,y:162,w:150,d:112,rot:.02,style:2},
    {x:1060,y:192,w:150,d:118,rot:0,style:3,storeys:2},{x:1215,y:204,w:140,d:112,rot:.06,style:4},{x:1375,y:186,w:150,d:118,rot:-.03,style:5},{x:1740,y:160,w:150,d:116,rot:.04,style:1,storeys:2},
    {x:1090,y:470,w:122,d:100,rot:-.02,style:2},{x:1830,y:470,w:140,d:108,rot:.05,style:0},
    {x:820,y:1064,w:140,d:108,rot:.03,style:4},{x:1180,y:1122,w:150,d:112,rot:.03,style:5},{x:1340,y:1142,w:140,d:112,rot:-.05,style:0,storeys:2},{x:1500,y:1172,w:150,d:106,rot:.02,style:3},{x:1660,y:1190,w:140,d:98,rot:-.03,style:1},
    {x:230,y:962,w:150,d:118,rot:-.03,style:3},{x:242,y:1142,w:150,d:112,rot:.04,style:2},{x:1960,y:1205,w:140,d:96,rot:.02,style:4}
   ],
   market:{x:1070,y:1005,w:250,d:96},
   field:{x:1460,y:540,w:200,d:112},
   checkpoints:[{x:1540,y:674,rot:0},{x:2140,y:1112,rot:.18}],
   staging:{x:2150,y:675,w:230,d:760},
   forests:[{x:430,y:1135,r:190},{x:2160,y:225,r:140},{x:1975,y:880,r:110},{x:150,y:440,r:80},{x:705,y:1240,r:110}],
   evacuationPoint:{x:2200,y:1128}
  }
 };
 // Territory War: two opposing territories joined by a contested landscape. Defence holds
 // the west, the Raiders the east; the community's town sits between them, with two exposed
 // outposts and three routes (north road, central highway, south road) plus a bush track.
 const mirror=list=>list.map(p=>({...p,id:p.id.replace(/^d/,'r'),x:2400-p.x}));
 const defencePlots=[
  {id:'dA',x:440,y:520},{id:'dB',x:440,y:830},{id:'dC',x:250,y:470},{id:'dD',x:250,y:880},{id:'dE',x:300,y:300},
  {id:'dF',x:460,y:330},{id:'dG',x:580,y:420},{id:'dH',x:580,y:930},{id:'dI',x:460,y:1020},{id:'dJ',x:300,y:1050}
 ].map(p=>({...p,team:0,kind:'base',r:55}));
 layouts.frontier={
  territories:[{team:0,name:'Community Defence Territory',x1:125,x2:650,y1:105,y2:1245},{team:1,name:'Raider Territory',x1:1750,x2:2275,y1:105,y2:1245}],
  hq:[{x:290,y:675},{x:2110,y:675}],
  plots:[...defencePlots,...mirror(defencePlots).map(p=>({...p,team:1})),
   {id:'fNW',x:1080,y:360,team:null,kind:'forward',r:55},{id:'fSW',x:1080,y:990,team:null,kind:'forward',r:55},
   {id:'fNE',x:1320,y:360,team:null,kind:'forward',r:55},{id:'fSE',x:1320,y:990,team:null,kind:'forward',r:55},
   {id:'res0',x:560,y:1160,team:0,kind:'resource',r:55,resource:'Brick kiln'},{id:'res1',x:1840,y:190,team:1,kind:'resource',r:55,resource:'Sand pit'},
   {id:'resN',x:1200,y:430,team:null,kind:'resource',r:55,resource:'Grain silos'},{id:'resS',x:1200,y:920,team:null,kind:'resource',r:55,resource:'Fuel depot'}],
  checkpointNodes:[{id:'cpN',x:1200,y:240,name:'NORTH CHECKPOINT',route:'north'},{id:'cpC',x:1200,y:675,name:'CENTRAL JUNCTION',route:'central'},{id:'cpS',x:1200,y:1110,name:'SOUTH CHECKPOINT',route:'south'}],
  // Civilian facilities: four in the town, two exposed outposts. Names come from the theatre.
  facilities:[{id:'facility-clinic',kind:'civilianClinic',x:780,y:450,slot:'clinic'},{id:'facility-school',kind:'community',x:995,y:450,slot:'school'},{id:'facility-market',kind:'market',x:995,y:900,slot:'market'},{id:'facility-centre',kind:'community',x:780,y:900,slot:'centre'},
   {id:'outpost-north',kind:'community',x:1440,y:160,slot:'outpostNorth',outpost:true},{id:'outpost-south',kind:'community',x:960,y:1190,slot:'outpostSouth',outpost:true}],
  // Where an AI places small defences, and where its army gathers before an assault.
  defenceSpots:[[{x:625,y:600},{x:625,y:750},{x:600,y:230},{x:600,y:1120},{x:200,y:600},{x:700,y:560}],[{x:1775,y:600},{x:1775,y:750},{x:1800,y:230},{x:1800,y:1120},{x:2200,y:600},{x:1700,y:790}]],
  rally:[{x:590,y:675},{x:1810,y:675}],
  routes:{north:[{x:680,y:330},{x:1200,y:240},{x:1720,y:330}],central:[{x:900,y:675},{x:1200,y:675},{x:1500,y:675}],south:[{x:680,y:1020},{x:1200,y:1110},{x:1720,y:1020}]},
  zones:[
   {id:'defence',name:'Community Defence Territory',x:390,y:675,r:300},{id:'raiders',name:'Raider Territory',x:2010,y:675,r:300},
   {id:'residential',name:'Town',x:885,y:675,r:240},{id:'outpostNorth',name:'North Outpost',x:1440,y:160,r:120},{id:'outpostSouth',name:'South Outpost',x:960,y:1190,r:120},
   {id:'contested',name:'Contested Ground',x:1200,y:675,r:300}
  ],
  roads:[
   {id:'highway',surface:'asphalt',width:74,points:[[60,675],[700,675],[1200,675],[1700,675],[2340,675]]},
   {id:'avenue',surface:'asphalt',width:48,points:[[885,360],[885,675],[885,990]]},
   {id:'school-road',surface:'laterite',width:44,points:[[650,640],[670,330],[770,250],[1200,240],[1630,250],[1730,330],[1750,640]]},
   {id:'market-street',surface:'laterite',width:44,points:[[650,710],[670,1020],[770,1100],[1200,1110],[1630,1100],[1730,1020],[1750,710]]},
   {id:'compound-lane',surface:'laterite',width:28,points:[[1200,500],[1200,850]]}
  ],
  compounds:[
   {x:780,y:580,w:110,d:80,rot:.03,style:0},{x:995,y:580,w:110,d:80,rot:-.03,style:1,storeys:2},{x:780,y:770,w:110,d:80,rot:.02,style:2},
   {x:1330,y:160,w:96,d:76,rot:-.04,style:3},{x:1555,y:165,w:96,d:76,rot:.05,style:2},
   {x:845,y:1190,w:96,d:76,rot:.03,style:1},{x:1070,y:1190,w:96,d:76,rot:-.05,style:4}
  ],
  market:{x:995,y:775,w:150,d:60},
  field:{x:1080,y:300,w:130,d:76,skip:true},
  checkpoints:[{x:1200,y:675,rot:0},{x:1200,y:240,rot:0},{x:1200,y:1110,rot:0}],
  staging:{x:2010,y:675,w:420,d:1000,sparse:true},
  forests:[{x:180,y:190,r:80},{x:180,y:1160,r:80},{x:2220,y:190,r:80},{x:2220,y:1160,r:80},{x:1080,y:300,r:50},{x:1320,y:1050,r:50},{x:700,y:1225,r:60},{x:1700,y:125,r:60}],
  // Ground clearings (painted bare earth) and areas kept clear of random scatter.
  pads:[{x:290,y:675,r:150,c:'rgba(124,118,108,A)'},{x:2110,y:675,r:150,c:'rgba(120,92,64,A)'},{x:390,y:675,r:320,c:'rgba(150,128,96,A)'},{x:2010,y:675,r:320,c:'rgba(132,100,70,A)'}],
  noScatter:[{x1:125,x2:660,y1:105,y2:1245},{x1:1740,x2:2275,y1:105,y2:1245},{x1:700,x2:1080,y1:360,y2:1000}],
  billboards:[[1330,612,'blue'],[1080,730,'red'],[1500,742,'green']],
  signs:[[860,650],[1225,650],[700,1040],[1225,215],[1225,1085]],
  evacuationPoint:{x:200,y:675}
 };
 // Plot occupancy and the build area are shared by the server (validation) and the
 // client (placement preview) so the two can never disagree.
 const pointInRect=(p,r)=>p.x>=r.x1&&p.x<=r.x2&&p.y>=r.y1&&p.y<=r.y2;
 function territoryOf(layoutId,point){const layout=layouts[layoutId];return layout?.territories?.find(t=>pointInRect(point,t))?.team??null}
 // A team may build in its own territory, around checkpoints it holds, and around its
 // completed structures outside home (forward expansion).
 // Distance from a point to the nearest road centreline, used to keep roads open for traffic.
 function segDist(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.y-a[1])*dy)/l));return Math.hypot(p.x-(a[0]+dx*t),p.y-(a[1]+dy*t))}
 function clearOfRoads(layoutId,point,radius){const layout=layouts[layoutId];for(const road of layout?.roads||[])for(let i=1;i<road.points.length;i++)if(segDist(point,road.points[i-1],road.points[i])<road.width/2+radius*.55)return false;return true}
 function inBuildArea(layoutId,team,point,state={}){
  const layout=layouts[layoutId];if(!layout?.territories)return true;
  if(layout.territories.some(t=>t.team===team&&pointInRect(point,t)))return true;
  if(layout.territories.some(t=>t.team!==team&&pointInRect(point,t)))return false;
  if((state.nodes||[]).some(n=>n.owner===team&&!n.kind&&Math.hypot(n.x-point.x,n.y-point.y)<=260))return true;
  return (state.structures||[]).some(s=>s.team===team&&s.status==='active'&&s.hp>0&&Math.hypot(s.x-point.x,s.y-point.y)<=200);
 }
 function plotStatus(layoutId,plot,team,state={}){
  if(plot.team!==null&&plot.team!==team)return {ok:false,reason:'That plot belongs to the other faction'};
  if((state.structures||[]).some(s=>s.hp>0&&s.plotId===plot.id))return {ok:false,reason:'Plot already built on'};
  if(plot.team===null&&!inBuildArea(layoutId,team,plot,state))return {ok:false,reason:plot.kind==='resource'?'Hold the nearby checkpoint to build here':'Hold a nearby checkpoint to build a forward base'};
  return {ok:true};
 }
 // Circles of authored scenery that construction may not overlap.
 function blockers(id){
  const layout=layouts[id];if(!layout)return [];
  const list=layout.compounds.map(c=>({x:c.x,y:c.y,radius:Math.max(c.w,c.d)*.5}));
  const m=layout.market;list.push({x:m.x-m.w*.25,y:m.y,radius:m.d*.62},{x:m.x+m.w*.25,y:m.y,radius:m.d*.62});
  for(const c of layout.checkpoints)list.push({x:c.x,y:c.y-56,radius:26},{x:c.x,y:c.y+56,radius:26});
  return list;
 }
 const ids=Object.freeze(['coastal','desert','frozen']);
 const get=id=>maps[id]||maps.coastal;
 // Campaign theatres: real Nigerian cities that have lived through insurgent violence.
 // Places, roads and landmarks are real so the town feels like home; the hostile force
 // (the "Black Harmattan") and every scenario are fictional. No mission re-enacts a
 // specific real attack or depicts its victims. The authored Safe Haven street plan is
 // shared; each theatre re-skins it with its own names, light, soil and landmark.
 const theatres={
  abuja:{id:'abuja',order:1,city:'Abuja',state:'FCT',area:'Nyanya · Karu',operation:'Operation Unity Gate',lat:9.03,lon:7.56,
   tagline:'Hold the eastern gateway of the capital',
   briefing:'Black Harmattan cells are moving on the commuter belt east of the capital. Fortify Nyanya before the evening rush and keep the Keffi Expressway open for families heading home.',
   zones:{base:'AYA Response Base',residential:'Nyanya Estate',market:'Nyanya Motor Park',clinic:'Hospital Quarter',school:'Karu School Road',evacuation:'Abuja–Keffi Expressway',staging:'Eastern Ridge'},
   facilities:{clinic:'Nyanya General Hospital',market:'Nyanya Motor Park',centre:'Karu Town Hall',school:'Nyanya Community School'},
   nodes:['AYA JUNCTION','NYANYA FLYOVER','KEFFI EXPRESSWAY','KUGBO DEPOT','KARU HILLTOP'],
   roads:{highway:'Abuja–Keffi Expressway',avenue:'Nyanya Main Road',evacuation:'Karu Bridge Road','school-road':'Karu Site Road','market-street':'Motor Park Lane'},
   landmark:'inselberg',sign:'WELCOME TO NYANYA',
   look:{soil:'#7d8a4a',dust:.12,trees:1,dry:.15,haze:0},
   atmosphere:{fog:0xbfae8c,density:.0074,skyTop:'#3f7290',skyMid:'#a5c3c0',skyLow:'#f0cf98',sun:0xffd9a0},
   threat:{waves:1,ied:.35,sweepers:false},
   radio:['Abeg, make una hold AYA junction well well!','Danfo don clear di expressway — road free for now.','Scanner team, check di road before di convoy pass!']},
  kaduna:{id:'kaduna',order:2,city:'Kaduna',state:'Kaduna',area:'Kawo · Ungwan Rimi',operation:'Operation Crocodile Shield',lat:10.55,lon:7.44,
   tagline:'Defend the river city of the crocodiles',
   briefing:'Raiders are probing Kaduna North across the river flats. Guard Kawo, keep Barau Dikko hospital running and hold the Ahmadu Bello Way corridor for evacuation.',
   zones:{base:'Kawo Response Base',residential:'Ungwan Rimi',market:'Kawo Market',clinic:'Hospital Quarter',school:'Malali School Road',evacuation:'Ahmadu Bello Way',staging:'River Flats'},
   facilities:{clinic:'Barau Dikko Hospital',market:'Kawo Market',centre:'Murtala Square',school:'Malali Community School'},
   nodes:['KAWO ROUNDABOUT','LUGARD HALL JUNCTION','AHMADU BELLO WAY','KAKURI DEPOT','MALALI HILL'],
   roads:{highway:'Kaduna–Zaria Road',avenue:'Independence Way',evacuation:'Ahmadu Bello Way','school-road':'Malali Road','market-street':'Kawo Market Street'},
   landmark:'river',sign:'KADUNA · CENTRE OF LEARNING',
   look:{soil:'#7a8648',dust:.15,trees:.9,dry:.2,haze:.05},
   atmosphere:{fog:0xc4b08a,density:.0078,skyTop:'#3d6d86',skyMid:'#a8bfb0',skyLow:'#efc68c',sun:0xffd29a},
   threat:{waves:1.1,ied:.45,sweepers:false},
   radio:['Ina kwana! Kawo dey calm, but eyes open.','Dem dey cross from river side — watch di flats!','Bomb dey for road? Call scanner, no try am yourself!']},
  jos:{id:'jos',order:3,city:'Jos',state:'Plateau',area:'Terminus · Rayfield',operation:'Operation Plateau Watch',lat:9.9,lon:8.86,
   tagline:'Hold the cool hills of the plateau',
   briefing:'Armed groups are working down from the Shere Hills under cover of the plateau mist. Protect Terminus Market and the specialist hospital, and keep the Bukuru road open.',
   zones:{base:'Rayfield Response Base',residential:'Tudun Wada',market:'Terminus Market',clinic:'Hospital Quarter',school:'Hill Station Road',evacuation:'Bukuru Expressway',staging:'Shere Hills'},
   facilities:{clinic:'Plateau Specialist Hospital',market:'Terminus Market',centre:'Rwang Pam Stadium',school:'Rayfield Community School'},
   nodes:['TERMINUS ROUNDABOUT','AHMADU BELLO WAY','BUKURU EXPRESSWAY','TIN-MINE DEPOT','SHERE LOOKOUT'],
   roads:{highway:'Bukuru Expressway',avenue:'Ahmadu Bello Way',evacuation:'Rayfield Road','school-road':'Hill Station Road','market-street':'Terminus Lane'},
   landmark:'boulders',sign:'JOS · HOME OF PEACE AND TOURISM',
   look:{soil:'#6f8a4f',dust:.06,trees:1.15,dry:.05,haze:0},
   atmosphere:{fog:0xa9b8b6,density:.0102,skyTop:'#4c6f86',skyMid:'#9fb5b9',skyLow:'#d9d2b6',sun:0xfff0d2},
   threat:{waves:1.15,ied:.5,sweepers:true},
   radio:['Plateau cold no be joke — keep di fire burning for di checkpoint.','Movement for Shere Hills side, three trucks!','Eagle-Eye don mark one bomb for Bukuru road.']},
  kano:{id:'kano',order:4,city:'Kano',state:'Kano',area:'Kofar Mata · Kurmi',operation:'Operation Dala Wall',lat:12.0,lon:8.52,
   tagline:'Guard the old walled city',
   briefing:'Harmattan dust hides a convoy moving on the old city. Hold the gates of Kano, keep Kurmi Market trading and protect the specialist hospital on the Zaria Road.',
   zones:{base:'Kofar Nassarawa Base',residential:'Old City · Dala',market:'Kurmi Market',clinic:'Hospital Quarter',school:'Sabon Gari Road',evacuation:'Zaria Road',staging:'Northern Dunes'},
   facilities:{clinic:'Murtala Specialist Hospital',market:'Kurmi Market',centre:'Kofar Mata Dye Pits',school:'Sabon Gari Community School'},
   nodes:['KOFAR NASSARAWA','BATA JUNCTION','ZARIA ROAD','KANTIN KWARI DEPOT','DALA HILL'],
   roads:{highway:'Zaria Road',avenue:'Murtala Mohammed Way',evacuation:'Airport Road','school-road':'Sabon Gari Road','market-street':'Kurmi Lane'},
   landmark:'citywall',sign:'KANO · CENTRE OF COMMERCE',
   look:{soil:'#a8774a',dust:.3,trees:.6,dry:.55,haze:.25},
   atmosphere:{fog:0xd2a874,density:.0118,skyTop:'#6f5a48',skyMid:'#c99a6a',skyLow:'#f2cf98',sun:0xffc283},
   threat:{waves:1.2,ied:.6,sweepers:true},
   radio:['Sannu da zuwa, Commander. Kofar Mata dey under our watch.','Harmattan thick — eyes on di dunes!','Mu je! Defend Kurmi before dem reach di gate!']},
  damaturu:{id:'damaturu',order:5,city:'Damaturu',state:'Yobe',area:'Pompomari · Nayinawa',operation:'Operation Sahel Lantern',lat:11.75,lon:11.96,
   tagline:'Keep the lights on in the Sahel',
   briefing:'Night raiders are pressing on Damaturu from the open Sahel. Hold Pompomari, protect the specialist hospital and keep the Potiskum Road open for the evacuation column.',
   zones:{base:'Pompomari Response Base',residential:'Nayinawa',market:'Damaturu Central Market',clinic:'Hospital Quarter',school:'Gujba Road',evacuation:'Potiskum Road',staging:'Open Sahel'},
   facilities:{clinic:'Yobe Specialist Hospital',market:'Damaturu Central Market',centre:'Pompomari Community Hall',school:'Nayinawa Community School'},
   nodes:['POMPOMARI JUNCTION','MAIDUGURI ROAD','POTISKUM ROAD','GUJBA DEPOT','SAHEL WATCH'],
   roads:{highway:'Potiskum–Maiduguri Road',avenue:'Gujba Road',evacuation:'Potiskum Road','school-road':'Nayinawa Road','market-street':'Central Market Lane'},
   landmark:'sahel',sign:'DAMATURU · PRIDE OF THE SAHEL',
   look:{soil:'#b48a55',dust:.38,trees:.45,dry:.7,haze:.2},
   atmosphere:{fog:0xd8b07c,density:.0112,skyTop:'#5c5a6a',skyMid:'#c79c72',skyLow:'#f4cd92',sun:0xffbe7a},
   threat:{waves:1.3,ied:.75,sweepers:true},
   radio:['Wind dey carry sand — check every culvert on Potiskum Road.','A kula! Dem don plant for di junction before.','Generator still dey run for di hospital. Hold am!']},
  maiduguri:{id:'maiduguri',order:6,city:'Maiduguri',state:'Borno',area:'Monday Market · Gwange',operation:'Operation Home of Peace',lat:11.85,lon:13.16,
   tagline:'The final stand in the Home of Peace',
   briefing:'The Black Harmattan has massed beyond the city trench. Every community volunteer in Maiduguri stands with you: protect Monday Market and UMTH, and keep the Kano Road open until the last family is out.',
   zones:{base:'Gwange Response Base',residential:'Gwange',market:'Monday Market',clinic:'Hospital Quarter',school:'Bulumkutu Road',evacuation:'Maiduguri–Kano Road',staging:'Beyond the City Trench'},
   facilities:{clinic:'UMTH Maiduguri',market:'Monday Market',centre:"Shehu's Palace Square",school:'Gwange Community School'},
   nodes:['POST OFFICE ROUNDABOUT','BAGA ROAD JUNCTION','KANO ROAD','CUSTOM MARKET DEPOT','MUNA LOOKOUT'],
   roads:{highway:'Maiduguri–Kano Road',avenue:'Kashim Ibrahim Way',evacuation:'Baga Road','school-road':'Bulumkutu Road','market-street':'Monday Market Lane'},
   landmark:'trench',sign:'MAIDUGURI · HOME OF PEACE',
   look:{soil:'#b38c5a',dust:.42,trees:.55,dry:.65,haze:.22},
   atmosphere:{fog:0xd6aa77,density:.0118,skyTop:'#584f5c',skyMid:'#c4936a',skyLow:'#f2c88c',sun:0xffb874},
   threat:{waves:1.45,ied:1,sweepers:true},
   radio:['Maiduguri no go fall! Hold Monday Market!','Vigilante team for Gwange don join — dem dey your left flank.','Allah ya kiyaye — scanner, sweep di Kano Road now!']}
 };
 const theatreIds=Object.freeze(Object.values(theatres).sort((a,b)=>a.order-b.order).map(t=>t.id));
 const theatre=id=>theatres[id]||theatres[theatreIds[0]];
 // Map metadata as a battle sees it: Safe Haven battles take the theatre's light and name.
 const forState=state=>{const base=get(state?.mapId);if(!['safe-haven','frontier'].includes(base.id)||!state?.theatreId)return base;const t=theatre(state.theatreId);return {...base,name:base.id==='frontier'?'Territory War · '+t.city:t.operation,theatre:t,atmosphere:{...base.atmosphere,...t.atmosphere}}};
 return Object.freeze({maps:Object.freeze(maps),layouts:Object.freeze(layouts),blockers,ids,get,defaultId:'coastal',theatres:Object.freeze(theatres),theatreIds,theatre,forState,territoryOf,clearOfRoads,inBuildArea,plotStatus,isTown:id=>id==='safe-haven'||id==='frontier'});
});
