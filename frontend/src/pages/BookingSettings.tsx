import { useState, useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2, Save } from 'lucide-react'
import Toast from '../components/Toast'
import { BookingPageTab } from '../features/line-settings/components/BookingPageTab'
import { StaffModal } from '../features/line-settings/components/StaffModal'
import { MenuModal } from '../features/line-settings/components/MenuModal'
import { DeleteConfirmModal } from '../features/line-settings/components/DeleteConfirmModal'
import type { BookingSettings, BookingSystemType, Staff, Menu, DeletingItem } from '../features/line-settings/types'
import { usePlan } from '../hooks/usePlan'

const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  liff_template_id: 'simple',
  liff_theme_color: '#00c3dc',
  liff_logo_url: '',
  booking_system_type: 'generic',
  slot_interval_minutes: 60,
  capacity_per_slot: 1,
  business_hours: null,
  booking_enable_party_size: false,
  booking_enable_staff: false,
  booking_enable_menu: false,
}

export default function BookingSettingsPage() {
  const { isPro } = usePlan()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [bookingSettings, setBookingSettings] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS)
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [menuList, setMenuList] = useState<Menu[]>([])
  const [specialDates, setSpecialDates] = useState<Record<string, { is_closed: boolean; override_hours: { start: string; end: string }[] | null }>>({})
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0)

  // Modals
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false)
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<DeletingItem | null>(null)
  const [staffFormData, setStaffFormData] = useState<Pick<Staff, 'name' | 'role' | 'image_url'>>({ name: '', role: '', image_url: '' })
  const [menuFormData, setMenuFormData] = useState<Pick<Menu, 'name' | 'description' | 'price' | 'duration_minutes' | 'capacity_per_slot'>>({ name: '', description: '', price: 0, duration_minutes: 60, capacity_per_slot: null })
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null)
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null)

  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({
    isVisible: false,
    message: '',
    type: 'success'
  })

  const showToast = (message: string, type: 'success' | 'error') => {
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
          setBookingSettings({
            liff_template_id: store.liff_template_id || DEFAULT_BOOKING_SETTINGS.liff_template_id,
            liff_theme_color: store.liff_theme_color || DEFAULT_BOOKING_SETTINGS.liff_theme_color,
            liff_logo_url: store.liff_logo_url || DEFAULT_BOOKING_SETTINGS.liff_logo_url,
            booking_system_type: (store.booking_system_type as BookingSystemType) || DEFAULT_BOOKING_SETTINGS.booking_system_type,
            slot_interval_minutes: store.slot_interval_minutes || DEFAULT_BOOKING_SETTINGS.slot_interval_minutes,
            capacity_per_slot: store.capacity_per_slot || DEFAULT_BOOKING_SETTINGS.capacity_per_slot,
            max_booking_days: store.max_booking_days || 60,
            business_hours: store.business_hours || DEFAULT_BOOKING_SETTINGS.business_hours,
            booking_enable_party_size: store.booking_enable_party_size ?? DEFAULT_BOOKING_SETTINGS.booking_enable_party_size,
            booking_enable_staff: store.booking_enable_staff ?? DEFAULT_BOOKING_SETTINGS.booking_enable_staff,
            booking_enable_menu: store.booking_enable_menu ?? DEFAULT_BOOKING_SETTINGS.booking_enable_menu,
          })

          const { data: staff } = await supabase
            .from('staff_members')
            .select('*')
            .eq('store_id', store.id)
            .order('created_at', { ascending: true })
          setStaffList((staff ?? []) as Staff[])

          const { data: menus } = await supabase
            .from('booking_menus')
            .select('*')
            .eq('store_id', store.id)
            .order('created_at', { ascending: true })
          setMenuList((menus ?? []) as Menu[])

          // 特別日付を取得
          const { data: dates } = await supabase
            .from('booking_special_dates')
            .select('date, is_closed, override_hours')
            .eq('store_id', store.id)
          if (dates) {
            const datesMap: Record<string, { is_closed: boolean; override_hours: { start: string; end: string }[] | null }> = {}
            dates.forEach((d: { date: string; is_closed: boolean; override_hours: { start: string; end: string }[] | null }) => {
              datesMap[d.date] = { is_closed: d.is_closed, override_hours: d.override_hours }
            })
            setSpecialDates(datesMap)
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // 特別日付の再取得（プレビュー更新時）
  useEffect(() => {
    const refetchSpecialDates = async () => {
      if (!storeId || previewRefreshKey === 0) return
      try {
        const { data: dates } = await supabase
          .from('booking_special_dates')
          .select('date, is_closed, override_hours')
          .eq('store_id', storeId)
        if (dates) {
          const datesMap: Record<string, { is_closed: boolean; override_hours: { start: string; end: string }[] | null }> = {}
          dates.forEach((d: { date: string; is_closed: boolean; override_hours: { start: string; end: string }[] | null }) => {
            datesMap[d.date] = { is_closed: d.is_closed, override_hours: d.override_hours }
          })
          setSpecialDates(datesMap)
        }
        
        // 営業時間も再取得
        const { data: store } = await supabase
          .from('stores')
          .select('business_hours')
          .eq('id', storeId)
          .single()
        if (store?.business_hours) {
          setBookingSettings(prev => ({ ...prev, business_hours: store.business_hours }))
        }
      } catch (e) {
        console.error('Failed to refetch special dates:', e)
      }
    }
    refetchSpecialDates()
  }, [previewRefreshKey, storeId])

  // Post message to preview iframe
  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'UPDATE_SETTINGS',
          settings: bookingSettings,
          staffList,
          menuList,
          specialDates,
        },
        '*',
      )
    }
  }, [bookingSettings, staffList, menuList, specialDates])

  const handleSave = async (e?: FormEvent) => {
    if (e) e.preventDefault()
    if (!storeId) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('stores')
        .update({
          liff_template_id: bookingSettings.liff_template_id,
          liff_theme_color: bookingSettings.liff_theme_color,
          liff_logo_url: bookingSettings.liff_logo_url,
          booking_system_type: bookingSettings.booking_system_type,
          slot_interval_minutes: bookingSettings.slot_interval_minutes,
          capacity_per_slot: bookingSettings.capacity_per_slot,
          max_booking_days: bookingSettings.max_booking_days,
          business_hours: bookingSettings.business_hours,
          booking_enable_party_size: bookingSettings.booking_enable_party_size,
          booking_enable_staff: bookingSettings.booking_enable_staff,
          booking_enable_menu: bookingSettings.booking_enable_menu,
          updated_at: new Date().toISOString(),
        })
        .eq('id', storeId)

      if (error) throw error
      setToast({ isVisible: true, message: '予約ページ設定を保存しました', type: 'success' })
    } catch (error) {
      console.error('Save Error:', error)
      setToast({ isVisible: true, message: '保存に失敗しました', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // --- Staff Handlers ---
  const handleAddStaff = () => {
    setStaffFormData({ name: '', role: '', image_url: '' })
    setEditingStaffId(null)
    setIsStaffModalOpen(true)
  }
  const handleEditStaff = (staff: Staff) => {
    setStaffFormData({ name: staff.name, role: staff.role || '', image_url: staff.image_url || '' })
    setEditingStaffId(staff.id)
    setIsStaffModalOpen(true)
  }
  const handleDeleteStaff = (id: string) => {
    const staff = staffList.find(s => s.id === id)
    if (staff) {
      setDeletingItem({ type: 'staff', id: staff.id, name: staff.name })
      setIsDeleteModalOpen(true)
    }
  }
  const handleSaveStaff = async () => {
    if (!storeId) return
    setSaving(true)
    try {
      if (editingStaffId) {
        const { error } = await supabase
          .from('staff_members')
          .update({ ...staffFormData, updated_at: new Date().toISOString() })
          .eq('id', editingStaffId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('staff_members')
          .insert({ ...staffFormData, store_id: storeId })
        if (error) throw error
      }
      // Refresh list
      const { data } = await supabase.from('staff_members').select('*').eq('store_id', storeId).order('created_at', { ascending: true })
      setStaffList((data ?? []) as Staff[])
      setIsStaffModalOpen(false)
      setToast({ isVisible: true, message: 'スタッフ情報を保存しました', type: 'success' })
    } catch (e) {
      console.error(e)
      setToast({ isVisible: true, message: '保存に失敗しました', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // --- Menu Handlers ---
  const handleAddMenu = () => {
    setMenuFormData({ name: '', description: '', price: 0, duration_minutes: 60, capacity_per_slot: null })
    setEditingMenuId(null)
    setIsMenuModalOpen(true)
  }
  const handleEditMenu = (menu: Menu) => {
    setMenuFormData({
      name: menu.name,
      description: menu.description || '',
      price: menu.price,
      duration_minutes: menu.duration_minutes,
      capacity_per_slot: menu.capacity_per_slot
    })
    setEditingMenuId(menu.id)
    setIsMenuModalOpen(true)
  }
  const handleDeleteMenu = (id: string) => {
    const menu = menuList.find(m => m.id === id)
    if (menu) {
      setDeletingItem({ type: 'menu', id: menu.id, name: menu.name })
      setIsDeleteModalOpen(true)
    }
  }
  const handleSaveMenu = async () => {
    if (!storeId) return
    setSaving(true)
    try {
      if (editingMenuId) {
        const { error } = await supabase
          .from('booking_menus')
          .update({ ...menuFormData, updated_at: new Date().toISOString() })
          .eq('id', editingMenuId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('booking_menus')
          .insert({ ...menuFormData, store_id: storeId })
        if (error) throw error
      }
      // Refresh list
      const { data } = await supabase.from('booking_menus').select('*').eq('store_id', storeId).order('created_at', { ascending: true })
      setMenuList((data ?? []) as Menu[])
      setIsMenuModalOpen(false)
      setToast({ isVisible: true, message: 'メニュー情報を保存しました', type: 'success' })
    } catch (e) {
      console.error(e)
      setToast({ isVisible: true, message: '保存に失敗しました', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // --- Delete Handler ---
  const handleConfirmDelete = async () => {
    if (!deletingItem) return
    setSaving(true)
    try {
      const table = deletingItem.type === 'staff' ? 'staff_members' : 'booking_menus'
      const { error } = await supabase.from(table).delete().eq('id', deletingItem.id)
      if (error) throw error

      if (deletingItem.type === 'staff') {
        setStaffList(prev => prev.filter(s => s.id !== deletingItem.id))
      } else {
        setMenuList(prev => prev.filter(m => m.id !== deletingItem.id))
      }
      setIsDeleteModalOpen(false)
      setToast({ isVisible: true, message: '削除しました', type: 'success' })
    } catch (e) {
      console.error(e)
      setToast({ isVisible: true, message: '削除に失敗しました', type: 'error' })
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
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">予約ページ</h1>
              <p className="text-sm text-gray-500">営業時間、メニュー、スタッフなどの予約受付設定を行います。</p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors text-sm font-bold shadow-sm shrink-0"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />}
              {saving ? '保存中...' : '設定を保存'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <BookingPageTab
          storeId={storeId}
          bookingSettings={bookingSettings}
          onBookingSettingsChange={setBookingSettings}
          staffList={staffList}
          menuList={menuList}
          onAddStaff={handleAddStaff}
          onEditStaff={handleEditStaff}
          onDeleteStaff={handleDeleteStaff}
          onAddMenu={handleAddMenu}
          onEditMenu={handleEditMenu}
          onDeleteMenu={handleDeleteMenu}
          iframeRef={iframeRef}
          previewRefreshKey={previewRefreshKey}
          onRefreshPreview={() => setPreviewRefreshKey(prev => prev + 1)}
          onToast={showToast}
          isPro={isPro}
        />
      </div>

      {/* Modals */}
      <StaffModal
        isOpen={isStaffModalOpen}
        isLoading={saving}
        onClose={() => setIsStaffModalOpen(false)}
        onConfirm={handleSaveStaff}
        formData={staffFormData}
        onChange={setStaffFormData}
        isEditing={!!editingStaffId}
      />
      <MenuModal
        isOpen={isMenuModalOpen}
        isLoading={saving}
        onClose={() => setIsMenuModalOpen(false)}
        onConfirm={handleSaveMenu}
        formData={menuFormData}
        onChange={setMenuFormData}
        isEditing={!!editingMenuId}
        bookingSystemType={bookingSettings.booking_system_type}
      />
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        isLoading={saving}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        target={deletingItem}
      />
        </div>
      </div>
    </div>
  )
}
