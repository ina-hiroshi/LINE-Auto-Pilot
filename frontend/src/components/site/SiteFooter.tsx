import { Link } from 'react-router-dom'
import { FEATURES, LINE_DEMO_URL } from './siteData'

const linkClass = 'text-[14px] text-paper/75 transition-colors hover:text-paper'

export default function SiteFooter() {
  return (
    <footer className="bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <p className="text-2xl font-black tracking-tight">IToguchi</p>
            <p className="mt-3 max-w-xs text-[14px] leading-relaxed text-paper/75">
              お店とお客様をつなぐ、たしかな糸ぐち。
              <br />
              LINE公式アカウントで、予約と問い合わせと会員証をまとめて引き受けます。
            </p>
            <a
              href={LINE_DEMO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-lg border border-paper/30 px-4 py-2.5 text-[14px] font-bold hover:bg-paper hover:text-ink"
            >
              <span className="size-2 rounded-full bg-[#06C755]" aria-hidden="true" />
              LINEで相談する
            </a>
          </div>

          <div>
            <p className="font-slip text-[12px] tracking-widest text-primary-300">機能</p>
            <ul className="mt-4 space-y-2.5">
              {FEATURES.map((f) => (
                <li key={f.slug}>
                  <Link to={f.path} className={linkClass}>
                    {f.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-slip text-[12px] tracking-widest text-primary-300">サービス</p>
            <ul className="mt-4 space-y-2.5">
              <li><Link to="/" state={{ scrollTo: 'pricing' }} className={linkClass}>料金プラン</Link></li>
              <li><Link to="/monitor" className={linkClass}>モニター特典</Link></li>
              <li><Link to="/security-guide" className={linkClass}>セキュリティへの取り組み</Link></li>
              <li><Link to="/" state={{ scrollTo: 'auth', authMode: 'login' }} className={linkClass}>ログイン</Link></li>
            </ul>
          </div>

          <div>
            <p className="font-slip text-[12px] tracking-widest text-primary-300">規約</p>
            <ul className="mt-4 space-y-2.5">
              <li><Link to="/terms" className={linkClass}>利用規約</Link></li>
              <li><Link to="/privacy" className={linkClass}>プライバシーポリシー</Link></li>
              <li><Link to="/specified-commercial-transactions" className={linkClass}>特定商取引法に基づく表記</Link></li>
              <li><Link to="/security" className={linkClass}>セキュリティポリシー</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-2 border-t border-dashed border-paper/20 pt-6 text-[13px] text-paper/60 sm:flex-row sm:justify-between">
          <p className="font-slip">© 2026 IToguchi</p>
          <p className="font-slip">またのご来店をお待ちしております</p>
        </div>
      </div>
    </footer>
  )
}
