import { useState, useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { supabase } from '../lib/supabase'
import { Loader2, ExternalLink, Smartphone, MessageSquare } from 'lucide-react'
import Toast from '../components/Toast'
import { RichMenuTab } from '../features/line-settings/components/RichMenuTab'
import type { RichMenuSettings, RichMenuAction } from '../features/line-settings/types'
import { AVAILABLE_ICONS, RICH_MENU_LAYOUTS } from '../features/line-settings/constants'

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
  const previewRef = useRef<HTMLDivElement>(null)

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

    if (!import.meta.env.VITE_LIFF_ID) {
      setToast({ isVisible: true, message: '環境変数 VITE_LIFF_ID が設定されていません', type: 'error' })
      return
    }

    setSaving(true)
    try {
      // Generate Image using Canvas API (Restored from previous version)
      let generatedImageUrl = ''
      
      const generateImage = async (): Promise<Blob> => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas context not supported')
        
        const layout = RICH_MENU_LAYOUTS.find(l => l.id === richMenuSettings.layout_id) || RICH_MENU_LAYOUTS[0]
        const width = 1200
        const height = layout.id.startsWith('compact') ? 405 : 810
        canvas.width = width
        canvas.height = height

        // Colors
        const colors = {
          simple: { bg: '#e5e7eb', slot: '#ffffff', text: '#1f2937' },
          elegant: { bg: '#D4C4B7', slot: '#F5F5F0', text: '#5D4037' },
          pop: { bg: '#00B8A9', slot: '#f0fdfa', text: '#0f766e' },
          dark: { bg: '#334155', slot: '#1e293b', text: '#ffffff' }
        }
        const theme = colors[richMenuSettings.template_id as keyof typeof colors] || colors.simple
        
        // Fill Background
        ctx.fillStyle = theme.bg
        ctx.fillRect(0, 0, width, height)

        // Custom Image
        if (richMenuSettings.custom_image_url) {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          await new Promise((resolve, reject) => {
            img.onload = resolve
            img.onerror = reject
            img.src = richMenuSettings.custom_image_url
          })
          // Cover
          const scale = Math.max(width / img.width, height / img.height)
          const x = (width - img.width * scale) / 2
          const y = (height - img.height * scale) / 2
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale)
          
          return new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Blob failed')), 'image/png'))
        }

        // Draw Slots
        const gap = 4
        
        const drawSlot = async (slotNum: number, x: number, y: number, w: number, h: number) => {
          ctx.fillStyle = theme.slot
          ctx.fillRect(x, y, w, h)

          let IconComp = ExternalLink
          let label = '未設定'
          let isSet = false

          if (slotNum === 1) {
            IconComp = Smartphone
            label = '予約する'
            isSet = true
          } else if (slotNum === 2) {
            IconComp = MessageSquare
            label = 'メッセージ入力'
            isSet = true
          } else {
            const action = richMenuSettings.actions[slotNum]
            if (action) {
              const found = AVAILABLE_ICONS.find(i => i.id === action.icon)
              if (found) IconComp = found.icon
              label = action.label || '未設定'
              isSet = true
            }
          }

          if (!isSet) ctx.globalAlpha = 0.5

          // Icon
          const svgString = renderToStaticMarkup(
            <IconComp 
              size={64} 
              color={theme.text} 
              strokeWidth={2}
            />
          )
          const img = new Image()
          const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
          const url = URL.createObjectURL(svgBlob)
          
          await new Promise((resolve) => {
            img.onload = resolve
            img.src = url
          })
          
          const iconSize = 64
          const iconX = x + (w - iconSize) / 2
          const iconY = y + (h - iconSize) / 2 - 20

          ctx.drawImage(img, iconX, iconY, iconSize, iconSize)
          URL.revokeObjectURL(url)

          // Text
          ctx.fillStyle = theme.text
          ctx.font = 'bold 36px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillText(label, x + w / 2, iconY + iconSize + 16)
          
          ctx.globalAlpha = 1.0
        }

        // Grid Logic
        if (layout.id === 'large_3_upper') {
          const h = (height - gap) / 2
          const w = (width - gap) / 2
          await drawSlot(1, 0, 0, width, h)
          await drawSlot(2, 0, h + gap, w, h)
          await drawSlot(3, w + gap, h + gap, w, h)
        } else {
          const rows = layout.id.startsWith('compact') ? 1 : 2
          const cols = (layout.id.includes('3') && !layout.id.includes('upper')) || layout.id.includes('6') ? 3 : 2
          
          const cellW = (width - (cols - 1) * gap) / cols
          const cellH = (height - (rows - 1) * gap) / rows

          let slotCount = 1
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const x = c * (cellW + gap)
              const y = r * (cellH + gap)
              await drawSlot(slotCount, x, y, cellW, cellH)
              slotCount++
            }
          }
        }

        return new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Blob failed')), 'image/png'))
      }

      try {
        const blob = await generateImage()
        const fileName = `rich-menu-${storeId}-${Date.now()}.png`
        const { error: uploadError } = await supabase.storage
          .from('rich_menus')
          .upload(fileName, blob, {
            contentType: 'image/png',
            upsert: true
          })
        
        if (uploadError) throw uploadError
        
        const { data: { publicUrl } } = supabase.storage
          .from('rich_menus')
          .getPublicUrl(fileName)
          
        generatedImageUrl = publicUrl
      } catch (genError) {
        console.error('Image generation failed:', genError)
        setToast({ isVisible: true, message: 'リッチメニュー画像の生成に失敗しました', type: 'error' })
        setSaving(false)
        return
      }

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
        body: { 
          store_id: storeId,
          generated_image_url: generatedImageUrl,
          liff_id: import.meta.env.VITE_LIFF_ID
        }
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
          previewRef={previewRef}
        />
      </div>
    </div>
  )
}
