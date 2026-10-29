import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
const port=9338, profile='/tmp/chasen-cdp-resize';
rmSync(profile,{recursive:true,force:true});
const proc=spawn('/usr/bin/google-chrome',['--headless=new',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-gpu','--hide-scrollbars','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
for(let i=0;i<80;i++){try{if((await fetch(`http://127.0.0.1:${port}/json/version`)).ok)break;}catch{}await sleep(150);}
const t=await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
const ws=new WebSocket(t.webSocketDebuggerUrl); let id=0; const pending=new Map();
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}});
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
const send=(method,params={})=>new Promise((resolve,reject)=>{const mid=++id;pending.set(mid,{resolve,reject});ws.send(JSON.stringify({id:mid,method,params}));});
const ev=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:`file://${process.cwd()}/index.html`}); await sleep(2600);
console.log('stageStart', await ev(`document.querySelector('.name-stage').getBoundingClientRect().top+scrollY`));
await ev(`window.scrollTo(0, document.querySelector('.name-stage').getBoundingClientRect().top+scrollY+50)`); await sleep(700);
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true}); await sleep(900);
console.log(await ev(`(() => {
  const l=[...document.querySelectorAll('.stage-word .letter')].map(el=>+el.getBoundingClientRect().x.toFixed(1));
  const st=document.querySelector('.name-stage').getBoundingClientRect();
  return {letters:l, stage:{top:+st.top.toFixed(1),h:+st.height.toFixed(1)}, innerW:innerWidth, scrollW:document.documentElement.scrollWidth, overflow:l.some(x=>x<0)};
})()`));
await ev(`window.scrollBy(0,700)`); await sleep(700);
console.log(await ev(`(() => {
  const l=[...document.querySelectorAll('.stage-word .letter')].map(el=>+el.getBoundingClientRect().x.toFixed(1));
  return {letters:l, stageTop:+document.querySelector('.name-stage').getBoundingClientRect().top.toFixed(1), line:getComputedStyle(document.querySelector('.stage-line')).opacity};
})()`));
ws.close(); proc.kill(); try{rmSync(profile,{recursive:true,force:true});}catch{}
