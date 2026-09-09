import * as THREE from 'three';

/* 胖熊建模 —— 首页 3D 岛与文章页看板娘共用。
   参数化 shadow / 材质工厂,避免两处各写一份。 */
export const BEAR_COL = {
  fur:0x8f6446, furD:0x6d4830, cream:0xe8d5b4, ink:0x241b14, scarf:0xa66a3c,
};

// 返回 {group, head, eyes, arms}
export function buildBear({ SMOOTH, COL, shadow = true, laptop = true } = {}) {
  const bruin = new THREE.Group();
  const eyes = [], arms = [];
  const MOBILE = !shadow;
  const add = (m, p, parent = bruin) => { m.position.set(...p); m.castShadow = shadow; m.receiveShadow = shadow; parent.add(m); return m; };
  const ball=(r,m,s=24)=>add(new THREE.Mesh(new THREE.SphereGeometry(r,s,s), m),[0,0,0],bruin);
  const body = ball(1.5, SMOOTH(COL.fur)); body.scale.set(1.05,.92,.95); body.position.set(0,1.35,0);
  const belly = ball(1.1, SMOOTH(COL.cream)); belly.scale.set(1,.9,.7); belly.position.set(0,1.28,.75);
  const head = new THREE.Group(); head.position.set(0,3.1,.12); bruin.add(head); bruin.userData.head = head;
  const sk = new THREE.Mesh(new THREE.SphereGeometry(1.02,26,26), SMOOTH(COL.fur)); sk.castShadow=shadow; head.add(sk); sk.scale.set(1.08,1,.98);
  for (const s of [-1,1]){
    const ear = new THREE.Mesh(new THREE.SphereGeometry(.35,18,18), SMOOTH(COL.fur)); ear.position.set(.78*s,.74,-.1); ear.castShadow=shadow; head.add(ear);
    const inn = new THREE.Mesh(new THREE.SphereGeometry(.2,14,14), SMOOTH(COL.cream)); inn.position.set(.86*s,.76,.08); head.add(inn);
    const e = new THREE.Mesh(new THREE.SphereGeometry(.13,16,16), SMOOTH(COL.ink,.4)); e.position.set(.4*s,.16,.88); head.add(e); eyes.push(e);
    const gl = new THREE.Mesh(new THREE.SphereGeometry(.045,10,10), SMOOTH(0xffffff,.2)); gl.position.set(.44*s,.21,.99); head.add(gl);
  }
  const mz = new THREE.Mesh(new THREE.SphereGeometry(.5,20,20), SMOOTH(COL.cream)); mz.scale.set(1.1,.8,.85); mz.position.set(0,-.3,.78); head.add(mz);
  const ns = new THREE.Mesh(new THREE.SphereGeometry(.16,14,14), SMOOTH(COL.ink,.35)); ns.scale.set(1.3,.9,1); ns.position.set(0,-.16,1.18); head.add(ns);
  for (const s of [-1,1]){
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(.32,.5,6,16), SMOOTH(COL.fur));
    a.position.set(1.35*s,1.45,.3); a.rotation.z=.55*s; a.castShadow=shadow; bruin.add(a); arms.push(a);
    const p = new THREE.Mesh(new THREE.SphereGeometry(.3,16,16), SMOOTH(COL.furD)); p.position.set(1.62*s,1.0,.52); bruin.add(p);
    const l = new THREE.Mesh(new THREE.SphereGeometry(.45,18,18), SMOOTH(COL.fur)); l.scale.set(1,.8,1.25); l.position.set(.7*s,.15,.5); l.castShadow=shadow; bruin.add(l);
    const pd = new THREE.Mesh(new THREE.SphereGeometry(.24,14,14), SMOOTH(COL.cream)); pd.scale.set(1,.6,.8); pd.position.set(.7*s,.14,1.0); bruin.add(pd);
  }
  const sc = new THREE.Mesh(new THREE.TorusGeometry(.9,.19,10,32), SMOOTH(COL.scarf)); sc.position.set(0,2.2,.06); sc.rotation.x=Math.PI/2-.12; sc.castShadow=shadow; bruin.add(sc);
  // laptop on lap(看板娘只要上半身,可关掉)
  if (laptop) {
  const lap = new THREE.Group(); lap.position.set(0,1.15,1.5); lap.rotation.x=-.18; bruin.add(lap);
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.1,.08,.75), SMOOTH(0x5c6b6a,.6)); base.castShadow=shadow; lap.add(base);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.1,.72,.07), SMOOTH(0x4c5b5a,.5)); lid.position.set(0,.36,-.36); lid.rotation.x=-.28; lap.add(lid);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(.95,.58), new THREE.MeshBasicMaterial({color:0x9fd8c8})); scr.position.set(0,.36,-.31); scr.rotation.x=-.28; lap.add(scr);
  }
  return { group: bruin, head: bruin.userData.head, eyes, arms };
}
