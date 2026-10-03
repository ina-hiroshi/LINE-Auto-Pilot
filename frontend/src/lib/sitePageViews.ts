import { supabase } from './supabase'
import { looksLikeLiffEntryAtRoot } from './liffEntry'

/**
 * 製品紹介ページの閲覧記録（広報画面の「サイト閲覧」タブで集計する）。
 *
 * 記録先は site_page_views。実際の入力検証は RPC record_site_page_view 側にあり、
 * ここでの絞り込みは無駄な通信を減らすためのもの。
 */

/** 記録する公開ページ。存在しない URL も TopPage を表示するため、既知のパスだけに限る。 */
const TRACKED_PATHS = new Set([
  '/',
  '/monitor',
  '/privacy',
  '/terms',
  '/specified-commercial-transactions',
  '/security',
  '/security-guide',
  '/feature/auto-response',
  '/feature/reservation',
  '/feature/membership',
  '/feature/ai',
  '/feature/customers',
  '/feature/points',
  '/feature/messaging',
  '/feature/rich-menu',
])

const PRODUCTION_HOSTS = new Set(['itoguchi-app.jp', 'www.itoguchi-app.jp'])
const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|embedly|quora link/i

const VISITOR_KEY = 'itoguchi_visitor_id'
const SESSION_KEY = 'itoguchi_session_id'

export function isTrackedPath(pathname: string): boolean {
  return TRACKED_PATHS.has(pathname)
}

/** 本番の実ブラウザでだけ記録する。ローカル・Vercel のプレビュー・ヘッドレスでの確認は数えない。 */
function shouldRecord(): boolean {
  if (!import.meta.env.PROD) return false
  if (!PRODUCTION_HOSTS.has(window.location.hostname)) return false
  if (navigator.webdriver) return false
  if (BOT_UA.test(navigator.userAgent)) return false
  // LIFF（会員証など）の入口URLのまま / に落ちた場合は、店舗のお客さんなので数えない
  const { pathname, search, hash } = window.location
  if (looksLikeLiffEntryAtRoot(pathname, search, hash)) return false
  return true
}

function storedId(storage: () => Storage, key: string): string {
  try {
    const s = storage()
    const existing = s.getItem(key)
    if (existing) return existing
    const id = crypto.randomUUID()
    s.setItem(key, id)
    return id
  } catch {
    // ストレージが使えない環境（プライベートモードの一部など）は毎回別人として数える
    return crypto.randomUUID()
  }
}

function referrerHost(): string | null {
  if (!document.referrer) return null
  try {
    return new URL(document.referrer).hostname
  } catch {
    return null
  }
}

export function recordSitePageView(pathname: string): void {
  // 記録は付随機能なので、どの段階の失敗も画面（公開トップページ）に波及させない。
  // useEffect から呼ばれるため、ここで例外が漏れると画面全体が外れる。
  try {
    if (!isTrackedPath(pathname) || !shouldRecord()) return

    const params = new URLSearchParams(window.location.search)
    const isMobile = window.matchMedia?.('(max-width: 767px)').matches || /Mobi|Android/i.test(navigator.userAgent)

    // 投げっぱなし。記録に失敗しても画面には何も影響させない。
    void supabase
      .rpc('record_site_page_view', {
        p_path: pathname,
        p_visitor_id: storedId(() => localStorage, VISITOR_KEY),
        p_session_id: storedId(() => sessionStorage, SESSION_KEY),
        p_referrer_host: referrerHost(),
        p_utm_source: params.get('utm_source'),
        p_utm_medium: params.get('utm_medium'),
        p_utm_campaign: params.get('utm_campaign'),
        p_has_fbclid: params.has('fbclid'),
        p_device: isMobile ? 'mobile' : 'desktop',
      })
      .then(({ error }) => {
        if (error && import.meta.env.DEV) console.warn('record_site_page_view failed', error)
      })
  } catch {
    /* 記録できなくても何もしない */
  }
}
