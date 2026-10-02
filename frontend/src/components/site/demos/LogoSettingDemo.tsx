import { useEffect, useRef, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { LOGO_LAYOUTS, type LogoLayout } from '../../../lib/bookingLogoLayout'

/**
 * 管理画面「予約ページ」タブのロゴ画像の設定（BookingPageTab）を、公開ページで試せるようにしたもの。
 * 画像と配置を選ぶと、その場で予約ページのプレビューに反映される。
 * 選んだ画像はこのページの中だけで表示し、どこにも送信・保存しない。
 */

// 見本のアイコン。画像ファイルは使わず、ここで描いている
const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

const SAMPLES: { id: string; label: string; url: string }[] = [
  {
    id: 'round',
    label: '丸いアイコン',
    url: svgUrl(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="58" fill="#155e75"/><circle cx="60" cy="60" r="48" fill="none" stroke="#cffafe" stroke-width="2"/><text x="60" y="76" text-anchor="middle" font-family="Georgia, serif" font-size="46" font-weight="700" fill="#fbfbf7">IT</text></svg>',
    ),
  },
  {
    id: 'wide',
    label: '横長のロゴ',
    url: svgUrl(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 96"><rect x="2" y="2" width="356" height="92" rx="14" fill="#fbfbf7" stroke="#1c2a30" stroke-width="3"/><circle cx="52" cy="48" r="26" fill="#00a3b8"/><text x="52" y="57" text-anchor="middle" font-family="Georgia, serif" font-size="26" font-weight="700" fill="#fbfbf7">S</text><text x="96" y="46" font-family="Georgia, serif" font-size="30" font-weight="700" fill="#1c2a30" letter-spacing="2">SALON</text><text x="98" y="72" font-family="Arial, sans-serif" font-size="16" fill="#4a5a61" letter-spacing="5">ITOGUCHI</text></svg>',
    ),
  },
]

// 管理画面と同じ条件（JPEG・PNG・GIF・WebP、5MBまで）
const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

type Props = {
  /** 選んだ内容。予約ページのプレビューにすぐ反映する */
  onChange: (logoUrl: string | undefined, layout: LogoLayout) => void
}

export default function LogoSettingDemo({ onChange }: Props) {
  const [draftUrl, setDraftUrl] = useState<string | undefined>()
  const [layout, setLayout] = useState<LogoLayout>('center')
  const [error, setError] = useState('')
  const objectUrl = useRef<string | null>(null)

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    },
    [],
  )

  const choose = (url: string | undefined) => {
    setDraftUrl(url)
    setError('')
    onChange(url, layout)
  }

  const handleFile = (file: File | undefined) => {
    if (!file) return
    if (!ALLOWED.includes(file.type)) {
      setError('JPEG・PNG・GIF・WebPの画像を選んでください')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('5MB以下の画像を選んでください')
      return
    }
    const previous = objectUrl.current
    objectUrl.current = URL.createObjectURL(file)
    choose(objectUrl.current)
    if (previous) URL.revokeObjectURL(previous)
  }


  return (
    <div className="ui-real rounded-xl border-2 border-rule bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] font-bold">
          お店のアイコン
          <span className="ml-1.5 font-slip text-[11px] text-ink-soft">Pro</span>
        </p>
        <span className="font-slip text-[11px] text-ink-soft">管理画面の設定（体験版）</span>
      </div>

      {/* 画像を選ぶ枠。管理画面と同じく、点線の枠に画像を置く */}
      <label
        className="mt-3 flex cursor-pointer items-center gap-4 rounded-lg border-2 border-dashed border-rule p-3 transition-colors hover:border-primary-500 hover:bg-primary-50/50 focus-within:border-primary-600"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          handleFile(e.dataTransfer.files[0])
        }}
      >
        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-counter">
          {draftUrl ? <img src={draftUrl} alt="選んだアイコン" className="max-h-full max-w-full object-contain" /> : <ImagePlus className="size-6 text-ink-soft" aria-hidden="true" />}
        </span>
        <span className="text-[14px] leading-snug">
          <span className="font-bold text-primary-800">画像を選ぶ</span>
          <span className="mt-0.5 block text-[12px] text-ink-soft">JPEG・PNG・GIF・WebP、5MBまで。画像は送信されません</span>
        </span>
        <input type="file" accept={ALLOWED.join(',')} className="sr-only" onChange={(e) => handleFile(e.target.files?.[0])} />
      </label>
      {error && <p className="mt-2 text-[13px] font-bold text-[#b3342a]">{error}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-ink-soft">見本で試す</span>
        {SAMPLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => choose(s.url)}
            aria-pressed={draftUrl === s.url}
            className={`flex items-center gap-1.5 rounded-md border px-2 py-1 font-bold transition-colors ${
              draftUrl === s.url ? 'border-ink bg-ink text-paper' : 'border-rule hover:border-ink/60'
            }`}
          >
            <img src={s.url} alt="" className="h-4 w-auto" />
            {s.label}
          </button>
        ))}
        {draftUrl && (
          <button type="button" onClick={() => choose(undefined)} className="px-1 font-bold text-ink-soft underline underline-offset-2 hover:text-ink">
            外す
          </button>
        )}
      </div>

      <fieldset className="mt-4">
        <legend className="text-[13px] font-bold">配置</legend>
        <div className="mt-2 inline-flex rounded-lg border-2 border-rule bg-white p-1">
          {LOGO_LAYOUTS.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={layout === l.id}
              title={l.hint}
              onClick={() => {
                setLayout(l.id)
                onChange(draftUrl, l.id)
              }}
              className={`rounded-md px-3 py-1 text-[13px] font-bold transition-colors ${layout === l.id ? 'bg-primary-100 text-ink' : 'text-ink-soft hover:text-ink'}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </fieldset>

      <p className="mt-3 text-[13px] text-ink-soft">選ぶと、右の予約ページにすぐ反映されます。</p>
    </div>
  )
}
