/**
 * cube.js — chrome wireframe cube, 2D canvas projection
 *
 * Modes:
 *  splash     — small cube, idle float + mouse parallax
 *  burst      — spin + scale up on click
 *  site       — spring rotation per section
 *  transition — spring settling
 *  zoom       — scroll-driven zoom through cube interior (work section)
 */
(function () {

const canvas = document.getElementById('main-canvas');
const ctx    = canvas.getContext('2d');
let W, H;
function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
resize();
window.addEventListener('resize', resize);

/* ── Projection ── */
const CAM_Z = 6.5;

/* Apply screen-space warp displacement toward the cursor */
function warpPoint(px, py) {
  const dx = px - warpSmoothX;
  const dy = py - warpSmoothY;
  const distSq = dx * dx + dy * dy;
  const RADIUS = Math.min(W, H) * 0.38;       // warp field radius
  const BASE_PULL = 55;                         // max pixel pull at centre
  if (distSq > RADIUS * RADIUS) return { x: px, y: py };
  const d = Math.sqrt(distSq);
  const falloff = Math.pow(1 - d / RADIUS, 2.2); // smooth falloff
  const pull = BASE_PULL * falloff * warpStrength;
  const nx = dx / (d || 1);
  const ny = dy / (d || 1);
  return {
    x: px - nx * pull,
    y: py - ny * pull,
  };
}

function project(x, y, z, sc, cx, cy) {
  const fov = CAM_Z / (CAM_Z + z * sc);
  const px  = Math.min(W, H) * 0.12;
  const rawX = cx + x*sc*fov*px;
  const rawY = cy - y*sc*fov*px;
  const warped = warpPoint(rawX, rawY);
  return { x: warped.x, y: warped.y, w: fov };
}
function rotPt(x,y,z,rx,ry,rz) {
  let tx=x*Math.cos(ry)-z*Math.sin(ry), tz=x*Math.sin(ry)+z*Math.cos(ry); x=tx;z=tz;
  let ty=y*Math.cos(rx)-z*Math.sin(rx); tz=y*Math.sin(rx)+z*Math.cos(rx); y=ty;z=tz;
  tx=x*Math.cos(rz)-y*Math.sin(rz); ty=x*Math.sin(rz)+y*Math.cos(rz); return [tx,ty,tz];
}

/* ── Chrome colour ── */
function chromeCol(v) {
  const g = Math.pow(v, 0.7);
  if (g < 0.25) {
    const t = g / 0.25;
    return `rgb(${Math.round(8+t*20)},${Math.round(12+t*28)},${Math.round(18+t*38)})`;
  } else if (g < 0.65) {
    const t = (g-0.25)/0.40;
    return `rgb(${Math.round(28+t*80)},${Math.round(40+t*100)},${Math.round(56+t*110)})`;
  } else {
    const t = (g-0.65)/0.35;
    return `rgb(${Math.round(100+t*140)},${Math.round(150+t*105)},${Math.round(145+t*90)})`;
  }
}

const DIM_COL = '#0d1820';

function dLine(ax,ay,az,bx,by,bz,rx,ry,rz,sc,col,alpha,lw,cx,cy) {
  const [x1,y1,z1]=rotPt(ax,ay,az,rx,ry,rz),[x2,y2,z2]=rotPt(bx,by,bz,rx,ry,rz);
  const p1=project(x1,y1,z1,sc,cx,cy),p2=project(x2,y2,z2,sc,cx,cy);
  const depthFade = Math.max(0.3, (p1.w + p2.w) / 2);
  ctx.globalAlpha = alpha * depthFade;
  ctx.strokeStyle = col;
  ctx.lineWidth   = lw;
  ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke();
}
function dDot(ax,ay,az,rx,ry,rz,sc,col,alpha,r,cx,cy) {
  const [x,y,z]=rotPt(ax,ay,az,rx,ry,rz),p=project(x,y,z,sc,cx,cy);
  const radius = r * p.w;
  if (radius <= 0) return;
  ctx.globalAlpha=alpha*p.w; ctx.fillStyle=col;
  ctx.beginPath(); ctx.arc(p.x,p.y,radius,0,Math.PI*2); ctx.fill();
}

/* ── Geometry ── */
const CELL=1.0,GAP=0.065,U=CELL+GAP,FSUB=6;
const LAYOUT=[
  [[0.50,null,0.32],[null,0.14,null],[0.58,null,0.20]],
  [[0.10,0.06,0.10],[0.06,0.00,0.06],[0.10,0.06,0.10]],
  [[0.30,null,0.50],[null,0.18,null],[0.26,null,0.60]],
];
const EDGES=[],GRIDS=[],DOTS=[],DEBRIS=[];

function addCell(xi,yi,zi,ext) {
  const bx=(xi-1)*U,by=(yi-1)*U,bz=(zi-1)*U;
  const dx=xi-1,dy=yi-1,dz=zi-1,dl=Math.sqrt(dx*dx+dy*dy+dz*dz)||1;
  const push=ext*U*1.6;
  const ccx=bx+(dx/dl)*push,ccy=by+(dy/dl)*push,ccz=bz+(dz/dl)*push;
  const sc=1-ext*0.06,hw=(CELL*sc)/2;
  const v=[
    [ccx-hw,ccy-hw,ccz-hw],[ccx+hw,ccy-hw,ccz-hw],[ccx+hw,ccy+hw,ccz-hw],[ccx-hw,ccy+hw,ccz-hw],
    [ccx-hw,ccy-hw,ccz+hw],[ccx+hw,ccy-hw,ccz+hw],[ccx+hw,ccy+hw,ccz+hw],[ccx-hw,ccy+hw,ccz+hw],
  ];
  [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]].forEach(([a,b])=>{
    EDGES.push({
      ax:v[a][0],ay:v[a][1],az:v[a][2],
      bx:v[b][0],by:v[b][1],bz:v[b][2],
      phase:Math.random()*Math.PI*2,
      speed:0.08+Math.random()*0.10,
      baseV: 0.05 + Math.random()*0.15,
      drawDelay: Math.random() * 2.2,
      drawDur:   0.4 + Math.random() * 0.5
    });
  });
  v.forEach(p=>DOTS.push({x:p[0],y:p[1],z:p[2],phase:Math.random()*Math.PI*2}));
  const fs=(CELL*sc)/FSUB;
  [-hw,hw].forEach(fz=>{for(let i=1;i<FSUB;i++){const t=-hw+i*fs;
    GRIDS.push({ax:ccx+t,ay:ccy-hw,az:ccz+fz,bx:ccx+t,by:ccy+hw,bz:ccz+fz,op:.18});
    GRIDS.push({ax:ccx-hw,ay:ccy+t,az:ccz+fz,bx:ccx+hw,by:ccy+t,bz:ccz+fz,op:.18});
  }});
  [-hw,hw].forEach(fx=>{for(let i=1;i<FSUB;i++){const t=-hw+i*fs;
    GRIDS.push({ax:ccx+fx,ay:ccy+t,az:ccz-hw,bx:ccx+fx,by:ccy+t,bz:ccz+hw,op:.12});
    GRIDS.push({ax:ccx+fx,ay:ccy-hw,az:ccz+t,bx:ccx+fx,by:ccy+hw,bz:ccz+t,op:.12});
  }});
  [-hw,hw].forEach(fy=>{for(let i=1;i<FSUB;i++){const t=-hw+i*fs;
    GRIDS.push({ax:ccx+t,ay:ccy+fy,az:ccz-hw,bx:ccx+t,by:ccy+fy,bz:ccz+hw,op:.12});
    GRIDS.push({ax:ccx-hw,ay:ccy+fy,az:ccz+t,bx:ccx+hw,by:ccy+fy,bz:ccz+t,op:.12});
  }});
}
for(let xi=0;xi<3;xi++) for(let yi=0;yi<3;yi++) for(let zi=0;zi<3;zi++){
  const v=LAYOUT[xi][yi][zi]; if(v!==null) addCell(xi,yi,zi,v);
}
[{x:2.5,y:2.0,z:-0.8,s:.15},{x:-2.7,y:1.3,z:.6,s:.11},
 {x:1.8,y:-2.3,z:1.2,s:.19},{x:-1.4,y:-1.8,z:-1.6,s:.13},
 {x:3.0,y:-0.6,z:1.5,s:.09},{x:-2.1,y:2.6,z:1.4,s:.16},
 {x:.9,y:3.0,z:2.1,s:.10},{x:-1.8,y:-1.4,z:2.4,s:.12}
].forEach(d=>{
  const hw=d.s/2,vv=[
    [d.x-hw,d.y-hw,d.z-hw],[d.x+hw,d.y-hw,d.z-hw],[d.x+hw,d.y+hw,d.z-hw],[d.x-hw,d.y+hw,d.z-hw],
    [d.x-hw,d.y-hw,d.z+hw],[d.x+hw,d.y-hw,d.z+hw],[d.x+hw,d.y+hw,d.z+hw],[d.x-hw,d.y+hw,d.z+hw]];
  [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]].forEach(([a,b])=>{
    DEBRIS.push({ax:vv[a][0],ay:vv[a][1],az:vv[a][2],bx:vv[b][0],by:vv[b][1],bz:vv[b][2],phase:Math.random()*Math.PI*2,speed:.07});
  });
});

