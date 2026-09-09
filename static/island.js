import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {buildBear} from './bear.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {BokehPass} from 'three/addons/postprocessing/BokehPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

const host = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({antialias:true});
const MOBILE = matchMedia('(max-width:820px)').matches;
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.25 : 1.5));
renderer.shadowMap.enabled = !MOBILE;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// sky gradient
{
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const g = c.getContext('2d').createLinearGradient(0,0,0,256);
  g.addColorStop(0,'#8fb6c9'); g.addColorStop(.38,'#c6d3c4'); g.addColorStop(.62,'#e9dcc0'); g.addColorStop(1,'#d3ab7c');
  const x = c.getContext('2d'); x.fillStyle = g; x.fillRect(0,0,2,256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  scene.background = t;
}
scene.fog = new THREE.FogExp2(0xd9c9ac, 0.0068);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);

scene.add(new THREE.HemisphereLight(0xdbeef4, 0x54401f, 0.8));
const sun = new THREE.DirectionalLight(0xffe4b5, 3.1);
sun.position.set(30, 40, 22);
if (!MOBILE) {
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024,1024);
  const s = sun.shadow.camera;
  s.left=-30;s.right=30;s.top=30;s.bottom=-30;s.near=1;s.far=120;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.35; sun.shadow.radius = 4;
  renderer.shadowMap.autoUpdate = false;
}
scene.add(sun);
const fill = new THREE.DirectionalLight(0x86b6c4, 0.6);
fill.position.set(-20, 6, -30);
scene.add(fill);
const rimLight = new THREE.DirectionalLight(0xffcf94, 0.85);
rimLight.position.set(-8, 10, 30);
scene.add(rimLight);

const _mc = new Map();
const M = (c, r=0.95) => {
  const k = 'f'+c+'|'+r;
  if (!_mc.has(k)) _mc.set(k, new THREE.MeshStandardMaterial({color:c, roughness:r, metalness:0, flatShading:true}));
  return _mc.get(k);
};
// soft sheen gives fur/cloth a fuzzy rim instead of plastic shading
const SMOOTH = (c, r=0.9) => {
  const k = 's'+c+'|'+r;
  if (!_mc.has(k)) _mc.set(k, new THREE.MeshPhysicalMaterial({
    color:c, roughness:r, metalness:0,
    sheen:0.7, sheenRoughness:0.85, sheenColor:new THREE.Color(0xffdcb0)
  }));
  return _mc.get(k);
};
const GLOW = (c, i=1.8) => new THREE.MeshStandardMaterial({color:c, roughness:0.4, metalness:0, emissive:new THREE.Color(c), emissiveIntensity:i});
const COL = {
  grass:0x7a9b52, grassD:0x5d7f3f, soil:0x6d4e30, rock:0x84705a,
  bark:0x53392a, leafA:0x4e7c46, leafB:0x3c6741, leafC:0x8bad59,
  fur:0x8f6446, furD:0x6d4830, cream:0xe8d5b4, ink:0x241b14,
  wood:0x8d6741, woodD:0x6b4c2e, roof:0x7f4837, scarf:0xa66a3c, stone:0x9d8e79
};
const add = (m, p, parent=scene) => { m.position.set(...p); m.castShadow = !MOBILE; m.receiveShadow = !MOBILE; parent.add(m); return m; };
const R = (seed => () => (seed = seed*16807 % 2147483647) / 2147483647)(42);

