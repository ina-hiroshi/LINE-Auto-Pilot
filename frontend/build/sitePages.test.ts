import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SITE_PAGES } from '../src/lib/siteMeta'
import { FEATURES } from '../src/components/site/siteData'
import { FAQ } from '../src/components/site/faq'
import { pageFileName, renderFaqJsonLd, renderLlmsTxt, renderPageHtml, renderSitemap, withFaqJsonLd } from './sitePages'

const root = join(__dirname, '..')
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8')

describe('renderPageHtml', () => {
  it('ページごとに title・説明文・canonical・OGP を差し替える', () => {
    const html = renderPageHtml(indexHtml, '/feature/ai', SITE_PAGES['/feature/ai'])
    expect(html).toContain('<title>AIがLINEの質問に答える（Pro） | IToguchi（イトグチ）</title>')
    expect(html).toContain('<link rel="canonical" href="https://itoguchi-app.jp/feature/ai" />')
    expect(html).toContain('<meta property="og:url" content="https://itoguchi-app.jp/feature/ai" />')
    expect(html).toContain(`<meta name="description" content="${SITE_PAGES['/feature/ai'].description}" />`)
    expect(html).not.toContain('href="https://itoguchi-app.jp/" />')
  })

  it('属性に入れる文字をエスケープする', () => {
    const html = renderPageHtml(indexHtml, '/terms', { title: 'A & "B"', description: '<x>' })
    expect(html).toContain('<title>A &amp; &quot;B&quot;</title>')
    expect(html).toContain('content="&lt;x&gt;"')
  })

  it('index.html に差し替える場所が見つからなければ止める', () => {
    expect(() => renderPageHtml(indexHtml.replace(/<link rel="canonical"[^>]*>/, ''), '/terms', SITE_PAGES['/terms'])).toThrow(/canonical/)
  })
})

describe('renderSitemap', () => {
  it('一覧の全ページを載せる', () => {
    const xml = renderSitemap()
    for (const path of Object.keys(SITE_PAGES)) {
      expect(xml).toContain(`<loc>https://itoguchi-app.jp${path === '/' ? '/' : path}</loc>`)
    }
  })
})

describe('vercel.json', () => {
  it.each(['../vercel.json', 'vercel.json'])('%s の rewrite がページ一覧と一致し、catch-all より前にある', (file) => {
    const { rewrites } = JSON.parse(readFileSync(join(root, file), 'utf8')) as { rewrites: { source: string; destination: string }[] }
    const pages = Object.keys(SITE_PAGES).filter((p) => p !== '/')
    expect(rewrites.slice(0, -1)).toEqual(pages.map((p) => ({ source: p, destination: `/${pageFileName(p)}` })))
    expect(rewrites.at(-1)).toEqual({ source: '/(.*)', destination: '/index.html' })
  })
})

describe('renderLlmsTxt', () => {
  const txt = renderLlmsTxt()
  it('機能ページ・料金・モニター・よくある質問を載せる', () => {
    for (const f of FEATURES) expect(txt).toContain(`(https://itoguchi-app.jp${f.path})`)
    for (const f of FAQ) expect(txt).toContain(f.q)
    expect(txt).toContain('¥4,980')
    expect(txt).toContain('https://itoguchi-app.jp/monitor')
  })
  it('モニターの残り枠のように実行時に変わる数は載せない', () => {
    expect(txt).not.toMatch(/残り\s*\d+/)
  })
})

describe('FAQ の構造化データ', () => {
  it('トップに表示している質問と答えをそのまま載せる', () => {
    const json = JSON.parse(renderFaqJsonLd().replace(/^<script[^>]*>|<\/script>$/g, ''))
    expect(json['@type']).toBe('FAQPage')
    expect(json.mainEntity.map((q: { name: string }) => q.name)).toEqual(FAQ.map((f) => f.q))
    expect(json.mainEntity[0].acceptedAnswer.text).toBe(FAQ[0].a)
  })
  it('トップにだけ足す（機能ページの HTML には入れない）', () => {
    expect(withFaqJsonLd(indexHtml)).toContain('"FAQPage"')
    expect(renderPageHtml(indexHtml, '/feature/ai', SITE_PAGES['/feature/ai'])).not.toContain('FAQPage')
  })
})

describe('index.html の構造化データ', () => {
  it('featureList が機能の一覧とそろっている', () => {
    const ld = JSON.parse(indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1])
    expect(ld.featureList).toEqual(FEATURES.map((f) => f.name))
  })
})
