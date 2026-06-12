'use client';
import { useEffect, useRef, useCallback, useState } from 'react';

interface CountryData { code:string; name:string; count:number; publishers?:number; }
interface Props { activeCountries?: CountryData[]; }

const PALETTE = ['#00f5c4','#00c8ff','#a78bfa','#f59e0b','#10b981','#f472b6','#60a5fa','#34d399','#fb923c','#e879f9','#4ade80','#38bdf8'];

const CLUSTER_MAP: Record<string,string> = {
  US:'N.AMERICA',CA:'N.AMERICA',MX:'N.AMERICA',
  GB:'EUROPE',DE:'EUROPE',FR:'EUROPE',IT:'EUROPE',ES:'EUROPE',NL:'EUROPE',PL:'EUROPE',UA:'EUROPE',RU:'EUROPE',TR:'EUROPE',BE:'EUROPE',PT:'EUROPE',GR:'EUROPE',SE:'EUROPE',NO:'EUROPE',
  EG:'M.EAST',SA:'M.EAST',AE:'M.EAST',IQ:'M.EAST',IR:'M.EAST',JO:'M.EAST',KW:'M.EAST',QA:'M.EAST',
  NG:'AFRICA',KE:'AFRICA',ET:'AFRICA',ZA:'AFRICA',GH:'AFRICA',MA:'AFRICA',DZ:'AFRICA',TN:'AFRICA',SD:'AFRICA',UG:'AFRICA',TZ:'AFRICA',
  IN:'S.ASIA',PK:'S.ASIA',BD:'S.ASIA',
  CN:'E.ASIA',JP:'E.ASIA',KR:'E.ASIA',
  ID:'SE.ASIA',VN:'SE.ASIA',TH:'SE.ASIA',MY:'SE.ASIA',PH:'SE.ASIA',
  BR:'S.AMERICA',AR:'S.AMERICA',PE:'S.AMERICA',CO:'S.AMERICA',
  AU:'OCEANIA',NZ:'OCEANIA',
  KZ:'C.ASIA',UZ:'C.ASIA',
};

function hexRgb(h:string){
  return `${parseInt(h.slice(1,3),16)},${parseInt(h.slice(3,5),16)},${parseInt(h.slice(5,7),16)}`;
}

