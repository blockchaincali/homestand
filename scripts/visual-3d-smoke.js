'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright-core');

const origin=process.env.IRON_FRONTIER_URL||'http://127.0.0.1:3003';
const baseline=process.argv.includes('--baseline');
const chromePaths=process.platform==='win32'?
 ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe']:
 ['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'];
const executablePath=process.env.CHROME_PATH||chromePaths.find(fs.existsSync);
if(!executablePath)throw new Error('Chrome/Chromium was not found. Set CHROME_PATH.');
const artifactSet=process.env.IRON_ARTIFACT_SET||'milestone-3';
const output=path.join(__dirname,'..','artifacts',artifactSet);
fs.mkdirSync(output,{recursive:true});
const failures=[];

async function measuredMetrics(page,duration=1500){
 return page.evaluate(ms=>new Promise(resolve=>{let frames=0;const start=performance.now();function tick(now){frames++;if(now-start>=ms){resolve({...window.Iron3D.metrics(),fps:Math.round(frames/((now-start)/1000)),measuredSeconds:(now-start)/1000});return}requestAnimationFrame(tick)}requestAnimationFrame(tick)}),duration);
}

async function performanceSample(page,count=3){
 const samples=[];for(let i=0;i<count;i++)samples.push(await measuredMetrics(page,1000));
 return {...samples.at(-1),fps:Math.round(samples.reduce((sum,value)=>sum+value.fps,0)/samples.length),minimumFps:Math.min(...samples.map(value=>value.fps)),samples:samples.map(value=>value.fps)};
}

async function prepare(context,label){
 const page=await context.newPage();
 page.on('console',message=>{if(message.type()==='error')failures.push(`${label} console: ${message.text()}`)});
 page.on('pageerror',error=>failures.push(`${label} page error: ${error.message}`));
 page.on('requestfailed',request=>failures.push(`${label} request failed: ${request.url()} ${request.failure()?.errorText||''}`));
 await page.goto(origin,{waitUntil:'networkidle'});
 await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('iron-frontier-view','3d');localStorage.setItem('iron-frontier-tutorial-complete','1');localStorage.setItem('iron-frontier-name','Visual QA');});
 await page.reload({waitUntil:'networkidle'});
 await page.locator('#open-operations').click();await page.locator('#solo').click();
 await page.locator('#world3d').waitFor({state:'visible',timeout:15000});
 await page.waitForTimeout(2500);
 const webgl=await page.evaluate(()=>{const canvas=document.querySelector('#world3d');const gl=canvas?.getContext('webgl2')||canvas?.getContext('webgl');if(!gl)return null;const ext=gl.getExtension('WEBGL_debug_renderer_info');return {version:gl.getParameter(gl.VERSION),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};});
 if(!webgl)failures.push(`${label}: WebGL context unavailable`);
 return {page,webgl};
}

