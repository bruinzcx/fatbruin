import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import hljs from 'highlight.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIRS = {
  posts: path.join(ROOT, 'posts'),
  templates: path.join(ROOT, 'templates'),
  static: path.join(ROOT, 'static'),
  dist: path.join(ROOT, 'dist'),
};

// --base /sub/ 用于子路径部署(如 GitHub Pages 项目站)。默认 / 即根部署。
const BASE = (() => {
  const i = process.argv.indexOf('--base');
  let b = i > -1 ? process.argv[i + 1] : (process.env.BASE_PATH || '/');
  if (!b || b === '/') return '/';
  if (!b.startsWith('/')) b = '/' + b;
  if (!b.endsWith('/')) b += '/';
  return b;
})();
// 拼接站内绝对路径:u('posts/x/') → '/posts/x/' 或 '/sub/posts/x/'
const u = (rel) => BASE + String(rel).replace(/^\/+/, '');

// RSS / sitemap 需要完整 URL。用 --site 或 SITE_URL 指定,未配置则跳过生成这两个文件。
const SITE = (() => {
  const i = process.argv.indexOf('--site');
  const v = (i > -1 ? process.argv[i + 1] : process.env.SITE_URL) || '';
  return v.replace(/\/+$/, '');
})();
// 站内绝对路径 → 完整 URL
const abs = (rel) => SITE + u(rel);

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      } catch {}
    }
    return '';
  },
}).use(anchor, {
  level: [2, 3],
  permalink: anchor.permalink.linkInsideHeader({ symbol: '#', class: 'anchor', placement: 'after' }),
});

// 代码块包一层容器,右上角放复制按钮(按钮本身不进 RSS 正文影响不大,阅读器会忽略)
const _fence = md.renderer.rules.fence.bind(md.renderer.rules);
md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
  const out = _fence(tokens, idx, opts, env, self);
  const lang = (tokens[idx].info || '').trim().split(/\s+/)[0];
  return (
    '<div class="cb">' +
    (lang ? `<span class="cb-l">${esc(lang)}</span>` : '') +
    '<button class="cb-c" type="button" aria-label="复制代码">复制</button>' +
    out +
    '</div>'
  );
};

// 表格套一层 .tw 容器,窄屏可横向滚动而不撑破页面
md.renderer.rules.table_open = () => '<div class="tw"><table>';
md.renderer.rules.table_close = () => '</table></div>';

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// --- frontmatter ---------------------------------------------------------
function parseFrontmatter(raw, file) {
  const m = raw.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) throw new Error(`${file}: 缺少 frontmatter(文件需以 --- 开头)`);
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    meta[kv[1]] = v;
  }
  return { meta, body: raw.slice(m[0].length) };
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^\w一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'post';
}

// 中文按字符、西文按词估算,300 字/分钟
function readingTime(text) {
  const cjk = (text.match(/[一-龥]/g) || []).length;
  const words = (text.replace(/[一-龥]/g, ' ').match(/[A-Za-z0-9]+/g) || []).length;
  return `${Math.max(1, Math.round((cjk + words) / 300))} 分钟`;
}

// --- 收集文章 -------------------------------------------------------------
function loadPosts() {
  if (!fs.existsSync(DIRS.posts)) return [];
  const files = fs.readdirSync(DIRS.posts).filter((f) => f.endsWith('.md') && !f.startsWith('_'));
  const posts = [];
  const seen = new Map();

  for (const file of files) {
    const full = path.join(DIRS.posts, file);
    const { meta, body } = parseFrontmatter(fs.readFileSync(full, 'utf8'), file);
    if (meta.draft === 'true') continue;
    if (!meta.title) throw new Error(`${file}: frontmatter 缺少 title`);

    const slug = meta.slug || slugify(file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}(-\d{2})?-/, ''));
    if (seen.has(slug)) throw new Error(`slug 冲突: "${slug}" 同时来自 ${seen.get(slug)} 和 ${file}`);
    seen.set(slug, file);

    posts.push({
      file,
      slug,
      title: meta.title,
      date: meta.date || '',
      group: meta.group || '',
      read: meta.read || readingTime(body),
      summary: meta.summary || '',
      html: md.render(body),
      sortKey: meta.date || file,
    });
  }
  // 新 → 旧
  posts.sort((a, b) => String(b.sortKey).localeCompare(String(a.sortKey)));
  return posts;
}

