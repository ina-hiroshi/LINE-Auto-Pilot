import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SITE_PAGES } from '../src/lib/siteMeta'
import { pageFileName, renderPageHtml, renderSitemap } from './sitePages'

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
