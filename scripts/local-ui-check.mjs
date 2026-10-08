import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
const wrangler=process.argv[2];
if(!wrangler) throw new Error('Pass the absolute path to the installed Wrangler CLI');
const base='http://127.0.0.1:8789';
const server=spawn(process.execPath,[wrangler,'pages','dev','public','--port','8789','--compatibility-date','2026-10-06'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
let log='';server.stdout.on('data',v=>log+=v);server.stderr.on('data',v=>log+=v);
async function run(script){
  const child=spawn(process.execPath,[script,base],{stdio:'inherit',windowsHide:true});
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
  if(code!==0) throw new Error(script+' failed with '+code);
}
try{
  let ready=false;
  for(let i=0;i<60;i++){
    if(server.exitCode!==null) throw new Error('Preview exited: '+log);
    try{if((await fetch(base,{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}
    await delay(1000);
  }
  if(!ready) throw new Error('Preview did not start: '+log);
  await run('scripts/music-hub-smoke.mjs');
  await run('scripts/browser-smoke.mjs');
}finally{server.kill();}
