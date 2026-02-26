/**
 * miniScenes.js — Three.js hover scenes for project cards. Self-contained IIFE.
 * Depends on THREE being loaded globally from CDN before this runs.
 *
 * PERFORMANCE: Only the active card's scene runs at any time.
 * main.js should fire: window.dispatchEvent(new CustomEvent('work-card-change', { detail: { index: N } }))
 * whenever the active card changes (e.g. on scroll snap). miniScenes listens and swaps
 * which renderer loop is live. All others are stopped.
 */
(function() {

function makeMiniScene(canvasEl, modelType, accentHex) {
  const W=280, H=160;
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(45,W/H,.01,100);

  const renderer=new THREE.WebGLRenderer({canvas:canvasEl,antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setClearColor(0x000000,0);
  let viewW=W, viewH=H;
  function syncSize(force){
    const cw=Math.max(1,Math.floor(canvasEl.clientWidth||viewW));
    const ch=Math.max(1,Math.floor(canvasEl.clientHeight||viewH));
    if(!force && cw===viewW && ch===viewH) return;
    viewW=cw; viewH=ch;
    renderer.setSize(viewW,viewH,false);
    camera.aspect=viewW/viewH;
    camera.updateProjectionMatrix();
  }
  syncSize(true);
  scene.add(new THREE.AmbientLight(0xffffff,.3));
  const dir=new THREE.DirectionalLight(accentHex,2.2); dir.position.set(3,4,5); scene.add(dir);
  const back=new THREE.DirectionalLight(0xffffff,.4); back.position.set(-3,-2,-3); scene.add(back);
  const group=new THREE.Group(); scene.add(group);
  const clock=new THREE.Clock(); let animFn=null;

  function sol(geo,col,op){
    return new THREE.Mesh(geo,new THREE.MeshPhongMaterial({color:col,shininess:80,
      transparent:op!==undefined&&op<1,opacity:op!==undefined?op:1}));
  }
  function wir(geo,col,op){
    return new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:col,wireframe:true,transparent:true,opacity:op}));
  }
  function lin(pts,col,op){
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({color:col,transparent:true,opacity:op}));
  }

  if(modelType==='car'){
    camera.position.set(0, 0.8, 6.8);
    camera.fov = 65;
    camera.updateProjectionMatrix();
    group.position.y = 0.3;

    scene.children.filter(c=>c.isLight).forEach(c=>scene.remove(c));
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun=new THREE.DirectionalLight(0xffffff,1.8); sun.position.set(3,4,5); scene.add(sun);
    const fill=new THREE.DirectionalLight(0xffffff,0.5); fill.position.set(-3,-2,-3); scene.add(fill);

    const loader=new THREE.GLTFLoader();
    loader.load('/assets/car.glb', function(gltf){
      const model=gltf.scene;
      const box=new THREE.Box3().setFromObject(model);
      const size=box.getSize(new THREE.Vector3());
      const center=box.getCenter(new THREE.Vector3());
      const maxDim=Math.max(size.x,size.y,size.z);
      const scale=7/maxDim;
      model.scale.setScalar(scale);
      model.position.sub(center.multiplyScalar(scale));
      model.position.y+=size.y*scale*0.25;

      const carBottom=box.min.y*scale-center.y*scale+size.y*scale*0.25-size.y*scale*0.35;
      let discRadius=(size.x*scale)*0.45;
      model.traverse(child=>{
        if(child.isMesh){
          const b=new THREE.Box3().setFromObject(child);
          const s=b.getSize(new THREE.Vector3());
          if(s.x>s.y*5) discRadius=(s.x*scale)*0.5;
        }
      });

      const glowGeo=new THREE.CircleGeometry(discRadius*1.5,64);
      const glowMat=new THREE.ShaderMaterial({
        transparent:true, depthWrite:false, side:THREE.DoubleSide,
        uniforms:{ color:{value:new THREE.Color('#FFB000')} },
        vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader:`uniform vec3 color;varying vec2 vUv;void main(){float dist=distance(vUv,vec2(0.5));float alpha=smoothstep(0.5,0.0,dist)*1.5;gl_FragColor=vec4(color,alpha);}`,
      });
      const glowMesh=new THREE.Mesh(glowGeo,glowMat);
      glowMesh.rotation.x=-Math.PI/2;
      glowMesh.position.y=carBottom+0.01;
      group.add(glowMesh,model);
    });

    animFn=()=>{ group.rotation.y=clock.getElapsedTime()*0.4; };

  } else if(modelType==='planet'){
    camera.fov=46;
    camera.position.set(0,0.2,5.4);
    camera.lookAt(0,0,0);
    camera.updateProjectionMatrix();

    const STAR_COUNT=1500, ARMS=3, RADIUS=2.35, CORE_RADIUS=0.23;
    const positions=new Float32Array(STAR_COUNT*3);
    const colors=new Float32Array(STAR_COUNT*3);
    const sizes=new Float32Array(STAR_COUNT);
    const accent=new THREE.Color(accentHex);

    for(let i=0;i<STAR_COUNT;i++){
      const i3=i*3;
      const isCore=Math.random()<0.10;
      if(isCore){
        const r=Math.pow(Math.random(),0.5)*CORE_RADIUS;
        const theta=Math.random()*Math.PI*2;
        const phi=(Math.random()-0.5)*0.3;
        positions[i3]=Math.cos(theta)*r; positions[i3+1]=Math.sin(phi)*r*0.2; positions[i3+2]=Math.sin(theta)*r;
        colors[i3]=1.0; colors[i3+1]=0.92; colors[i3+2]=0.75;
        sizes[i]=Math.random()*1.6+1.2;
      } else {
        const arm=Math.floor(Math.random()*ARMS);
        const t=Math.pow(Math.random(),0.6);
        const r=CORE_RADIUS+t*(RADIUS-CORE_RADIUS);
        const wind=t*Math.PI*3.2;
        const armOff=(arm/ARMS)*Math.PI*2;
        const spread=(Math.random()-0.5)*0.35*(1+t*1.2);
        const theta=armOff+wind+spread;
        const height=(Math.random()-0.5)*(0.04+t*0.12);
        positions[i3]=Math.cos(theta)*r; positions[i3+1]=height; positions[i3+2]=Math.sin(theta)*r;
        const warmth=1-t*0.5;
        const variant=Math.random();
        if(variant<0.18){
          colors[i3]=0.6+warmth*0.4; colors[i3+1]=0.75+warmth*0.25; colors[i3+2]=1.0;
        } else if(variant<0.35){
          colors[i3]=Math.min(1,accent.r*warmth+0.15); colors[i3+1]=Math.min(1,accent.g*warmth+0.15); colors[i3+2]=Math.min(1,accent.b*warmth+0.15);
        } else {
          colors[i3]=warmth*0.9; colors[i3+1]=warmth*0.82; colors[i3+2]=warmth*0.75;
        }
        sizes[i]=Math.random()*1.1*(1-t*0.45)+0.65;
      }
    }

    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geo.setAttribute('aColor',new THREE.BufferAttribute(colors,3));
    geo.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));

    const mat=new THREE.ShaderMaterial({
      vertexShader:`
        attribute float aSize;attribute vec3 aColor;varying vec3 vColor;
        void main(){vColor=aColor;vec4 mvPos=modelViewMatrix*vec4(position,1.0);
        float z=max(0.4,-mvPos.z);
        float p=aSize*(42.0/z);
        gl_PointSize=clamp(p,0.65,2.2);
        gl_Position=projectionMatrix*mvPos;}`,
      fragmentShader:`
        varying vec3 vColor;
        void main(){float d=length(gl_PointCoord-vec2(0.5));if(d>0.5)discard;
        float alpha=1.0-smoothstep(0.08,0.5,d);gl_FragColor=vec4(vColor,alpha*0.96);}`,
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    });

    const haloMat=new THREE.ShaderMaterial({
      transparent:true,
      depthWrite:false,
      uniforms:{ color:{value:new THREE.Color(accentHex)} },
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`uniform vec3 color;varying vec2 vUv;void main(){float d=distance(vUv,vec2(0.5));float a=smoothstep(0.5,0.0,d)*0.20;gl_FragColor=vec4(color,a);}`,
    });
    const halo=new THREE.Mesh(new THREE.PlaneGeometry(6.8,6.8),haloMat);
    halo.position.set(0,0,-0.9);

    const galaxy=new THREE.Points(geo,mat);
    galaxy.rotation.x=Math.PI*0.5;
    group.scale.setScalar(0.55);
    group.position.set(0,-0.04,0);
    group.add(halo,galaxy);
    animFn=()=>{
      galaxy.rotation.y+=0.0012;
    };

  } else if(modelType==='finance'){
    camera.position.set(0,0,5.2);
    camera.lookAt(0,0,0);
    camera.updateProjectionMatrix();
    group.position.set(0,0.10,0);

    const ringCfg = [
      {r:0.56, target:0.72, speed:0.45, phase:0.0},
      {r:0.90, target:0.58, speed:0.34, phase:1.2},
      {r:1.24, target:0.84, speed:0.26, phase:2.1},
    ];
    const accent = new THREE.Color(accentHex);
    const ringBaseMat = new THREE.MeshBasicMaterial({
      color:0xffffff, transparent:true, opacity:0.16
    });
    const rings = [];
    const orbiters = [];

    ringCfg.forEach(cfg=>{
      const base = new THREE.Mesh(
        new THREE.TorusGeometry(cfg.r,0.018,10,96),
        ringBaseMat.clone()
      );
      const prog = new THREE.Mesh(
        new THREE.TorusGeometry(cfg.r,0.024,12,96,Math.PI*2*cfg.target),
        new THREE.MeshBasicMaterial({
          color:accent.clone().lerp(new THREE.Color(0xffffff),0.18),
          transparent:true,
          opacity:0.95
        })
      );
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.028,10,10),
        new THREE.MeshBasicMaterial({
          color:accent.clone().lerp(new THREE.Color(0xffffff),0.45),
          transparent:true,
          opacity:0.95
        })
      );
      base.rotation.z = -Math.PI*0.5;
      prog.rotation.z = -Math.PI*0.5;
      rings.push({cfg,prog,marker});
      group.add(base,prog,marker);

      // Subtle ambient movement: tiny orbiting particle per ring.
      const orbiter = new THREE.Mesh(
        new THREE.SphereGeometry(0.014,8,8),
        new THREE.MeshBasicMaterial({
          color:accent.clone().lerp(new THREE.Color(0xffffff),0.55),
          transparent:true,
          opacity:0.55
        })
      );
      orbiters.push({cfg,orbiter});
      group.add(orbiter);
    });

    const core = new THREE.Mesh(
      new THREE.RingGeometry(0.10,0.14,32),
      new THREE.MeshBasicMaterial({
        color:accent,
        transparent:true,
        opacity:0.8,
        side:THREE.DoubleSide
      })
    );
    group.add(core);

    const sweep = new THREE.Mesh(
      new THREE.TorusGeometry(1.42,0.012,8,96,Math.PI*0.26),
      new THREE.MeshBasicMaterial({
        color:accent.clone().lerp(new THREE.Color(0xffffff),0.25),
        transparent:true,
        opacity:0.42
      })
    );
    sweep.rotation.z = -Math.PI*0.5;
    group.add(sweep);

    animFn=()=>{
      const t=clock.getElapsedTime();
      group.rotation.z = Math.sin(t*0.22)*0.05;
      rings.forEach(({cfg,prog,marker})=>{
        const p = THREE.MathUtils.clamp(
          cfg.target + Math.sin(t*cfg.speed+cfg.phase)*0.07,
          0.16,0.96
        );
        prog.geometry.dispose();
        prog.geometry = new THREE.TorusGeometry(cfg.r,0.024,12,96,Math.PI*2*p);
        prog.rotation.z = -Math.PI*0.5;
        const a = Math.PI*2*p - Math.PI*0.5;
        marker.position.set(Math.cos(a)*cfg.r,Math.sin(a)*cfg.r,0);
      });
      orbiters.forEach(({cfg,orbiter},i)=>{
        const a = t*(0.6+cfg.speed*0.6) + cfg.phase + i*0.55;
        orbiter.position.set(Math.cos(a)*cfg.r,Math.sin(a)*cfg.r,0);
        orbiter.material.opacity = 0.38 + Math.sin(t*1.2+i)*0.12;
      });
      sweep.rotation.z = -Math.PI*0.5 + t*0.26;
      core.material.opacity = 0.68 + Math.sin(t*0.9)*0.12;
    };
  } else if(modelType==='hand'){
    camera.position.set(0,0.05,4.35);
    camera.fov=52;
    camera.lookAt(0,0,0);
    camera.updateProjectionMatrix();
    group.position.set(0,0.02,0);
    // Rotate to show palm side.
    group.rotation.set(0,Math.PI,0);

    // Hand scene: use physically-based lighting/tone mapping for a more natural look.
    renderer.physicallyCorrectLights = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene.children.filter(c=>c.isLight).forEach(c=>scene.remove(c));
    scene.add(new THREE.AmbientLight(0xffffff, 0.32));
    const hemi = new THREE.HemisphereLight(0xfff6ef, 0x5a4a40, 0.72);
    scene.add(hemi);
    const handKey = new THREE.DirectionalLight(0xfff0e3, 1.15);
    handKey.position.set(2.2, 3.4, 4.4);
    scene.add(handKey);
    const handFill = new THREE.DirectionalLight(0xcfe1ff, 0.38);
    handFill.position.set(-2.1, 1.0, -2.6);
    scene.add(handFill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.62);
    rim.position.set(0.0, 2.4, -4.6);
    scene.add(rim);

    const kpColor = new THREE.Color(accentHex);
    const pointInterval = 0.16;
    const pointFade = 0.38;
    const lineDelay = 0.08;
    const lineFade = 0.28;
    const keypointEdges = [
      [0,1],[1,2],[2,3],[3,4],
      [0,5],[5,6],[6,7],[7,8],
      [0,9],[9,10],[10,11],[11,12],
      [0,13],[13,14],[14,15],[15,16],
      [0,17],[17,18],[18,19],[19,20],
      [5,9],[9,13],[13,17]
    ];

    let kpDots = [];
    let kpLines = [];
    let handReady = false;
    const loader=new THREE.GLTFLoader();
    loader.load('/assets/hands.glb', function(gltf){
      const model=gltf.scene;
      const box=new THREE.Box3().setFromObject(model);
      const size=box.getSize(new THREE.Vector3());
      const center=box.getCenter(new THREE.Vector3());
      const maxDim=Math.max(size.x,size.y,size.z)||1;
      const scale=2.8/maxDim;

      model.scale.setScalar(scale);
      model.position.sub(center.multiplyScalar(scale));
      model.position.y += 0.06;

      // If the GLB lacks rich skin textures, give it a more realistic PBR baseline.
      model.traverse(child=>{
        if(!child.isMesh) return;
        const m = child.material;
        const hasColorMap = !!(m && m.map);
        const hasNormalMap = !!(m && m.normalMap);
        if(m && m.isMeshStandardMaterial){
          if(!hasColorMap){
            m.color.set(0xe8b18f);
          }
          m.metalness = 0.0;
          m.roughness = hasNormalMap ? 0.72 : 0.82;
          m.envMapIntensity = 0.35;
          m.needsUpdate = true;
        } else {
          child.material = new THREE.MeshStandardMaterial({
            color: 0xe8b18f,
            metalness: 0.0,
            roughness: 0.82
          });
        }
      });

      // Build landmarks from normalized hand-map coordinates so layout stays stable.
      const fitBox = new THREE.Box3().setFromObject(model);
      const minFit = fitBox.min.clone();
      const sizeFit = fitBox.getSize(new THREE.Vector3());
      const zPlane = fitBox.max.z + sizeFit.z * 0.02;
      const kp = (nx, ny) => {
        // Hand group is Y-flipped; mirror X so thumb/fingers map to the visible side.
        const mappedX = 1 - nx;
        // Keep landmarks closer to finger shafts while preserving palm alignment.
        const mappedY = Math.max(0, Math.min(1, ny - 0.03));
        return new THREE.Vector3(
          minFit.x + sizeFit.x * mappedX,
          minFit.y + sizeFit.y * mappedY,
          zPlane
        );
      };
      const keypointPositions = [
        kp(0.50, 0.03), // 0 wrist

        // Thumb (sweeps left and up)
        kp(0.26, 0.21), kp(0.17, 0.30), kp(0.10, 0.40), kp(0.05, 0.50), // 1-4

        // Index finger
        kp(0.36, 0.42), kp(0.34, 0.60), kp(0.32, 0.78), kp(0.30, 0.93), // 5-8

        // Middle finger
        kp(0.50, 0.44), kp(0.50, 0.65), kp(0.50, 0.84), kp(0.50, 1.00), // 9-12

        // Ring finger
        kp(0.63, 0.42), kp(0.65, 0.61), kp(0.67, 0.79), kp(0.69, 0.93), // 13-16

        // Pinky
        kp(0.75, 0.36), kp(0.80, 0.52), kp(0.84, 0.66), kp(0.88, 0.78), // 17-20
      ];

      const kpGroup = new THREE.Group();
      keypointPositions.forEach(pos => {
        const dotMat = new THREE.MeshBasicMaterial({
          color: kpColor,
          transparent: true,
          opacity: 0,
          depthTest: false,
          depthWrite: false
        });
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.019, 12, 12), dotMat);
        dot.position.copy(pos);
        dot.visible = true;
        kpDots.push(dot);
        kpGroup.add(dot);
      });

      kpGroup.renderOrder = 3;
      keypointEdges.forEach(([a,b]) => {
        const seg = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([keypointPositions[a], keypointPositions[b]]),
          new THREE.LineBasicMaterial({
            color: kpColor,
            transparent: true,
            opacity: 0,
            depthTest: false,
            depthWrite: false
          })
        );
        seg.visible = true;
        seg.renderOrder = 3;
        kpLines.push({ line: seg, a, b });
        kpGroup.add(seg);
      });
      kpGroup.position.set(0.00,0.00,0.01);
      group.add(kpGroup);
      group.add(model);
      handReady = true;
    });

    // Keep the hand static; animate landmark reveal only.
    animFn=()=>{
      if(!handReady) return;
      const t = clock.getElapsedTime();
      kpDots.forEach((dot, i) => {
        const start = i * pointInterval;
        const a = Math.max(0, Math.min(1, (t - start) / pointFade));
        dot.material.opacity = a;
      });
      kpLines.forEach(({ line, a, b }) => {
        const start = Math.max(a, b) * pointInterval + lineDelay;
        const alpha = Math.max(0, Math.min(1, (t - start) / lineFade));
        line.material.opacity = alpha * 0.95;
      });
    };
  } else if(modelType==='explore'){
    const nodeDefs=[
      {rad:0.6,speed:0.8,phase:0,size:0.09,y:0.1},
      {rad:1.1,speed:0.5,phase:Math.PI*.6,size:0.07,y:-0.15},
      {rad:1.5,speed:0.3,phase:Math.PI*1.2,size:0.06,y:0.2},
      {rad:0.85,speed:1.1,phase:Math.PI*1.7,size:0.05,y:-0.05},
      {rad:1.8,speed:0.2,phase:Math.PI*.3,size:0.08,y:0.0},
    ];
    const nucleus=sol(new THREE.IcosahedronGeometry(.18,1),accentHex);
    nucleus.add(wir(new THREE.IcosahedronGeometry(.2,1),accentHex,.4));
    group.add(nucleus);
    const nodes=[];
    nodeDefs.forEach((def,i)=>{
      const pts=[];
      for(let j=0;j<=96;j++){const a=j/96*Math.PI*2;pts.push(new THREE.Vector3(Math.cos(a)*def.rad,def.y*.3,Math.sin(a)*def.rad));}
      const orbitLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:accentHex,transparent:true,opacity:.15+i*.03}));
      group.add(orbitLine);
      const node=sol(new THREE.OctahedronGeometry(def.size,0),accentHex,.9);
      node.add(wir(new THREE.OctahedronGeometry(def.size*1.3,0),accentHex,.35));
      nodes.push({mesh:node,def}); group.add(node);
    });
    const connPos=new Float32Array(nodeDefs.length*6);
    const connGeo=new THREE.BufferGeometry(); connGeo.setAttribute('position',new THREE.BufferAttribute(connPos,3));
    group.add(new THREE.LineSegments(connGeo,new THREE.LineBasicMaterial({color:accentHex,transparent:true,opacity:.18})));
    const pGroup=new THREE.Group();
    for(let i=0;i<18;i++){
      const p=new THREE.Mesh(new THREE.SphereGeometry(.02,4,4),new THREE.MeshBasicMaterial({color:new THREE.Color(accentHex).lerp(new THREE.Color(0xffffff),.6),transparent:true,opacity:.5+Math.random()*.4}));
      const theta=Math.random()*Math.PI*2,phi=Math.acos(2*Math.random()-1),r=1.9+Math.random()*.5;
      p.position.set(Math.sin(phi)*Math.cos(theta)*r,Math.cos(phi)*r*.5,Math.sin(phi)*Math.sin(theta)*r); pGroup.add(p);
    }
    group.add(pGroup);
    animFn=()=>{
      const t=clock.getElapsedTime();
      nucleus.rotation.x=t*.4; nucleus.rotation.y=t*.6;
      group.rotation.y=t*.08; group.rotation.x=Math.sin(t*.17)*.12;
      nodes.forEach(({mesh,def},i)=>{
        const angle=def.phase+t*def.speed;
        mesh.position.set(Math.cos(angle)*def.rad,def.y,Math.sin(angle)*def.rad);
        mesh.rotation.x=t*.5+i; mesh.rotation.y=t*.4+i;
        mesh.scale.setScalar(1+Math.sin(t*2+i*1.2)*.15);
        connPos[i*6]=0;connPos[i*6+1]=0;connPos[i*6+2]=0;
        connPos[i*6+3]=mesh.position.x;connPos[i*6+4]=mesh.position.y;connPos[i*6+5]=mesh.position.z;
      });
      connGeo.attributes.position.needsUpdate=true;
      pGroup.rotation.y=t*.04;
    };
  }

  let running=false, rafId=null;
  function start(){if(running)return;running=true;clock.start();loop();}
  function loop(){
    if(!running)return;
    rafId=requestAnimationFrame(loop);
    syncSize(false);
    if(animFn)animFn();
    renderer.render(scene,camera);
  }
  function stop(){
    running=false;
    if(rafId){cancelAnimationFrame(rafId);rafId=null;}
    renderer.clear();
  }
  function dispose(){
    stop();
    renderer.dispose();
    scene.traverse(obj=>{
      if(obj.geometry)obj.geometry.dispose();
      if(obj.material){
        if(Array.isArray(obj.material))obj.material.forEach(m=>m.dispose());
        else obj.material.dispose();
      }
    });
  }
  return {start,stop,dispose};
}

