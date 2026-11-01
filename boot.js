'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const root=__dirname;
function unpack(){
 const bundle=fs.readFileSync(path.join(root,'source.bundle.b64'),'utf8').trim();
 const files=JSON.parse(zlib.gunzipSync(Buffer.from(bundle,'base64')).toString('utf8'));
 for(const [name,entry] of Object.entries(files)){
  if(name.startsWith('/')||name.split('/').some(x=>x==='..'))throw Error('Invalid bundle path');
  const file=path.join(root,name);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  if(fs.existsSync(file))continue; // Explicit source files in Git override the original v0.1 bundle.
  fs.writeFileSync(file,entry.encoding==='base64'?Buffer.from(entry.data,'base64'):entry.data);
 }
 return Object.keys(files).length;
}
console.log('HOMESTAND: restored '+unpack()+' source files');
// Apply the small HTTP and difficulty bridge to the legacy room server.
const serverPath=path.join(root,'server.js');
let serverText=fs.readFileSync(serverPath,'utf8');
const replacements=[
 ["const mode=msg.mode==='pvp'?'pvp':'solo';const game=new Game({mode,roomCode:code});","const mode=msg.mode==='pvp'?'pvp':'solo';const difficulty=mode==='solo'&&['recruit','standard','veteran'].includes(msg.difficulty)?msg.difficulty:'recruit';const game=new Game({mode,roomCode:code,difficulty});"],
 ["const staticFiles={'/':'index.html'","const staticFiles={'/3d.js':'3d.js','/3d.css':'3d.css','/':'index.html'"],
 ["if(pathname==='/healthz'){","if(pathname==='/vendor/three.module.js'||pathname==='/vendor/three.core.js'){const name=pathname.endsWith('three.core.js')?'three.core.js':'three.module.js';const threeFile=path.join(__dirname,'node_modules','three','build',name);return fs.readFile(threeFile,(err,data)=>{if(err){res.writeHead(503);return res.end('3D library unavailable')}res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'public, max-age=604800'});res.end(data)})}\n if(pathname==='/healthz'){"]
];
for(const [before,after] of replacements){
 if(serverText.includes(before))serverText=serverText.replace(before,after);
 else if(!serverText.includes(after))throw new Error('Missing v0.2 server bridge: '+before.slice(0,32));
}
fs.writeFileSync(serverPath,serverText);

if(process.argv.includes('--extract'))process.exit(0);
if(process.argv.includes('--test')){
 const {spawnSync}=require('node:child_process');
 const result=spawnSync(process.execPath,['--test','test/engine.test.js','test/rooms.test.js','test/difficulty.test.js'],{stdio:'inherit',cwd:root});
 process.exit(result.status??1);
}
const {server}=require('./server.js');
const port=Number(process.env.PORT||3000);
server.listen(port,'0.0.0.0',()=>console.log('HOMESTAND listening on '+port));