/* ---------- island builder ---------- */
const ISLAND_VINES = [];
// 顶点扰动:让规则几何体带上不规则起伏。flatShading 会把每个面变成独立色块,
// 所以位移顶点就能立刻看出地形感,面数完全不变。
function jitter(geo, fn){
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  // 同一位置的顶点要位移相同的量,否则会裂开缝
  const cache = new Map();
  for (let i = 0; i < pos.count; i++){
    v.fromBufferAttribute(pos, i);
    // 精度不能太细,否则本该重合的顶点因浮点误差被当成两个点,位移不一致就撕出缝
    const key = v.x.toFixed(2)+','+v.y.toFixed(2)+','+v.z.toFixed(2);
    let d = cache.get(key);
    if (!d){ d = fn(v.clone()); cache.set(key, d); }
    pos.setXYZ(i, v.x + d.x, v.y + d.y, v.z + d.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}
const N3 = () => new THREE.Vector3();

function island(cx, cy, cz, radius, opts={}){
  const g = new THREE.Group();
  g.position.set(cx, cy, cz);
  scene.add(g);
  const sides = opts.sides || 9;
  const yaw = R()*3;

  // 草地顶面:起伏 + 边缘微收,不再是完美圆盘
  // 顶面是 triangle fan,共享圆心顶点;扰动它会让相邻面法线突变,flatShading 下
  // 沿某条扇形边缘显出一道高光"裂缝"。所以顶面保持平整,只在水平方向轻推轮廓,
  // 地形起伏交给后面单独铺的草丘。
  const topGeo = new THREE.CylinderGeometry(radius, radius*0.94, 1.1, sides, 1);
  jitter(topGeo, (v) => {
    const r = Math.hypot(v.x, v.z);
    if (r < radius*0.25) return N3();            // 圆心不动
    return N3().set((R()-0.5)*radius*0.05, 0, (R()-0.5)*radius*0.05);
  });
  const top = add(new THREE.Mesh(topGeo, M(COL.grass)), [0,0,0], g);
  top.rotation.y = yaw;

  // 土层:锥体拉长比例按岛而异,侧面凹凸让它像被撕下来的岩块
  const taper = opts.taper ?? 1.9;
  const soilGeo = new THREE.ConeGeometry(radius*0.94, radius*taper, sides, 3);
  jitter(soilGeo, (v) => {
    // 顶圈(与草地贴合处)和尖端都不动,只扰动中间,避免把锥体撕开或与草地脱缝
    const half = radius*taper/2;
    const t = 1 - Math.abs(v.y) / half;          // 中间最大,两端为 0
    const k = Math.max(0, t);
    return N3().set((R()-0.5)*radius*0.13*k, (R()-0.5)*0.35*k, (R()-0.5)*radius*0.13*k);
  });
  const soil = add(new THREE.Mesh(soilGeo, M(COL.soil)), [0,-radius*0.95-0.55,0], g);
  soil.rotation.y = yaw;
  // 整体微微倾斜,三岛不再像同一个模子正着摆
  const tilt = opts.tilt ?? 0;
  g.rotation.z = tilt;
  g.rotation.x = (opts.tiltX ?? 0);

  // 岩尖
  const spikeGeo = new THREE.ConeGeometry(radius*0.5, radius*(opts.spike ?? 1.2), 7, 2);
  jitter(spikeGeo, (v) => N3().set((R()-0.5)*0.5, (R()-0.5)*0.4, (R()-0.5)*0.5));
  add(new THREE.Mesh(spikeGeo, M(COL.rock)), [radius*0.2,-radius*1.9,radius*0.1], g);

  // 草土交界:一圈垂草,遮住生硬的水平切线
  {
    const skirt = new THREE.Group();
    skirt.rotation.y = yaw;
    g.add(skirt);
    // 沿边缘密排一圈小草簇,尺寸要小,否则会变成一圈突兀的大三角
    const cnt = sides * 4;
    const step = (Math.PI*2)/cnt;
    for (let i = 0; i < cnt; i++){
      const a = i*step + (R()-0.5)*step*0.6;
      const h = 0.45 + R()*0.55;
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.20 + R()*0.10, h, 4), M(COL.grassD));
      m.rotation.x = Math.PI;            // 尖端朝下
      const rr = radius * (0.9 + R()*0.06);
      m.position.set(Math.cos(a)*rr, -0.45 - h*0.35, Math.sin(a)*rr);
      m.rotation.z = (R()-0.5)*0.3;
      m.castShadow = false;
      skirt.add(m);
    }
  }

  // 地形起伏:几个扁平的低多边形土丘铺在草地上,视觉上等价于起伏,且不会产生接缝
  {
    const mounds = opts.mounds ?? 5;
    for (let i = 0; i < mounds; i++){
      const a = R()*6.28, d = radius*R()*0.62;
      const rr = radius*(0.13 + R()*0.14);
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(rr, 0), M(COL.grass));
      // 压得很扁:只要一点点高差就够,厚了会把熊和草丛埋掉
      m.scale.set(1, 0.07 + R()*0.06, 1);
      m.position.set(Math.cos(a)*d, 0.46, Math.sin(a)*d);
      m.rotation.y = R()*3;
      m.castShadow = false; m.receiveShadow = !MOBILE;
      g.add(m);
    }
  }

  const n = opts.rocks ?? 4;
  for (let i=0;i<n;i++){
    const a = R()*6.28, d = radius*(0.35+R()*0.55), s = 0.25+R()*0.5;
    add(new THREE.Mesh(new THREE.DodecahedronGeometry(s,0), M(COL.rock)), [Math.cos(a)*d, 0.4, Math.sin(a)*d], g).rotation.set(R(),R(),R());
  }
  for (let i=0;i<(opts.tufts??10);i++){
    const a = R()*6.28, d = radius*(0.2+R()*0.75);
    const t = add(new THREE.Mesh(new THREE.ConeGeometry(0.22,0.55,4), M(COL.grassD)), [Math.cos(a)*d,0.7,Math.sin(a)*d], g);
    t.rotation.y = R()*3;
    t.rotation.z = (R()-0.5)*0.3;
  }

  // 岛底垂藤:细长圆柱,animate 里跟风微摆
  if (opts.vines !== false){
    const vines = [];
    const cnt = opts.vineCount ?? (4 + Math.floor(R()*3));
    for (let i=0;i<cnt;i++){
      // 收在岛体内圈:太靠边缘时,岛倾斜 + 草地扰动会让藤顶端露出草面
      const a = R()*6.28, d = radius*(0.30+R()*0.38);
      const len = 1.6 + R()*3.4;
      const v = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.02, len, 4),
        M(R() > 0.45 ? COL.leafB : COL.grassD)
      );
      // 把几何体下移半长,使原点落在藤的顶端 —— 这样绕原点摆动才像从岛底垂下
      v.geometry.translate(0, -len/2, 0);
      // 顶端压到草地/土层交界以下,确保任何角度都看不到接头
      v.position.set(Math.cos(a)*d, -1.15, Math.sin(a)*d);
      v.castShadow = false;
      g.add(v);
      vines.push({ m: v, p: R()*6.28, s: 0.35 + R()*0.5 });
    }
    g.userData.vines = vines;
    ISLAND_VINES.push(...vines);
  }
  return g;
}
// 三种树形,避免 3 棵树一个模子
function tree(parent, x, z, h=1, cool=false){
  const g = new THREE.Group(); g.position.set(x, 0.5, z); parent.add(g);
  const cols = cool ? [COL.leafB, COL.leafA] : [COL.leafA, COL.leafC];
  const kind = Math.floor(R()*3);

  add(new THREE.Mesh(new THREE.CylinderGeometry(0.16*h,0.24*h,1.5*h,6), M(COL.bark)), [0,0.75*h,0], g);

  if (kind === 0){
    // 针叶:两层锥
    add(new THREE.Mesh(new THREE.ConeGeometry(1.0*h,1.7*h,7), M(cols[0])), [0,1.9*h,0], g);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.75*h,1.4*h,7), M(cols[1])), [0,2.8*h,0], g);
  } else if (kind === 1){
    // 圆冠:两三团球叠出蓬松树冠
    const c1 = add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.95*h,0), M(cols[0])), [0,2.1*h,0], g);
    c1.scale.set(1,0.85,1);
    add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.62*h,0), M(cols[1])), [0.45*h,2.7*h,-0.2*h], g);
    add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.5*h,0), M(cols[0])), [-0.42*h,2.5*h,0.25*h], g);
  } else {
    // 细高:三层窄锥
    add(new THREE.Mesh(new THREE.ConeGeometry(0.72*h,1.5*h,6), M(cols[0])), [0,1.85*h,0], g);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.56*h,1.3*h,6), M(cols[1])), [0,2.6*h,0], g);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.38*h,1.0*h,6), M(cols[0])), [0,3.3*h,0], g);
  }
  g.rotation.y = R()*3;
  // 轻微倾斜与缩放,打破整齐感
  g.rotation.z = (R()-0.5)*0.16;
  g.scale.setScalar(0.88 + R()*0.28);
  return g;
}

