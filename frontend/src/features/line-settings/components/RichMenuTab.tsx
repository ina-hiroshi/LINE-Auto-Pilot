import type { FormEvent, RefObject } from 'react'
import { useMemo, useState } from 'react'
import { ExternalLink, Image as ImageIcon, Layout, MessageSquare, MousePointerClick, Palette, Smartphone } from 'lucide-react'
import { Save, Loader2 } from 'lucide-react'
import { AVAILABLE_ICONS, RICH_MENU_LAYOUTS } from '../constants'
import type { RichMenuAction, RichMenuSettings } from '../types'

interface RichMenuTabProps {
  richMenuSettings: RichMenuSettings
  saving: boolean
  onChangeSettings: (next: RichMenuSettings) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  previewRef?: any
}

export function RichMenuTab({ richMenuSettings, saving, onChangeSettings, onSubmit, previewRef }: RichMenuTabProps) {
  const [openIconSelector, setOpenIconSelector] = useState<number | null>(null)

  const layout = useMemo(() => RICH_MENU_LAYOUTS.find((l) => l.id === richMenuSettings.layout_id) || RICH_MENU_LAYOUTS[0], [richMenuSettings.layout_id])
  const slots = useMemo(() => Array.from({ length: layout.slots }, (_, i) => i + 1), [layout.slots])

  const updateAction = (slot: number, updater: (prev: RichMenuAction) => RichMenuAction) => {
    const prev = richMenuSettings.actions[slot] || { label: '', url: '', icon: 'external-link' }
    const nextAction = updater(prev)
    onChangeSettings({ ...richMenuSettings, actions: { ...richMenuSettings.actions, [slot]: nextAction } })
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8">
            {/* レイアウト選択 */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <Layout size={16} /> レイアウト
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {RICH_MENU_LAYOUTS.map((item) => (
                  <label
                    key={item.id}
                    className={`
                      relative cursor-pointer rounded-lg border-2 p-4 transition-all flex flex-col items-center justify-center gap-2 h-24
                      ${richMenuSettings.layout_id === item.id
                        ? 'border-primary-500 ring-2 ring-primary-100 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300 bg-gray-50'}
                    `}
                  >
                    <input
                      type="radio"
                      name="rm_layout"
                      value={item.id}
                      checked={richMenuSettings.layout_id === item.id}
                      onChange={(e) => onChangeSettings({ ...richMenuSettings, layout_id: e.target.value })}
                      className="sr-only"
                    />
                    <div className="text-center text-sm font-medium">{item.name}</div>
                    {richMenuSettings.layout_id === item.id && (
                      <div className="absolute top-2 right-2 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </div>
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* テンプレート選択 */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <Palette size={16} /> デザインテーマ
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { id: 'simple', name: 'シンプル', color: 'bg-gray-50 border-gray-200' },
                  { id: 'elegant', name: 'エレガント', color: 'bg-[#F5F5F0] border-[#E0E0D0]' },
                  { id: 'pop', name: 'ポップ', color: 'bg-primary-50 border-primary-200' },
                  { id: 'dark', name: 'ダーク', color: 'bg-slate-800 text-white border-slate-700' },
                ].map((template) => (
                  <label
                    key={template.id}
                    className={`
                      relative cursor-pointer rounded-lg border-2 p-4 transition-all flex flex-col items-center justify-center gap-2 h-24
                      ${richMenuSettings.template_id === template.id
                        ? 'border-primary-500 ring-2 ring-primary-100'
                        : 'border-gray-200 hover:border-gray-300'}
                      ${template.color}
                    `}
                  >
                    <input
                      type="radio"
                      name="rm_template"
                      value={template.id}
                      checked={richMenuSettings.template_id === template.id}
                      onChange={(e) => onChangeSettings({ ...richMenuSettings, template_id: e.target.value })}
                      className="sr-only"
                    />
                    <div className="text-center text-sm font-medium">{template.name}</div>
                    {richMenuSettings.template_id === template.id && (
                      <div className="absolute top-2 right-2 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </div>
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* ボタン設定 */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <MousePointerClick size={16} /> ボタン設定
              </h3>
              <div className="space-y-4">
                {slots.map((slotNum) => {
                  if (slotNum === 1) {
                    return (
                      <div key={slotNum} className="p-3 bg-gray-50 rounded-lg border border-gray-200 relative">
                        <div className="absolute -top-2.5 left-3 bg-primary-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                          ボタン 1 (必須)
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary-100 rounded flex items-center justify-center text-primary-600">
                            <Smartphone size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-800">予約する</p>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  if (slotNum === 2) {
                    return (
                      <div key={slotNum} className="p-3 bg-gray-50 rounded-lg border border-gray-200 relative">
                        <div className="absolute -top-2.5 left-3 bg-primary-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                          ボタン 2 (必須)
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center text-gray-600">
                            <MessageSquare size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-800">メッセージ入力</p>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  const action = richMenuSettings.actions[slotNum] || { label: '', url: '', icon: 'external-link' }

                  return (
                    <div key={slotNum} className="p-3 bg-white rounded-lg border border-gray-200 relative">
                      <div className="absolute -top-2.5 left-3 bg-gray-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                        ボタン {slotNum} (任意)
                      </div>
                      <div className="mt-2 space-y-3">
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
                                            updates.url = '' // URLは自動生成されるため空にする
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
                        {action.icon === 'credit-card' && (
                          <div className="p-2 bg-blue-50 text-blue-700 text-xs rounded border border-blue-100">
                            会員証のURLは自動的に設定されます
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
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
                        `}
                      >
                        {slots.map((slotNum) => {
                          let icon = <ExternalLink size={20} className="mb-1" />
                          let label = '未設定'
                          let isSet = false

                          if (slotNum === 1) {
                            icon = <Smartphone size={20} className="mb-1" />
                            label = '予約する'
                            isSet = true
                          } else if (slotNum === 2) {
                            icon = <MessageSquare size={20} className="mb-1" />
                            label = 'メッセージ入力'
                            isSet = true
                          } else {
                            const action = richMenuSettings.actions[slotNum]
                            if (action) {
                              const IconComp = AVAILABLE_ICONS.find((i) => i.id === action.icon)?.icon || ExternalLink
                              icon = <IconComp size={20} className="mb-1" />
                              label = action.label || '未設定'
                              isSet = true
                            }
                          }

                          const styleClass = `
                            flex flex-col items-center justify-center p-2 overflow-hidden
                            ${richMenuSettings.template_id === 'simple' ? 'bg-white text-gray-800' : ''}
                            ${richMenuSettings.template_id === 'elegant' ? 'bg-[#F5F5F0] text-[#5D4037]' : ''}
                            ${richMenuSettings.template_id === 'pop' ? 'bg-primary-50 text-primary-700' : ''}
                            ${richMenuSettings.template_id === 'dark' ? 'bg-slate-800 text-white' : ''}
                            ${!isSet ? 'opacity-50' : ''}
                          `

                          let gridSpan = ''
                          if (layout.id === 'large_3_upper' && slotNum === 1) {
                            gridSpan = 'col-span-2'
                          }

                          return (
                            <div key={slotNum} className={`${styleClass} ${gridSpan}`}>
                              {icon}
                              <span className="text-[10px] font-bold truncate w-full text-center">{label}</span>
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

        {/* カスタム画像 (Pro) */}
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <ImageIcon size={16} /> 背景画像カスタマイズ
            </h3>
            <span className="text-xs font-bold px-2 py-1 bg-gradient-to-r from-amber-200 to-yellow-400 text-yellow-900 rounded-full">
              Proプラン機能
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">画像 URL</label>
            <input
              type="text"
              value={richMenuSettings.custom_image_url}
              onChange={(e) => onChangeSettings({ ...richMenuSettings, custom_image_url: e.target.value })}
              placeholder="https://example.com/richmenu.png"
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">※未設定の場合はシステム標準の画像が使用されます</p>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-primary-600 text-white px-6 py-2.5 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={18} />}
            {saving ? '保存中...' : '設定を保存してLINEに反映'}
          </button>
        </div>
      </form>
    </>
  )
}
