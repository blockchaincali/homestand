'use strict';
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const {chromium}=require('playwright-core');

const origin=process.env.IRON_FRONTIER_URL||'http://127.0.0.1:3007';
const durationSeconds=Number(process.env.IRON_PROFILE_SECONDS||120);
const label=(process.argv.find(value=>value.startsWith('--label='))||'--label=profile').slice(8);
const chromePaths=process.platform==='win32'?
 ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe']:
 ['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'];
const executablePath=process.env.CHROME_PATH||chromePaths.find(fs.existsSync);
if(!executablePath)throw new Error('Chrome/Chromium was not found. Set CHROME_PATH.');
const output=path.join(__dirname,'..','artifacts','release-performance');
fs.mkdirSync(output,{recursive:true});

const percentile=(values,p)=>values.length?values[Math.min(values.length-1,Math.floor((values.length-1)*p))]:0;
const average=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;

async function run(){
 const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist','--enable-precise-memory-info']});
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const page=await context.newPage(),failures=[],samples=[],ws={receivedFrames:0,receivedBytes:0,sentFrames:0,sentBytes:0};
 page.on('console',message=>{if(message.type()==='error')failures.push(`console: ${message.text()}`)});
 page.on('pageerror',error=>failures.push(`page: ${error.message}`));
 page.on('requestfailed',request=>failures.push(`request: ${request.url()} ${request.failure()?.errorText||''}`));
 await page.addInitScript(()=>{
  const state=window.__ironProfile={frames:[],longTasks:[],inputLatency:[],mutations:0,lastFrame:0};
  const frame=now=>{if(state.lastFrame)state.frames.push(now-state.lastFrame);state.lastFrame=now;requestAnimationFrame(frame)};requestAnimationFrame(frame);
  try{new PerformanceObserver(list=>{for(const item of list.getEntries())state.longTasks.push({start:item.startTime,duration:item.duration})}).observe({entryTypes:['longtask']})}catch{}
  addEventListener('pointerdown',()=>{const start=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>state.inputLatency.push(performance.now()-start)))},{capture:true});
  addEventListener('DOMContentLoaded',()=>{new MutationObserver(records=>{state.mutations+=records.length}).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true})});
 });
 const cdp=await context.newCDPSession(page);
 await cdp.send('Performance.enable');await cdp.send('Network.enable');
 cdp.on('Network.webSocketFrameReceived',event=>{ws.receivedFrames++;ws.receivedBytes+=event.response.payloadData.length});
 cdp.on('Network.webSocketFrameSent',event=>{ws.sentFrames++;ws.sentBytes+=event.response.payloadData.length});
 await cdp.send('Tracing.start',{categories:'devtools.timeline,v8.execute,blink.user_timing,gpu,disabled-by-default-devtools.timeline.frame,disabled-by-default-v8.gc',transferMode:'ReturnAsStream'});
 try{
  await page.goto(origin,{waitUntil:'networkidle'});
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('iron-frontier-view','3d');localStorage.setItem('iron-frontier-tutorial-complete','1');localStorage.setItem('iron-frontier-name','Performance QA')});
  await page.reload({waitUntil:'networkidle'});await page.locator('#open-operations').click();await page.locator('#solo').click();await page.locator('#world3d').waitFor({state:'visible',timeout:15000});await page.waitForTimeout(2500);
  await page.locator('#select-all').click();
  const started=Date.now(),finish=started+durationSeconds*1000;let nextRecruit=0,nextCommand=0,nextOrbital=45;
  while(Date.now()<finish){
   const elapsed=(Date.now()-started)/1000;
   if(await page.locator('#world3d').count()===0){const again=page.locator('#again');if(await again.count()){await again.click();await page.locator('#world3d').waitFor({state:'visible',timeout:15000});nextRecruit=elapsed;nextCommand=elapsed;nextOrbital=Math.max(nextOrbital,elapsed+20);continue}throw new Error('Battlefield left active play without a rematch control')}
   if(elapsed>=nextRecruit){
    const choices=['rifle','tank','rocket'];for(const type of choices){const button=page.locator(`[data-build="${type}"]`);if(await button.count()&&await button.isEnabled()){await button.click();break}}
    nextRecruit+=2.5;
   }
   if(elapsed>=nextCommand){
    await page.locator('#select-all').click();
    await page.evaluate(()=>{const state=window.IronBridge.snapshot(),team=window.IronBridge.team(),enemy=state.units.find(unit=>unit.team!==team);window.IronBridge.handle(enemy?{x:enemy.x,y:enemy.y}:{x:800,y:450},false,false)});
    nextCommand+=8;
   }
   if(elapsed>=nextOrbital){
    await page.locator('[data-action="orbital"]').click();await page.evaluate(()=>window.IronBridge.handle({x:800,y:450},false,false));nextOrbital+=45;
   }
   const browserMetrics=await cdp.send('Performance.getMetrics'),heap=await cdp.send('Runtime.getHeapUsage'),dom=await cdp.send('Memory.getDOMCounters');
   const metrics=Object.fromEntries(browserMetrics.metrics.map(item=>[item.name,item.value]));
   samples.push({second:Math.round(elapsed),renderer:await page.evaluate(()=>window.Iron3D.metrics()),heapUsed:heap.usedSize,heapTotal:heap.totalSize,documents:dom.documents,nodes:dom.nodes,listeners:dom.jsEventListeners,taskDuration:metrics.TaskDuration,scriptDuration:metrics.ScriptDuration});
   await page.waitForTimeout(1000);
  }
  await page.screenshot({path:path.join(output,`${label}-final.png`),fullPage:false});
  const client=await page.evaluate(()=>window.__ironProfile),sortedFrames=client.frames.filter(value=>value>0&&value<10000).sort((a,b)=>a-b),input=client.inputLatency.slice().sort((a,b)=>a-b),measuredFrameSeconds=client.frames.filter(value=>value>0&&value<10000).reduce((sum,value)=>sum+value,0)/1000;
  const drawCalls=samples.map(sample=>sample.renderer.drawCalls),triangles=samples.map(sample=>sample.renderer.triangles),heaps=samples.map(sample=>sample.heapUsed);
  const report={label,capturedAt:new Date().toISOString(),durationSeconds,failures,quality:samples.at(-1)?.renderer.quality,frames:{count:sortedFrames.length,measuredSeconds:Number(measuredFrameSeconds.toFixed(1)),averageFps:Number((sortedFrames.length/measuredFrameSeconds).toFixed(1)),onePercentLowFps:Number((1000/percentile(sortedFrames,.99)).toFixed(1)),p95FrameMs:Number(percentile(sortedFrames,.95).toFixed(2)),p99FrameMs:Number(percentile(sortedFrames,.99).toFixed(2)),maximumFrameMs:Number(Math.max(...sortedFrames).toFixed(2))},longTasks:{count:client.longTasks.length,totalMs:Number(client.longTasks.reduce((sum,item)=>sum+item.duration,0).toFixed(1)),maximumMs:Number(Math.max(0,...client.longTasks.map(item=>item.duration)).toFixed(1))},input:{samples:input.length,averageMs:Number(average(input).toFixed(1)),p95Ms:Number(percentile(input,.95).toFixed(1)),maximumMs:Number(Math.max(0,...input).toFixed(1))},scene:{averageDrawCalls:Math.round(average(drawCalls)),maximumDrawCalls:Math.max(...drawCalls),averageTriangles:Math.round(average(triangles)),maximumTriangles:Math.max(...triangles),maximumObjects:Math.max(...samples.map(sample=>sample.renderer.objects)),maximumEffects:Math.max(...samples.map(sample=>sample.renderer.effects))},memory:{startHeapMB:Number((heaps[0]/1048576).toFixed(1)),endHeapMB:Number((heaps.at(-1)/1048576).toFixed(1)),maximumHeapMB:Number((Math.max(...heaps)/1048576).toFixed(1)),endDomNodes:samples.at(-1).nodes,endListeners:samples.at(-1).listeners},webSocket:ws,domMutationRecords:client.mutations,samples};
  fs.writeFileSync(path.join(output,`${label}.json`),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,samples:undefined},null,2));
 }finally{
  const completed=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');const event=await completed,gzip=zlib.createGzip(),destination=fs.createWriteStream(path.join(output,`${label}-trace.json.gz`)),finished=new Promise((resolve,reject)=>{destination.on('finish',resolve);destination.on('error',reject);gzip.on('error',reject)});gzip.pipe(destination);while(true){const part=await cdp.send('IO.read',{handle:event.stream,size:1048576});if(!gzip.write(part.data))await new Promise(resolve=>gzip.once('drain',resolve));if(part.eof)break}await cdp.send('IO.close',{handle:event.stream});gzip.end();await finished;await browser.close();
 }
}
run().catch(error=>{console.error(error);process.exitCode=1});