/* ---------- island A : the bear ---------- */
const A = island(0,0,0, 6.2, {rocks:5, tufts:14, sides:9,  taper:1.75, spike:1.4, bumpy:0.5,  tilt:0.02,  vineCount:6});
tree(A, -3.6, -2.2, 1.25); tree(A, -4.4, 1.6, 0.9); tree(A, 3.9, -3.0, 1.05);

const _bear = buildBear({ SMOOTH, COL, shadow: !MOBILE });
const bruin = _bear.group;
bruin.position.set(0.6, 0.55, 1.4);
bruin.scale.setScalar(0.62);
A.add(bruin);
const eyes = _bear.eyes, arms = _bear.arms;

/* ---------- island B : writing hut ---------- */
const B = island(19,-3.5,-24, 5.4, {rocks:3, tufts:10, sides:7,  taper:2.3,  spike:0.9, bumpy:0.65, tilt:-0.05, tiltX:0.03, vineCount:5});
tree(B, -3.4, 1.8, 1.1, true); tree(B, 3.2, 2.4, 0.85, true);
{
  const h = new THREE.Group(); h.position.set(0.2,0.5,-0.4); h.rotation.y = -0.5; B.add(h);
  add(new THREE.Mesh(new THREE.BoxGeometry(3.2,2.2,2.6), M(COL.wood,.95)), [0,1.1,0], h);
  for (let i=-1;i<=1;i++) add(new THREE.Mesh(new THREE.BoxGeometry(3.24,.12,2.64), M(COL.woodD,.95)), [0,1.1+i*.7,0], h);
  const roof = add(new THREE.Mesh(new THREE.ConeGeometry(2.85,1.5,4), M(COL.roof,.9)), [0,2.95,0], h);
  roof.rotation.y = Math.PI/4;
  // ---- front wall: door + window ----
  const F = 1.31; // front face z
  // door
  add(new THREE.Mesh(new THREE.BoxGeometry(.98,1.75,.09), M(COL.woodD,.92)), [-.95,.88,F], h);
  add(new THREE.Mesh(new THREE.BoxGeometry(.8,1.6,.06), SMOOTH(COL.wood,.85)), [-.95,.86,F+.06], h);
  for (let i=0;i<3;i++) add(new THREE.Mesh(new THREE.BoxGeometry(.72,.06,.04), M(COL.woodD,.95)), [-.95,.28+i*.56,F+.1], h).castShadow=false;
  add(new THREE.Mesh(new THREE.SphereGeometry(.075,10,10), SMOOTH(0xc9a24a,.35)), [-.62,.88,F+.12], h);
  // stone step under the door
  add(new THREE.Mesh(new THREE.BoxGeometry(1.3,.16,.7), M(COL.stone,.95)), [-.95,.03,F+.28], h);
  // window: glow pane + frame + sill + shutters
  add(new THREE.Mesh(new THREE.PlaneGeometry(.9,.9), new THREE.MeshBasicMaterial({color:0xffd89a})), [.85,1.32,F+.01], h);
  add(new THREE.Mesh(new THREE.BoxGeometry(1.06,.09,.07), M(COL.woodD,.95)), [.85,1.81,F+.03], h).castShadow=false;
  add(new THREE.Mesh(new THREE.BoxGeometry(1.06,.09,.07), M(COL.woodD,.95)), [.85,.83,F+.03], h).castShadow=false;
  for (const s of [-1,1]) add(new THREE.Mesh(new THREE.BoxGeometry(.09,1.06,.07), M(COL.woodD,.95)), [.85+.485*s,1.32,F+.03], h).castShadow=false;
  add(new THREE.Mesh(new THREE.BoxGeometry(.05,.9,.05), M(COL.woodD,.95)), [.85,1.32,F+.05], h).castShadow=false;
  add(new THREE.Mesh(new THREE.BoxGeometry(.9,.05,.05), M(COL.woodD,.95)), [.85,1.32,F+.05], h).castShadow=false;
  add(new THREE.Mesh(new THREE.BoxGeometry(1.24,.1,.26), M(COL.wood,.95)), [.85,.8,F+.12], h);
  for (const s of [-1,1]){
    const sh = add(new THREE.Mesh(new THREE.BoxGeometry(.46,1.0,.07), M(COL.roof,.9)), [.85+.72*s,1.32,F+.16], h);
    sh.rotation.y = -.5*s;
  }
  // window light + planter
  const lamp = new THREE.PointLight(0xffc078, 2.4, 7, 2); lamp.position.set(.85,1.32,F+.6); h.add(lamp);
  add(new THREE.Mesh(new THREE.BoxGeometry(1.0,.28,.3), M(COL.woodD,.95)), [.85,.62,F+.26], h);
  for (let i=0;i<3;i++) add(new THREE.Mesh(new THREE.SphereGeometry(.14,8,8), M(COL.leafC,.9)), [.5+i*.35,.82,F+.26], h).castShadow=false;
  add(new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,1.1,8), M(COL.stone)), [1.0,3.5,-.4], h);
  // book stack outside
  const bc = [0x7b4a3a, 0x4f7a48, 0x9c6b3f];
  for (let i=0;i<3;i++) add(new THREE.Mesh(new THREE.BoxGeometry(.9,.18,.65), SMOOTH(bc[i],.8)), [2.4,.6+i*.19,1.5], h).rotation.y = R()*.5;
}

