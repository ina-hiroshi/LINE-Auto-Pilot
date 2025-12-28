import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import Toast from '../components/Toast'
import Modal from '../components/Modal'
import { supabase } from '../lib/supabase'
import { ConnectionTab } from '../features/line-settings/components/ConnectionTab'
import { GuideTab } from '../features/line-settings/components/GuideTab'
import { BasicInfoTab } from '../features/line-settings/components/BasicInfoTab'
import { PasswordTab } from '../features/line-settings/components/PasswordTab'
import { CalendarTab } from '../features/line-settings/components/CalendarTab'
import type {
	GoogleCalendarSettings,
	LineSettingsState,
	ProfileData,
	BusinessHours,
} from '../features/line-settings/types'

// ---- 初期値定義 ----
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

export default function LineSettings() {
// const location = useLocation()

	const [activeTab, setActiveTab] = useState<'connection' | 'guide' | 'basic_info' | 'password' | 'calendar'>('connection')
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

	const [storeId, setStoreId] = useState<string | null>(null)
	const [googleCalendarSettings, setGoogleCalendarSettings] = useState<GoogleCalendarSettings>(DEFAULT_GOOGLE_SETTINGS)
	const [lineSettings, setLineSettings] = useState<LineSettingsState>(DEFAULT_LINE_SETTINGS)
	const [profileData, setProfileData] = useState<ProfileData>(DEFAULT_PROFILE_DATA)
	const [businessHours, setBusinessHours] = useState<BusinessHours | null>(null)
	const [passwordData, setPasswordData] = useState(DEFAULT_PASSWORD_DATA)
	const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false)

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
				setBusinessHours(store.business_hours)
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

	const handleGoogleDisconnect = useCallback(async () => {
		setSaving(true)
		try {
			const { data: { session } } = await supabase.auth.getSession()
			if (!session) return

			const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-auth`, {
				method: 'DELETE',
				headers: {
					Authorization: `Bearer ${session.access_token}`,
				},
			})

			if (!response.ok) throw new Error('Disconnect failed')

			setGoogleCalendarSettings(DEFAULT_GOOGLE_SETTINGS)
			setMessage({ type: 'success', text: 'Googleカレンダー連携を解除しました' })
			setIsDisconnectModalOpen(false)
		} catch (error) {
			console.error('Google Disconnect Error:', error)
			setMessage({ type: 'error', text: `連携解除に失敗しました: ${toErrorMessage(error)}` })
		} finally {
			setSaving(false)
		}
	}, [])

	const handleSaveLineSettings = useCallback(async () => {
		setSaving(true)
		setMessage(null)
		try {
			const { data: { user } } = await supabase.auth.getUser()
			if (!user) throw new Error('認証エラー')

			// 1. Storeの確認・作成
			let currentStoreId = storeId
			if (!currentStoreId) {
				const { data: newStore, error: storeError } = await supabase
					.from('stores')
					.insert({ owner_id: user.id, name: 'My Store' })
					.select()
					.single()
				if (storeError) throw storeError
				currentStoreId = newStore.id
				setStoreId(newStore.id)
			}

			// 2. LINEアカウントの更新
			const { error: lineError } = await supabase
				.from('line_accounts')
				.upsert({
					user_id: user.id,
					store_id: currentStoreId,
					channel_id: lineSettings.channel_id,
					channel_secret: lineSettings.channel_secret,
					channel_access_token: lineSettings.channel_token,
					bot_id: lineSettings.bot_id,
					updated_at: new Date().toISOString(),
				}, { onConflict: 'user_id' })

			if (lineError) throw lineError

			// 3. Webhook URLの更新 (Edge Function)
			const { error: funcError } = await supabase.functions.invoke('get-line-bot-info', {
				body: { storeId: currentStoreId }
			})
			
			if (funcError) {
				console.warn('Webhook update warning:', funcError)
				// Webhook設定エラーは致命的ではないので警告のみ
			}

			setMessage({ type: 'success', text: 'LINE設定を保存しました' })
		} catch (error) {
			console.error('Save Error:', error)
			setMessage({ type: 'error', text: `保存に失敗しました: ${toErrorMessage(error)}` })
		} finally {
			setSaving(false)
		}
	}, [storeId, lineSettings])

	const handleSaveProfile = useCallback(async () => {
		setSaving(true)
		setMessage(null)
		try {
			const { data: { user } } = await supabase.auth.getUser()
			if (!user) throw new Error('認証エラー')

			// Profile Update
			const { error: profileError } = await supabase
				.from('profiles')
				.update({
					full_name: profileData.full_name,
					full_name_kana: profileData.full_name_kana,
					phone_number: profileData.user_phone_number,
					updated_at: new Date().toISOString(),
				})
				.eq('id', user.id)

			if (profileError) throw profileError

			// Store Update
			if (storeId) {
				const { error: storeError } = await supabase
					.from('stores')
					.update({
						name: profileData.store_name,
						postal_code: profileData.postal_code,
						address: profileData.address,
						phone_number: profileData.store_phone_number,
						industry: profileData.industry,
						business_hours: businessHours,
						updated_at: new Date().toISOString(),
					})
					.eq('id', storeId)

				if (storeError) throw storeError
			}

			// Notify other components
			window.dispatchEvent(new Event('profile-updated'))
			setMessage({ type: 'success', text: '基本情報を保存しました' })
		} catch (error) {
			console.error('Save Error:', error)
			setMessage({ type: 'error', text: `保存に失敗しました: ${toErrorMessage(error)}` })
		} finally {
			setSaving(false)
		}
	}, [storeId, profileData, businessHours])

	const handleUpdatePassword = useCallback(async () => {
		if (passwordData.newPassword !== passwordData.confirmPassword) {
			setMessage({ type: 'error', text: 'パスワードが一致しません' })
			return
		}
		setSaving(true)
		setMessage(null)
		try {
			const { error } = await supabase.auth.updateUser({
				password: passwordData.newPassword
			})
			if (error) throw error
			setMessage({ type: 'success', text: 'パスワードを変更しました' })
			setPasswordData(DEFAULT_PASSWORD_DATA)
		} catch (error) {
			console.error('Password Update Error:', error)
			setMessage({ type: 'error', text: `パスワード変更に失敗しました: ${toErrorMessage(error)}` })
		} finally {
			setSaving(false)
		}
	}, [passwordData])

	const handleCopyWebhook = useCallback(() => {
		navigator.clipboard.writeText(WEBHOOK_URL)
		setMessage({ type: 'success', text: 'Webhook URLをコピーしました' })
	}, [])

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

	useEffect(() => {
		fetchData()
	}, [fetchData])

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
				isVisible={!!message}
				message={message?.text || ''}
				type={message?.type || 'success'}
				onClose={() => setMessage(null)}
			/>

			<div className="mb-8">
				<h1 className="text-2xl font-bold text-gray-900 mb-2">LINE連携・設定</h1>
				<p className="text-gray-500">LINE公式アカウントとの連携設定や、アカウント情報の管理を行います。</p>
			</div>

			{/* Tabs Navigation */}
			<div className="flex overflow-x-auto border-b border-gray-200 mb-6 no-scrollbar">
				<button
					onClick={() => setActiveTab('connection')}
					className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
						activeTab === 'connection'
							? 'border-primary-500 text-primary-600'
							: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
					}`}
				>
					LINE連携
				</button>
				<button
					onClick={() => setActiveTab('calendar')}
					className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
						activeTab === 'calendar'
							? 'border-primary-500 text-primary-600'
							: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
					}`}
				>
					Googleカレンダー
				</button>
				<button
					onClick={() => setActiveTab('basic_info')}
					className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
						activeTab === 'basic_info'
							? 'border-primary-500 text-primary-600'
							: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
					}`}
				>
					基本情報
				</button>
				<button
					onClick={() => setActiveTab('password')}
					className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
						activeTab === 'password'
							? 'border-primary-500 text-primary-600'
							: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
					}`}
				>
					パスワード
				</button>
				<button
					onClick={() => setActiveTab('guide')}
					className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
						activeTab === 'guide'
							? 'border-primary-500 text-primary-600'
							: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
					}`}
				>
					設定ガイド
				</button>
			</div>

			<div className="bg-white rounded-lg shadow p-6">
				{activeTab === 'connection' && (
					<ConnectionTab
						lineSettings={lineSettings}
						onChange={setLineSettings}
						onSubmit={(e) => { e.preventDefault(); handleSaveLineSettings(); }}
						saving={saving}
						webhookUrl={WEBHOOK_URL}
					/>
				)}

				{activeTab === 'calendar' && (
					<CalendarTab
						googleCalendarSettings={googleCalendarSettings}
						onConnect={handleGoogleConnect}
						onDisconnect={() => setIsDisconnectModalOpen(true)}
						saving={saving}
					/>
				)}

				{activeTab === 'basic_info' && (
					<BasicInfoTab
						profileData={profileData}
						businessHours={businessHours}
						onChange={setProfileData}
						onChangeBusinessHours={setBusinessHours}
						onSubmit={(e) => { e.preventDefault(); handleSaveProfile(); }}
						saving={saving}
						onPostalSearch={handlePostalCodeSearch}
					/>
				)}

				{activeTab === 'password' && (
					<PasswordTab
						newPassword={passwordData.newPassword}
						confirmPassword={passwordData.confirmPassword}
						onChangeNew={(v) => setPasswordData(prev => ({ ...prev, newPassword: v }))}
						onChangeConfirm={(v) => setPasswordData(prev => ({ ...prev, confirmPassword: v }))}
						onSubmit={(e) => { e.preventDefault(); handleUpdatePassword(); }}
						saving={saving}
					/>
				)}

				{activeTab === 'guide' && (
					<GuideTab
						webhookUrl={WEBHOOK_URL}
						onCopyWebhook={handleCopyWebhook}
						onNavigateConnection={() => setActiveTab('connection')}
					/>
				)}
			</div>

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
		</div>
	)
}
