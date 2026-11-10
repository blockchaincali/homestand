'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createVatar}=require('../src/vatar');

function memoryStore(){const data={};return {items:id=>[...(data[id]?.items||[])],grant(id,pid,prod){const e=data[id]||(data[id]={items:[],purchases:{}});if(e.purchases[pid])return false;e.purchases[pid]=prod;if(!e.items.includes(prod))e.items.push(prod);return true}}}
// A fake Vatar API: one player, purchases by id, records deliver calls and the auth header.
function fakeVatar(purchases){
 const calls=[];
 const fetchImpl=async(url,init)=>{
  calls.push({url,method:init.method,auth:init.headers.Authorization});
  const reply=(status,body)=>({ok:status<300,status,json:async()=>body});
  if(init.headers.Authorization!=='Bearer vtr_test_x')return reply(401,{error:'bad_secret'});
  if(url.endsWith('/session/verify')){const {session}=JSON.parse(init.body);return session==='good'?reply(200,{playerId:'t_ada',name:'Ada',mode:'test'}):reply(401,{error:'bad_session'})}
  const m=url.match(/\/purchases\/([^/]+)(\/deliver)?$/);const p=m&&purchases[m[1]];if(!p)return reply(404,{error:'not_found'});
  if(m[2]){if(p.status==='refunded')return reply(409,{error:'refunded'});p.status='delivered';return reply(200,{id:m[1],status:'delivered'})}
  return reply(200,{id:m[1],...p});
 };
 return {calls,fetchImpl};
}
const make=purchases=>{const f=fakeVatar(purchases);return {...f,v:createVatar({secret:'vtr_test_x',webhookSecret:'vtr_whsec_test_y',store:memoryStore(),fetchImpl:f.fetchImpl})}};

test('a paid purchase is verified with the secret, granted once and marked delivered',async()=>{
 const {v,calls}=make({p1:{productId:'gold_badge',playerId:'t_ada',status:'paid',mode:'test'}});
 const first=await v.claim({session:'good',purchaseId:'p1'});
 assert.deepEqual(first.items,['gold_badge']);
 assert.ok(calls.every(c=>c.auth==='Bearer vtr_test_x'),'every call carries the server secret');
 assert.ok(calls.some(c=>c.url.endsWith('/purchases/p1/deliver')&&c.method==='POST'));
 const again=await v.claim({session:'good',purchaseId:'p1'});
 assert.deepEqual(again.items,['gold_badge'],'claiming twice is safe');
 assert.equal(calls.filter(c=>c.url.endsWith('/deliver')).length,1,'already delivered: not delivered again');
 assert.deepEqual((await v.entitlements({session:'good'})).items,['gold_badge']);
});

test('purchases that are not the player\'s, unpaid, refunded or unknown are refused',async()=>{
 const {v}=make({other:{productId:'gold_badge',playerId:'t_bola',status:'paid',mode:'test'},refund:{productId:'gold_badge',playerId:'t_ada',status:'refunded',mode:'test'},odd:{productId:'gems',playerId:'t_ada',status:'paid',mode:'test'},live:{productId:'gold_badge',playerId:'t_ada',status:'paid',mode:'live'}});
 const code=async args=>{try{await v.claim(args);return 'granted'}catch(error){return error.code}};
 assert.equal(await code({session:'good',purchaseId:'other'}),'not_your_purchase');
 assert.equal(await code({session:'good',purchaseId:'refund'}),'refunded');
 assert.equal(await code({session:'good',purchaseId:'odd'}),'unknown_product');
 assert.equal(await code({session:'good',purchaseId:'live'}),'wrong_mode');
 assert.equal(await code({session:'bad',purchaseId:'other'}),'bad_session');
 assert.equal(await code({session:'good',purchaseId:'../x'}),'bad_purchase');
 assert.equal(await code({session:'good',purchaseId:'missing'}),'not_found');
 assert.deepEqual((await v.entitlements({session:'good'})).items,[],'nothing was granted');
});

test('the purchase.paid webhook needs a valid signature and still re-checks the purchase',async()=>{
 const {v,calls}=make({p2:{productId:'gold_badge',playerId:'t_ada',status:'paid',mode:'test'}});
 const raw=Buffer.from(JSON.stringify({type:'purchase.paid',purchaseId:'p2'}));
 const sig='sha256='+crypto.createHmac('sha256','vtr_whsec_test_y').update(raw).digest('hex');
 assert.equal(v.verifySignature(raw,sig),true);
 assert.equal(v.verifySignature(raw,'sha256='+'0'.repeat(64)),false);
 assert.equal(v.verifySignature(Buffer.from(raw.toString()+' '),sig),false,'any change to the body breaks the signature');
 await v.webhook(raw,{'x-vatar-signature':sig,'x-vatar-event':'purchase.paid'});
 assert.ok(calls.some(c=>c.url.endsWith('/purchases/p2')&&c.method==='GET'),'the webhook is a nudge: the purchase is fetched from Vatar');
 assert.deepEqual((await v.entitlements({session:'good'})).items,['gold_badge']);
});

test('without a secret the purchase API says it is not configured',async()=>{
 const v=createVatar({secret:'',store:memoryStore(),fetchImpl:async()=>{throw new Error('should not call')}});
 await assert.rejects(v.claim({session:'good',purchaseId:'p1'}),e=>e.code==='not_configured');
});