/* ---------- island C : timeline path ---------- */
const C = island(-9,3,-50, 5.8, {rocks:4, tufts:12, sides:11, taper:1.55, spike:1.7, bumpy:0.42, tilt:0.045, tiltX:-0.02, vineCount:7});
tree(C, 3.6, -2.4, 1.35); tree(C, -3.8, -1.2, 1.0);
for (let i=0;i<6;i++){
  const t = i/5;
  add(new THREE.Mesh(new THREE.CylinderGeometry(.55-t*.12,.6-t*.12,.28,7), M(COL.stone)), [-3.6+t*7.4, .68, 2.4-t*4.6], C).rotation.y = R()*3;
}
{ // lantern posts along the path
  for (let i=0;i<3;i++){
    const t = i/2, g = new THREE.Group(); g.position.set(-2.6+t*6.2, 0.5, 3.4-t*4.4); C.add(g);
    add(new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,1.5,6), M(COL.bark)), [0,.75,0], g);
    add(new THREE.Mesh(new THREE.OctahedronGeometry(.28,0), GLOW(0xffd89a, 2.2)), [0,1.66,0], g);
  }
}

{ // ---- 工作台 workbench: the developer's desk at the end of the path ----
  const w = new THREE.Group(); w.position.set(2.9, 0.5, 1.8); w.rotation.y = -0.75; C.add(w);
  const BOX = (x,y,z,m) => new THREE.Mesh(new THREE.BoxGeometry(x,y,z), m);
  const CYL = (r1,r2,h,s,m) => new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,s), m);
  // desk
  add(BOX(2.9,.13,1.35, M(COL.wood,.94)), [0,1.32,0], w);
  add(BOX(2.94,.07,1.39, M(COL.woodD,.96)), [0,1.24,0], w).castShadow=false;
  for (const [x,z] of [[-1.28,.52],[1.28,.52],[-1.28,-.52],[1.28,-.52]])
    add(CYL(.07,.09,1.25,6, M(COL.woodD,.96)), [x,.63,z], w);
  add(BOX(2.5,.09,.5, M(COL.woodD,.96)), [0,.85,-.3], w); // shelf
  // main monitor
  add(CYL(.3,.36,.06,10, M(COL.stone,.7)), [-.15,1.41,-.34], w);
  add(BOX(.12,.5,.1, M(COL.stone,.6)), [-.15,1.68,-.34], w);
  const scr = add(BOX(1.6,.95,.07, SMOOTH(0x2c3a3c,.5)), [-.15,2.35,-.36], w);
  scr.rotation.x = -.06;
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.46,.82), new THREE.MeshBasicMaterial({color:0x8fe6c8}));
  pane.position.set(-.15,2.35,-.31); pane.rotation.x = -.06; w.add(pane);
  // code lines on the screen
  const codeCols = [0xffd89a, 0xa8ded0, 0xf0b7a0, 0xd8e6a0];
  for (let i=0;i<7;i++){
    const lw = .28 + R()*.85;
    const ln = new THREE.Mesh(new THREE.PlaneGeometry(lw,.055), new THREE.MeshBasicMaterial({color:codeCols[i%4]}));
    ln.position.set(-.78 + lw/2 + (i%3)*.07, 2.68 - i*.1, -.3); ln.rotation.x = -.06; w.add(ln);
  }
  const scrLight = new THREE.PointLight(0x8fe6c8, 2.6, 5, 2); scrLight.position.set(-.15,2.3,.3); w.add(scrLight);
  // laptop, second screen
  const lp = new THREE.Group(); lp.position.set(1.15,1.39,.05); lp.rotation.y = .7; w.add(lp);
  add(BOX(.78,.05,.55, SMOOTH(0x59686a,.5)), [0,0,0], lp);
  const lid = add(BOX(.78,.5,.04, SMOOTH(0x4a595b,.45)), [0,.24,-.26], lp); lid.rotation.x = -.3;
  const lscr = new THREE.Mesh(new THREE.PlaneGeometry(.68,.42), new THREE.MeshBasicMaterial({color:0xbdf0e0}));
  lscr.position.set(0,.24,-.23); lscr.rotation.x = -.3; lp.add(lscr);
  // keyboard, mouse, mug, books, plant
  add(BOX(1.15,.05,.4, SMOOTH(0x3c4a4c,.6)), [-.2,1.41,.36], w);
  add(new THREE.Mesh(new THREE.SphereGeometry(.09,10,8), SMOOTH(0x3c4a4c,.5)), [.55,1.43,.4], w).scale.set(1,.65,1.4);
  const mug = add(CYL(.13,.11,.24,12, SMOOTH(COL.scarf,.75)), [-1.15,1.51,.32], w);
  const hd = add(new THREE.Mesh(new THREE.TorusGeometry(.08,.025,6,12), SMOOTH(COL.scarf,.75)), [-1.29,1.51,.32], w);
  hd.rotation.y = Math.PI/2;
  const bkc = [0x7b4a3a, 0x4f7a48, 0x4a6a8a];
  for (let i=0;i<3;i++) add(BOX(.5,.11,.36, SMOOTH(bkc[i],.85)), [1.05,.95+i*.12,-.28], w).rotation.y = (R()-.5)*.3;
  add(CYL(.13,.1,.22,8, M(COL.stone,.9)), [-1.2,.99,-.3], w);
  for (let i=0;i<3;i++) add(new THREE.Mesh(new THREE.SphereGeometry(.11,8,7), M(COL.leafC,.9)), [-1.2+(R()-.5)*.2,1.18+R()*.1,-.3+(R()-.5)*.2], w).castShadow=false;
  // desk lamp
  const lg = new THREE.Group(); lg.position.set(-1.35,1.39,-.35); w.add(lg);
  add(CYL(.16,.18,.05,10, M(COL.woodD,.9)), [0,0,0], lg);
  const arm = add(CYL(.035,.035,.85,6, M(COL.bark,.9)), [0,.42,0], lg); arm.rotation.z = .3;
  const shade = add(new THREE.Mesh(new THREE.ConeGeometry(.22,.26,10,1,true), M(COL.roof,.85)), [-.26,.82,0], lg);
  shade.rotation.z = -.5; shade.material.side = THREE.DoubleSide;
  add(new THREE.Mesh(new THREE.SphereGeometry(.09,10,10), GLOW(0xffd89a, 2.6)), [-.3,.72,0], lg).castShadow=false;
  const dl = new THREE.PointLight(0xffc078, 2.2, 4.5, 2); dl.position.set(-.3,.7,0); lg.add(dl);
  // stool
  const st = new THREE.Group(); st.position.set(-.1,0,1.35); w.add(st);
  add(CYL(.42,.4,.12,12, M(COL.wood,.94)), [0,.85,0], st);
  for (let i=0;i<3;i++){
    const a = i/3*6.283;
    const lgg = add(CYL(.05,.06,.85,6, M(COL.woodD,.96)), [Math.cos(a)*.28,.42,Math.sin(a)*.28], st);
    lgg.rotation.set(Math.sin(a)*.14, 0, -Math.cos(a)*.14);
  }
  // little server tower with status LEDs
  add(BOX(.42,.75,.42, SMOOTH(0x4a4f52,.55)), [1.5,.88,.45], w);
  for (let i=0;i<3;i++)
    add(new THREE.Mesh(new THREE.SphereGeometry(.032,8,8), GLOW([0x8fe6c8,0xffd89a,0xf0a090][i], 3)), [1.5,1.14-i*.12,.67], w).castShadow=false;
}

