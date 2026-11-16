'use strict';
// Visual acceptance capture for the immersive redesign. Produces the review set in
// artifacts/immersive-v2/after: home (poster + live scene), operations, how-to-play,
// guided training, construction, production, civilian-defense combat and results,
// at desktop, laptop, two landscape phones and the portrait fallback.
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright-core');
const origin=process.env.IRON_FRONTIER_URL||'http://127.0.0.1:3100',out=path.join(__dirname,'..','artifacts','immersive-v2','after');
const chromePaths=process.platform==='win32'?['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']:['/usr/bin/google-chrome','/usr/bin/chromium'];
const executablePath=process.env.CHROME_PATH||chromePaths.find(fs.existsSync);fs.mkdirSync(out,{recursive:true});
const views=[['desktop-1440',{width:1440,height:900},false],['desktop-1365',{width:1365,height:768},false],['mobile-844',{width:844,height:390},true],['mobile-932',{width:932,height:430},true],['portrait-390',{width:390,height:844},true]];
const failures=[],timings={};
async function open(browser,viewport,mobile,returning){const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile}),page=await context.newPage();page.on('pageerror',e=>failures.push(e.message));page.on('console',m=>{if(m.type()==='error')failures.push(m.text())});const t0=Date.now();await page.goto(origin,{waitUntil:'domcontentloaded'});await page.locator('#play-now').waitFor();const firstAction=Date.now()-t0;await page.evaluate(r=>{localStorage.clear();sessionStorage.clear();if(r)localStorage.setItem('homestand-safe-haven-tutorial','1')},returning);await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelector('#network-indicator')?.textContent.includes('CONNECTED'));return {context,page,firstAction}}
const press=async(page,selector,mobile)=>mobile?page.locator(selector).tap():page.locator(selector).click();
(async()=>{const browser=await chromium.launch({headless:true,executablePath,args:['--enable-webgl','--ignore-gpu-blocklist']});
 for(const [name,viewport,mobile] of views){const shot=label=>page.screenshot({path:path.join(out,`${name}-${label}.png`)});let {context,page,firstAction}=await open(browser,viewport,mobile,false);timings[name]={firstActionMs:firstAction};
  try{
   await shot('01-home-poster');await page.waitForFunction(()=>document.querySelector('.home-stage')?.classList.contains('scene-ready'),null,{timeout:15000});await page.waitForTimeout(5200);await shot('02-home-cinematic');
   await press(page,'#how-to-play',mobile);await page.waitForTimeout(700);await shot('03-how-to-play');await press(page,'#how-back',mobile);
   await press(page,'#open-operations',mobile);await page.waitForTimeout(500);await shot('04-operations-commander');await press(page,'#ops-back',mobile);
   const start=Date.now();await press(page,'#play-now',mobile);await page.locator('#world3d').waitFor({timeout:20000});await page.waitForFunction(()=>window.Iron3D.metrics().fps>0);timings[name].battleReadyMs=Date.now()-start;
   await page.waitForTimeout(1600);await shot('05-intro-cinematic');await page.waitForTimeout(5600);await shot('06-training-coach');
   await page.evaluate(()=>window.IronBridge.tutorialCamera());await page.evaluate(()=>window.IronBridge.selectAll());
   if(!await page.locator('[data-structure="barracks"]').isVisible())await press(page,'#build-toggle',mobile);await press(page,'[data-structure="barracks"]',mobile);const site=await page.evaluate(()=>window.Iron3D.worldPoint(430,560));if(mobile)await page.touchscreen.tap(site.x,site.y);else await page.mouse.click(site.x,site.y);await page.waitForTimeout(300);await shot('07-placement-preview');
   await press(page,'#confirm-placement:not([disabled])',mobile);await page.waitForTimeout(3500);await shot('08-construction-progress');
   await page.waitForFunction(()=>window.IronBridge.snapshot().structures.some(s=>s.type==='barracks'&&s.status==='active'),null,{timeout:20000});await page.evaluate(()=>{const b=window.IronBridge.snapshot().structures.find(s=>s.type==='barracks');window.IronBridge.handle({x:b.x,y:b.y})});await press(page,'#produce-infantry:not([disabled])',mobile);await page.waitForTimeout(900);await shot('09-barracks-production');
   await press(page,'#tutorial-skip',mobile);await page.waitForFunction(()=>window.IronBridge.snapshot().mission.stage==='prepare');await page.waitForTimeout(600);await shot('10-preparation');
   await press(page,'#begin-defense:not([disabled])',mobile);await page.waitForFunction(()=>window.IronBridge.snapshot().units.some(u=>u.team===1));await page.evaluate(()=>{window.IronBridge.selectAll();window.IronBridge.handle({x:1150,y:560})});await page.waitForTimeout(1200);await shot('11-wave-warning');
   await page.waitForFunction(()=>window.IronBridge.snapshot().projectiles.length>0,null,{timeout:45000});await page.evaluate(()=>{const s=window.IronBridge.snapshot(),p=s.projectiles[0];window.Iron3D.center(p.x,p.y)});await page.waitForTimeout(500);await shot('12-civilian-defense-combat');
   await press(page,'#menu-toggle',mobile);await page.waitForTimeout(300);await shot('13-pause-menu');await press(page,'#surrender',mobile);await press(page,'#surrender-confirm',mobile);await page.locator('.result').waitFor();await page.waitForTimeout(900);await shot('14-results');
  }catch(error){failures.push(name+': '+error.message.split('\n')[0]);await shot('error')}
  await context.close()}
 await browser.close();fs.writeFileSync(path.join(out,'capture-report.json'),JSON.stringify({capturedAt:new Date().toISOString(),origin,timings,failures},null,2));console.log(JSON.stringify({timings,failures},null,2));if(failures.length)process.exitCode=1})().catch(e=>{console.error(e);process.exitCode=1});
