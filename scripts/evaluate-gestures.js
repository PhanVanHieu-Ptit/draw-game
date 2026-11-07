import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { GestureEngine } from '../src/GestureEngine.js';
import { fixtures, negatives } from '../tests/fixtures/gestures.js';
// Freeze the pre-change revision so baseline measurements remain reproducible.
const baselineRevision='fec3cf1c5b08cf131d5c2d7d5580f0b5441a325b';
let Engine=GestureEngine;
if(process.argv.includes('--baseline')) {
 const source=execFileSync('git',['show',`${baselineRevision}:src/GestureEngine.js`],{encoding:'utf8'})
   .replace("'./core/Constants.js'",JSON.stringify(new URL('../src/core/Constants.js',import.meta.url).href));
 Engine=(await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).GestureEngine;
}
const engine=new Engine();
const samples=[...fixtures,...negatives];
const failures=[]; const perGesture={};
for(const f of samples){const r=engine.recognize(f.points); const ok=r.gesture===f.gesture;const key=f.gesture||'reject';const g=perGesture[key]??={correct:0,total:0};g.total++;g.correct+=Number(ok);if(!ok)failures.push({id:f.id,expected:f.gesture,actual:r.gesture,reason:r.reason});}
for(let i=0;i<500;i++)engine.recognize(samples[i%samples.length].points);
const timings=[];
for(let i=0;i<3000;i++){const f=samples[i%samples.length];const t=performance.now();engine.recognize(f.points);timings.push(performance.now()-t);}
timings.sort((a,b)=>a-b);
const report={samples:samples.length,correct:samples.length-failures.length,perGesture,failures,latencyMs:{median:timings[1500],p95:timings[2850],p99:timings[2970],max:timings.at(-1)},runtime:process.version};
writeFileSync(process.argv.includes('--baseline')?'tests/fixtures/gesture-baseline.json':'tests/fixtures/gesture-evaluation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
