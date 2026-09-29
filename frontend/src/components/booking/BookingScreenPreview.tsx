import { Calendar, Check, CheckCircle, Clock, Grid, User } from 'lucide-react'
import { getBookingTheme } from '../../lib/bookingTheme'
import BookingHeader from './BookingHeader'
import type { LogoLayout } from '../../lib/bookingLogoLayout'

export type BookingPreviewScreen = 'staff' | 'menu' | 'date' | 'info' | 'confirm' | 'complete'

type Props = {
  themeId: string
  color: string
  screen: BookingPreviewScreen
  storeName?: string
  /** 店舗のロゴ/アイコン画像（liff_logo_url）。未指定なら「予約フォーム」の見出しのみ */
  logoUrl?: string
  logoLayout?: LogoLayout
  className?: string
}

const MENUS = [
  { id: 'cut', name: 'カット', description: '髪質に合わせたスタイル提案つき', minutes: 60, price: 5500 },
  { id: 'color', name: 'カラー', description: '透明感のある仕上がり', minutes: 90, price: 8800 },
  { id: 'treat', name: 'トリートメント', description: '', minutes: 30, price: 4400 },
]

const STAFF = [
  { id: 's1', name: '田中', role: 'スタイリスト' },
  { id: 's2', name: '佐藤', role: 'トップスタイリスト' },
]

// 10/1(水)〜10/5(日)。値: true=空き / false=空きなし
const DATES = [
  { label: '10/1', day: '水', dow: 3 },
  { label: '10/2', day: '木', dow: 4 },
  { label: '10/3', day: '金', dow: 5 },
  { label: '10/4', day: '土', dow: 6 },
  { label: '10/5', day: '日', dow: 0 },
]
const TIMES = ['10:00', '11:00', '12:00', '13:00', '14:00']
const AVAILABILITY: Record<string, boolean[]> = {
  '10:00': [true, true, false, true, false],
  '11:00': [true, false, true, true, true],
  '12:00': [false, true, true, false, true],
  '13:00': [true, true, true, true, false],
  '14:00': [true, false, true, false, true],
}
const SELECTED = { date: 1, time: '11:00' }
// 上のテーブルで選択中にする枠（10/1 11:00）

