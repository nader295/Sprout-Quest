'use client';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type * as THREE from 'three';
import { logger } from '@/lib/logger';

/* ═══════════════════════════════════════════════════════════════════
   RomX Globe — Production v4.1  "PRIME"
   ✅ Real country borders (TopoJSON from CDN)
   ✅ City-level detail at close zoom
   ✅ Gamification — user levels affect node appearance
   ✅ Growth / trending indicators
   ✅ Memory management — dispose on LOD change
   ✅ Cinematic entry from space
   ✅ FPS adaptive quality
   ✅ Live activity simulation
   ✅ Observer / cinematic mode
   ✅ Day/night + city lights + clouds
   ✅ Shooting stars
   ✅ FIX: nodes rebuild when activeCountries arrives late
   ✅ FIX: _baseOp never clobbered by back-face culling
═══════════════════════════════════════════════════════════════════ */

interface CountryData { code:string; name:string; count:number; publishers?:number; }
interface Props { activeCountries?: CountryData[]; }

// ── Timezone → Country ───────────────────────────────────────────
const TZ_MAP:Record<string,string>={
  'America/New_York':'US','America/Chicago':'US','America/Denver':'US',
  'America/Los_Angeles':'US','America/Toronto':'CA','America/Vancouver':'CA',
  'America/Sao_Paulo':'BR','America/Buenos_Aires':'AR','America/Mexico_City':'MX',
  'America/Lima':'PE','America/Bogota':'CO','America/Caracas':'VE',
  'Europe/London':'GB','Europe/Paris':'FR','Europe/Berlin':'DE','Europe/Rome':'IT',
  'Europe/Madrid':'ES','Europe/Amsterdam':'NL','Europe/Warsaw':'PL',
  'Europe/Kiev':'UA','Europe/Moscow':'RU','Europe/Istanbul':'TR',
  'Europe/Stockholm':'SE','Europe/Oslo':'NO','Europe/Athens':'GR',
  'Europe/Bucharest':'RO','Europe/Budapest':'HU','Europe/Prague':'CZ',
  'Asia/Tokyo':'JP','Asia/Seoul':'KR','Asia/Shanghai':'CN','Asia/Kolkata':'IN',
  'Asia/Karachi':'PK','Asia/Bangkok':'TH','Asia/Jakarta':'ID',
  'Asia/Singapore':'MY','Asia/Manila':'PH','Asia/Ho_Chi_Minh':'VN',
  'Asia/Riyadh':'SA','Asia/Dubai':'AE','Asia/Baghdad':'IQ','Asia/Tehran':'IR',
  'Asia/Almaty':'KZ','Africa/Cairo':'EG','Africa/Lagos':'NG',
  'Africa/Nairobi':'KE','Africa/Addis_Ababa':'ET','Africa/Johannesburg':'ZA',
  'Africa/Casablanca':'MA','Africa/Tunis':'TN','Australia/Sydney':'AU',
  'Australia/Melbourne':'AU','Pacific/Auckland':'NZ',
};
function getUserCountry(){try{return TZ_MAP[Intl.DateTimeFormat().resolvedOptions().timeZone]??null;}catch{return null;}}

// ── User level system ────────────────────────────────────────────
type UserLevel = 'newbie'|'contributor'|'active'|'pro'|'elite';
function getLevel(count:number):UserLevel{
  if(count>=20)return 'elite';
  if(count>=10)return 'pro';
  if(count>=5) return 'active';
  if(count>=2) return 'contributor';
  return 'newbie';
}
const LEVEL_COLORS:Record<UserLevel,number>={
  newbie:0x4488aa, contributor:0x00c8ff, active:0x00f5c4, pro:0xfbbf24, elite:0xff6b6b,
};
const LEVEL_SIZES:Record<UserLevel,number>={
  newbie:.009, contributor:.012, active:.016, pro:.021, elite:.027,
};
const LEVEL_LABELS:Record<UserLevel,string>={
  newbie:'Newbie', contributor:'Contributor', active:'Active', pro:'Pro Dev', elite:'Elite',
};

// ── Country data ─────────────────────────────────────────────────
const CC:Record<string,[number,number]>={
  US:[38,-96],GB:[54,-2],DE:[51,10],FR:[47,2],IN:[22,79],BR:[-14,-51],
  CN:[36,105],RU:[62,105],EG:[27,31],JP:[36,138],AU:[-25,134],CA:[56,-96],
  MX:[23,-102],ZA:[-29,25],NG:[10,8],SA:[24,45],PK:[30,70],ID:[-2,118],
  TR:[39,35],AR:[-35,-65],UA:[49,31],PL:[52,20],ES:[40,-3],IT:[42,12],
  KR:[36,128],KZ:[48,68],MA:[32,-6],DZ:[28,3],ET:[9,40],KE:[0,38],
  TZ:[-6,35],SD:[15,30],LY:[27,17],IQ:[33,44],IR:[32,54],VN:[14,108],
  TH:[15,101],MY:[4,102],PH:[12,122],SE:[60,18],NO:[60,8],NL:[52,5],
  AE:[24,54],GH:[8,-1],CD:[-4,24],UG:[1,32],TN:[34,9],BD:[23,90],
  VE:[6,-66],CO:[4,-74],PE:[-10,-76],CL:[-35,-71],NZ:[-42,174],
};
const CNAMES:Record<string,string>={
  US:'United States',GB:'United Kingdom',DE:'Germany',FR:'France',IN:'India',
  BR:'Brazil',CN:'China',RU:'Russia',EG:'Egypt',JP:'Japan',AU:'Australia',
  CA:'Canada',MX:'Mexico',ZA:'South Africa',NG:'Nigeria',SA:'Saudi Arabia',
  PK:'Pakistan',ID:'Indonesia',TR:'Turkey',AR:'Argentina',UA:'Ukraine',
  PL:'Poland',ES:'Spain',IT:'Italy',KR:'South Korea',MA:'Morocco',
  DZ:'Algeria',VN:'Vietnam',TH:'Thailand',MY:'Malaysia',PH:'Philippines',
  SE:'Sweden',NO:'Norway',NL:'Netherlands',AE:'UAE',GH:'Ghana',
  VE:'Venezuela',CO:'Colombia',PE:'Peru',CL:'Chile',NZ:'New Zealand',
};
const FLAGS:Record<string,string>={
  US:'🇺🇸',GB:'🇬🇧',DE:'🇩🇪',FR:'🇫🇷',IN:'🇮🇳',BR:'🇧🇷',CN:'🇨🇳',RU:'🇷🇺',
  EG:'🇪🇬',JP:'🇯🇵',AU:'🇦🇺',CA:'🇨🇦',MX:'🇲🇽',ZA:'🇿🇦',NG:'🇳🇬',SA:'🇸🇦',
  PK:'🇵🇰',ID:'🇮🇩',TR:'🇹🇷',AR:'🇦🇷',UA:'🇺🇦',PL:'🇵🇱',ES:'🇪🇸',IT:'🇮🇹',
  KR:'🇰🇷',MA:'🇲🇦',DZ:'🇩🇿',VN:'🇻🇳',TH:'🇹🇭',MY:'🇲🇾',PH:'🇵🇭',
  SE:'🇸🇪',NO:'🇳🇴',NL:'🇳🇱',AE:'🇦🇪',GH:'🇬🇭',VE:'🇻🇪',CO:'🇨🇴',
  PE:'🇵🇪',CL:'🇨🇱',NZ:'🇳🇿',KZ:'🇰🇿',KE:'🇰🇪',ET:'🇪🇹',
};

// ── Major cities for close-zoom LOD ─────────────────────────────
const CITIES:[number,number,string,string][]=[
  [40.7,-74,'New York','US'],[34,-118,'Los Angeles','US'],[51.5,-.1,'London','GB'],
  [48.8,2.3,'Paris','FR'],[52.5,13.4,'Berlin','DE'],[55.7,37.6,'Moscow','RU'],
  [35.6,139.7,'Tokyo','JP'],[37.5,127,'Seoul','KR'],[31.2,121.4,'Shanghai','CN'],
  [39.9,116.4,'Beijing','CN'],[28.6,77.2,'New Delhi','IN'],[19,72.8,'Mumbai','IN'],
  [30,31.2,'Cairo','EG'],[6.5,3.3,'Lagos','NG'],[-1.3,36.8,'Nairobi','KE'],
  [41,28.9,'Istanbul','TR'],[-33.8,151.2,'Sydney','AU'],[-37.8,144.9,'Melbourne','AU'],
  [43.7,-79.4,'Toronto','CA'],[-23.5,-46.6,'São Paulo','BR'],[-34.6,-58.4,'Buenos Aires','AR'],
  [19.4,-99.1,'Mexico City','MX'],[1.3,103.8,'Singapore','MY'],[13.7,100.5,'Bangkok','TH'],
  [10.8,106.7,'Ho Chi Minh','VN'],[-6.2,106.8,'Jakarta','ID'],[14.6,121,'Manila','PH'],
  [24.7,46.7,'Riyadh','SA'],[25.2,55.3,'Dubai','AE'],[59.3,18,'Stockholm','SE'],
  [52.4,4.9,'Amsterdam','NL'],[50.8,4.4,'Brussels','BE'],[48.2,16.4,'Vienna','AT'],
  [40.4,-3.7,'Madrid','ES'],[41.9,12.5,'Rome','IT'],[38,-122,'San Francisco','US'],
  [47.6,-122,'Seattle','US'],[41.8,-87.6,'Chicago','US'],[29.7,-95.4,'Houston','US'],
  [33.4,-112,'Phoenix','US'],[25.7,-80.2,'Miami','US'],[42.3,-71,'Boston','US'],
];

// ── Live event generator ─────────────────────────────────────────
let evtId=0;
interface ActivityEvent{id:number;msg:string;flag:string;code:string;ts:number}
function makeEvent(countries:CountryData[]):ActivityEvent|null{
  if(!countries.length)return null;
  const c=countries[Math.floor(Math.random()*countries.length)];
  const code=c.code.toUpperCase();
  const flag=FLAGS[code]||'🌐';
  const name=CNAMES[code]||c.name;
  const msgs=[
    `+1 user joined from ${name}`,
    `+Dev published from ${name}`,
    `New node online — ${name}`,
    `${name} activity ↑`,
    `${flag} ${name} is trending`,
  ];
  return{id:++evtId,msg:msgs[Math.floor(Math.random()*msgs.length)],flag,code,ts:Date.now()};
}

