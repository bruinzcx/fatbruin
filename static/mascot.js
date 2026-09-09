import * as THREE from 'three';
import { buildBear } from './bear.js';

/* 文章页右下角看板娘:复用首页那只熊的建模,只渲染上半身。
   独立的小 WebGL 画布,不与背景场景共享 renderer。 */
const host = document.getElementById('mascot');
if (host) {
  const art = document.getElementById('art');
  const bubble = document.getElementById('m-say');
  const W = 150, H = 170;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 60);
  camera.position.set(0, 2.9, 11.6);
  camera.lookAt(0, 1.75, 0);

  scene.add(new THREE.HemisphereLight(0xdbeef4, 0x54401f, 1.15));
  const key = new THREE.DirectionalLight(0xffe4b5, 2.5); key.position.set(4, 7, 8); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffcf94, 0.8);  rim.position.set(-5, 3, 4);  scene.add(rim);

  // 与 island.js 同款材质,保证风格一致
  const _mc = new Map();
  const SMOOTH = (c, r = 0.9) => {
    const k = c + '|' + r;
    if (!_mc.has(k)) _mc.set(k, new THREE.MeshPhysicalMaterial({
      color: c, roughness: r, metalness: 0,
      sheen: 0.7, sheenRoughness: 0.85, sheenColor: new THREE.Color(0xffdcb0),
    }));
    return _mc.get(k);
  };
  const COL = { fur:0x8f6446, furD:0x6d4830, cream:0xe8d5b4, ink:0x241b14, scarf:0xa66a3c };

  const { group: bear, head, eyes, arms } = buildBear({ SMOOTH, COL, shadow: false, laptop: false });
  bear.position.y = -0.15;
  scene.add(bear);

  /* ---------- 说话 ---------- */
  const SAY_POKE = ['唔……', '别戳了,痒。', '在看什么?', '这段我也没看懂', '喝口水吧', '蜂蜜在哪里'];
  let sayT = null;
  function say(text, ms = 2600) {
    if (!bubble) return;
    bubble.textContent = text;
    bubble.classList.add('on');
    clearTimeout(sayT);
    sayT = setTimeout(() => bubble.classList.remove('on'), ms);
  }

  /* ---------- 交互 1:点击说话 ---------- */
  let bounce = 0;
  host.addEventListener('click', () => {
    bounce = 1;
    say(SAY_POKE[Math.floor(Math.random() * SAY_POKE.length)]);
  });

  /* ---------- 交互 2:阅读进度提示 ---------- */
  // 只在跨过阈值的那一刻提示一次,滚回去不重复触发
  const MARKS = [
    { at: 0.5,  text: '读一半啦' },
    { at: 0.95, text: '读完了,去看看别的?' },
  ];
  const fired = new Set();
  let progress = 0;

  /* ---------- 交互 3:回到顶部 ---------- */
  const topBtn = document.getElementById('m-top');
  topBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    art?.scrollTo({ top: 0, behavior: 'smooth' });
    say('回到开头 ↑', 1600);
  });

  if (art) {
    let tick = false;
    art.addEventListener('scroll', () => {
      if (tick) return;
      tick = true;
      requestAnimationFrame(() => {
        tick = false;
        const max = art.scrollHeight - art.clientHeight;
        progress = max > 0 ? art.scrollTop / max : 0;
        host.classList.toggle('scrolled', art.scrollTop > 260);
        for (const m of MARKS) {
          if (progress >= m.at && !fired.has(m.at)) { fired.add(m.at); say(m.text, 3200); bounce = 1; }
        }
      });
    }, { passive: true });
  }

  /* ---------- 跟随鼠标 + 动画 ---------- */
  let px = 0, py = 0;
  addEventListener('pointermove', (e) => {
    px = (e.clientX / innerWidth) * 2 - 1;
    py = -((e.clientY / innerHeight) * 2 - 1);
  }, { passive: true });

  const clock = new THREE.Clock();
  let visible = true;
  // 页面不可见时停渲染,别白烧 GPU
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; }, { threshold: 0 }).observe(host);
  addEventListener('visibilitychange', () => { if (document.hidden) visible = false; });

  renderer.setAnimationLoop(() => {
    if (!visible || document.hidden) return;
    const t = clock.getElapsedTime();
    bounce *= 0.92;

    bear.position.y = -0.15 + Math.sin(t * 1.5) * 0.035 + bounce * 0.30;
    bear.rotation.y = Math.sin(t * 0.4) * 0.10 + px * 0.22;
    bear.rotation.z = Math.sin(t * 0.9) * 0.015;

    head.rotation.y += (px * 0.38 - head.rotation.y) * 0.06;
    head.rotation.x += (-py * 0.20 - head.rotation.x) * 0.06;

    const blink = (Math.sin(t * 0.85) > 0.993 || Math.sin(t * 2.2 + 1) > 0.996) ? 0.1 : 1;
    eyes.forEach((e) => { e.scale.y += (blink - e.scale.y) * 0.35; });
    arms.forEach((a, i) => { a.rotation.x = Math.sin(t * 1.4 + i * Math.PI) * 0.12; });

    renderer.render(scene, camera);
  });
}
