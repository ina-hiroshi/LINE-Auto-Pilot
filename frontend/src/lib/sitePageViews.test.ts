import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn(() => Promise.resolve({ error: null })) }))
vi.mock('./supabase', () => ({ supabase: { rpc } }))

beforeEach(() => {
  rpc.mockClear()
  localStorage.clear()
})

import { isTrackedPath, markOwnBrowser, recordSitePageView } from './sitePageViews'

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

describe('markOwnBrowser', () => {
  it('このブラウザの visitor_id を除外に登録し、印を残す', async () => {
    markOwnBrowser()
    expect(rpc).toHaveBeenCalledWith('register_own_site_visitor', { p_visitor_id: localStorage.getItem('itoguchi_visitor_id') })
    await vi.waitFor(() => expect(localStorage.getItem('itoguchi_own_browser')).toBe('1'))
  })

  it('登録済みのブラウザでは再登録しない', () => {
    localStorage.setItem('itoguchi_own_browser', '1')
    markOwnBrowser()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('登録に失敗したら印を残さず、次回に再登録する', async () => {
    rpc.mockReturnValueOnce(Promise.resolve({ error: { message: 'forbidden' } }) as never)
    markOwnBrowser()
    await Promise.resolve()
    await Promise.resolve()
    expect(localStorage.getItem('itoguchi_own_browser')).toBeNull()
  })
})