// ─── Orchestrator: only ONE scene active at a time ────────────────────────────

const cards = Array.from(document.querySelectorAll('.project-card'));
const workDriver = document.querySelector('.work-scroll-driver');

// Lazy-created instance per card slot
const minis = new Array(cards.length).fill(null);
let activeIndex = -1;
let siteEntered = false;
let workInView = false;

function getOrCreateMini(index) {
  if(minis[index]) return minis[index];
  const ce = cards[index].querySelector('.pc-canvas');
  if(!ce) return null;
  const mt = ce.dataset.model;
  const col = ce.dataset.color || '#ffffff';
  if(!mt) return null;
  minis[index] = makeMiniScene(ce, mt, col);
  return minis[index];
}

function activateCard(index) {
  if(index === activeIndex) return;

  // Stop the old scene
  if(activeIndex >= 0 && minis[activeIndex]) {
    minis[activeIndex].stop();
  }

  activeIndex = index;
  if(!siteEntered || !workInView || index < 0 || index >= cards.length) return;

  const mini = getOrCreateMini(index);
  if(mini) mini.start();
}

function pauseAll() {
  if(activeIndex >= 0 && minis[activeIndex]) minis[activeIndex].stop();
}

function resumeActive() {
  if(activeIndex < 0) activeIndex = 0;
  const mini = getOrCreateMini(activeIndex);
  if(mini) mini.start();
}

// main.js fires this when scroll snaps to a new card
// e.g.: window.dispatchEvent(new CustomEvent('work-card-change', { detail: { index: 1 } }))
window.addEventListener('work-card-change', e => {
  activateCard(e.detail.index);
});

// Site-entered gate
window.addEventListener('site-entered', () => {
  siteEntered = true;
  if(workInView) resumeActive();
}, {once: true});

// Pause/resume based on work section visibility
if(workDriver) {
  const obs = new IntersectionObserver(entries => {
    workInView = entries[0].isIntersecting;
    if(workInView && siteEntered) resumeActive();
    else pauseAll();
  }, {threshold: 0.01});
  obs.observe(workDriver);
}

// Hover highlight only (no scene switching)
cards.forEach(card => {
  const ce = card.querySelector('.pc-canvas');
  if(!ce) return;
  card.addEventListener('mouseenter', () => ce.classList.add('canvas-hovered'));
  card.addEventListener('mouseleave', () => ce.classList.remove('canvas-hovered'));
});

})();