/* ── Face targets ── */
const BASE_RX = 0.52;
const BASE_RY = 0.72;

const FACE_DATA = {
  splash: { rx: 0.35, ry: 0.48,                        rz:  0.22 },
  intro:  { rx: BASE_RX, ry: BASE_RY,                  rz: -0.48 },
  about:  { rx: BASE_RX, ry: BASE_RY + Math.PI * 0.5,  rz: +0.48 },
  /* work: cube faces front — we zoom through the O-R gap
     rx/ry tuned so a gap in the geometry aligns with the camera axis */
  work:   { rx: 0.0,    ry: Math.PI * 0.0,             rz:  0.0  },
};

/* ── Spring physics ── */
const SPRING_K    = 8.0;
const SPRING_DAMP = 6.5;

let velRX = 0, velRY = 0, velRZ = 0;
let curRX = FACE_DATA.splash.rx;
let curRY = FACE_DATA.splash.ry;
let curRZ = FACE_DATA.splash.rz;
let toRX  = curRX, toRY = curRY, toRZ = curRZ;

let curScale = 0.62;
let toScale  = 0.62;
let velScale = 0;

let mode = 'splash';
let burstStart = 0, burstDone = false, burstCb = null;
const BURST_MS = 2000;

let idleT = 0;

/* ── Zoom state — driven by scroll in main.js ── */
let zoomProgress = 0;   // 0 = normal work view, 1 = fully zoomed in
let zoomScaleBase = 32; // scale when zoom=0 (normal site scale)
let cardZoom  = 0;      // pushes scale slightly deeper per card
let cardRotY  = 0;      // Y rotation offset per card stop
let cardRotX  = 0;      // X rotation offset per card stop
let cardRotZ  = 0;      // Z rotation offset per card stop

