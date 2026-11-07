import assert from 'node:assert/strict';
import { GestureEngine, getMissHint } from '../src/GestureEngine.js';
import { InputHandler } from '../src/systems/InputHandler.js';
import { fixtures, negatives, shapes } from './fixtures/gestures.js';
const engine=new GestureEngine();
for(const f of [...fixtures,...negatives]) {
 const original=JSON.stringify(f.points), r=engine.recognize(f.points);
 assert.equal(r.gesture,f.gesture,f.id);
 assert.ok(r.confidence>=0 && r.confidence<=1);
 assert.equal(JSON.stringify(f.points),original,'input mutation');
 if(!f.gesture) assert.ok(r.reason);
}
for(const pointCount of [8,16,64]) for(const boxSize of [50,200]) {
 const e=new GestureEngine({pointCount,boxSize});
 for(const gesture of ['horizontal','vertical','caret','v_shape']) assert.equal(e.recognize(shapes[gesture]).gesture,gesture);
}
assert.equal(engine.recognize([{x:NaN,y:0},{x:1,y:2}]).reason,'invalid_input');
assert.equal(engine.recognize([{x:Infinity,y:0},{x:1,y:2}]).reason,'invalid_input');
assert.equal(engine.recognize(Array(9000).fill({x:0,y:0})).reason,'too_complex');
assert.throws(()=>new GestureEngine({pointCount:1}),RangeError);
assert.equal(new GestureEngine({thresholds:{horizontal:1.01}}).recognize(shapes.horizontal).reason,'low_score');
const ambiguous=new GestureEngine();
ambiguous.addTemplate('other-horizontal',shapes.horizontal);
assert.equal(ambiguous.recognize(shapes.horizontal).reason,'ambiguous');
assert.equal(new GestureEngine({minMargin:1}).recognize(shapes.heart).reason,'ambiguous');
assert.equal(engine.recognize([{x:-1e308,y:0},{x:1e308,y:0}]).reason,'invalid_input');
assert.ok(getMissHint('ambiguous','circle',.8));
let analyses=0;const analyze=engine._analyze.bind(engine);engine._analyze=(...args)=>{analyses++;return analyze(...args)};
assert.equal(engine.scoreFor(shapes.heart,'heart').passed,true);assert.equal(analyses,1);
// Real input architecture, mocked DOM: all pointer types, ownership, cancellation, coalescing.
globalThis.window={innerWidth:800,innerHeight:600};
for(const pointerType of ['mouse','touch','pen']) {
 const listeners={}, calls=[];
 const canvas={addEventListener:(name,fn)=>listeners[name]=fn,getBoundingClientRect:()=>({left:10,top:20,width:400,height:300}),setPointerCapture(){},hasPointerCapture:()=>false};
 const handler=new InputHandler(canvas,new GestureEngine(),null,(r)=>calls.push(r),null,()=>({width:800,height:600}));
 handler.setEnabled(true);
 const event=(x,y,extra={})=>({pointerId:1,pointerType,clientX:x,clientY:y,timeStamp:10,button:0,...extra});
 listeners.pointerdown(event(30,60));
 listeners.pointerdown(event(90,90,{pointerId:2}));
 listeners.pointermove(event(60,60,{pointerId:2}));
 assert.equal(handler.currentPoints.length,1);
 listeners.pointermove(event(90,60,{getCoalescedEvents:()=>[event(60,60)]}));
 assert.equal(handler.currentPoints.length,3);
 listeners.pointerup(event(130,60,{type:'pointerup'}));
 assert.equal(calls[0].gesture,'horizontal');assert.equal(handler.lastStroke.at(-1).x,240);
 assert.equal(handler.replayLastStroke(),true);
 listeners.pointerdown(event(30,60));listeners.pointercancel(event(80,60,{type:'pointercancel'}));
 assert.equal(calls.length,1);
 listeners.pointerdown(event(30,60));listeners.lostpointercapture(event(80,60,{type:'lostpointercapture'}));
 assert.equal(calls.length,1);
}
console.log('Gesture fixtures, configuration, diagnostics and mouse/touch/stylus regressions passed.');
