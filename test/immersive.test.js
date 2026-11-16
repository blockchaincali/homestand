'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Game}=require('../src/engine'),maps=require('../public/maps');
const read=file=>fs.readFileSync(path.join(__dirname,'..','public',file),'utf8');
function haven(options={}){const g=new Game({mode:'solo',missionId:'safe-haven',difficulty:'recruit',...options});g.addParticipant('p0','Coordinator',0);g.addParticipant('bot','Hostiles',1,true);g.start();return g}
// Begin Defense moves to the two-minute warning; a second press starts the assault.
const defend=g=>{g.tutorialComplete(0);g.completeTraining(0);g.completeTraining(0)};

test('Safe Haven starts with a deterministic response formation beside the command post',()=>{
 const a=haven(),b=haven(),place=g=>g.units.map(unit=>[unit.type,Math.round(unit.x),Math.round(unit.y)]);
 assert.deepEqual(place(a),place(b));
 const engineer=a.units.find(unit=>unit.type==='engineer');assert.ok(Math.hypot(engineer.x-350,engineer.y-400)<390,'opening build sites are within engineer reach');
});

test('authored town scenery blocks construction on homes and market stalls but not the response base',()=>{
 const g=haven(),engineer=g.units.find(unit=>unit.type==='engineer'),home=maps.layouts['safe-haven'].compounds[0];
 g.tutorialComplete(0);engineer.x=home.x;engineer.y=home.y+150;
 const blocked=g.constructionSite(0,'barricade',home.x,home.y,[engineer.id]);assert.equal(blocked.ok,false);assert.match(blocked.reason,/homes|market/i);
 engineer.x=350;engineer.y=500;assert.equal(g.constructionSite(0,'barricade',350,400,[engineer.id]).ok,true);
 assert.ok(maps.blockers('safe-haven').length>=maps.layouts['safe-haven'].compounds.length);assert.deepEqual(maps.blockers('coastal'),[]);
});

test('difficulty sets distinct, escalating hostile waves with combined arms',()=>{
 const sizes={};for(const difficulty of ['recruit','standard','veteran']){const g=haven({difficulty});defend(g);const first=g.units.filter(unit=>unit.team===1).length;for(let i=0;i<2;i++)g.spawnMissionWave();sizes[difficulty]={first,types:new Set(g.units.filter(unit=>unit.team===1).map(unit=>unit.type)),waves:g.mission.wave}}
 assert.ok(sizes.recruit.first<sizes.standard.first&&sizes.standard.first<sizes.veteran.first,JSON.stringify(sizes));
 for(const value of Object.values(sizes)){assert.equal(value.waves,3);assert.ok(value.types.has('rifle')&&value.types.has('rocket')&&value.types.has('tank'),'wave three fields every hostile role')}
});

test('hostile roles pressure different objectives and waves follow a visible countdown',()=>{
 const g=haven({difficulty:'standard'});const engineer=g.units.find(unit=>unit.type==='engineer');g.tutorialComplete(0);engineer.x=1450;engineer.y=700;g.teams[0].credits=1000;const placed=g.constructionSite(0,'watchtower',1450,620,[engineer.id]);assert.equal(placed.ok,true,placed.reason);const tower=placed.structure;tower.status='active';defend(g);
 const rocket=g.spawnAt(1,'rocket',2000,560),tank=g.spawnAt(1,'tank',2000,700);
 const rocketTarget=g.missionTarget(rocket),tankTarget=g.missionTarget(tank),clinic=g.facilities.find(value=>value.kind==='civilianClinic');
 assert.ok(Math.hypot(rocketTarget.x-tower.x,rocketTarget.y-tower.y)<40,'rockets hunt defensive structures');
 assert.ok(Math.hypot(tankTarget.x-clinic.x,tankTarget.y-clinic.y)<40,'tanks press the clinic');
 g.step(1);assert.ok(g.snapshot().mission.nextWaveIn>0);
});

