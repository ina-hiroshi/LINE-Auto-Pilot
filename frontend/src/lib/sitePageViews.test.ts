import { describe, expect, it, vi } from 'vitest'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn(() => Promise.resolve({ error: null })) }))
vi.mock('./supabase', () => ({ supabase: { rpc } }))

import { isTrackedPath, recordSitePageView } from './sitePageViews'

describe('isTrackedPath', () => {
  it('製品紹介ページだけを対象にする', () => {
    expect(isTrackedPath('/')).toBe(true)
    expect(isTrackedPath('/monitor')).toBe(true)
    expect(isTrackedPath('/feature/reservation')).toBe(true)
    expect(isTrackedPath('/privacy')).toBe(true)
  })

  it('店舗のお客さん向け画面と存在しないURLは対象外', () => {
    expect(isTrackedPath('/booking')).toBe(false)
    expect(isTrackedPath('/member-card')).toBe(false)
    expect(isTrackedPath('/social-ui-capture')).toBe(false)
    expect(isTrackedPath('/feature/unknown')).toBe(false)
    expect(isTrackedPath('/no-such-page')).toBe(false)
  })
})

describe('recordSitePageView', () => {
  it('本番ビルド以外（テスト・ローカル）では送信しない', () => {
    recordSitePageView('/')
    expect(rpc).not.toHaveBeenCalled()
  })
})
