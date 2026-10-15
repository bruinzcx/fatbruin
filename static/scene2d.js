/* 2D 小屋场景:一张等距房间插画 + 代码层氛围动效(窗光浮尘 / 台灯 / 屏幕 / 热气 / 熊)。
   首页:单屏房间,点物件 / 导航(URL hash)时镜头推近该物件、右侧抽屉滑出;其他页面:只做背景,随鼠标轻微视差。
   坐标全部用插画的百分比,换图时只需改 ROOM 与各物件位置。 */
const host = document.getElementById('scene');
const MOBILE = matchMedia('(max-width:820px)').matches;
const asset = f => new URL('scene/' + f, import.meta.url).href;
const ROOM = { w: 2752, h: 1536, src: asset(MOBILE ? 'room-sm.webp' : 'room.webp'), night: asset(MOBILE ? 'room-night-sm.webp' : 'room-night.webp') };

// 物件位置:[left, top, width, height],单位为插画宽/高的百分比
// 熊单独一层;椅背从底图裁出叠在熊上面,保持「熊坐在椅子里」的遮挡关系
const BEAR = [40.916, 39.453, 8.757, 22.461]; // 身体与头共用此画框
const CHAIR = [47.057, 50.065, 4.070, 12.630];
// 软木板:整块裁成一张图,每张便签用多边形裁出,绕图钉轻摆;下面垫软木色,摆动时不露原图重影
// 坐标为相对 CORK 画框的百分比:[多边形, 图钉]
const CORK = [37.972, 18.555, 9.448, 19.531];
const NOTES = [
  [[77.8, 9.8, 94.3, 2.5, 96.3, 21.5, 79.8, 28.8], [87.3, 7.0]],
  [[44.9, 23.8, 62.0, 18.5, 62.5, 38.8, 45.7, 44.2], [54.2, 21.9]],
  [[25.2, 28.5, 41.0, 24.5, 43.3, 44.2, 27.5, 47.5], [33.9, 29.9]],
  [[2.6, 41.2, 19.9, 34.8, 21.3, 55.2, 4.7, 61.6], [12.2, 39.5]],
  [[61.0, 36.1, 77.1, 34.8, 77.1, 53.5, 61.7, 54.8], [70.1, 39.3]],
  [[79.5, 33.8, 94.5, 29.4, 97.4, 46.2, 81.7, 52.2], [88.1, 35.3]],
  [[24.4, 55.2, 41.3, 50.2, 42.5, 70.8, 25.7, 77.1], [33.9, 54.6]],
  [[44.1, 66.5, 59.4, 61.2, 62.8, 78.2, 47.2, 84.2], [53.0, 65.7]],
  [[4.7, 80.5, 20.2, 75.4, 21.7, 92.8, 6.3, 98.2], [13.9, 79.9]],
];
const clip = poly => `clip-path:polygon(${poly.reduce((a, v, i) => i % 2 ? a : [...a, `${v}% ${poly[i + 1]}%`], []).join(',')})`;
const HOTSPOTS = [
  { box: [31, 39.4, 19.5, 28.7], href: '#about',    label: '关于' },
  { box: [52, 22.4, 12.8, 38.5], href: '#writing',  label: '文章' },
  { box: [37, 15.7, 10.9, 25],   href: '#timeline', label: '经历' },
  { box: [67, 31, 10, 41],       href: '#contact',  label: '联系' },
  { box: [27.5, 28.5, 7, 22],    href: '#',         label: '晨昏', toggle: true },
];
// 镜头站点:u/v 为插画上的注视点,x/y 为它落在屏幕上的位置,z 为相对铺满屏幕的缩放
// 弹窗居中,物件也居中并适度推近,让它从弹窗四周露出来
const POSE = {
  hero:     { u: .50,  v: .52, z: .80, x: .66, y: .52 },
  about:    { u: .44,  v: .52, z: 1.5, x: .50, y: .52 },
  writing:  { u: .585, v: .42, z: 1.5, x: .50, y: .50 },
  timeline: { u: .425, v: .28, z: 1.6, x: .50, y: .48 },
  contact:  { u: .74,  v: .50, z: 1.5, x: .50, y: .50 },
};
const AMBIENT_POSE = { u: .5, v: .5, z: 1, x: .5, y: .5 };

const pct = ([l, t, w, h]) => `left:${l}%;top:${t}%;width:${w}%;height:${h}%`;
const stations = [...document.querySelectorAll('[data-station]')];
const AMBIENT = stations.length === 0;

/* ---------- DOM ---------- */
const layer = document.createElement('div');
layer.className = 'room';
layer.style.width = ROOM.w + 'px';
layer.style.height = ROOM.h + 'px';
const dust = Array.from({ length: 16 }, (_, i) =>
  `<i style="left:${(i * 37) % 100}%;top:${(i * 53) % 100}%;animation-delay:${-(i * 1.7) % 12}s;animation-duration:${9 + (i % 5) * 2}s"></i>`).join('');
