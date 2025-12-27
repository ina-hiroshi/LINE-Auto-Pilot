import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ExternalLink, Loader2, MessageSquare, Smartphone } from 'lucide-react'
import Toast from '../components/Toast'
import Modal from '../components/Modal'
import { supabase } from '../lib/supabase'
import { RICH_MENU_LAYOUTS, AVAILABLE_ICONS } from '../features/line-settings/constants'
import { TabsNav, type TabKey } from '../features/line-settings/components/TabsNav'
import { BookingPageTab } from '../features/line-settings/components/BookingPageTab'
import { RichMenuTab } from '../features/line-settings/components/RichMenuTab'
import { CalendarTab } from '../features/line-settings/components/CalendarTab'
import { ConnectionTab } from '../features/line-settings/components/ConnectionTab'
import { GuideTab } from '../features/line-settings/components/GuideTab'
import { BasicInfoTab } from '../features/line-settings/components/BasicInfoTab'
import { PasswordTab } from '../features/line-settings/components/PasswordTab'
import { StaffModal } from '../features/line-settings/components/StaffModal'
import { MenuModal } from '../features/line-settings/components/MenuModal'
import { DeleteConfirmModal } from '../features/line-settings/components/DeleteConfirmModal'
import type {
	BookingSettings,
	BookingSystemType,
	DeletingItem,
	GoogleCalendarSettings,
	LineSettingsState,
	Menu,
	ProfileData,
	RichMenuAction,
	RichMenuSettings,
	Staff,
} from '../features/line-settings/types'

// ---- 初期値定義 ----
const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
	liff_template_id: 'simple',
	liff_theme_color: '#00c3dc',
	liff_logo_url: '',
	booking_system_type: 'generic',
	slot_interval_minutes: 60,
	capacity_per_slot: 1,
	business_hours: null,
}

const DEFAULT_RICH_MENU_SETTINGS: RichMenuSettings = {
	template_id: 'simple',
	layout_id: 'large_4',
	custom_image_url: '',
	actions: {},
}

const DEFAULT_PROFILE_DATA: ProfileData = {
	full_name: '',
	full_name_kana: '',
	user_phone_number: '',
	store_name: '',
	postal_code: '',
	address: '',
	store_phone_number: '',
	industry: '',
}

const DEFAULT_LINE_SETTINGS: LineSettingsState = {
	channel_id: '',
	channel_secret: '',
	channel_token: '',
	bot_id: '',
}

const DEFAULT_GOOGLE_SETTINGS: GoogleCalendarSettings = {
	connected: false,
}

