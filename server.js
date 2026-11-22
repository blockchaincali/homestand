'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {WebSocketServer}=require('ws');
const {createHub}=require('./src/rooms');
const {createVatar}=require('./src/vatar');
const vatar=createVatar();
const PORT=Number(process.env.PORT||3000);
const staticFiles={'/manifest.webmanifest':'manifest.webmanifest','/sw.js':'sw.js','/icons/icon-192.png':'icons/icon-192.png','/icons/icon-512.png':'icons/icon-512.png','/icons/maskable-512.png':'icons/maskable-512.png','/icons/apple-touch-icon.png':'icons/apple-touch-icon.png','/maps.js':'maps.js','/3d.js':'3d.js','/3d.css':'3d.css','/home.js':'home.js','/town.js':'town.js','/platform.js':'platform.js','/audio.js':'audio.js','/catalog.js':'catalog.js','/':'index.html','/index.html':'index.html','/style.css':'style.css','/game.js':'game.js','/assets/homestand-hero.webp':'assets/homestand-hero.webp','/assets/homestand-poster.jpg':'assets/homestand-poster.jpg','/assets/world-map.svg':'assets/world-map.svg','/assets/3d/coastal-ground-albedo.jpg':'assets/3d/coastal-ground-albedo.jpg','/assets/3d/azure-armor-albedo.jpg':'assets/3d/azure-armor-albedo.jpg','/assets/3d/crimson-armor-albedo.jpg':'assets/3d/crimson-armor-albedo.jpg','/assets/3d/impact-explosion.png':'assets/3d/impact-explosion.png'};
// Browsers receive the minified Three.js build; the stable /vendor/three.module.js URL keeps the import map unchanged.
const vendorFiles={'/vendor/three.module.js':['three','build','three.module.min.js'],'/vendor/three.core.min.js':['three','build','three.core.min.js'],'/vendor/three.core.js':['three','build','three.core.min.js'],'/vendor/BufferGeometryUtils.js':['three','examples','jsm','utils','BufferGeometryUtils.js']};
const compressible=/\.(html|css|js|svg)$/,responseCache=new Map();
function serveFile(req,res,filePath,cacheControl){
 fs.stat(filePath,(statError,stat)=>{if(statError){res.writeHead(404);return res.end('Not found')}
  const type=contentType[path.extname(filePath)]||'application/octet-stream',etag='"'+stat.size.toString(36)+'-'+Math.floor(stat.mtimeMs).toString(36)+'"',gzip=compressible.test(filePath)&&/\bgzip\b/.test(req.headers['accept-encoding']||'');
  const headers={'Content-Type':type,'Cache-Control':cacheControl,ETag:etag,Vary:'Accept-Encoding'};
  // Vatar's Lagos Life Games app frames the game; only those origins (and ourselves) may embed it.
  if(type.startsWith('text/html'))headers['Content-Security-Policy']=FRAME_POLICY;
  if(req.headers['if-none-match']===etag){res.writeHead(304,headers);return res.end()}
  const key=filePath+(gzip?':gz':''),cached=responseCache.get(key),finish=body=>{if(gzip)headers['Content-Encoding']='gzip';headers['Content-Length']=body.length;res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:body)};
  if(cached?.etag===etag)return finish(cached.body);
  fs.readFile(filePath,(readError,data)=>{if(readError){res.writeHead(404);return res.end('Not found')}const body=gzip?zlib.gzipSync(data,{level:9}):data;responseCache.set(key,{etag,body});finish(body)})
 })
}
// FRAME_ANCESTORS_EXTRA (space-separated origins) lets a local test harness frame the game; unset in production.
const FRAME_POLICY="frame-ancestors 'self' https://lagoslife.app https://www.lagoslife.app https://naijalife.app https://www.naijalife.app https://lagoslife.eliysites.com https://vatarverse.com https://www.vatarverse.com"+(process.env.FRAME_ANCESTORS_EXTRA?' '+process.env.FRAME_ANCESTORS_EXTRA.split(/\s+/).filter(o=>/^https?:\/\/[a-z0-9.:-]+$/i.test(o)).join(' '):'');
const contentType={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(vendorFiles[pathname])return serveFile(req,res,path.join(__dirname,'node_modules',...vendorFiles[pathname]),'public, max-age=604800');
 if(pathname.startsWith('/api/'))return handleApi(req,res,pathname);
 if(pathname==='/healthz'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify({status:'ok',game:'HOMESTAND',rooms:rooms.size}))}
 const file=staticFiles[pathname];if(!file){res.writeHead(404);return res.end('Not found')}
 // The service worker must always be revalidated so new deploys take over promptly.
 serveFile(req,res,path.join(__dirname,'public',file),file==='sw.js'?'no-cache':'public,max-age=60')
});
// ---------- Vatar purchases (cosmetics only) ----------
// /api/claim and /api/entitlements take {session} from Vatar.session(); the server verifies it with
// Vatar before anything is granted. /api/vatar/webhook takes Vatar's signed purchase.paid nudge.
const apiHits=new Map();
function readBody(req,limit=8192){return new Promise((resolve,reject)=>{const chunks=[];let size=0;req.on('data',c=>{size+=c.length;if(size>limit){reject(Object.assign(new Error('too_large'),{status:413}));req.destroy()}else chunks.push(c)});req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject)})}
function apiReply(res,status,body){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body))}
async function handleApi(req,res,pathname){
 if(req.method!=='POST')return apiReply(res,405,{error:'method_not_allowed'});
 const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim(),now=Date.now(),hits=(apiHits.get(ip)||[]).filter(t=>now-t<60000);
 if(hits.length>=60)return apiReply(res,429,{error:'rate_limited'});hits.push(now);apiHits.set(ip,hits);if(apiHits.size>5000)apiHits.clear();
 try{
  const raw=await readBody(req);
  if(pathname==='/api/vatar/webhook'){
   if(!vatar.verifySignature(raw,req.headers['x-vatar-signature']))return apiReply(res,401,{error:'bad_signature'});
   // Answer within Vatar's 5 s window, then re-check and deliver in the background.
   apiReply(res,200,{ok:true});
   vatar.webhook(raw,req.headers).catch(error=>console.warn('Webhook purchase not settled:',error.code||error.message));return;
  }
  let body;try{body=JSON.parse(raw.toString('utf8')||'{}')}catch{return apiReply(res,400,{error:'bad_json'})}
  if(pathname==='/api/claim')return apiReply(res,200,await vatar.claim(body));
  if(pathname==='/api/entitlements')return apiReply(res,200,await vatar.entitlements(body));
  return apiReply(res,404,{error:'not_found'});
 }catch(error){
  const status=error.status||500;if(status>=500)console.warn('Purchase API error:',error.code||error.message);
  if(!res.headersSent)apiReply(res,status,{error:error.code||'error'});
 }
}
// Snapshots are repetitive JSON: per-message deflate cuts bandwidth roughly five-fold.
const wss=new WebSocketServer({server,path:'/ws',maxPayload:8192,perMessageDeflate:{threshold:512,zlibDeflateOptions:{level:4,memLevel:7},concurrencyLimit:8}});
const hub=createHub(),rooms=hub.rooms;
wss.on('connection',ws=>{
 ws.alive=true;ws.on('pong',()=>{ws.alive=true});
 ws.on('message',raw=>hub.message(ws,raw));
 ws.on('close',()=>hub.close(ws));
});
const loop=setInterval(()=>hub.tick(performance.now()),50);loop.unref();
const keepalive=setInterval(()=>{for(const ws of wss.clients){if(ws.alive===false){ws.terminate();continue}ws.alive=false;ws.ping()}},25000);keepalive.unref();
if(require.main===module)server.listen(PORT,'0.0.0.0',()=>console.log(`HOMESTAND listening on ${PORT}`));
module.exports={server,rooms};
