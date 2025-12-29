import { Crown } from 'lucide-react'

interface ProLockOverlayProps {
  title?: string
  description?: React.ReactNode
}

export default function ProLockOverlay({ 
  title = "Proプラン限定機能", 
  description = "この機能を使用するにはProプランへのアップグレードが必要です。" 
}: ProLockOverlayProps) {
  return (
    <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-6 rounded-xl">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-md w-full">
        <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Crown size={32} />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">{title}</h3>
        <div className="text-gray-600 mb-6 text-left text-sm leading-relaxed">
          {description}
        </div>
        <div className="text-center">
          <button className="px-6 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/30">
            プランをアップグレード
          </button>
        </div>
      </div>
    </div>
  )
}
