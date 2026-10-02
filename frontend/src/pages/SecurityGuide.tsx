import { Link } from 'react-router-dom'
import { ArrowRight, Lock } from 'lucide-react'
import SiteShell from '../components/site/SiteShell'
import { Slip } from '../components/site/Receipt'
import { btnPrimary, textLink, wrap } from '../components/site/ui'

const MEASURES = [
  {
    title: 'ほかのお店からは見えません',
    body: 'お客様の名前、予約の情報、メッセージのやりとりは、店舗ごとに厳密に分けて保管しています。ほかのお店のオーナーが、あなたのお店のデータを見ることはできません。',
  },
  {
    title: '通信はすべて暗号化しています',
    body: '管理画面とサーバーの間のやりとりは、すべてHTTPS（TLS）で暗号化しています。第三者に盗み見られたり、書き換えられたりする心配はありません。',
  },
  {
    title: 'カード情報は一切保管しません',
    body: '決済はStripe社が処理します。クレジットカードの番号が、IToguchiのサーバーに保存されることはありません。',
  },
  {
    title: '登録のときに本人確認をします',
    body: 'アカウントを作るときは、メールで届く確認コードで本人確認をしています。パスワードも暗号化して、安全に保管しています。',
  },
  {
    title: 'LINE連携のなりすましも防いでいます',
    body: 'LINEから届く通知が本物かどうかを、毎回確かめています。偽のメッセージでシステムを操作されることはありません。',
  },
  {
    title: '予約の変更は、ご本人しかできません',
    body: '予約のキャンセルや変更では、操作する権限を厳密に確かめています。URLを知っているだけでは、ほかの人の予約は操作できません。',
  },
]

const SHOPS = ['A店', 'B店', 'C店']

/** 店舗ごとにデータが分かれていることを示す図 */
function SeparationDiagram() {
  return (
    <figure className="rounded-2xl bg-counter p-6 sm:p-8">
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {SHOPS.map((shop, i) => (
          <div key={shop} className={`rounded-xl border-2 bg-paper p-3 sm:p-4 ${i === 0 ? 'border-primary-600' : 'border-rule'}`}>
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-black sm:text-[16px]">{shop}</p>
              <Lock className={`size-4 ${i === 0 ? 'text-primary-700' : 'text-ink-soft'}`} aria-hidden="true" />
            </div>
            <ul className="mt-3 space-y-1.5 text-[11.5px] text-ink-soft sm:text-[13px]">
              <li className="rounded bg-counter/70 px-2 py-1">お客様の名前</li>
              <li className="rounded bg-counter/70 px-2 py-1">予約</li>
              <li className="rounded bg-counter/70 px-2 py-1">メッセージ</li>
            </ul>
          </div>
        ))}
      </div>
      <figcaption className="mt-5 text-[14px] leading-relaxed text-ink-soft">
        A店のオーナーが見られるのは、A店のデータだけです。B店やC店のデータは表示されません。
      </figcaption>
    </figure>
  )
}

export default function SecurityGuide() {
  return (
    <SiteShell>
      <section className="bg-paper">
        <div className={`${wrap} grid min-w-0 items-center gap-12 pb-20 pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:pt-14`}>
          <div className="min-w-0">
            <h1 className="text-[2rem] font-black leading-[1.3] tracking-[-0.02em] sm:text-[2.6rem] sm:leading-[1.25]">
              <span className="inline-block">大切なお客様の情報を、</span>
              <span className="inline-block">しっかり守ります</span>
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-[1.9] text-ink-soft">
              IToguchiは、店舗ごとにデータを厳密に分け、通信もすべて暗号化しています。その仕組みを、専門用語をなるべく使わずに説明します。
            </p>
          </div>
          <SeparationDiagram />
        </div>
      </section>

      <section className="bg-counter py-24">
        <div className={`${wrap} grid items-start gap-12 lg:grid-cols-[0.8fr_1.2fr]`}>
          <div className="lg:sticky lg:top-28">
            <h2 className="text-3xl font-black leading-snug tracking-[-0.02em] sm:text-4xl">6つの取り組み</h2>
            <p className="mt-5 text-[17px] leading-[1.9] text-ink-soft">
              お店の側で難しい設定をする必要はありません。安心して使っていただくために、裏側で次の対策をしています。
            </p>
          </div>
          <Slip className="py-8">
            <div className="text-center">
              <p className="text-[16px] font-black">安全点検票</p>
              <p className="mt-1 font-slip text-[12px] text-ink-soft">IToguchi</p>
            </div>
            <div className="slip-rule my-4" />
            <ol>
              {MEASURES.map((m, i) => (
                <li key={m.title} className="grid grid-cols-[2rem_1fr] gap-3 border-b border-dashed border-rule py-5 last:border-b-0">
                  <span className="font-slip text-[18px] font-bold text-primary-700">{i + 1}</span>
                  <div>
                    <h3 className="text-[18px] font-black leading-snug">{m.title}</h3>
                    <p className="mt-2 text-[15px] leading-[1.85] text-ink-soft">{m.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Slip>
        </div>
      </section>

      <section className="bg-paper py-24">
        <div className={`${wrap} max-w-3xl space-y-10`}>
          <div>
            <h2 className="text-[22px] font-black">Googleカレンダー連携について</h2>
            <p className="mt-3 text-[16px] leading-[1.9] text-ink-soft">
              取得した予定の情報は、予約の管理以外には使わず、第三者に渡すこともありません。
            </p>
          </div>
          <div>
            <h2 className="text-[22px] font-black">もしものときも</h2>
            <p className="mt-3 text-[16px] leading-[1.9] text-ink-soft">
              万が一セキュリティ上の問題が起きた場合も、影響の範囲をすぐに確かめ、必要な方には個別に連絡したうえで、再発の防止に取り組みます。
            </p>
          </div>
          <p className="text-[15px] text-ink-soft">
            技術的な詳しい内容は、
            <Link to="/security" className={`inline-link ${textLink}`}>
              セキュリティポリシー
            </Link>
            をご覧ください。
          </p>
        </div>
      </section>

      <section className="bg-ink py-20 text-paper">
        <div className={`${wrap} flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between`}>
          <div>
            <h2 className="text-3xl font-black leading-snug tracking-[-0.02em] sm:text-4xl">安心して、お店のLINEを任せてください</h2>
            <p className="mt-4 text-[17px] leading-[1.9] text-paper/80">無料プランから使えます。</p>
          </div>
          <Link to="/" state={{ scrollTo: 'auth', authMode: 'signup' }} className={`${btnPrimary} shrink-0`}>
            無料で始める
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </SiteShell>
  )
}