async function run(){
 const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist']});
 const results={capturedAt:new Date().toISOString(),baseline,failures,desktop:null,mobile:null};
 try{
  const desktopContext=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const {page,webgl}=await prepare(desktopContext,'desktop');
  const minimap=await page.evaluate(()=>{const canvas=document.querySelector('#minimap'),ctx=canvas?.getContext('2d');if(!ctx)return null;const data=ctx.getImageData(0,0,canvas.width,canvas.height).data,colors=new Set();for(let i=0;i<data.length;i+=320)colors.add(`${data[i]},${data[i+1]},${data[i+2]},${data[i+3]}`);return {colors:colors.size,nonEmpty:[...data].some((value,index)=>index%4===3&&value>0)}});
  if(!minimap?.nonEmpty||minimap.colors<3)failures.push(`desktop minimap did not render: ${JSON.stringify(minimap)}`);
  const desktopUnit=await page.evaluate(()=>{const rect=document.querySelector('#world3d').getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;return window.IronBridge.snapshot().units.filter(unit=>unit.team===window.IronBridge.team()).map(unit=>({id:unit.id,point:window.Iron3D.screenPoint(unit.id)})).filter(value=>value.point&&value.point.x>rect.left+8&&value.point.x<rect.right-8&&value.point.y>rect.top+8&&value.point.y<rect.bottom-8).sort((a,b)=>Math.hypot(a.point.x-cx,a.point.y-cy)-Math.hypot(b.point.x-cx,b.point.y-cy))[0]||null});
  if(desktopUnit?.point){await page.mouse.click(desktopUnit.point.x,desktopUnit.point.y);await page.waitForTimeout(180);const selected=await page.evaluate(id=>window.IronBridge.selected().has(id),desktopUnit.id);if(!selected)failures.push('desktop mouse unit selection failed in 3D')}
  else failures.push('desktop 3D unit projection unavailable');
  const cameraBefore=await page.evaluate(()=>window.Iron3D.cameraState());
  const canvasBox=await page.locator('#world3d').boundingBox();
  if(canvasBox)await page.mouse.move(canvasBox.x+canvasBox.width*.5,canvasBox.y+canvasBox.height*.5);
  await page.mouse.wheel(0,-420);await page.waitForTimeout(250);
  const cameraAfter=await page.evaluate(()=>window.Iron3D.cameraState());
  if(cameraBefore.desiredRange===cameraAfter.desiredRange)failures.push('desktop mouse-wheel zoom did not change camera range');
  await page.evaluate(()=>window.Iron3D.resetCamera());
  const steadyMetrics=await performanceSample(page);
  await page.screenshot({path:path.join(output,baseline?'before-desktop-3d.png':'after-desktop-3d.png'),fullPage:false});
  if(!baseline){
   for(let i=0;i<8;i++){const recruit=page.locator('[data-build="rifle"]'),before=await page.evaluate(()=>window.IronBridge.snapshot().units.length);if(await recruit.isEnabled()){await recruit.click();await page.waitForFunction(count=>window.IronBridge.snapshot().units.length>count,before,{timeout:3000})}}
   await page.waitForTimeout(650);await page.locator('#select-all').click();
   const selectedCount=await page.evaluate(()=>window.IronBridge.selected().size),startUnits=await page.evaluate(()=>window.IronBridge.snapshot().units.length);
   if(selectedCount<8)failures.push(`crowded selection unexpectedly small: ${selectedCount}`);
   if(startUnits<12)failures.push(`crowded battle started with only ${startUnits} units`);
   await page.evaluate(()=>window.Iron3D?.focusSelection());await page.waitForTimeout(300);
   await page.screenshot({path:path.join(output,'crowded-battle.png'),fullPage:false});
   const samples=[];for(let i=0;i<5;i++)samples.push(await measuredMetrics(page,1000));
   results.crowded={startUnits,endUnits:await page.evaluate(()=>window.IronBridge.snapshot().units.length),selected:selectedCount,minimumFps:Math.min(...samples.map(value=>value.fps)),averageFps:Math.round(samples.reduce((sum,value)=>sum+value.fps,0)/samples.length),samples:samples.map(value=>value.fps),maximumDrawCalls:Math.max(...samples.map(value=>value.drawCalls)),maximumTriangles:Math.max(...samples.map(value=>value.triangles))};
   for(const target of ['rifle','tank','hq']){
    await page.evaluate(value=>window.Iron3D?.inspect(value),target);
    await page.waitForTimeout(650);
    await page.screenshot({path:path.join(output,`closeup-${target}.png`),fullPage:false});
   }
   await page.evaluate(()=>{window.Iron3D.resetCamera();window.Iron3D.center(800,210);window.Iron3D.zoom(.8)});await page.waitForTimeout(700);
   await page.screenshot({path:path.join(output,'terrain-detail.png'),fullPage:false});
   await page.evaluate(()=>{window.Iron3D?.resetCamera();window.Iron3D?.center(800,450);window.Iron3D?.zoom(1.05)});
   await page.locator('#select-all').click();
   const box=await page.locator('#world3d').boundingBox();
   await page.evaluate(()=>{const state=window.IronBridge?.snapshot();const enemy=state?.units?.find(unit=>unit.team!==window.IronBridge.team());if(enemy)window.IronBridge.handle({x:enemy.x,y:enemy.y},false,false)});
   await page.waitForFunction(()=>window.IronBridge?.snapshot()?.projectiles?.length>0,{timeout:25000});
   await page.evaluate(()=>{const shot=window.IronBridge?.snapshot()?.projectiles?.[0];if(shot)window.Iron3D?.center(shot.x,shot.y)});
   await page.waitForTimeout(35);
   await page.screenshot({path:path.join(output,'active-combat.png'),fullPage:false});
   await page.locator('[data-action="orbital"]').click();
   await page.evaluate(()=>window.IronBridge?.handle({x:800,y:450},false,false));
   await page.waitForTimeout(700);
   await page.screenshot({path:path.join(output,'orbital-anticipation.png'),fullPage:false});
   await page.waitForTimeout(900);
   await page.screenshot({path:path.join(output,'orbital-impact.png'),fullPage:false});
   await page.locator('#view-mode').click();
   await page.locator('#world').waitFor({state:'visible'});
   await page.screenshot({path:path.join(output,'fallback-2d.png'),fullPage:false});
  }
  results.desktop={webgl,metrics:steadyMetrics};
  await desktopContext.close();
  if(!baseline){
   const mobileContext=await browser.newContext({viewport:{width:360,height:800},deviceScaleFactor:1,isMobile:true,hasTouch:true});
   const mobile=await prepare(mobileContext,'mobile');
   const mobileUnit=await mobile.page.evaluate(()=>{const rect=document.querySelector('#world3d').getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;return window.IronBridge.snapshot().units.filter(unit=>unit.team===window.IronBridge.team()).map(unit=>({id:unit.id,point:window.Iron3D.screenPoint(unit.id)})).filter(value=>value.point&&value.point.x>rect.left+8&&value.point.x<rect.right-8&&value.point.y>rect.top+8&&value.point.y<rect.bottom-8).sort((a,b)=>Math.hypot(a.point.x-cx,a.point.y-cy)-Math.hypot(b.point.x-cx,b.point.y-cy))[0]||null});
   if(mobileUnit?.point){await mobile.page.touchscreen.tap(mobileUnit.point.x,mobileUnit.point.y);await mobile.page.waitForTimeout(180);const selected=await mobile.page.evaluate(id=>window.IronBridge.selected().has(id),mobileUnit.id);if(!selected)failures.push('mobile touch unit selection failed in 3D')}
   else failures.push('mobile 3D unit projection unavailable');
   await mobile.page.locator('#select-all').tap();
   const mobileBox=await mobile.page.locator('#world3d').boundingBox();
   const touchBefore=await mobile.page.evaluate(()=>window.Iron3D.cameraState().desiredRange);
   if(mobileBox)await mobile.page.evaluate(({x,y})=>{const canvas=document.querySelector('#world3d'),fire=(type,id,px,py)=>canvas.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:px,clientY:py,bubbles:true,buttons:type==='pointerup'?0:1}));fire('pointerdown',11,x-30,y);fire('pointerdown',12,x+30,y);fire('pointermove',11,x-55,y);fire('pointermove',12,x+55,y);fire('pointerup',11,x-55,y);fire('pointerup',12,x+55,y)},{x:mobileBox.x+mobileBox.width/2,y:mobileBox.y+mobileBox.height/2});
   await mobile.page.waitForTimeout(250);const touchAfter=await mobile.page.evaluate(()=>window.Iron3D.cameraState().desiredRange);
   if(touchBefore===touchAfter)failures.push('mobile pinch gesture did not change camera range');
   const overflow=await mobile.page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
   if(overflow.document>overflow.viewport+1)failures.push(`mobile horizontal overflow: ${JSON.stringify(overflow)}`);
   const mobileMetrics=await performanceSample(mobile.page,5);
   await mobile.page.screenshot({path:path.join(output,'mobile-3d.png'),fullPage:false});
   results.mobile={webgl:mobile.webgl,metrics:mobileMetrics,overflow};
   await mobileContext.close();
  }
 }finally{await browser.close()}
 fs.writeFileSync(path.join(output,baseline?'baseline.json':'performance.json'),JSON.stringify(results,null,2));
 if(failures.length)throw new Error(failures.join('\n'));
 console.log(JSON.stringify(results,null,2));
}
run().catch(error=>{console.error(error);process.exitCode=1});
