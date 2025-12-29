import { Lock } from 'lucide-react'

interface ProBadgeProps {
  className?: string
}

export default function ProBadge({ className = '' }: ProBadgeProps) {
  return (
    <span 
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 border border-yellow-300 shadow-sm select-none ${className}`}
      title="Proプラン限定機能"
    >
      <Lock size={10} strokeWidth={2.5} className="text-yellow-600" />
      Pro
    </span>
  )
}