/* ── Mouse parallax ── */
let mouseX = 0.5, mouseY = 0.5;
let smoothMouseX = 0.5, smoothMouseY = 0.5;
let splashHovered = false;

/* ── Warp cursor — screen-space pixel coords, smoothed ── */
let warpMouseX = 0, warpMouseY = 0;
let warpSmoothX = 0, warpSmoothY = 0;
let warpStrength = 0; // based on mouse speed

document.addEventListener('mousemove', e => {
  mouseX = e.clientX / window.innerWidth;
  mouseY = e.clientY / window.innerHeight;
  warpMouseX = e.clientX;
  warpMouseY = e.clientY;
});

const splashEl = document.getElementById('splash');
if (splashEl) {
  splashEl.addEventListener('mouseenter', () => { splashHovered = true; });
  splashEl.addEventListener('mouseleave', () => { splashHovered = false; });
}

let hoverBright = 0, hoverBrightVel = 0;

function lerp(a,b,t){ return a+(b-a)*t; }
function easeInOut(t){ return t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }
/* Easing: slow start, then exponential warp — like space travel kicking in */
function easeZoom(t) {
  // Barely moving for first 20% — anticipation
  // Then ROCKETS past the point of no return
  if (t < 0.20) return t * t * 0.35;
  const mid = (t - 0.20) / 0.80;
  return 0.014 + Math.pow(mid, 2.2) * 0.986;
}

function springStep(cur, target, vel, k, damp, dt) {
  const force = (target - cur) * k - vel * damp;
  vel += force * dt;
  cur += vel * dt;
  return [cur, vel];
}

let canvasVisible = true;
const canvasObserver = new IntersectionObserver(entries => {
  canvasVisible = entries[0].isIntersecting;
}, { threshold: 0 });
canvasObserver.observe(canvas);

/* ── Render loop ── */
let lastTS = 0;
const startTime = performance.now();

