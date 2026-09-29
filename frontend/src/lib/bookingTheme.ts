import type { CSSProperties } from 'react'
import type { LiffTheme } from '../components/liff/types'

/**
 * 予約画面（LIFF / プレビュー / トップページの機能紹介）で共有する見た目の定義。
 *
 * 設計方針
 * - 色・角丸・影はCSS変数（--bk-*）に集約し、クラス名は全テーマ共通にする。
 *   テーマごとの違いは「変数の値」と「書体・字間」だけで表す。
 * - 線は「いま選んでいる項目」の1本だけにする。カード・内側のまとまり・入力欄・
 *   日時表のセルは枠線ではなく背景の濃淡で区切る。
 * - テーマカラー（liff_theme_color）は全テーマでアクセント色（ボタン・選択中・空き枠）に反映する。
 *   ただし DB の初期値（DEFAULT_THEME_COLOR）のままなら「未設定」とみなし、
 *   各テーマ固有のアクセント色（ダークならスカイブルー等）を使う。
 *   暗い/明るい背景で読めない色が選ばれた場合は、背景に対して十分なコントラストが出るまで補正する。
 */

export type BookingThemeId = 'simple' | 'elegant' | 'pop' | 'dark' | 'luxury' | 'natural'

/** liff_theme_color の初期値。この値のままなら各テーマ標準のアクセント色を使う */
export const DEFAULT_THEME_COLOR = '#00c3dc'

type Palette = {
  bg: string
  card: string
  /** 入力欄・内側のまとまり・副ボタンの地色 */
  surface: string
  /** 押下時・人数ボタンなど、surface より一段濃い地色 */
  surfaceStrong: string
  text: string
  muted: string
  accent: string
  onAccent: string
  accentSoft: string
  /** アクセント色の文字用（淡い地の上でも読める濃さ） */
  accentText: string
  /** 空き枠（◯） */
  okBg: string
  okText: string
  /** 空きなし（×）・無効・未選択のラジオ */
  ng: string
  sun: string
  sat: string
  noticeBg: string
  noticeText: string
  shadow: string
  rCard: string
  rItem: string
  rBtn: string
  rChip: string
  rInput: string
}

type Feel = {
  font: string
  title: string
  label: string
  btn: string
  header: string
}

const tint = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, transparent)`
const mix = (c: string, pct: number, base: string) => `color-mix(in srgb, ${c} ${pct}%, ${base})`

type Rgb = [number, number, number]

function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const toHex = (rgb: Rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`

/** 背景色の上に載せる文字色（白 or 濃色）を明るさから決める */
function onColor(hex: string): string {
  const rgb = parseHex(hex)
  if (!rgb) return '#ffffff'
  return luminance(rgb) > 0.4 ? '#1a1a1a' : '#ffffff'
}

/**
 * hex を bg の上で min 以上のコントラストになるまで補正する。
 * 暗い背景なら白へ、明るい背景なら黒へ少しずつ寄せる（色相はなるべく保つ）。
 */
function readableOn(hex: string, bg: string, min: number): string {
  const c = parseHex(hex)
  const b = parseHex(bg)
  if (!c || !b) return hex
  const target = luminance(b) < 0.4 ? 255 : 0
  let cur = c
  for (let i = 0; i < 20; i++) {
    if (contrastRatio(cur, b) >= min) break
    cur = cur.map((v) => v + (target - v) * 0.1) as Rgb
  }
  return toHex(cur)
}

