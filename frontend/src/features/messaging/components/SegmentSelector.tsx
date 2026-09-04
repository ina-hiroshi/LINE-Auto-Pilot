import { Loader2, Users } from 'lucide-react'
import type { StoreMenu, StoreStaff } from '../../../types/storeResources'
import type { SegmentParams, SegmentType } from '../types'
import {
  SEGMENT_DEFINITIONS,
  SEGMENT_GROUP_LABELS,
  type SegmentDefinition,
  type SegmentGroup,
} from '../lib/segments'
import type { SegmentPreview } from '../hooks/useCampaign'

type Props = {
  segmentType: SegmentType
  segmentParams: SegmentParams
  onChange: (segmentType: SegmentType, segmentParams: SegmentParams) => void
  menuList: StoreMenu[]
  staffList: StoreStaff[]
  preview: SegmentPreview | null
  previewLoading: boolean
  previewError: string | null
  /** 顧客一覧から遷移してきた場合に選択済みの人数 */
  manualSelectionCount: number
}

const GROUP_ORDER: SegmentGroup[] = ['visit', 'attribute', 'manual']

function presetIsActive(params: SegmentParams, preset: SegmentParams): boolean {
  return Object.entries(preset).every(([key, value]) => params[key as keyof SegmentParams] === value)
}

export default function SegmentSelector({
  segmentType,
  segmentParams,
  onChange,
  menuList,
  staffList,
  preview,
  previewLoading,
  previewError,
  manualSelectionCount,
}: Props) {
  const selectSegment = (definition: SegmentDefinition) => {
    if (definition.type === 'manual') {
      // 個別選択は顧客一覧で選んだ結果を引き継ぐ経路でしか作れない
      if (manualSelectionCount === 0) return
      onChange('manual', { customer_ids: segmentParams.customer_ids ?? [] })
      return
    }

    // 既定値は最初のプリセット。未指定のまま人数を出すと、サーバ側の
    // 既定値（60日など）との食い違いが画面から見えなくなる。
    const defaults = definition.presets?.[0]?.params ?? {}
    onChange(definition.type, { ...defaults })
  }

  const isDisabled = (definition: SegmentDefinition): boolean => {
    if (definition.type === 'manual') return manualSelectionCount === 0
    if (definition.resource === 'menu') return menuList.length === 0
    if (definition.resource === 'staff') return staffList.length === 0
    return false
  }

  const disabledReason = (definition: SegmentDefinition): string | null => {
    if (definition.type === 'manual' && manualSelectionCount === 0) {
      return '顧客一覧でお客様を選んでから「選択した方に配信」を押すとここに入ります'
    }
    if (definition.resource === 'menu' && menuList.length === 0) {
      return 'メニューが登録されていません（予約ページ設定から登録できます）'
    }
    if (definition.resource === 'staff' && staffList.length === 0) {
      return 'スタッフが登録されていません（予約ページ設定から登録できます）'
    }
    return null
  }

  return (
    <div className="space-y-6">
      {GROUP_ORDER.map((group) => {
        const definitions = SEGMENT_DEFINITIONS.filter((definition) => definition.group === group)
        if (definitions.length === 0) return null

        return (
          <div key={group}>
            <h3 className="text-sm font-bold text-gray-700 mb-3">{SEGMENT_GROUP_LABELS[group]}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {definitions.map((definition) => {
                const selected = segmentType === definition.type
                const disabled = isDisabled(definition)
                const reason = disabledReason(definition)

                return (
                  <div key={definition.type}>
                    <button
                      type="button"
                      onClick={() => selectSegment(definition)}
                      disabled={disabled}
                      className={`w-full text-left p-4 rounded-lg border transition ${
                        selected
                          ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="font-bold text-sm text-gray-900">{definition.label}</div>
                      <div className="text-xs text-gray-500 mt-1">{definition.description}</div>
                      {definition.type === 'manual' && manualSelectionCount > 0 && (
                        <div className="text-xs text-primary-700 mt-1 font-medium">
                          {manualSelectionCount}名を選択中
                        </div>
                      )}
                    </button>

                    {reason && <p className="text-xs text-gray-400 mt-1 px-1">{reason}</p>}

                    {selected && definition.presets && (
                      <div className="flex flex-wrap gap-2 mt-2 px-1">
                        {definition.presets.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => onChange(definition.type, { ...preset.params })}
                            className={`px-3 py-1 rounded-full text-xs border transition ${
                              presetIsActive(segmentParams, preset.params)
                                ? 'border-primary-500 bg-primary-600 text-white'
                                : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {selected && definition.resource === 'menu' && (
                      <select
                        className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                        value={segmentParams.menu_id ?? ''}
                        onChange={(e) => onChange('menu', { menu_id: e.target.value })}
                      >
                        <option value="">メニューを選択してください</option>
                        {menuList.map((menu) => (
                          <option key={menu.id} value={menu.id}>
                            {menu.name}
                          </option>
                        ))}
                      </select>
                    )}

                    {selected && definition.resource === 'staff' && (
                      <select
                        className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                        value={segmentParams.staff_id ?? ''}
                        onChange={(e) => onChange('staff', { staff_id: e.target.value })}
                      >
                        <option value="">スタッフを選択してください</option>
                        {staffList.map((staff) => (
                          <option key={staff.id} value={staff.id}>
                            {staff.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center gap-3">
        <Users className="w-5 h-5 text-gray-400 shrink-0" />
        {previewLoading ? (
          <span className="text-sm text-gray-500 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            対象人数を確認しています…
          </span>
        ) : previewError ? (
          <span className="text-sm text-red-600">{previewError}</span>
        ) : preview ? (
          <div className="min-w-0">
            <span className="text-sm text-gray-900">
              この条件に当てはまるお客様は <span className="font-bold">{preview.count}名</span> です
            </span>
            {preview.sampleNames.length > 0 && (
              <p className="text-xs text-gray-500 truncate">
                例: {preview.sampleNames.join('、')}
                {preview.count > preview.sampleNames.length ? ' ほか' : ''}
              </p>
            )}
          </div>
        ) : (
          <span className="text-sm text-gray-500">配信対象を選ぶと人数が表示されます</span>
        )}
      </div>
    </div>
  )
}
