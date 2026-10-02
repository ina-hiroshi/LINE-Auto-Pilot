import type { ReactNode } from 'react'
import { Save, User } from 'lucide-react'

/**
 * 管理画面を見せる枠。中身は実際の管理画面のスクリーンショットか、
 * 管理画面と同じ部品・同じ見た目で組み直したもの。
 */
export function AppWindow({
  label = '管理画面',
  children,
  className = '',
  note,
}: {
  label?: string
  children: ReactNode
  className?: string
  note?: string
}) {
  return (
    <figure className={`min-w-0 ${className}`}>
      <div className="overflow-hidden rounded-xl bg-white shadow-[0_18px_40px_-16px_rgb(28_42_48/0.35),0_0_0_1px_rgb(28_42_48/0.08)]">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2">
          <span className="font-slip text-[11px] tracking-wider text-ink-soft">{label}</span>
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="size-2 rounded-full bg-gray-300" />
            <span className="size-2 rounded-full bg-gray-300" />
          </span>
        </div>
        <div className="ui-real">{children}</div>
      </div>
      {note && <figcaption className="mt-2.5 font-slip text-[12px] text-ink-soft">{note}</figcaption>}
    </figure>
  )
}

export function Screenshot({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return <img src={src} alt={alt} loading="lazy" decoding="async" className={`block w-full ${className}`} />
}

const RESERVATIONS = [
  { time: '10:00', name: '山田 花子', menu: 'カット' },
  { time: '11:30', name: '佐藤 太郎', menu: 'カラー' },
  { time: '14:00', name: '田中 美咲', menu: 'パーマ' },
  { time: '16:30', name: '鈴木 一郎', menu: 'カット' },
]

/** 管理画面の予約一覧（リスト表示）を縮めたもの */
export function ReservationListMini() {
  return (
    <div className="p-4 text-gray-800">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[14px] font-bold">今日の予約</p>
        <p className="text-[11px] text-gray-500">10月2日（木）</p>
      </div>
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
        {RESERVATIONS.map((r) => (
          <li key={r.time} className="flex items-center gap-3 px-3 py-2.5">
            <span className="w-11 text-[13px] font-bold text-gray-900">{r.time}</span>
            <span className="grid size-7 place-items-center rounded-full bg-gray-100">
              <User className="size-3.5 text-gray-500" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 text-[13px]">
              <span className="whitespace-nowrap font-bold">{r.name}</span>
              <span className="block text-[11.5px] text-gray-500 sm:ml-2 sm:inline sm:text-[13px]">{r.menu}</span>
            </span>
            <span className="rounded bg-[#06C755]/12 px-2 py-0.5 text-[10.5px] font-bold text-[#047a35]">LINE予約</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const RULES = [
  { keyword: '営業時間', subs: ['何時まで', '開店'], response: '営業時間は10:00〜19:00です。定休日は毎週火曜日です。', active: true },
  { keyword: '駐車場', subs: ['車', 'パーキング'], response: '店舗前に2台分の駐車スペースがございます。', active: true },
  { keyword: '予約', subs: ['予約したい', '空き'], response: 'メニューの「予約する」からご予約いただけます。', active: true },
]

/** 管理画面のキーワード応答ルール一覧を縮めたもの */
export function KeywordRulesMini({ highlight }: { highlight?: string }) {
  return (
    <div className="p-4 text-gray-800">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[14px] font-bold">キーワード応答</p>
        <p className="text-[11px] text-gray-500">3 / 10 件（無料プラン）</p>
      </div>
      <ul className="space-y-2">
        {RULES.map((r) => (
          <li
            key={r.keyword}
            className={`rounded-lg border px-3 py-2.5 transition-colors ${
              highlight === r.keyword ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[13px] font-bold">{r.keyword}</span>
              {r.subs.map((s) => (
                <span key={s} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10.5px] text-gray-600">
                  {s}
                </span>
              ))}
              <span className="ml-auto h-4 w-7 rounded-full bg-primary-500 p-0.5" aria-label="有効">
                <span className="ml-auto block size-3 rounded-full bg-white" />
              </span>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-gray-600">{r.response}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 顧客詳細ページの「施術メモ」タブの1件 */
export function TreatmentMemo() {
  return (
    <div className="p-4 text-gray-800">
      <div className="mb-3 flex flex-wrap justify-between gap-2">
        <div>
          <p className="text-[14px] font-bold text-gray-900">2026年8月28日（金）</p>
          <p className="mt-0.5 text-[12px] text-gray-500">カラー・トリートメント · 佐藤スタイリスト</p>
        </div>
        <span className="h-fit rounded bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">完了</span>
      </div>
      <p className="mb-1 text-[11px] font-medium text-gray-500">施術メモ</p>
      <div className="min-h-[72px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-[13px] leading-relaxed text-gray-700">
        かゆみに敏感なので低刺激剤を使用。次回は集中トリートメントを提案する。
      </div>
      <div className="mt-2 flex justify-end">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-[11px] font-medium text-white">
          <Save className="size-3" aria-hidden="true" />
          保存
        </span>
      </div>
    </div>
  )
}
