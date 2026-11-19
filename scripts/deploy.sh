#!/usr/bin/env sh
# Сборка и публикация на GitHub Pages: содержимое dist/ уходит в ветку gh-pages репозитория origin.
# Ветка каждый раз перезаписывается одним коммитом — в ней только собранный сайт, без истории.
# Один раз в репозитории: Settings → Pages → Build and deployment → Source: Deploy from a branch → gh-pages / (root).
# Запуск: npm run deploy  (другой репозиторий: DEPLOY_REMOTE=<url> npm run deploy)
set -e
cd "$(dirname "$0")/.."

remote=${DEPLOY_REMOTE:-$(git remote get-url origin)}
source=$(git describe --always --dirty) # из какого коммита собрано; -dirty — были незакоммиченные правки

npm run build

trap 'rm -rf dist/.git' EXIT # dist/ остаётся обычной папкой сборки, даже если пуш не удался
touch dist/.nojekyll         # отдавать файлы как есть, без обработки Jekyll
git -C dist init -q -b gh-pages
git -C dist add -A
git -C dist commit -q -m "Deploy $source"
git -C dist push -f -q "$remote" gh-pages

# https://github.com/<user>/<repo>.git или git@github.com:<user>/<repo>.git → https://<user>.github.io/<repo>/
slug=$(printf '%s' "$remote" | sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##')
echo "Опубликовано из $source: https://${slug%%/*}.github.io/${slug#*/}/ (обновится через 1–2 минуты)"