/* ---------- rope bridges between the islands ---------- */
function bridge(a, ra, b, rb, sag = 3.2){
  const A0 = a.position.clone(), B0 = b.position.clone();
  const dir = B0.clone().sub(A0); dir.y = 0; dir.normalize();
  const from = A0.clone().addScaledVector(dir, ra*0.94); from.y += 0.55;
  const to   = B0.clone().addScaledVector(dir, -rb*0.94); to.y += 0.55;
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  const at = t => {
    const p = from.clone().lerp(to, t);
    p.y -= Math.sin(Math.PI*t)*sag;
    return p;
  };
  const g = new THREE.Group(); scene.add(g);
  const n = 26;
  for (let i=0;i<n;i++){
    const t = i/n, p = at(t), nx = at(Math.min(t+0.02,1));
    const plank = add(new THREE.Mesh(new THREE.BoxGeometry(1.5,0.1,0.42), M(i%2 ? COL.wood : COL.woodD, .95)), [p.x,p.y,p.z], g);
    plank.lookAt(nx);
    plank.rotateY((R()-0.5)*0.05);
  }
  // hand ropes + deck ropes
  const ropeMat = SMOOTH(COL.bark, .95);
  for (const s of [-1,1]) for (const h of [0.06, 0.95]){
    const pts = [];
    for (let i=0;i<=20;i++){
      const t = i/20, p = at(t);
      pts.push(p.clone().addScaledVector(side, 0.74*s).setY(p.y + h + (h > 0.5 ? Math.sin(Math.PI*t)*0.5 : 0)));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.045, 5, false), ropeMat);
    tube.castShadow = true; g.add(tube);
  }
  // rope posts at both ends + vertical hangers
  for (const [p, d] of [[from, 1], [to, -1]]) for (const s of [-1,1]){
    const post = add(new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.13,1.5,6), M(COL.bark)), [0,0,0], g);
    post.position.copy(p).addScaledVector(side, 0.74*s).addScaledVector(dir, 0.35*d).setY(p.y + 0.5);
  }
  for (let i=2;i<n;i+=4) for (const s of [-1,1]){
    const t = i/n, p = at(t);
    const hang = add(new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.95,4), ropeMat), [0,0,0], g);
    hang.position.copy(p).addScaledVector(side, 0.74*s).setY(p.y + 0.5 + Math.sin(Math.PI*t)*0.25);
    hang.castShadow = false;
  }
  return g;
}
bridge(A, 6.2, B, 5.4, 3.4);
bridge(B, 5.4, C, 5.8, 3.8);

