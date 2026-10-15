/* 文章页右下角看板娘:2D 正面熊,4 张表情帧(待机 / 眯眼笑 / 开心 / 害羞)叠放切换。
   与首页小屋同一套素材风格,不依赖 three.js。 */
const host = document.getElementById('mascot');
if (host) {
  const art = document.getElementById('art');
  const bubble = document.getElementById('m-say');
  const FACES = ['idle', 'blink', 'happy', 'shy'];

  const bear = document.createElement('div');
  bear.className = 'm-bear';
  bear.innerHTML = FACES.map(f =>
    `<img data-face="${f}" src="${new URL(`scene/mascot-${f}.webp`, import.meta.url).href}" alt="" draggable="false">`).join('');
  host.prepend(bear);

  /* ---------- 表情 ---------- */
  let face = 'idle', faceT = null;
  function setFace(f) {
    face = f;
    bear.querySelectorAll('img').forEach(img => img.classList.toggle('on', img.dataset.face === f));
  }
  // 临时换个表情,过一会儿回到待机
  function react(f, ms = 1800) {
    setFace(f);
    clearTimeout(faceT);
    faceT = setTimeout(() => setFace('idle'), ms);
  }
  setFace('idle');

  function hop() {
    bear.classList.remove('hop');
    void bear.offsetWidth;
    bear.classList.add('hop');
  }

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
  host.addEventListener('click', () => {
    hop();
    // 闭眼那张作为「眯眼笑」表情,和开心 / 害羞一起随机
    react(['happy', 'shy', 'blink'][Math.floor(Math.random() * 3)]);
    say(SAY_POKE[Math.floor(Math.random() * SAY_POKE.length)]);
  });

  /* ---------- 交互 2:阅读进度提示 ---------- */
  // 只在跨过阈值的那一刻提示一次,滚回去不重复触发
  const MARKS = [
    { at: 0.5,  text: '读一半啦' },
    { at: 0.95, text: '读完了,去看看别的?' },
  ];
  const fired = new Set();

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
        const progress = max > 0 ? art.scrollTop / max : 0;
        host.classList.toggle('scrolled', art.scrollTop > 260);
        for (const m of MARKS) {
          if (progress >= m.at && !fired.has(m.at)) { fired.add(m.at); say(m.text, 3200); hop(); react('happy', 2400); }
        }
      });
    }, { passive: true });
  }

  /* ---------- 跟随鼠标:身体朝鼠标方向轻歪 ---------- */
  addEventListener('pointermove', (e) => {
    const px = (e.clientX / innerWidth) * 2 - 1;
    bear.style.setProperty('--look', (px * 5).toFixed(2));
  }, { passive: true });
}