function palette(id: BookingThemeId, color: string): Palette {
  switch (id) {
    case 'elegant':
      return {
        bg: '#F4F0EA', card: '#FFFEFB', surface: '#F6F2EC', surfaceStrong: '#EAE3D9',
        text: '#2E2823', muted: '#6F655B',
        accent: '#3B332C', onAccent: '#FBF8F3', accentSoft: '#EEE7DC', accentText: '#3B332C',
        okBg: '#F0EBE2', okText: '#3B332C', ng: '#B9AE9F',
        sun: '#A83232', sat: '#3B5C8A',
        noticeBg: '#F0EBE2', noticeText: '#5A4E42',
        shadow: '0 1px 2px rgba(46,40,35,.05), 0 16px 40px -20px rgba(46,40,35,.25)',
        rCard: '6px', rItem: '4px', rBtn: '2px', rChip: '2px', rInput: '2px',
      }
    case 'pop':
      return {
        bg: mix(color, 10, '#ffffff'), card: '#FFFFFF', surface: '#F5F5F7', surfaceStrong: '#E9E9EE',
        text: '#1F2430', muted: '#5F6675',
        accent: color, onAccent: onColor(color), accentSoft: tint(color, 15), accentText: mix(color, 62, '#000000'),
        okBg: tint(color, 14), okText: mix(color, 62, '#000000'), ng: '#B7BCC7',
        sun: '#E11D48', sat: '#2563EB',
        noticeBg: '#FFF4CC', noticeText: '#7A5B00',
        shadow: `0 14px 32px -12px ${tint(color, 45)}`,
        rCard: '28px', rItem: '20px', rBtn: '999px', rChip: '999px', rInput: '16px',
      }
    case 'dark':
      return {
        bg: '#0A0E14', card: '#121821', surface: '#1A2230', surfaceStrong: '#243044',
        text: '#EEF2F7', muted: '#9AA6B8',
        accent: '#6CB6FF', onAccent: '#06121F', accentSoft: 'rgba(108,182,255,.16)', accentText: '#8CC8FF',
        okBg: 'rgba(108,182,255,.12)', okText: '#8CC8FF', ng: '#566276',
        sun: '#F87171', sat: '#7DB3FF',
        noticeBg: 'rgba(108,182,255,.12)', noticeText: '#A9D4FF',
        shadow: '0 24px 50px -20px rgba(0,0,0,.6)',
        rCard: '20px', rItem: '14px', rBtn: '12px', rChip: '10px', rInput: '12px',
      }
    case 'luxury':
      return {
        // ダーク（青みの黒・丸み）と並べても別物に見えるよう、地色は深いワイン、角はほぼ直角にする
        bg: '#150A0E', card: '#241219', surface: '#331A23', surfaceStrong: '#43222D',
        text: '#F6EBDD', muted: '#C4A99C',
        accent: '#D9B36B', onAccent: '#2A1218', accentSoft: 'rgba(217,179,107,.14)', accentText: '#E8CB8E',
        okBg: 'rgba(217,179,107,.12)', okText: '#E8CB8E', ng: '#80606A',
        sun: '#F29C90', sat: '#AFC4E6',
        noticeBg: 'rgba(217,179,107,.12)', noticeText: '#E8CB8E',
        shadow: '0 28px 60px -24px rgba(0,0,0,.75)',
        rCard: '2px', rItem: '2px', rBtn: '2px', rChip: '2px', rInput: '2px',
      }
    case 'natural':
      return {
        bg: '#EFEADF', card: '#FBF8F1', surface: '#F2EDE2', surfaceStrong: '#E6DFD0',
        text: '#33291F', muted: '#6E6250',
        accent: '#53702E', onAccent: '#FFFFFF', accentSoft: '#E3EAD3', accentText: '#3F5A22',
        okBg: '#E3EAD3', okText: '#3F5A22', ng: '#B5AA96',
        sun: '#B4442F', sat: '#3F6A8F',
        noticeBg: '#F3E7CF', noticeText: '#6B4E1E',
        shadow: '0 1px 2px rgba(51,41,31,.05), 0 16px 36px -18px rgba(83,60,30,.3)',
        rCard: '22px', rItem: '16px', rBtn: '14px', rChip: '12px', rInput: '14px',
      }
    case 'simple':
    default:
      return {
        bg: '#F5F6F8', card: '#FFFFFF', surface: '#F3F4F6', surfaceStrong: '#E6E8EC',
        text: '#111827', muted: '#5B6472',
        accent: color, onAccent: onColor(color), accentSoft: tint(color, 11), accentText: mix(color, 60, '#000000'),
        okBg: tint(color, 11), okText: mix(color, 60, '#000000'), ng: '#B4BAC4',
        sun: '#DC2626', sat: '#2563EB',
        noticeBg: '#EFF6FF', noticeText: '#1D4ED8',
        shadow: '0 1px 2px rgba(17,24,39,.04), 0 12px 32px -12px rgba(17,24,39,.12)',
        rCard: '20px', rItem: '14px', rBtn: '12px', rChip: '10px', rInput: '12px',
      }
  }
}