/* ---------- floating rocks + clouds ---------- */
/* ---------- 梦幻氛围层 ---------- */
// 1) 体积光:朝阳光方向的半透明锥形光束,加性混合出丁达尔效应
const godrays = new THREE.Group();
scene.add(godrays);
{
  const shaftMat = new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
    uniforms:{ uTime:{value:0}, uColor:{value:new THREE.Color(0xffe0ab)}, uOpacity:{value:0.075} },
    vertexShader:`
      varying vec2 vUv; varying float vY;
      void main(){ vUv = uv; vY = position.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader:`
      uniform float uTime; uniform vec3 uColor; uniform float uOpacity;
      varying vec2 vUv; varying float vY;
      void main(){
        // 沿光束长度衰减 + 边缘柔化,避免生硬的锥体轮廓
        float len  = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
        float edge = sin(vUv.x * 3.14159);
        float flick = 0.85 + 0.15 * sin(uTime * 0.5 + vUv.x * 6.0);
        gl_FragColor = vec4(uColor, len * edge * edge * uOpacity * flick);
      }`
  });
  const shaftGeo = new THREE.ConeGeometry(9, 60, 12, 1, true);
  for (let i = 0; i < 4; i++){
    const sh = new THREE.Mesh(shaftGeo, shaftMat);
    sh.position.set(14 + i*7 - 10, 20, -26 + i*5);
    sh.rotation.z = -0.42 + i*0.05;
    sh.rotation.y = i * 0.7;
    sh.scale.setScalar(0.8 + i*0.18);
    godrays.add(sh);
  }
  godrays.userData.mat = shaftMat;
}

// 2) 浮尘:被阳光照亮的悬浮微粒,围绕小岛缓慢上升
let motes = null;
{
  const N = MOBILE ? 260 : 700;
  const pos = new Float32Array(N*3), seed = new Float32Array(N), siz = new Float32Array(N);
  for (let i = 0; i < N; i++){
    const a = R()*Math.PI*2, rad = 6 + R()*34;
    pos[i*3]   = 17 + Math.cos(a)*rad;
    pos[i*3+1] = -8 + R()*26;
    pos[i*3+2] = -24 + Math.sin(a)*rad;
    seed[i] = R()*100;
    siz[i]  = 0.5 + R()*1.6;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos,3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed,1));
  g.setAttribute('aSize', new THREE.BufferAttribute(siz,1));
  const mat = new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    uniforms:{ uTime:{value:0}, uPR:{value:renderer.getPixelRatio()} },
    vertexShader:`
      attribute float aSeed; attribute float aSize;
      uniform float uTime; uniform float uPR;
      varying float vA;
      void main(){
        vec3 p = position;
        // 缓慢上升并横向飘移,越过顶部后回到底部循环
        p.y = mod(p.y + uTime * 0.35 + aSeed, 30.0) - 10.0;
        p.x += sin(uTime * 0.25 + aSeed) * 1.4;
        p.z += cos(uTime * 0.2  + aSeed) * 1.4;
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        // 近处更亮,远处淡出,避免远景一片糊
        vA = smoothstep(90.0, 20.0, -mv.z) * (0.35 + 0.65 * (0.5 + 0.5 * sin(uTime + aSeed*3.0)));
        gl_PointSize = aSize * uPR * 130.0 / max(-mv.z, 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader:`
      varying float vA;
      void main(){
        // 圆形柔边光点
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(1.0, 0.94, 0.82, a * a * vA * 0.55);
      }`
  });
  motes = new THREE.Points(g, mat);
  motes.frustumCulled = false;
  scene.add(motes);
}

const drifters = [];
for (let i=0;i<14;i++){
  const m = add(new THREE.Mesh(new THREE.DodecahedronGeometry(.4+R()*1.1,0), M(COL.rock)),
    [(R()-.5)*70, -6+R()*22, -R()*80+8]);
  m.rotation.set(R()*3,R()*3,R()*3);
  drifters.push({m, s:.2+R()*.5, y:m.position.y});
}
const cloudMat = SMOOTH(0xfffaf0, 1); cloudMat.transparent = true; cloudMat.opacity = .85;
for (let i=0;i<9;i++){
  const g = new THREE.Group();
  g.position.set((R()-.5)*90, 8+R()*16, -R()*90+10);
  for (let j=0;j<4;j++){
    const s = new THREE.Mesh(new THREE.SphereGeometry(1.6+R()*1.6, 10, 8), cloudMat);
    s.position.set((R()-.5)*5, (R()-.5)*1.1, (R()-.5)*3); s.scale.y = .55; g.add(s);
  }
  scene.add(g);
  drifters.push({m:g, s:.06+R()*.1, y:g.position.y, cloud:true});
}

