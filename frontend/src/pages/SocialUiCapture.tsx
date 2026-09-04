import { GuideTab } from '../features/line-settings/components/GuideTab'
import { User, Search, QrCode, ChevronRight, ArrowLeft } from 'lucide-react'
import { UnderlineTabs } from '../components/UnderlineTabs'

/**
 * カルーセル用に実コンポーネント／実レイアウトを画面キャプチャするための一時ページ。
 * 本番導線には載せない想定。
 */
export default function SocialUiCapture() {
  return (
    <div className="min-h-screen bg-slate-100 p-8 space-y-16">
      <section id="guide" className="max-w-3xl mx-auto">
        <GuideTab
          webhookUrl="https://xxxxx.supabase.co/functions/v1/line-webhook"
          onCopyWebhook={() => undefined}
          onNavigateConnection={() => undefined}
        />
      </section>

      <section id="customers" className="max-w-5xl mx-auto bg-white rounded-xl shadow overflow-hidden">
        <div className="px-8 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">顧客一覧</h1>
              <p className="text-sm text-gray-500">
                顧客を選択すると詳細ページで施術メモ・LINEメッセージを管理できます。
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <div className="relative w-64 hidden sm:block">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  readOnly
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg sm:text-sm"
                  placeholder="名前で検索..."
                />
              </div>
              <button
                type="button"
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg shadow-sm"
              >
                <QrCode className="w-4 h-4" />
                <span className="text-sm font-bold">会員証読取</span>
              </button>
            </div>
          </div>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['本名', 'LINE名', 'ポイント残高', '最終来店日', 'ステータス', ''].map((h) => (
                <th key={h || 'a'} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {[
              ['山田 花子', 'hana_y', '1,250 pt', '2026/9/1', 'VIP'],
              ['佐藤 太郎', 'taro_s', '480 pt', '2026/8/28', '会員'],
              ['鈴木 美咲', 'misaki', '2,100 pt', '2026/9/3', '会員'],
              ['高橋 健', 'ken_t', '90 pt', '2026/8/20', '会員'],
            ].map(([name, line, pt, last, status]) => (
              <tr key={name}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                      <User className="h-4 w-4 text-gray-500" />
                    </div>
                    <span className="text-sm font-medium text-gray-900">{name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{line}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{pt}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{last}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      status === 'VIP' ? 'bg-yellow-100 text-yellow-800' : 'bg-primary-100 text-primary-800'
                    }`}
                  >
                    {status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-gray-400">
                  <ChevronRight className="w-5 h-5 inline-block" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section id="customer-detail" className="max-w-4xl mx-auto bg-white rounded-xl shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <ArrowLeft className="w-5 h-5 text-gray-400" />
          <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
            山田
          </div>
          <div>
            <div className="text-xl font-bold text-gray-900">山田 花子</div>
            <div className="text-sm text-gray-500">hana_y ・ 1,250 pt ・ VIP</div>
          </div>
        </div>
        <div className="px-6 pt-2">
          <UnderlineTabs
            items={[
              { id: 'overview', label: '概要' },
              { id: 'treatment', label: '施術メモ' },
              { id: 'messages', label: 'メッセージ' },
            ]}
            activeId="treatment"
            onChange={() => undefined}
          />        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500">
            来店・予約ごとに施術内容や気づきを記録できます。日付・メニュー・ステータスは予約情報から表示しています。
          </p>
          {[
            ['2026/9/1', '整体60分', '右肩の張り強め。次回も同じメニュー推奨。'],
            ['2026/8/18', '整体60分', '腰の可動域が改善。ストレッチ指導済み。'],
            ['2026/8/4', '初診カウンセリング', '初診。姿勢のクセとデスクワークの影響。'],
          ].map(([date, menu, note]) => (
            <div key={date} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-bold text-gray-900">{date}</div>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{menu}</span>
              </div>
              <textarea
                readOnly
                className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-800 bg-gray-50"
                rows={2}
                value={note}
              />
              <div className="mt-2 flex justify-end">
                <button type="button" className="px-3 py-1.5 text-xs font-bold rounded-lg bg-primary-600 text-white">
                  保存
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="member-phone" className="mx-auto" style={{ width: 390 }}>
        <div className="bg-slate-100 rounded-[2rem] overflow-hidden shadow-xl border border-slate-200">
          <div className="bg-white px-4 pt-3 pb-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>9:41</span>
            <span className="font-semibold text-slate-800">会員証</span>
            <span>100%</span>
          </div>
          <div className="p-4 space-y-4 bg-gradient-to-b from-slate-50 to-slate-100 min-h-[720px]">
            <div className="rounded-xl shadow-xl p-4 relative overflow-hidden bg-slate-900 text-slate-200 border border-slate-700 min-h-[200px] flex flex-col">
              <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px]" />
              <div className="absolute top-0 left-0 w-full h-1 bg-primary-500" />
              <div className="relative z-10 flex flex-col h-full justify-between min-h-[180px]">
                <h3 className="font-bold text-lg tracking-wider">MEMBER&apos;S CARD</h3>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-xs mb-1 opacity-60">MEMBER NAME</p>
                    <p className="font-medium text-base tracking-wide">山田 太郎</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs mb-1 opacity-60">POINTS</p>
                    <p className="text-3xl font-bold text-primary-400">1,250 pt</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-700 flex justify-between text-xs text-slate-500">
                  <span>No. ABC12345</span>
                  <span>Rank: Gold</span>
                </div>
              </div>
            </div>
            <div className="rounded-xl shadow-sm p-6 text-center space-y-4 bg-slate-900 text-slate-200">
              <p className="text-sm text-slate-400">会員QRコード</p>
              <div className="flex justify-center">
                <div className="p-3 rounded-lg inline-block border-2 border-primary-500 bg-primary-500/10">
                  <img
                    src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=itoguchi-member-ABC12345"
                    alt="Member QR"
                    className="w-32 h-32 bg-white rounded"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500">ABC12345</p>
              <p className="text-[10px] text-slate-600">スタッフに提示してください</p>
            </div>
          </div>
        </div>
      </section>

      <section id="sales" className="max-w-5xl mx-auto space-y-6">
        <p className="text-xs text-gray-500">決済完了した予約のみを売上（税込）に含みます。</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">今月の総売上</p>
            <p className="text-2xl font-bold text-gray-900">¥428,000</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">決済完了件数</p>
            <p className="text-2xl font-bold text-gray-900">86件</p>
          </div>
          <div className="bg-white rounded-xl border border-amber-100 p-5 shadow-sm bg-amber-50/50">
            <p className="text-sm text-amber-800 mb-1">未決済（全期間）</p>
            <p className="text-2xl font-bold text-amber-900">4件</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-3">メニュー別 TOP</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>カット</span><span className="font-bold">¥186,000</span></div>
              <div className="flex justify-between"><span>カラー</span><span className="font-bold">¥142,000</span></div>
              <div className="flex justify-between"><span>ヘッドスパ</span><span className="font-bold">¥100,000</span></div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-3">スタッフ別 TOP</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>田中</span><span className="font-bold">¥210,000</span></div>
              <div className="flex justify-between"><span>佐藤</span><span className="font-bold">¥128,000</span></div>
              <div className="flex justify-between"><span>鈴木</span><span className="font-bold">¥90,000</span></div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4">日別売上（担当別）</h3>
          <div className="h-48 flex items-end gap-3 px-2">
            {[55, 70, 40, 85, 60, 75, 50].map((h, i) => (
              <div key={i} className="flex-1 bg-primary-600 rounded-t" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