function feel(id: BookingThemeId): Feel {
  switch (id) {
    case 'elegant':
      return {
        font: 'font-serif',
        title: 'font-medium tracking-[0.14em]',
        label: 'tracking-[0.08em]',
        btn: 'font-medium tracking-[0.12em] text-[13px]',
        header: 'px-6 pt-9 pb-2 text-center',
      }
    case 'luxury':
      return {
        font: 'font-serif',
        title: 'font-normal tracking-[0.16em]',
        label: 'tracking-[0.08em]',
        btn: 'font-semibold tracking-[0.14em] text-[13px]',
        // 金の細線はこのテーマで使う唯一の線。アクセント色に追従する
        header: 'mx-6 px-0 pt-9 pb-5 text-center [border-bottom:1px_solid_color-mix(in_srgb,var(--bk-accent)_45%,transparent)]',
      }
    case 'pop':
      return {
        font: 'font-sans',
        title: 'font-extrabold tracking-tight',
        label: 'font-bold',
        btn: 'font-extrabold text-base',
        header: 'px-6 pt-8 pb-5 text-center [background-color:var(--bk-accent-soft)]',
      }
    case 'natural':
      return {
        font: 'font-sans',
        title: 'font-semibold',
        label: '',
        btn: 'font-semibold',
        header: 'px-6 pt-8 pb-2 text-center',
      }
    case 'dark':
      return {
        font: 'font-sans',
        title: 'font-semibold',
        label: '',
        btn: 'font-semibold',
        header: 'px-6 pt-8 pb-2 text-center',
      }
    case 'simple':
    default:
      return {
        font: 'font-sans',
        title: 'font-bold',
        label: '',
        btn: 'font-bold',
        header: 'px-6 pt-8 pb-2 text-center',
      }
  }
}

export interface BookingTheme extends LiffTheme {
  /** コンテナ（最上位の要素）の style に渡すCSS変数 */
  vars: CSSProperties
  container: string
  input: string
  label: string
  slotGrid: string
  selectableItem: (selected: boolean) => string
  selectableListItem: (selected: boolean) => string
  selectableItemText: string
  selectableItemSubText: string
  avatar: string
  avatarIcon: string
  radio: (selected: boolean) => string
  infoBox: string
  infoRows: string
  infoLabel: string
  infoValue: string
  actionButtonPrimary: string
  actionButtonSecondary: string
  summaryBox: string
  summaryLabel: string
  summaryValue: string
  summaryLink: string
  noticeBox: string
  noticeLink: string
  emptySlotBox: string
  selectedDateBox: string
  selectedDateLabel: string
  selectedDateValue: string
  partySizeEnabled: string
  partySizeDisabled: string
  partySizePlus: string
  partySizeText: string
  slotTable: {
    headerCell: string
    headerCellSelected: string
    headerText: string
    weekdayText: string
    sundayText: string
    saturdayText: string
    timeCell: string
    availableBtn: string
    unavailableBtn: string
    selectedBtn: string
    emptyCell: string
    legendText: string
    legendAvailable: string
    legendUnavailable: string
  }
}

