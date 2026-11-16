'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright-core');

const origin=process.env.IRON_FRONTIER_URL||'http://127.0.0.1:3005';
const output=path.join(__dirname,'..','artifacts','milestone-3.6');
const maps=['coastal','desert','frozen'];
const chromePaths=process.platform==='win32'?
 ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe']:
 ['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'];
const executablePath=process.env.CHROME_PATH||chromePaths.find(fs.existsSync);
if(!executablePath)throw new Error('Chrome/Chromium was not found. Set CHROME_PATH.');
fs.mkdirSync(output,{recursive:true});
const failures=[],results={capturedAt:new Date().toISOString(),origin,maps:{},multiplayer:null};
const fail=value=>{if(!failures.includes(value))failures.push(value)};

async function settle(page,ms=650){await page.waitForTimeout(ms)}
async function sampleFps(page,duration=1800){return page.evaluate(ms=>new Promise(resolve=>{let frames=0;const start=performance.now();function tick(now){frames++;if(now-start>=ms)return resolve({fps:Math.round(frames/((now-start)/1000)),renderer:window.Iron3D.metrics()});requestAnimationFrame(tick)}requestAnimationFrame(tick)}),duration)}
async function coverage(page,label){const value=await page.evaluate(()=>window.Iron3D.viewportCoverage());if(value.ratio<1)fail(`${label} terrain coverage ${value.covered}/${value.sampled}`);return value}
async function shot(page,name){await page.screenshot({path:path.join(output,`${name}.png`),fullPage:false})}

async function openBattle(context,mapId,label){
 const page=await context.newPage(),errors=[];
 page.on('console',message=>{if(message.type()==='error')errors.push(`console: ${message.text()}`)});
 page.on('pageerror',error=>errors.push(`page: ${error.message}`));
 page.on('requestfailed',request=>errors.push(`request: ${request.url()} ${request.failure()?.errorText||''}`));
 await page.goto(origin,{waitUntil:'networkidle'});
 await page.evaluate(id=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('iron-frontier-view','3d');localStorage.setItem('iron-frontier-tutorial-complete','1');localStorage.setItem('iron-frontier-name','World QA');localStorage.setItem('iron-frontier-map',id)},mapId);
 await page.reload({waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelector('#network-indicator')?.textContent.includes('CONNECTED'),{timeout:10000});
 await page.locator('#open-operations').click();await page.locator('#solo').click();
 await page.locator('#world3d').waitFor({state:'visible',timeout:15000});
 await settle(page,1400);
 const identity=await page.evaluate(()=>({state:{mapId:window.IronBridge.snapshot().mapId,terrainSeed:window.IronBridge.snapshot().terrainSeed},canvas:document.querySelector('#world3d')?.dataset.map,minimap:document.querySelector('#minimap')?.getContext('2d')?.getImageData(0,0,260,146).data.some((v,i)=>i%4===3&&v)}));
 if(identity.state.mapId!==mapId||identity.canvas!==mapId)fail(`${label} loaded ${identity.state.mapId}/${identity.canvas} instead of ${mapId}`);
 if(!identity.state.terrainSeed||!identity.minimap)fail(`${label} missing terrain seed or minimap`);
 return{page,errors,identity};
}

async function cameraMatrix(page,mapId,suffix){
 const matrix={};
 await page.evaluate(()=>window.Iron3D.resetCamera());await settle(page);matrix.default=await coverage(page,`${mapId} ${suffix} default`);await shot(page,`${mapId}-${suffix}-default`);
 await page.evaluate(()=>window.Iron3D.zoom(9));await settle(page);matrix.zoomIn=await coverage(page,`${mapId} ${suffix} zoom in`);await shot(page,`${mapId}-${suffix}-max-in`);
 await page.evaluate(()=>window.Iron3D.fitBattlefield());await settle(page,850);matrix.zoomOut=await coverage(page,`${mapId} ${suffix} zoom out`);await shot(page,`${mapId}-${suffix}-max-out`);
 const boundaries={west:[0,450],east:[1600,450],north:[800,0],south:[800,900]};
 for(const [name,[x,y]] of Object.entries(boundaries)){
  await page.evaluate(({x,y})=>{window.Iron3D.resetCamera();window.Iron3D.zoom(1.05);window.Iron3D.center(x,y)},{x,y});await settle(page);
  matrix[name]=await coverage(page,`${mapId} ${suffix} ${name}`);await shot(page,`${mapId}-${suffix}-${name}`);
 }
 return matrix;
}

