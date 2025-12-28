import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2 } from 'lucide-react'
import Toast from '../components/Toast'
import { RichMenuTab } from '../features/line-settings/components/RichMenuTab'
import type { RichMenuSettings, RichMenuAction } from '../features/line-settings/types'

const DEFAULT_RICH_MENU_SETTINGS: RichMenuSettings = {
  template_id: 'simple',
  layout_id: 'large_4',
  custom_image_url: '',
  actions: {},
}

export default function RichMenu() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [richMenuSettings, setRichMenuSettings] = useState<RichMenuSettings>(DEFAULT_RICH_MENU_SETTINGS)
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({
    isVisible: false,
    message: '',
    type: 'success'
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: stores } = await supabase
          .from('stores')
          .select('*')
          .eq('owner_id', user.id)
          .limit(1)

        const store = stores && stores.length > 0 ? stores[0] : null
        if (store) {
          setStoreId(store.id)
          setRichMenuSettings({
            template_id: store.rich_menu_template_id || DEFAULT_RICH_MENU_SETTINGS.template_id,
            layout_id: store.rich_menu_layout_id || DEFAULT_RICH_MENU_SETTINGS.layout_id,
            custom_image_url: store.rich_menu_custom_image_url || DEFAULT_RICH_MENU_SETTINGS.custom_image_url,
            actions: store.rich_menu_actions
              ? Object.entries(store.rich_menu_actions).reduce((acc, [key, value]) => {
                const numKey = Number(key)
                if (Number.isFinite(numKey)) {
                  acc[numKey] = value as RichMenuAction
                }
                return acc
              }, {} as Record<number, RichMenuAction>)
              : {},
          })
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleSave = async (e?: FormEvent) => {
    if (e) e.preventDefault()
    if (!storeId) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('stores')
        .update({
          rich_menu_template_id: richMenuSettings.template_id,
          rich_menu_layout_id: richMenuSettings.layout_id,
          rich_menu_custom_image_url: richMenuSettings.custom_image_url,
          rich_menu_actions: richMenuSettings.actions,
          updated_at: new Date().toISOString(),
        })
        .eq('id', storeId)

      if (error) throw error

      // Apply Rich Menu via Edge Function
      const { error: applyError } = await supabase.functions.invoke('apply-rich-menu', {
        body: { store_id: storeId }
      })

      if (applyError) {
        console.error('Failed to apply rich menu:', applyError)
        setToast({ isVisible: true, message: '設定は保存されましたが、LINEへの反映に失敗しました', type: 'error' })
      } else {
        setToast({ isVisible: true, message: 'リッチメニューを更新しました', type: 'success' })
      }
    } catch (error) {
      console.error('Save Error:', error)
      setToast({ isVisible: true, message: '保存に失敗しました', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <Toast 
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
      
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">リッチメニュー</h1>
        <p className="text-gray-500">トーク画面下部に表示されるメニューを設定します。</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <RichMenuTab
          richMenuSettings={richMenuSettings}
          onChangeSettings={setRichMenuSettings}
          onSubmit={handleSave}
          saving={saving}
        />
      </div>
    </div>
  )
}
