/**
 * 予約の受付・変更・キャンセルを知らせる Flex Message を組み立てる（副作用なし）。
 *
 * 予約ページ（frontend/src/pages/Booking.tsx）のテーマ
 * （simple / elegant / pop / dark / luxury / natural）に配色を合わせる。
 * Flex では CSS のようには再現できないため、背景・文字・強調色の対応にとどめる。
 *
 * 注意:
 * - Flex の text は空文字だと LINE が 400 を返して全体が送れない。値は必ず非空にする
 * - button の文字色は指定できない（primary は自動で白）。暗い配色でも読めるよう、
 *   ボタンは box + action で作って文字色を自分で決める
 */

import type { LinkKind } from './link-code.ts'

export type ReservationFlexInput = {
  kind: LinkKind
  storeName: string
  logoUrl?: string | null
  /** stores.liff_template_id。無料プランでは 'simple' として渡すこと */
  templateId?: string | null
  /** stores.liff_theme_color（simple / pop の強調色） */
  themeColor?: string | null
  startTime: string | Date
  endTime?: string | Date | null
  menuName?: string | null
  staffName?: string | null
  memo?: string | null
  address?: string | null
  phone?: string | null
  /** 「予約の確認・変更」ボタンの遷移先（LIFF の URL）。無ければボタンを出さない */
  liffUrl?: string | null
}

export type FlexMessage = {
  type: 'flex'
  altText: string
  // deno-lint-ignore no-explicit-any
  contents: any
}

type Palette = {
  headerBg: string
  bodyBg: string
  title: string
  text: string
  label: string
  border: string
  buttonBg: string
  buttonText: string
  cornerRadius: string
}

const DEFAULT_THEME_COLOR = '#00c3dc'

export function normalizeThemeColor(color: string | null | undefined): string {
  return typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_THEME_COLOR
}

export function resolvePalette(templateId: string | null | undefined, themeColor?: string | null): Palette {
  const accent = normalizeThemeColor(themeColor)

  switch (templateId) {
    case 'elegant':
      return {
        headerBg: '#F5F5F4', bodyBg: '#FFFFFF', title: '#44403C', text: '#44403C', label: '#78716C',
        border: '#E7E5E4', buttonBg: '#44403C', buttonText: '#F5F5F4', cornerRadius: '2px',
      }
    case 'pop':
      return {
        headerBg: '#F9FAFB', bodyBg: '#FFFFFF', title: '#1F2937', text: '#374151', label: '#9CA3AF',
        border: '#F3F4F6', buttonBg: accent, buttonText: '#FFFFFF', cornerRadius: '24px',
      }
    case 'dark':
      return {
        headerBg: '#020617', bodyBg: '#0F172A', title: '#FFFFFF', text: '#E2E8F0', label: '#94A3B8',
        border: '#1E293B', buttonBg: '#FFFFFF', buttonText: '#0F172A', cornerRadius: '8px',
      }
    case 'luxury':
      return {
        headerBg: '#0C0A09', bodyBg: '#1C1917', title: '#FEF3C7', text: '#FDE68A', label: '#B45309',
        border: '#78350F', buttonBg: '#D97706', buttonText: '#1C1917', cornerRadius: '4px',
      }
    case 'natural':
      return {
        headerBg: '#FEF3C7', bodyBg: '#FFF7ED', title: '#451A03', text: '#451A03', label: '#92400E',
        border: '#FDE68A', buttonBg: '#4D7C0F', buttonText: '#FFFFFF', cornerRadius: '12px',
      }
    default:
      return {
        headerBg: '#FFFFFF', bodyBg: '#FFFFFF', title: '#1F2937', text: '#374151', label: '#6B7280',
        border: '#F3F4F6', buttonBg: accent, buttonText: '#FFFFFF', cornerRadius: '8px',
      }
  }
}

