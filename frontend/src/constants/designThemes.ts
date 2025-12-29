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
  { 
    id: 'elegant', 
    name: 'エレガント', 
    color: 'bg-[#F5F5F0] border-[#E0E0D0] text-[#5D4037]', 
    isPro: false,
    description: '落ち着いた雰囲気の上品なデザイン'
  },
  { 
    id: 'pop', 
    name: 'ポップ', 
    color: 'bg-cyan-50 border-cyan-200 text-cyan-900', 
    isPro: false,
    description: '明るく元気な印象のデザイン'
  },
  { 
    id: 'dark', 
    name: 'ダーク', 
    color: 'bg-slate-800 border-slate-700 text-white', 
    isPro: false,
    description: 'シックで洗練されたダークモード'
  },
  // Pro Themes
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
    color: 'bg-stone-50 border-stone-200 text-stone-700', 
    isPro: true,
    description: '自然な風合いのオーガニックデザイン'
  }
]

export const getThemeById = (id: string) => DESIGN_THEMES.find(t => t.id === id) || DESIGN_THEMES[0]