layer.innerHTML =
  `<img class="room-img" src="${ROOM.src}" alt="" draggable="false">` +
  `<img class="room-img room-night" alt="" draggable="false">` +
  `<div class="fx fx-beam" style="${pct([24, 30, 22, 46])}"><span class="fx-dust">${dust}</span></div>` +
  `<div class="fx fx-glow fx-lamp" style="${pct([29.5, 39, 9.5, 15])}"></div>` +
  `<div class="fx fx-glow fx-screen" style="${pct([36.6, 41.5, 6, 8])}"></div>` +
  `<div class="fx fx-steam" style="${pct([36.8, 45.5, 1.8, 5])}"><i></i><i></i><i></i></div>` +
  `<div class="bear" style="${pct(BEAR)}"><img src="${asset('bear-body.webp')}" alt="" draggable="false">` +
  `<img class="bear-head" src="${asset('bear-head.webp')}" alt="" draggable="false"></div>` +
  `<img class="chair" src="${asset('chair.webp')}" alt="" draggable="false" style="${pct(CHAIR)}">` +
  `<img class="chair chair-night" alt="" draggable="false" style="${pct(CHAIR)}">` +
  (AMBIENT ? '' : `<div class="cork" style="${pct(CORK)}">` + NOTES.map(([poly, pin]) =>
    `<i class="cork-patch" style="${clip(poly)}"></i>` +
    `<div class="note" style="${clip(poly)};transform-origin:${pin[0]}% ${pin[1]}%">` +
    `<img src="${asset('cork.webp')}" alt="" draggable="false"><img class="n-night" src="${asset('cork-night.webp')}" alt="" draggable="false"></div>`).join('') + '</div>') +
  (AMBIENT ? '' : HOTSPOTS.map(h => `<a class="hs${h.toggle ? ' hs-toggle' : ''}" href="${h.href}" style="${pct(h.box)}"><i class="dot"></i><span>${h.label}</span></a>`).join(''));
host.appendChild(layer);
const bearEl = layer.querySelector('.bear');
const headEl = layer.querySelector('.bear-head');

/* ---------- camera ---------- */
const lerpPose = (a, b, t) => Object.fromEntries(Object.keys(a).map(k => [k, a[k] + (b[k] - a[k]) * t]));
// 手机首页:按实际布局把整间房放进导航栏与标题区之间的空档,不与两者重叠
// .56 / .92 为房间在插画中所占的宽 / 高比例
// 用 offsetTop / offsetHeight 取布局位置,不受标题区淡入淡出 transform 的影响
function mobileHome(p) {
  const top = document.querySelector('nav').offsetHeight;
  const gap = Math.max(document.getElementById('hero').offsetTop - top, 80);
  const base = Math.max(innerWidth / ROOM.w, innerHeight / ROOM.h);
  const s = Math.min((innerWidth - 40) / (ROOM.w * .56), (gap - 32) / (ROOM.h * .92));
  return { ...p, u: .5, v: .5, x: .5, y: (top + gap / 2) / innerHeight, z: s / base };
}
const forScreen = (p, open) => !MOBILE ? p
  : open || AMBIENT ? { ...p, x: .5, y: open ? .45 : .3, z: p.z * .55 } : mobileHome(p);
let want = forScreen(AMBIENT ? AMBIENT_POSE : POSE.hero), cur = { ...want };
let station = 'hero';

function route() {
  if (AMBIENT) return;
  const name = location.hash.slice(1);
  const next = POSE[name] && name !== 'hero' ? name : 'hero';
  want = forScreen(POSE[next], next !== 'hero');
  stations.forEach(el => el.classList.toggle('on', el.dataset.station === next && next !== 'hero'));
  document.body.classList.toggle('open', next !== 'hero');
  document.querySelectorAll('nav a').forEach(l => l.classList.toggle('cur', (l.hash.slice(1) || 'hero') === next));
  if (next !== station && next === 'about') hop();
  if (next !== 'hero') bubble?.classList.remove('on');
  station = next;
}
const goHome = () => { if (station !== 'hero') location.hash = ''; };
addEventListener('hashchange', route);
addEventListener('keydown', e => { if (e.key === 'Escape') goHome(); });
// 点房间空白处收起抽屉
host.addEventListener('click', e => { if (!e.target.closest('.hs')) goHome(); });

let px = 0, py = 0;
addEventListener('pointermove', e => {
  px = e.clientX / innerWidth * 2 - 1;
  py = e.clientY / innerHeight * 2 - 1;
}, { passive: true });

