#!/usr/bin/env bash
# fatbruin 部署脚本
#   ./deploy.sh build              仅构建
#   ./deploy.sh gh-pages           构建 + 推到 gh-pages 分支
#   ./deploy.sh rsync user@host:/var/www/blog/    构建 + rsync 上传
# 环境变量 BASE_PATH=/sub/ 可用于子路径部署
set -euo pipefail
cd "$(dirname "$0")"

MODE="${1:-build}"
DIST=dist

build() {
  echo "▸ 构建…"
  # SITE_URL 用于生成 rss.xml / sitemap.xml,未设置则跳过那几个文件
  npm run build --silent
  # GitHub Pages 默认跑 Jekyll,会忽略下划线开头的文件;.nojekyll 关掉它
  touch "$DIST/.nojekyll"
  echo "▸ 产物: $(pwd)/$DIST"
}

case "$MODE" in
  build)
    build
    ;;

  gh-pages)
    command -v git >/dev/null || { echo "✗ 需要 git"; exit 1; }
    git rev-parse --git-dir >/dev/null 2>&1 || { echo "✗ 当前目录不是 git 仓库,先 git init 并设置 remote"; exit 1; }
    git remote get-url origin >/dev/null 2>&1 || { echo "✗ 没有 origin remote"; exit 1; }
    build
    echo "▸ 推送到 gh-pages 分支…"
    # 用临时工作树,不干扰当前分支和未提交改动
    TMP="$(mktemp -d)"
    trap 'rm -rf "$TMP"' EXIT
    cp -R "$DIST"/. "$TMP"/
    cd "$TMP"
    git init -q
    git checkout -qb gh-pages
    git add -A
    git -c user.email=deploy@local -c user.name=deploy commit -qm "deploy $(date '+%Y-%m-%d %H:%M')"
    git push -q --force "$(cd - >/dev/null && git remote get-url origin)" gh-pages
    echo "✓ 已推到 gh-pages。到 GitHub → Settings → Pages 选 gh-pages 分支"
    ;;

  rsync)
    TARGET="${2:-}"
    [ -n "$TARGET" ] || { echo "✗ 用法: ./deploy.sh rsync user@host:/var/www/blog/"; exit 1; }
    command -v rsync >/dev/null || { echo "✗ 需要 rsync"; exit 1; }
    build
    echo "▸ rsync → $TARGET"
    # --delete 会删除目标端多余文件,保持与 dist/ 一致
    rsync -avz --delete "$DIST"/ "$TARGET"
    echo "✓ 上传完成"
    ;;

  *)
    echo "用法: ./deploy.sh [build|gh-pages|rsync <target>]"
    exit 1
    ;;
esac
