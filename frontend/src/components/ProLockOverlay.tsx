import { useState } from 'react'
import { Crown, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Toast from './Toast'
import { PRO_PRICE_ID } from '../constants/stripe'

interface ProLockOverlayProps {
  title?: string
  description?: React.ReactNode
}

export default function ProLockOverlay({ 
  title = "Proプラン限定機能", 
  description = "この機能を使用するにはProプランへのアップグレードが必要です。" 
}: ProLockOverlayProps) {
  const [processing, setProcessing] = useState(false)
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({
    isVisible: false,
    message: '',
    type: 'success'
  })

  const handleUpgrade = async () => {
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
          <button 
            onClick={handleUpgrade}
            disabled={processing}
            className="px-6 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mx-auto gap-2"
          >
            {processing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                処理中...
              </>
            ) : (
              'プランをアップグレード'
            )}
          </button>
        </div>
      </div>
      <Toast 
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
    </div>
  )
}
