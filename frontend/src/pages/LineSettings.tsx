import { useCallback, useEffect, useState } from 'react'
import { Loader2, Link2, Building2, CreditCard, Lock, BookOpen } from 'lucide-react'
import Toast from '../components/Toast'
import { UnderlineTabs } from '../components/UnderlineTabs'
import { supabase } from '../lib/supabase'
import { toErrorMessage } from '../lib/errorUtils'
import { ConnectionTab } from '../features/line-settings/components/ConnectionTab'
import { GuideTab } from '../features/line-settings/components/GuideTab'
import { BasicInfoTab } from '../features/line-settings/components/BasicInfoTab'
import { PasswordTab } from '../features/line-settings/components/PasswordTab'
import { PlanTab } from '../features/line-settings/components/PlanTab'
import type {
	LineSettingsState,
	ProfileData,
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
	line_user_id: '',
}

const DEFAULT_PASSWORD_DATA = {
	newPassword: '',
	confirmPassword: '',
}

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/line-webhook`


export default function LineSettings() {
// const location = useLocation()

	const [activeTab, setActiveTab] = useState<'connection' | 'guide' | 'basic_info' | 'password' | 'plan'>('connection')
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

	const [storeId, setStoreId] = useState<string | null>(null)
	const [lineSettings, setLineSettings] = useState<LineSettingsState>(DEFAULT_LINE_SETTINGS)
	const [profileData, setProfileData] = useState<ProfileData>(DEFAULT_PROFILE_DATA)
	const [passwordData, setPasswordData] = useState(DEFAULT_PASSWORD_DATA)

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
					line_user_id: lineAccount.line_user_id || '',
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
		// 既存のレコードを確認
		const { data: existingLineAccount } = await supabase
			.from('line_accounts')
			.select('id')
			.eq('store_id', currentStoreId)
			.maybeSingle()

		let lineError
		if (existingLineAccount) {
			// 既存のレコードを更新
			const { error } = await supabase
				.from('line_accounts')
				.update({
					channel_id: lineSettings.channel_id,
					channel_secret: lineSettings.channel_secret,
					channel_access_token: lineSettings.channel_token,
					bot_id: lineSettings.bot_id,
					updated_at: new Date().toISOString(),
				})
				.eq('store_id', currentStoreId)
			lineError = error
		} else {
			// 新規レコードを挿入
			const { error } = await supabase
				.from('line_accounts')
				.insert({
					user_id: user.id,
					store_id: currentStoreId,
					channel_id: lineSettings.channel_id,
					channel_secret: lineSettings.channel_secret,
					channel_access_token: lineSettings.channel_token,
					bot_id: lineSettings.bot_id,
					updated_at: new Date().toISOString(),
				})
			lineError = error
		}

		if (lineError) throw lineError

			// 3. Bot情報の取得とline_user_idの保存 (Edge Function)
			// LINE設定を保存した後、少し待ってからBot情報を取得
			await new Promise(resolve => setTimeout(resolve, 500))
			
			const { data: botInfoData, error: funcError } = await supabase.functions.invoke('get-line-bot-info', {
				body: { storeId: currentStoreId }
			})
			
			if (funcError) {
				console.warn('Bot info fetch warning:', funcError)
				// Bot情報取得エラーは致命的ではないので警告のみ
				// ただし、LINE設定が正しく保存されていない可能性がある
				if (funcError.message?.includes('LINE account not found')) {
					console.warn('LINE account may not be saved yet. Please try saving again.')
				}
			} else if (botInfoData) {
				console.log('Bot info received:', botInfoData)
				// Edge Functionが既にデータベースを更新しているので、状態のみ更新
				const updates: Partial<typeof lineSettings> = {}
				if (botInfoData.userId) {
					updates.line_user_id = botInfoData.userId
				}
				if (botInfoData.basicId) {
					updates.bot_id = botInfoData.basicId
				}
				if (Object.keys(updates).length > 0) {
					setLineSettings(prev => ({ ...prev, ...updates }))
				}
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
	}, [storeId, profileData])

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
				setMessage({ type: 'error', text: '住所が見つかりませんでした。' })
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
		<div className="flex flex-col h-full">
			<Toast
				isVisible={!!message}
				message={message?.text || ''}
				type={message?.type || 'success'}
				onClose={() => setMessage(null)}
			/>

			<div className="shrink-0 z-20 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-gray-200 w-full">
				<div className="px-4 sm:px-8 py-4">
					<div className="flex items-center justify-between gap-4">
						<div className="min-w-0 flex-1">
							<h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">LINE連携・設定</h1>
							<p className="text-sm text-gray-500">LINE公式アカウントとの連携設定や、アカウント情報の管理を行います。</p>
						</div>
					</div>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto p-4 sm:p-8">
				<div className="w-full">
					<UnderlineTabs
						activeId={activeTab}
						onChange={setActiveTab}
						className="no-scrollbar"
						items={[
							{ id: 'connection', label: 'LINE連携', icon: Link2 },
							{ id: 'basic_info', label: '基本情報', icon: Building2 },
							{ id: 'plan', label: 'プラン', icon: CreditCard },
							{ id: 'password', label: 'パスワード', icon: Lock },
							{ id: 'guide', label: '設定ガイド', icon: BookOpen },
						]}
					/>

			<div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
				{activeTab === 'connection' && (
					<ConnectionTab
						lineSettings={lineSettings}
						onChange={setLineSettings}
						onSubmit={(e) => { e.preventDefault(); handleSaveLineSettings(); }}
						saving={saving}
						webhookUrl={WEBHOOK_URL}
					/>
				)}

				{activeTab === 'basic_info' && (
					<BasicInfoTab
						profileData={profileData}
						onChange={setProfileData}
						onSubmit={(e) => { e.preventDefault(); handleSaveProfile(); }}
						saving={saving}
						onPostalSearch={handlePostalCodeSearch}
					/>
				)}

				{activeTab === 'plan' && (
					<PlanTab />
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
				</div>
			</div>
		</div>
	)
}