const DEFAULT_PASSWORD_DATA = {
	newPassword: '',
	confirmPassword: '',
}

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/line-webhook`

// ---- 共通ヘルパー ----
const toErrorMessage = (error: unknown): string => {
	if (error instanceof Error) return error.message
	if (typeof error === 'object' && error && 'message' in error) {
		const maybeMessage = (error as { message?: unknown }).message
		if (typeof maybeMessage === 'string') return maybeMessage
	}
	return '不明なエラー'
}

const blobFromCanvas = (canvas: HTMLCanvasElement): Promise<Blob> => {
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) {
				resolve(blob)
			} else {
				reject(new Error('Blob failed'))
			}
		}, 'image/png')
	})
}

export default function LineSettings() {
	const location = useLocation()
	const iframeRef = useRef<HTMLIFrameElement | null>(null)

	const [activeTab, setActiveTab] = useState<TabKey>('connection')
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

	const [storeId, setStoreId] = useState<string | null>(null)
	const [googleCalendarSettings, setGoogleCalendarSettings] = useState<GoogleCalendarSettings>(DEFAULT_GOOGLE_SETTINGS)
	const [lineSettings, setLineSettings] = useState<LineSettingsState>(DEFAULT_LINE_SETTINGS)
	const [profileData, setProfileData] = useState<ProfileData>(DEFAULT_PROFILE_DATA)
	const [bookingSettings, setBookingSettings] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS)
	const [richMenuSettings, setRichMenuSettings] = useState<RichMenuSettings>(DEFAULT_RICH_MENU_SETTINGS)
	const [staffList, setStaffList] = useState<Staff[]>([])
	const [menuList, setMenuList] = useState<Menu[]>([])

	const [passwordData, setPasswordData] = useState(DEFAULT_PASSWORD_DATA)
	const [isStaffModalOpen, setIsStaffModalOpen] = useState(false)
	const [isMenuModalOpen, setIsMenuModalOpen] = useState(false)
	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
	const [deletingItem, setDeletingItem] = useState<DeletingItem | null>(null)
	const [staffFormData, setStaffFormData] = useState<Pick<Staff, 'name' | 'role' | 'image_url'>>({ name: '', role: '', image_url: '' })
	const [menuFormData, setMenuFormData] = useState<Pick<Menu, 'name' | 'description' | 'price' | 'duration_minutes' | 'capacity_per_slot'>>({ name: '', description: '', price: 0, duration_minutes: 60, capacity_per_slot: null })
	const [editingStaffId, setEditingStaffId] = useState<string | null>(null)
	const [editingMenuId, setEditingMenuId] = useState<string | null>(null)
	const [previewRefreshKey, setPreviewRefreshKey] = useState(0)
	const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false)

	// 予約プレビューへ設定をポストする
	useEffect(() => {
		if (activeTab === 'booking_page' && iframeRef.current?.contentWindow) {
			iframeRef.current.contentWindow.postMessage(
				{
					type: 'UPDATE_SETTINGS',
					settings: bookingSettings,
					staffList,
					menuList,
				},
				'*',
			)
		}
	}, [activeTab, bookingSettings, staffList, menuList])

	const fetchData = useCallback(async () => {
		setLoading(true)
		try {
			// 認証付きで10秒タイムアウト
			const getUserWithTimeout = async () => {
				const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
				return Promise.race([supabase.auth.getUser(), timeout]) as Promise<{ data: { user: import('@supabase/supabase-js').User | null } }>
			}

			const { data: { user } } = await getUserWithTimeout()
			if (!user) {
				window.location.href = '/'
				return
			}

			// Googleカレンダー設定
			const { data: calendarSettings } = await supabase
				.from('google_calendar_settings')
				.select('*')
				.eq('user_id', user.id)
				.maybeSingle()

			if (calendarSettings) {
				setGoogleCalendarSettings({
					connected: true,
					calendar_id: calendarSettings.calendar_id,
					updated_at: calendarSettings.updated_at,
				})
			} else {
				setGoogleCalendarSettings(DEFAULT_GOOGLE_SETTINGS)
			}

			// Profile
			const { data: profile } = await supabase
				.from('profiles')
				.select('*')
				.eq('id', user.id)
				.single()

			// Store
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
				})
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
			}

			// Line Account
			const { data: lineAccounts } = await supabase
				.from('line_accounts')
				.select('*')
				.eq('user_id', user.id)
				.limit(1)

			const lineAccount = lineAccounts && lineAccounts.length > 0 ? lineAccounts[0] : null
			if (lineAccount) {
				setLineSettings({
					channel_id: lineAccount.channel_id || '',
					channel_secret: lineAccount.channel_secret || '',
					channel_token: lineAccount.channel_access_token || '',
					bot_id: lineAccount.bot_id || '',
				})
			}

			if (profile || store) {
				setProfileData({
					full_name: profile?.full_name || '',
					full_name_kana: profile?.full_name_kana || '',
					user_phone_number: profile?.phone_number || '',
					store_name: store?.name || '',
					postal_code: store?.postal_code || '',
					address: store?.address || '',
					store_phone_number: store?.phone_number || '',
					industry: store?.industry || '',
				})
			}
		} catch (error) {
			console.error('Error fetching data:', error)
			const err = error as { message?: string; status?: number }
			if (err.message === 'Timeout' || err.status === 401) {
				window.location.href = '/'
			}
		} finally {
			setLoading(false)
		}
	}, [])

	const handleGoogleConnect = useCallback(async () => {
		setSaving(true)
		try {
			const { data: { session } } = await supabase.auth.getSession()
			if (!session) return

			const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-auth`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${session.access_token}`,
				},
			})

			const { url, error } = (await response.json()) as { url?: string; error?: string }
			if (error) throw new Error(error)

			if (url) window.location.href = url
		} catch (error) {
			console.error('Google Connect Error:', error)
			setMessage({ type: 'error', text: `Google連携の開始に失敗しました: ${toErrorMessage(error)}` })
		} finally {
			setSaving(false)
		}
	}, [])

	const handleGoogleCallback = useCallback(async (code: string) => {
		setSaving(true)
		try {
			const { data: { session } } = await supabase.auth.getSession()
			if (!session) return

			const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-auth`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${session.access_token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ code }),
			})

			const result = (await response.json()) as { error?: string }
			if (result.error) throw new Error(result.error)

			setMessage({ type: 'success', text: 'Googleカレンダーと連携しました。' })
			fetchData()
		} catch (error) {
			console.error('Google Callback Error:', error)
			setMessage({ type: 'error', text: `Google連携に失敗しました: ${toErrorMessage(error)}` })
		} finally {
			setSaving(false)
		}
	}, [fetchData])

	const handleGoogleDisconnect = async () => {
		try {
			setSaving(true)
			const {
				data: { user },
			} = await supabase.auth.getUser()
			if (!user) return

			const { error } = await supabase.from('google_calendar_settings').delete().eq('user_id', user.id)

			if (error) throw error

			setGoogleCalendarSettings((prev) => ({ ...prev, connected: false, calendar_id: undefined, updated_at: undefined }))
			setMessage({ type: 'success', text: 'Google連携を解除しました' })
			setIsDisconnectModalOpen(false)
		} catch (error) {
			console.error('Disconnect Error:', error)
			setMessage({ type: 'error', text: `連携解除に失敗しました: ${toErrorMessage(error)}` })
		} finally {
			setSaving(false)
		}
	}

	// URLパラメータのtab/codeを監視
	useEffect(() => {
		const params = new URLSearchParams(location.search)
		const tab = params.get('tab') as TabKey | null
		const code = params.get('code')
		if (code) {
			handleGoogleCallback(code)
			window.history.replaceState({}, '', window.location.pathname + (tab ? `?tab=${tab}` : ''))
		}

		if (tab) {
			setActiveTab(tab)
		}
	}, [location, handleGoogleCallback])

	// 初期データロード
	useEffect(() => {
		fetchData()
	}, [fetchData])

	const handlePostalCodeSearch = useCallback(async () => {
		if (!profileData.postal_code || profileData.postal_code.length < 7) return

		try {
			const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${profileData.postal_code}`)
			const data = (await response.json()) as { results?: { address1: string; address2: string; address3: string }[] }
			if (data.results && data.results[0]) {
				const result = data.results[0]
				const fullAddress = `${result.address1}${result.address2}${result.address3}`
				setProfileData((prev) => ({ ...prev, address: fullAddress }))
			} else {
				alert('住所が見つかりませんでした。')
			}
		} catch (error) {
			console.error('Address search error:', error)
		}
	}, [profileData.postal_code])

	const handleAddStaff = useCallback(() => {
		setEditingStaffId(null)
		setStaffFormData({ name: '', role: '', image_url: '' })
		setIsStaffModalOpen(true)
	}, [])

	const handleEditStaff = useCallback((staff: Staff) => {
		setEditingStaffId(staff.id)
		setStaffFormData({
			name: staff.name,
			role: staff.role || '',
			image_url: staff.image_url || '',
		})
		setIsStaffModalOpen(true)
	}, [])

	const handleSubmitStaff = useCallback(async () => {
		if (!storeId || !staffFormData.name) return
		setSaving(true)
		try {
			const base = supabase.from('staff_members')
			const payload = { name: staffFormData.name, role: staffFormData.role, image_url: staffFormData.image_url }
			const result = editingStaffId
				? await base.update(payload).eq('id', editingStaffId).select().single()
				: await base.insert({ ...payload, store_id: storeId }).select().single()

			const { data, error } = result as { data: Staff | null; error: unknown }
			if (error) throw error
			if (!data) throw new Error('スタッフの保存に失敗しました')

			setStaffList((prev) => (editingStaffId ? prev.map((s) => (s.id === editingStaffId ? data : s)) : [...prev, data]))
			setMessage({ type: 'success', text: editingStaffId ? 'スタッフ情報を更新しました' : 'スタッフを追加しました' })
			setIsStaffModalOpen(false)
		} catch (error) {
			console.error('Error saving staff:', error)
			setMessage({ type: 'error', text: 'スタッフの保存に失敗しました' })
		} finally {
			setSaving(false)
		}
	}, [editingStaffId, staffFormData, storeId])

	const handleDeleteStaff = useCallback((id: string) => {
		const staff = staffList.find((s) => s.id === id)
		if (!staff) return
		setDeletingItem({ type: 'staff', id: staff.id, name: staff.name })
		setIsDeleteModalOpen(true)
	}, [staffList])

	const handleAddMenu = useCallback(() => {
		setEditingMenuId(null)
		setMenuFormData({ name: '', description: '', price: 0, duration_minutes: 60, capacity_per_slot: null })
		setIsMenuModalOpen(true)
	}, [])

	const handleEditMenu = useCallback((menu: Menu) => {
		setEditingMenuId(menu.id)
		setMenuFormData({
			name: menu.name,
			description: menu.description || '',
			price: menu.price || 0,
			duration_minutes: menu.duration_minutes || 60,
			capacity_per_slot: menu.capacity_per_slot ?? null,
		})
		setIsMenuModalOpen(true)
	}, [])

	const handleSubmitMenu = useCallback(async () => {
		if (!storeId || !menuFormData.name) return
		setSaving(true)
		try {
			const base = supabase.from('booking_menus')
			const payload = {
				name: menuFormData.name,
				description: menuFormData.description,
				price: menuFormData.price,
				duration_minutes: menuFormData.duration_minutes,
				capacity_per_slot: menuFormData.capacity_per_slot,
			}
			const result = editingMenuId
				? await base.update(payload).eq('id', editingMenuId).select().single()
				: await base.insert({ ...payload, store_id: storeId }).select().single()

			const { data, error } = result as { data: Menu | null; error: unknown }
			if (error) throw error
			if (!data) throw new Error('メニューの保存に失敗しました')

			setMenuList((prev) => (editingMenuId ? prev.map((m) => (m.id === editingMenuId ? data : m)) : [...prev, data]))
			setMessage({ type: 'success', text: editingMenuId ? 'メニュー情報を更新しました' : 'メニューを追加しました' })
			setIsMenuModalOpen(false)
		} catch (error) {
			console.error('Error saving menu:', error)
			setMessage({ type: 'error', text: 'メニューの保存に失敗しました' })
		} finally {
			setSaving(false)
		}
	}, [editingMenuId, menuFormData, storeId])

	const handleDeleteMenu = useCallback((id: string) => {
		const menu = menuList.find((m) => m.id === id)
		if (!menu) return
		setDeletingItem({ type: 'menu', id: menu.id, name: menu.name })
		setIsDeleteModalOpen(true)
	}, [menuList])

	const handleConfirmDelete = useCallback(async () => {
		if (!deletingItem) return
		setSaving(true)
		try {
			if (deletingItem.type === 'staff') {
				const { error } = await supabase.from('staff_members').delete().eq('id', deletingItem.id)
				if (error) throw error
				setStaffList((prev) => prev.filter((s) => s.id !== deletingItem.id))
				setMessage({ type: 'success', text: 'スタッフを削除しました' })
			} else {
				const { error } = await supabase.from('booking_menus').delete().eq('id', deletingItem.id)
				if (error) throw error
				setMenuList((prev) => prev.filter((m) => m.id !== deletingItem.id))
				setMessage({ type: 'success', text: 'メニューを削除しました' })
			}
			setIsDeleteModalOpen(false)
			setDeletingItem(null)
		} catch (error) {
			console.error('Error deleting item:', error)
			setMessage({ type: 'error', text: '削除に失敗しました' })
		} finally {
			setSaving(false)
		}
	}, [deletingItem])

	const handleUpdateBookingSettings = useCallback(async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		setSaving(true)
		setMessage(null)
		try {
			const { data: { user } } = await supabase.auth.getUser()
			if (!user) throw new Error('No user found')

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
				})
				.eq('owner_id', user.id)
			if (error) throw error
			setMessage({ type: 'success', text: '予約ページ設定を保存しました' })
		} catch (error) {
			setMessage({ type: 'error', text: `保存に失敗しました: ${toErrorMessage(error)}` })
		} finally {
			setSaving(false)
		}
	}, [bookingSettings])

	const handleUpdateRichMenuSettings = useCallback(async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault()

		if (!import.meta.env.VITE_LIFF_ID) {
			setMessage({ type: 'error', text: '環境変数 VITE_LIFF_ID が設定されていません。.envファイルにLIFF IDを追加してください。' })
			return
		}

		// リッチメニュー画像を生成してアップロードし、設定を保存しLINEに反映する
		setSaving(true)
		setMessage(null)
		try {
			const { data: { user } } = await supabase.auth.getUser()
			if (!user) throw new Error('No user found')

			const generateImage = async (): Promise<Blob> => {
				const canvas = document.createElement('canvas')
				const ctx = canvas.getContext('2d')
				if (!ctx) throw new Error('Canvas context not supported')

				const layout = RICH_MENU_LAYOUTS.find((l) => l.id === richMenuSettings.layout_id) || RICH_MENU_LAYOUTS[0]
				const width = 1200
				const height = layout.id.startsWith('compact') ? 405 : 810
				canvas.width = width
				canvas.height = height

				const colors = {
					simple: { bg: '#e5e7eb', slot: '#ffffff', text: '#1f2937' },
					elegant: { bg: '#D4C4B7', slot: '#F5F5F0', text: '#5D4037' },
					pop: { bg: '#00B8A9', slot: '#f0fdfa', text: '#0f766e' },
					dark: { bg: '#334155', slot: '#1e293b', text: '#ffffff' },
				} as const
				const theme = colors[(richMenuSettings.template_id as keyof typeof colors) || 'simple'] || colors.simple

				ctx.fillStyle = theme.bg
				ctx.fillRect(0, 0, width, height)

				if (richMenuSettings.custom_image_url) {
					const img = new Image()
					img.crossOrigin = 'anonymous'
					await new Promise((resolve, reject) => {
						img.onload = resolve
						img.onerror = reject
						img.src = richMenuSettings.custom_image_url
					})
					const scale = Math.max(width / img.width, height / img.height)
					const x = (width - img.width * scale) / 2
					const y = (height - img.height * scale) / 2
					ctx.drawImage(img, x, y, img.width * scale, img.height * scale)
					return blobFromCanvas(canvas)
				}

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
							const found = AVAILABLE_ICONS.find((i) => i.id === action.icon)
							if (found) IconComp = found.icon
							label = action.label || '未設定'
							isSet = true
						}
					}

					if (!isSet) ctx.globalAlpha = 0.5

					const svgString = renderToStaticMarkup(<IconComp size={64} color={theme.text} strokeWidth={2} />)
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

					ctx.fillStyle = theme.text
					ctx.font = 'bold 36px sans-serif'
					ctx.textAlign = 'center'
					ctx.textBaseline = 'top'
					ctx.fillText(label, x + w / 2, iconY + iconSize + 16)

					ctx.globalAlpha = 1.0
				}

				if (layout.id === 'large_3_upper') {
					const h = (height - gap) / 2
					const w = (width - gap) / 2
					await drawSlot(1, 0, 0, width, h)
					await drawSlot(2, 0, h + gap, w, h)
					await drawSlot(3, w + gap, h + gap, w, h)
				} else {
					const rows = layout.id.startsWith('compact') ? 1 : 2
					const cols = layout.id.includes('3') && !layout.id.includes('upper') || layout.id.includes('6') ? 3 : 2
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

				return blobFromCanvas(canvas)
			}

			let generatedImageUrl: string | null = null
			try {
				const blob = await generateImage()
				const fileName = `rich-menu-${storeId || 'store'}-${Date.now()}.png`
				const { error: uploadError } = await supabase.storage
					.from('rich_menus')
					.upload(fileName, blob, {
						upsert: true,
						contentType: 'image/png',
					})
				if (uploadError) throw uploadError

				const { data: { publicUrl } } = supabase.storage.from('rich_menus').getPublicUrl(fileName)
				generatedImageUrl = publicUrl
			} catch (imgError) {
				console.error('Image generation failed:', imgError)
				throw new Error(`リッチメニュー画像の生成に失敗しました: ${toErrorMessage(imgError)}`)
			}

			const { error } = await supabase
				.from('stores')
				.update({
					rich_menu_template_id: richMenuSettings.template_id,
					rich_menu_layout_id: richMenuSettings.layout_id,
					rich_menu_custom_image_url: richMenuSettings.custom_image_url,
					rich_menu_actions: richMenuSettings.actions,
				})
				.eq('owner_id', user.id)

			if (error) throw error

			const { error: apiError } = await supabase.functions.invoke('apply-rich-menu', {
				body: {
					store_id: storeId,
					generated_image_url: generatedImageUrl,
					liff_id: import.meta.env.VITE_LIFF_ID,
				},
			})
			if (apiError) throw apiError

			setMessage({ type: 'success', text: 'リッチメニュー設定を保存・反映しました' })
		} catch (error) {
			setMessage({ type: 'error', text: `保存に失敗しました: ${toErrorMessage(error)}` })
		} finally {
			setSaving(false)
		}
	}, [richMenuSettings, storeId])

	const handleUpdateLineSettings = useCallback(async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		setSaving(true)
		setMessage(null)

		try {
			const { data: { user } } = await supabase.auth.getUser()
			if (!user) throw new Error('No user found')

			let lineUserId: string | null = null
			let basicId: string | null = null

			if (lineSettings.channel_token) {
				const { data: botInfo, error: botError } = await supabase.functions.invoke<{ userId?: string; basicId?: string }>('get-line-bot-info', {
					body: { channel_token: lineSettings.channel_token },
				})

				if (botError) throw new Error(`LINEアクセストークンの検証に失敗しました: ${botError.message}`)
				if (botInfo?.userId) {
					lineUserId = botInfo.userId
					basicId = botInfo.basicId || null
				} else {
					throw new Error('LINE Bot情報の取得に失敗しました。アクセストークンを確認してください。')
				}
			}

			const { data: existing } = await supabase
				.from('line_accounts')
				.select('id')
				.eq('user_id', user.id)
				.maybeSingle()

			const payload = {
				channel_id: lineSettings.channel_id,
				channel_secret: lineSettings.channel_secret,
				channel_access_token: lineSettings.channel_token,
				line_user_id: lineUserId,
				bot_id: basicId,
				store_id: storeId,
				updated_at: new Date().toISOString(),
			}

			let upsertError: unknown = null
			if (existing) {
				const { error } = await supabase.from('line_accounts').update(payload).eq('user_id', user.id)
				upsertError = error
			} else {
				const { error } = await supabase.from('line_accounts').insert({ ...payload, user_id: user.id })
				upsertError = error
			}

			if (upsertError) throw upsertError

			if (basicId) {
				setLineSettings((prev) => ({ ...prev, bot_id: basicId || '' }))
			}

			setMessage({ type: 'success', text: 'LINE設定を保存しました' })
		} catch (error) {
			setMessage({ type: 'error', text: `保存に失敗しました: ${toErrorMessage(error)}` })
		} finally {
			setSaving(false)
		}
	}, [lineSettings, storeId])

	const handleUpdateProfile = useCallback(async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		setSaving(true)
		setMessage(null)

		try {
			const { data: { user } } = await supabase.auth.getUser()
			if (!user) throw new Error('No user found')

			const { error: profileError } = await supabase
				.from('profiles')
				.update({
					full_name: profileData.full_name,
					full_name_kana: profileData.full_name_kana,
					phone_number: profileData.user_phone_number,
				})
				.eq('id', user.id)

			if (profileError) throw profileError

			const { error: storeError } = await supabase
				.from('stores')
				.update({
					name: profileData.store_name,
					postal_code: profileData.postal_code,
					address: profileData.address,
					phone_number: profileData.store_phone_number,
					industry: profileData.industry,
					business_hours: bookingSettings.business_hours,
				})
				.eq('owner_id', user.id)

			if (storeError) throw storeError

			window.dispatchEvent(new Event('profile-updated'))
			setMessage({ type: 'success', text: '基本情報を更新しました' })
		} catch (error) {
			setMessage({ type: 'error', text: `更新に失敗しました: ${toErrorMessage(error)}` })
		} finally {
			setSaving(false)
		}
	}, [profileData, bookingSettings.business_hours])

	const handleUpdatePassword = useCallback(async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		if (passwordData.newPassword !== passwordData.confirmPassword) {
			setMessage({ type: 'error', text: 'パスワードが一致しません' })
			return
		}
		if (passwordData.newPassword.length < 6) {
			setMessage({ type: 'error', text: 'パスワードは6文字以上で設定してください' })
			return
		}

		setSaving(true)
		setMessage(null)

		try {
			const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword })
			if (error) throw error

			setMessage({ type: 'success', text: 'パスワードを更新しました' })
			setPasswordData(DEFAULT_PASSWORD_DATA)
		} catch (error) {
			setMessage({ type: 'error', text: `パスワード更新に失敗しました: ${toErrorMessage(error)}` })
		} finally {
			setSaving(false)
		}
	}, [passwordData])

	const handleCopyWebhook = useCallback(() => {
		navigator.clipboard.writeText(WEBHOOK_URL)
		setMessage({ type: 'success', text: 'Webhook URLをコピーしました' })
	}, [])

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center min-h-100">
				<motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="mb-4">
					<Loader2 className="w-10 h-10 text-primary-600" />
				</motion.div>
				<p className="text-slate-600 font-medium">読み込み中...</p>
			</div>
		)
	}

	return (
		<div className="p-8 max-w-7xl mx-auto">
			<h1 className="text-2xl font-bold mb-8 text-gray-800">設定</h1>

			<TabsNav active={activeTab} onChange={setActiveTab} />

			<div className="space-y-8">
				{activeTab === 'booking_page' && (
					<BookingPageTab
						storeId={storeId}
						bookingSettings={bookingSettings}
						staffList={staffList}
						menuList={menuList}
						saving={saving}
						previewRefreshKey={previewRefreshKey}
						iframeRef={iframeRef}
						onBookingSettingsChange={setBookingSettings}
						onSubmitBookingSettings={handleUpdateBookingSettings}
						onAddStaff={handleAddStaff}
						onEditStaff={handleEditStaff}
						onDeleteStaff={handleDeleteStaff}
						onAddMenu={handleAddMenu}
						onEditMenu={handleEditMenu}
						onDeleteMenu={handleDeleteMenu}
						onRefreshPreview={() => setPreviewRefreshKey((prev) => prev + 1)}
					/>
				)}

				{activeTab === 'rich_menu' && (
					<RichMenuTab
						richMenuSettings={richMenuSettings}
						saving={saving}
						onChangeSettings={setRichMenuSettings}
						onSubmit={handleUpdateRichMenuSettings}
					/>
				)}

				{activeTab === 'calendar' && (
					<CalendarTab
						googleCalendarSettings={googleCalendarSettings}
						saving={saving}
						onConnect={handleGoogleConnect}
						onDisconnect={() => setIsDisconnectModalOpen(true)}
					/>
				)}

				{activeTab === 'connection' && (
					<ConnectionTab
						lineSettings={lineSettings}
						saving={saving}
						webhookUrl={WEBHOOK_URL}
						onSubmit={handleUpdateLineSettings}
						onChange={setLineSettings}
					/>
				)}

				{activeTab === 'guide' && (
					<GuideTab
						webhookUrl={WEBHOOK_URL}
						onCopyWebhook={handleCopyWebhook}
						onNavigateConnection={() => setActiveTab('connection')}
					/>
				)}

				{activeTab === 'basic' && (
					<BasicInfoTab
						profileData={profileData}
						businessHours={bookingSettings.business_hours}
						saving={saving}
						onChange={setProfileData}
						onChangeBusinessHours={(next) => setBookingSettings((prev) => ({ ...prev, business_hours: next }))}
						onSubmit={handleUpdateProfile}
						onPostalSearch={handlePostalCodeSearch}
					/>
				)}

				{activeTab === 'password' && (
					<PasswordTab
						newPassword={passwordData.newPassword}
						confirmPassword={passwordData.confirmPassword}
						saving={saving}
						onChangeNew={(v) => setPasswordData((prev) => ({ ...prev, newPassword: v }))}
						onChangeConfirm={(v) => setPasswordData((prev) => ({ ...prev, confirmPassword: v }))}
						onSubmit={handleUpdatePassword}
					/>
				)}
			</div>

			<StaffModal
				isOpen={isStaffModalOpen}
				isLoading={saving}
				formData={staffFormData}
				isEditing={!!editingStaffId}
				onClose={() => setIsStaffModalOpen(false)}
				onConfirm={handleSubmitStaff}
				onChange={setStaffFormData}
			/>

			<MenuModal
				isOpen={isMenuModalOpen}
				isLoading={saving}
				formData={menuFormData}
				bookingSystemType={bookingSettings.booking_system_type}
				isEditing={!!editingMenuId}
				onClose={() => setIsMenuModalOpen(false)}
				onConfirm={handleSubmitMenu}
				onChange={setMenuFormData}
			/>

			<Modal
				isOpen={isDisconnectModalOpen}
				onClose={() => setIsDisconnectModalOpen(false)}
				onConfirm={handleGoogleDisconnect}
				title="連携解除の確認"
				message="Googleカレンダーとの連携を解除してもよろしいですか？"
				confirmText="解除する"
				variant="danger"
				isLoading={saving}
			/>

			<DeleteConfirmModal
				isOpen={isDeleteModalOpen}
				isLoading={saving}
				target={deletingItem}
				onClose={() => setIsDeleteModalOpen(false)}
				onConfirm={handleConfirmDelete}
			/>

			{message && (
				<Toast
					isVisible={true}
					message={message.text}
					type={message.type}
					onClose={() => setMessage(null)}
				/>
			)}
		</div>
	)
}
