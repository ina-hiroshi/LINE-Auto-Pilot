import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save, Plus, ClipboardList } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { getPaymentStatusBadgeClass, getReservationStatusLabel } from '../../../lib/reservationStatus'
import type { ReservationHistory } from '../types'

type CustomerTreatmentNotesTabProps = {
  storeId: string
  customerId: string
  reservations: ReservationHistory[]
  onToast: (message: string, type: 'success' | 'error') => void
}

type NoteDraft = Record<string, string>

export function CustomerTreatmentNotesTab({
  storeId,
  customerId,
  reservations,
  onToast,
}: CustomerTreatmentNotesTabProps) {
  const [drafts, setDrafts] = useState<NoteDraft>({})
  const [standaloneDraft, setStandaloneDraft] = useState('')
  const [standaloneDate, setStandaloneDate] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [standaloneNotes, setStandaloneNotes] = useState<
    { id: string; content: string; visited_at: string | null }[]
  >([])
  const [tableUnavailable, setTableUnavailable] = useState(false)

  const loadNotes = useCallback(async () => {
    setLoading(true)
    setTableUnavailable(false)
    try {
      const { data, error } = await supabase
        .from('customer_treatment_notes')
        .select('id, reservation_id, content, visited_at')
        .eq('store_id', storeId)
        .eq('customer_id', customerId)

      if (error) {
        // PGRST205 = テーブル未登録（スキーマキャッシュ未更新など）
        if (error.code === 'PGRST205' || error.message?.includes('customer_treatment_notes')) {
          setTableUnavailable(true)
          return
        }
        throw error
      }

      const next: NoteDraft = {}
      const standalone: { id: string; content: string; visited_at: string | null }[] = []
      for (const row of data ?? []) {
        if (row.reservation_id) {
          next[row.reservation_id] = row.content ?? ''
        } else {
          standalone.push({
            id: row.id,
            content: row.content ?? '',
            visited_at: row.visited_at,
          })
        }
      }
      setDrafts(next)
      setStandaloneNotes(standalone)
    } catch (e) {
      console.error('loadNotes:', e)
    } finally {
      setLoading(false)
    }
  }, [storeId, customerId])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  const saveReservationNote = async (reservationId: string) => {
    const content = drafts[reservationId] ?? ''
    setSavingId(reservationId)
    try {
      if (!content.trim()) {
        const { error } = await supabase
          .from('customer_treatment_notes')
          .delete()
          .eq('store_id', storeId)
          .eq('reservation_id', reservationId)
        if (error) throw error
        onToast('施術メモを保存しました', 'success')
        return
      }

      const res = reservations.find((r) => r.id === reservationId)
      const { error } = await supabase.from('customer_treatment_notes').upsert(
        {
          store_id: storeId,
          customer_id: customerId,
          reservation_id: reservationId,
          content: content.trim(),
          visited_at: res?.start_time ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'store_id,reservation_id' },
      )

      if (error) throw error
      onToast('施術メモを保存しました', 'success')
    } catch (e) {
      console.error('saveReservationNote:', e)
      onToast('保存に失敗しました', 'error')
    } finally {
      setSavingId(null)
    }
  }

  const addStandaloneNote = async () => {
    if (!standaloneDraft.trim()) return
    setSavingId('standalone')
    try {
      const visitedAt = standaloneDate
        ? new Date(`${standaloneDate}T12:00:00`).toISOString()
        : new Date().toISOString()

      const { error } = await supabase.from('customer_treatment_notes').insert({
        store_id: storeId,
        customer_id: customerId,
        reservation_id: null,
        content: standaloneDraft.trim(),
        visited_at: visitedAt,
      })

      if (error) throw error
      setStandaloneDraft('')
      setStandaloneDate('')
      await loadNotes()
      onToast('施術メモを保存しました', 'success')
    } catch (e) {
      console.error('addStandaloneNote:', e)
      onToast('保存に失敗しました', 'error')
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (tableUnavailable) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium mb-1">施術メモ機能の準備中です</p>
        <p className="text-amber-800">
          データベースの更新が反映されるまでお待ちください。しばらく経ってからページを再読み込みしてください。
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        来店・予約ごとに施術内容や気づきを記録できます。日付・メニュー・ステータスは予約情報から表示しています。保存は各カードの「保存」ボタンから行います。
      </p>

      {reservations.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-lg border border-gray-100">
          予約履歴がありません
        </div>
      ) : (
        <div className="space-y-4">
          {reservations.map((r) => (
            <div
              key={r.id}
              className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
            >
              <div className="flex flex-wrap justify-between gap-2 mb-3">
                <div>
                  <p className="font-bold text-gray-900 text-sm">
                    {new Date(r.start_time).toLocaleDateString('ja-JP', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      weekday: 'short',
                    })}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {r.menu_name || 'メニュー未定'}
                    {r.staff_name && ` · ${r.staff_name}`}
                  </p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium h-fit ${getPaymentStatusBadgeClass(r.status)}`}
                >
                  {getReservationStatusLabel(r.status)}
                </span>
              </div>
              <label className="block text-xs font-medium text-gray-500 mb-1">施術メモ</label>
              <textarea
                value={drafts[r.id] ?? ''}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
                placeholder="施術内容、使用製品、次回の提案など..."
              />
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={() => saveReservationNote(r.id)}
                  disabled={savingId === r.id}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingId === r.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                  保存
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {standaloneNotes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-gray-900">その他のメモ</h4>
          {standaloneNotes.map((n) => (
            <div key={n.id} className="p-3 bg-gray-50 border border-gray-100 rounded-lg text-sm">
              {n.visited_at && (
                <p className="text-xs text-gray-500 mb-1">
                  {new Date(n.visited_at).toLocaleDateString('ja-JP')}
                </p>
              )}
              <p className="text-gray-800 whitespace-pre-wrap">{n.content}</p>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-gray-200 pt-6">
        <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary-500" />
          予約に紐づかないメモを追加
        </h4>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">来店日（任意）</label>
            <input
              type="date"
              value={standaloneDate}
              onChange={(e) => setStandaloneDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <textarea
            value={standaloneDraft}
            onChange={(e) => setStandaloneDraft(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="電話予約のみの来店など..."
          />
          <button
            type="button"
            onClick={addStandaloneNote}
            disabled={savingId === 'standalone' || !standaloneDraft.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-900 disabled:opacity-50"
          >
            {savingId === 'standalone' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            メモを追加
          </button>
        </div>
      </div>
    </div>
  )
}
