'use strict';
// HOMESTAND service worker: makes the game installable and lets the shell open offline.
// Network-first for everything so a new deploy is picked up immediately; the cache is only a
// fallback when the network is unavailable. Live game traffic (WebSocket) is never touched.
const CACHE='homestand-shell-v1';
const SHELL=['/','/style.css','/3d.css','/game.js','/maps.js','/catalog.js','/audio.js','/platform.js','/home.js','/3d.js','/town.js',
 '/vendor/three.module.js','/vendor/three.core.min.js','/vendor/BufferGeometryUtils.js','/assets/homestand-poster.jpg','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).catch(()=>{}).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==location.origin||url.pathname==='/ws'||url.pathname==='/healthz')return;
 event.respondWith(fetch(request).then(response=>{if(response.ok&&response.type==='basic'){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request.mode==='navigate'?'/':request,copy))}return response})
  .catch(()=>caches.match(request.mode==='navigate'?'/':request,{ignoreSearch:request.mode==='navigate'}).then(hit=>hit||new Response('Offline',{status:503,headers:{'Content-Type':'text/plain'}}))));
});