export default function NeuralNetwork({ activeCountries=[] }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const stRef = useRef<any>({frame:0,nodes:[],edges:[],particles:[],hover:null,W:0,H:0});
  const [popup, setPopup] = useState<{name:string;count:number;devs:number;x:number;y:number}|null>(null);

  const build = useCallback(() => {
    const canvas = canvasRef.current!; if (!canvas) return;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    const dpr = Math.min(devicePixelRatio, 2);
    canvas.width = W*dpr; canvas.height = H*dpr;
    const ctx = canvas.getContext('2d')!; ctx.scale(dpr, dpr);
    const cx = W/2, cy = H/2;
    const st = stRef.current;
    Object.assign(st, {W,H,cx,cy,ctx,nodes:[],edges:[],particles:[]});

    // Cluster countries
    const clusters: Record<string,{count:number;devs:number}> = {};
    activeCountries.forEach(c => {
      const k = CLUSTER_MAP[c.code.toUpperCase()]||'OTHER';
      if (!clusters[k]) clusters[k]={count:0,devs:0};
      clusters[k].count += c.count;
      clusters[k].devs += c.publishers||0;
    });
    const cl = Object.entries(clusters).sort((a,b)=>b[1].count-a[1].count);
    const n = cl.length || 1;

    // YOU — center
    st.nodes.push({
      id:'you',x:cx,y:cy,r:13,color:'#00f5c4',
      label:'YOU',sub:'ONLINE',isYou:true,
      vx:0,vy:0,phase:0,count:1,devs:1,name:'You',
    });

    // Cluster ring
    const R = Math.min(W,H) * 0.31;
    cl.forEach(([name,data],i) => {
      const ang = (i/n)*Math.PI*2 - Math.PI/2;
      const col = PALETTE[i%PALETTE.length];
      const nr = Math.min(6 + Math.sqrt(data.count)*0.9, 20);
      const ox = cx+Math.cos(ang)*R, oy = cy+Math.sin(ang)*R;
      st.nodes.push({
        id:`cl${i}`,x:ox,y:oy,r:nr,color:col,
        label:name,sub:`${data.count}u`,isCluster:true,
        vx:(Math.random()-.5)*.35,vy:(Math.random()-.5)*.35,
        phase:Math.random()*Math.PI*2,ox,oy,ang,
        count:data.count,devs:data.devs,name,
      });
    });

    // Satellites
    const satN = Math.min(activeCountries.length*3, 80);
    for (let i=0;i<satN;i++) {
      const ci = 1+Math.floor(Math.random()*Math.max(n,1));
      const cn = st.nodes[ci]; if (!cn) continue;
      const sp = 30+Math.random()*65, ang2 = Math.random()*Math.PI*2;
      const ox2 = cn.ox+Math.cos(ang2)*sp, oy2 = cn.oy+Math.sin(ang2)*sp;
      st.nodes.push({
        id:`s${i}`,x:ox2,y:oy2,r:1.2+Math.random()*2.8,color:cn.color,
        label:'',sub:'',isYou:false,isCluster:false,
        vx:(Math.random()-.5)*.45,vy:(Math.random()-.5)*.45,
        phase:Math.random()*Math.PI*2,ox:ox2,oy:oy2,pidx:ci,
        count:0,devs:0,name:'',
      });
    }

    // Edges
    for (let i=1;i<=n&&i<st.nodes.length;i++)
      st.edges.push({a:0,b:i,str:0.9,pulse:Math.random()});
    for (let i=1;i<=n;i++) {
      const j = i<n?i+1:1;
      st.edges.push({a:i,b:j,str:0.4,pulse:Math.random()});
      if(n>3){const k=i<n-1?i+2:(i===n-1?1:2);st.edges.push({a:i,b:k,str:0.18,pulse:Math.random()});}
    }
    for (let i=n+1;i<st.nodes.length;i++){
      const nd=st.nodes[i];
      if(nd.pidx&&Math.random()<0.5) st.edges.push({a:nd.pidx,b:i,str:0.12,pulse:Math.random()});
    }
  }, [activeCountries]);

  useEffect(()=>{
    const canvas=canvasRef.current!; if(!canvas)return;
    build();

    function spawn(e:any){
      const st=stRef.current;
      const a=st.nodes[e.a],b=st.nodes[e.b]; if(!a||!b)return;
      const rev=Math.random()<0.5;
      st.particles.push({
        ax:rev?b.x:a.x,ay:rev?b.y:a.y,bx:rev?a.x:b.x,by:rev?a.y:b.y,
        t:0,spd:0.005+Math.random()*.008,
        color:a.color,sz:1+Math.random()*.8,
      });
    }

    function drawGlow(ctx:any,x:number,y:number,r:number,col:string,alpha:number){
      const g=ctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,`rgba(${hexRgb(col)},${alpha})`);
      g.addColorStop(1,`rgba(${hexRgb(col)},0)`);
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
    }

    function loop(){
      const st=stRef.current;
      const{ctx,W,H,cx,cy,nodes,edges,particles}=st;
      if(!ctx||!W)return;
      const t=++st.frame;

      // Update
      nodes.forEach((n:any)=>{
        if(n.isYou)return;
        if(n.ox!==undefined){
          const drift=Math.sin(t*0.007+n.phase)*9;
          const tx=n.ox+drift*Math.cos(n.ang||0);
          const ty=n.oy+drift*Math.sin(n.ang||0);
          n.vx+=(tx-n.x)*.0022; n.vy+=(ty-n.y)*.0022;
        }
        n.vx*=.96;n.vy*=.96;n.x+=n.vx;n.y+=n.vy;
      });

      ctx.clearRect(0,0,W,H);

      // Grid
      ctx.strokeStyle='rgba(0,245,196,0.018)';ctx.lineWidth=0.5;
      for(let x=0;x<W;x+=55){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
      for(let y=0;y<H;y+=55){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

      // Central ambient glow
      drawGlow(ctx,cx,cy,Math.min(W,H)*0.32,'#00f5c4',0.06);

      // Edges
      edges.forEach((e:any)=>{
        const a=nodes[e.a],b=nodes[e.b]; if(!a||!b)return;
        e.pulse=(e.pulse+0.0025)%1;
        const rgb=hexRgb(a.color);
        ctx.strokeStyle=`rgba(${rgb},${e.str*0.32})`;
        ctx.lineWidth=0.5;
        const mx=(a.x+b.x)/2+(b.y-a.y)*0.14;
        const my=(a.y+b.y)/2-(b.x-a.x)*0.14;
        ctx.beginPath();ctx.moveTo(a.x,a.y);
        ctx.quadraticCurveTo(mx,my,b.x,b.y);ctx.stroke();
      });

      // Particles
      st.particles=particles.filter((p:any)=>p.t<1);
      st.particles.forEach((p:any)=>{
        p.t+=p.spd;
        const{t:pt,ax,ay,bx,by}=p;
        const mx=(ax+bx)/2+(by-ay)*0.14,my=(ay+by)/2-(bx-ax)*0.14;
        const x=(1-pt)*(1-pt)*ax+2*(1-pt)*pt*mx+pt*pt*bx;
        const y=(1-pt)*(1-pt)*ay+2*(1-pt)*pt*my+pt*pt*by;
        const alpha=Math.sin(pt*Math.PI)*0.92;
        ctx.fillStyle=`rgba(${hexRgb(p.color)},${alpha})`;
        ctx.beginPath();ctx.arc(x,y,p.sz,0,Math.PI*2);ctx.fill();
      });
      if(t%5===0&&edges.length>0) spawn(edges[Math.floor(Math.random()*edges.length)]);

      // Nodes
      nodes.forEach((n:any,i:number)=>{
        const pulse=Math.sin(t*0.038+n.phase);
        const pr=n.r+pulse*(n.isYou?2.5:1.2);
        const hov=st.hover===i;
        const rgb=hexRgb(n.color);

        // Glow halo
        drawGlow(ctx,n.x,n.y,pr*(n.isYou?5.5:hov?5:3.8),n.color,n.isYou?.42:hov?.32:.16);

        if(n.isYou){
          // Rotating rings
          ctx.save();ctx.translate(n.x,n.y);ctx.rotate(t*.017);
          [0,1,2].forEach(ri=>{
            const rr=pr+4+ri*8;
            const dash=ri===0?[6,4]:ri===1?[4,6]:[2,8];
            ctx.setLineDash(dash);
            ctx.beginPath();ctx.arc(0,0,rr,0,Math.PI*(1.3+ri*.25));
            ctx.strokeStyle=`rgba(0,245,196,${.38-ri*.09})`;ctx.lineWidth=1;ctx.stroke();
          });
          ctx.setLineDash([]);ctx.restore();
          // Core
          const cg=ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,pr);
          cg.addColorStop(0,'#fff');cg.addColorStop(.3,'#00f5c4');cg.addColorStop(1,'rgba(0,245,196,.25)');
          ctx.fillStyle=cg;ctx.beginPath();ctx.arc(n.x,n.y,pr,0,Math.PI*2);ctx.fill();
          // YOU label
          ctx.fillStyle='rgba(0,245,196,.9)';ctx.font='700 8px monospace';ctx.textAlign='center';
          ctx.fillText('YOU',n.x,n.y-pr-8);

        } else if(n.isCluster){
          // Hex
          ctx.save();ctx.translate(n.x,n.y);ctx.rotate(t*.004+n.phase*.5);
          ctx.fillStyle=`rgba(${rgb},${hov?.24:.11})`;
          ctx.strokeStyle=`rgba(${rgb},${hov?1:.62})`;ctx.lineWidth=hov?1.5:1;
          ctx.beginPath();
          for(let s=0;s<6;s++){const a=(s/6)*Math.PI*2-Math.PI/6;ctx.lineTo(Math.cos(a)*pr,Math.sin(a)*pr);}
          ctx.closePath();ctx.fill();ctx.stroke();
          // Inner dot
          ctx.fillStyle=`rgba(${rgb},.6)`;ctx.beginPath();ctx.arc(0,0,2,0,Math.PI*2);ctx.fill();
          ctx.restore();
          // Label below
          ctx.fillStyle=hov?'#fff':`rgba(${rgb},.8)`;
          ctx.font=`${hov?700:500} ${Math.max(7,Math.min(pr*.65,9))}px monospace`;
          ctx.textAlign='center';
          ctx.fillText(n.label,n.x,n.y+pr+12);
          if(hov){
            ctx.fillStyle='rgba(255,255,255,.4)';ctx.font='500 7px monospace';
            ctx.fillText(n.sub,n.x,n.y+pr+22);
          }
        } else {
          // Sat dot
          ctx.fillStyle=`rgba(${rgb},${hov?.9:.5})`;
          ctx.beginPath();ctx.arc(n.x,n.y,pr,0,Math.PI*2);ctx.fill();
        }
      });

      animRef.current=requestAnimationFrame(loop);
    }
    animRef.current=requestAnimationFrame(loop);

    // Interaction
    function hit(mx:number,my:number){
      const st=stRef.current;
      for(let i=st.nodes.length-1;i>=0;i--){
        const n=st.nodes[i];
        if(Math.hypot(n.x-mx,n.y-my)<Math.max(n.r+14,22))return i;
      }
      return null;
    }

    function onMove(e:MouseEvent){
      const r=canvas.getBoundingClientRect();
      stRef.current.hover=hit(e.clientX-r.left,e.clientY-r.top);
      canvas.style.cursor=stRef.current.hover!==null?'pointer':'default';
    }
    function onTouch(e:TouchEvent){
      const r=canvas.getBoundingClientRect();
      const t=e.touches[0];
      stRef.current.hover=hit(t.clientX-r.left,t.clientY-r.top);
    }
    function onClick(e:MouseEvent|TouchEvent){
      const r=canvas.getBoundingClientRect();
      let mx:number,my:number;
      if('touches' in e&&e.changedTouches.length){mx=e.changedTouches[0].clientX-r.left;my=e.changedTouches[0].clientY-r.top;}
      else if('clientX' in e){mx=e.clientX-r.left;my=e.clientY-r.top;}else return;
      const idx=hit(mx,my);
      if(idx===null){setPopup(null);return;}
      const n=stRef.current.nodes[idx];
      if(!n.name&&!n.label){setPopup(null);return;}
      // Project to screen
      setPopup({
        name:n.label||n.name,
        count:n.count,devs:n.devs,
        x:Math.min(Math.max(mx,80),stRef.current.W-80),
        y:Math.max(my-100,10),
      });
    }
    function onLeave(){stRef.current.hover=null;}

    canvas.addEventListener('mousemove',onMove);
    canvas.addEventListener('touchmove',onTouch,{passive:true});
    canvas.addEventListener('mouseleave',onLeave);
    canvas.addEventListener('click',onClick);
    canvas.addEventListener('touchend',onClick);

    const ro=new ResizeObserver(build);
    ro.observe(canvas);
    return()=>{
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener('mousemove',onMove);
      canvas.removeEventListener('touchmove',onTouch);
      canvas.removeEventListener('mouseleave',onLeave);
      canvas.removeEventListener('click',onClick);
      canvas.removeEventListener('touchend',onClick);
      ro.disconnect();
    };
  },[build]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full"/>

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none"
        style={{background:'radial-gradient(ellipse 108% 108% at 50% 50%,transparent 30%,rgba(0,0,0,.9) 100%)'}}/>

      {/* HUD corners */}
      {(['tl','tr','bl','br'] as const).map(p=>(
        <div key={p} className={`absolute w-4 h-4 pointer-events-none border-[rgba(0,245,196,.28)]
          ${p==='tl'?'top-2 start-2 border-t border-s':''}
          ${p==='tr'?'top-2 end-2 border-t border-e':''}
          ${p==='bl'?'bottom-2 start-2 border-b border-s':''}
          ${p==='br'?'bottom-2 end-2 border-b border-e':''}`}/>
      ))}

      {/* Hint */}
      <div className="absolute bottom-2 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 pointer-events-none
        text-[7px] font-mono tracking-[.15em] text-[rgba(0,245,196,.25)] uppercase whitespace-nowrap">
        LIVE NEURAL NETWORK · TAP NODE
      </div>

      {/* Node popup */}
      {popup && (
        <div className="absolute pointer-events-auto z-20"
          style={{left:Math.min(Math.max(popup.x-76,4),(stRef.current.W||300)-160),top:popup.y}}>
          <div className="bg-[rgba(0,4,14,.96)] border border-[rgba(0,245,196,.25)] rounded-2xl overflow-hidden w-40
            shadow-[0_8px_32px_rgba(0,0,0,.8)]">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[#00f5c4]/50 to-transparent"/>
            <div className="px-3 pt-2.5 pb-3">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[10px] font-black text-white font-mono tracking-wide truncate">
                  {popup.name}
                </p>
                <button onClick={()=>setPopup(null)}
                  className="text-white/20 hover:text-white text-xs ml-1 shrink-0 transition-colors">✕</button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-[rgba(0,200,255,.06)] rounded-xl p-2">
                  <p className="text-[6px] font-mono text-[rgba(0,200,255,.5)] tracking-widest mb-1">USERS</p>
                  <p className="text-[20px] font-black text-[#00c8ff] font-mono leading-none">{popup.count}</p>
                </div>
                <div className="bg-[rgba(167,139,250,.06)] rounded-xl p-2">
                  <p className="text-[6px] font-mono text-[rgba(167,139,250,.5)] tracking-widest mb-1">DEVS</p>
                  <p className="text-[20px] font-black text-[#a78bfa] font-mono leading-none">{popup.devs}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-center -mt-px">
            <div className="w-2 h-2 bg-[rgba(0,4,14,.96)] border-r border-b border-[rgba(0,245,196,.25)] rotate-45"/>
          </div>
        </div>
      )}
    </div>
  );
}
