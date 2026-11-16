// HOMESTAND platform adapter. The standalone web build implements every hook locally.
// Inside Vatar's Lagos Life Games app the same object is upgraded in place with the official
// Vatar Games SDK (identity, lifecycle, leaderboards). Gameplay never depends on the platform:
// if the SDK is missing or refuses, the game keeps running standalone. See
// docs/PLATFORM_INTEGRATION.md.
(function(root){
 'use strict';
 if(root.HomestandPlatform)return;
 const listeners=new Map();
 // The SDK is served from Lagos Life; vatarverse.com is the newer home, tried if the first fails.
 const VATAR_SDKS=['https://lagoslife.app/sdk/vatar-games-v1.js','https://vatarverse.com/sdk/vatar-games-v1.js'];
 const VATAR_ORIGINS=['https://lagoslife.app','https://www.lagoslife.app','https://naijalife.app','https://www.naijalife.app','https://lagoslife.eliysites.com','https://vatarverse.com','https://www.vatarverse.com'];
 const framed=(()=>{try{return root.self!==root.top}catch{return true}})();
 const params=new URLSearchParams(root.location?.search||'');
 const ancestors=[...(root.location?.ancestorOrigins||[])];
 // The address registered with Vatar carries ?host=vatar; ancestorOrigins confirms it where browsers expose it.
 const vatarHost=framed&&(params.get('host')==='vatar'||ancestors.some(origin=>VATAR_ORIGINS.includes(origin)));
 const store=key=>{try{return localStorage.getItem(key)}catch{return null}};
 // The Lagos Life edition (fictional places, gentler wording) is on inside Vatar, or with ?edition=lagoslife to preview it.
 const edition=vatarHost||params.get('edition')==='lagoslife'?'lagoslife':'standard';
 root.IronMaps?.setEdition?.(edition);

 const platform={
  id:'standalone',
  framed,
  edition,
  // Display identity. Standalone uses the name typed on the home screen; Vatar supplies a verified one.
  identity:null,
  player(){return platform.identity?{...platform.identity,verified:true}:{name:store('iron-frontier-name')||'Commander',verified:false}},
  emit(event,detail={}){for(const fn of listeners.get(event)||[])try{fn(detail)}catch(error){console.warn('Platform listener failed',event,error)}},
  on(event,fn){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn);return ()=>listeners.get(event)?.delete(fn)},
  // What the host allows. Framed pages get no fullscreen, popups, clipboard or install prompt.
  capabilities:{accounts:false,purchases:false,leaderboards:false,share:!framed&&typeof navigator!=='undefined'&&Boolean(navigator.share),install:!framed,fullscreen:!framed,clipboard:!framed},
  submitScore:async()=>null,
  // Purchases: session() gives a fresh token for our server; purchase() opens the host's pay sheet.
  session:async()=>null,
  purchase:async()=>{throw Object.assign(new Error('unsupported'),{code:'unsupported'})},
  unclaimedPurchases:async()=>[],
  leaderboard:async()=>null,
  ready:Promise.resolve(null)
 };
 root.HomestandPlatform=platform;
 if(!vatarHost)return;

 // ---------- Vatar (Lagos Life) adapter ----------
 platform.ready=new Promise(resolve=>{
  const fail=reason=>{console.warn('Vatar SDK unavailable - running standalone:',reason);resolve(null)};
  const load=index=>{
  const script=document.createElement('script');script.src=VATAR_SDKS[index];script.async=true;
  script.onerror=()=>index+1<VATAR_SDKS.length?load(index+1):fail('script failed to load');
  script.onload=async()=>{
   const Vatar=root.Vatar;if(!Vatar?.init)return fail('no SDK object');
   try{
    const {player,mode,session}=await Vatar.init();let token={session,at:Date.now()};
    platform.id='vatar';platform.mode=mode;
    platform.identity={id:player.id,name:String(player.name||'Commander').slice(0,18),avatar:player.avatar||null};
    platform.capabilities={...platform.capabilities,accounts:true,leaderboards:true,purchases:typeof Vatar.purchase==='function'};
    // Tokens last 15 minutes: reuse the init token briefly, otherwise ask for a fresh one.
    platform.session=async()=>{if(token.session&&Date.now()-token.at<60000)return token.session;const fresh=await Vatar.session();token={session:fresh?.session||fresh,at:Date.now()};return token.session};
    platform.purchase=productId=>Vatar.purchase(productId);
    platform.unclaimedPurchases=()=>Promise.resolve(Vatar.purchases?.()).then(list=>Array.isArray(list)?list:list?.purchases||[]).catch(()=>[]);
    Vatar.onPurchase?.(p=>platform.emit('purchase',p));
    // Scores: whole numbers, one submission per 20 s (the SDK enforces it); the board keeps each player's best.
    platform.submitScore=n=>Vatar.submitScore(Math.max(0,Math.round(Number(n)||0))).catch(error=>{console.warn('Score not submitted',error?.code||error);return null});
    platform.leaderboard=()=>Vatar.leaderboard().catch(error=>{console.warn('Leaderboard unavailable',error?.code||error);return null});
    Vatar.onPause?.(()=>platform.emit('pause'));Vatar.onResume?.(()=>platform.emit('resume'));
    platform.emit('identity',platform.player());
    resolve(platform.identity);
   }catch(error){fail(error?.code||error?.message||error)}
  };
  document.head.append(script);
  };
  load(0);
 });
})(typeof globalThis!=='undefined'?globalThis:this);
