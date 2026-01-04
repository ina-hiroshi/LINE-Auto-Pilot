import { useMemo, useState, useRef, useCallback } from 'react'
import { 
  ExternalLink, Image as ImageIcon, Layout, MessageSquare, MousePointerClick, 
  Palette, Smartphone, Upload, AlertTriangle, CreditCard, Check, Eye, EyeOff,
  Trash2, Info, ArrowUpDown, Type, ChevronDown
} from 'lucide-react'
import { AVAILABLE_ICONS, RICH_MENU_LAYOUTS } from '../constants'
import type { RichMenuAction, RichMenuSettings } from '../types'
import { DESIGN_THEMES } from '../../../constants/designThemes'
import ProBadge from '../../../components/ProBadge'
import ProUpgradeButton from '../../../components/ProUpgradeButton'
import { supabase } from '../../../lib/supabase'

// プリセットカラー定義
const PRESET_COLORS = [
  { name: 'ホワイト', color: '#FFFFFF' },
  { name: 'ブラック', color: '#1F2937' },
  { name: 'ブルー', color: '#3B82F6' },
  { name: 'シアン', color: '#00c3dc' },
  { name: 'グリーン', color: '#10B981' },
  { name: 'レッド', color: '#EF4444' },
  { name: 'オレンジ', color: '#F97316' },
  { name: 'パープル', color: '#8B5CF6' },
  { name: 'ピンク', color: '#EC4899' },
  { name: 'ゴールド', color: '#F59E0B' },
]

// デフォルトアクション定義
const DEFAULT_ACTIONS = {
  booking: { label: '予約する', icon: 'smartphone', url: '' },
  message: { label: 'メッセージ入力', icon: 'message-square', url: '' },
  member_card: { label: '会員証', icon: 'credit-card', url: '' }
}

interface RichMenuTabProps {
  richMenuSettings: RichMenuSettings
  onChangeSettings: (next: RichMenuSettings) => void
  previewRef?: React.RefObject<HTMLDivElement | null>
  isPro: boolean
  storeId?: string | null
  onToast?: (message: string, type: 'success' | 'error') => void
}

