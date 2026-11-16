'use strict';
// Server side of Vatar purchases (https://lagoslife.app/developers/docs, "Your server").
// The game never trusts the client: a cosmetic is granted only after Vatar confirms, with our
// secret, who the player is and that their purchase is paid. Then it is marked delivered.
// Secrets come from the environment only (VATAR_SECRET, VATAR_WEBHOOK_SECRET); never logged.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');

// Cosmetics only: nothing here changes gameplay. Product ids must match the dashboard exactly.
const PRODUCTS={gold_badge:{name:'Gold Commander badge'}};
const API=(process.env.VATAR_API||'https://lagoslife.app/api/games/v1').replace(/\/+$/,'');
const ID=/^[A-Za-z0-9_-]{1,80}$/;

class VatarError extends Error{constructor(status,code){super(code);this.status=status;this.code=code}}

// Entitlements: playerId -> {items:[productId], purchases:{purchaseId:productId}}. Kept in a JSON file
// (DATA_DIR, e.g. a Railway volume); writes are atomic (temp file + rename).
function createStore(file){
 let data={};try{data=JSON.parse(fs.readFileSync(file,'utf8'))}catch{}
 const save=()=>{try{fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data));fs.renameSync(tmp,file)}catch(error){console.warn('Entitlements not saved:',error.code||error.message)}};
 return {
  items:playerId=>[...(data[playerId]?.items||[])],
  // Grant once per purchase id; returns false when this purchase was already granted.
  grant(playerId,purchaseId,productId){const entry=data[playerId]||(data[playerId]={items:[],purchases:{}});if(entry.purchases[purchaseId])return false;entry.purchases[purchaseId]=productId;if(!entry.items.includes(productId))entry.items.push(productId);save();return true}
 };
}

function createVatar({secret=process.env.VATAR_SECRET,webhookSecret=process.env.VATAR_WEBHOOK_SECRET,store,fetchImpl=globalThis.fetch}={}){
 store=store||createStore(path.join(process.env.DATA_DIR||path.join(__dirname,'..','data'),'entitlements.json'));
 const call=async(method,route,body)=>{
  if(!secret)throw new VatarError(503,'not_configured');
  let response;
  try{response=await fetchImpl(API+route,{method,headers:{Authorization:'Bearer '+secret,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(8000)})}
  catch{throw new VatarError(502,'vatar_unreachable')}
  let json=null;try{json=await response.json()}catch{}
  if(!response.ok)throw new VatarError(response.status===404?404:response.status===409?409:response.status===401?401:502,json?.error||json?.code||'vatar_'+response.status);
  return json||{};
 };
 const verifySession=async session=>{if(typeof session!=='string'||!session||session.length>4096)throw new VatarError(400,'bad_session');const who=await call('POST','/session/verify',{session});if(!who.playerId)throw new VatarError(401,'bad_session');return who};
 const purchase=id=>call('GET','/purchases/'+encodeURIComponent(id));
 const deliver=id=>call('POST','/purchases/'+encodeURIComponent(id)+'/deliver');

 // Check, grant once, deliver. Safe to repeat: a second claim of the same purchase grants nothing new.
 async function settle(p,playerId,mode){
  if(!PRODUCTS[p.productId])throw new VatarError(400,'unknown_product');
  if(p.playerId!==playerId)throw new VatarError(403,'not_your_purchase');
  if(mode&&p.mode&&p.mode!==mode)throw new VatarError(403,'wrong_mode');
  if(p.status==='refunded')throw new VatarError(409,'refunded');
  if(p.status!=='paid'&&p.status!=='delivered')throw new VatarError(409,'not_paid');
  store.grant(playerId,p.id,p.productId);
  if(p.status==='paid')await deliver(p.id);
  return {ok:true,productId:p.productId,items:store.items(playerId)};
 }
 return {
  products:PRODUCTS,
  async claim({session,purchaseId}){
   if(typeof purchaseId!=='string'||!ID.test(purchaseId))throw new VatarError(400,'bad_purchase');
   const who=await verifySession(session);
   const p=await purchase(purchaseId);
   return settle({...p,id:p.id||purchaseId},who.playerId,who.mode);
  },
  async entitlements({session}){const who=await verifySession(session);return {items:store.items(who.playerId)}},
  // purchase.paid webhook: verify the HMAC over the raw body, then re-check the purchase with Vatar.
  verifySignature(raw,header){
   if(!webhookSecret||typeof header!=='string'||!header.startsWith('sha256='))return false;
   const expected=Buffer.from(crypto.createHmac('sha256',webhookSecret).update(raw).digest('hex')),given=Buffer.from(header.slice(7));
   return given.length===expected.length&&crypto.timingSafeEqual(given,expected);
  },
  async webhook(raw,headers){
   if(!this.verifySignature(raw,headers['x-vatar-signature']))throw new VatarError(401,'bad_signature');
   if(headers['x-vatar-event']!=='purchase.paid')return {ok:true,ignored:true};
   let body;try{body=JSON.parse(raw.toString('utf8'))}catch{throw new VatarError(400,'bad_body')}
   const id=body?.purchaseId||body?.purchase?.id||body?.data?.purchaseId||body?.data?.id||body?.id;
   if(typeof id!=='string'||!ID.test(id))throw new VatarError(400,'bad_purchase');
   const p=await purchase(id);
   return settle({...p,id:p.id||id},p.playerId,null);
  }
 };
}
module.exports={createVatar,createStore,VatarError,PRODUCTS};
