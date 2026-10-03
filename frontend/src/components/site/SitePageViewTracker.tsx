import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { recordSitePageView } from '../../lib/sitePageViews'

/**
 * 製品紹介ページの閲覧を記録する。BrowserRouter の内側に置く。
 *
 * ログイン中は記録しない。`/` はログイン状態によってトップページにも管理画面にもなるうえ、
 * 店舗オーナーや運営者自身の閲覧で数字がふくらむのを避けたいため。
 * pathname が変わったときだけ数え、`/#auth` のような hash の変化は数えない。
 */
export default function SitePageViewTracker({ loggedIn }: { loggedIn: boolean }) {
  const { pathname } = useLocation()

  useEffect(() => {
    if (loggedIn) return
    recordSitePageView(pathname)
  }, [pathname, loggedIn])

  return null
}
