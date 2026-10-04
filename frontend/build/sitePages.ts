import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { SITE_PAGES, canonicalUrl, type SiteMeta } from '../src/lib/siteMeta'

/**
 * 製品紹介ページごとの HTML とサイトマップを、ビルド後に書き出す。
 *
 * LINE・Facebook・X のリンクのプレビューは JavaScript を実行せず、最初に届く HTML だけを読む。
 * SPA の index.html 1枚のままだと、どのページを共有してもトップのタイトルと canonical になるため、
 * ページごとに head だけ差し替えた HTML を __pages/ に置き、vercel.json の rewrite で振り向ける。
 * トップ（/）は index.html のまま。存在しない URL やログイン後の画面にもこれが返るので、canonical は / でよい。
 */

export const PAGES_DIR = '__pages'

/** /feature/ai → __pages/feature-ai.html */
export function pageFileName(path: string): string {
  return `${PAGES_DIR}/${path.slice(1).replace(/\//g, '-')}.html`
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** pattern にちょうど1か所だけ一致することを確かめて置き換える。index.html の書き方が変わったらビルドを止める */
function replaceOnce(html: string, pattern: RegExp, replacement: string, label: string): string {
  const matches = html.match(new RegExp(pattern.source, 'g'))
  if (!matches || matches.length !== 1) {
    throw new Error(`sitePages: ${label} が index.html に${matches ? `${matches.length}件` : '見つかりません'}（1件のはず）`)
  }
  return html.replace(pattern, replacement)
}

const metaTag = (attr: 'name' | 'property', key: string) =>
  new RegExp(`<meta ${attr}="${key.replace(/[:]/g, '\\:')}" content="[^"]*" \\/>`)

export function renderPageHtml(indexHtml: string, path: string, meta: SiteMeta): string {
  const title = escapeAttr(meta.title)
  const description = escapeAttr(meta.description)
  const url = escapeAttr(canonicalUrl(path))
  let html = indexHtml
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${title}</title>`, 'title')
  html = replaceOnce(html, metaTag('name', 'description'), `<meta name="description" content="${description}" />`, 'description')
  html = replaceOnce(html, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`, 'canonical')
  html = replaceOnce(html, metaTag('property', 'og:title'), `<meta property="og:title" content="${title}" />`, 'og:title')
  html = replaceOnce(html, metaTag('property', 'og:description'), `<meta property="og:description" content="${description}" />`, 'og:description')
  html = replaceOnce(html, metaTag('property', 'og:url'), `<meta property="og:url" content="${url}" />`, 'og:url')
  html = replaceOnce(html, metaTag('name', 'twitter:title'), `<meta name="twitter:title" content="${title}" />`, 'twitter:title')
  html = replaceOnce(html, metaTag('name', 'twitter:description'), `<meta name="twitter:description" content="${description}" />`, 'twitter:description')
  return html
}

export function renderSitemap(): string {
  const urls = Object.keys(SITE_PAGES)
    .map((path) => `  <url><loc>${canonicalUrl(path)}</loc></url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

export function sitePagesPlugin(): Plugin {
  let outDir = 'dist'
  return {
    name: 'itoguchi-site-pages',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir.startsWith('/') ? config.build.outDir : join(config.root, config.build.outDir)
    },
    // 元にするのはビルド後の index.html（ハッシュ付きの JS・CSS が入っている）
    closeBundle() {
      const indexHtml = readFileSync(join(outDir, 'index.html'), 'utf8')
      mkdirSync(join(outDir, PAGES_DIR), { recursive: true })
      for (const [path, meta] of Object.entries(SITE_PAGES)) {
        if (path === '/') continue
        writeFileSync(join(outDir, pageFileName(path)), renderPageHtml(indexHtml, path, meta))
      }
      writeFileSync(join(outDir, 'sitemap.xml'), renderSitemap())
    },
  }
}
