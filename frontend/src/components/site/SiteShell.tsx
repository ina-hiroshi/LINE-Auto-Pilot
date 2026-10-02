import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'

/**
 * 公開ページ共通の枠。フォントと配色は .site の内側だけに効く（index.css）。
 * 管理画面と予約・会員証のLIFFページには影響しない。
 */
export default function SiteShell({
  children,
  scrollToTopOnNavigate = true,
}: {
  children: ReactNode
  /** トップページは location.state.scrollTo で目的の位置へ移動するため false にする */
  scrollToTopOnNavigate?: boolean
}) {
  const { pathname } = useLocation()

  useEffect(() => {
    if (scrollToTopOnNavigate) window.scrollTo(0, 0)
  }, [pathname, scrollToTopOnNavigate])

  return (
    <MotionConfig reducedMotion="user">
      <div className="site min-h-screen">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
        >
          本文へ移動
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </div>
    </MotionConfig>
  )
}