async function verifyDesktopInteraction(page,mapId){
 await page.evaluate(()=>window.Iron3D.resetCamera());await settle(page);
 const canvas=await page.locator('#world3d').boundingBox(),before=await page.evaluate(()=>window.Iron3D.cameraState());
 if(canvas){await page.mouse.move(canvas.x+canvas.width*.48,canvas.y+canvas.height*.48);await page.mouse.wheel(0,-500);await settle(page,250)}
 const zoomed=await page.evaluate(()=>window.Iron3D.cameraState());if(zoomed.desiredRange===before.desiredRange)fail(`${mapId} desktop wheel zoom failed`);
 if(canvas){await page.mouse.move(canvas.x+canvas.width*.55,canvas.y+canvas.height*.55);await page.mouse.down({button:'middle'});await page.mouse.move(canvas.x+canvas.width*.62,canvas.y+canvas.height*.61,{steps:5});await page.mouse.up({button:'middle'});await settle(page,250)}
 const panned=await page.evaluate(()=>window.Iron3D.cameraState());if(panned.target.x===zoomed.target.x&&panned.target.z===zoomed.target.z)fail(`${mapId} desktop middle-drag pan failed`);
 await page.keyboard.press('r');await settle(page,200);const rotated=await page.evaluate(()=>window.Iron3D.cameraState());if(rotated.desiredRotation===before.desiredRotation)fail(`${mapId} keyboard rotation failed`);
 await page.evaluate(()=>window.Iron3D.resetCamera());await settle(page);
 const unit=await page.evaluate(()=>{const rect=document.querySelector('#world3d').getBoundingClientRect();return window.IronBridge.snapshot().units.filter(u=>u.team===window.IronBridge.team()).map(u=>({id:u.id,p:window.Iron3D.screenPoint(u.id)})).find(v=>v.p&&v.p.x>rect.left&&v.p.x<rect.right&&v.p.y>rect.top&&v.p.y<rect.bottom)});
 if(unit){await page.mouse.click(unit.p.x,unit.p.y);await settle(page,180);if(!await page.evaluate(id=>window.IronBridge.selected().has(id),unit.id))fail(`${mapId} desktop selection failed`)}else fail(`${mapId} desktop unit was outside viewport`);
 const beforeMap=await page.evaluate(()=>window.Iron3D.cameraState().target);const mini=await page.locator('#minimap').boundingBox();if(mini){await page.mouse.click(mini.x+mini.width*.7,mini.y+mini.height*.35);await settle(page,300)}const afterMap=await page.evaluate(()=>window.Iron3D.cameraState().target);if(beforeMap.x===afterMap.x&&beforeMap.z===afterMap.z)fail(`${mapId} minimap navigation failed`);
}

