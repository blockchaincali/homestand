// HOMESTAND sound. Every effect is synthesised with WebAudio at runtime, so the game ships
// no audio files and never downloads third-party sound. Audio starts on the first user
// gesture (browser autoplay rules) and remembers the player's mute choice.
(function(){
 'use strict';
 const KEY='homestand-muted';
 let ctx=null,master=null,noiseBuffer=null,ambient=null,muted=localStorage.getItem(KEY)==='1';
 const last=new Map();
 function init(){
  if(ctx)return ctx;const Ctor=window.AudioContext||window.webkitAudioContext;if(!Ctor)return null;
  try{ctx=new Ctor();master=ctx.createGain();master.gain.value=muted?0:.55;const comp=ctx.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=5;master.connect(comp).connect(ctx.destination);
   noiseBuffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const data=noiseBuffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1}catch{ctx=null}
  return ctx;
 }
 const unlock=()=>{if(init()&&ctx.state==='suspended')ctx.resume()};
 for(const type of ['pointerdown','keydown','touchstart'])window.addEventListener(type,unlock,{passive:true});
 const now=()=>ctx.currentTime;
 function env(node,at,peak,attack,decay){node.gain.setValueAtTime(0.0001,at);node.gain.exponentialRampToValueAtTime(peak,at+attack);node.gain.exponentialRampToValueAtTime(0.0001,at+attack+decay)}
 function noise(at,dur,{type='lowpass',freq=800,q=.7,peak=.5,attack=.005,sweepTo=null}={}){const src=ctx.createBufferSource();src.buffer=noiseBuffer;const filter=ctx.createBiquadFilter();filter.type=type;filter.frequency.setValueAtTime(freq,at);if(sweepTo)filter.frequency.exponentialRampToValueAtTime(sweepTo,at+dur);filter.Q.value=q;const gain=ctx.createGain();env(gain,at,peak,attack,dur);src.connect(filter).connect(gain).connect(master);src.start(at,Math.random()*1.5);src.stop(at+attack+dur+.05)}
 function tone(at,dur,{freq=440,to=null,wave='sine',peak=.3,attack=.01}={}){const osc=ctx.createOscillator();osc.type=wave;osc.frequency.setValueAtTime(freq,at);if(to)osc.frequency.exponentialRampToValueAtTime(to,at+dur);const gain=ctx.createGain();env(gain,at,peak,attack,dur);osc.connect(gain).connect(master);osc.start(at);osc.stop(at+attack+dur+.05)}
 const SOUNDS={
  click:t=>tone(t,.06,{freq:880,to:660,wave:'triangle',peak:.12}),
  ping:t=>{tone(t,.12,{freq:880,to:1320,wave:'triangle',peak:.12});tone(t+.13,.16,{freq:1320,wave:'sine',peak:.08})},
  radio:t=>{noise(t,.16,{type:'bandpass',freq:1800,q:2,peak:.16});tone(t+.14,.08,{freq:1320,wave:'square',peak:.05});noise(t+.22,.1,{type:'bandpass',freq:2400,q:3,peak:.08})},
  detect:t=>{tone(t,.32,{freq:1240,to:1180,peak:.2});tone(t+.36,.5,{freq:1240,to:1100,peak:.16});tone(t+.36,.5,{freq:1860,peak:.05})},
  ied:t=>{noise(t,1.6,{freq:900,sweepTo:60,peak:.95,attack:.004});tone(t,1.1,{freq:90,to:28,peak:.85,attack:.004});noise(t+.05,.5,{type:'highpass',freq:2600,peak:.18})},
  orbital:t=>{tone(t,1.1,{freq:220,to:1800,wave:'sawtooth',peak:.06,attack:.3});noise(t+1.2,1.2,{freq:1400,sweepTo:80,peak:.8});tone(t+1.2,.9,{freq:70,to:30,peak:.7})},
  wave:t=>{for(const k of [0,.55])tone(t+k,.42,{freq:392,to:330,wave:'sawtooth',peak:.13,attack:.04});tone(t+1.1,.6,{freq:330,to:262,wave:'sawtooth',peak:.12,attack:.04})},
  shot:t=>noise(t,.07,{type:'bandpass',freq:1400+Math.random()*900,q:1.2,peak:.12,attack:.002}),
  cannon:t=>{noise(t,.35,{freq:600,sweepTo:90,peak:.32,attack:.003});tone(t,.25,{freq:110,to:45,peak:.25,attack:.003})},
  build:t=>{for(const k of [0,.12,.24])noise(t+k,.05,{type:'bandpass',freq:2200,q:4,peak:.1,attack:.002})},
  victory:t=>{[523,659,784,1047].forEach((f,i)=>tone(t+i*.16,.5,{freq:f,wave:'triangle',peak:.16}))},
  defeat:t=>{[392,330,262].forEach((f,i)=>tone(t+i*.22,.6,{freq:f,wave:'triangle',peak:.14}))}
 };
 const GAPS={ping:.25,shot:.045,cannon:.12,detect:.6,ied:.08,click:.03,radio:.4};
 function play(name){if(muted||!init()||ctx.state!=='running')return;const fn=SOUNDS[name];if(!fn)return;const t=now(),gap=GAPS[name]||0;if(gap&&t-(last.get(name)||-9)<gap)return;last.set(name,t);try{fn(t+.01)}catch{}}
 // Battlefield bed: Harmattan wind with distant insects. Quiet enough to sit under the radio.
 function startAmbient(){if(ambient||!init())return;try{const src=ctx.createBufferSource();src.buffer=noiseBuffer;src.loop=true;const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=420;const gain=ctx.createGain();gain.gain.value=.06;const lfo=ctx.createOscillator(),lfoGain=ctx.createGain();lfo.frequency.value=.07;lfoGain.gain.value=180;lfo.connect(lfoGain).connect(filter.frequency);src.connect(filter).connect(gain).connect(master);src.start();lfo.start();
   const chirps=setInterval(()=>{if(muted||ctx.state!=='running')return;const t=now();for(let i=0;i<3;i++)tone(t+i*.07,.04,{freq:4200+Math.random()*300,wave:'sine',peak:.012})},2300);ambient={src,lfo,chirps}}catch{}}
 function stopAmbient(){if(!ambient)return;try{ambient.src.stop();ambient.lfo.stop()}catch{}clearInterval(ambient.chirps);ambient=null}
 function setMuted(value){muted=Boolean(value);localStorage.setItem(KEY,muted?'1':'0');if(master)master.gain.setTargetAtTime(muted?0:.55,ctx.currentTime,.05);return muted}
 // Host pause (e.g. the Vatar Games app backgrounding the frame): silence the context without touching the saved preference.
function suspend(){try{ctx?.suspend?.()}catch{}}
function resume(){try{if(ctx&&ctx.state==='suspended')ctx.resume()}catch{}}
window.HomestandAudio=Object.freeze({play,startAmbient,stopAmbient,muted:()=>muted,toggle:()=>setMuted(!muted),setMuted,suspend,resume});
})();
