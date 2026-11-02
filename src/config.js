'use strict';
const W=2400,H=1350, BOUNDS={left:125,right:2275,top:105,bottom:1245};
const UNITS={
 rifle:{label:'Rifle Squad',short:'RIFLE',cost:60,hp:86,speed:94,range:138,damage:10,fireRate:0.65,bulletSpeed:670,splash:0,radius:12,supply:1},
 tank:{label:'Siege Tank',short:'TANK',cost:165,hp:305,speed:56,range:196,damage:41,fireRate:1.65,bulletSpeed:460,splash:31,radius:20,supply:3},
 rocket:{label:'Rocket Battery',short:'ROCKET',cost:130,hp:118,speed:66,range:270,damage:29,fireRate:2.35,bulletSpeed:340,splash:63,radius:16,supply:2},
 engineer:{label:'Engineer Vehicle',short:'ENGINEER',cost:120,hp:180,speed:72,range:96,damage:5,fireRate:1.1,bulletSpeed:540,splash:0,radius:18,supply:2},
 scanner:{label:'Eagle-Eye Scanner',short:'SCANNER',cost:110,hp:170,speed:82,range:120,damage:6,fireRate:1.2,bulletSpeed:560,splash:0,radius:17,supply:2,scan:235,rocketRange:300,rocketDamage:34,rocketRate:2.2,rocketSplash:22},
 hacker:{label:'Cyber Team',short:'CYBER',cost:130,hp:70,speed:86,range:0,damage:0,fireRate:9,bulletSpeed:1,splash:0,radius:11,supply:1},
 patrol:{label:'Protected Patrol',short:'PATROL',cost:145,hp:250,speed:76,range:175,damage:26,fireRate:1.1,bulletSpeed:590,splash:14,radius:20,supply:3}
};
const CATALOG=require('../public/catalog');
// Safe Haven keeps its original names; the shared catalogue supplies every other structure.
const LEGACY_STRUCTURES={
 barricade:{label:'Protective Barricade',cost:55,buildTime:4,hp:520,radius:34,role:'Blocks hostile vehicles and protects a lane'},
 watchtower:{label:'Defensive Watchtower',cost:110,buildTime:7,hp:430,radius:31,range:245,damage:22,fireRate:.78,role:'Automatically engages nearby threats'},
 barracks:{label:'Response Barracks',cost:145,buildTime:8,hp:620,radius:43,role:'Trains community response infantry'},
 workshop:{label:'Vehicle Workshop',cost:180,buildTime:10,hp:720,radius:48,role:'Produces protected patrol vehicles'},
 clinic:{label:'Field Clinic',cost:135,buildTime:8,hp:560,radius:40,heal:9,role:'Restores nearby friendly units'}
};
const STRUCTURES=Object.fromEntries(Object.entries(CATALOG.STRUCTURES).map(([key,value])=>[key,{...value,...(LEGACY_STRUCTURES[key]||{})}]));
// Improvised explosive devices. Hidden from the opposing side until an Eagle-Eye scanner
// sweeps them; armed charges detonate when a hostile ground unit rolls over them.
const IED={cost:45,arm:2.5,trigger:36,radius:110,damage:210,maxActive:6,plantRange:46,plantTime:2.2,defuseRange:44,defuseTime:3.4,salvage:30,planters:['rifle','engineer']};
const START_CREDITS=350, MAX_SUPPLY=50, MAX_TIME=360, WIN_SCORE=600;
const NODES=[
 {x:1200,y:250,name:'NORTH RIDGE'},
 {x:1200,y:675,name:'CENTRAL RELAY'},
 {x:1200,y:1100,name:'SOUTH PASS'},
 {x:760,y:405,name:'FOREST OUTPOST',kind:'outpost',reward:'credits'},
 {x:1640,y:945,name:'EASTERN DEPOT',kind:'outpost',reward:'energy'}
];
module.exports={W,H,BOUNDS,UNITS,STRUCTURES,CATALOG,IED,START_CREDITS,MAX_SUPPLY,MAX_TIME,WIN_SCORE,NODES};
