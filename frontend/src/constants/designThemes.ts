export type DesignTheme = {
  id: string
  name: string
  color: string
  isPro: boolean
  description?: string
}

export const DESIGN_THEMES: DesignTheme[] = [
  // Free Themes
  { 
    id: 'simple', 
    name: 'シンプル', 
    color: 'bg-gray-50 border-gray-200 text-gray-900', 
    isPro: false,
    description: '清潔感のある標準的なデザイン'
  },
  // Pro Themes
  { 
    id: 'elegant', 
    name: 'エレガント', 
    color: 'bg-[#F5F5F0] border-[#E0E0D0] text-[#5D4037]', 
    isPro: true,
    description: '落ち着いた雰囲気の上品なデザイン'
  },
  { 
    id: 'pop', 
    name: 'ポップ', 
    color: 'bg-cyan-50 border-cyan-200 text-cyan-900', 
    isPro: true,
    description: '明るく元気な印象のデザイン'
  },
  { 
    id: 'dark', 
    name: 'ダーク', 
    color: 'bg-slate-800 border-slate-700 text-white', 
    isPro: true,
    description: 'シックで洗練されたダークモード'
  },
  { 
    id: 'luxury', 
    name: 'ラグジュアリー', 
    color: 'bg-stone-900 border-amber-600/50 text-amber-50', 
    isPro: true,
    description: '高級感あふれるゴールド＆ブラック'
  },
  { 
    id: 'natural', 
    name: 'ナチュラル', 
    color: 'bg-gradient-to-br from-amber-100 to-orange-50 border-amber-400 text-amber-950', 
    isPro: true,
    description: '木目調ブラウン×リーフグリーンの温かみあるオーガニックデザイン'
  }
]

export const getThemeById = (id: string) => DESIGN_THEMES.find(t => t.id === id) || DESIGN_THEMES[0]
