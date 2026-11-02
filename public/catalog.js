// HOMESTAND structure and production catalogue, shared by the server (authoritative costs,
// requirements and limits) and the client (menus, previews). Loaded as CommonJS on the server
// and as a classic script in the browser (window.HomestandCatalog).
(function(root,factory){
 const value=factory();
 if(typeof module==='object'&&module.exports)module.exports=value;
 else root.HomestandCatalog=value;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // size 'large' structures must sit on a construction plot; 'small' ones go anywhere inside the
 // team's build area. factions: which side may build it (0 = Community Defence, 1 = Raiders).
 const STRUCTURES={
  // Command and infrastructure
  depot:{label:'Supply Depot',raider:'Supply Cache',category:'command',size:'large',cost:100,buildTime:8,hp:520,radius:40,supply:15,icon:'supply',role:'+15 army capacity'},
  collector:{label:'Resource Collector',raider:'Scavenger Yard',category:'command',size:'large',cost:140,buildTime:10,hp:560,radius:42,income:5,siteIncome:8,icon:'credits',role:'+5 credits/s anywhere · +8 on a resource site'},
  comms:{label:'Communications Centre',raider:'Radio Shack',category:'command',size:'large',cost:160,buildTime:10,hp:600,radius:42,requires:['barracks'],energy:1.2,produces:['hacker'],icon:'intel',role:'Unlocks armour and emplacements · trains hackers · +energy'},
  // Defence
  barricade:{label:'Barricade',raider:'Barricade',category:'defence',size:'small',cost:55,buildTime:4,hp:520,radius:34,icon:'barricade',role:'Blocks hostile vehicles and protects a lane'},
  guardpost:{label:'Guard Post',raider:'Lookout Post',category:'defence',size:'small',cost:70,buildTime:5,hp:380,radius:26,range:190,damage:10,fireRate:.7,icon:'hold',role:'Light automatic defence'},
  watchtower:{label:'Watchtower',raider:'Sniper Nest',category:'defence',size:'small',cost:110,buildTime:7,hp:430,radius:31,range:245,damage:22,fireRate:.78,icon:'watchtower',role:'Automatically engages nearby threats'},
  bunker:{label:'Bunker',raider:'Dugout',category:'defence',size:'small',cost:120,buildTime:8,hp:900,radius:32,range:200,damage:14,fireRate:.5,requires:['barracks'],icon:'hq',role:'Armoured firing position'},
  emplacement:{label:'Weapon Emplacement',raider:'Gun Pit',category:'defence',size:'small',cost:190,buildTime:10,hp:600,radius:30,range:290,damage:34,fireRate:1.6,splash:30,requires:['comms'],icon:'attackmove',role:'Long-range heavy gun'},
  shelter:{label:'Civilian Shelter',category:'defence',size:'small',cost:90,buildTime:7,hp:800,radius:34,factions:[0],icon:'hq',role:'Protects residents during attacks'},
  clinic:{label:'Field Clinic',raider:'Aid Tent',category:'defence',size:'large',cost:135,buildTime:8,hp:560,radius:40,heal:9,icon:'clinic',role:'Restores nearby friendly units'},
  // Production
  barracks:{label:'Barracks',raider:'Training Camp',category:'production',size:'large',cost:145,buildTime:8,hp:620,radius:43,produces:['rifle'],icon:'barracks',role:'Trains infantry'},
  workshop:{label:'Vehicle Workshop',raider:'Technical Yard',category:'production',size:'large',cost:180,buildTime:10,hp:720,radius:48,produces:['patrol','scanner'],requires:['barracks'],icon:'workshop',role:'Builds patrol vehicles and scanners'},
  factory:{label:'Armoured Vehicle Factory',raider:'Heavy Garage',category:'production',size:'large',cost:260,buildTime:14,hp:900,radius:52,produces:['tank','rocket'],requires:['workshop','comms'],icon:'tank',role:'Builds tanks and rocket batteries'}
 };
 const CATEGORIES=[{id:'command',label:'Command'},{id:'defence',label:'Defence'},{id:'production',label:'Production'}];
 // Production times (seconds) and the faction names for each unit.
 const PRODUCTION={engineer:{time:6,from:'hq'},rifle:{time:4.5,from:'barracks'},patrol:{time:8,from:'workshop'},scanner:{time:7,from:'workshop'},tank:{time:11,from:'factory'},rocket:{time:10,from:'factory'},hacker:{time:7,from:'comms'}};
 const UNIT_NAMES={
  0:{engineer:'Engineer',rifle:'Response Squad',patrol:'Protected Patrol',scanner:'Eagle-Eye Scanner',tank:'Siege Tank',rocket:'Rocket Battery',hacker:'Cyber Team'},
  1:{engineer:'Sapper',rifle:'Fighters',patrol:'Technical',scanner:'Sweeper',tank:'Armoured Truck',rocket:'Rocket Truck',hacker:'Hack Cell'}
 };
 const FACTIONS=[{id:'defence',name:'Community Defence',short:'DEFENCE'},{id:'raiders',name:'Black Harmattan Raiders',short:'RAIDERS'}];
 const name=(type,team)=>{const s=STRUCTURES[type];if(!s)return type==='hq'?(team===1?'Raider Camp':'Command HQ'):type;return team===1&&s.raider?s.raider:s.label};
 const allowed=(type,team)=>{const s=STRUCTURES[type];return Boolean(s)&&(!s.factions||s.factions.includes(team))};
 // Which requirements are still missing, given the team's completed structures.
 const missing=(type,built)=>(STRUCTURES[type]?.requires||[]).filter(req=>!built.includes(req));
 return Object.freeze({STRUCTURES,CATEGORIES,PRODUCTION,UNIT_NAMES,FACTIONS,name,allowed,missing,BASE_SUPPLY:20,SUPPLY_CAP:60,ASSIST_FALLOFF:.65,ASSIST_MAX:4});
});
