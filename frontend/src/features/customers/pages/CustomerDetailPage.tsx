import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Loader2, User, ClipboardList, MessageSquare, LayoutGrid } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import Toast from '../../../components/Toast'
import { UnderlineTabs } from '../../../components/UnderlineTabs'
import { isLineCustomer } from '../../../lib/reservationStatus'
import { usePointOperation } from '../../../hooks/usePointOperation'
import { useCustomerDetail } from '../hooks/useCustomerDetail'
import { CustomerProfileHeader } from '../components/CustomerProfileHeader'
import { CustomerPointsSection } from '../components/CustomerPointsSection'
import { CustomerGeneralNotes } from '../components/CustomerGeneralNotes'
import { CustomerTreatmentNotesTab } from '../components/CustomerTreatmentNotesTab'
import { CustomerMessagesTab } from '../components/CustomerMessagesTab'

type TabId = 'overview' | 'treatment' | 'messages'

export default function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const {
    storeId,
    storeSettings,
    hasLineAccount,
    customer,
    reservationHistory,
    loading,
    error,
    refreshPoints,
    updateCustomerLocal,
    fetchCustomer,
  } = useCustomerDetail(customerId)

  const { updatePoints, saving: pointsSaving } = usePointOperation(storeId, storeSettings)

  const [editForm, setEditForm] = useState({ real_name: '', furigana: '', notes: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({
    isVisible: false,
    message: '',
    type: 'success',
  })

  const showMessagesTab = hasLineAccount && customer && isLineCustomer(customer.line_user_id)
  const highlightLogId = searchParams.get('log_id')

  useEffect(() => {
    const tab = searchParams.get('tab') as TabId | null
    if (tab === 'messages' && showMessagesTab) setActiveTab('messages')
    else if (tab === 'treatment') setActiveTab('treatment')
    else if (tab === 'overview') setActiveTab('overview')
  }, [searchParams, showMessagesTab])

  useEffect(() => {
    if (customer) {
      setEditForm({
        real_name: customer.real_name || '',
        furigana: customer.furigana || '',
        notes: customer.notes || '',
      })
    }
  }, [customer])

  const handleTabChange = (id: string) => {
    const tab = id as TabId
    setActiveTab(tab)
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    if (tab !== 'messages') next.delete('log_id')
    setSearchParams(next, { replace: true })
  }

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ isVisible: true, message, type })
  }

  const handleSaveProfile = async () => {
    if (!customer || !storeId) return
    setSavingProfile(true)
    try {
      const { error: saveError } = await supabase
        .from('customers')
        .update({
          real_name: editForm.real_name || null,
          furigana: editForm.furigana || null,
          notes: editForm.notes || null,
        })
        .eq('id', customer.id)

      if (saveError) throw saveError
      updateCustomerLocal(editForm)
      showToast('顧客情報を保存しました', 'success')
    } catch (e) {
      console.error(e)
      showToast('保存に失敗しました', 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePointsSubmit = async (amount: number, type: 'add' | 'use') => {
    if (!customer) return
    const result = await updatePoints(customer.line_user_id, customer.points, amount, type)
    if (result.success) {
      const isStamp = storeSettings?.card_type === 'stamp'
      showToast(
        result.stampCompleted
          ? 'スタンプカードが満了しました！'
          : type === 'add'
            ? isStamp
              ? 'スタンプを押印しました'
              : 'ポイントを付与しました'
            : isStamp
              ? 'スタンプを利用しました'
              : 'ポイントを利用しました',
        'success',
      )
      refreshPoints(result.newBalance)
      fetchCustomer()
    } else {
      showToast('ポイント更新に失敗しました', 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (error || !customer || !storeId) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600 mb-4">{error || '顧客が見つかりません'}</p>
        <Link to="/customers" className="text-primary-600 hover:underline text-sm font-medium">
          顧客一覧に戻る
        </Link>
      </div>
    )
  }

  const tabItems = [
    { id: 'overview' as const, label: '概要', icon: LayoutGrid },
    { id: 'treatment' as const, label: '施術メモ', icon: ClipboardList },
    ...(showMessagesTab
      ? [{ id: 'messages' as const, label: 'メッセージ', icon: MessageSquare }]
      : []),
  ]

  return (
    <div className="flex flex-col h-full">
      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, isVisible: false }))}
      />

      <div className="shrink-0 z-20 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-gray-200 w-full">
        <div className="px-4 sm:px-8 py-4">
          <button
            type="button"
            onClick={() => navigate('/customers')}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            顧客一覧
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">顧客詳細</h1>
          <p className="text-sm text-gray-500">ポイント・施術メモ・LINEメッセージを管理できます。</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="w-full">
          <UnderlineTabs activeId={activeTab} onChange={handleTabChange} items={tabItems} />
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <CustomerProfileHeader customer={customer} />

            {activeTab === 'overview' && (
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                <CustomerPointsSection
                  balance={customer.points}
                  storeSettings={storeSettings}
                  saving={pointsSaving}
                  onSubmit={handlePointsSubmit}
                />
                <CustomerGeneralNotes
                  realName={editForm.real_name}
                  furigana={editForm.furigana}
                  notes={editForm.notes}
                  onChange={(field, value) => setEditForm((prev) => ({ ...prev, [field]: value }))}
                  onSave={handleSaveProfile}
                  saving={savingProfile}
                />
              </div>
            )}

            {activeTab === 'treatment' && (
              <div className="mt-6">
                <CustomerTreatmentNotesTab
                  storeId={storeId}
                  customerId={customer.id}
                  reservations={reservationHistory}
                  onToast={showToast}
                />
              </div>
            )}

            {activeTab === 'messages' && showMessagesTab && (
              <div className="mt-6">
                <CustomerMessagesTab
                  storeId={storeId}
                  customer={customer}
                  highlightLogId={highlightLogId}
                  onToast={showToast}
                />
              </div>
            )}

            {activeTab === 'messages' && !showMessagesTab && (
              <div className="mt-6 text-center py-12 text-gray-500 text-sm">
                <User className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                {!hasLineAccount
                  ? 'LINE公式アカウントが連携されていません。設定画面から連携してください。'
                  : '手動登録の顧客には LINE メッセージ機能は利用できません。'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
