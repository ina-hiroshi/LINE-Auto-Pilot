import { SITE_PAGES, canonicalUrl } from './siteMeta'

function setMeta(selector: string, value: string) {
  document.head.querySelector(selector)?.setAttribute('content', value)
}

/** 製品紹介ページの head（タイトル・説明文・canonical・OGP）を、いまのページに合わせる */
export function applyPageMeta(pathname: string): void {
  const meta = SITE_PAGES[pathname]
  // 一覧にないページ（予約・会員証など）は自分で document.title を決めているので触らない
  if (!meta) return
  const url = canonicalUrl(pathname)
  document.title = meta.title
  setMeta('meta[name="description"]', meta.description)
  setMeta('meta[property="og:title"]', meta.title)
  setMeta('meta[property="og:description"]', meta.description)
  setMeta('meta[property="og:url"]', url)
  setMeta('meta[name="twitter:title"]', meta.title)
  setMeta('meta[name="twitter:description"]', meta.description)
  document.head.querySelector('link[rel="canonical"]')?.setAttribute('href', url)
}