function frame(ms) {
  const t = ms / 1000;
  const target = AMBIENT ? { ...want, u: want.u + Math.sin(t * 0.05) * 0.01 } : want;
  cur = lerpPose(cur, target, 0.08);
  const vw = innerWidth, vh = innerHeight;
  const s = Math.max(vw / ROOM.w, vh / ROOM.h) * cur.z;
  const x = cur.x * vw - cur.u * ROOM.w * s - px * 10;
  const y = cur.y * vh - cur.v * ROOM.h * s - py * 7;
  layer.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${s.toFixed(4)})`;
  headEl.style.setProperty('--look', (px * 4).toFixed(2)); // 头随鼠标左右轻歪
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---------- 熊:戳一下 ---------- */
const bubble = document.getElementById('bearsay');
const SAY = ['唔……', '别戳了,痒。', '今天也没有减肥。', 'Hi there 👋', '编译中,请稍候', '蜂蜜在哪里', '代码写完再理你'];
let sayT;
function hop() {
  bearEl.classList.remove('hop');
  void bearEl.offsetWidth;
  bearEl.classList.add('hop');
}
function say(text, ms = 2200) {
  if (!bubble) return;
  bubble.textContent = text;
  bubble.classList.add('on');
  clearTimeout(sayT); sayT = setTimeout(() => bubble.classList.remove('on'), ms);
}
function poke() {
  hop();
  headEl.classList.remove('shake'); void headEl.offsetWidth; headEl.classList.add('shake');
  say(SAY[Math.floor(Math.random() * SAY.length)]);
}
document.getElementById('poke')?.addEventListener('click', poke);
layer.querySelector('.hs[href="#about"]')?.addEventListener('click', poke);

/* ---------- 昼夜:默认按本地时间,点窗户切换并记住选择 ---------- */
const NIGHT_KEY = 'fatbruin-night';
const nightImgs = [[layer.querySelector('.room-night'), ROOM.night], [layer.querySelector('.chair-night'), asset('chair-night.webp')]];
async function setNight(on, animate) {
  if (on) {
    // 夜景图首次用到时才加载,解码完再淡入,避免闪一下
    await Promise.all(nightImgs.map(([el, src]) => {
      if (!el.src) el.src = src;
      return el.decode ? el.decode().catch(() => {}) : null;
    }));
  }
  const root = document.documentElement;
  if (animate) { root.classList.add('theme-anim'); setTimeout(() => root.classList.remove('theme-anim'), 1300); }
  root.classList.toggle('night', on);
}
// 初始晨昏已由页面开头的内联脚本写到 html.night,这里只负责补加载夜景图
setNight(document.documentElement.classList.contains('night'));
layer.querySelector('.hs-toggle')?.addEventListener('click', e => {
  e.preventDefault();
  const on = !document.documentElement.classList.contains('night');
  try { localStorage.setItem(NIGHT_KEY, on ? '1' : '0'); } catch {}
  setNight(on, true);
});

route();
// 手机首页的房间位置依赖导航和标题区的实际尺寸,字体加载完、窗口变化后重新计算
addEventListener('resize', route);
document.fonts?.ready.then(route);
if (MOBILE && !AMBIENT) new ResizeObserver(route).observe(document.getElementById('hero'));

// 鼠标扫过软木板:碰到哪张便签,哪张就顺着鼠标方向轻摆一次
const inPoly = (x, y, p) => {
  let c = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2)
    if ((p[i + 1] > y) !== (p[j + 1] > y) && x < (p[j] - p[i]) * (y - p[i + 1]) / (p[j + 1] - p[i + 1]) + p[i]) c = !c;
  return c;
};
const noteEls = [...layer.querySelectorAll('.note')];
noteEls.forEach(el => el.addEventListener('animationend', () => el.classList.remove('flick')));
layer.querySelector('.hs[href="#timeline"]')?.addEventListener('pointermove', e => {
  const r = layer.querySelector('.cork').getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * 100, y = (e.clientY - r.top) / r.height * 100;
  NOTES.forEach(([poly], i) => {
    const el = noteEls[i];
    if (el.classList.contains('flick') || !inPoly(x, y, poly)) return;
    el.style.setProperty('--dir', e.movementX < 0 ? -1 : 1);
    el.classList.add('flick');
  });
});

// 第一次来:熊提示房间里的东西可以点
if (!AMBIENT) {
  let seen = null;
  try { seen = localStorage.getItem('fatbruin-hint'); } catch {}
  if (!seen) {
    setTimeout(() => station === 'hero' && say('点点房间里的东西吧 ✨', 3800), 1400);
    try { localStorage.setItem('fatbruin-hint', '1'); } catch {}
  }
}

const img = layer.querySelector('.room-img');
(img.decode ? img.decode() : Promise.resolve()).catch(() => {}).finally(() => document.body.classList.add('ready'));