const KIND_TEXT: Record<LinkKind, { title: string; button: string }> = {
  created: { title: 'ご予約を受け付けました', button: '予約の確認・変更' },
  updated: { title: 'ご予約を変更しました', button: '予約の確認・変更' },
  cancelled: { title: 'ご予約をキャンセルしました', button: 'あらためて予約する' },
}

/** JST の「2026年10月3日（土）」と「14:00」を返す */
export function formatJstDateTime(value: string | Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return {
    date: `${get('year')}年${get('month')}月${get('day')}日（${get('weekday')}）`,
    time: `${get('hour')}:${get('minute')}`,
  }
}

function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function buildReservationFlex(input: ReservationFlexInput): FlexMessage {
  const palette = resolvePalette(input.templateId, input.themeColor)
  const texts = KIND_TEXT[input.kind]
  const storeName = nonEmpty(input.storeName) ?? 'ご予約'

  const start = formatJstDateTime(input.startTime)
  const end = input.endTime ? formatJstDateTime(input.endTime) : null
  const timeLabel = end && end.time !== start.time ? `${start.time}〜${end.time}` : start.time

  const rows: Array<[string, string]> = [['日時', `${start.date}\n${timeLabel}`]]
  const menu = nonEmpty(input.menuName)
  const staff = nonEmpty(input.staffName)
  const memo = nonEmpty(input.memo)
  const address = nonEmpty(input.address)
  const phone = nonEmpty(input.phone)
  if (menu) rows.push(['メニュー', clip(menu, 80)])
  if (staff) rows.push(['担当', clip(staff, 40)])
  if (memo) rows.push(['ご要望', clip(memo, 200)])
  if (address) rows.push(['住所', clip(address, 120)])
  if (phone) rows.push(['電話', clip(phone, 30)])

  const headerContents: unknown[] = []
  if (input.logoUrl && input.logoUrl.startsWith('https://')) {
    headerContents.push({
      type: 'image',
      url: input.logoUrl,
      size: 'full',
      aspectRatio: '4:1',
      aspectMode: 'fit',
      margin: 'none',
    })
  }
  headerContents.push({
    type: 'text',
    text: clip(storeName, 40),
    size: 'sm',
    color: palette.label,
    align: 'center',
    wrap: true,
    margin: headerContents.length > 0 ? 'md' : 'none',
  })
  headerContents.push({
    type: 'text',
    text: texts.title,
    size: 'lg',
    weight: 'bold',
    color: palette.title,
    align: 'center',
    wrap: true,
    margin: 'sm',
  })

  const bodyContents = rows.map(([label, value], index) => ({
    type: 'box',
    layout: 'horizontal',
    spacing: 'md',
    margin: index === 0 ? 'none' : 'lg',
    contents: [
      { type: 'text', text: label, size: 'sm', color: palette.label, flex: 2 },
      { type: 'text', text: value, size: 'sm', color: palette.text, wrap: true, flex: 5 },
    ],
  }))

  const bubble: Record<string, unknown> = {
    type: 'bubble',
    size: 'mega',
    styles: {
      header: { backgroundColor: palette.headerBg },
      body: { backgroundColor: palette.bodyBg, separator: true, separatorColor: palette.border },
      footer: { backgroundColor: palette.bodyBg },
    },
    header: {
      type: 'box',
      layout: 'vertical',
      paddingAll: 'lg',
      contents: headerContents,
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: 'lg',
      contents: bodyContents,
    },
  }

  if (input.liffUrl) {
    bubble.footer = {
      type: 'box',
      layout: 'vertical',
      paddingAll: 'lg',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          backgroundColor: palette.buttonBg,
          cornerRadius: palette.cornerRadius,
          paddingAll: 'md',
          action: { type: 'uri', label: texts.button, uri: input.liffUrl },
          contents: [
            {
              type: 'text',
              text: texts.button,
              color: palette.buttonText,
              weight: 'bold',
              align: 'center',
            },
          ],
        },
      ],
    }
  }

  return {
    type: 'flex',
    altText: clip(`【${storeName}】${texts.title}（${start.date} ${timeLabel}）`, 400),
    contents: bubble,
  }
}
