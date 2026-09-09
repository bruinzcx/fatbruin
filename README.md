# fatbruin

静态博客。写 Markdown,构建成纯静态 HTML。

## 用法

```bash
npm install          # 首次
npm run dev          # 本地预览 http://localhost:8000,改 md 自动重建
npm run build        # 构建到 dist/
```

`npm run dev -- --port 9000` 可换端口。

## 写文章

在 `posts/` 下新建 `.md`,文件名建议 `YYYY-MM-标题.md`:

```markdown
---
title: 文章标题
date: 2026.08
group: On-device
summary: 一句话摘要,显示在列表和 meta description
read: 9 分钟        # 可选,不写则按字数自动估算
slug: my-post       # 可选,不写则从文件名生成(自动去掉日期前缀)
draft: true         # 可选,true 则不发布
---

正文……
```

`title` 必填,其余可省。列表按 `date` 倒序(新→旧)。

支持完整 CommonMark:标题、列表(含有序/嵌套)、表格、图片、引用、代码块(带语法高亮)、粗体、行内码、链接、分割线。代码块标语言即高亮:

````
```yaml
key: value
```
````

## 目录

```
build.js        构建脚本 + dev server
posts/          文章源文件(你只需要动这里)
templates/      index.html 首页 / post.html 详情页 / archive.html 全部文章索引
static/         原样拷进 dist(island.js 3D 背景 / bear.js 熊建模 / mascot.js 看板娘)
styles/         CSS 源文件,构建时加内容哈希输出到 dist/styles/
dist/           产物,部署这个目录
prd/            原始设计稿,只读参考,不参与构建
deploy.sh       部署脚本
nginx.conf.example   自建服务器的 Nginx 配置示例
.github/workflows/deploy.yml   推 main 自动发布到 GitHub Pages
```

## 部署

产物 `dist/` 是纯静态,复制过去即可。路径为**根相对**(`/island.js`、`/posts/xxx/`),
所以根路径部署直接可用;子路径部署需要 `--base`(见下)。

### 一键脚本

```bash
./deploy.sh build                                # 仅构建
./deploy.sh gh-pages                             # 构建 + 推到 gh-pages 分支
./deploy.sh rsync user@host:/var/www/fatbruin/   # 构建 + rsync 上传
```

### GitHub Pages(自动)

`.github/workflows/deploy.yml` 已配好:推 main 自动构建发布,
**并自动判定 base path**,用户站和项目站都不用改配置:

| 仓库名 | 站点地址 | 自动 base |
| --- | --- | --- |
| `<name>.github.io` | `<name>.github.io` | `/` |
| 其他(如 `blog`) | `<name>.github.io/blog/` | `/blog/` |

首次配置:

1. 新建仓库,推上去
2. GitHub → **Settings → Pages → Source** 选 **GitHub Actions**
3. 等 Actions 跑完,访问站点地址

以后写完文章:

```bash
git add posts/ && git commit -m "新文章" && git push
```

绑自定义域名后站点变回根路径,把 workflow 里「计算 base path」那一步删掉、
`BASE_PATH` 改成 `/` 即可。

### 自己的服务器

```bash
npm run build
rsync -avz --delete dist/ user@host:/var/www/fatbruin/
```

Nginx 配置见 `nginx.conf.example`,关键是 `try_files $uri $uri/ $uri/index.html =404;`
—— 让 `/posts/xxx/` 能读到目录下的 `index.html`。

### Vercel / Netlify / Cloudflare Pages

连 Git 仓库,设置:

- Build command: `npm run build`
- Output directory: `dist`

### RSS / sitemap

生成 `rss.xml`、`sitemap.xml`、`robots.txt` 需要完整站点地址:

```bash
npm run build -- --site https://fatbruin.github.io
# 或
SITE_URL=https://fatbruin.github.io npm run build
```

不配 `--site` 就跳过这三个文件(构建不报错,会提示)。
`deploy.sh` 和 GitHub Actions 里记得一并配上。

### 子路径部署

若站点不在域名根目录(如 GitHub Pages **项目站** `<name>.github.io/<repo>/`),
必须指定 base,否则资源和链接会 404:

```bash
npm run build -- --base /<repo>/
# 或
BASE_PATH=/<repo>/ npm run build
```

用户站(`<name>.github.io`)和自有域名是根路径,**不需要**这个参数。

## 3D 背景

`static/island.js` —— three.js 程序化生成的悬浮小岛,含氛围后期:

| 层 | 说明 |
| --- | --- |
| 体积光 | 加性混合的锥形光束,丁达尔效应 |
| 浮尘 | 700 个 GPU 粒子(移动端 260),缓慢上升飘移 |
| 辉光 | UnrealBloom,仅高亮部分溢出 |
| 色彩分级 | 暖色偏移 + 提饱和 + 暗角 |
| 景深 | **默认关闭**(最贵的 pass),`?dof` 或控制台开启 |

调参:浏览器控制台有 `__fx` 句柄,可实时改。例如

```js
__fx.bloom.strength = 0.5          // 辉光强度
__fx.grade.uniforms.uWarm.value = 0.1   // 暖色程度
__fx.godrays.userData.mat.uniforms.uOpacity.value = 0.12  // 光束浓度
__fx.bokeh.enabled = true          // 需以 ?dof 打开页面
```

移动端自动降级:粒子减量、跳过阴影和景深、辉光减弱。

## 说明

- 正文在构建期渲染成 HTML,浏览器端不需要 JS 即可阅读(利于 SEO)
- 唯一的客户端 JS 是 `island.js`(three.js 3D 背景)、键盘导航(←/→ 翻页,Esc 返回)和大纲高亮
- 文章页左侧有自动生成的大纲(H2/H3),构建期从正文抽取;窗口窄于 1600px 或标题少于 2 个时不显示
- 文章页右下角有看板娘(复用首页那只熊的建模,见 `static/bear.js`):点击说话、读到 50%/95% 提示、滚动后出现回到顶部;窄于 820px 隐藏
- CSS 拆成 `styles/base.css`(共享)和 `styles/post.css`(文章页),构建时加内容哈希输出到 `dist/styles/`
- `island.js` 从 unpkg CDN 加载 three.js,需要联网
