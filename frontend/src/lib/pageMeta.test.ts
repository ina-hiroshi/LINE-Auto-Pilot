import { beforeEach, describe, expect, it } from 'vitest'
import { applyPageMeta } from './pageMeta'

const head = () => document.head.innerHTML

beforeEach(() => {
  document.head.innerHTML = `
    <title>初期</title>
    <meta name="description" content="初期" />
    <link rel="canonical" href="https://itoguchi-app.jp/" />
    <meta property="og:url" content="https://itoguchi-app.jp/" />`
})

describe('applyPageMeta', () => {
  it('製品紹介ページに移ると head を書き換える', () => {
    applyPageMeta('/feature/reservation')
    expect(document.title).toBe('LINEで予約を受け付ける | IToguchi（イトグチ）')
    expect(head()).toContain('href="https://itoguchi-app.jp/feature/reservation"')
    expect(head()).toContain('content="https://itoguchi-app.jp/feature/reservation"')
  })

  it('トップへ戻ると canonical も / に戻す', () => {
    applyPageMeta('/monitor')
    applyPageMeta('/')
    expect(head()).toContain('href="https://itoguchi-app.jp/"')
  })

  it('一覧にないページ（予約など）は触らない', () => {
    applyPageMeta('/booking')
    expect(document.title).toBe('初期')
  })
})
