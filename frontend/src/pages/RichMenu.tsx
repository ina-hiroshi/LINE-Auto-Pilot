import { useState, useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { supabase } from '../lib/supabase'
import { Loader2, Save, ExternalLink, Smartphone, MessageSquare } from 'lucide-react'
import Toast from '../components/Toast'
import { RichMenuTab } from '../features/line-settings/components/RichMenuTab'
import type { RichMenuSettings, RichMenuAction } from '../features/line-settings/types'
import { AVAILABLE_ICONS, RICH_MENU_LAYOUTS } from '../features/line-settings/constants'
import { usePlan } from '../hooks/usePlan'

const DEFAULT_RICH_MENU_SETTINGS: RichMenuSettings = {
  template_id: 'simple',
  layout_id: 'large_4',
  custom_image_url: '',
  actions: {},
}

export default function RichMenu() {
  const { isPro } = usePlan()
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

  const handleToast = (message: string, type: 'success' | 'error') => {
    setToast({ isVisible: true, message, type })
  }

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
          
          // actionsからslot_background_imagesを抽出
          const rawActions = store.rich_menu_actions || {}
          const slotBgImages = rawActions._slot_background_images || {}
          const actions = Object.entries(rawActions).reduce((acc, [key, value]) => {
            if (key === '_slot_background_images') return acc // スキップ
            const numKey = Number(key)
            if (Number.isFinite(numKey)) {
              acc[numKey] = value as RichMenuAction
            }
            return acc
          }, {} as Record<number, RichMenuAction>)
          
          setRichMenuSettings({
            template_id: store.rich_menu_template_id || DEFAULT_RICH_MENU_SETTINGS.template_id,
            layout_id: store.rich_menu_layout_id || DEFAULT_RICH_MENU_SETTINGS.layout_id,
            custom_image_url: store.rich_menu_custom_image_url || DEFAULT_RICH_MENU_SETTINGS.custom_image_url,
            actions,
            slot_background_images: slotBgImages,
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
          dark: { bg: '#334155', slot: '#1e293b', text: '#ffffff' },
          luxury: { bg: '#1c1917', slot: '#292524', text: '#fcd34d' },
          natural: { bg: '#f5f5f4', slot: '#ffffff', text: '#57534e' }
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
          // スロットごとの背景画像があれば使用
          const slotBgImage = richMenuSettings.slot_background_images?.[slotNum]
          
          let hasSlotBgImage = false
          if (slotBgImage) {
            // スロット背景画像を描画
            try {
              const bgImg = new Image()
              bgImg.crossOrigin = 'anonymous'
              await new Promise((resolve, reject) => {
                bgImg.onload = resolve
                bgImg.onerror = reject
                bgImg.src = slotBgImage
              })
              // object-cover のように描画
              const scale = Math.max(w / bgImg.width, h / bgImg.height)
              const drawW = bgImg.width * scale
              const drawH = bgImg.height * scale
              const offsetX = x + (w - drawW) / 2
              const offsetY = y + (h - drawH) / 2
              
              // クリッピングでスロット領域に制限
              ctx.save()
              ctx.beginPath()
              ctx.rect(x, y, w, h)
              ctx.clip()
              ctx.drawImage(bgImg, offsetX, offsetY, drawW, drawH)
              ctx.restore()
              hasSlotBgImage = true
              // アイコン・ラベルも描画するため、returnしない
            } catch (err) {
              console.error(`Failed to load slot ${slotNum} background image:`, err)
              // フォールバック: 通常のスロット描画
            }
          }
          
          // スロット背景画像がない場合のみデフォルト背景を描画
          if (!hasSlotBgImage) {
            ctx.fillStyle = theme.slot
            ctx.fillRect(x, y, w, h)
          }

          let IconComp = ExternalLink
          let label = '未設定'
          let isSet = false
          let showIcon = true
          let showLabel = true
          let iconColor = theme.text
          let labelColor = theme.text

          if (slotNum === 1) {
            IconComp = Smartphone
            label = '予約する'
            isSet = true
            // アクション設定から色を取得
            const action = richMenuSettings.actions[1]
            if (action) {
              iconColor = action.icon_color || theme.text
              labelColor = action.label_color || theme.text
              showIcon = action.show_icon !== false
              showLabel = action.show_label !== false
            }
          } else if (slotNum === 2) {
            IconComp = MessageSquare
            label = 'メッセージ入力'
            isSet = true
            // アクション設定から色を取得
            const action = richMenuSettings.actions[2]
            if (action) {
              iconColor = action.icon_color || theme.text
              labelColor = action.label_color || theme.text
              showIcon = action.show_icon !== false
              showLabel = action.show_label !== false
            }
          } else {
            const action = richMenuSettings.actions[slotNum]
            if (action) {
              const found = AVAILABLE_ICONS.find(i => i.id === action.icon)
              if (found) IconComp = found.icon
              label = action.label || '未設定'
              isSet = !!action.label
              showIcon = action.show_icon !== false
              showLabel = action.show_label !== false
              iconColor = action.icon_color || theme.text
              labelColor = action.label_color || theme.text
            }
          }

          if (!isSet) ctx.globalAlpha = 0.5

          // Icon（表示設定がONの場合のみ）
          if (showIcon) {
            const svgString = renderToStaticMarkup(
              <IconComp 
                size={64} 
                color={iconColor} 
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
            const iconY = y + (h - iconSize) / 2 - (showLabel ? 20 : 0)

            ctx.drawImage(img, iconX, iconY, iconSize, iconSize)
            URL.revokeObjectURL(url)
          }

          // Text（表示設定がONの場合のみ）
          if (showLabel) {
            ctx.fillStyle = labelColor
            ctx.font = 'bold 36px sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'
            
            const textY = showIcon ? y + (h - 64) / 2 - 20 + 64 + 16 : y + h / 2 - 18
            ctx.fillText(label, x + w / 2, textY)
          }
          
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

        // PNG圧縮: 品質を下げてサイズを削減（LINE APIの1MB制限対応）
        return new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => {
              if (!b) {
                reject(new Error('Blob failed'))
                return
              }
              
              // 1MB以下かチェック
              if (b.size <= 1024 * 1024) {
                resolve(b)
              } else {
                // 1MBを超える場合はJPEGで再圧縮（品質80%）
                canvas.toBlob(
                  (jpegBlob) => jpegBlob ? resolve(jpegBlob) : reject(new Error('JPEG conversion failed')),
                  'image/jpeg',
                  0.8
                )
              }
            },
            'image/png'
          )
        })
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

      console.log('Saving rich menu settings:', {
        template_id: richMenuSettings.template_id,
        layout_id: richMenuSettings.layout_id,
        custom_image_url: richMenuSettings.custom_image_url,
        actions: richMenuSettings.actions,
        slot_images: richMenuSettings.slot_background_images
      })

      // スロット画像をactionsに含めて保存（新しいカラムが無い場合の互換性対策）
      const actionsWithSlotImages = { ...richMenuSettings.actions }
      // slot_background_imagesの情報をactionsのmetadataとして保存
      
      const { error } = await supabase
        .from('stores')
        .update({
          rich_menu_template_id: richMenuSettings.template_id,
          rich_menu_layout_id: richMenuSettings.layout_id,
          rich_menu_custom_image_url: richMenuSettings.custom_image_url,
          rich_menu_actions: {
            ...actionsWithSlotImages,
            _slot_background_images: richMenuSettings.slot_background_images || {}
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', storeId)

      if (error) {
        console.error('DB Save Error:', error)
        throw error
      }

      // Apply Rich Menu via Edge Function
      console.log('Calling apply-rich-menu with:', {
        store_id: storeId,
        generated_image_url: generatedImageUrl,
        liff_id: import.meta.env.VITE_LIFF_ID
      })
      
      const { data: applyData, error: applyError } = await supabase.functions.invoke('apply-rich-menu', {
        body: { 
          store_id: storeId,
          generated_image_url: generatedImageUrl,
          liff_id: import.meta.env.VITE_LIFF_ID
        }
      })

      console.log('apply-rich-menu response:', { data: applyData, error: applyError })

      if (applyError) {
        console.error('Failed to apply rich menu:', applyError)
        setToast({ isVisible: true, message: `LINEへの反映に失敗: ${applyError.message || JSON.stringify(applyError)}`, type: 'error' })
      } else if (applyData?.error) {
        console.error('Apply rich menu returned error:', applyData.error)
        setToast({ isVisible: true, message: `LINEへの反映に失敗: ${applyData.error}`, type: 'error' })
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
    <div className="flex flex-col h-full">
      <Toast 
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
      
      <div className="shrink-0 z-20 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-gray-200 w-full">
        <div className="px-4 sm:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">リッチメニュー</h1>
              <p className="text-sm text-gray-500">LINEトーク画面下部のメニューデザインと動作を設定します。</p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors text-sm font-bold shadow-sm shrink-0"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />}
              {saving ? '保存中...' : 'LINEに適用'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="w-full">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <RichMenuTab
          richMenuSettings={richMenuSettings}
          onChangeSettings={setRichMenuSettings}
          previewRef={previewRef}
          isPro={isPro}
          storeId={storeId}
          onToast={handleToast}
        />
      </div>
        </div>
      </div>
    </div>
  )
}
