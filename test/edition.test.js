'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Game}=require('../src/engine');
const MAPS=require('../public/maps');

const REAL=/Abuja|Kaduna|Kano|Jos\b|Damaturu|Maiduguri|Nyanya|Karu|Ahmadu Bello|Murtala|Baga|Borno|Yobe/i;
function game(edition){const g=new Game({mode:'pvp',scenario:'territory',theatreId:'maiduguri',edition});g.addParticipant('d','D',0);g.addParticipant('r','R',1);g.start();return g}

test('the Lagos Life edition uses fictional places everywhere a player can read them',()=>{
 for(const id of MAPS.theatreIds){const t=MAPS.theatre(id,'lagoslife');assert.ok(!REAL.test(JSON.stringify({city:t.city,state:t.state,area:t.area,briefing:t.briefing,zones:t.zones,facilities:t.facilities,nodes:t.nodes,roads:t.roads,sign:t.sign,radio:t.radio,operation:t.operation})),id+' still names a real place')}
 assert.equal(MAPS.theatre('abuja').city,'Abuja','the standalone edition keeps real cities');
 const g=game('lagoslife');assert.equal(g.edition,'lagoslife');
 assert.ok(g.facilities.every(f=>!REAL.test(f.name)));assert.ok(!REAL.test(JSON.stringify(g.events.map(e=>e.text))));
});

test('Lagos Life edition events and results use gentler words; gameplay is identical',()=>{
 const soft=game('lagoslife'),hard=game('standard');
 for(const g of [soft,hard]){g.event('IED DETONATED - SOMEWHERE',0);g.event('RAIDERS SEIZED AMINA - INTERCEPT THE ESCORT',null);g.event('CIVILIAN CASUALTY - MUSA (DEFENCE FIRE)',null)}
 const text=soft.events.slice(-3).map(e=>e.text).join(' | ');
 assert.match(text,/TRAP SPRUNG/);assert.match(text,/CUT OFF AMINA/);assert.match(text,/INJURY/);assert.doesNotMatch(text,/IED|SEIZED|CASUALTY/);
 assert.match(hard.events.at(-3).text,/IED DETONATED/,'standalone unchanged');
 soft.end(1,'TOO MANY CIVILIANS KILLED');assert.equal(soft.win.reason,'TOO MANY CIVILIANS INJURED');
 assert.equal(soft.snapshot().edition,'lagoslife');assert.deepEqual(soft.units.map(u=>u.type),hard.units.map(u=>u.type));
});