/* ---------- camera stations ---------- */
const V = (x,y,z) => new THREE.Vector3(x,y,z);
const POSE = {
  hero:     {p:V(-2.5, 5.5, 17),   t:V(-5.5, 2.4, 0)},
  about:    {p:V(-8.5, 4.0, 10),   t:V(4.5, 1.8, 1.0)},
  writing:  {p:V(9, 3.5, -8),      t:V(13.5, -1.6, -20)},
  timeline: {p:V(-14.6, 9.6, -38.4), t:V(-5.2, 4.2, -47.2)},
  contact:  {p:V(-14, 13, -30),    t:V(-2, 0, -26)}
};
const stations = [...document.querySelectorAll('[data-station]')];
const AMBIENT = stations.length === 0; // secondary pages: no scroll stations, just a slow drift
const camPos = POSE.hero.p.clone(), camTgt = POSE.hero.t.clone();
const wantPos = camPos.clone(), wantTgt = camTgt.clone();
const smooth = x => x*x*(3-2*x);
let free = false;
let station = 'hero', wave = 0, turnPop = 0, wasFacing = false;
const FACE_CAM = -0.83; // yaw that turns the bear toward the 'about' camera

function updateTarget(){
  if (free || AMBIENT) return;
  const mid = scrollY + innerHeight*0.5;
  let i = 0;
  for (let k=0;k<stations.length;k++){
    const el = stations[k];
    if (el.offsetTop + el.offsetHeight*0.55 < mid) i = k+1;
  }
  i = Math.min(i, stations.length-1);
  const cur = POSE[stations[i].dataset.station] || POSE.hero;
  const prevEl = stations[Math.max(i-1,0)];
  const prev = POSE[prevEl.dataset.station] || POSE.hero;
  const a = prevEl.offsetTop + prevEl.offsetHeight*0.55;
  const b = stations[i].offsetTop + stations[i].offsetHeight*0.55;
  const t = b > a ? smooth(Math.max(0, Math.min(1, (mid - a)/(b - a)))) : 1;
  wantPos.copy(prev.p).lerp(cur.p, t);
  wantTgt.copy(prev.t).lerp(cur.t, t);
  const name = stations[i].dataset.station;
  if (name !== station){ if (name === 'about'){ wave = 1; turnPop = 1; } station = name; }
  const links = document.querySelectorAll('nav a');
  links.forEach((l,k)=> l.classList.toggle('cur', k === i));
}
addEventListener('scroll', updateTarget, {passive:true});
addEventListener('resize', updateTarget);
updateTarget();

/* ---------- free-look mode ---------- */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.8;
controls.panSpeed = 0.7;
controls.minDistance = 4;
controls.maxDistance = 120;
controls.maxPolarAngle = Math.PI*0.92;
controls.enabled = false;
const freeBtn = document.getElementById('freelook');
function setFree(on){
  free = on;
  controls.enabled = on;
  document.body.classList.toggle('freelook', on);
  if (freeBtn) freeBtn.textContent = on ? '退出自由视角 ✕' : '自由视角';
  if (on){
    controls.target.copy(camTgt);
    controls.object.position.copy(camera.position);
    controls.update();
  } else {
    camPos.copy(camera.position); camTgt.copy(controls.target);
    offX = offY = 0;
    updateTarget();
  }
}
freeBtn?.addEventListener('click', () => setFree(!free));
addEventListener('keydown', e => { if (e.key === 'Escape' && free) setFree(false); });

/* ---------- pointer look + poke ---------- */
let px=0, py=0, dragging=false, lx=0, ly=0, offX=0, offY=0, bounce=0;
const el = renderer.domElement;
el.addEventListener('pointerdown', e => { if (free) return; dragging=true; lx=e.clientX; ly=e.clientY; el.setPointerCapture(e.pointerId); el.style.cursor='grabbing'; });
el.addEventListener('pointerup', e => { if (free) return; dragging=false; el.style.cursor='grab'; if (Math.hypot(e.clientX-lx, e.clientY-ly) < 5) poke(); });
el.addEventListener('pointermove', e => {
  const r = el.getBoundingClientRect();
  px = ((e.clientX-r.left)/r.width)*2-1; py = -((e.clientY-r.top)/r.height)*2+1;
  if (!dragging || free) return;
  offX += (e.clientX-lx)*0.022; offY += (e.clientY-ly)*0.014;
  offX = Math.max(-6, Math.min(6, offX)); offY = Math.max(-3, Math.min(3.5, offY));
  lx = e.clientX; ly = e.clientY;
});
el.style.cursor = 'grab';

const bubble = document.getElementById('bearsay');
const SAY = ['唔……','别戳了,痒。','今天也没有减肥。','Hi there 👋','编译中,请稍候','蜂蜜在哪里','再转一圈?'];
let sayT;
function poke(){
  bounce = 1;
  if (!bubble) return;
  bubble.textContent = SAY[Math.floor(Math.random()*SAY.length)];
  bubble.classList.add('on');
  clearTimeout(sayT); sayT = setTimeout(()=>bubble.classList.remove('on'), 2200);
}
document.getElementById('poke')?.addEventListener('click', poke);

