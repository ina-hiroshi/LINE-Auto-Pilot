// 【一時ページ】予約画面のデザイン選定用。確認が終わったらこのファイルと
// bookingThemeLegacy.tmp.ts、App.tsx の該当ルート1行を削除する。
import { useState } from 'react'
import { Calendar, CheckCircle, Clock, Grid } from 'lucide-react'
import BookingScreenPreview, { type BookingPreviewScreen } from '../components/booking/BookingScreenPreview'
import { LOGO_LAYOUTS, type LogoLayout } from '../lib/bookingLogoLayout'
import { legacyTheme } from './bookingThemeLegacy.tmp'

// 見本用のロゴ（実際は店舗がアップロードした画像が入る）
const svgUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
const svg = (w: number, h: number, body: string) =>
  svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`)
const LOGOS = {
  square: {
    label: '正方形 1:1',
    url: svg(240, 240, '<rect width="240" height="240" rx="56" fill="#2F5D50"/><circle cx="120" cy="120" r="62" fill="none" stroke="#F3E9D2" stroke-width="10"/><text x="120" y="146" font-size="76" font-family="Georgia,serif" font-weight="700" text-anchor="middle" fill="#F3E9D2">I</text>'),
  },
  wide: {
    label: '横長 4:1',
    url: svg(640, 160, '<text x="320" y="84" font-size="84" font-family="Georgia,serif" font-weight="700" letter-spacing="10" text-anchor="middle" fill="#2F5D50">IROHA</text><text x="320" y="132" font-size="26" font-family="Helvetica,Arial,sans-serif" letter-spacing="14" text-anchor="middle" fill="#7A6A58">HAIR SALON</text>'),
  },
  tall: {
    label: '縦長 1:2',
    url: svg(120, 240, '<rect width="120" height="240" rx="10" fill="#2F5D50"/><text x="60" y="80" font-size="44" font-family="Georgia,serif" font-weight="700" text-anchor="middle" fill="#F3E9D2">I</text><text x="60" y="130" font-size="44" font-family="Georgia,serif" font-weight="700" text-anchor="middle" fill="#F3E9D2">R</text><text x="60" y="180" font-size="44" font-family="Georgia,serif" font-weight="700" text-anchor="middle" fill="#F3E9D2">H</text>'),
  },
  tiny: {
    label: '小さい画像 48px',
    url: svg(48, 48, '<rect width="48" height="48" rx="12" fill="#2F5D50"/><text x="24" y="33" font-size="26" font-family="Georgia,serif" font-weight="700" text-anchor="middle" fill="#F3E9D2">I</text>'),
  },
}
type LogoKey = keyof typeof LOGOS
type LogoSample = 'none' | LogoKey

const THEMES = [
  { id: 'simple', name: 'シンプル', plan: 'Free', note: '白地×テーマカラー。清潔で読みやすい標準デザイン' },
  { id: 'elegant', name: 'エレガント', plan: 'Pro', note: '生成りの紙とセリフ体。落ち着いた上品さ' },
  { id: 'pop', name: 'ポップ', plan: 'Pro', note: 'テーマカラーの淡い背景と丸い形。明るく元気' },
  { id: 'dark', name: 'ダーク', plan: 'Pro', note: '青みのある黒とスカイブルー。夜でも目に優しい' },
  { id: 'luxury', name: 'ラグジュアリー', plan: 'Pro', note: '深いワイン色の地、直角に近い形、金の細線1本。ダークとは地色と形で差を付けた高級感' },
  { id: 'natural', name: 'ナチュラル', plan: 'Pro', note: 'オート麦色と苔グリーン。温かみのあるオーガニック' },
]

const SCREENS: { id: BookingPreviewScreen; label: string }[] = [
  { id: 'menu', label: 'メニュー選択' },
  { id: 'date', label: '日時選択' },
  { id: 'info', label: 'お客様情報' },
  { id: 'confirm', label: '内容確認' },
  { id: 'complete', label: '完了' },
]

const PRESETS = ['#00c3dc', '#3b82f6', '#10b981', '#ef4444', '#f97316', '#8b5cf6', '#ec4899', '#111827']

/** 現行デザイン（比較用）。Booking.tsx の該当画面と同じクラスを再現している。 */
function LegacyScreen({ themeId, color, screen }: { themeId: string; color: string; screen: 'menu' | 'date' }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const theme: any = legacyTheme(themeId, color)
  const dates = [
    { l: '10/1', d: '水', dow: 3 },
    { l: '10/2', d: '木', dow: 4 },
    { l: '10/3', d: '金', dow: 5 },
    { l: '10/4', d: '土', dow: 6 },
    { l: '10/5', d: '日', dow: 0 },
  ]
  const avail: Record<string, boolean[]> = {
    '10:00': [true, true, false, true, false],
    '11:00': [true, false, true, true, true],
    '12:00': [false, true, true, false, true],
    '13:00': [true, true, true, true, false],
    '14:00': [true, false, true, false, true],
  }
  const menus = [
    { id: 'cut', name: 'カット', description: '髪質に合わせたスタイル提案つき', m: 60, p: 5500 },
    { id: 'color', name: 'カラー', description: '透明感のある仕上がり', m: 90, p: 8800 },
    { id: 'treat', name: 'トリートメント', description: '', m: 30, p: 4400 },
  ]
  const dark = themeId === 'dark'
  return (
    <div className={theme.container} style={{ minHeight: 0 }}>
      <div className={theme.card} style={theme.cardStyle}>
        <div className={theme.header} style={theme.headerStyle}>
          <h1 className={theme.title} style={theme.titleStyle}>予約フォーム</h1>
        </div>
        <div className="p-6">
          {screen === 'menu' && (
            <div>
              <h2 className={theme.title} style={theme.titleStyle}>
                <Grid color={theme.iconColor} /> メニュー選択
              </h2>
              <div className="space-y-4 mt-6">
                <div className="space-y-3">
                  {menus.map((m) => {
                    const sel = m.id === 'cut'
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={`w-full text-left flex justify-between items-center ${theme.selectableListItem(sel)}`}
                        style={sel && !dark ? { borderColor: color, backgroundColor: `${color}10` } : {}}
                      >
                        <div>
                          <div className={`font-bold ${theme.selectableItemText(sel)}`}>{m.name}</div>
                          {m.description && <div className={`text-xs mt-1 ${theme.selectableItemSubText(sel)}`}>{m.description}</div>}
                          <div className={`text-xs mt-2 flex gap-3 ${theme.selectableItemSubText(sel)}`}>
                            <span className="flex items-center gap-1"><Clock size={12} /> {m.m}分</span>
                            <span>¥{m.p.toLocaleString()}</span>
                          </div>
                        </div>
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${sel ? 'border-current' : dark ? 'border-slate-600' : 'border-gray-300'}`}
                          style={sel ? { borderColor: color } : {}}
                        >
                          {sel && <div className="w-3 h-3 rounded-full bg-current" style={{ backgroundColor: color }} />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
          {screen === 'date' && (
            <div>
              <h2 className={theme.title} style={theme.titleStyle}>
                <Calendar color={theme.iconColor} /> 日時を選択
              </h2>
              <div className={`mt-6 ${theme.summaryBox}`}>
                <div className="flex justify-between"><span className={theme.summaryLabel}>指名スタッフ:</span><span className={theme.summaryValue}>田中</span></div>
                <div className="flex justify-between"><span className={theme.summaryLabel}>メニュー:</span><span className={theme.summaryValue}>カット</span></div>
                <div className="flex justify-between items-center">
                  <span className={theme.summaryLabel}>詳細:</span>
                  <span className={`${theme.summaryValue} flex items-center gap-2 text-sm`}>
                    <span className="flex items-center gap-1"><Clock size={14} /> 60分</span><span>¥5,500</span>
                  </span>
                </div>
                <button type="button" className={theme.summaryLink}>選択し直す</button>
              </div>
              <div className="flex items-center justify-between mb-2">
                <label className={theme.label}>日時を選択</label>
                <div className={`flex items-center gap-3 text-xs ${theme.slotTable.legendText}`}>
                  <span className="flex items-center gap-1"><span className={`w-4 h-4 rounded text-xs flex items-center justify-center font-bold ${theme.slotTable.legendAvailable}`}>◯</span>可</span>
                  <span className="flex items-center gap-1"><span className={`w-4 h-4 rounded text-xs flex items-center justify-center font-bold ${theme.slotTable.legendUnavailable}`}>×</span>不可</span>
                </div>
              </div>
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full border-collapse min-w-max">
                  <thead>
                    <tr>
                      <th className={`sticky left-0 z-30 ${theme.slotTable.headerBg} p-2 text-xs font-bold ${theme.slotTable.headerText} border-b ${theme.slotTable.headerBorder} min-w-[50px]`}>時間</th>
                      {dates.map((d, i) => (
                        <th
                          key={d.l}
                          className={`${theme.slotTable.headerBg} p-2 text-center border-b ${theme.slotTable.headerBorder} min-w-[52px]`}
                          style={i === 1 ? { backgroundColor: `${color}20` } : {}}
                        >
                          <div className={`text-[10px] font-bold ${d.dow === 0 ? theme.slotTable.sundayText : d.dow === 6 ? theme.slotTable.saturdayText : theme.slotTable.headerText}`}>{d.l}</div>
                          <div className={`text-xs font-bold ${d.dow === 0 ? theme.slotTable.sundayText : d.dow === 6 ? theme.slotTable.saturdayText : theme.slotTable.weekdayText}`}>{d.d}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(avail).map((time) => (
                      <tr key={time} className={`border-b ${theme.slotTable.rowBorder} last:border-b-0`}>
                        <td className={`sticky left-0 z-10 ${theme.slotTable.timeCellBg} p-2 text-xs font-bold ${theme.slotTable.timeCellText} border-r ${theme.slotTable.timeCellBorder}`}>{time}</td>
                        {dates.map((d, i) => {
                          const ok = avail[time][i]
                          const sel = i === 1 && time === '11:00'
                          return (
                            <td key={d.l} className="p-1 text-center">
                              <button
                                type="button"
                                className={`w-10 h-10 rounded-lg text-lg font-bold transition-all ${
                                  sel ? 'text-white shadow-md transform scale-105' : ok ? `${theme.slotTable.availableBtn} cursor-pointer` : `${theme.slotTable.unavailableBtn} cursor-not-allowed`
                                }`}
                                style={sel ? { backgroundColor: color } : {}}
                              >
                                {sel ? '✓' : ok ? '◯' : '×'}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={theme.selectedDateBox} style={{ borderColor: color, backgroundColor: `${color}10` }}>
                <span className={theme.selectedDateLabel}>選択中：</span>
                <span className="font-bold ml-2" style={{ color }}>10月2日(木) 11:00</span>
              </div>
              <div className="flex gap-3 mt-8">
                <button type="button" className={theme.buttonSecondary}>戻る</button>
                <button type="button" className={theme.buttonPrimary} style={theme.primaryStyle}>次へ進む</button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 text-center text-[10px] text-gray-400 pb-2">サロン IToguchi</div>
    </div>
  )
}

function Phone({ label, children, cropHeight }: { label: string; children: React.ReactNode; cropHeight?: number }) {
  return (
    <figure className="shrink-0">
      <figcaption className="mb-2 max-w-[375px] text-xs font-semibold text-slate-500">{label}</figcaption>
      <div className="w-[375px] overflow-hidden rounded-[28px] ring-1 ring-slate-300 shadow-sm" style={cropHeight ? { height: cropHeight } : undefined}>
        {children}
      </div>
    </figure>
  )
}

export default function BookingThemePreview() {
  const [color, setColor] = useState('#00c3dc')
  const [showLegacy, setShowLegacy] = useState(true)
  const [only, setOnly] = useState<string>('all')
  const [logo, setLogo] = useState<LogoSample>('square')
  const [layout, setLayout] = useState<LogoLayout>('center')
  const visible = THEMES.filter((t) => only === 'all' || t.id === only)
  const logoUrl = logo === 'none' ? undefined : LOGOS[logo].url
  // ロゴ比較セクションで使うテーマ（絞り込み中はそのテーマ、全て表示中はシンプル）
  const logoCompareTheme = only === 'all' ? 'simple' : only

  return (
    <div className="min-h-screen bg-slate-200 text-slate-900 font-sans">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1800px] mx-auto px-6 py-3 flex flex-wrap items-center gap-x-8 gap-y-2">
          <div>
            <h1 className="text-base font-bold">予約画面デザイン選定（一時ページ）</h1>
            <p className="text-xs text-slate-500">各テーマの現行版と改良案を、スマホ幅(375px)で並べています。確認後に削除します。</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">テーマカラー</span>
            {PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setColor(c)}
                className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                style={{ backgroundColor: c, boxShadow: color === c ? '0 0 0 2px #fff, 0 0 0 4px #334155' : 'none' }}
              />
            ))}
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-9 h-7 p-0 bg-transparent" aria-label="カスタムカラー" />
            <span className="text-xs text-slate-500">※全テーマに反映。初期のシアンのままなら各テーマ標準色</span>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input type="checkbox" checked={showLegacy} onChange={(e) => setShowLegacy(e.target.checked)} /> 現行版を表示
          </label>
          <div className="flex items-center gap-2 flex-wrap text-xs font-semibold text-slate-600">
            ロゴ
            {([['none', 'なし'], ...(Object.entries(LOGOS).map(([k, v]) => [k, v.label]))] as [LogoSample, string][]).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setLogo(id)}
                className={`px-3 py-1 rounded-full ${logo === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {label}
              </button>
            ))}
            配置
            {LOGO_LAYOUTS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLayout(l.id)}
                className={`px-3 py-1 rounded-full ${layout === l.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {[{ id: 'all', name: '全て' }, ...THEMES].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setOnly(t.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold ${only === t.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-6 py-8 space-y-14">
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-bold">ロゴの配置 × 画像の縦横比</h2>
            <p className="text-sm text-slate-600">
              テーマ「{THEMES.find((t) => t.id === logoCompareTheme)?.name}」のヘッダー部分を、3つの配置×4種類の画像で並べています（上部のテーマ絞り込みで切り替え）。設定画面ではこの3つの配置をユーザーが選べます。
            </p>
          </div>
          <div className="space-y-6">
            {LOGO_LAYOUTS.map((l) => (
              <div key={l.id}>
                <h3 className="mb-2 text-sm font-bold text-slate-700">
                  {l.label}<span className="ml-3 font-normal text-slate-500">{l.hint}</span>
                </h3>
                <div className="flex flex-wrap gap-4 items-start">
                  {(Object.keys(LOGOS) as LogoKey[]).map((k) => (
                    <Phone key={k} label={LOGOS[k].label} cropHeight={230}>
                      <BookingScreenPreview themeId={logoCompareTheme} color={color} screen="menu" storeName="サロン IROHA" logoUrl={LOGOS[k].url} logoLayout={l.id} />
                    </Phone>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-xl font-bold">ダーク × ラグジュアリー（同じ色で比較）</h2>
            <p className="text-sm text-slate-600">
              上部で選んだテーマカラー（初期のシアンのときは、比較用に青 #3b82f6）を、両方に同じ色として当てています。
            </p>
          </div>
          <div className="flex flex-wrap gap-6 items-start">
            {(['dark', 'luxury'] as const).flatMap((id) =>
              (['menu', 'date'] as const).map((sc) => (
                <Phone key={`${id}-${sc}`} label={`${THEMES.find((t) => t.id === id)?.name}／${sc === 'menu' ? 'メニュー選択' : '日時選択'}`}>
                  <BookingScreenPreview themeId={id} color={color === '#00c3dc' ? '#3b82f6' : color} screen={sc} logoUrl={logoUrl} logoLayout={layout} storeName="サロン IROHA" />
                </Phone>
              )),
            )}
          </div>
        </section>

        {visible.map((th) => (
          <section key={th.id}>
            <div className="mb-4 flex items-baseline gap-3">
              <h2 className="text-xl font-bold">{th.name}</h2>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${th.plan === 'Free' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{th.plan}</span>
              <span className="text-sm text-slate-600">{th.note}</span>
            </div>
            <div className="flex flex-wrap gap-6 pb-4 items-start">
              {showLegacy && (
                <div className="flex gap-6 w-full pb-6 mb-2 border-b-2 border-dashed border-slate-400">
                  <Phone label="【現行】メニュー選択">
                    <LegacyScreen themeId={th.id} color={color} screen="menu" />
                  </Phone>
                  <Phone label="【現行】日時選択">
                    <LegacyScreen themeId={th.id} color={color} screen="date" />
                  </Phone>
                </div>
              )}
              {SCREENS.map((s) => (
                <Phone key={s.id} label={`【改良案】${s.label}`}>
                  <BookingScreenPreview themeId={th.id} color={color} screen={s.id} logoUrl={logoUrl} logoLayout={layout} />
                </Phone>
              ))}
            </div>
          </section>
        ))}
      </main>
      <footer className="pb-10 text-center text-xs text-slate-500 flex items-center justify-center gap-1">
        <CheckCircle size={14} /> 実装用の一時ページです（開発サーバーでのみ表示）
      </footer>
    </div>
  )
}