async function verifyMobileInteraction(page,mapId){
 await page.evaluate(()=>window.Iron3D.resetCamera());await settle(page);const canvas=await page.locator('#world3d').boundingBox();if(!canvas)return fail(`${mapId} mobile canvas unavailable`);
 const before=await page.evaluate(()=>window.Iron3D.cameraState());
 await page.evaluate(({x,y})=>{const c=document.querySelector('#world3d'),fire=(type,id,px,py)=>c.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:px,clientY:py,bubbles:true,buttons:type==='pointerup'?0:1}));fire('pointerdown',21,x-25,y);fire('pointerdown',22,x+25,y);fire('pointermove',21,x-58,y);fire('pointermove',22,x+58,y);fire('pointerup',21,x-58,y);fire('pointerup',22,x+58,y)},{x:canvas.x+canvas.width/2,y:canvas.y+canvas.height/2});await settle(page,250);
 const pinched=await page.evaluate(()=>window.Iron3D.cameraState());if(pinched.desiredRange===before.desiredRange)fail(`${mapId} mobile pinch failed`);
 await page.evaluate(({x,y})=>{const c=document.querySelector('#world3d'),fire=(type,px,py)=>c.dispatchEvent(new PointerEvent(type,{pointerId:31,pointerType:'touch',clientX:px,clientY:py,bubbles:true,buttons:type==='pointerup'?0:1}));fire('pointerdown',x,y);fire('pointermove',x+55,y+25);fire('pointerup',x+55,y+25)},{x:canvas.x+canvas.width*.45,y:canvas.y+canvas.height*.5});await settle(page,250);
 const dragged=await page.evaluate(()=>window.Iron3D.cameraState());if(dragged.target.x===pinched.target.x&&dragged.target.z===pinched.target.z)fail(`${mapId} mobile drag failed`);
 const overflow=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));if(overflow.document>overflow.viewport+1)fail(`${mapId} mobile horizontal overflow ${JSON.stringify(overflow)}`);return overflow;
}

async function runViewport(browser,mapId,viewport,suffix,mobile=false){
 const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile});
 const opened=await openBattle(context,mapId,`${mapId} ${suffix}`),page=opened.page;
 const matrix=await cameraMatrix(page,mapId,suffix);
 const interaction=mobile?await verifyMobileInteraction(page,mapId):await verifyDesktopInteraction(page,mapId);
 await page.evaluate(()=>window.Iron3D.resetCamera());await settle(page);const performance=await sampleFps(page);let recovery=null;
 if(mapId==='coastal'&&suffix==='desktop'){
  const previous=await page.locator('#world3d').evaluate(canvas=>canvas.dataset.map);await page.evaluate(()=>{const canvas=document.querySelector('#world3d');window.__previousWorldCanvas=canvas;const gl=canvas.getContext('webgl2')||canvas.getContext('webgl'),extension=gl?.getExtension('WEBGL_lose_context');if(extension){extension.loseContext();setTimeout(()=>extension.restoreContext(),120)}else{canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));canvas.dispatchEvent(new Event('webglcontextrestored'))}});await page.waitForFunction(()=>window.Iron3D?.active()&&document.querySelector('#world3d')!==window.__previousWorldCanvas,{timeout:10000});await settle(page,900);recovery=await page.evaluate(()=>({active:window.Iron3D.active(),mapId:document.querySelector('#world3d')?.dataset.map,replaced:document.querySelector('#world3d')!==window.__previousWorldCanvas}));if(!recovery.active||!recovery.replaced||recovery.mapId!==previous)fail(`WebGL recovery failed ${JSON.stringify(recovery)}`);
 }
 if(suffix==='desktop'){await page.locator('#view-mode').click();await page.locator('#world').waitFor({state:'visible'});await shot(page,`${mapId}-2d-fallback`)}
 for(const error of opened.errors)fail(`${mapId} ${suffix} ${error}`);
 await context.close();return{identity:opened.identity,matrix,interaction,performance,recovery};
}

async function runLandscape(browser,mapId){
 const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true}),opened=await openBattle(context,mapId,`${mapId} landscape`),page=opened.page;
 await page.evaluate(()=>window.Iron3D.fitBattlefield());await settle(page,800);const worldCoverage=await coverage(page,`${mapId} landscape max out`),overflow=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));if(overflow.document>overflow.viewport+1)fail(`${mapId} landscape horizontal overflow ${JSON.stringify(overflow)}`);await shot(page,`${mapId}-landscape-max-out`);for(const error of opened.errors)fail(`${mapId} landscape ${error}`);await context.close();return{identity:opened.identity,coverage:worldCoverage,overflow};
}

