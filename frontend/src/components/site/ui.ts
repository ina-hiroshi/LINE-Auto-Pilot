// 公開ページのボタンとリンクの見た目。
// 白文字を浅葱（primary-500/600）に載せると文字が読みにくいため、浅葱の地には墨色の文字を載せる。
export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-primary-500 px-6 py-3.5 text-[15px] font-bold text-ink transition-colors hover:bg-primary-400 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50'

export const btnInk =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-6 py-3.5 text-[15px] font-bold text-paper transition-colors hover:bg-[#2b3d45] active:translate-y-px'

export const btnOutline =
  'inline-flex items-center justify-center gap-2 rounded-lg border-2 border-ink/80 bg-transparent px-6 py-3 text-[15px] font-bold text-ink transition-colors hover:bg-ink hover:text-paper active:translate-y-px'

export const textLink =
  'font-bold text-primary-800 underline decoration-primary-400 decoration-2 underline-offset-4 hover:decoration-primary-800'

/** セクションの幅と左右の余白 */
export const wrap = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8'
