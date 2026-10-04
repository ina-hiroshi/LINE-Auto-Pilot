import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { applyPageMeta } from '../../lib/pageMeta'

/**
 * 画面を移動したときに head を書き換える。BrowserRouter の内側に置く。
 * 最初に届く HTML はビルド時にページごとに書き出している（build/sitePages.ts）ので、ここは SPA 内の移動のため。
 */
export default function PageMeta() {
  const { pathname } = useLocation()
  useEffect(() => {
    applyPageMeta(pathname)
  }, [pathname])
  return null
}