// ── Texture canvas builders ──────────────────────────────────────
function buildNightCanvas():HTMLCanvasElement{
  const W=2048,H=1024,cv=document.createElement('canvas');
  cv.width=W;cv.height=H;const x=cv.getContext('2d')!;
  x.fillStyle='#000';x.fillRect(0,0,W,H);
  const C:[number,number,number][]=[
    [40.7,-74,1],[51.5,-.1,1],[48.8,2.3,.9],[52.5,13.4,.9],[55.7,37.6,.9],
    [35.6,139.7,1],[37.5,127,.9],[31.2,121.4,.9],[39.9,116.4,.9],[28.6,77.2,.9],
    [19,72.8,.8],[23.1,113.3,.8],[-33.8,151.2,.8],[43.7,-79.4,.8],[19.4,-99.1,.8],
    [-23.5,-46.6,.8],[30,31.2,.85],[6.5,3.3,.7],[-1.3,36.8,.65],[41,28.9,.8],
    [59.3,18,.7],[52.4,4.9,.8],[1.3,103.8,.8],[13.7,100.5,.7],[10.8,106.7,.7],
    [-6.2,106.8,.75],[24.7,46.7,.75],[25.2,55.3,.75],[45.5,-73.6,.7],[-34.6,-58.4,.7],
    [50.1,14.4,.6],[47.5,19,.6],[37.9,23.7,.7],[50.8,4.4,.7],[48.2,16.4,.7],
    [34,-118,.85],[41.8,-87.6,.8],[29.7,-95.4,.75],[42.3,-71,.75],[33.4,-112,.7],
  ];
  C.forEach(([lat,lng,br])=>{
    const px=(lng+180)/360*W,py=(90-lat)/180*H;
    const g=x.createRadialGradient(px,py,0,px,py,10*br);
    g.addColorStop(0,`rgba(255,240,180,${.9*br})`);
    g.addColorStop(.4,`rgba(255,200,100,${.35*br})`);
    g.addColorStop(1,'rgba(255,160,50,0)');
    x.fillStyle=g;x.beginPath();x.arc(px,py,10*br,0,Math.PI*2);x.fill();
    x.fillStyle=`rgba(255,255,220,${.88*br})`;x.beginPath();x.arc(px,py,1.5,0,Math.PI*2);x.fill();
  });
  return cv;
}

function buildCloudCanvas():HTMLCanvasElement{
  const W=2048,H=1024,cv=document.createElement('canvas');
  cv.width=W;cv.height=H;const x=cv.getContext('2d')!;x.clearRect(0,0,W,H);
  const s=(n:number)=>{let h=n;h=((h>>16)^h)*0x45d9f3b;h=((h>>16)^h)*0x45d9f3b;return Math.abs(((h>>16)^h)/2147483647);};
  for(let i=0;i<320;i++){
    const cx=s(i*3)*W,cy=s(i*3+1)*H,rx=s(i*3+2)*95+18,ry=rx*(0.26+s(i)*0.34);
    const a=s(i*7)*Math.PI,al=0.07+s(i*5)*0.13;
    x.save();x.translate(cx,cy);x.rotate(a);
    const g=x.createRadialGradient(0,0,0,0,0,rx);
    g.addColorStop(0,`rgba(255,255,255,${al})`);
    g.addColorStop(.65,`rgba(255,255,255,${al*.42})`);
    g.addColorStop(1,'rgba(255,255,255,0)');
    x.fillStyle=g;x.scale(1,ry/rx);x.beginPath();x.arc(0,0,rx,0,Math.PI*2);x.fill();
    x.restore();
  }
  return cv;
}

// ── TopoJSON decoder (minimal, no deps) ─────────────────────────
function decodeTopoBorders(topo:any):number[][][]{
  if(!topo||!topo.arcs||!topo.transform)return[];
  const{arcs,transform}=topo;
  const{scale,translate}=transform;
  const decoded=arcs.map((arc:number[][])=>{
    let x=0,y=0;
    return arc.map((pt:number[])=>{
      x+=pt[0];y+=pt[1];
      return[x*scale[0]+translate[0], y*scale[1]+translate[1]];
    });
  });
  const obj=topo.objects?.countries||topo.objects?.land;
  if(!obj)return decoded;
  const lines:number[][][]=[];
  function extractArcs(geom:any){
    if(!geom)return;
    if(geom.type==='GeometryCollection'){geom.geometries.forEach(extractArcs);return;}
    const arcsField=geom.arcs;
    if(!arcsField)return;
    function flat(a:any):number[]{
      if(typeof a[0]==='number')return[a];
      return a.reduce((acc:any,v:any)=>[...acc,...flat(v)],[]);
    }
    flat(arcsField).forEach((idx:number)=>{
      const arcIdx=idx<0?~idx:idx;
      if(decoded[arcIdx])lines.push(decoded[arcIdx]);
    });
  }
  if(obj.type==='GeometryCollection')obj.geometries.forEach(extractArcs);
  return lines;
}

