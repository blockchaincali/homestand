'use strict';
// Renders public/assets/homestand-poster.jpg from the in-engine homepage scene, so the
// static poster shown before WebGL starts is the same original world players will see.
// Usage: start the server, then `node scripts/render-poster.js` (IRON_FRONTIER_URL overrides).
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright-core');
const origin=process.env.IRON_FRONTIER_URL||'http://127.0.0.1:3100';
const chromePaths=process.platform==='win32'?['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']:['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'];
const executablePath=process.env.CHROME_PATH||chromePaths.find(fs.existsSync);
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath,args:['--enable-webgl','--ignore-gpu-blocklist']});
 const page=await (await browser.newContext({viewport:{width:1200,height:675},deviceScaleFactor:2})).newPage();
 page.on('pageerror',error=>console.error('page error',error.message));
 await page.goto(origin+'/?poster=1',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.__posterReady===true,null,{timeout:30000});await page.waitForTimeout(400);
 const data=await page.evaluate(()=>document.querySelector('.home-canvas').toDataURL('image/jpeg',.86));
 const file=path.join(__dirname,'..','public','assets','homestand-poster.jpg');fs.writeFileSync(file,Buffer.from(data.split(',')[1],'base64'));
 const size=await page.evaluate(()=>({w:document.querySelector('.home-canvas').width,h:document.querySelector('.home-canvas').height}));
 console.log(JSON.stringify({file,bytes:fs.statSync(file).size,...size}));await browser.close();
})().catch(error=>{console.error(error);process.exitCode=1});