function frame(ts) {
  requestAnimationFrame(frame);
  if (!canvasVisible && mode !== 'burst') return; // pause when off-screen
  const dt  = Math.min((ts-lastTS)/1000, .05); lastTS=ts;
  const t   = ts * .001;
  const age = (ts - startTime) / 1000;

  ctx.fillStyle='#06080c'; ctx.fillRect(0,0,W,H);

  // During zoom: draw a radial dark vignette that intensifies at high speed
  // This creates the "tunnel rush" sensation
  if (mode === 'zoom' && zoomProgress > 0.08) {
    const ez = easeZoom(zoomProgress);
    const vigStrength = Math.min(0.88, ez * 1.1);
    const grd = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H) * 0.55);
    grd.addColorStop(0, 'rgba(6,8,12,0)');
    grd.addColorStop(0.5, `rgba(6,8,12,${vigStrength * 0.15})`);
    grd.addColorStop(1, `rgba(6,8,12,${vigStrength * 0.9})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.globalAlpha=1;

  let rx, ry, rz, sc;
  const cx = W * 0.5, cy = H * 0.5;

  /* Mouse smooth */
  const mouseSmooth = (mode === 'splash') ? 0.04 : 0.0;
  smoothMouseX += (mouseX - smoothMouseX) * mouseSmooth * 60 * dt;
  smoothMouseY += (mouseY - smoothMouseY) * mouseSmooth * 60 * dt;

  /* ── Warp smooth — lerp cursor toward mouse, compute speed ── */
  const prevWarpX = warpSmoothX, prevWarpY = warpSmoothY;
  warpSmoothX += (warpMouseX - warpSmoothX) * Math.min(1, 0.12 * 60 * dt);
  warpSmoothY += (warpMouseY - warpSmoothY) * Math.min(1, 0.12 * 60 * dt);
  const warpSpeedRaw = Math.sqrt((warpSmoothX - prevWarpX) ** 2 + (warpSmoothY - prevWarpY) ** 2);
  // Strength: ramps up with speed, decays when still
  warpStrength += (Math.min(warpSpeedRaw * 0.04, 1.0) - warpStrength) * Math.min(1, 8 * dt);
  warpStrength = Math.max(0, warpStrength);

  /* Hover brightness */
  const hoverTarget = splashHovered ? 1.0 : 0.0;
  [hoverBright, hoverBrightVel] = springStep(hoverBright, hoverTarget, hoverBrightVel, 5.0, 4.5, dt);

  /* ════════════════════════════════
     MODE: BURST
  ════════════════════════════════ */
  if (mode==='burst') {
    const raw = Math.min((performance.now()-burstStart)/BURST_MS, 1);
    const e   = easeInOut(raw);
    rx = lerp(FACE_DATA.splash.rx, FACE_DATA.intro.rx + Math.PI*6,  e);
    ry = lerp(FACE_DATA.splash.ry, FACE_DATA.intro.ry + Math.PI*10, e);
    rz = lerp(FACE_DATA.splash.rz, FACE_DATA.intro.rz, e);
    sc = lerp(0.62, 32, e);
    curScale = sc; toScale = 32; zoomScaleBase = 32;
    if (raw>=1 && !burstDone) {
      burstDone = true;
      curRX=FACE_DATA.intro.rx; curRY=FACE_DATA.intro.ry; curRZ=FACE_DATA.intro.rz;
      toRX=curRX; toRY=curRY; toRZ=curRZ;
      velRX=0; velRY=0; velRZ=0;
      if (burstCb) burstCb();
    }

  /* ════════════════════════════════
     MODE: ZOOM (scroll through work)
     Scale rockets from 32 → 320.
     Rotation springs toward work face (frontal view).
     At zoomProgress=1 we're "inside" — just a sea of wireframe.
  ════════════════════════════════ */
  } else if (mode === 'zoom') {
    const ez = easeZoom(zoomProgress);

    // Base rotation toward frontal face
    [curRX, velRX] = springStep(curRX, FACE_DATA.work.rx + cardRotX, velRX, SPRING_K, SPRING_DAMP, dt);
    [curRY, velRY] = springStep(curRY, FACE_DATA.work.ry + cardRotY, velRY, SPRING_K, SPRING_DAMP, dt);
    [curRZ, velRZ] = springStep(curRZ, FACE_DATA.work.rz + cardRotZ, velRZ, SPRING_K, SPRING_DAMP, dt);
    rx = curRX; ry = curRY; rz = curRZ;

    // Scale: 32 → 580 from zoomProgress, then a very gentle additional push per card
    const baseScale = lerp(32, 580, ez);
    sc = baseScale + cardZoom * 280;
    curScale = sc;

  /* ════════════════════════════════
     MODE: SITE / TRANSITION
  ════════════════════════════════ */
  } else if (mode==='site' || mode==='transition') {
    [curRX, velRX] = springStep(curRX, toRX, velRX, SPRING_K, SPRING_DAMP, dt);
    [curRY, velRY] = springStep(curRY, toRY, velRY, SPRING_K, SPRING_DAMP, dt);
    [curRZ, velRZ] = springStep(curRZ, toRZ, velRZ, SPRING_K, SPRING_DAMP, dt);
    [curScale, velScale] = springStep(curScale, toScale, velScale, SPRING_K, SPRING_DAMP, dt);
    rx=curRX; ry=curRY; rz=curRZ; sc=curScale;

    const settled =
      Math.abs(toRX-curRX)<0.0008 && Math.abs(velRX)<0.0008 &&
      Math.abs(toRY-curRY)<0.0008 && Math.abs(velRY)<0.0008 &&
      Math.abs(toRZ-curRZ)<0.0008 && Math.abs(velRZ)<0.0008;
    if (mode==='transition' && settled) mode='site';

  /* ════════════════════════════════
     MODE: SPLASH
  ════════════════════════════════ */
  } else {
    idleT += dt * 0.16;
    const baseRX = FACE_DATA.splash.rx + Math.sin(t*.28)*.055 + Math.sin(t*.11)*.02;
    const baseRY = FACE_DATA.splash.ry + Math.sin(idleT)*.08  + Math.sin(t*.19)*.025;
    const baseRZ = FACE_DATA.splash.rz + Math.sin(t*.17)*.015;
    const parX = (smoothMouseY - 0.5) * -0.12;
    const parY = (smoothMouseX - 0.5) *  0.14;
    rx = baseRX + parX;
    ry = baseRY + parY;
    rz = baseRZ;
    sc = curScale;
  }

  /* ── DRAW ── */

  // In zoom mode, edges get brighter as we push inside — the interior glows
  const zoomBright = (mode === 'zoom') ? zoomProgress * 0.6 : 0;

  // 1. Grid lines
  GRIDS.forEach(g => dLine(
    g.ax,g.ay,g.az, g.bx,g.by,g.bz,
    rx,ry,rz, sc, DIM_COL, g.op * (1 + zoomProgress * 2), 0.5, cx,cy
  ));

  // 2. Debris
  DEBRIS.forEach(d => {
    const pulse = Math.max(0, Math.sin(t*d.speed+d.phase));
    const v = pulse * pulse * (0.45 + zoomBright);
    if (v < 0.02) return;
    dLine(d.ax,d.ay,d.az, d.bx,d.by,d.bz, rx,ry,rz, sc, chromeCol(v), v*0.4, 0.6, cx,cy);
  });

  // 3. Main edges
  EDGES.forEach(e => {
    const drawProgress = mode === 'splash'
      ? Math.max(0, Math.min(1, (age - e.drawDelay) / e.drawDur))
      : 1.0;
    if (drawProgress <= 0) return;

    const wave   = Math.sin(t * e.speed + e.phase);
    const shaped = Math.max(0, (wave - 0.4) / 0.6);
    const boostedBase = e.baseV + (hoverBright + zoomBright) * (0.7 - e.baseV) * 0.8;
    const v = Math.min(1, boostedBase + shaped * shaped * (1 - boostedBase));

    const lw    = (0.5 + v * 2.2) * (0.6 + drawProgress * 0.4);
    const alpha = (0.35 + v * 0.65) * drawProgress;

    dLine(e.ax,e.ay,e.az, e.bx,e.by,e.bz, rx,ry,rz, sc, chromeCol(v), alpha, lw, cx,cy);
  });

  // 4. Vertex dots
  DOTS.forEach(d => {
    const v = Math.max(0, Math.sin(t*.14+d.phase)*.5 + .35 + hoverBright * 0.25 + zoomBright * 0.4);
    const dp = mode === 'splash'
      ? Math.max(0, Math.min(1, (age - 1.5) / 1.2))
      : 1.0;
    dDot(d.x,d.y,d.z, rx,ry,rz, sc, chromeCol(Math.min(v,1)), (0.5+v*.45)*dp, 2.5*dp, cx,cy);
  });

  // 5. Warp speed-lines — radial streaks that appear during fast zoom
  if (mode === 'zoom' && zoomProgress > 0.25) {
    const ez    = easeZoom(zoomProgress);
    const speed = Math.max(0, (ez - 0.18) / 0.82); // 0 at start, 1 at full zoom
    const count = 28;
    ctx.save();
    for (let i = 0; i < count; i++) {
      const ang   = (i / count) * Math.PI * 2 + t * 0.08;
      const near  = 0.08 + speed * 0.1;
      const far   = near + speed * 0.55;
      const r1    = Math.min(W, H) * near;
      const r2    = Math.min(W, H) * far;
      const bright = 0.08 + speed * 0.55;
      ctx.globalAlpha = bright * (0.4 + 0.6 * ((i % 3) / 2));
      ctx.strokeStyle = i % 4 === 0 ? `rgba(126,207,200,${bright})` : `rgba(200,220,255,${bright * 0.6})`;
      ctx.lineWidth   = 0.5 + speed * (i % 3 === 0 ? 1.5 : 0.7);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
      ctx.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.globalAlpha=1;
}
requestAnimationFrame(frame);

/* ── Public API ── */
window.CubeAPI = {
  triggerBurst(onEnd) {
    mode='burst'; burstStart=performance.now(); burstDone=false; burstCb=onEnd;
  },
  enterSiteMode() {
    mode='site'; curScale=32; toScale=32; zoomScaleBase=32;
    curRX=FACE_DATA.intro.rx; curRY=FACE_DATA.intro.ry; curRZ=FACE_DATA.intro.rz;
    toRX=curRX; toRY=curRY; toRZ=curRZ;
    velRX=0; velRY=0; velRZ=0; velScale=0;
  },
  setCubeSection(id) {
    if (mode==='burst' || mode==='zoom') return;
    const face = FACE_DATA[id] || FACE_DATA.intro;
    if (Math.abs(toRY-face.ry)<0.01 && Math.abs(toRZ-face.rz)<0.01) return;
    toRX=face.rx; toRY=face.ry; toRZ=face.rz;
    toScale=32; zoomProgress=0;
    mode='transition';
  },
  /* Called each scroll frame with p = 0→1 as user scrolls into work section */
  setZoomProgress(p) {
    if (mode==='burst') return;
    zoomProgress = Math.max(0, Math.min(1, p));
    if (zoomProgress > 0.01) {
      mode = 'zoom';
    } else if (mode === 'zoom') {
      mode = 'site';
      toScale = 32;
    }
  },

  /* Called per scroll frame during work cards.
     angleDeg: 0→360 across 5 cards.
  */
  setWorkAngle(angleDeg) {
    // Always store the latest angle; apply immediately if in zoom mode
    // (previously would silently drop if mode hadn't switched yet)
    const DEG = Math.PI / 180;
    const stops = [
      { ry:   0 * DEG, rx:  0 * DEG, rz:  0 * DEG },
      { ry:  36 * DEG, rx:  12 * DEG, rz:  4 * DEG },
      { ry:  0  * DEG, rx: -8 * DEG, rz: -2 * DEG },
      { ry: -36 * DEG, rx:  10 * DEG, rz: -4 * DEG },
      { ry:   0 * DEG, rx:  0 * DEG, rz:  0 * DEG },
    ];

    const safeAngle = Number.isFinite(angleDeg) ? angleDeg : 0;
    const maxT = stops.length - 1;
    const rawT = safeAngle / (360 / (stops.length - 1));
    const clampedT = Math.max(0, Math.min(maxT, rawT));
    const i    = Math.min(Math.floor(clampedT), stops.length - 2);
    const t    = clampedT - i;
    const e    = t * t * (3 - 2 * t);

    const a = stops[i];
    const b = stops[i + 1];

    cardRotY = a.ry + (b.ry - a.ry) * e;
    cardRotX = a.rx + (b.rx - a.rx) * e;
    cardRotZ = a.rz + (b.rz - a.rz) * e;
    cardZoom = Math.sin((clampedT / maxT) * Math.PI) * 0.15;
    // No mode guard — values are always updated; zoom mode reads them
  }
};

})();