// ── Main Component ───────────────────────────────────────────────
type DataLayer='users'|'signals'|'devices';
export default function HolographicMap({activeCountries=[]}: Props){
  const wrapRef=useRef<HTMLDivElement>(null);
  const animRef=useRef<number>(0);
  const globeRef=useRef<any>(null);
  const [dataLayer,setDataLayer]=useState<DataLayer>('users');
  const dataLayerRef=useRef<DataLayer>('users');
  useEffect(()=>{
    try{ const s=localStorage.getItem('hmap:layer'); if(s==='users'||s==='signals'||s==='devices') setDataLayer(s); }catch{}
  },[]);
  useEffect(()=>{ dataLayerRef.current=dataLayer; try{ localStorage.setItem('hmap:layer',dataLayer); }catch{} },[dataLayer]);

  // Brand-tier palette (cohesive with app colors — 5 category buckets)
  // Stable pseudo-hash per country code → same color every render
  const tierColor=useCallback((code:string)=>{
    let h=0; for(let i=0;i<code.length;i++) h=(h*31+code.charCodeAt(i))>>>0;
    // 5 tiers all tuned to work on dark bg + match the cyan/gold/violet palette
    const tiers=[0x00f5c4,0x00c8ff,0xfbbf24,0xa78bfa,0xffffff];
    return tiers[h%tiers.length];
  },[]);

  // Apply data layer → walks overlay meshes & mutates materials (smooth)
  useEffect(()=>{
    const list=overlayRef.current; if(!list||!list.length) return;
    list.forEach((o:any)=>{
      const ud=o?.userData; if(!ud||!o.material) return;
      const m=o.material;
      if(ud.isArc){
        const base=ud.baseOp??.16;
        m.opacity=dataLayer==='signals'?Math.min(.7,base*3.4):dataLayer==='devices'?base*.35:base;
      } else if(ud.isParticle){
        m.opacity=dataLayer==='signals'?Math.min(1,(m.opacity||.5)*1.5+.25):dataLayer==='devices'?.12:(m.userData?.baseOp??m.opacity);
      } else if(ud.isNodeGlow){
        const base=ud.baseOp??.15;
        m.opacity=dataLayer==='signals'?base*.55:dataLayer==='devices'?base*1.25:base;
        if(dataLayer==='devices'&&ud.code&&!ud.isUser){
          m.color.setHex(tierColor(ud.code));
        } else {
          m.color.setHex(ud.baseColor);
        }
      } else if(ud.isCountryNode){
        if(dataLayer==='devices'&&ud.code&&!ud.isUser){
          m.color.setHex(tierColor(ud.code));
        } else {
          m.color.setHex(ud.baseColor);
        }
        m.opacity=dataLayer==='signals'?.65:.98;
      } else if(ud.countryLabel){
        m.opacity=dataLayer==='signals'?.45:1;
      }
    });
  },[dataLayer,activeCountries,tierColor]);
  const camZRef=useRef(8.0);
  const targetZRef=useRef(8.0);
  const qualRef=useRef<'low'|'mid'|'high'>('high');
  const fpsFrames=useRef(0);
  const fpsLast=useRef(Date.now());
  const fpsHist=useRef<number[]>([]);
  const overlayRef=useRef<any[]>([]);
  const borderMeshRef=useRef<any[]>([]);
  const cityMeshRef=useRef<any[]>([]);
  const activeRef=useRef(activeCountries);
  activeRef.current=activeCountries;
  const isFlying=useRef(false);
  const cinematicDone=useRef(false);
  const userCountry=useMemo(()=>getUserCountry(),[]);
  const userCountryRef=useRef(userCountry);
  const TRef=useRef<any>(null);
  const rendRef=useRef<any>(null);
  const sceneRef=useRef<any>(null);
  const obsRef=useRef(false);
  // ── FIX: track last activeCountries length to detect late data arrival ──
  const prevActiveLenRef=useRef(0);

  const [popup,setPopup]=useState<{
    name:string;count:number;pubs:number;flag:string;level:UserLevel;
    trending:boolean;x:number;y:number;
  }|null>(null);
  const [events,setEvents]=useState<ActivityEvent[]>([]);
  const [loadPct,setLoadPct]=useState(0);
  const [ready,setReady]=useState(false);
  const [lod,setLod]=useState<'far'|'mid'|'close'>('far');
  const [welcomeMsg,setWelcomeMsg]=useState('');
  const [obsMode,setObsMode]=useState(false);
  const [trendingCodes]=useState<Set<string>>(()=>{
    const s=new Set<string>();
    activeCountries.slice(0,3).forEach(c=>s.add(c.code.toUpperCase()));
    return s;
  });
  const closePopup=useCallback(()=>setPopup(null),[]);

  // ── Fly to coords ─────────────────────────────────────────────
  const flyTo=useCallback((lat:number,lng:number,endZ:number,dur=2.2)=>{
    const globe=globeRef.current;if(!globe)return;
    isFlying.current=true;
    const tY=-(lng+180)*Math.PI/180+Math.PI;
    const tX=lat*Math.PI/180*.42;
    const sY=globe.rotation.y,sX=globe.rotation.x,sZ=camZRef.current;
    const steps=Math.round(dur*60);let step=0;
    const go=()=>{
      step++;const t=step/steps;
      const e=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
      globe.rotation.y=sY+(tY-sY)*e;
      globe.rotation.x=sX+(tX-sX)*e;
      camZRef.current=sZ+(endZ-sZ)*e;targetZRef.current=camZRef.current;
      if(step<steps)requestAnimationFrame(go);else isFlying.current=false;
    };go();
  },[]);

  // ── Observer cycle ────────────────────────────────────────────
  const startObs=useCallback(()=>{
    const go=(i:number)=>{
      if(!obsRef.current)return;
      const acts=activeRef.current;if(!acts.length)return;
      const c=acts[i%acts.length];
      const co=CC[c.code.toUpperCase()];
      if(co)flyTo(co[0],co[1],2.0,2.5);
      setTimeout(()=>go(i+1),4800);
    };go(0);
  },[flyTo]);

  // ── Add activity event + globe pulse ─────────────────────────
  const addEvent=useCallback(()=>{
    const e=makeEvent(activeRef.current);if(!e)return;
    setEvents(p=>[e,...p].slice(0,3));
    const T=TRef.current,globe=globeRef.current;if(!T||!globe)return;
    const co=CC[e.code];if(!co)return;
    function ll2v(lat:number,lng:number,r=1){
      const phi=(90-lat)*Math.PI/180,th=(lng+180)*Math.PI/180;
      return new T.Vector3(-Math.sin(phi)*Math.cos(th),Math.cos(phi),Math.sin(phi)*Math.sin(th)).multiplyScalar(r);
    }
    const pos=ll2v(co[0],co[1],1.0),dir=pos.clone().normalize();
    const ring=new T.Mesh(new T.RingGeometry(.018,.028,32),
      new T.MeshBasicMaterial({color:0x00f5c4,side:T.DoubleSide,transparent:true,opacity:.75,depthTest:true}));
    ring.position.copy(pos.clone().add(dir.clone().multiplyScalar(.002)));
    ring.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),dir.clone().normalize());
    ring.userData={evtPulse:true,born:Date.now()};
    globe.add(ring);overlayRef.current.push(ring);
  },[]);

  // ── Build borders from TopoJSON ───────────────────────────────
  const buildBorders=useCallback((T:any,globe:any,lines:number[][][])=>{
    borderMeshRef.current.forEach(o=>globe.remove(o));
    borderMeshRef.current=[];
    if(!lines.length)return;
    function ll2v(lng:number,lat:number,r=1){
      const phi=(90-lat)*Math.PI/180,th=(lng+180)*Math.PI/180;
      return new T.Vector3(-Math.sin(phi)*Math.cos(th),Math.cos(phi),Math.sin(phi)*Math.sin(th)).multiplyScalar(r);
    }
    const allPts:THREE.Vector3[]=[];
    const maxLines=qualRef.current==='low'?400:lines.length;
    const step=Math.max(1,Math.floor(lines.length/maxLines));
    for(let i=0;i<lines.length;i+=step){
      const arc=lines[i];
      if(arc.length<2)continue;
      for(let j=0;j<arc.length-1;j++){
        const a=arc[j],b=arc[j+1];
        if(Math.abs(a[0]-b[0])>90)continue;
        allPts.push(ll2v(a[0],a[1],1.0015));
        allPts.push(ll2v(b[0],b[1],1.0015));
      }
    }
    // Far layer — always visible, engraved feel
    const geoFar=new T.BufferGeometry().setFromPoints(allPts);
    const matFar=new T.LineBasicMaterial({color:0x2277aa,transparent:true,opacity:.30,depthWrite:false});
    const meshFar=new T.LineSegments(geoFar,matFar);
    meshFar.userData={isBorder:true,borderLayer:'far'};
    globe.add(meshFar);borderMeshRef.current.push(meshFar);
    // Bright layer — visible at mid/close zoom
    const geoClose=new T.BufferGeometry().setFromPoints(allPts);
    const matClose=new T.LineBasicMaterial({color:0x00e8ff,transparent:true,opacity:.70,depthWrite:false});
    const meshClose=new T.LineSegments(geoClose,matClose);
    meshClose.userData={isBorder:true,borderLayer:'close'};
    meshClose.visible=false;
    globe.add(meshClose);borderMeshRef.current.push(meshClose);
  },[]);

  // ── Country name label sprite — engraved / glowing ─────────────
  function makeLabel(T:any, text:string, color:string, fontSize=18):any{
    const scale=2;
    const cv=document.createElement('canvas'),ctx=cv.getContext('2d')!;
    const font=`bold ${fontSize*scale}px Arial,sans-serif`;
    ctx.font=font;
    const tw=ctx.measureText(text).width;
    cv.width=Math.ceil(tw)+28*scale;
    cv.height=(fontSize+16)*scale;
    ctx.scale(scale,scale);
    ctx.font=`bold ${fontSize}px Arial,sans-serif`;
    ctx.fillStyle='rgba(0,0,0,.8)';
    ctx.fillText(text,15,fontSize+5);
    ctx.fillText(text,14,fontSize+4);
    ctx.strokeStyle='rgba(0,0,0,.55)';
    ctx.lineWidth=3;
    ctx.strokeText(text,13,fontSize+3);
    ctx.fillStyle=color;
    ctx.fillText(text,13,fontSize+3);
    ctx.fillStyle='rgba(255,255,255,.18)';
    ctx.fillText(text,13,fontSize+2);
    const tex=new T.CanvasTexture(cv);
    tex.generateMipmaps=true;
    tex.minFilter=T.LinearMipmapLinearFilter;
    tex.magFilter=T.LinearFilter;
    const mat=new T.SpriteMaterial({
      map:tex,transparent:true,depthTest:true,depthWrite:false,opacity:1.0,
    });
    const sp=new T.Sprite(mat);
    const aspect=cv.width/cv.height;
    sp.scale.set(aspect*.1,.1,1);
    return sp;
  }

  // ── Build city markers ────────────────────────────────────────
  const buildCities=useCallback((T:any,globe:any)=>{
    cityMeshRef.current.forEach(o=>globe.remove(o));
    cityMeshRef.current=[];
    function ll2v(lat:number,lng:number,r=1){
      const phi=(90-lat)*Math.PI/180,th=(lng+180)*Math.PI/180;
      return new T.Vector3(-Math.sin(phi)*Math.cos(th),Math.cos(phi),Math.sin(phi)*Math.sin(th)).multiplyScalar(r);
    }
    const dotGeo=new T.SphereGeometry(.003,6,6);
    CITIES.forEach(([lat,lng,name,code])=>{
      const isActive=activeRef.current.some(c=>c.code.toUpperCase()===code);
      const pos=ll2v(lat,lng,1.0),dir=pos.clone().normalize();
      const dot=new T.Mesh(dotGeo,isActive
        ?new T.MeshBasicMaterial({color:0x00f5c4,transparent:true,opacity:.9})
        :new T.MeshBasicMaterial({color:0x445566,transparent:true,opacity:.4}));
      dot.position.copy(pos.clone().add(dir.clone().multiplyScalar(.001)));
      dot.userData={city:name,code,lod:'close'};
      globe.add(dot);cityMeshRef.current.push(dot);
      if(isActive){
        const lbl=makeLabel(T,name,'rgba(0,245,196,.95)',13);
        lbl.position.copy(pos.clone().add(dir.clone().multiplyScalar(.065)));
        lbl.userData={lod:'close'};
        globe.add(lbl);cityMeshRef.current.push(lbl);
      }
    });
  },[]);

  // ── Build country nodes ───────────────────────────────────────
  const buildNodes=useCallback((T:any,globe:any)=>{
    overlayRef.current.forEach(o=>globe.remove(o));
    overlayRef.current=[];
    const acts=activeRef.current;
    const uc=userCountryRef.current;
    function ll2v(lat:number,lng:number,r=1){
      const phi=(90-lat)*Math.PI/180,th=(lng+180)*Math.PI/180;
      return new T.Vector3(-Math.sin(phi)*Math.cos(th),Math.cos(phi),Math.sin(phi)*Math.sin(th)).multiplyScalar(r);
    }

    const activeWithCoords=acts.filter(n=>!!CC[n.code.toUpperCase()]);

    // ── Arcs + animated data packets ─────────────────────────────
    const drawnPairs=new Set<string>();
    activeWithCoords.forEach((na,i)=>{
      const ca=CC[na.code.toUpperCase()];
      const others=activeWithCoords
        .filter((_,j)=>j!==i)
        .map(nb=>{
          const cb=CC[nb.code.toUpperCase()];
          const dlat=ca[0]-cb[0],dlng=ca[1]-cb[1];
          return{nb,dist:Math.sqrt(dlat*dlat+dlng*dlng)};
        })
        .sort((a,b)=>a.dist-b.dist)
        .slice(0,2);

      others.forEach(({nb})=>{
        const pairKey=[na.code,nb.code].sort().join('|');
        if(drawnPairs.has(pairKey))return;
        drawnPairs.add(pairKey);

        const cb=CC[nb.code.toUpperCase()];
        const p1=ll2v(ca[0],ca[1],1.012),p2=ll2v(cb[0],cb[1],1.012);
        const dist=p1.distanceTo(p2);
        const mid=p1.clone().add(p2).normalize().multiplyScalar(1.0+dist*.6);
        const curve=new T.QuadraticBezierCurve3(p1,mid,p2);

        const isUserArc=
          na.code.toUpperCase()===uc?.toUpperCase()||
          nb.code.toUpperCase()===uc?.toUpperCase();

        const arcLine=new T.Line(
          new T.BufferGeometry().setFromPoints(curve.getPoints(80)),
          new T.LineBasicMaterial({
            color:isUserArc?0xfbbf24:0x00c8ff,
            transparent:true,
            opacity:isUserArc?.28:.16,
            depthWrite:false,
            depthTest:true,
          })
        );
        arcLine.userData={isArc:true,isUserArc,baseOp:isUserArc?.28:.16};
        globe.add(arcLine);overlayRef.current.push(arcLine);

        const speeds=[.0022+Math.random()*.003,.0022+Math.random()*.003];
        const offsets=[Math.random(),(Math.random()+.5)%1];
        speeds.forEach((spd,pi)=>{
          const gPkt=new T.Mesh(
            new T.SphereGeometry(.0085,8,8),
            new T.MeshBasicMaterial({
              color:isUserArc?0xffdd44:0x00ffcc,
              transparent:true,opacity:.35,depthWrite:false,
            })
          );
          gPkt.userData={arc:curve,t:offsets[pi],spd,isParticle:true,glowFor:null};
          globe.add(gPkt);overlayRef.current.push(gPkt);

          const pkt=new T.Mesh(
            new T.SphereGeometry(.0042,8,8),
            new T.MeshBasicMaterial({
              color:isUserArc?0xffffff:0x00f5c4,
              transparent:true,opacity:.95,
            })
          );
          pkt.userData={arc:curve,t:(offsets[pi]+.04)%1,spd,isParticle:true};
          globe.add(pkt);overlayRef.current.push(pkt);
        });
      });
    });

    // ── Country nodes ──────────────────────────────────────�����──────
    acts.forEach((n)=>{
      const c=CC[n.code.toUpperCase()];if(!c)return;
      const isUser=n.code.toUpperCase()===uc?.toUpperCase();
      const level=getLevel(n.count);

      const col=isUser?0x00f5c4:LEVEL_COLORS[level];
      const sz=isUser?.018:LEVEL_SIZES[level];
      const pos=ll2v(c[0],c[1],1.0),dir=pos.clone().normalize();
      const offset=pos.clone().add(dir.clone().multiplyScalar(.003));

      const glowCol=isUser?0x00f5c4:col;
      const glowBaseOp=isUser?.22:level==='elite'?.26:level==='pro'?.2:.13;
      const glow=new T.Mesh(new T.SphereGeometry(sz*5.5,8,8),
        new T.MeshBasicMaterial({
          color:glowCol,transparent:true,
          opacity:glowBaseOp,
          depthWrite:false,depthTest:true,
        }));
      glow.position.copy(offset);
      glow.userData={isNodeGlow:true,isUser,level,baseOp:glowBaseOp,baseColor:glowCol,code:n.code.toUpperCase()};
      globe.add(glow);overlayRef.current.push(glow);

      const core=new T.Mesh(new T.SphereGeometry(sz,8,8),
        new T.MeshBasicMaterial({color:col,transparent:true,opacity:.98}));
      core.position.copy(offset);
      core.userData={country:n,isClick:true,level,isCountryNode:true,isUser,baseColor:col,baseOp:.98,code:n.code.toUpperCase(),isTrending:trendingCodes.has(n.code.toUpperCase())};
      globe.add(core);overlayRef.current.push(core);

      const ring=new T.Mesh(new T.RingGeometry(sz*2,sz*3,32),
        new T.MeshBasicMaterial({
          color:col,side:T.DoubleSide,transparent:true,
          opacity:isUser?.5:.35,depthWrite:false,depthTest:true,
        }));
      ring.position.copy(offset);
      ring.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),dir.clone().normalize());
      ring.userData={pulse:true,phase:Math.random()*Math.PI*2,pulseMin:.3,pulseMax:.55};
      globe.add(ring);overlayRef.current.push(ring);

      if(isUser){
        const ring2=new T.Mesh(new T.RingGeometry(sz*4,sz*5.2,32),
          new T.MeshBasicMaterial({
            color:0x00f5c4,side:T.DoubleSide,transparent:true,
            opacity:.2,depthWrite:false,depthTest:true,
          }));
        ring2.position.copy(offset);
        ring2.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),dir.clone().normalize());
        ring2.userData={pulse:true,phase:Math.PI,pulseMin:.1,pulseMax:.28};
        globe.add(ring2);overlayRef.current.push(ring2);
      }

      if(trendingCodes.has(n.code.toUpperCase())){
        const tr=new T.Mesh(new T.RingGeometry(sz*3.5,sz*4.3,32),
          new T.MeshBasicMaterial({
            color:0xfbbf24,side:T.DoubleSide,transparent:true,
            opacity:.22,depthWrite:false,
          }));
        tr.position.copy(offset);
        tr.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),dir.clone().normalize());
        tr.userData={trendSpin:true};
        globe.add(tr);overlayRef.current.push(tr);
      }

      const labelColor=isUser?'rgba(0,245,196,1)':
        level==='elite'?'rgba(255,107,107,.95)':
        level==='pro'?'rgba(251,191,36,.92)':
        'rgba(180,230,255,.88)';
      const lbl=makeLabel(T,CNAMES[n.code.toUpperCase()]||n.name,labelColor,isUser?17:14);
      lbl.position.copy(pos.clone().add(dir.clone().multiplyScalar(.09)));
      lbl.userData={countryLabel:true};
      globe.add(lbl);overlayRef.current.push(lbl);
    });
  },[trendingCodes]);

  // ── Main useEffect ────────────────────────────────────────────
  useEffect(()=>{
    const wrap=wrapRef.current;if(!wrap)return;
    let cleanup:(()=>void)|null=null;
    let p=5;setLoadPct(5);
    const piv=setInterval(()=>{p=Math.min(p+7+Math.random()*9,83);setLoadPct(Math.round(p));},130);

    const weak=navigator.hardwareConcurrency<=2||(typeof(navigator as any).deviceMemory!=='undefined'&&(navigator as any).deviceMemory<=2);
    if(weak)qualRef.current='low';

    import('three').then(T=>{
      TRef.current=T;
      const W=wrap.clientWidth,H=wrap.clientHeight;
      const renderer=new T.WebGLRenderer({
        antialias:true,
        powerPreference:'high-performance',
        logarithmicDepthBuffer:false,
      });
      renderer.setSize(W,H);
      renderer.setPixelRatio(Math.min(devicePixelRatio,qualRef.current==='low'?1.5:3));
      renderer.setClearColor(0x000000,1);
      renderer.toneMapping=(T as any).ACESFilmicToneMapping||1;
      renderer.toneMappingExposure=1.1;
      rendRef.current=renderer;
      const el=renderer.domElement;
      el.style.cssText='position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:grab';
      wrap.appendChild(el);

      const scene=new T.Scene();
      sceneRef.current=scene;
      const cam=new T.PerspectiveCamera(45,W/H,.01,1000);
      cam.position.z=camZRef.current;

      const sv:number[]=[],sc:number[]=[];
      const STAR_N=qualRef.current==='low'?1800:4500;
      for(let i=0;i<STAR_N;i++){
        const t2=Math.random()*Math.PI*2,p2=Math.acos(2*Math.random()-1),r=80+Math.random()*55;
        sv.push(r*Math.sin(p2)*Math.cos(t2),r*Math.cos(p2),r*Math.sin(p2)*Math.sin(t2));
        const b=.35+Math.random()*.65;sc.push(b,b,b+Math.random()*.1,1);
      }
      const sg=new T.BufferGeometry();
      sg.setAttribute('position',new T.Float32BufferAttribute(sv,3));
      sg.setAttribute('color',new T.Float32BufferAttribute(sc,4));
      const stars=new T.Points(sg,new T.PointsMaterial({
        size:.095,vertexColors:true,transparent:true,opacity:.75,
        sizeAttenuation:true,
      }));
      scene.add(stars);

      let sstar:any=null;
      function spawnStar(){
        if(sstar)return;
        const a=Math.random()*Math.PI*2,b=Math.acos(2*Math.random()-1),r=25+Math.random()*15;
        const x=r*Math.sin(b)*Math.cos(a),y=r*Math.cos(b),z=r*Math.sin(b)*Math.sin(a);
        const dir=new T.Vector3(-(x*.8),-(y*.5),-(z*.8)).normalize().multiplyScalar(15);
        const pts=[new T.Vector3(x,y,z),new T.Vector3(x+dir.x,y+dir.y,z+dir.z)];
        sstar=new T.Line(new T.BufferGeometry().setFromPoints(pts),
          new T.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.8}));
        sstar.userData={born:Date.now(),life:700};
        scene.add(sstar);
      }

      const globe=new T.Group();
      scene.add(globe);
      globeRef.current=globe;

      const hemi=new T.HemisphereLight(0x0d2a5e,0x000510,0.6);
      scene.add(hemi);
      const sun=new T.DirectionalLight(0xfff5e0,3.8);
      sun.position.set(-5,3,6);scene.add(sun);
      const fill=new T.DirectionalLight(0x1a3a7a,0.7);
      fill.position.set(5,-2,-4);scene.add(fill);
      const rim=new T.DirectionalLight(0xff8844,0.18);
      rim.position.set(3,1,-6);scene.add(rim);

      let globeBuilt=false;
      let welcomeTimeout:ReturnType<typeof setTimeout>;
      let topoAbort:AbortController|null=null;

      function buildSpecularCanvas():HTMLCanvasElement{
        const W2=1024,H2=512,cv=document.createElement('canvas');
        cv.width=W2;cv.height=H2;
        const ctx=cv.getContext('2d')!;
        ctx.fillStyle='#111';
        ctx.fillRect(0,0,W2,H2);
        ctx.fillStyle='rgba(180,180,180,0.9)';
        ctx.fillRect(80,30,110,380);
        ctx.fillRect(370,20,110,450);
        ctx.fillRect(480,20,280,330);
        ctx.fillRect(690,290,100,110);
        ctx.filter='blur(28px)';
        ctx.drawImage(cv,0,0);
        return cv;
      }

      function setupGlobe(earthTex:THREE.Texture|null){
        clearInterval(piv);
        const ma=renderer.capabilities.getMaxAnisotropy();
        const nightTex=new T.CanvasTexture(buildNightCanvas());
        nightTex.anisotropy=ma;

        const roughTex=new T.CanvasTexture(buildSpecularCanvas());
        roughTex.anisotropy=ma;

        if(earthTex){
          earthTex.anisotropy=ma;
          earthTex.generateMipmaps=true;
          earthTex.minFilter=T.LinearMipmapLinearFilter;
          earthTex.magFilter=T.LinearFilter;
          earthTex.colorSpace=(T as any).SRGBColorSpace||'srgb';
        }

        const earthMat=new (T as any).MeshStandardMaterial({
          ...(earthTex ? { map: earthTex } : {}),
          color:earthTex?0xffffff:0x0d2040,
          roughnessMap:roughTex,
          roughness:earthTex?0.72:0.85,
          metalness:0.0,
          emissiveMap:nightTex,
          emissive:new T.Color(.98,.68,.22),
          emissiveIntensity:earthTex?0.62:0.72,
        });

        const segs=qualRef.current==='low'?80:192;
        globe.add(new T.Mesh(new T.SphereGeometry(1,segs,segs/2),earthMat));

        // ── Fresnel rim (inner bloom) ──
        const atmInnerMat=new T.ShaderMaterial({
          uniforms:{ glow:{ value:new T.Color(0x6ab0ff) } },
          vertexShader:'varying vec3 vN; void main(){ vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
          fragmentShader:'uniform vec3 glow; varying vec3 vN; void main(){ float i=pow(max(0.0,0.86-dot(vN,vec3(0.0,0.0,1.0))),2.4)*0.55; gl_FragColor=vec4(glow,1.0)*i; }',
          side:T.FrontSide, transparent:true, depthWrite:false, blending:T.AdditiveBlending,
        });
        globe.add(new T.Mesh(new T.SphereGeometry(1.014,96,48), atmInnerMat));

        // ── Fresnel halo (outer atmosphere) ──
        const atmOuterMat=new T.ShaderMaterial({
          uniforms:{ glow:{ value:new T.Color(0x3273d9) } },
          vertexShader:'varying vec3 vN; void main(){ vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
          fragmentShader:'uniform vec3 glow; varying vec3 vN; void main(){ float i=pow(max(0.0,0.72-dot(vN,vec3(0.0,0.0,1.0))),3.0)*2.4; gl_FragColor=vec4(glow,1.0)*i; }',
          side:T.BackSide, transparent:true, depthWrite:false, blending:T.AdditiveBlending,
        });
        globe.add(new T.Mesh(new T.SphereGeometry(1.17,96,48), atmOuterMat));

        // ── Soft deep-space backdrop ──
        globe.add(new T.Mesh(new T.SphereGeometry(1.30,64,32),
          new T.MeshBasicMaterial({
            color:0x0a1826, transparent:true, opacity:.07,
            side:T.BackSide, depthWrite:false,
          })));

        // ── Meridian / parallel grid — sci-fi overlay ──
        const gridCol=0x3bb1d9, gridOp=.07;
        // Parallels (latitudes)
        for(let lat=-75; lat<=75; lat+=15){
          if(lat===0) continue; // equator drawn bolder below
          const r=Math.cos(lat*Math.PI/180), yy=Math.sin(lat*Math.PI/180);
          const pts:any[]=[];
          for(let i=0;i<=96;i++){
            const a=i/96*Math.PI*2;
            pts.push(new T.Vector3(Math.cos(a)*r,yy,Math.sin(a)*r).multiplyScalar(1.0018));
          }
          const ln=new T.LineLoop(
            new T.BufferGeometry().setFromPoints(pts),
            new T.LineBasicMaterial({color:gridCol,transparent:true,opacity:gridOp,depthWrite:false})
          );
          ln.userData={isGrid:true};
          globe.add(ln);
        }
        // Equator (brighter)
        {
          const pts:any[]=[];
          for(let i=0;i<=128;i++){
            const a=i/128*Math.PI*2;
            pts.push(new T.Vector3(Math.cos(a),0,Math.sin(a)).multiplyScalar(1.0022));
          }
          const eq=new T.LineLoop(
            new T.BufferGeometry().setFromPoints(pts),
            new T.LineBasicMaterial({color:0x5cc8e8,transparent:true,opacity:.14,depthWrite:false})
          );
          eq.userData={isGrid:true};
          globe.add(eq);
        }
        // Meridians (longitudes)
        for(let lng=0; lng<360; lng+=15){
          const th=lng*Math.PI/180;
          const pts:any[]=[];
          for(let i=0;i<=96;i++){
            const phi=i/96*Math.PI*2;
            pts.push(new T.Vector3(Math.sin(phi)*Math.cos(th),Math.cos(phi),Math.sin(phi)*Math.sin(th)).multiplyScalar(1.0018));
          }
          const ln=new T.LineLoop(
            new T.BufferGeometry().setFromPoints(pts),
            new T.LineBasicMaterial({color:gridCol,transparent:true,opacity:gridOp,depthWrite:false})
          );
          ln.userData={isGrid:true};
          globe.add(ln);
        }

        if(qualRef.current!=='low'){
          const cloudTex=new T.CanvasTexture(buildCloudCanvas());
          cloudTex.anisotropy=ma;
          const cm=new T.Mesh(new T.SphereGeometry(1.009,96,48),
            new (T as any).MeshStandardMaterial({
              map:cloudTex,alphaMap:cloudTex,
              transparent:true,opacity:.38,
              depthWrite:false,roughness:1,metalness:0,
              blending:T.NormalBlending,
            }));
          cm.userData={isCloud:true};globe.add(cm);
        }

        // ── Aurora polar halos (subtle emissive discs at poles) ──
        {
          const mkPole=(yPos:number,color:number)=>{
            const m=new T.Mesh(
              new T.RingGeometry(0.08,0.52,64,1),
              new T.ShaderMaterial({
                uniforms:{ c:{ value:new T.Color(color) } },
                vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
                fragmentShader:'uniform vec3 c; varying vec2 vUv; void main(){ float d=length(vUv-vec2(0.5)); float a=smoothstep(0.5,0.0,d)*0.45; gl_FragColor=vec4(c,a); }',
                transparent:true, depthWrite:false, blending:T.AdditiveBlending, side:T.DoubleSide,
              })
            );
            m.rotation.x=Math.PI/2;
            m.position.y=yPos;
            m.userData={isAurora:true};
            scene.add(m);
          };
          mkPole(1.04, 0x3bff8f);   // North — cyan-green
          mkPole(-1.04, 0xb088ff);  // South — violet
        }

        // ── Satellite orbits — 2 subtle rings (restraint > clutter) ──
        const satConfigs=[
          { r:1.24, tilt:0.22, spd:0.00075, col:0x00f5c4, ringOp:0.05 },
          { r:1.38, tilt:-0.42, spd:-0.00055, col:0x6ab0ff, ringOp:0.04 },
        ];
        satConfigs.forEach((cfg,idx)=>{
          // orbital ring
          const pts:any[]=[];
          for(let i=0;i<=160;i++){
            const a=i/160*Math.PI*2;
            pts.push(new T.Vector3(Math.cos(a)*cfg.r,0,Math.sin(a)*cfg.r));
          }
          const ring=new T.LineLoop(
            new T.BufferGeometry().setFromPoints(pts),
            new T.LineBasicMaterial({color:cfg.col,transparent:true,opacity:cfg.ringOp,depthWrite:false})
          );
          ring.rotation.x=cfg.tilt;
          ring.userData={isSatRing:true};
          scene.add(ring);

          // satellite body (tiny diamond)
          const body=new T.Mesh(
            new T.OctahedronGeometry(0.014,0),
            new T.MeshBasicMaterial({color:cfg.col,transparent:true,opacity:.70,depthWrite:false})
          );
          body.userData={isSat:true,orbitR:cfg.r,tilt:cfg.tilt,spd:cfg.spd,phase:idx*2.1,idx};
          scene.add(body);

          // satellite halo (additive glow) — softer
          const halo=new T.Mesh(
            new T.SphereGeometry(0.032,12,8),
            new T.MeshBasicMaterial({color:cfg.col,transparent:true,opacity:.16,depthWrite:false,blending:T.AdditiveBlending})
          );
          halo.userData={isSatHalo:true,follow:body};
          scene.add(halo);
        });

        // ── Space dust: drifting parallax particles ──
        {
          const dustCount=qualRef.current==='low'?24:qualRef.current==='mid'?48:72;
          const dustGeo=new T.BufferGeometry();
          const dustPos=new Float32Array(dustCount*3);
          for(let i=0;i<dustCount;i++){
            const r=2.3+Math.random()*1.8;
            const th=Math.random()*Math.PI*2;
            const ph=Math.acos(2*Math.random()-1);
            dustPos[i*3]=r*Math.sin(ph)*Math.cos(th);
            dustPos[i*3+1]=r*Math.cos(ph);
            dustPos[i*3+2]=r*Math.sin(ph)*Math.sin(th);
          }
          dustGeo.setAttribute('position',new T.BufferAttribute(dustPos,3));
          const dust=new T.Points(dustGeo,new T.PointsMaterial({
            color:0x9ed7ff,size:0.012,transparent:true,opacity:.35,
            depthWrite:false,blending:T.AdditiveBlending,sizeAttenuation:true,
          }));
          dust.userData={isDust:true};
          scene.add(dust);
        }

        buildNodes(T,globe);
        buildCities(T,globe);

        topoAbort = new AbortController();
        fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json', {signal:topoAbort.signal})
          .then(r=>r.json())
          .then(topo=>{
            const lines=decodeTopoBorders(topo);
            buildBorders(T,globe,lines);
          })
          .catch(()=>{
            // Primary country-borders CDN failed; fall back to jsdelivr.
            // Both CDNs failing simultaneously = globe renders without borders
            // (visibly broken), so this inner failure is worth surfacing.
            if(!topoAbort)return;
            fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json', {signal:topoAbort.signal})
              .then(r=>r.json())
              .then(topo=>buildBorders(T,globe,decodeTopoBorders(topo)))
              .catch((err)=>logger.error('holographicMap.bordersCDN.bothFailed', err));
          });

        setLoadPct(100);setReady(true);
        setTimeout(()=>setLoadPct(0),700);
        const lo=wrap?.querySelector('.gg-lo') as HTMLElement|null;
        if(lo){lo.style.opacity='0';setTimeout(()=>lo?.remove(),500);}

        const uc=userCountryRef.current;
        const coords=uc?CC[uc]:null;
        welcomeTimeout = setTimeout(()=>{
          flyTo(0,0,3.5,2.0);
          setTimeout(()=>{
            if(coords){
              flyTo(coords[0],coords[1],2.1,2.5);
              setTimeout(()=>{
                cinematicDone.current=true;
                setWelcomeMsg('Welcome — you are part of the network');
                welcomeTimeout = setTimeout(()=>setWelcomeMsg(''),4500);
              },2700);
            }else{
              flyTo(20,20,2.6,2.5);
              setTimeout(()=>{cinematicDone.current=true;},2700);
            }
          },2300);
        },900);
      }

      const URLS_HQ=[
        'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg',
        'https://raw.githubusercontent.com/turban/webgl-earth/master/images/2_no_clouds_4k.jpg',
        'https://cdn.jsdelivr.net/npm/three-globe@2.31.0/example/img/earth-day.jpg',
        'https://unpkg.com/three-globe@2.31.0/example/img/earth-day.jpg',
        'https://cdn.jsdelivr.net/npm/three-globe@2.18.0/example/img/earth-blue-marble.jpg',
        'https://unpkg.com/three-globe@2.18.0/example/img/earth-blue-marble.jpg',
        'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
      ];
      const tl=new T.TextureLoader();tl.crossOrigin='anonymous';

      function tryTex(i:number){
        if(i>=URLS_HQ.length){if(!globeBuilt){globeBuilt=true;setupGlobe(null);}return;}
        tl.load(
          URLS_HQ[i],
          tex=>{
            if(!globeBuilt){
              globeBuilt=true;
              setupGlobe(tex);
            } else {
              const earthMesh=globe.children.find((c:any)=>c.isMesh&&c.geometry?.type==='SphereGeometry'&&(c.material?.isMeshStandardMaterial||c.material?.isMeshPhongMaterial));
              if(earthMesh){
                tex.anisotropy=renderer.capabilities.getMaxAnisotropy();
                tex.generateMipmaps=true;
                tex.minFilter=T.LinearMipmapLinearFilter;
                tex.magFilter=T.LinearFilter;
                tex.colorSpace=(T as any).SRGBColorSpace||'srgb';
                tex.needsUpdate=true;
                (earthMesh as any).material.map=tex;
                (earthMesh as any).material.color.set(0xffffff);
                (earthMesh as any).material.needsUpdate=true;
              }
            }
          },
          undefined,
          ()=>tryTex(i+1)
        );
      }
      setTimeout(()=>{if(!globeBuilt){globeBuilt=true;setupGlobe(null);}},800);
      tryTex(0);

      let lastLod='far';
      function updateLOD(){
        const z=camZRef.current;
        const nl=z>3.4?'far':z>1.75?'mid':'close';
        if(nl===lastLod)return;
        lastLod=nl;setLod(nl as any);
        borderMeshRef.current.forEach(o=>{
          if(o.userData?.borderLayer==='far')o.visible=true;
          else if(o.userData?.borderLayer==='close')o.visible=nl!=='far';
        });
        cityMeshRef.current.forEach(o=>{o.visible=nl==='close';});
        overlayRef.current.forEach(o=>{
          if(o.userData?.evtPulse)return;
          if(o.userData?.countryLabel){
            o.visible=nl!=='far';
          }else{
            o.visible=nl!=='far';
          }
        });
      }

      // ── Raycaster / tap ──────────────────────────────────────────
      const ray=new T.Raycaster(),mouse=new T.Vector2();
      let lastTap=0;
      function onTap(e:MouseEvent|TouchEvent){
        const rect=el.getBoundingClientRect();
        let mx:number,my:number;
        if('changedTouches' in e&&e.changedTouches.length){mx=e.changedTouches[0].clientX-rect.left;my=e.changedTouches[0].clientY-rect.top;}
        else if('clientX' in e){mx=e.clientX-rect.left;my=e.clientY-rect.top;}else return;
        const now=Date.now();
        if(now-lastTap<320){targetZRef.current=Math.max(MIN_Z,targetZRef.current-.7);}
        lastTap=now;
        mouse.x=(mx/W)*2-1;mouse.y=-(my/H)*2+1;
        ray.setFromCamera(mouse,cam);
        const hits=ray.intersectObjects([...overlayRef.current,...cityMeshRef.current].filter((o:any)=>o.userData?.isClick||o.userData?.city));
        if(hits.length){
          const d=hits[0].object.userData;
          if(d.country){
            const n=d.country,code=n.code.toUpperCase();
            const p3=hits[0].object.position.clone();
            globe.localToWorld(p3);p3.project(cam);
            setPopup({name:n.name,count:n.count,pubs:n.publishers||0,
              flag:FLAGS[code]||'🌐',level:d.level||getLevel(n.count),
              trending:d.isTrending||false,x:(p3.x*.5+.5)*W,y:(-.5*p3.y+.5)*H});
          }
        }else setPopup(null);
      }
      el.addEventListener('click',onTap);

      // ── Physics state ────────────────────────────────────────────
      const MIN_Z=1.2, MAX_Z=3.5;
      let velX=0, velY=0;
      let isDragging=false;
      let isTouchDragging=false;
      let isPinching=false;
      let prevX=0, prevY=0;
      let pinch0=0, pinchZ0=0;
      let touchMoved=false;
      let touchStartX=0, touchStartY=0;
      let suppressSpinUntil=0;

      function canInteract(){ return cinematicDone.current||camZRef.current<5.0; }
      function sensitivity(){ return 0.004*(camZRef.current/MAX_Z); }

      function onPointerDown(e:PointerEvent){
        if(!canInteract()||e.pointerType==='touch')return;
        isDragging=true;
        velX=velY=0;
        prevX=e.clientX; prevY=e.clientY;
        el.style.cursor='grabbing';
        suppressSpinUntil=Date.now()+99999;
      }
      wrap.addEventListener('pointerdown',onPointerDown);

      const onM=(e:PointerEvent)=>{
        if(!isDragging||e.pointerType==='touch')return;
        const dx=e.clientX-prevX;
        const dy=e.clientY-prevY;
        prevX=e.clientX; prevY=e.clientY;
        const s=sensitivity();
        velX=velX*.55+dx*s*.45;
        velY=velY*.55+dy*s*.45;
        globe.rotation.y+=dx*s;
        globe.rotation.x=Math.max(-.82,Math.min(.82,globe.rotation.x+dy*s*.7));
      };

      const onU=(e:PointerEvent)=>{
        if(e.pointerType==='touch')return;
        isDragging=false;
        el.style.cursor='grab';
        suppressSpinUntil=Date.now()+2500;
      };

      window.addEventListener('pointermove',onM);
      window.addEventListener('pointerup',onU);

      function onTouchStart(e:TouchEvent){
        if(!canInteract())return;
        touchMoved=false;
        if(e.touches.length===1){
          isTouchDragging=true; isPinching=false;
          velX=velY=0;
          prevX=e.touches[0].clientX; prevY=e.touches[0].clientY;
          touchStartX=prevX; touchStartY=prevY;
          suppressSpinUntil=Date.now()+99999;
        }else if(e.touches.length===2){
          isPinching=true; isTouchDragging=false;
          velX=velY=0;
          pinch0=Math.hypot(
            e.touches[0].clientX-e.touches[1].clientX,
            e.touches[0].clientY-e.touches[1].clientY);
          pinchZ0=camZRef.current;
          suppressSpinUntil=Date.now()+4000;
        }
      }
      wrap.addEventListener('touchstart',onTouchStart,{passive:true});

      function onTouchMove(e:TouchEvent){
        if(!canInteract())return;
        if(isTouchDragging&&e.touches.length===1){
          const dx=e.touches[0].clientX-prevX;
          const dy=e.touches[0].clientY-prevY;
          const totalDx=e.touches[0].clientX-touchStartX;
          const totalDy=e.touches[0].clientY-touchStartY;
          if(Math.abs(totalDx)>4||Math.abs(totalDy)>4)touchMoved=true;
          prevX=e.touches[0].clientX; prevY=e.touches[0].clientY;
          const s=sensitivity();
          velX=velX*.55+dx*s*.45;
          velY=velY*.55+dy*s*.45;
          globe.rotation.y+=dx*s;
          globe.rotation.x=Math.max(-.82,Math.min(.82,globe.rotation.x+dy*s*.7));
        }else if(isPinching&&e.touches.length===2){
          const d=Math.hypot(
            e.touches[0].clientX-e.touches[1].clientX,
            e.touches[0].clientY-e.touches[1].clientY);
          if(pinch0>0){
            const newZ=Math.max(MIN_Z,Math.min(MAX_Z,pinchZ0*(pinch0/d)));
            targetZRef.current=targetZRef.current*.7+newZ*.3;
          }
        }
      }
      wrap.addEventListener('touchmove',onTouchMove,{passive:true});

      function onTouchEnd(e:TouchEvent){
        if(e.touches.length===0){
          if(isTouchDragging&&!touchMoved)onTap(e as any);
          isTouchDragging=false; isPinching=false;
          suppressSpinUntil=Date.now()+2500;
        }else if(e.touches.length===1){
          isPinching=false; isTouchDragging=true;
          prevX=e.touches[0].clientX; prevY=e.touches[0].clientY;
          velX=velY=0; touchMoved=false;
        }
      }
      wrap.addEventListener('touchend',onTouchEnd,{passive:true});

      const onWheel=(e:WheelEvent)=>{
        e.preventDefault();
        if(!canInteract())return;
        let raw=e.deltaMode===1?e.deltaY*20:e.deltaMode===2?e.deltaY*200:e.deltaY;
        raw=Math.max(-80,Math.min(80,raw));
        const delta=raw*0.0018;
        targetZRef.current=Math.max(MIN_Z,Math.min(MAX_Z,targetZRef.current+delta));
        suppressSpinUntil=Date.now()+3000;
      };
      wrap.addEventListener('wheel',onWheel,{passive:false});

      const onR=()=>{const w=wrap.clientWidth,h=wrap.clientHeight;cam.aspect=w/h;cam.updateProjectionMatrix();renderer.setSize(w,h);};
      window.addEventListener('resize',onR);

      (globe as any).__flyTo=(code:string)=>{const co=CC[code.toUpperCase()];if(co)flyTo(co[0],co[1],1.85,2.0);};

      const t0=Date.now();
      function loop(){
        animRef.current=requestAnimationFrame(loop);
        fpsFrames.current++;
        const nowMs=Date.now();
        if(nowMs-fpsLast.current>=1000){
          const fps=fpsFrames.current;fpsFrames.current=0;fpsLast.current=nowMs;
          fpsHist.current=[...fpsHist.current.slice(-4),fps];
          const avg=fpsHist.current.reduce((a,b)=>a+b,0)/fpsHist.current.length;
          if(avg<22&&qualRef.current!=='low'){qualRef.current='low';renderer.setPixelRatio(1);}
          else if(avg<38&&qualRef.current==='high'){qualRef.current='mid';renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));}
        }

        const t2=(nowMs-t0)*0.001;

        if(!isDragging&&!isTouchDragging&&!isFlying.current){
          const friction=0.88;
          velX*=friction; velY*=friction;
          if(Math.abs(velX)>0.00008||Math.abs(velY)>0.00008){
            globe.rotation.y+=velX;
            globe.rotation.x=Math.max(-.82,Math.min(.82,globe.rotation.x+velY));
          }else{
            velX=0; velY=0;
          }
        }

        const spinning=!isDragging&&!isTouchDragging&&!isFlying.current&&nowMs>suppressSpinUntil&&Math.abs(velX)<0.0004;
        if(spinning)globe.rotation.y+=.0011;

        targetZRef.current=Math.max(MIN_Z,Math.min(MAX_Z,targetZRef.current));
        camZRef.current+=(targetZRef.current-camZRef.current)*.10;
        camZRef.current=Math.max(MIN_Z-.05,Math.min(MAX_Z+.05,camZRef.current));
        cam.position.z=camZRef.current;
        updateLOD();
        globe.children.forEach((o:any)=>{if(o.userData?.isCloud)o.rotation.y=t2*.015;});
        stars.rotation.y=t2*.00014;

        // Animate satellites (scene-level, independent of globe rotation)
        scene.children.forEach((o:any)=>{
          if(o.userData?.isSat){
            const ang=t2*o.userData.spd*60+o.userData.phase;
            const r=o.userData.orbitR, til=o.userData.tilt;
            const x=Math.cos(ang)*r, z=Math.sin(ang)*r;
            // apply tilt around X axis
            o.position.set(x, z*Math.sin(til), z*Math.cos(til));
            // gentle pulse
            const pulse=1+Math.sin(t2*3+o.userData.idx)*0.15;
            o.scale.setScalar(pulse);
            o.rotation.y+=0.03;
          }
          if(o.userData?.isSatHalo){
            o.position.copy(o.userData.follow.position);
            o.material.opacity=.22+Math.sin(t2*2.4+o.userData.follow.userData.idx)*0.08;
          }
          if(o.userData?.isAurora){
            o.material.uniforms.c.value.offsetHSL(0, 0, Math.sin(t2*0.8)*0.004);
            o.material.opacity=1;
            o.rotation.z=t2*0.06*(o.position.y>0?1:-1);
          }
          if(o.userData?.isDust){
            o.rotation.y=t2*0.02;
            o.rotation.x=Math.sin(t2*0.1)*0.05;
          }
        });
        if(Math.random()<.0008)spawnStar();
        if(sstar){
          const age=nowMs-sstar.userData.born;
          sstar.material.opacity=Math.max(0,.8*(1-age/sstar.userData.life));
          if(age>sstar.userData.life){scene.remove(sstar);sstar=null;}
        }

        const camWorld=cam.position.clone();
        const _wp=new T.Vector3();

        overlayRef.current=overlayRef.current.filter((o:any)=>{
          if(o.userData?.evtPulse){
            const age=nowMs-o.userData.born;
            if(age>2400){globe.remove(o);return false;}
            const s=1+age/2400*4; o.scale.setScalar(s);
            o.material.opacity=Math.max(0,.85*(1-age/2400));
            return true;
          }

          _wp.copy(o.position);
          globe.localToWorld(_wp);
          const dot=_wp.clone().normalize().dot(camWorld.clone().normalize());
          const vis=Math.max(0,Math.min(1,(dot-.02)/.13));

          if(o.userData?.pulse){
            const pMin=(o.userData.pulseMin??0.1)*vis;
            const pMax=(o.userData.pulseMax??0.45)*vis;
            const s=1+Math.sin(t2*2.0+o.userData.phase)*.45;
            o.scale.setScalar(s);
            const osc=(Math.sin(t2*2.0+o.userData.phase)+1)*.5;
            o.material.opacity=pMin+osc*(pMax-pMin);
            o.visible=vis>0.01;
            return true;
          }

          if(o.userData?.trendSpin){
            o.rotation.z=t2*1.1;
            o.material.opacity=.22*vis;
            o.visible=vis>0.01;
            return true;
          }

          if(o.userData?.isParticle){
            o.userData.t=(o.userData.t+o.userData.spd)%1;
            o.position.copy(o.userData.arc.getPoint(o.userData.t));
            _wp.copy(o.position);
            globe.localToWorld(_wp);
            const dotP=_wp.clone().normalize().dot(camWorld.clone().normalize());
            const visP=Math.max(0,Math.min(1,(dotP-.02)/.13));
            const edge=Math.min(o.userData.t,1-o.userData.t)*7;
            const edgeFade=Math.min(1,edge);
            const baseOp=o.userData.glowFor===null?.38:.95;
            o.material.opacity=baseOp*visP*edgeFade;
            o.visible=visP>0.01&&edgeFade>0.05;
            return true;
          }

          if(o.isLine&&o.userData?.arc===undefined&&!o.userData?.evtPulse){
            if(o.userData._baseOp===undefined)o.userData._baseOp=o.material?.opacity??0.16;
            o.material.opacity=o.userData._baseOp*vis;
            o.visible=vis>0.01;
            return true;
          }

          // ── FIX: only set _baseOp once, never clobber with back-face 0 ──
          if(!o.userData?.evtPulse){
            if(o.userData._baseOp===undefined){
              o.userData._baseOp=Math.max(0.01, o.material?.opacity??1);
            }
            const baseOp=o.userData._baseOp;
            if(o.material){
              o.material.opacity=baseOp*vis;
            }
            o.visible=vis>0.01;
          }
          return true;
        });

        cityMeshRef.current.forEach((o:any)=>{
          if(!o.visible)return;
          _wp.copy(o.position);
          globe.localToWorld(_wp);
          const dot=_wp.clone().normalize().dot(camWorld.clone().normalize());
          const vis=Math.max(0,Math.min(1,(dot-.02)/.13));
          if(o.userData._baseOp===undefined)o.userData._baseOp=o.material?.opacity??1;
          if(o.material)o.material.opacity=(o.userData._baseOp)*vis;
        });

        renderer.render(scene,cam);
      }
      loop();

      cleanup=()=>{
        obsRef.current=false;
        clearTimeout(welcomeTimeout);
        if(topoAbort) topoAbort.abort();
        clearInterval(piv); cancelAnimationFrame(animRef.current);
        window.removeEventListener('pointermove',onM);
        window.removeEventListener('pointerup',onU);
        window.removeEventListener('resize',onR);
        el.removeEventListener('click',onTap);
        wrap.removeEventListener('touchstart',onTouchStart as EventListener);
        wrap.removeEventListener('touchmove',onTouchMove as EventListener);
        wrap.removeEventListener('touchend',onTouchEnd as EventListener);
        wrap.removeEventListener('pointerdown',onPointerDown as EventListener);
        wrap.removeEventListener('wheel',onWheel as EventListener);
        [...overlayRef.current,...borderMeshRef.current,...cityMeshRef.current].forEach((o:any)=>{
          o.geometry?.dispose();o.material?.dispose?.();o.material?.map?.dispose?.();
        });
        renderer.dispose();if(wrap.contains(el))wrap.removeChild(el);
      };
    });
    return()=>{cleanup?.();};
  },[flyTo,buildNodes,buildCities,buildBorders]);

  // ── FIX: rebuild nodes/cities when activeCountries arrives after globe is ready ──
  useEffect(()=>{
    const T=TRef.current;
    const globe=globeRef.current;
    if(!T||!globe)return;
    if(activeCountries.length===prevActiveLenRef.current)return;
    prevActiveLenRef.current=activeCountries.length;
    buildNodes(T,globe);
    buildCities(T,globe);
  },[activeCountries,buildNodes,buildCities]);

  // Live events
  useEffect(()=>{
    if(!activeCountries.length)return;
    const iv=setInterval(()=>addEvent(),3200+Math.random()*3500);
    return()=>clearInterval(iv);
  },[activeCountries,addEvent]);

  // Observer mode
  useEffect(()=>{
    obsRef.current=obsMode;
    if(obsMode)startObs();
  },[obsMode,startObs]);

  const goToMe=useCallback(()=>{
    const g=globeRef.current;
    if(g&&userCountry&&(g as any).__flyTo)(g as any).__flyTo(userCountry);
  },[userCountry]);

  const LEVEL_BADGE:Record<UserLevel,{label:string;color:string}> ={
    newbie:{label:'Newbie',color:'rgba(68,136,170,.8)'},
    contributor:{label:'Contributor',color:'rgba(0,200,255,.8)'},
    active:{label:'Active',color:'rgba(0,245,196,.85)'},
    pro:{label:'Pro Dev',color:'rgba(251,191,36,.9)'},
    elite:{label:'Elite',color:'rgba(255,107,107,.9)'},
  };

  return (
    <div ref={wrapRef} className="relative w-full h-full bg-black overflow-hidden select-none">

      {/* Cinematic loading */}
      <div className="gg-lo absolute inset-0 flex flex-col items-center justify-center z-10 bg-black transition-opacity duration-500">
        <div className="relative w-28 h-28 mb-5">
          {/* Outer rotating halo */}
          <svg className="absolute inset-0 w-28 h-28 animate-[spin_8s_linear_infinite]" viewBox="0 0 112 112">
            <circle cx="56" cy="56" r="54" fill="none" stroke="rgba(0,245,196,.06)" strokeWidth="1"/>
            <circle cx="56" cy="56" r="54" fill="none" stroke="#00f5c4" strokeWidth="1" strokeDasharray="4 340" strokeLinecap="round"/>
          </svg>
          {/* Middle counter-rotating ring */}
          <svg className="absolute inset-0 w-28 h-28 animate-[spin_5s_linear_infinite_reverse]" viewBox="0 0 112 112">
            <circle cx="56" cy="56" r="42" fill="none" stroke="rgba(0,200,255,.08)" strokeWidth="1"/>
            <circle cx="56" cy="56" r="42" fill="none" stroke="#00c8ff" strokeWidth="1" strokeDasharray="2 260" strokeLinecap="round"/>
          </svg>
          {/* Inner progress ring */}
          <svg className="absolute inset-0 w-28 h-28 -rotate-90" viewBox="0 0 112 112">
            <circle cx="56" cy="56" r="30" fill="none" stroke="rgba(0,245,196,.08)" strokeWidth="1.5"/>
            <circle cx="56" cy="56" r="30" fill="none" stroke="#00f5c4" strokeWidth="1.8"
              strokeDasharray={`${loadPct*1.885} 188.5`} strokeLinecap="round"
              style={{transition:'stroke-dasharray .3s ease-out',filter:'drop-shadow(0 0 6px #00f5c4)'}}/>
          </svg>
          {/* Center readout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[18px] font-black text-[#00f5c4] font-mono leading-none" style={{textShadow:'0 0 12px rgba(0,245,196,.6)'}}>
              {loadPct}
              <span className="text-[9px] text-white/35 ms-0.5">%</span>
            </span>
            <span className="text-[6px] font-mono text-white/25 tracking-[2px] mt-1">INIT</span>
          </div>
          {/* Corner ticks */}
          {[0,90,180,270].map(a=>(
            <div key={a} className="absolute top-1/2 start-1/2 w-px h-2 bg-[#00f5c4]/30"
              style={{transform:`translate(-50%,-50%) rotate(${a}deg) translateY(-54px)`}}/>
          ))}
        </div>
        <p className="text-[10px] font-black text-white/45 font-mono tracking-[.4em]">LOADING EARTH</p>
        <div className="h-3 mt-2 flex items-center">
          <p className="text-[7px] text-white/25 font-mono tracking-[3px]">
            {loadPct<20?'BOOTING TELEMETRY':
             loadPct<45?'FETCHING SATELLITE IMAGERY':
             loadPct<75?'RENDERING ATMOSPHERIC MESH':
             loadPct<95?'SYNCING COUNTRY NODES':
             'LOCK ACQUIRED'}
          </p>
        </div>
      </div>

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none z-[3]"
        style={{background:'radial-gradient(ellipse 114% 114% at 50% 50%,transparent 26%,rgba(0,0,0,.92) 100%)'}}/>

      {/* Horizontal scanlines (CRT/hologram film) */}
      <div className="absolute inset-0 pointer-events-none z-[3] opacity-[.07] mix-blend-overlay"
        style={{background:'repeating-linear-gradient(180deg,transparent 0,transparent 2px,rgba(255,255,255,.12) 2px,rgba(255,255,255,.12) 3px)'}}/>

      {/* Gentle sweeping scan — slow, low opacity, non-intrusive */}
      <div className="hm-scan absolute inset-y-0 w-28 pointer-events-none z-[3]"
        style={{background:'linear-gradient(90deg,transparent 0%,rgba(0,245,196,.035) 48%,rgba(0,245,196,.085) 50%,rgba(0,245,196,.035) 52%,transparent 100%)'}}/>
      <style>{`@keyframes hmScan{0%,12%{transform:translateX(-140px);opacity:0}20%{opacity:1}80%{opacity:1}88%,100%{transform:translateX(110vw);opacity:0}}.hm-scan{animation:hmScan 42s linear infinite;will-change:transform,opacity}`}</style>

      {/* HUD corners — military bracket style */}
      {(['tl','tr','bl','br'] as const).map(p=>(
        <div key={p} className={`absolute w-7 h-7 z-[4] pointer-events-none
          ${p==='tl'?'top-2 start-2':''}
          ${p==='tr'?'top-2 end-2':''}
          ${p==='bl'?'bottom-2 start-2':''}
          ${p==='br'?'bottom-2 end-2':''}`}>
          <div className={`absolute w-full h-px bg-gradient-to-r from-[#00f5c4]/45 to-transparent
            ${p.startsWith('t')?'top-0':'bottom-0'} ${p.endsWith('r')?'right-0 rotate-180':'left-0'}`}/>
          <div className={`absolute w-px h-full bg-gradient-to-b from-[#00f5c4]/45 to-transparent
            ${p.startsWith('t')?'top-0':'bottom-0 rotate-180'} ${p.endsWith('r')?'right-0':'left-0'}`}/>
          <div className={`absolute w-1 h-1 rounded-full bg-[#00f5c4]/60
            ${p.startsWith('t')?'top-0':'bottom-0'} ${p.endsWith('r')?'right-0':'left-0'}`}
            style={{boxShadow:'0 0 4px rgba(0,245,196,.6)'}}/>
        </div>
      ))}

      {/* Single minimal system pill — right side only */}
      {ready&&(
        <div className="absolute bottom-7 end-3 z-[5] pointer-events-none">
          <div className="flex items-center gap-1.5 bg-[rgba(0,0,0,.5)] border border-white/8 rounded-full px-2 py-0.5 backdrop-blur-sm">
            <div className="relative w-1 h-1">
              <div className="absolute inset-0 rounded-full bg-[#00f5c4]"/>
              <div className="absolute inset-0 rounded-full bg-[#00f5c4] animate-ping opacity-60"/>
            </div>
            <span className="text-[6.5px] font-mono text-white/55 tracking-[1.5px] font-black">SYS NOMINAL</span>
          </div>
        </div>
      )}

      {/* Welcome cinematic */}
      {welcomeMsg&&(
        <div className="absolute inset-x-0 top-1/3 z-[8] flex justify-center pointer-events-none">
          <div className="bg-[rgba(0,0,0,.75)] border border-white/10 rounded-2xl px-6 py-3.5 text-center backdrop-blur-sm">
            <p className="text-[12px] font-black text-white font-mono tracking-[.12em]">{welcomeMsg}</p>
            {userCountry&&(
              <p className="text-[9px] text-[#00f5c4]/75 font-mono mt-1.5 tracking-[.1em]">
                {FLAGS[userCountry]||'🌐'} {CNAMES[userCountry]||userCountry}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Center crosshair — subtle targeting reticle */}
      {ready&&lod!=='far'&&(
        <div className="absolute inset-0 z-[3] pointer-events-none flex items-center justify-center">
          <div className="relative w-16 h-16 opacity-40">
            <div className="absolute top-1/2 left-0 w-3 h-px bg-[#00f5c4]"/>
            <div className="absolute top-1/2 right-0 w-3 h-px bg-[#00f5c4]"/>
            <div className="absolute left-1/2 top-0 w-px h-3 bg-[#00f5c4]"/>
            <div className="absolute left-1/2 bottom-0 w-px h-3 bg-[#00f5c4]"/>
            <div className="absolute inset-1/2 w-1 h-1 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#00f5c4]"/>
          </div>
        </div>
      )}

      {/* Top HUD — unified status + data-layer picker */}
      {ready&&(
        <div className="absolute top-3 inset-x-0 z-[5] flex flex-col items-center gap-1.5 pointer-events-none">
          {/* Row 1: status (LIVE / ALT / NODES) */}
          <div className="flex items-stretch bg-[rgba(0,0,0,.58)] border border-white/10 rounded-full overflow-hidden backdrop-blur-sm"
            style={{boxShadow:'0 0 20px rgba(0,0,0,.55),inset 0 0 10px rgba(0,245,196,.035)'}}>
            <div className="flex items-center gap-1.5 px-2.5 py-1 border-e border-white/8">
              <div className="relative w-1.5 h-1.5">
                <div className="absolute inset-0 rounded-full bg-[#00f5c4]"/>
                <div className="absolute inset-0 rounded-full bg-[#00f5c4] animate-ping opacity-70"/>
              </div>
              <span className="text-[7px] font-mono text-[#00f5c4]/80 tracking-[1.5px] font-black">LIVE</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 border-e border-white/8">
              <span className="text-[6px] font-mono text-white/30 tracking-[1.5px]">ALT</span>
              <span className="text-[7px] font-mono text-white/65 tracking-[1.2px] font-black">
                {lod==='far'?'ORBIT':lod==='mid'?'MID':'SURFACE'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1">
              <span className="text-[6px] font-mono text-white/30 tracking-[1.5px]">N</span>
              <span className="text-[7.5px] font-mono text-[#00c8ff]/90 tracking-[.8px] font-black tabular-nums">
                {String(activeCountries.length).padStart(3,'0')}
              </span>
            </div>
          </div>
          {/* Row 2: data-layer picker (pointer-events enabled) */}
          <div className="flex items-stretch bg-[rgba(0,0,0,.58)] border border-white/10 rounded-full overflow-hidden backdrop-blur-sm pointer-events-auto"
            style={{boxShadow:'0 0 14px rgba(0,0,0,.5)'}}>
            {([
              {k:'users',lbl:'USERS'},
              {k:'signals',lbl:'SIGNALS'},
              {k:'devices',lbl:'DEVICES'},
            ] as const).map((it,i,a)=>{
              const active=dataLayer===it.k;
              return (
                <button
                  key={it.k}
                  type="button"
                  onClick={()=>setDataLayer(it.k)}
                  className={`relative px-3 py-1 text-[7px] font-mono tracking-[1.8px] font-black transition-colors duration-200 ${i<a.length-1?'border-e border-white/8':''} ${active?'text-[#00f5c4]':'text-white/35 hover:text-white/70'}`}
                  aria-pressed={active}
                  aria-label={`Data layer: ${it.lbl}`}
                >
                  {active&&<span aria-hidden className="absolute inset-0 bg-[#00f5c4]/[.06] pointer-events-none"/>}
                  {active&&<span aria-hidden className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-px bg-[#00f5c4]/70" style={{boxShadow:'0 0 4px #00f5c4'}}/>}
                  <span className="relative">{it.lbl}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Controls — bottom */}
      {ready&&(
        <div className="absolute bottom-10 inset-x-0 z-[6] flex justify-between px-3">
          <button onClick={goToMe}
            className="flex items-center gap-1.5 text-[7.5px] font-mono font-black tracking-[1.5px] px-2.5 py-1.5 rounded-xl transition-all hover:scale-105 active:scale-95"
            style={{background:'rgba(0,0,0,.6)',border:'1px solid rgba(255,255,255,.1)',color:'rgba(255,255,255,.45)'}}>
            {userCountry?FLAGS[userCountry]||'📍':'📍'}
            <span>MY LOCATION</span>
          </button>
          <button onClick={()=>setObsMode(o=>!o)}
            className="text-[7.5px] font-mono font-black tracking-[1.2px] px-2.5 py-1.5 rounded-xl transition-all hover:scale-105 active:scale-95"
            style={{
              background:obsMode?'rgba(0,200,255,.1)':'rgba(0,0,0,.6)',
              border:`1px solid ${obsMode?'rgba(0,200,255,.3)':'rgba(255,255,255,.1)'}`,
              color:obsMode?'#00c8ff':'rgba(255,255,255,.4)',
            }}>
            {obsMode?'◉ WATCHING':'WATCH NETWORK'}
          </button>
        </div>
      )}

      {/* Live events feed */}
      {events.length>0&&(
        <div className="absolute bottom-8 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-[7] pointer-events-none flex flex-col gap-1 items-center w-full px-4">
          {events.map((e,i)=>(
            <div key={e.id}
              className="flex items-center gap-1.5 rounded-full px-3 py-1"
              style={{
                background:'rgba(0,0,0,.7)',border:'1px solid rgba(0,245,196,.15)',
                fontSize:'8px',fontFamily:'monospace',fontWeight:700,letterSpacing:'1px',
                color:'rgba(255,255,255,.5)',opacity:i===0?1:i===1?.55:.3,
                transform:`scale(${1-i*.06})`,transition:'all .3s',
              }}>
              <span>{e.flag}</span><span>{e.msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* Gesture hints — compact glyphs */}
      <div className="absolute bottom-1.5 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-[4] pointer-events-none
        flex items-center gap-2.5 text-white/20">
        <span className="flex items-center gap-1 text-[6.5px] font-mono tracking-[.2em]">
          <span className="text-white/35">◈</span> DRAG
        </span>
        <span className="w-px h-2 bg-white/10"/>
        <span className="flex items-center gap-1 text-[6.5px] font-mono tracking-[.2em]">
          <span className="text-white/35">◎</span> PINCH
        </span>
        <span className="w-px h-2 bg-white/10"/>
        <span className="flex items-center gap-1 text-[6.5px] font-mono tracking-[.2em]">
          <span className="text-white/35">◉</span> TAP
        </span>
      </div>

      {/* Country popup */}
      {popup&&(
        <div className="absolute z-[20] pointer-events-auto"
          style={{
            left:Math.min(Math.max(popup.x-92,4),(wrapRef.current?.clientWidth||300)-188),
            top:Math.max(popup.y-140,4),
          }}>
          <div className="bg-[rgba(0,0,0,.97)] border border-white/10 rounded-2xl overflow-hidden w-48
            shadow-[0_12px_48px_rgba(0,0,0,.95)]">
            <div className="h-px w-full" style={{background:`linear-gradient(90deg,transparent,${LEVEL_BADGE[popup.level].color},transparent)`}}/>
            <div className="px-4 pt-3 pb-3.5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none">{popup.flag}</span>
                  <p className="text-[11px] font-black text-white font-mono tracking-wide truncate">{popup.name.toUpperCase()}</p>
                </div>
                <button onClick={closePopup} className="text-white/20 hover:text-white text-sm ml-1 shrink-0 transition-colors">✕</button>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[7px] font-mono font-black px-2 py-0.5 rounded-full"
                  style={{background:`${LEVEL_BADGE[popup.level].color}22`,color:LEVEL_BADGE[popup.level].color,border:`1px solid ${LEVEL_BADGE[popup.level].color}44`}}>
                  {LEVEL_BADGE[popup.level].label}
                </span>
                {popup.trending&&(
                  <span className="text-[7px] font-mono font-black text-[#fbbf24] flex items-center gap-0.5">
                    ↑ TRENDING
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2.5">
                <div className="rounded-xl p-2.5 bg-[rgba(0,245,196,.06)] border border-[rgba(0,245,196,.12)]">
                  <p className="text-[6px] font-mono text-[rgba(0,245,196,.5)] tracking-widest mb-1">USERS</p>
                  <p className="text-[24px] font-black text-[#00f5c4] font-mono leading-none">{popup.count}</p>
                </div>
                <div className="rounded-xl p-2.5 bg-[rgba(167,139,250,.06)] border border-[rgba(167,139,250,.12)]">
                  <p className="text-[6px] font-mono text-[rgba(167,139,250,.5)] tracking-widest mb-1">DEVS</p>
                  <p className="text-[24px] font-black text-[#a78bfa] font-mono leading-none">{popup.pubs}</p>
                </div>
              </div>
              <div className="h-0.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{
                    width:`${Math.min((popup.count/Math.max(...activeRef.current.map(c=>c.count),1))*100,100)}%`,
                    background:`linear-gradient(90deg,#00c8ff,${LEVEL_BADGE[popup.level].color})`,
                  }}/>
              </div>
            </div>
          </div>
          <div className="flex justify-center -mt-px">
            <div className="w-2.5 h-2.5 bg-[rgba(0,0,0,.97)] border-r border-b border-white/10 rotate-45"/>
          </div>
        </div>
      )}
    </div>
  );
}