export function getBookingTheme(templateId: string, color: string): BookingTheme {
  const id = (['simple', 'elegant', 'pop', 'dark', 'luxury', 'natural'] as const).find((t) => t === templateId) ?? 'simple'
  let p = palette(id, color)
  const f = feel(id)

  // simple / pop は palette() の時点でテーマカラーを反映済み。
  // それ以外は、初期値以外が選ばれたときだけアクセント系の色を差し替える。
  const custom = id !== 'simple' && id !== 'pop' && parseHex(color) !== null && color.toLowerCase() !== DEFAULT_THEME_COLOR
  if (custom) {
    const dark = id === 'dark' || id === 'luxury'
    const accent = readableOn(color, p.card, 3)
    const accentText = readableOn(color, p.surface, 4.5)
    const soft = tint(accent, dark ? 16 : 13)
    p = { ...p, accent, onAccent: onColor(accent), accentSoft: soft, accentText, okBg: soft, okText: accentText }
  }

  const vars = {
    '--bk-bg': p.bg,
    '--bk-card': p.card,
    '--bk-surface': p.surface,
    '--bk-surface-strong': p.surfaceStrong,
    '--bk-text': p.text,
    '--bk-muted': p.muted,
    '--bk-accent': p.accent,
    '--bk-on-accent': p.onAccent,
    '--bk-accent-soft': p.accentSoft,
    '--bk-accent-text': p.accentText,
    '--bk-ok-bg': p.okBg,
    '--bk-ok-text': p.okText,
    '--bk-ng': p.ng,
    '--bk-sun': p.sun,
    '--bk-sat': p.sat,
    '--bk-notice-bg': p.noticeBg,
    '--bk-notice-text': p.noticeText,
    '--bk-shadow': p.shadow,
    '--bk-r-card': p.rCard,
    '--bk-r-item': p.rItem,
    '--bk-r-btn': p.rBtn,
    '--bk-r-chip': p.rChip,
    '--bk-r-input': p.rInput,
  } as CSSProperties

  // 副ボタン・押下色など、全テーマで共通の面の組み合わせ
  const surface = '[background-color:var(--bk-surface)] [border-radius:var(--bk-r-item)]'
  const btnBase = 'w-full py-3.5 transition [border-radius:var(--bk-r-btn)]'
  const smallBtn = 'flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs transition [border-radius:var(--bk-r-btn)]'

  return {
    vars,
    container: `min-h-screen py-8 px-4 flex flex-col items-center justify-center transition-colors duration-300 [background-color:var(--bk-bg)] [color:var(--bk-text)] ${f.font}`,
    card: 'w-full max-w-md mx-auto overflow-hidden relative [background-color:var(--bk-card)] [border-radius:var(--bk-r-card)] [box-shadow:var(--bk-shadow)]',
    header: f.header,
    title: `text-lg flex items-center justify-center gap-2 [color:var(--bk-text)] ${f.title}`,
    label: `block text-xs font-semibold mb-2 [color:var(--bk-muted)] ${f.label}`,
    input: 'w-full px-4 py-3 outline-none transition-shadow [background-color:var(--bk-surface)] [color:var(--bk-text)] [border-radius:var(--bk-r-input)] placeholder:[color:var(--bk-muted)] placeholder:opacity-60 focus:[box-shadow:0_0_0_2px_var(--bk-accent)]',
    buttonPrimary: `${btnBase} [background-color:var(--bk-accent)] [color:var(--bk-on-accent)] active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed ${f.btn}`,
    buttonSecondary: `${btnBase} [background-color:var(--bk-surface)] [color:var(--bk-text)] active:[background-color:var(--bk-surface-strong)] ${f.btn}`,
    slotGrid: 'grid grid-cols-3 gap-3',
    // 選択中の1件だけ、アクセント色の線（内側1.5px）で示す。ほかは面の色だけ。
    selectableItem: (selected) =>
      `p-4 flex flex-col items-center gap-3 transition [border-radius:var(--bk-r-item)] ${
        selected
          ? '[background-color:var(--bk-accent-soft)] [box-shadow:inset_0_0_0_1.5px_var(--bk-accent)]'
          : '[background-color:var(--bk-surface)] active:[background-color:var(--bk-surface-strong)]'
      }`,
    selectableListItem: (selected) =>
      `w-full p-4 flex items-center justify-between gap-3 text-left transition [border-radius:var(--bk-r-item)] ${
        selected
          ? '[background-color:var(--bk-accent-soft)] [box-shadow:inset_0_0_0_1.5px_var(--bk-accent)]'
          : '[background-color:var(--bk-surface)] active:[background-color:var(--bk-surface-strong)]'
      }`,
    selectableItemText: '[color:var(--bk-text)]',
    selectableItemSubText: '[color:var(--bk-muted)]',
    avatar: 'w-16 h-16 rounded-full overflow-hidden flex items-center justify-center [background-color:var(--bk-surface-strong)]',
    avatarIcon: '[color:var(--bk-muted)]',
    radio: (selected) =>
      `w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
        selected
          ? '[background-color:var(--bk-accent)] [color:var(--bk-on-accent)]'
          : '[box-shadow:inset_0_0_0_1.5px_var(--bk-ng)]'
      }`,
    infoBox: `p-5 ${surface} [color:var(--bk-text)]`,
    infoRows: 'space-y-3 text-sm',
    infoLabel: 'shrink-0 [color:var(--bk-muted)]',
    infoValue: 'font-semibold text-right [color:var(--bk-text)]',
    actionButtonPrimary: `${smallBtn} [background-color:var(--bk-accent)] [color:var(--bk-on-accent)] active:opacity-80 ${f.btn}`,
    actionButtonSecondary: `${smallBtn} [background-color:var(--bk-surface-strong)] [color:var(--bk-text)] ${f.btn}`,
    summaryBox: `mb-6 p-4 text-sm space-y-1.5 ${surface}`,
    summaryLabel: '[color:var(--bk-muted)]',
    summaryValue: 'font-semibold [color:var(--bk-text)]',
    summaryLink: 'text-xs underline w-full text-right mt-2 [color:var(--bk-accent-text)]',
    noticeBox: 'mb-4 p-4 text-sm [background-color:var(--bk-notice-bg)] [color:var(--bk-notice-text)] [border-radius:var(--bk-r-item)]',
    noticeLink: 'block mt-1 underline font-semibold',
    emptySlotBox: `text-center py-8 text-sm [color:var(--bk-muted)] ${surface}`,
    selectedDateBox: 'mt-4 p-3 text-center text-sm [background-color:var(--bk-accent-soft)] [border-radius:var(--bk-r-item)]',
    selectedDateLabel: '[color:var(--bk-muted)]',
    selectedDateValue: 'font-bold ml-2 [color:var(--bk-accent-text)]',
    partySizeEnabled: '[background-color:var(--bk-surface-strong)] [color:var(--bk-text)]',
    partySizeDisabled: '[background-color:var(--bk-surface)] [color:var(--bk-ng)] cursor-not-allowed',
    partySizePlus: '[background-color:var(--bk-accent-soft)] [color:var(--bk-accent-text)]',
    partySizeText: 'text-2xl font-semibold min-w-[60px] text-center [color:var(--bk-text)]',
    iconColor: 'var(--bk-accent-text)',
    cardStyle: {},
    headerStyle: {},
    titleStyle: {},
    primaryStyle: {},
    slotTable: {
      headerCell: 'py-2 text-center min-w-[40px] [background-color:var(--bk-card)]',
      headerCellSelected: '[background-color:var(--bk-accent-soft)] [border-radius:var(--bk-r-chip)]',
      headerText: '[color:var(--bk-muted)]',
      weekdayText: '[color:var(--bk-text)]',
      sundayText: '[color:var(--bk-sun)]',
      saturdayText: '[color:var(--bk-sat)]',
      timeCell: 'sticky left-0 z-10 p-2 pr-3 text-xs font-semibold [background-color:var(--bk-card)] [color:var(--bk-muted)]',
      availableBtn: '[background-color:var(--bk-ok-bg)] [color:var(--bk-ok-text)] active:opacity-70 cursor-pointer',
      unavailableBtn: '[color:var(--bk-ng)] cursor-not-allowed',
      selectedBtn: '[background-color:var(--bk-accent)] [color:var(--bk-on-accent)]',
      emptyCell: '[color:var(--bk-ng)]',
      legendText: '[color:var(--bk-muted)]',
      legendAvailable: '[background-color:var(--bk-ok-bg)] [color:var(--bk-ok-text)]',
      legendUnavailable: '[color:var(--bk-ng)]',
    },
  }
}
