import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
export const readSource=html.match(/function fetchJsonRead\(url, options\) \{[\s\S]*?\n\}/)[0];
// Execute the actual production transport, not a bypass/mock helper. Keep any
// test-provided clocks; native defaults let existing HTTP fixtures run normally.
export const readTransportVM={...vm,runInNewContext(code,context,options){
  for(const [key,value] of Object.entries({AbortController,setTimeout,clearTimeout,driveReadRequest:0,popularVideoRequest:0,fanCommentRequest:0})){
    if(!(key in context))context[key]=value;
  }
  const commentSource=html.match(/function commentPlainText\(value\) \{[\s\S]*?\n\}/)[0];
  return vm.runInNewContext(readSource+'\n'+commentSource+'\n'+code,context,options);
}};