test('guided field training cannot be lost to its first attack',()=>{
 const g=haven({guided:true});defend(g);assert.equal(g.mission.wave,1);assert.equal(g.units.filter(unit=>unit.team===1).length,2,'the guided first wave is small');
 for(const facility of g.facilities)g.applyDamage(facility,99999,1);assert.equal(g.phase,'playing');assert.ok(g.facilities.every(value=>value.hp>=value.maxHp*.4-1));
 const unguided=haven();defend(unguided);unguided.applyDamage(unguided.facilities[0],99999,1);unguided.applyDamage(unguided.facilities[1],99999,1);assert.equal(unguided.phase,'results');
});

test('civilian facilities matter: market income, clinic care and sheltered evacuation',()=>{
 const g=haven();defend(g);g.aiClock=-1e9;for(const enemy of g.units.filter(unit=>unit.team===1))g.units.splice(g.units.indexOf(enemy),1);g.mission.waveClock=-1e9;
 g.teams[0].credits=0;g.incomeClock=.99;g.step(.05);const withMarket=g.teams[0].credits;g.facilities.find(value=>value.kind==='market').hp=0;g.teams[0].credits=0;g.incomeClock=.99;g.step(.05);assert.ok(withMarket>g.teams[0].credits,'market adds community supplies');
 const clinic=g.facilities.find(value=>value.kind==='civilianClinic'),patient=g.units.find(unit=>unit.team===0&&unit.type==='rifle');patient.x=clinic.x+60;patient.y=clinic.y;patient.hp=30;patient.hold=true;g.step(1);assert.ok(patient.hp>30,'community clinic treats defenders');
 g.facilities.find(value=>value.kind==='market').hp=200;g.mission.stage='final';g.mission.stageTime=0;for(let i=0;i<200;i++)g.step(.05);const sheltered=g.mission.evacuated;assert.ok(sheltered>0);
 const exposed=haven();defend(exposed);exposed.aiClock=-1e9;exposed.mission.waveClock=-1e9;exposed.units=exposed.units.filter(unit=>unit.team===0);for(const facility of exposed.facilities.filter(value=>value.kind==='community'))facility.hp=0;exposed.mission.stage='final';exposed.mission.stageTime=0;for(let i=0;i<200;i++)exposed.step(.05);assert.ok(exposed.mission.evacuated<sheltered,'shelters speed the evacuation');
});

test('mission statistics feed the results summary',()=>{
 const g=haven();g.tutorialComplete(0);const engineer=g.units.find(unit=>unit.type==='engineer'),site=g.constructionSite(0,'barricade',350,400,[engineer.id]).structure;engineer.x=site.x;engineer.y=site.y+60;for(let i=0;i<100;i++)g.step(.05);
 const cache=g.caches[0],runner=g.units.find(unit=>unit.type==='rifle');runner.x=cache.x;runner.y=cache.y;g.step(.05);
 const stats=g.snapshot().stats[0];assert.equal(stats.built,1);assert.equal(stats.caches,1);assert.equal(typeof g.snapshot().mission.evacuated,'number');
});

test('client experience keeps the battlefield-first HUD, guided training and cinematic menu wired',()=>{
 const ui=read('game.js'),home=read('home.js'),town=read('town.js'),css=read('style.css');
 for(const id of ['play-now','how-to-play','play-friends','open-operations','safe-haven','tutorial','solo','friend','begin-defense','build-toggle','gesture-hand','intro-cinematic','menu-toggle','surrender-confirm','box-select'])assert.match(ui,new RegExp('id="'+id+'"'),id);
 assert.equal((ui.match(/\{id:'(camera|select|barracks|produce|move|cache|defense|complete)'/g)||[]).length,8,'eight guided training steps');
 assert.match(home,/visibilitychange/);assert.match(home,/prefers-reduced-motion/);assert.match(home,/unmount/);
 assert.match(town,/mergeGeometries/);assert.match(town,/vertexColors/);assert.doesNotMatch(town+home,/https?:\/\//);
 assert.match(css,/body\.in-battle\{position:fixed;inset:0;overflow:hidden/);assert.match(css,/@media \(max-height:560px\)/);assert.match(css,/safe-area-inset/);
 assert.ok(fs.statSync(path.join(__dirname,'..','public','assets','homestand-poster.jpg')).size<600_000,'poster stays within its budget');
});
