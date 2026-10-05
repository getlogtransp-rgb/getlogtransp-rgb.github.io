(()=>{const c=document.getElementById('net');if(!c)return;const x=c.getContext('2d');const rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
let W,H,P=[],K=[],run=true,raf;const dpr=Math.min(devicePixelRatio||1,2);
const size=()=>{const r=c.getBoundingClientRect();W=r.width;H=r.height;c.width=W*dpr;c.height=H*dpr;x.setTransform(dpr,0,0,dpr,0,0);const n=Math.round(Math.min(70,W*H/16000));P=Array.from({length:n},()=>({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.18,vy:(Math.random()-.5)*.18}));K=[]};
const D=140;
const frame=()=>{x.clearRect(0,0,W,H);for(const p of P){p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>W)p.vx*=-1;if(p.y<0||p.y>H)p.vy*=-1}
for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++){const a=P[i],b=P[j],dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy);if(d<D){x.strokeStyle=`rgba(0,32,96,${(1-d/D)*.16})`;x.lineWidth=1;x.beginPath();x.moveTo(a.x,a.y);x.lineTo(b.x,b.y);x.stroke();if(!rm&&K.length<14&&Math.random()<.0008)K.push({a,b,t:0})}}
for(const p of P){x.fillStyle='rgba(0,32,96,.35)';x.beginPath();x.arc(p.x,p.y,1.6,0,6.3);x.fill()}
K=K.filter(k=>(k.t+=.012)<1);for(const k of K){const px=k.a.x+(k.b.x-k.a.x)*k.t,py=k.a.y+(k.b.y-k.a.y)*k.t;x.fillStyle='rgba(248,104,0,.9)';x.beginPath();x.arc(px,py,2.6,0,6.3);x.fill();x.fillStyle='rgba(248,104,0,.15)';x.beginPath();x.arc(px,py,7,0,6.3);x.fill()}
if(run&&!rm)raf=requestAnimationFrame(frame)};
size();frame();addEventListener('resize',()=>{size();if(rm)frame()},{passive:true});
new IntersectionObserver(e=>{run=e[0].isIntersecting&&!document.hidden;cancelAnimationFrame(raf);if(run&&!rm)raf=requestAnimationFrame(frame)}).observe(c);
document.addEventListener('visibilitychange',()=>{run=!document.hidden;cancelAnimationFrame(raf);if(run&&!rm)raf=requestAnimationFrame(frame)})})();
