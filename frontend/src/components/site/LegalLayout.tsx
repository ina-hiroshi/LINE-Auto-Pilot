import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import SiteShell from './SiteShell'
import { wrap } from './ui'

const DOCS = [
  { to: '/terms', label: '利用規約' },
  { to: '/privacy', label: 'プライバシーポリシー' },
  { to: '/specified-commercial-transactions', label: '特定商取引法に基づく表記' },
  { to: '/security', label: 'セキュリティポリシー' },
]

/**
 * 規約・ポリシーのページの枠。本文（children）の文言には手を入れない。
 * 目次は本文の h2 から作る。
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const bodyRef = useRef<HTMLElement>(null)
  const [toc, setToc] = useState<{ id: string; label: string }[]>([])

  // 本文が描画されてから h2 を読み取る
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const headings = Array.from(bodyRef.current?.querySelectorAll('h2') ?? [])
      setToc(
        headings.map((h, i) => {
          if (!h.id) h.id = `section-${i + 1}`
          return { id: h.id, label: h.textContent ?? '' }
        }),
      )
    })
    return () => cancelAnimationFrame(frame)
  }, [pathname])

  return (
    <SiteShell>
      <div className="bg-paper">
        <div className={`${wrap} grid gap-10 pb-24 pt-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16 lg:pt-14`}>
          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <nav aria-label="規約とポリシー" className="font-slip text-[13px]">
              <ul className="flex flex-wrap gap-x-4 gap-y-2 lg:block lg:space-y-2">
                {DOCS.map((d) => (
                  <li key={d.to}>
                    <Link
                      to={d.to}
                      aria-current={pathname === d.to ? 'page' : undefined}
                      className={pathname === d.to ? 'font-bold text-ink' : 'text-ink-soft hover:text-ink'}
                    >
                      {d.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {toc.length > 0 && (
              <details className="group mt-8 border-t border-dashed border-rule pt-5 lg:open:block" open>
                <summary className="cursor-pointer list-none text-[13px] font-bold text-ink [&::-webkit-details-marker]:hidden">
                  目次<span className="ml-2 text-ink-soft group-open:hidden">（開く）</span>
                </summary>
                <ol className="mt-3 max-h-[60vh] space-y-1.5 overflow-y-auto pr-2 text-[13px] leading-snug">
                  {toc.map((t) => (
                    <li key={t.id}>
                      <a href={`#${t.id}`} className="block py-0.5 text-ink-soft hover:text-ink">
                        {t.label}
                      </a>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </aside>

          <article ref={bodyRef} data-legal-body className="legal min-w-0 max-w-3xl text-[16px] leading-[1.95]">
            {children}
          </article>
        </div>
      </div>
    </SiteShell>
  )
}
