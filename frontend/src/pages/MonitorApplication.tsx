import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Gift, Sparkles, PartyPopper } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Toast from '../components/Toast'
import Logo from '../components/Logo'

type Course = 'omakase' | 'jikkuri'

const INDUSTRY_OPTIONS = [
  '美容室・ヘアサロン',
  'ネイルサロン・まつエクサロン',
  'エステ・リラクゼーション',
  '整体・整骨院',
  '個人経営の飲食店',
  'パーソナルジム・ヨガスタジオ',
  'その他',
]

export default function MonitorApplication() {
  const location = useLocation()
  const navigate = useNavigate()

  const [storeName, setStoreName] = useState('')
  const [industry, setIndustry] = useState('')
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [hasLineAccount, setHasLineAccount] = useState(false)
  const [course, setCourse] = useState<Course>('omakase')
  const [message, setMessage] = useState('')
  const [agreedToInterview, setAgreedToInterview] = useState(false)

  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!agreedToInterview) {
      setToast({ message: 'インタビューフォームへのご協力への同意が必要です。', type: 'error' })
      return
    }

    setLoading(true)
    try {
      // 未ログインの申込者には SELECT 権限がなく insert().select() が RLS で弾かれるため、
      // 通知に使う id はクライアント側で採番して渡す。
      const applicationId = crypto.randomUUID()

      const { error } = await supabase.from('monitor_applications').insert({
        id: applicationId,
        store_name: storeName,
        industry: industry || null,
        contact_name: contactName,
        email,
        phone: phone || null,
        has_line_account: hasLineAccount,
        course,
        message: message || null,
        agreed_to_interview: agreedToInterview,
      })

      if (error) throw error

      // 申込自体は成立しているので、通知メールの失敗で送信をエラー扱いにしない。
      const { error: notifyError } = await supabase.functions.invoke('notify-monitor-application', {
        body: { application_id: applicationId },
      })
      if (notifyError) {
        console.error('Monitor application notification failed:', notifyError)
      }

      setSubmitted(true)
    } catch (error: unknown) {
      console.error('Monitor application error:', error)
      const err = error as { message?: string }
      setToast({ message: err.message || '送信に失敗しました。時間をおいて再度お試しください。', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-10 text-center"
        >
          <div className="w-20 h-20 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-6">
            <PartyPopper className="w-10 h-10 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-4">お申し込みありがとうございます！</h1>
          <p className="text-slate-600 leading-relaxed mb-8">
            モニター限定特典のお申し込みを受け付けました。<br />
            内容を確認のうえ、ご入力いただいたメールアドレス宛にご連絡いたします。今しばらくお待ちください。
          </p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-full font-bold hover:bg-primary-700 transition shadow-md"
          >
            トップページへ戻る
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md fixed w-full z-50 border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link to="/" className="flex items-center gap-3">
              <Logo className="h-10 md:h-14 w-auto" />
            </Link>
            <Link
              to="/"
              className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-primary-600 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              トップへ戻る
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-40 pb-16 bg-linear-to-br from-primary-600 to-primary-800 text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20">
          <div className="absolute -top-[50%] -left-[20%] w-[100%] h-[100%] rounded-full bg-white blur-3xl"></div>
        </div>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-bold mb-4 border border-white/30">
            <Sparkles className="w-4 h-4" />
            リリース記念モニター限定特典
          </span>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">
            約1.5万円相当を還元する<br className="hidden sm:block" />
            モニター特典に申し込む
          </h1>
          <p className="text-primary-100 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            設定のしやすさ等について、簡単なインタビューフォームにご協力いただける店舗様限定の特典です。
          </p>
        </div>
      </section>

      {/* Course Explanation */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-6 mb-4">
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
                  <Gift className="w-5 h-5 text-primary-600" />
                </div>
                <h3 className="font-bold text-slate-900">おまかせ導入コース</h3>
              </div>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                  初期設定代行（通常¥9,980）が<span className="font-bold text-slate-900">無料</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                  Proプラン<span className="font-bold text-slate-900">初月無料</span>
                </li>
              </ul>
              <p className="text-xs text-slate-400 mt-3">「設定を丸ごとお任せしたい」方向け</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
                  <Gift className="w-5 h-5 text-primary-600" />
                </div>
                <h3 className="font-bold text-slate-900">じっくりお得コース</h3>
              </div>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                  初期設定代行（¥9,980）はご自身でお支払い
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                  Proプラン<span className="font-bold text-slate-900">3ヶ月間無料</span>（通常1ヶ月+追加2ヶ月）
                </li>
              </ul>
              <p className="text-xs text-slate-400 mt-3">「自分で設定して、長くお得に使いたい」方向け</p>
            </div>
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="pb-24 bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <form onSubmit={handleSubmit} className="bg-slate-50 rounded-3xl border border-slate-100 p-6 sm:p-10 space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                店舗名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition"
                placeholder="例：〇〇サロン"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">業種</label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition bg-white"
              >
                <option value="">選択してください</option>
                {INDUSTRY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  ご担当者名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition"
                  placeholder="山田 太郎"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">電話番号</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition"
                  placeholder="090-1234-5678"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                メールアドレス <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasLineAccount}
                  onChange={(e) => setHasLineAccount(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700">LINE公式アカウントを既に持っている</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-3">
                希望コース <span className="text-red-500">*</span>
              </label>
              <div className="grid sm:grid-cols-2 gap-3">
                <label
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition ${
                    course === 'omakase' ? 'border-primary-500 bg-primary-50' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="course"
                    value="omakase"
                    checked={course === 'omakase'}
                    onChange={() => setCourse('omakase')}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-bold text-slate-900 text-sm">おまかせ導入コース</p>
                    <p className="text-xs text-slate-500 mt-1">代行費無料＋初月無料</p>
                  </div>
                </label>
                <label
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition ${
                    course === 'jikkuri' ? 'border-primary-500 bg-primary-50' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="course"
                    value="jikkuri"
                    checked={course === 'jikkuri'}
                    onChange={() => setCourse('jikkuri')}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-bold text-slate-900 text-sm">じっくりお得コース</p>
                    <p className="text-xs text-slate-500 mt-1">3ヶ月無料</p>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">ご要望・ご質問など</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition resize-none"
                placeholder="任意でご記入ください"
              />
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={agreedToInterview}
                  onChange={(e) => setAgreedToInterview(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-600">
                  設定のしやすさ等についての簡単なインタビューフォームへの回答にご協力いただけることに同意します（特典適用の条件です）
                  <span className="text-red-500"> *</span>
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition shadow-lg shadow-primary-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? '送信中...' : 'モニター特典に申し込む'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </section>

      {toast && (
        <Toast
          isVisible={true}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