// --- 渲染 -----------------------------------------------------------------
const tpl = (name) => fs.readFileSync(path.join(DIRS.templates, name), 'utf8');
const fill = (t, vars) => t.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : ''));

function renderIndex(posts, template, css = {}) {
  const list = posts
    .slice(0, 4) // 首页只放最新 4 篇,其余走「全部文章」
    .map(
      (p) =>
        `<a class="post" href="${u(`posts/${p.slug}/`)}">` +
        `<span class="p-meta"><span>${esc(p.date)}</span><span>${esc(p.group)}</span></span>` +
        `<p class="p-title">${esc(p.title)}</p>` +
        `<p class="p-sum">${esc(p.summary)}</p></a>`
    )
    .join('');
  return fill(template, { POSTS: list, BASE, CSS_BASE: css.base || '', CSS_POST: css.post || '' });
}

function renderPost(post, prev, next, template, css = {}) {
  const card = (d, side, label) => {
    const fallback = side === 'r' ? '到底了' : '已是最新';
    return d
      ? `<a class="${side}" href="${u(`posts/${d.slug}/`)}"><small>${label}</small><b>${esc(d.title)}</b></a>`
      : `<span class="${side}"><small>${label}</small><b>${fallback}</b></span>`;
  };
  const article =
    `<p class="meta"><span>${esc(post.date)}</span><span>${esc(post.group)}</span><span>${esc(post.read)}</span></p>` +
    `<h1>${esc(post.title)}</h1>` +
    (post.summary ? `<p class="sum">${esc(post.summary)}</p>` : '') +
    post.html +
    `<div class="pnav">${card(prev, 'l', '上一篇')}${card(next, 'r', '下一篇')}</div>`;

  return fill(template, {
    BASE,
    CSS_BASE: css.base || '',
    CSS_POST: css.post || '',
    TOC: buildToc(post.html),
    NOTOC: buildToc(post.html) ? '' : ' no-toc',
    TITLE: esc(post.title),
    SUMMARY: esc(post.summary),
    ARTICLE: article,
    NAV_JSON: JSON.stringify({
      prev: prev ? u(`posts/${prev.slug}/`) : null,
      next: next ? u(`posts/${next.slug}/`) : null,
    }),
  });
}

// 从渲染后的 HTML 抽取 H2/H3 生成侧边大纲(id 由 markdown-it-anchor 生成)
function buildToc(html) {
  const items = [];
  const re = /<h([23])[^>]*\sid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g;
  let m;
  while ((m = re.exec(html))) {
    // 去掉标题里的锚点链接和其他标签,只留纯文本
    const text = m[3].replace(/<a\b[^>]*class="anchor"[\s\S]*?<\/a>/g, '').replace(/<[^>]+>/g, '').trim();
    if (text) items.push({ level: +m[1], id: m[2], text });
  }
  if (items.length < 2) return '';   // 少于两条不值得占空间
  return (
    '<nav class="toc" aria-label="目录"><p class="toc-h">目录</p><ol>' +
    items
      .map((it) => `<li class="l${it.level}"><a href="#${it.id}">${esc(it.text)}</a></li>`)
      .join('') +
    `</ol><a class="toc-all" href="${u('posts/')}">全部文章 →</a></nav>`
  );
}

// 全部文章索引页:按年份分组
function renderArchive(posts, template, css = {}) {
  const groups = new Map();
  for (const p of posts) {
    const year = (String(p.date).match(/\d{4}/) || ['其他'])[0];
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push(p);
  }
  const body = [...groups.entries()]
    .map(([year, list]) =>
      `<section class="yr"><h2 class="yr-h">${esc(year)}<span>${list.length} 篇</span></h2><ul class="arc">` +
      list
        .map(
          (p) =>
            `<li><a href="${u(`posts/${p.slug}/`)}">` +
            `<span class="a-d">${esc(p.date)}</span>` +
            `<span class="a-t">${esc(p.title)}</span>` +
            `<span class="a-g">${esc(p.group)}</span></a></li>`
        )
        .join('') +
      '</ul></section>'
    )
    .join('');

  return fill(template, {
    BASE,
    CSS_BASE: css.base || '',
    CSS_POST: css.post || '',
    COUNT: String(posts.length),
    ARCHIVE: body,
  });
}