export default function BookingScreenPreview({ themeId, color, screen, storeName = 'サロン IToguchi', logoUrl, logoLayout = 'center', className = '' }: Props) {
  const t = getBookingTheme(themeId, color)
  const menuSelected = 'cut'

  return (
    // min-h-screen は実画面用。プレビューでは内容の高さに合わせる。
    <div className={`${t.container} ${className}`} style={{ ...t.vars, minHeight: 0 }}>
      <div className={t.card}>
        <BookingHeader theme={t} logoUrl={logoUrl} storeName={storeName} layout={logoLayout} />

        <div className="p-6">
          {screen === 'staff' && (
            <div>
              <h2 className={t.title}>
                <User size={20} color={t.iconColor} /> スタッフ選択
              </h2>
              <div className="grid grid-cols-2 gap-3 mt-6">
                {STAFF.map((s, i) => (
                  <button key={s.id} type="button" className={t.selectableItem(i === 0)}>
                    <div className={t.avatar}>
                      <User size={30} className={t.avatarIcon} />
                    </div>
                    <div className="text-center">
                      <div className={`font-bold text-sm ${t.selectableItemText}`}>{s.name}</div>
                      <div className={`text-xs mt-1 ${t.selectableItemSubText}`}>{s.role}</div>
                    </div>
                  </button>
                ))}
                <button type="button" className={t.selectableItem(false)}>
                  <div className={t.avatar}>
                    <User size={30} className={t.avatarIcon} />
                  </div>
                  <div className={`font-bold text-sm ${t.selectableItemText}`}>指名なし</div>
                </button>
              </div>
            </div>
          )}

          {screen === 'menu' && (
            <div>
              <h2 className={t.title}>
                <Grid size={20} color={t.iconColor} /> メニュー選択
              </h2>
              <div className="space-y-3 mt-6">
                {MENUS.map((m) => {
                  const selected = m.id === menuSelected
                  return (
                    <button key={m.id} type="button" className={t.selectableListItem(selected)}>
                      <div>
                        <div className={`font-bold ${t.selectableItemText}`}>{m.name}</div>
                        {m.description && <div className={`text-xs mt-1 ${t.selectableItemSubText}`}>{m.description}</div>}
                        <div className={`text-xs mt-2 flex gap-3 ${t.selectableItemSubText}`}>
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> {m.minutes}分
                          </span>
                          <span>¥{m.price.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className={t.radio(selected)}>{selected && <Check size={14} strokeWidth={3} />}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {screen === 'date' && (
            <div>
              <h2 className={t.title}>
                <Calendar size={20} color={t.iconColor} /> 日時を選択
              </h2>

              <div className={`mt-6 ${t.summaryBox}`}>
                <div className="flex justify-between">
                  <span className={t.summaryLabel}>指名スタッフ:</span>
                  <span className={t.summaryValue}>田中</span>
                </div>
                <div className="flex justify-between">
                  <span className={t.summaryLabel}>メニュー:</span>
                  <span className={t.summaryValue}>カット</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={t.summaryLabel}>詳細:</span>
                  <span className={`${t.summaryValue} flex items-center gap-2`}>
                    <span className="flex items-center gap-1">
                      <Clock size={14} /> 60分
                    </span>
                    <span>¥5,500</span>
                  </span>
                </div>
                <button type="button" className={t.summaryLink}>
                  選択し直す
                </button>
              </div>

              <div className="flex items-center justify-between mb-2">
                <label className={`${t.label} !mb-0`}>日時を選択</label>
                <div className={`flex items-center gap-3 text-xs ${t.slotTable.legendText}`}>
                  <span className="flex items-center gap-1">
                    <span className={`w-5 h-5 flex items-center justify-center font-bold [border-radius:var(--bk-r-chip)] ${t.slotTable.legendAvailable}`}>◯</span>可
                  </span>
                  <span className="flex items-center gap-1">
                    <span className={`w-5 h-5 flex items-center justify-center font-bold ${t.slotTable.legendUnavailable}`}>×</span>不可
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full border-collapse min-w-max">
                  <thead>
                    <tr>
                      <th className={`sticky left-0 z-20 p-2 text-xs font-semibold [background-color:var(--bk-card)] ${t.slotTable.headerText}`}>時間</th>
                      {DATES.map((d, i) => {
                        const isSel = i === SELECTED.date
                        const dayColor = d.dow === 0 ? t.slotTable.sundayText : d.dow === 6 ? t.slotTable.saturdayText : t.slotTable.weekdayText
                        return (
                          <th key={d.label} className="p-0.5">
                            <div className={`${t.slotTable.headerCell} ${isSel ? t.slotTable.headerCellSelected : ''}`}>
                              <div className={`text-[10px] font-semibold ${d.dow === 0 ? t.slotTable.sundayText : d.dow === 6 ? t.slotTable.saturdayText : t.slotTable.headerText}`}>{d.label}</div>
                              <div className={`text-xs font-bold ${dayColor}`}>{d.day}</div>
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {TIMES.map((time) => (
                      <tr key={time}>
                        <td className={t.slotTable.timeCell}>{time}</td>
                        {DATES.map((d, i) => {
                          const ok = AVAILABILITY[time][i]
                          const sel = i === SELECTED.date && time === SELECTED.time
                          return (
                            <td key={d.label} className="p-0.5 text-center">
                              <button
                                type="button"
                                disabled={!ok}
                                className={`w-10 h-10 text-base font-bold transition [border-radius:var(--bk-r-chip)] ${
                                  sel ? t.slotTable.selectedBtn : ok ? t.slotTable.availableBtn : t.slotTable.unavailableBtn
                                }`}
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

              <div className={t.selectedDateBox}>
                <span className={t.selectedDateLabel}>選択中：</span>
                <span className={t.selectedDateValue}>10月2日(木) 11:00</span>
              </div>

              <div className="flex gap-3 mt-8">
                <button type="button" className={t.buttonSecondary}>戻る</button>
                <button type="button" className={t.buttonPrimary}>次へ進む</button>
              </div>
            </div>
          )}

          {screen === 'info' && (
            <div>
              <h2 className={t.title}>
                <User size={20} color={t.iconColor} /> お客様情報
              </h2>
              <div className="space-y-4 mt-6">
                <div className={`${t.infoBox} text-sm`}>初回予約のため、お名前を入力してください。</div>
                <div>
                  <label className={t.label}>お名前 (漢字)</label>
                  <input type="text" readOnly placeholder="例: 山田 太郎" className={t.input} />
                </div>
                <div>
                  <label className={t.label}>フリガナ</label>
                  <input type="text" readOnly defaultValue="ヤマダ" className={t.input} />
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button type="button" className={t.buttonSecondary}>戻る</button>
                <button type="button" className={t.buttonPrimary}>確認へ</button>
              </div>
            </div>
          )}

          {screen === 'confirm' && (
            <div>
              <h2 className={t.title}>
                <CheckCircle size={20} color={t.iconColor} /> 予約内容の確認
              </h2>
              <div className={`${t.infoBox} mt-6 mb-6`}>
                <dl className={t.infoRows}>
                  {[
                    ['日時', '2026-10-02 11:00'],
                    ['指名スタッフ', '田中'],
                    ['メニュー', 'カット (¥5,500)'],
                    ['お名前', '山田 太郎'],
                    ['フリガナ', 'ヤマダ タロウ'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <dt className={t.infoLabel}>{k}</dt>
                      <dd className={t.infoValue}>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="flex gap-3 mt-8">
                <button type="button" className={t.buttonSecondary}>修正する</button>
                <button type="button" className={t.buttonPrimary}>予約を確定する</button>
              </div>
            </div>
          )}

          {screen === 'complete' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 [background-color:var(--bk-accent)] [color:var(--bk-on-accent)]">
                <Check size={32} strokeWidth={3} />
              </div>
              <h2 className={t.title}>予約完了</h2>
              <p className={`mt-2 mb-6 text-sm ${t.selectableItemSubText}`}>ご予約ありがとうございます。</p>
              <div className={`${t.infoBox} text-left mb-6`}>
                <div className={`text-xs mb-1 ${t.infoLabel}`}>予約日時</div>
                <div className="text-xl font-bold mb-4">10月2日(木) 11:00</div>
                <div className={`text-xs mb-1 ${t.infoLabel}`}>メニュー</div>
                <div className="font-semibold">カット</div>
                <div className={`text-sm mt-0.5 ${t.selectableItemSubText}`}>60分 / ¥5,500</div>
              </div>
              <button type="button" className="font-bold [color:var(--bk-accent-text)]">閉じる</button>
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 text-center text-[10px] pb-2 [color:var(--bk-muted)]">{storeName}</div>
    </div>
  )
}