export function RichMenuTab({ richMenuSettings, onChangeSettings, previewRef, isPro, storeId, onToast }: RichMenuTabProps) {
  const [activeTab, setActiveTab] = useState<'design' | 'actions'>('design')
  const [openIconSelector, setOpenIconSelector] = useState<number | null>(null)
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null)
  const [draggingSlot, setDraggingSlot] = useState<number | null>(null)
  const [expandedColorPicker, setExpandedColorPicker] = useState<{ slot: number, type: 'icon' | 'label' } | null>(null)
  const slotFileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  const layout = useMemo(() => RICH_MENU_LAYOUTS.find((l) => l.id === richMenuSettings.layout_id) || RICH_MENU_LAYOUTS[0], [richMenuSettings.layout_id])
  const slots = useMemo(() => Array.from({ length: layout.slots }, (_, i) => i + 1), [layout.slots])

  const updateAction = (slot: number, updater: (prev: RichMenuAction) => RichMenuAction) => {
    const prev = richMenuSettings.actions[slot] || { label: '', url: '', icon: 'external-link' }
    const nextAction = updater(prev)
    onChangeSettings({ ...richMenuSettings, actions: { ...richMenuSettings.actions, [slot]: nextAction } })
  }

  // スロットごとの背景画像アップロード処理
  const handleSlotImageUpload = useCallback(async (file: File, slot: number) => {
    if (!storeId) return
    
    if (file.size > 5 * 1024 * 1024) {
      onToast?.('ファイルサイズは5MB以下にしてください', 'error')
      return
    }

    if (!file.type.startsWith('image/')) {
      onToast?.('画像ファイルを選択してください', 'error')
      return
    }

    setUploadingSlot(slot)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const fileName = `richmenu-slot-${slot}-${storeId}-${Date.now()}.${ext}`
      const filePath = `${storeId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('store-assets')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from('store-assets')
        .getPublicUrl(filePath)

      const newUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`
      const newSlotImages = { ...richMenuSettings.slot_background_images, [slot]: newUrl }
      onChangeSettings({ ...richMenuSettings, slot_background_images: newSlotImages })
      onToast?.(`ボタン${slot}の背景画像をアップロードしました`, 'success')
    } catch (error) {
      console.error('Slot image upload failed:', error)
      onToast?.('アップロードに失敗しました', 'error')
    } finally {
      setUploadingSlot(null)
    }
  }, [storeId, richMenuSettings, onChangeSettings, onToast])

  // スロット背景画像を削除
  const handleSlotImageDelete = useCallback((slot: number) => {
    const newSlotImages = { ...richMenuSettings.slot_background_images }
    delete newSlotImages[slot]
    onChangeSettings({ ...richMenuSettings, slot_background_images: newSlotImages })
    onToast?.(`ボタン${slot}の背景画像を削除しました`, 'success')
  }, [richMenuSettings, onChangeSettings, onToast])

  // スロット画像のドロップ処理
  const handleSlotDrop = useCallback((e: React.DragEvent<HTMLDivElement>, slot: number) => {
    e.preventDefault()
    setDraggingSlot(null)
    const file = e.dataTransfer.files?.[0]
    if (file) handleSlotImageUpload(file, slot)
  }, [handleSlotImageUpload])

  // 会員証が配置されているかチェック
  const hasMemberCard = useMemo(() => {
    return Object.values(richMenuSettings.actions).some(action => action.icon === 'credit-card')
  }, [richMenuSettings.actions])

  // プリセットアクションを追加
  const addPresetAction = (slot: number, type: 'booking' | 'message' | 'member_card') => {
    const preset = DEFAULT_ACTIONS[type]
    updateAction(slot, () => ({
      label: preset.label,
      url: '',
      icon: preset.icon
    }))
  }

  // アクションをクリア
  const clearAction = (slot: number) => {
    updateAction(slot, () => ({ label: '', url: '', icon: 'external-link' }))
  }

  // アイコン表示/非表示を切り替え
  const toggleIconVisibility = (slot: number) => {
    updateAction(slot, (prev) => ({ ...prev, show_icon: prev.show_icon === false ? true : false }))
  }

  // ラベル表示/非表示を切り替え
  const toggleLabelVisibility = (slot: number) => {
    updateAction(slot, (prev) => ({ ...prev, show_label: prev.show_label === false ? true : false }))
  }

  // ボタンの配置を入れ替え
  const swapActions = (slotA: number, slotB: number) => {
    const actionA = richMenuSettings.actions[slotA] || { label: '', url: '', icon: 'external-link' }
    const actionB = richMenuSettings.actions[slotB] || { label: '', url: '', icon: 'external-link' }
    onChangeSettings({
      ...richMenuSettings,
      actions: {
        ...richMenuSettings.actions,
        [slotA]: actionB,
        [slotB]: actionA
      }
    })
  }

  // 入れ替え対象選択状態
  const [swapTarget, setSwapTarget] = useState<number | null>(null)

  return (
    <div>
      <div className="flex items-end justify-between mb-6 border-b border-gray-200">
        <div className="flex gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('design')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'design'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Palette size={16} />
            <span className="hidden sm:inline">デザイン設定</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('actions')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'actions'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <MousePointerClick size={16} />
            <span className="hidden sm:inline">アクション設定</span>
          </button>
        </div>
      </div>

      <div className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8">
            {activeTab === 'design' && (
              <>
                {/* レイアウト選択 */}
                <div>
                  <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <Layout size={16} /> レイアウト
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {RICH_MENU_LAYOUTS.map((item) => {
                      const isLocked = !isPro && item.id !== 'large_4'
                      return (
                        <div key={item.id} className="relative">
                          <label
                            className={`
                              relative rounded-lg border-2 p-4 transition-all flex flex-col items-center justify-center gap-2 h-24 w-full
                              ${richMenuSettings.layout_id === item.id
                                ? 'border-primary-500 ring-2 ring-primary-100 bg-primary-50'
                                : 'border-gray-200'}
                              ${isLocked ? 'opacity-60 cursor-not-allowed bg-gray-50' : 'cursor-pointer hover:border-gray-300 hover:bg-gray-50'}
                            `}
                          >
                            <input
                              type="radio"
                              name="rm_layout"
                              value={item.id}
                              checked={richMenuSettings.layout_id === item.id}
                              onChange={(e) => onChangeSettings({ ...richMenuSettings, layout_id: e.target.value })}
                              className="sr-only"
                              disabled={isLocked}
                            />
                            <div className="text-center text-sm font-medium">{item.name}</div>
                            {richMenuSettings.layout_id === item.id && (
                              <div className="absolute top-2 right-2 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full" />
                              </div>
                            )}
                            {isLocked && (
                              <div className="absolute top-2 right-2">
                                <ProBadge />
                              </div>
                            )}
                          </label>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* テンプレート選択 */}
                <div>
                  <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <Palette size={16} /> デザインテーマ
                  </h3>
                  <p className="text-xs text-gray-500 -mt-2 mb-4">現在は「シンプル」テーマのみ対応しています</p>
                  <div className="grid grid-cols-2 gap-3">
                    {DESIGN_THEMES.map((template) => {
                      const isLocked = !isPro && template.isPro
                      return (
                        <div key={template.id} className="relative">
                          <label
                            className={`
                              relative rounded-lg border-2 p-4 transition-all flex flex-col items-center justify-center gap-2 h-28 w-full
                              ${richMenuSettings.template_id === template.id
                                ? 'border-primary-500 ring-2 ring-primary-100'
                                : 'border-gray-200'}
                              ${isLocked ? 'opacity-60 cursor-not-allowed bg-gray-50' : 'cursor-pointer hover:border-gray-300'}
                              ${!isLocked ? template.color : ''}
                            `}
                          >
                            <input
                              type="radio"
                              name="rm_template"
                              value={template.id}
                              checked={richMenuSettings.template_id === template.id}
                              onChange={(e) => onChangeSettings({ ...richMenuSettings, template_id: e.target.value })}
                              className="sr-only"
                              disabled={isLocked}
                            />
                            <div className="text-center text-sm font-medium">{template.name}</div>
                            {template.description && (
                              <div className="text-center text-[10px] opacity-70 px-2">{template.description}</div>
                            )}
                            {richMenuSettings.template_id === template.id && (
                              <div className="absolute top-2 right-2 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full" />
                              </div>
                            )}
                            {isLocked && (
                              <div className="absolute top-2 right-2">
                                <ProBadge />
                              </div>
                            )}
                          </label>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* スロットごとの背景画像 (Pro) */}
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                      <ImageIcon size={16} /> ボタン別背景画像
                    </h3>
                  </div>

                  {/* 機能説明 */}
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-2">
                      <Info size={16} className="text-blue-600 mt-0.5 shrink-0" />
                      <div className="text-xs text-blue-800 space-y-1">
                        <p className="font-medium">ボタンごとに背景画像を設定</p>
                        <p className="text-blue-700">各ボタンに個別の画像を設定して、オリジナルのリッチメニューを作成できます。</p>
                      </div>
                    </div>
                  </div>

                  {!isPro && (
                    <div className="mb-4 bg-white p-4 rounded-lg border border-gray-200 space-y-3">
                      <div className="flex items-center gap-2">
                        <ProBadge />
                        <span className="text-sm font-medium text-gray-700">カスタマイズ機能</span>
                      </div>
                      <div className="space-y-2 text-xs text-gray-600 pl-6">
                        <p>• <strong>ボタン別背景画像:</strong> 各ボタンに個別の画像をアップロード</p>
                        <p>• <strong>自由なデザイン:</strong> オリジナルのリッチメニューを作成</p>
                      </div>
                      <div className="pt-2">
                        <ProUpgradeButton variant="small-button" label="Proプランにアップグレード" />
                      </div>
                    </div>
                  )}

                  <div className={!isPro ? 'opacity-50 pointer-events-none select-none' : ''}>
                    <div className={`grid gap-3 ${layout.slots <= 3 ? 'grid-cols-3' : layout.slots === 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                      {slots.map((slotNum) => {
                        const slotImage = richMenuSettings.slot_background_images?.[slotNum]
                        const action = richMenuSettings.actions[slotNum]
                        const actionLabel = action?.label || `ボタン${slotNum}`
                        const isUploading = uploadingSlot === slotNum
                        const isDraggingThis = draggingSlot === slotNum

                        return (
                          <div key={slotNum} className="relative">
                            <input
                              ref={(el) => { slotFileInputRefs.current[slotNum] = el }}
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleSlotImageUpload(file, slotNum)
                              }}
                              className="hidden"
                            />
                            
                            <div className="text-xs font-medium text-gray-600 mb-1 truncate">
                              {actionLabel}
                            </div>
                            
                            {slotImage ? (
                              <div className="relative group aspect-square bg-gray-100 rounded-lg border border-gray-200">
                                <img
                                  src={slotImage}
                                  alt={`ボタン${slotNum}の背景`}
                                  className="w-full h-full object-contain rounded-lg"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center gap-1">
                                  <button
                                    onClick={() => slotFileInputRefs.current[slotNum]?.click()}
                                    className="px-2 py-1 bg-white text-gray-700 rounded text-xs hover:bg-gray-100"
                                  >
                                    変更
                                  </button>
                                  <button
                                    onClick={() => handleSlotImageDelete(slotNum)}
                                    className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                                  >
                                    削除
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div
                                onClick={() => isPro && slotFileInputRefs.current[slotNum]?.click()}
                                onDrop={(e) => handleSlotDrop(e, slotNum)}
                                onDragOver={(e) => { e.preventDefault(); setDraggingSlot(slotNum) }}
                                onDragLeave={(e) => { e.preventDefault(); setDraggingSlot(null) }}
                                className={`
                                  aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer
                                  ${isDraggingThis ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'}
                                `}
                              >
                                {isUploading ? (
                                  <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <>
                                    <Upload size={20} className="text-gray-400 mb-1" />
                                    <span className="text-[10px] text-gray-500">画像追加</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-xs text-gray-500 mt-3">推奨: 正方形の画像（PNG/JPG形式、5MB以下）</p>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'actions' && (
              /* ボタン設定 */
              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <MousePointerClick size={16} /> ボタン設定
                </h3>

                {/* 機能説明 */}
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-2">
                    <Info size={16} className="text-blue-600 mt-0.5 shrink-0" />
                    <div className="text-xs text-blue-800 space-y-1">
                      <p className="font-medium">リッチメニューのボタン設定</p>
                      <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                        <li>各ボタンに「予約」「メッセージ」「会員証」などのアクションを割り当てられます</li>
                        <li>Freeプランではボタン1・2は固定表示です</li>
                        {isPro && <li>Proプランでは全てのボタンを自由にカスタマイズできます</li>}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* 会員証未設定警告 */}
                {!hasMemberCard && (
                  <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-300">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                      <div className="text-xs text-amber-800">
                        <p className="font-medium">会員証ボタンが設定されていません</p>
                        <p className="mt-1 text-amber-700">会員証機能を利用する場合は、いずれかのボタンに「会員証」を設定してください。</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {slots.map((slotNum) => {
                    const action = richMenuSettings.actions[slotNum] || { label: '', url: '', icon: 'external-link' }
                    const isFixedSlot = !isPro && (slotNum === 1 || slotNum === 2)
                    const hasAction = action.label && action.label.trim() !== ''

                    // Freeプラン: ボタン1・2は固定
                    if (isFixedSlot) {
                      return (
                        <div key={slotNum} className="p-3 bg-gray-50 rounded-lg border border-gray-200 relative">
                          <div className="absolute -top-2.5 left-3 bg-primary-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                            ボタン {slotNum} (固定)
                          </div>
                          <div className="mt-2 flex items-center gap-3">
                            <div className={`w-8 h-8 rounded flex items-center justify-center ${slotNum === 1 ? 'bg-primary-100 text-primary-600' : 'bg-gray-200 text-gray-600'}`}>
                              {slotNum === 1 ? <Smartphone size={16} /> : <MessageSquare size={16} />}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-bold text-gray-800">{slotNum === 1 ? '予約する' : 'メッセージ入力'}</p>
                              <p className="text-xs text-gray-500">Freeプランでは固定表示</p>
                            </div>
                            <ProBadge />
                          </div>
                        </div>
                      )
                    }

                    // Proプラン または Freeプランのボタン3以降
                    return (
                      <div key={slotNum} className="p-3 bg-white rounded-lg border border-gray-200 relative">
                        <div className={`absolute -top-2.5 left-3 text-white text-[10px] font-bold px-2 py-0.5 rounded ${hasAction ? 'bg-primary-600' : 'bg-gray-400'}`}>
                          ボタン {slotNum} {isPro ? '' : '(任意)'}
                        </div>
                        <div className="mt-2 space-y-3">
                          {/* プリセットボタン */}
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => addPresetAction(slotNum, 'booking')}
                              className={`px-2 py-1 text-xs rounded border flex items-center gap-1 transition-colors ${action.icon === 'smartphone' ? 'bg-primary-100 border-primary-400 text-primary-700' : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                            >
                              <Smartphone size={12} /> 予約
                            </button>
                            <button
                              type="button"
                              onClick={() => addPresetAction(slotNum, 'message')}
                              className={`px-2 py-1 text-xs rounded border flex items-center gap-1 transition-colors ${action.icon === 'message-square' ? 'bg-primary-100 border-primary-400 text-primary-700' : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                            >
                              <MessageSquare size={12} /> メッセージ
                            </button>
                            <button
                              type="button"
                              onClick={() => addPresetAction(slotNum, 'member_card')}
                              className={`px-2 py-1 text-xs rounded border flex items-center gap-1 transition-colors ${action.icon === 'credit-card' ? 'bg-primary-100 border-primary-400 text-primary-700' : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                            >
                              <CreditCard size={12} /> 会員証
                            </button>
                            {hasAction && (
                              <button
                                type="button"
                                onClick={() => clearAction(slotNum)}
                                className="px-2 py-1 text-xs rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-1"
                              >
                                <Trash2 size={12} /> クリア
                              </button>
                            )}
                          </div>

                          {/* カスタム設定フォーム */}
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-gray-700 mb-1">ラベル</label>
                              <input
                                type="text"
                                value={action.label}
                                onChange={(e) => updateAction(slotNum, (prev) => ({ ...prev, label: e.target.value }))}
                                className="w-full p-1.5 border rounded text-sm"
                                placeholder="例: Instagram"
                              />
                            </div>
                            <div className="relative">
                              <label className="block text-xs font-medium text-gray-700 mb-1">アイコン</label>
                              <button
                                type="button"
                                onClick={() => setOpenIconSelector(openIconSelector === slotNum ? null : slotNum)}
                                className="w-28 p-1.5 border rounded text-sm flex items-center justify-between bg-white hover:bg-gray-50"
                              >
                                <div className="flex items-center gap-2 overflow-hidden">
                                  {(() => {
                                    const SelectedIcon = AVAILABLE_ICONS.find((i) => i.id === action.icon)?.icon || ExternalLink
                                    return <SelectedIcon size={16} className="shrink-0" />
                                  })()}
                                  <span className="truncate text-xs">
                                    {AVAILABLE_ICONS.find((i) => i.id === action.icon)?.label || 'Link'}
                                  </span>
                                </div>
                              </button>

                              {openIconSelector === slotNum && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setOpenIconSelector(null)} />
                                  <div className="absolute z-50 top-full right-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-xl p-2 grid grid-cols-4 gap-2">
                                    {AVAILABLE_ICONS.map((iconItem) => (
                                      <button
                                        key={iconItem.id}
                                        type="button"
                                        onClick={() => {
                                          updateAction(slotNum, (prev) => {
                                            const updates: Partial<RichMenuAction> = { icon: iconItem.id }
                                            if (iconItem.id === 'credit-card') {
                                              updates.label = '会員証'
                                              updates.url = ''
                                            }
                                            return { ...prev, ...updates }
                                          })
                                          setOpenIconSelector(null)
                                        }}
                                        className={`flex flex-col items-center justify-center p-2 rounded hover:bg-gray-100 ${action.icon === iconItem.id ? 'bg-primary-50 text-primary-600' : 'text-gray-600'}`}
                                        title={iconItem.label}
                                      >
                                        <iconItem.icon size={20} className="mb-1" />
                                        <span className="text-[10px] truncate w-full text-center">{iconItem.label}</span>
                                      </button>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          {/* URL入力（会員証以外） */}
                          {action.icon !== 'credit-card' && (
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">URL</label>
                              <input
                                type="text"
                                value={action.url}
                                onChange={(e) => updateAction(slotNum, (prev) => ({ ...prev, url: e.target.value }))}
                                className="w-full p-1.5 border rounded text-sm"
                                placeholder="https://..."
                              />
                            </div>
                          )}

                          {/* 会員証の場合はURL自動設定メッセージ */}
                          {action.icon === 'credit-card' && (
                            <div className="p-2 bg-blue-50 text-blue-700 text-xs rounded border border-blue-100">
                              <Check size={12} className="inline mr-1" />
                              会員証のURLは自動的に設定されます
                            </div>
                          )}

                          {/* Proプラン: 表示設定トグルと配置変更 */}
                          {isPro && hasAction && (
                            <div className="pt-3 border-t border-gray-100 space-y-3">
                              {/* アイコン・ラベル表示トグル */}
                              <div className="grid grid-cols-2 gap-3">
                                {/* アイコン表示トグル */}
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-600 flex items-center gap-1">
                                    {action.show_icon !== false ? <Eye size={12} /> : <EyeOff size={12} />}
                                    アイコン
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => toggleIconVisibility(slotNum)}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${action.show_icon !== false ? 'bg-primary-500' : 'bg-gray-300'}`}
                                  >
                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${action.show_icon !== false ? 'translate-x-5' : 'translate-x-1'}`} />
                                  </button>
                                </div>
                                {/* ラベル表示トグル */}
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-600 flex items-center gap-1">
                                    <Type size={12} />
                                    ラベル
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => toggleLabelVisibility(slotNum)}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${action.show_label !== false ? 'bg-primary-500' : 'bg-gray-300'}`}
                                  >
                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${action.show_label !== false ? 'translate-x-5' : 'translate-x-1'}`} />
                                  </button>
                                </div>
                              </div>

                              {/* 色設定 */}
                              <div className="space-y-2">
                                {/* アイコン色 */}
                                {action.show_icon !== false && (
                                  <div className="space-y-2">
                                    <button
                                      type="button"
                                      onClick={() => setExpandedColorPicker(
                                        expandedColorPicker?.slot === slotNum && expandedColorPicker?.type === 'icon' 
                                          ? null 
                                          : { slot: slotNum, type: 'icon' }
                                      )}
                                      className="w-full flex items-center justify-between text-xs text-gray-600 hover:text-gray-800"
                                    >
                                      <span className="flex items-center gap-1">
                                        <Palette size={12} />
                                        アイコンの色
                                      </span>
                                      <span className="flex items-center gap-2">
                                        <span 
                                          className="w-5 h-5 rounded border border-gray-300" 
                                          style={{ backgroundColor: action.icon_color || '#1F2937' }}
                                        />
                                        <ChevronDown 
                                          size={12} 
                                          className={`transition-transform ${expandedColorPicker?.slot === slotNum && expandedColorPicker?.type === 'icon' ? 'rotate-180' : ''}`}
                                        />
                                      </span>
                                    </button>
                                    
                                    {expandedColorPicker?.slot === slotNum && expandedColorPicker?.type === 'icon' && (
                                      <div className="p-3 bg-gray-50 rounded-lg space-y-3">
                                        {/* プリセットカラー */}
                                        <div>
                                          <p className="text-[10px] text-gray-500 mb-2">プリセット</p>
                                          <div className="flex flex-wrap gap-1.5">
                                            {PRESET_COLORS.map((preset) => (
                                              <button
                                                key={preset.color}
                                                type="button"
                                                onClick={() => updateAction(slotNum, (prev) => ({ ...prev, icon_color: preset.color }))}
                                                className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${
                                                  action.icon_color === preset.color 
                                                    ? 'border-gray-800 ring-2 ring-offset-1 ring-gray-400' 
                                                    : 'border-gray-200'
                                                }`}
                                                style={{ backgroundColor: preset.color }}
                                                title={preset.name}
                                              />
                                            ))}
                                          </div>
                                        </div>
                                        {/* カスタムカラー */}
                                        <div>
                                          <p className="text-[10px] text-gray-500 mb-2">カスタム</p>
                                          <div className="flex items-center gap-2">
                                            <input
                                              type="color"
                                              value={action.icon_color || '#1F2937'}
                                              onChange={(e) => updateAction(slotNum, (prev) => ({ ...prev, icon_color: e.target.value }))}
                                              className="w-8 h-8 rounded border border-gray-200 p-0.5 cursor-pointer"
                                            />
                                            <input
                                              type="text"
                                              value={action.icon_color || '#1F2937'}
                                              onChange={(e) => updateAction(slotNum, (prev) => ({ ...prev, icon_color: e.target.value }))}
                                              className="border rounded px-2 py-1 text-xs w-20 font-mono"
                                              placeholder="#1F2937"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* ラベル色 */}
                                {action.show_label !== false && (
                                  <div className="space-y-2">
                                    <button
                                      type="button"
                                      onClick={() => setExpandedColorPicker(
                                        expandedColorPicker?.slot === slotNum && expandedColorPicker?.type === 'label' 
                                          ? null 
                                          : { slot: slotNum, type: 'label' }
                                      )}
                                      className="w-full flex items-center justify-between text-xs text-gray-600 hover:text-gray-800"
                                    >
                                      <span className="flex items-center gap-1">
                                        <Type size={12} />
                                        ラベルの色
                                      </span>
                                      <span className="flex items-center gap-2">
                                        <span 
                                          className="w-5 h-5 rounded border border-gray-300" 
                                          style={{ backgroundColor: action.label_color || '#1F2937' }}
                                        />
                                        <ChevronDown 
                                          size={12} 
                                          className={`transition-transform ${expandedColorPicker?.slot === slotNum && expandedColorPicker?.type === 'label' ? 'rotate-180' : ''}`}
                                        />
                                      </span>
                                    </button>
                                    
                                    {expandedColorPicker?.slot === slotNum && expandedColorPicker?.type === 'label' && (
                                      <div className="p-3 bg-gray-50 rounded-lg space-y-3">
                                        {/* プリセットカラー */}
                                        <div>
                                          <p className="text-[10px] text-gray-500 mb-2">プリセット</p>
                                          <div className="flex flex-wrap gap-1.5">
                                            {PRESET_COLORS.map((preset) => (
                                              <button
                                                key={preset.color}
                                                type="button"
                                                onClick={() => updateAction(slotNum, (prev) => ({ ...prev, label_color: preset.color }))}
                                                className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${
                                                  action.label_color === preset.color 
                                                    ? 'border-gray-800 ring-2 ring-offset-1 ring-gray-400' 
                                                    : 'border-gray-200'
                                                }`}
                                                style={{ backgroundColor: preset.color }}
                                                title={preset.name}
                                              />
                                            ))}
                                          </div>
                                        </div>
                                        {/* カスタムカラー */}
                                        <div>
                                          <p className="text-[10px] text-gray-500 mb-2">カスタム</p>
                                          <div className="flex items-center gap-2">
                                            <input
                                              type="color"
                                              value={action.label_color || '#1F2937'}
                                              onChange={(e) => updateAction(slotNum, (prev) => ({ ...prev, label_color: e.target.value }))}
                                              className="w-8 h-8 rounded border border-gray-200 p-0.5 cursor-pointer"
                                            />
                                            <input
                                              type="text"
                                              value={action.label_color || '#1F2937'}
                                              onChange={(e) => updateAction(slotNum, (prev) => ({ ...prev, label_color: e.target.value }))}
                                              className="border rounded px-2 py-1 text-xs w-20 font-mono"
                                              placeholder="#1F2937"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              {/* 配置変更ボタン */}
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-600 flex items-center gap-1">
                                  <ArrowUpDown size={12} />
                                  配置変更
                                </span>
                                {swapTarget === slotNum ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-primary-600">入れ替え先を選択</span>
                                    <button
                                      type="button"
                                      onClick={() => setSwapTarget(null)}
                                      className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    >
                                      キャンセル
                                    </button>
                                  </div>
                                ) : swapTarget !== null ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      swapActions(swapTarget, slotNum)
                                      setSwapTarget(null)
                                    }}
                                    className="px-2 py-1 text-xs rounded bg-primary-100 text-primary-700 border border-primary-300 hover:bg-primary-200"
                                  >
                                    ボタン{swapTarget}と入れ替え
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setSwapTarget(slotNum)}
                                    className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
                                  >
                                    他のボタンと入れ替え
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* プレビューエリア */}
          <div className="lg:sticky lg:top-8 h-fit">
            <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
              <Smartphone size={16} /> プレビュー
            </h3>
            <div className="bg-gray-800 rounded-[3rem] p-4 border-4 border-gray-900 shadow-2xl max-w-[320px] mx-auto">
              <div className="bg-white rounded-[2rem] overflow-hidden h-[600px] relative flex flex-col">
                {/* Header */}
                <div className="bg-slate-100 p-4 border-b flex items-center justify-between shrink-0">
                  <div className="w-4 h-4 rounded-full bg-slate-300" />
                  <div className="w-20 h-2 rounded-full bg-slate-300" />
                  <div className="w-4 h-4 rounded-full bg-slate-300" />
                </div>

                {/* Chat Area */}
                <div className="flex-1 bg-[#8C9DA9] p-4 overflow-hidden relative">
                  <div className="flex gap-2 mb-4">
                    <div className="w-8 h-8 rounded-full bg-white shrink-0" />
                    <div className="bg-white p-2 rounded-lg rounded-tl-none text-xs max-w-[70%] shadow-sm">
                      いらっしゃいませ！<br />
                      下のメニューからご予約いただけます。
                    </div>
                  </div>
                </div>

                {/* Rich Menu Preview */}
                <div className="shrink-0 border-t border-gray-200">
                  <div className="bg-gray-100 px-4 py-1 flex justify-between items-center text-[10px] text-gray-500 border-b border-gray-200">
                    <span>メニュー ▲</span>
                    <span>キーボード</span>
                  </div>
                  <div 
                    ref={previewRef}
                    className={`w-full relative ${richMenuSettings.layout_id.startsWith('compact') ? 'aspect-[3/1]' : 'aspect-[1.5/1]'}`}
                  >
                    {/* Custom Image Background if set */}
                    {richMenuSettings.custom_image_url ? (
                      <img
                        src={richMenuSettings.custom_image_url}
                        alt="Rich Menu Background"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className={`absolute inset-0 w-full h-full grid gap-0.5 p-0.5
                          ${(() => {
                            if (layout.id === 'large_3_upper') return 'grid-cols-2 grid-rows-2'
                            return layout.grid || 'grid-cols-2 grid-rows-2'
                          })()}
                          ${richMenuSettings.template_id === 'simple' ? 'bg-gray-200' : ''}
                          ${richMenuSettings.template_id === 'elegant' ? 'bg-[#D4C4B7]' : ''}
                          ${richMenuSettings.template_id === 'pop' ? 'bg-primary-500' : ''}
                          ${richMenuSettings.template_id === 'dark' ? 'bg-slate-700' : ''}
                          ${richMenuSettings.template_id === 'luxury' ? 'bg-gradient-to-br from-stone-800 to-stone-900' : ''}
                          ${richMenuSettings.template_id === 'natural' ? 'bg-gradient-to-br from-amber-200 to-orange-100' : ''}
                        `}
                      >
                        {slots.map((slotNum) => {
                          let IconComp = ExternalLink
                          let label = '未設定'
                          let isSet = false
                          let showIcon = true
                          let showLabel = true
                          let iconColor: string | undefined = undefined
                          let labelColor: string | undefined = undefined
                          const action = richMenuSettings.actions[slotNum]
                          const slotBgImage = richMenuSettings.slot_background_images?.[slotNum]

                          // Freeプラン: ボタン1・2は固定表示
                          if (!isPro && slotNum === 1) {
                            IconComp = Smartphone
                            label = '予約する'
                            isSet = true
                            if (action) {
                              iconColor = action.icon_color
                              labelColor = action.label_color
                              showIcon = action.show_icon !== false
                              showLabel = action.show_label !== false
                            }
                          } else if (!isPro && slotNum === 2) {
                            IconComp = MessageSquare
                            label = 'メッセージ入力'
                            isSet = true
                            if (action) {
                              iconColor = action.icon_color
                              labelColor = action.label_color
                              showIcon = action.show_icon !== false
                              showLabel = action.show_label !== false
                            }
                          } else if (action && action.label) {
                            // アクションが設定されている場合
                            IconComp = AVAILABLE_ICONS.find((i) => i.id === action.icon)?.icon || ExternalLink
                            label = action.label || '未設定'
                            isSet = !!action.label
                            showIcon = action.show_icon !== false
                            showLabel = action.show_label !== false
                            iconColor = action.icon_color
                            labelColor = action.label_color
                          }

                          // デフォルトテーマカラー取得
                          const getDefaultColor = () => {
                            switch (richMenuSettings.template_id) {
                              case 'simple': return '#1F2937'
                              case 'elegant': return '#5D4037'
                              case 'pop': return '#0e7490'
                              case 'dark': return '#FFFFFF'
                              case 'luxury': return '#fef3c7'
                              case 'natural': return '#451a03'
                              default: return '#1F2937'
                            }
                          }
                          const defaultColor = getDefaultColor()

                          // スロット背景画像がある場合は背景色を無効化
                          const styleClass = `
                            flex flex-col items-center justify-center p-2 overflow-hidden relative
                            ${!slotBgImage && richMenuSettings.template_id === 'simple' ? 'bg-white' : ''}
                            ${!slotBgImage && richMenuSettings.template_id === 'elegant' ? 'bg-[#F5F5F0]' : ''}
                            ${!slotBgImage && richMenuSettings.template_id === 'pop' ? 'bg-primary-50' : ''}
                            ${!slotBgImage && richMenuSettings.template_id === 'dark' ? 'bg-slate-800' : ''}
                            ${!slotBgImage && richMenuSettings.template_id === 'luxury' ? 'bg-gradient-to-br from-stone-900 to-stone-950 border-r border-b border-amber-600/20' : ''}
                            ${!slotBgImage && richMenuSettings.template_id === 'natural' ? 'bg-gradient-to-br from-orange-50 to-amber-50 border-r border-b border-amber-300/30' : ''}
                            ${!isSet && !slotBgImage ? 'opacity-50' : ''}
                          `

                          let gridSpan = ''
                          if (layout.id === 'large_3_upper' && slotNum === 1) {
                            gridSpan = 'col-span-2'
                          }

                          return (
                            <div key={slotNum} className={`${styleClass} ${gridSpan} ${slotBgImage ? 'bg-gray-800' : ''}`}>
                              {/* スロット背景画像 */}
                              {slotBgImage && (
                                <img
                                  src={slotBgImage}
                                  alt={`ボタン${slotNum}背景`}
                                  className="absolute inset-0 w-full h-full object-contain"
                                />
                              )}
                              {/* コンテンツ（背景画像の上に表示） */}
                              <div className={`relative z-10 flex flex-col items-center justify-center ${slotBgImage ? 'drop-shadow-md' : ''}`}>
                                {showIcon && (
                                  <IconComp 
                                    size={20} 
                                    className="mb-1" 
                                    style={{ color: iconColor || (slotBgImage ? '#FFFFFF' : defaultColor) }}
                                  />
                                )}
                                {showLabel && (
                                  <span 
                                    className="text-[10px] font-bold truncate w-full text-center"
                                    style={{ color: labelColor || (slotBgImage ? '#FFFFFF' : defaultColor) }}
                                  >
                                    {label}
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <p className="text-center text-xs text-gray-500 mt-4">※実際の表示は端末により多少異なる場合があります</p>
          </div>
        </div>
      </div>
    </div>
  )
}