// --- RSS / sitemap / robots ------------------------------------------------
// date 形如 2026.08,取月首作为发布时间;同月多篇按列表顺序错开,保证 feed 排序稳定
function pubDate(post, idx) {
  const m = String(post.date).match(/(\d{4})[.\-\/]?(\d{1,2})?[.\-\/]?(\d{1,2})?/);
  const d = m
    ? new Date(Date.UTC(+m[1], (+m[2] || 1) - 1, +m[3] || 1, 12, 0, Math.max(0, 59 - idx)))
    : new Date(Date.UTC(1970, 0, 1));
  return d;
}

function writeFeeds(posts) {
  if (!SITE) return [];
  const written = [];
  const xe = (s) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
             .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  // RSS 2.0
  const items = posts
    .map((p, i) => {
      const link = abs(`posts/${p.slug}/`);
      return (
        '<item>' +
        `<title>${xe(p.title)}</title>` +
        `<link>${xe(link)}</link>` +
        `<guid isPermaLink="true">${xe(link)}</guid>` +
        `<pubDate>${pubDate(p, i).toUTCString()}</pubDate>` +
        (p.group ? `<category>${xe(p.group)}</category>` : '') +
        `<description>${xe(p.summary)}</description>` +
        // 全文内容,RSS 阅读器可直接读完
        `<content:encoded><![CDATA[${p.html.replace(/\]\]>/g, ']]]]><![CDATA[>')}]]></content:encoded>` +
        '</item>'
      );
    })
    .join('');

  const rss =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">\n' +
    '<channel>' +
    '<title>fatbruin</title>' +
    `<link>${xe(abs(''))}</link>` +
    '<description>一只热爱生活的胖熊。写移动端,也写 AI。</description>' +
    '<language>zh-CN</language>' +
    `<lastBuildDate>${(posts.length ? pubDate(posts[0], 0) : new Date()).toUTCString()}</lastBuildDate>` +
    `<atom:link href="${xe(abs('rss.xml'))}" rel="self" type="application/rss+xml"/>` +
    items +
    '</channel></rss>\n';
  fs.writeFileSync(path.join(DIRS.dist, 'rss.xml'), rss);
  written.push('rss.xml');

  // sitemap
  const urls = [abs(''), abs('posts/'), ...posts.map((p) => abs(`posts/${p.slug}/`))];
  const sitemap =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((l) => `<url><loc>${xe(l)}</loc></url>`).join('\n') +
    '\n</urlset>\n';
  fs.writeFileSync(path.join(DIRS.dist, 'sitemap.xml'), sitemap);
  written.push('sitemap.xml');

  fs.writeFileSync(
    path.join(DIRS.dist, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${abs('sitemap.xml')}\n`
  );
  written.push('robots.txt');
  return written;
}

// 404:借 archive 模板的外壳
function render404(template, css = {}) {
  const body =
    '<p class="meta"><span>404</span></p>' +
    '<h1>这页飘走了</h1>' +
    '<p class="sum">地址可能拼错了,或者这篇文章已经改名。</p>' +
    `<p style="padding-top:8px"><a href="${u('posts/')}">看看全部文章 →</a></p>`;
  return fill(template, {
    BASE, CSS_BASE: css.base || '', CSS_POST: css.post || '',
    COUNT: '', ARCHIVE: '', TITLE: '404', SUMMARY: '页面未找到',
  }).replace(
    /<p class="meta">[\s\S]*?<\/article>/,
    body + '</article>'
  );
}

function copyStatic() {
  if (!fs.existsSync(DIRS.static)) return 0;
  let n = 0;
  const walk = (src, dest) => {
    fs.mkdirSync(dest, { recursive: true });
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
      const s = path.join(src, e.name);
      const d = path.join(dest, e.name);
      if (e.isDirectory()) walk(s, d);
      else { fs.copyFileSync(s, d); n++; }
    }
  };
  walk(DIRS.static, DIRS.dist);
  return n;
}

// 把 styles/*.css 写进 dist,文件名带内容哈希,返回 {base:'/styles/base.a1b2c3.css', ...}
function emitStyles() {
  const src = path.join(ROOT, 'styles');
  const out = {};
  if (!fs.existsSync(src)) return out;
  const dir = path.join(DIRS.dist, 'styles');
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(src).filter((f) => f.endsWith('.css'))) {
    const css = fs.readFileSync(path.join(src, f), 'utf8');
    const hash = crypto.createHash('sha256').update(css).digest('hex').slice(0, 8);
    const name = f.replace(/\.css$/, `.${hash}.css`);
    fs.writeFileSync(path.join(dir, name), css);
    out[f.replace(/\.css$/, '')] = u(`styles/${name}`);
  }
  return out;
}

function build() {
  const t0 = Date.now();
  fs.rmSync(DIRS.dist, { recursive: true, force: true });
  fs.mkdirSync(DIRS.dist, { recursive: true });

  const posts = loadPosts();
  const css = emitStyles();
  const indexTpl = tpl('index.html');
  const postTpl = tpl('post.html');
  const archiveTpl = fs.existsSync(path.join(DIRS.templates, 'archive.html')) ? tpl('archive.html') : null;

  fs.writeFileSync(path.join(DIRS.dist, 'index.html'), renderIndex(posts, indexTpl, css));

  posts.forEach((p, i) => {
    const dir = path.join(DIRS.dist, 'posts', p.slug);
    fs.mkdirSync(dir, { recursive: true });
    // 列表是新→旧,所以「上一篇」= 更新的一篇 = i-1
    fs.writeFileSync(path.join(dir, 'index.html'), renderPost(p, posts[i - 1], posts[i + 1], postTpl, css));
  });

  if (archiveTpl) {
    const dir = path.join(DIRS.dist, 'posts');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), renderArchive(posts, archiveTpl, css));
  }

  // 404:复用 archive 外壳,内容换成提示
  if (archiveTpl) {
    fs.writeFileSync(path.join(DIRS.dist, '404.html'), render404(archiveTpl, css));
  }

  const assets = copyStatic();
  const feeds = writeFeeds(posts);
  const extra = feeds.length ? ` + ${feeds.join('/')}` : ' (未配 --site,跳过 rss/sitemap)';
  console.log(`✓ build: ${posts.length} 篇文章 + ${assets} 个静态文件${extra} → dist/ (${Date.now() - t0}ms)`);
  return posts;
}

// --- dev server -----------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp4': 'video/mp4',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};

function serve(port = 8000, explicitPort = false, attempt = 0) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(DIRS.dist, p);
    // 防目录穿越
    if (!file.startsWith(DIRS.dist)) { res.writeHead(403).end('Forbidden'); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }).end('<h1>404</h1>'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(data);
    });
  });

  // listen 的错误是异步抛的,外层 try/catch 接不到,必须挂 error 事件
  server.on('error', (e) => {
    if (e.code !== 'EADDRINUSE') { console.error('✗ ' + e.message); process.exit(1); }
    if (explicitPort) {
      console.error(`✗ 端口 ${port} 已被占用。换一个:npm run dev -- --port ${port + 1}`);
      console.error(`  或查看占用进程:lsof -nP -iTCP:${port} -sTCP:LISTEN`);
      process.exit(1);
    }
    if (attempt >= 10) { console.error(`✗ ${port - attempt}–${port} 都被占用,用 --port 指定一个空闲端口`); process.exit(1); }
    console.log(`  端口 ${port} 被占用,试 ${port + 1} …`);
    serve(port + 1, false, attempt + 1);
  });

  server.listen(port, () => console.log(`→ http://localhost:${port}`));

  let timer = null;
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { build(); } catch (e) { console.error('✗ ' + e.message); }
    }, 80);
  };
  for (const d of [DIRS.posts, DIRS.templates, DIRS.static]) {
    if (fs.existsSync(d)) fs.watch(d, { recursive: true }, rebuild);
  }
  console.log('  watching posts/ templates/ static/ …');
}

try {
  build();
  if (process.argv.includes('--serve')) {
    const i = process.argv.indexOf('--port');
    // 显式指定端口时被占就报错;没指定则自动顺延,避免开发时被 EADDRINUSE 打断
    serve(i > -1 ? Number(process.argv[i + 1]) : 8000, i > -1);
  }
} catch (e) {
  console.error('✗ ' + e.message);
  process.exit(1);
}
