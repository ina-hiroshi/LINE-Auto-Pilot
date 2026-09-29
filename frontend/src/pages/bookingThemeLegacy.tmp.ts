/* eslint-disable */
// 特設ページ用: 現行テーマ定義(Booking.tsx 893-1358行)のうち、比較画面で使うキーを転記したもの。
// 値は現行のまま。特設ページと一緒に削除する。
const container = 'min-h-screen py-8 px-4 transition-colors duration-300 flex flex-col items-center justify-center'
const card = 'w-full max-w-md mx-auto overflow-hidden transition-all duration-300 relative'

type Sel = (s: boolean) => string
const same = (v: string): Sel => () => v

export function legacyTheme(t: string, c: string): any {
  switch (t) {
    case 'elegant':
      return {
        container: `${container} bg-[#F5F5F4] font-serif`,
        card: `${card} bg-white shadow-xl border border-[#E7E5E4] rounded-sm`,
        header: 'p-8 text-center border-b border-[#E7E5E4]',
        title: 'text-xl tracking-[0.2em] text-[#44403C] font-medium flex items-center justify-center gap-3',
        label: 'block text-xs font-bold text-[#78716C] mb-2 tracking-widest uppercase',
        buttonPrimary: 'w-full py-4 bg-[#44403C] text-[#F5F5F4] uppercase tracking-[0.2em] text-xs rounded-sm shadow-sm transition-colors active:bg-[#292524]',
        buttonSecondary: 'w-full py-4 bg-transparent border border-[#D6D3D1] text-[#78716C] uppercase tracking-[0.2em] text-xs rounded-sm transition-colors active:bg-[#F5F5F4]',
        selectableListItem: (s: boolean) => `
            w-full p-4 rounded-xl border-2 transition-all flex items-center justify-between gap-3 text-left
            ${s ? 'border-[#44403C] bg-[#44403C]/10' : 'border-[#E7E5E4] bg-white active:border-[#D6D3D1]'}
          `,
        selectableItemText: same('text-[#44403C]'),
        selectableItemSubText: same('text-[#78716C]'),
        summaryBox: 'mb-6 p-4 bg-[#FAFAF9] rounded-sm border border-[#E7E5E4] text-sm space-y-1',
        summaryLabel: 'text-[#78716C]',
        summaryValue: 'font-medium text-[#44403C]',
        summaryLink: 'text-xs text-[#57534E] underline w-full text-right mt-2',
        selectedDateBox: 'mt-4 p-3 rounded-sm border-2 text-center',
        selectedDateLabel: 'text-sm text-[#78716C]',
        iconColor: '#57534E',
        primaryStyle: {}, headerStyle: {}, titleStyle: {}, cardStyle: {},
        slotTable: {
          headerBg: 'bg-[#FAFAF9]', headerText: 'text-[#78716C]', headerBorder: 'border-[#E7E5E4]',
          timeCellBg: 'bg-[#FAFAF9]', timeCellText: 'text-[#57534E]', timeCellBorder: 'border-[#E7E5E4]',
          rowBorder: 'border-[#E7E5E4]',
          availableBtn: 'bg-white border border-[#D6D3D1] text-[#44403C]',
          unavailableBtn: 'bg-[#F5F5F4] text-[#D6D3D1]',
          sundayText: 'text-[#B91C1C]', saturdayText: 'text-[#1D4ED8]', weekdayText: 'text-[#57534E]',
          legendText: 'text-[#78716C]',
          legendAvailable: 'border-[#D6D3D1] bg-white text-[#44403C]',
          legendUnavailable: 'bg-[#F5F5F4] text-[#D6D3D1]',
        },
      }

    case 'pop':
      return {
        container: `${container} bg-gray-50 font-sans`,
        card: `${card} bg-white rounded-[40px] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] border-4 border-white`,
        header: 'p-8 text-center bg-gray-50 rounded-b-[40px] mb-4 mx-2',
        title: 'text-2xl font-black tracking-tight flex items-center justify-center gap-2',
        label: 'block text-sm font-bold text-gray-400 mb-2 ml-3',
        buttonPrimary: 'w-full py-4 text-white font-black rounded-full shadow-lg active:shadow-xl active:-translate-y-1 transition-all text-lg',
        buttonSecondary: 'w-full py-4 bg-white text-gray-500 font-black rounded-full border-2 border-gray-100 active:bg-gray-50 transition-all',
        selectableListItem: (s: boolean) => `
            p-4 rounded-xl border-2 transition-all flex flex-row items-center gap-3
            ${s ? 'border-current bg-opacity-10' : 'border-gray-100 bg-white active:border-gray-200'}
          `,
        selectableItemText: same('text-gray-800'),
        selectableItemSubText: same('text-gray-500'),
        summaryBox: 'mb-6 p-4 bg-gray-50 rounded-3xl border-2 border-gray-100 text-sm space-y-1',
        summaryLabel: 'text-gray-500',
        summaryValue: 'font-bold text-gray-800',
        summaryLink: 'text-xs text-blue-500 underline w-full text-right mt-2',
        selectedDateBox: 'mt-4 p-3 rounded-2xl border-2 text-center',
        selectedDateLabel: 'text-sm text-gray-600',
        iconColor: c,
        primaryStyle: { backgroundColor: c, borderColor: c },
        headerStyle: { backgroundColor: `${c}15` },
        titleStyle: { color: c },
        cardStyle: {},
        slotTable: {
          headerBg: 'bg-white', headerText: 'text-gray-500', headerBorder: 'border-gray-200',
          timeCellBg: 'bg-white', timeCellText: 'text-gray-600', timeCellBorder: 'border-gray-100',
          rowBorder: 'border-gray-100',
          availableBtn: 'bg-white border-2 border-gray-200 text-emerald-500',
          unavailableBtn: 'bg-gray-100 text-gray-300',
          sundayText: 'text-red-500', saturdayText: 'text-blue-500', weekdayText: 'text-gray-700',
          legendText: 'text-gray-500',
          legendAvailable: 'border-2 border-gray-200 bg-white text-emerald-500',
          legendUnavailable: 'bg-gray-100 text-gray-300',
        },
      }

    case 'dark':
      return {
        container: `${container} bg-slate-950 font-sans`,
        card: `${card} bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-slate-200`,
        header: 'p-6 text-center border-b border-slate-800 bg-slate-900/50 backdrop-blur',
        title: 'text-xl font-bold text-white flex items-center justify-center gap-2',
        label: 'block text-sm font-medium text-slate-300 mb-2',
        buttonPrimary: 'w-full py-3 bg-white text-slate-900 font-bold rounded-lg active:bg-slate-200 shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all',
        buttonSecondary: 'w-full py-3 bg-slate-800 text-slate-200 border border-slate-700 font-bold rounded-lg active:bg-slate-700 transition-all',
        selectableListItem: (s: boolean) => `
            p-4 rounded-xl border-2 transition-all flex flex-row items-center gap-3
            ${s ? 'bg-white text-slate-900 border-white shadow-[0_0_15px_rgba(255,255,255,0.4)]' : 'bg-slate-800 text-slate-200 border-slate-700 active:border-slate-500'}
          `,
        selectableItemText: (s: boolean) => (s ? 'text-slate-900' : 'text-white'),
        selectableItemSubText: (s: boolean) => (s ? 'text-slate-600' : 'text-slate-400'),
        summaryBox: 'mb-6 p-3 bg-slate-800 rounded-lg border border-slate-700 text-sm space-y-1',
        summaryLabel: 'text-slate-400',
        summaryValue: 'font-bold text-white',
        summaryLink: 'text-xs text-cyan-400 underline w-full text-right mt-2',
        selectedDateBox: 'mt-4 p-3 rounded-lg border-2 text-center',
        selectedDateLabel: 'text-sm text-slate-400',
        iconColor: 'white',
        primaryStyle: {},
        headerStyle: {},
        titleStyle: { textShadow: `0 0 20px ${c}` },
        cardStyle: {},
        slotTable: {
          headerBg: 'bg-slate-900', headerText: 'text-slate-400', headerBorder: 'border-slate-700',
          timeCellBg: 'bg-slate-900', timeCellText: 'text-slate-300', timeCellBorder: 'border-slate-800',
          rowBorder: 'border-slate-800',
          availableBtn: 'bg-slate-800 border border-slate-600 text-emerald-400',
          unavailableBtn: 'bg-slate-900 text-slate-600',
          sundayText: 'text-red-400', saturdayText: 'text-blue-400', weekdayText: 'text-slate-300',
          legendText: 'text-slate-400',
          legendAvailable: 'border border-slate-600 bg-slate-800 text-emerald-400',
          legendUnavailable: 'bg-slate-900 text-slate-600',
        },
      }

    case 'luxury':
      return {
        container: `${container} bg-gradient-to-br from-stone-950 via-stone-900 to-stone-950 font-serif`,
        card: `${card} bg-gradient-to-br from-stone-900 to-stone-950 border border-amber-600/30 rounded-lg shadow-[0_0_60px_-15px_rgba(217,119,6,0.3)]`,
        header: 'p-8 text-center border-b border-amber-600/20 bg-gradient-to-r from-amber-900/10 via-amber-600/10 to-amber-900/10',
        title: 'text-xl font-light tracking-[0.15em] text-amber-100 flex items-center justify-center gap-3',
        label: 'block text-xs font-medium text-amber-200/70 mb-2 tracking-wider uppercase',
        buttonPrimary: 'w-full py-4 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-stone-900 font-semibold tracking-wider rounded shadow-lg shadow-amber-600/20 active:from-amber-500 active:to-amber-500 transition-all',
        buttonSecondary: 'w-full py-4 bg-transparent border border-amber-600/50 text-amber-200 font-medium tracking-wider rounded active:bg-amber-600/10 transition-all',
        selectableListItem: (s: boolean) => `
            w-full p-5 rounded-lg border transition-all flex items-center justify-between gap-3 text-left
            ${s ? 'bg-gradient-to-br from-amber-600/20 to-amber-900/20 border-amber-500 shadow-lg shadow-amber-600/20' : 'bg-stone-900/50 border-amber-600/20 active:border-amber-500'}
          `,
        selectableItemText: same('text-amber-100'),
        selectableItemSubText: (s: boolean) => (s ? 'text-amber-200/70' : 'text-amber-200/50'),
        summaryBox: 'mb-6 p-4 bg-stone-900/50 rounded-lg border border-amber-600/20 text-sm space-y-2',
        summaryLabel: 'text-amber-200/60',
        summaryValue: 'font-medium text-amber-100',
        summaryLink: 'text-xs text-amber-400 underline w-full text-right mt-2',
        selectedDateBox: 'mt-4 p-3 rounded-lg border text-center',
        selectedDateLabel: 'text-sm text-amber-200/60',
        iconColor: '#fbbf24',
        primaryStyle: {}, headerStyle: {}, titleStyle: {}, cardStyle: {},
        slotTable: {
          headerBg: 'bg-stone-900/50', headerText: 'text-amber-200/60', headerBorder: 'border-amber-600/20',
          timeCellBg: 'bg-stone-900/50', timeCellText: 'text-amber-100', timeCellBorder: 'border-amber-600/10',
          rowBorder: 'border-amber-600/10',
          availableBtn: 'bg-stone-900/30 border border-amber-600/30 text-amber-400',
          unavailableBtn: 'bg-stone-950 text-amber-200/20',
          sundayText: 'text-red-400', saturdayText: 'text-blue-400', weekdayText: 'text-amber-100',
          legendText: 'text-amber-200/60',
          legendAvailable: 'border border-amber-600/30 bg-stone-900/30 text-amber-400',
          legendUnavailable: 'bg-stone-950 text-amber-200/20',
        },
      }

    case 'natural':
      return {
        container: `${container} bg-gradient-to-b from-amber-100/60 via-orange-50/40 to-lime-50/30 font-sans`,
        card: `${card} bg-gradient-to-br from-orange-50/95 to-amber-50/90 backdrop-blur border border-amber-300/40 rounded-2xl shadow-xl shadow-amber-900/10`,
        header: 'p-6 text-center border-b border-amber-200/60 bg-gradient-to-r from-amber-100/50 via-orange-50/30 to-lime-50/40',
        title: 'text-lg font-semibold text-amber-950 flex items-center justify-center gap-2',
        label: 'block text-sm font-medium text-amber-900 mb-2',
        buttonPrimary: 'w-full py-3.5 bg-gradient-to-r from-lime-700 via-lime-600 to-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-lime-700/25 active:from-lime-800 active:to-emerald-700 transition-all',
        buttonSecondary: 'w-full py-3.5 bg-gradient-to-r from-amber-100/80 to-orange-100/60 border border-amber-300/50 text-amber-900 font-medium rounded-xl active:from-amber-200/80 transition-all',
        selectableListItem: (s: boolean) => `
            w-full p-4 rounded-xl border transition-all flex items-center justify-between gap-3 text-left
            ${s ? 'bg-gradient-to-br from-lime-100/80 to-emerald-100/60 border-lime-500 shadow-lg shadow-lime-600/15' : 'bg-gradient-to-br from-amber-50/60 to-orange-50/40 border-amber-300/40 active:border-lime-400'}
          `,
        selectableItemText: (s: boolean) => (s ? 'text-lime-900' : 'text-amber-950'),
        selectableItemSubText: (s: boolean) => (s ? 'text-lime-800' : 'text-amber-800'),
        summaryBox: 'mb-6 p-4 bg-gradient-to-br from-amber-100/50 via-orange-50/40 to-lime-100/30 rounded-xl border border-amber-300/40 text-sm space-y-1',
        summaryLabel: 'text-amber-800',
        summaryValue: 'font-semibold text-amber-950',
        summaryLink: 'text-xs text-lime-700 underline w-full text-right mt-2',
        selectedDateBox: 'mt-4 p-3 rounded-xl border text-center',
        selectedDateLabel: 'text-sm text-amber-800',
        iconColor: '#92400e',
        primaryStyle: {}, headerStyle: {}, titleStyle: {}, cardStyle: {},
        slotTable: {
          headerBg: 'bg-gradient-to-r from-amber-100/70 to-orange-100/50', headerText: 'text-amber-800', headerBorder: 'border-amber-300/40',
          timeCellBg: 'bg-gradient-to-r from-amber-100/50 to-orange-50/40', timeCellText: 'text-amber-900', timeCellBorder: 'border-amber-200/50',
          rowBorder: 'border-amber-200/40',
          availableBtn: 'bg-gradient-to-br from-amber-50/70 to-orange-50/50 border border-amber-300/40 text-lime-800',
          unavailableBtn: 'bg-stone-100/40 text-stone-400',
          sundayText: 'text-red-600', saturdayText: 'text-blue-600', weekdayText: 'text-amber-950',
          legendText: 'text-amber-800',
          legendAvailable: 'border border-amber-300/40 bg-gradient-to-br from-amber-50/70 to-orange-50/50 text-lime-800',
          legendUnavailable: 'bg-stone-100/40 text-stone-400',
        },
      }

    case 'simple':
    default:
      return {
        container: `${container} bg-gray-50 font-sans`,
        card: `${card} bg-white shadow-sm border border-gray-100 rounded-xl`,
        header: 'p-5 text-center border-b border-gray-100',
        title: 'text-lg font-bold text-gray-800 flex items-center justify-center gap-2',
        label: 'block text-sm font-medium text-gray-700 mb-2',
        buttonPrimary: 'w-full py-3 text-white font-bold rounded-lg shadow-sm active:opacity-90 transition-opacity',
        buttonSecondary: 'w-full py-3 bg-white text-gray-600 border border-gray-200 font-bold rounded-lg active:bg-gray-50 transition-colors',
        selectableListItem: (s: boolean) => `
            p-4 rounded-xl border-2 transition-all flex flex-row items-center gap-3
            ${s ? 'border-current bg-opacity-10' : 'border-gray-100 bg-white active:border-gray-200'}
          `,
        selectableItemText: same('text-gray-800'),
        selectableItemSubText: same('text-gray-500'),
        summaryBox: 'mb-6 p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm space-y-1',
        summaryLabel: 'text-gray-500',
        summaryValue: 'font-bold text-gray-800',
        summaryLink: 'text-xs text-blue-500 underline w-full text-right mt-2',
        selectedDateBox: 'mt-4 p-3 rounded-lg border-2 text-center',
        selectedDateLabel: 'text-sm text-gray-600',
        iconColor: c,
        primaryStyle: { backgroundColor: c },
        headerStyle: {}, titleStyle: {}, cardStyle: {},
        slotTable: {
          headerBg: 'bg-white', headerText: 'text-gray-500', headerBorder: 'border-gray-200',
          timeCellBg: 'bg-white', timeCellText: 'text-gray-600', timeCellBorder: 'border-gray-100',
          rowBorder: 'border-gray-100',
          availableBtn: 'bg-white border border-gray-200 text-emerald-600',
          unavailableBtn: 'bg-gray-100 text-gray-300',
          sundayText: 'text-red-500', saturdayText: 'text-blue-500', weekdayText: 'text-gray-700',
          legendText: 'text-gray-500',
          legendAvailable: 'border border-gray-200 bg-white text-emerald-600',
          legendUnavailable: 'bg-gray-100 text-gray-300',
        },
      }
  }
}
