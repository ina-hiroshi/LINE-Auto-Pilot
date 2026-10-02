import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Logo from '../Logo'
import { btnPrimary } from './ui'

const NAV = [
  { label: '機能', to: '/', state: { scrollTo: 'features' } },
  { label: '料金', to: '/', state: { scrollTo: 'pricing' } },
  { label: 'モニター特典', to: '/monitor' },
  { label: 'セキュリティ', to: '/security-guide' },
] as const

export default function SiteHeader() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 bg-paper/95 backdrop-blur-sm transition-shadow ${
        scrolled ? 'shadow-[0_1px_0_var(--color-rule),0_6px_16px_rgb(28_42_48/0.06)]' : ''
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" state={{ scrollTo: 'top' }} className="shrink-0" aria-label="IToguchi トップページ">
          <Logo className="h-9 w-auto sm:h-10" />
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="サイト内">
          {NAV.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              state={'state' in item ? item.state : undefined}
              className="text-[14px] font-bold text-ink-soft transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            to="/"
            state={{ scrollTo: 'auth', authMode: 'login' }}
            className="hidden text-[14px] font-bold text-ink-soft hover:text-ink sm:inline"
          >
            ログイン
          </Link>
          <Link
            to="/"
            state={{ scrollTo: 'auth', authMode: 'signup' }}
            className={`${btnPrimary} px-4 py-2.5 text-[14px]`}
          >
            無料で始める
          </Link>
          <button
            type="button"
            className="-mr-2 grid size-11 place-items-center rounded-lg text-ink md:hidden"
            aria-expanded={open}
            aria-controls="site-mobile-nav"
            aria-label={open ? 'メニューを閉じる' : 'メニューを開く'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="site-mobile-nav" className="border-t border-rule bg-paper px-4 pb-5 md:hidden" aria-label="サイト内">
          <ul className="divide-y divide-dashed divide-rule">
            {NAV.map((item) => (
              <li key={item.label}>
                <Link
                  to={item.to}
                  state={'state' in item ? item.state : undefined}
                  onClick={() => setOpen(false)}
                  className="flex py-3.5 text-[16px] font-bold"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/"
                state={{ scrollTo: 'auth', authMode: 'login' }}
                onClick={() => setOpen(false)}
                className="flex py-3.5 text-[16px] font-bold"
              >
                ログイン
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  )
}
