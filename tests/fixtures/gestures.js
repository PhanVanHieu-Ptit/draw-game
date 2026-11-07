// Independent, deterministic synthetic fixtures; coordinates are logical pixels.
const p = pairs => pairs.map(([x,y]) => ({x,y}));
export const shapes = {
 horizontal:p([[0,50],[100,50]]), vertical:p([[50,0],[50,100]]),
 caret:p([[0,100],[50,0],[100,100]]), v_shape:p([[0,0],[50,100],[100,0]]),
 lightning:p([[55,0],[20,40],[75,40],[40,100]]),
 heart:p([[50,25],[32,8],[15,5],[0,25],[6,55],[25,80],[50,100],[75,80],[94,55],[100,25],[85,5],[68,8],[50,25]]),
 circle:Array.from({length:65},(_,i)=>({x:50+48*Math.cos(i*Math.PI/32+.17),y:50+48*Math.sin(i*Math.PI/32+.17)})),
 spiral:Array.from({length:81},(_,i)=>{const t=i/80,a=t*3.1*Math.PI,r=48*(1-.75*t);return {x:50+r*Math.cos(a),y:50+r*Math.sin(a)}})
};
export function interpolate(points, steps) {
 const out=[];
 for(let i=1;i<points.length;i++) for(let j=0;j<steps;j++){const t=j/steps;out.push({x:points[i-1].x*(1-t)+points[i].x*t,y:points[i-1].y*(1-t)+points[i].y*t});}
 return [...out, {...points.at(-1)}];
}
export const fixtures=[];
for(const [gesture,shape] of Object.entries(shapes)) for(const scale of [.35,1,4]) for(const steps of [1,5,20]) for(const reverse of [false,true]) for(const noise of [0,.35]) {
 let points=interpolate(reverse?[...shape].reverse():shape,steps).map((p,i)=>({x:250+scale*(p.x+noise*Math.sin(i*1.71)),y:200+scale*(p.y+noise*Math.cos(i*2.31)),timestamp:i*(steps===1?40:4)}));
 fixtures.push({id:`${gesture}/${scale}/${steps}/${reverse}/${noise}`,gesture,points});
}
export const negatives = [
 {id:'diagonal',gesture:null,points:p([[0,0],[100,100]])},
 {id:'half-circle',gesture:null,points:shapes.circle.slice(0,33)},
 {id:'backtrack',gesture:null,points:p([[0,0],[100,0],[0,0],[100,0]])},
 {id:'incomplete-angle',gesture:null,points:p([[0,100],[50,0]])},
 {id:'tap',gesture:null,points:p([[30,30],[31,31]])},
 {id:'square',gesture:null,points:p([[0,0],[100,0],[100,100],[0,100],[0,0]])}
];
