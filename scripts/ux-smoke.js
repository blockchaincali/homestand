'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright-core');

const origin=process.env.IRON_FRONTIER_URL||'http://127.0.0.1:3002';
const chromePaths=process.platform==='win32'?
 ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe']:
 ['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'];
const executablePath=process.env.CHROME_PATH||chromePaths.find(fs.existsSync);
if(!executablePath)throw new Error('Chrome/Chromium was not found. Set CHROME_PATH to run UX smoke tests.');

const output=path.join(__dirname,'..','artifacts','milestone-2');
fs.mkdirSync(output,{recursive:true});
const failures=[];

async function assertNoOverflow(page,label){
 const sizes=await page.evaluate(()=>({viewport:innerWidth,body:document.body.scrollWidth,html:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('*')].map(element=>({tag:element.tagName,id:element.id,className:typeof element.className==='string'?element.className:'',left:Math.round(element.getBoundingClientRect().left),right:Math.round(element.getBoundingClientRect().right),width:Math.round(element.getBoundingClientRect().width)})).filter(item=>item.right>innerWidth+1||item.left< -1).slice(0,8)}));
 if(sizes.html>sizes.viewport+1||sizes.offenders.length)failures.push(`${label} horizontal overflow: ${JSON.stringify(sizes)}`);
}

async function setupPage(context,label){
 const page=await context.newPage();
 page.on('console',message=>{if(message.type()==='error')failures.push(`${label} console: ${message.text()}`)});
 page.on('pageerror',error=>failures.push(`${label} page error: ${error.message}`));
 page.on('requestfailed',request=>failures.push(`${label} request failed: ${request.url()} ${request.failure()?.errorText||''}`));
 await page.goto(origin,{waitUntil:'networkidle'});
 await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('iron-frontier-view','2d')});
 await page.reload({waitUntil:'networkidle'});
 return page;
}

async function clickWorld(page,x,y){
 const point=await page.evaluate(({x,y})=>window.IronBridge.project(x,y),{x,y});
 if(!point)throw new Error('Battlefield projection unavailable');
 await page.mouse.click(point.x,point.y);
}
const title=(page,text,timeout=15000)=>page.locator('#mission-title').filter({hasText:text}).waitFor({timeout});

// Field training is the single onboarding path: Operation Safe Haven, played with real controls.
async function runDesktop(browser){
 const context=await browser.newContext({viewport:{width:1366,height:768},deviceScaleFactor:1});
 const page=await setupPage(context,'desktop');
 await page.screenshot({path:path.join(output,'home-desktop.png'),fullPage:true});
 await assertNoOverflow(page,'desktop home');
 await page.locator('#open-operations').click();await page.locator('#tutorial').click();
 await title(page,'Explore the town');
 const protectedStart=await page.evaluate(()=>{const state=window.IronBridge.snapshot();return {training:state.training,time:state.time,stage:state.mission.stage,hp:state.units.filter(unit=>unit.team===0).map(unit=>unit.hp)}});
 await page.waitForTimeout(2200);
 const protectedLater=await page.evaluate(()=>{const state=window.IronBridge.snapshot();return {training:state.training,time:state.time,stage:state.mission.stage,hp:state.units.filter(unit=>unit.team===0).map(unit=>unit.hp),hostiles:state.units.filter(unit=>unit.team===1).length}});
 if(!protectedStart.training||protectedStart.stage!=='tutorial'||!protectedLater.training||protectedLater.time!==protectedStart.time||protectedLater.hostiles||JSON.stringify(protectedLater.hp)!==JSON.stringify(protectedStart.hp))throw new Error(`Tutorial protection failed: ${JSON.stringify({protectedStart,protectedLater})}`);
 await page.screenshot({path:path.join(output,'tutorial-desktop.png'),fullPage:true});
 await page.locator('#zoom-in').click();
 await title(page,'Select your engineer');
 const engineer=await page.evaluate(()=>window.IronBridge.snapshot().units.find(unit=>unit.type==='engineer'));
 await clickWorld(page,engineer.x,engineer.y);
 await title(page,'Build a barracks');
 if(!await page.locator('[data-structure="barracks"]').isVisible())await page.locator('#build-toggle').click();
 await page.locator('[data-structure="barracks"]').click();await clickWorld(page,430,560);await page.locator('#confirm-placement:not([disabled])').click();
 await page.screenshot({path:path.join(output,'tutorial-construction-desktop.png'),fullPage:true});
 await title(page,'Train a response squad',25000);
 const barracks=await page.evaluate(()=>window.IronBridge.snapshot().structures.find(value=>value.type==='barracks'));
 await clickWorld(page,barracks.x,barracks.y);await page.locator('#produce-infantry:not([disabled])').click();
 await title(page,'Move into position',15000);
 await page.locator('#select-all').click();await page.locator('[data-action="move"]').click();await clickWorld(page,860,600);
 await title(page,'Collect field supplies');
 const cache=await page.evaluate(()=>window.IronBridge.snapshot().caches.find(value=>value.claimedBy===null&&value.reward==='credits'));
 await page.locator('#select-all').click();await page.locator('[data-action="move"]').click();await clickWorld(page,cache.x,cache.y);
 await title(page,'Prepare, then begin',20000);
 await page.waitForFunction(()=>window.IronBridge.snapshot().mission.stage==='prepare');
 await page.locator('#begin-defense:not([disabled])').click();
 await page.waitForFunction(()=>window.IronBridge.snapshot().mission.stage==='warning');await page.locator('#begin-defense:not([disabled])').click();
 await title(page,'Repel the first attack');
 await page.waitForFunction(()=>{const state=window.IronBridge.snapshot();return state.training===false&&state.mission.stage==='protect'&&state.units.some(unit=>unit.team===1)});
 await page.locator('#tutorial-ready').click();
 await page.getByText('Field training complete — Abuja is counting on you',{exact:true}).waitFor();
 await page.screenshot({path:path.join(output,'battle-desktop.png'),fullPage:true});
 await assertNoOverflow(page,'desktop battle');
 await context.close();
}

async function runMobile(browser){
 const context=await browser.newContext({viewport:{width:360,height:800},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await setupPage(context,'mobile');
 await page.screenshot({path:path.join(output,'home-mobile.png'),fullPage:true});
 await assertNoOverflow(page,'mobile home');
 await page.locator('#open-operations').tap();await page.locator('#tutorial').tap();
 await title(page,'Explore the town');
 await page.screenshot({path:path.join(output,'tutorial-mobile.png'),fullPage:true});
 await assertNoOverflow(page,'mobile tutorial');
 await page.locator('#tutorial-skip').tap();
 await page.waitForFunction(()=>{const state=window.IronBridge.snapshot();return state.mission.stage==='prepare'&&[...window.IronBridge.selected()].length>0},{timeout:5000});
 await page.waitForTimeout(800);
 await page.screenshot({path:path.join(output,'battle-mobile.png'),fullPage:true});
 await assertNoOverflow(page,'mobile battle');
 await context.close();
}

(async()=>{
 const browser=await chromium.launch({headless:true,executablePath,args:['--disable-gpu','--no-sandbox']});
 try{await runDesktop(browser);await runMobile(browser)}finally{await browser.close()}
 if(failures.length)throw new Error(failures.join('\n'));
 console.log('UX smoke passed: eight-step guided field training, protection, console/network checks, screenshots, and 360px overflow validation.');
})().catch(error=>{console.error(error);process.exitCode=1});