/* ---------- 后期处理:辉光 + 景深 + 暖色分级 ---------- */
// 移动端跳过景深(BokehPass 开销大),只保留轻量辉光
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloom = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight),
  MOBILE ? 0.22 : 0.34,   // strength:高光溢出强度
  0.70,                   // radius:光晕扩散范围
  0.86                    // threshold:仅超过此亮度的像素起辉
);
composer.addPass(bloom);

// 景深默认关闭:实测是最贵的一个 pass(约拉低一半帧率),而本场景已有雾和体积光,
// 虚化带来的观感增益有限。想开的话在 URL 后加 ?dof,或控制台 __fx.bokeh.enabled = true
let bokeh = null;
if (!MOBILE && new URLSearchParams(location.search).has('dof')){
  bokeh = new BokehPass(scene, camera, { focus: 34.0, aperture: 0.00011, maxblur: 0.005 });
  composer.addPass(bokeh);
}

// 暖色调分级 + 边缘暗角,把整体压成柔和的黄昏感
const grade = new ShaderPass({
  uniforms:{
    tDiffuse:{value:null}, uWarm:{value:0.05}, uVig:{value:0.16}, uSat:{value:1.10}
  },
  vertexShader:`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader:`
    uniform sampler2D tDiffuse; uniform float uWarm; uniform float uVig; uniform float uSat;
    varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      // 暖色偏移:抬红压蓝
      c.rgb += vec3(uWarm, uWarm * 0.45, -uWarm * 0.30) * 0.5;
      // 轻微提饱和
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSat);
      // 暗角
      vec2 q = vUv - 0.5;
      c.rgb *= 1.0 - uVig * dot(q, q) * 2.2;
      gl_FragColor = c;
    }`
});
composer.addPass(grade);
composer.addPass(new OutputPass());

// 调参用:控制台可 __fx.bloom.enabled=false / __fx.grade.uniforms.uWarm.value=0.1 等实时试效果
window.__fx = { composer, bloom, bokeh, grade, godrays, motes };

function resize(){
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w,h,false);
  camera.aspect = w/h; camera.fov = w/h < 0.85 ? 56 : 42;
  camera.updateProjectionMatrix();
  composer.setSize(w,h);
  bloom.setSize(w,h);
}
addEventListener('resize', resize); resize();

const clock = new THREE.Clock();
let frame = 0;
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  // static scene: only refresh the shadow map every few frames
  if (!MOBILE) renderer.shadowMap.needsUpdate = (frame++ % 4 === 0);
  if (free){
    controls.update();
  } else {
    if (AMBIENT){
      const a = t*0.045 + 0.6;
      wantPos.set(19 + Math.cos(a)*19, 4.5 + Math.sin(t*0.13)*2.2, -24 + Math.sin(a)*19);
      wantTgt.set(17, -1.5, -24);
    }
    if (!dragging){ offX *= 0.96; offY *= 0.96; }
    camPos.lerp(wantPos, 0.055); camTgt.lerp(wantTgt, 0.055);
    camera.position.set(camPos.x + offX + px*0.7, camPos.y + offY - py*0.4, camPos.z + Math.sin(t*0.3)*0.3);
    camera.lookAt(camTgt);
  }

  bounce *= 0.92; turnPop *= 0.955; wave *= 0.988;
  const facing = station === 'about';
  bruin.position.y = 0.55 + Math.sin(t*1.5)*0.03 + bounce*0.45 + turnPop*Math.abs(Math.sin(t*7))*0.28;
  const yawWant = facing ? FACE_CAM + Math.sin(t*0.6)*0.05 : Math.sin(t*0.35)*0.12;
  bruin.rotation.y += (yawWant - bruin.rotation.y)*0.07;
  bruin.rotation.z = facing ? Math.sin(t*1.1)*0.02 : 0;
  const hd = bruin.userData.head;
  hd.rotation.y += ((px*0.3) - hd.rotation.y)*0.05;
  hd.rotation.x += ((-py*0.16) - hd.rotation.x)*0.05;
  const blink = (Math.sin(t*0.85) > 0.994 || Math.sin(t*2.2+1) > 0.997) ? 0.1 : 1;
  eyes.forEach(e => e.scale.y += (blink - e.scale.y)*0.35);
  arms.forEach((a,i) => a.rotation.x = Math.sin(t*1.4 + i*Math.PI)*0.1);

  // 垂藤随风微摆
  for (const v of ISLAND_VINES){
    v.m.rotation.z = Math.sin(t*v.s + v.p)*0.13;
    v.m.rotation.x = Math.cos(t*v.s*0.8 + v.p)*0.09;
  }

  for (const d of drifters){
    d.m.position.y = d.y + Math.sin(t*d.s + d.m.position.x)*(d.cloud ? 0.5 : 0.8);
    if (!d.cloud) d.m.rotation.y += d.s*0.004;
    else d.m.position.x += d.s*0.012;
  }
  // 氛围层动画
  godrays.userData.mat.uniforms.uTime.value = t;
  motes.material.uniforms.uTime.value = t;
  godrays.rotation.y = Math.sin(t*0.03) * 0.06;

  // 景深焦点跟随相机到注视点的距离,保证主体始终清晰
  if (bokeh){
    const d = camera.position.distanceTo(free ? controls.target : camTgt);
    const u = bokeh.materialBokeh.uniforms;
    u.focus.value += (d - u.focus.value) * 0.05;
  }

  composer.render();
});
document.body.classList.add('ready');
