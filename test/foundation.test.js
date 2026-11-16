'use strict';
const {after,before,test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {WebSocket}=require('ws');
const {server}=require('../server');

let origin;

before(async()=>{
 await new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(0,'127.0.0.1',resolve);
 });
 origin=`http://127.0.0.1:${server.address().port}`;
});

after(async()=>{
 if(server.listening)await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
});

test('startup uses checked-in source without a generated bootstrap',()=>{
 const pkg=require('../package.json');
 assert.equal(pkg.scripts.start,'node server.js');
 assert.equal(pkg.scripts.test,'node --test');
 for(const file of ['server.js','src/config.js','src/engine.js','public/index.html','public/maps.js','public/style.css','public/game.js','public/3d.js']){
  assert.equal(fs.existsSync(path.join(__dirname,'..',file)),true,`${file} must be checked in`);
 }
});

test('health and static routes return expected content types',async()=>{
 const health=await fetch(`${origin}/healthz`);
 assert.equal(health.status,200);
 assert.match(health.headers.get('content-type'),/^application\/json/);
 assert.deepEqual(await health.json(),{status:'ok',game:'HOMESTAND',rooms:0});

 const expected={
  '/':'text/html',
  '/style.css':'text/css',
  '/game.js':'text/javascript',
  '/maps.js':'text/javascript',
  '/3d.js':'text/javascript',
  '/vendor/three.module.js':'text/javascript',
  '/vendor/BufferGeometryUtils.js':'text/javascript',
  '/assets/iron-frontier-hero.webp':'image/webp',
  '/assets/3d/coastal-ground-albedo.jpg':'image/jpeg',
  '/assets/3d/azure-armor-albedo.jpg':'image/jpeg',
  '/assets/3d/crimson-armor-albedo.jpg':'image/jpeg',
  '/assets/3d/impact-explosion.png':'image/png'
 };
 for(const [route,type] of Object.entries(expected)){
  const response=await fetch(origin+route);
  assert.equal(response.status,200,route);
  assert.match(response.headers.get('content-type'),new RegExp(`^${type.replace('/','\\/')}`),route);
  assert.ok((await response.arrayBuffer()).byteLength>0,route);
 }
 const missing=await fetch(`${origin}/server.js`);
 assert.equal(missing.status,404);
});

test('WebSocket endpoint upgrades and creates a Recruit solo match',async()=>{
 const ws=new WebSocket(origin.replace('http:','ws:')+'/ws');
 const messages=[];
 await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(new Error('Timed out waiting for solo state')),2000);
  ws.on('open',()=>ws.send(JSON.stringify({type:'create',mode:'solo',difficulty:'recruit',name:'Smoke Test'})));
  ws.on('message',raw=>{
   const message=JSON.parse(raw.toString());messages.push(message);
   if(message.type==='state'&&message.phase==='playing'){
    clearTimeout(timeout);resolve();
   }
  });
  ws.on('error',reject);
 });
 assert.ok(messages.some(message=>message.type==='joined'));
 const state=messages.find(message=>message.type==='state'&&message.phase==='playing');
 assert.equal(state.difficulty,'recruit');
 assert.equal(state.participants.length,2);
 ws.close();
});
