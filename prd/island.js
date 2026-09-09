import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

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
function island(cx, cy, cz, radius, opts={}){
  const g = new THREE.Group();
  g.position.set(cx, cy, cz);
  scene.add(g);
  const top = add(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius*0.94, 1.1, opts.sides||9), M(COL.grass)), [0,0,0], g);
  top.rotation.y = R()*3;
  add(new THREE.Mesh(new THREE.ConeGeometry(radius*0.94, radius*1.9, opts.sides||9), M(COL.soil)), [0,-radius*0.95-0.55,0], g).rotation.y = top.rotation.y;
  add(new THREE.Mesh(new THREE.ConeGeometry(radius*0.5, radius*1.2, 7), M(COL.rock)), [radius*0.2,-radius*1.9,radius*0.1], g);
  const n = opts.rocks ?? 4;
  for (let i=0;i<n;i++){
    const a = R()*6.28, d = radius*(0.35+R()*0.55), s = 0.25+R()*0.5;
    add(new THREE.Mesh(new THREE.DodecahedronGeometry(s,0), M(COL.rock)), [Math.cos(a)*d, 0.4, Math.sin(a)*d], g).rotation.set(R(),R(),R());
  }
  for (let i=0;i<(opts.tufts??10);i++){
    const a = R()*6.28, d = radius*(0.2+R()*0.75);
    const t = add(new THREE.Mesh(new THREE.ConeGeometry(0.22,0.55,4), M(COL.grassD)), [Math.cos(a)*d,0.7,Math.sin(a)*d], g);
    t.rotation.y = R()*3;
  }
  return g;
}
function tree(parent, x, z, h=1, cool=false){
  const g = new THREE.Group(); g.position.set(x, 0.5, z); parent.add(g);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.16*h,0.24*h,1.5*h,6), M(COL.bark)), [0,0.75*h,0], g);
  const cols = cool ? [COL.leafB, COL.leafA] : [COL.leafA, COL.leafC];
  add(new THREE.Mesh(new THREE.ConeGeometry(1.0*h,1.7*h,7), M(cols[0])), [0,1.9*h,0], g);
  add(new THREE.Mesh(new THREE.ConeGeometry(0.75*h,1.4*h,7), M(cols[1])), [0,2.8*h,0], g);
  g.rotation.y = R()*3;
  return g;
}

/* ---------- island A : the bear ---------- */
const A = island(0,0,0, 6.2, {rocks:5, tufts:14});
tree(A, -3.6, -2.2, 1.25); tree(A, -4.4, 1.6, 0.9); tree(A, 3.9, -3.0, 1.05);

const bruin = new THREE.Group();
bruin.position.set(0.6, 0.55, 1.4);
bruin.scale.setScalar(0.62);
A.add(bruin);
const eyes = [], arms = [];
{
  const ball=(r,m,s=24)=>add(new THREE.Mesh(new THREE.SphereGeometry(r,s,s), m),[0,0,0],bruin);
  const body = ball(1.5, SMOOTH(COL.fur)); body.scale.set(1.05,.92,.95); body.position.set(0,1.35,0);
  const belly = ball(1.1, SMOOTH(COL.cream)); belly.scale.set(1,.9,.7); belly.position.set(0,1.28,.75);
  const head = new THREE.Group(); head.position.set(0,3.1,.12); bruin.add(head); bruin.userData.head = head;
  const sk = new THREE.Mesh(new THREE.SphereGeometry(1.02,26,26), SMOOTH(COL.fur)); sk.castShadow=!MOBILE; head.add(sk); sk.scale.set(1.08,1,.98);
  for (const s of [-1,1]){
    const ear = new THREE.Mesh(new THREE.SphereGeometry(.35,18,18), SMOOTH(COL.fur)); ear.position.set(.78*s,.74,-.1); ear.castShadow=!MOBILE; head.add(ear);
    const inn = new THREE.Mesh(new THREE.SphereGeometry(.2,14,14), SMOOTH(COL.cream)); inn.position.set(.86*s,.76,.08); head.add(inn);
    const e = new THREE.Mesh(new THREE.SphereGeometry(.13,16,16), SMOOTH(COL.ink,.4)); e.position.set(.4*s,.16,.88); head.add(e); eyes.push(e);
    const gl = new THREE.Mesh(new THREE.SphereGeometry(.045,10,10), SMOOTH(0xffffff,.2)); gl.position.set(.44*s,.21,.99); head.add(gl);
  }
  const mz = new THREE.Mesh(new THREE.SphereGeometry(.5,20,20), SMOOTH(COL.cream)); mz.scale.set(1.1,.8,.85); mz.position.set(0,-.3,.78); head.add(mz);
  const ns = new THREE.Mesh(new THREE.SphereGeometry(.16,14,14), SMOOTH(COL.ink,.35)); ns.scale.set(1.3,.9,1); ns.position.set(0,-.16,1.18); head.add(ns);
  for (const s of [-1,1]){
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(.32,.5,6,16), SMOOTH(COL.fur));
    a.position.set(1.35*s,1.45,.3); a.rotation.z=.55*s; a.castShadow=!MOBILE; bruin.add(a); arms.push(a);
    const p = new THREE.Mesh(new THREE.SphereGeometry(.3,16,16), SMOOTH(COL.furD)); p.position.set(1.62*s,1.0,.52); bruin.add(p);
    const l = new THREE.Mesh(new THREE.SphereGeometry(.45,18,18), SMOOTH(COL.fur)); l.scale.set(1,.8,1.25); l.position.set(.7*s,.15,.5); l.castShadow=!MOBILE; bruin.add(l);
    const pd = new THREE.Mesh(new THREE.SphereGeometry(.24,14,14), SMOOTH(COL.cream)); pd.scale.set(1,.6,.8); pd.position.set(.7*s,.14,1.0); bruin.add(pd);
  }
  const sc = new THREE.Mesh(new THREE.TorusGeometry(.9,.19,10,32), SMOOTH(COL.scarf)); sc.position.set(0,2.2,.06); sc.rotation.x=Math.PI/2-.12; sc.castShadow=!MOBILE; bruin.add(sc);
  // laptop on lap
  const lap = new THREE.Group(); lap.position.set(0,1.15,1.5); lap.rotation.x=-.18; bruin.add(lap);
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.1,.08,.75), SMOOTH(0x5c6b6a,.6)); base.castShadow=!MOBILE; lap.add(base);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.1,.72,.07), SMOOTH(0x4c5b5a,.5)); lid.position.set(0,.36,-.36); lid.rotation.x=-.28; lap.add(lid);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(.95,.58), new THREE.MeshBasicMaterial({color:0x9fd8c8})); scr.position.set(0,.36,-.31); scr.rotation.x=-.28; lap.add(scr);
}

/* ---------- island B : writing hut ---------- */
const B = island(19,-3.5,-24, 5.4, {rocks:3, tufts:10, sides:8});
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
const C = island(-9,3,-50, 5.8, {rocks:4, tufts:12, sides:10});
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

function resize(){
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w,h,false);
  camera.aspect = w/h; camera.fov = w/h < 0.85 ? 56 : 42;
  camera.updateProjectionMatrix();
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

  for (const d of drifters){
    d.m.position.y = d.y + Math.sin(t*d.s + d.m.position.x)*(d.cloud ? 0.5 : 0.8);
    if (!d.cloud) d.m.rotation.y += d.s*0.004;
    else d.m.position.x += d.s*0.012;
  }
  renderer.render(scene, camera);
});
document.body.classList.add('ready');
