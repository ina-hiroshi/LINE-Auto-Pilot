import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { SITE_PAGES, canonicalUrl, type SiteMeta } from '../src/lib/siteMeta'
import { CONTACT_MAIL, FEATURES, LINE_DEMO_URL, PLANS, SETUP_SERVICE_PRICE } from '../src/components/site/siteData'
import { FAQ } from '../src/components/site/faq'

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

/**
 * AI 向けのサイト案内（https://llmstxt.org/ の形）。ChatGPT などは JavaScript を実行せずに読むことが多く、
 * SPA の本文が届かないため、ページの説明文・機能・料金・よくある質問を文字だけでまとめる。
 * 文面は siteMeta・siteData・faq にあるものだけを使う（ここで数字や効果を足さない）。
 */
export function renderLlmsTxt(): string {
  const top = SITE_PAGES['/']
  const lines: string[] = [
    '# IToguchi（イトグチ）',
    '',
    `> ${top.description}`,
    '',
    '## 機能',
    '',
    ...FEATURES.map((f) => `- [${f.name}](${canonicalUrl(f.path)})（${f.plan}）：${SITE_PAGES[f.path]?.description ?? f.gain}`),
    '',
    '## 料金（税込・月ごとのお支払い）',
    '',
    `- ${PLANS.free.name}（${PLANS.free.price}）：${PLANS.free.items.join('、')}`,
    `- ${PLANS.pro.name}（月額${PLANS.pro.price}）：${PLANS.pro.items.join('、')}。初めてお申し込みの方は30日間無料で試せます。`,
    `- ${PLANS.executive.name}（${PLANS.executive.price}、準備中）：${PLANS.executive.items.join('、')}`,
    `- 初期設定代行：${SETUP_SERVICE_PRICE}（LINE公式アカウントとの接続の設定をこちらで行います）`,
    '',
    '## モニター店舗の募集',
    '',
    `- [モニター店舗募集](${canonicalUrl('/monitor')})：${SITE_PAGES['/monitor'].description}`,
    '',
    '## よくある質問',
    '',
    ...FAQ.flatMap((f) => [`### ${f.q}`, '', f.a, '']),
    '## そのほかのページ',
    '',
    ...['/security-guide', '/security', '/privacy', '/terms', '/specified-commercial-transactions'].map(
      (path) => `- [${SITE_PAGES[path].title}](${canonicalUrl(path)})`,
    ),
    '',
    '## 問い合わせ',
    '',
    `- メール：${CONTACT_MAIL}`,
    `- お客様側の画面を試せるデモのLINE：${LINE_DEMO_URL}`,
    '',
  ]
  return lines.join('\n')
}

/** トップの「よくある質問」を構造化データ（FAQPage）にする。表示している文と同じものだけを載せる */
export function renderFaqJsonLd(): string {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`
}

/** トップ（index.html）だけに FAQ の構造化データを足す。機能ページの HTML には入れない（FAQ を表示していないため） */
export function withFaqJsonLd(indexHtml: string): string {
  return replaceOnce(indexHtml, /<\/head>/, `    ${renderFaqJsonLd()}\n  </head>`, '</head>')
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
      writeFileSync(join(outDir, 'llms.txt'), renderLlmsTxt())
      // __pages/ を書き出したあとで、トップにだけ FAQ を足す
      writeFileSync(join(outDir, 'index.html'), withFaqJsonLd(indexHtml))
    },
  }
}