async function multiplayerSync(browser){
 const hostContext=await browser.newContext({viewport:{width:1100,height:760}}),guestContext=await browser.newContext({viewport:{width:1100,height:760}}),host=await hostContext.newPage(),guest=await guestContext.newPage();
 await host.goto(origin,{waitUntil:'networkidle'});await host.evaluate(()=>{localStorage.clear();localStorage.setItem('iron-frontier-name','Host');localStorage.setItem('iron-frontier-map','desert');localStorage.setItem('iron-frontier-tutorial-complete','1')});await host.reload({waitUntil:'networkidle'});await host.waitForFunction(()=>document.querySelector('#network-indicator')?.textContent.includes('CONNECTED'),{timeout:10000});await host.locator('#open-operations').click();await host.locator('#friend').click();await host.locator('#host').click();await host.locator('.roomcode').waitFor();const code=(await host.locator('.roomcode').textContent()).trim();
 await guest.goto(origin,{waitUntil:'networkidle'});await guest.evaluate(()=>{localStorage.clear();localStorage.setItem('iron-frontier-name','Guest');localStorage.setItem('iron-frontier-map','frozen');localStorage.setItem('iron-frontier-tutorial-complete','1')});await guest.reload({waitUntil:'networkidle'});await guest.waitForFunction(()=>document.querySelector('#network-indicator')?.textContent.includes('CONNECTED'),{timeout:10000});await guest.locator('#open-operations').click();await guest.locator('#friend').click();await guest.locator('#roomField').fill(code);await guest.locator('#friend-form button[type="submit"]').click();await guest.locator('.lobby').waitFor({timeout:10000});try{await host.locator('#launch:not([disabled])').waitFor({state:'visible',timeout:10000})}catch(error){const states=await Promise.all([host,guest].map(page=>page.evaluate(()=>({url:location.href,state:window.IronBridge.snapshot(),text:document.querySelector('.lobby')?.innerText}))));throw new Error(`Multiplayer lobby did not converge: ${JSON.stringify(states)}`,{cause:error})}await host.locator('#launch').click();await host.locator('#world3d').waitFor({timeout:15000});await guest.locator('#world3d').waitFor({timeout:15000});await settle(host,700);
 const values=await Promise.all([host,guest].map(page=>page.evaluate(()=>{const s=window.IronBridge.snapshot();return{mapId:s.mapId,terrainSeed:s.terrainSeed}})));if(values[0].mapId!=='desert'||values[1].mapId!==values[0].mapId||values[1].terrainSeed!==values[0].terrainSeed)fail(`multiplayer map sync failed ${JSON.stringify(values)}`);await hostContext.close();await guestContext.close();return{code,host:values[0],guest:values[1]};
}

async function run(){
 const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist']});
 try{
  if(process.argv.includes('--multiplayer-only')){results.multiplayer=await multiplayerSync(browser);results.failures=failures;fs.writeFileSync(path.join(output,'multiplayer-validation.json'),JSON.stringify(results,null,2));if(failures.length)throw new Error(failures.join('\n'));console.log(JSON.stringify(results.multiplayer,null,2));return}
  const home=await browser.newContext({viewport:{width:1440,height:900}}),page=await home.newPage();await page.goto(origin,{waitUntil:'networkidle'});await shot(page,'map-selection-desktop');await home.close();
  const mobileHome=await browser.newContext({viewport:{width:360,height:800},isMobile:true,hasTouch:true}),mobilePage=await mobileHome.newPage();await mobilePage.goto(origin,{waitUntil:'networkidle'});await mobilePage.screenshot({path:path.join(output,'map-selection-mobile.png'),fullPage:true});await mobileHome.close();
  for(const mapId of maps){results.maps[mapId]={desktop:await runViewport(browser,mapId,{width:1440,height:900},'desktop'),mobile:await runViewport(browser,mapId,{width:360,height:800},'mobile',true),landscape:await runLandscape(browser,mapId)}}
  results.multiplayer=await multiplayerSync(browser);
 }finally{await browser.close()}
 results.failures=failures;fs.writeFileSync(path.join(output,'validation.json'),JSON.stringify(results,null,2));if(failures.length)throw new Error(failures.join('\n'));console.log(JSON.stringify(results,null,2));
}
run().catch(error=>{console.error(error);process.exitCode=1});
