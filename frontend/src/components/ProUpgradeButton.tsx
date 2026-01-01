import { useState } from 'react'
import { Loader2, Crown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Toast from './Toast'

const PRO_PRICE_ID = 'price_1SkA8F9gqo1AslYsV0rVvBzF'

interface ProUpgradeButtonProps {
  className?: string
  label?: string
  variant?: 'button' | 'link' | 'small-button'
}

export default function ProUpgradeButton({ 
  className = "", 
  label = "プランをアップグレード",
  variant = 'button'
}: ProUpgradeButtonProps) {
  const [processing, setProcessing] = useState(false)
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({
    isVisible: false,
    message: '',
    type: 'success'
  })

  const handleUpgrade = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setProcessing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setToast({ isVisible: true, message: 'ログインが必要です。', type: 'error' })
        return
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          price_id: PRO_PRICE_ID,
          return_url: window.location.href,
        }),
      })

      const { url, error } = await response.json()
      if (error) throw new Error(error)
      if (url) window.location.href = url
    } catch (error) {
      console.error('Error creating checkout session:', error)
      setToast({ isVisible: true, message: '決済セッションの作成に失敗しました。', type: 'error' })
    } finally {
      setProcessing(false)
    }
  }

  const ButtonContent = () => {
    if (variant === 'link') {
      return (
        <button 
          onClick={handleUpgrade}
          disabled={processing}
          className={`text-primary-600 hover:text-primary-700 font-medium underline decoration-dotted underline-offset-4 flex items-center gap-1 ${className}`}
        >
          {processing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Crown size={14} />}
          {label}
        </button>
      )
    }

    if (variant === 'small-button') {
       return (
        <button 
          onClick={handleUpgrade}
          disabled={processing}
          className={`px-3 py-1.5 bg-primary-600 text-white text-xs rounded-lg font-bold hover:bg-primary-700 transition-colors shadow-sm flex items-center gap-1.5 ${className}`}
        >
          {processing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Crown size={12} />}
          {label}
        </button>
      )
    }

    return (
      <button 
        onClick={handleUpgrade}
        disabled={processing}
        className={`px-6 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/30 flex items-center justify-center gap-2 ${className}`}
      >
        {processing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            処理中...
          </>
        ) : (
          label
        )}
      </button>
    )
  }

  return (
    <>
      <ButtonContent />
      <Toast 
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
    </>
  )
}
