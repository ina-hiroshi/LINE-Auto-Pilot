import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Toast from '../Toast'
import { btnPrimary, textLink } from './ui'

const inputClass =
  'w-full rounded-lg border-2 border-rule bg-white px-4 py-3 text-[16px] text-ink outline-none transition-colors placeholder:text-ink-soft/60 focus:border-primary-600'

/**
 * トップページのログイン・新規登録フォーム。
 * 処理の流れ（認証コードの送信 → コード検証とアカウント作成をサーバー側で実行 → ログイン）は
 * 旧TopPageから変えていない。見た目だけ公開ページの伝票の世界に合わせている。
 */
export default function AuthPanel() {
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  // /monitor 等からの遷移時は新規登録タブを既定表示にする（authMode: 'signup'）。
  // それ以外は従来通りログインタブから始める。
  const [isLoginMode, setIsLoginMode] = useState(
    () => (location.state as { authMode?: string } | null)?.authMode !== 'signup'
  )
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // 認証コード関連
  const [showVerificationStep, setShowVerificationStep] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  // 利用規約・プライバシーポリシーへの同意
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false)

  // ページを開いたままヘッダーの「ログイン」「無料で始める」を押したときもタブを切り替える
  useEffect(() => {
    const mode = (location.state as { authMode?: string } | null)?.authMode
    if (mode === 'signup') setIsLoginMode(false)
    if (mode === 'login') setIsLoginMode(true)
  }, [location])

  // トーストを自動的に消す
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // 再送信のクールダウンタイマー
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (isLoginMode) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
      } else {
        if (password !== confirmPassword) {
          setToast({ message: 'パスワードが一致しません。', type: 'error' })
          setLoading(false)
          return
        }

        // まず認証コードを送信（アカウント作成はコード検証後に行う）
        try {
          await sendVerificationCode()
          setShowVerificationStep(true)
        } catch {
          // エラーはsendVerificationCode内で処理済み
        }
        setLoading(false)
        return
      }
    } catch (error: unknown) {
      console.error('Auth error:', error)
      let message = 'エラーが発生しました。'
      const err = error as { message?: string }
      if (err.message === 'Invalid login credentials') {
        message = 'メールアドレスまたはパスワードが正しくありません。'
      } else if (err.message) {
        message = err.message
      }
      setToast({ message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const sendVerificationCode = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('send-verification-code', {
        body: { email }
      })

      if (error) throw error

      // 既存ユーザーの場合
      if (data?.existingUser) {
        setToast({ message: data.error || 'このメールアドレスはすでに登録されています。', type: 'error' })
        setIsLoginMode(true)
        throw new Error('existing_user')
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      setToast({ message: `${email} に認証コードを送信しました`, type: 'success' })
      setResendCooldown(60) // 60秒のクールダウン
    } catch (error) {
      console.error('Send code error:', error)
      if (error instanceof Error && error.message !== 'existing_user') {
        setToast({ message: error.message || '認証コードの送信に失敗しました', type: 'error' })
      }
      throw error
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 認証コードを検証（アカウント作成もこの呼び出しの中でのみ行われる。
      // 以前はここでフロントから直接 supabase.auth.signUp() を呼んでいたが、
      // signUp は anon key だけで誰でも直接叩ける公開APIであり、この
      // コード検証を一切経由せずアカウントを作成できてしまっていた。
      // 今はサーバー側の admin.createUser がコード検証成功時にのみ
      // 実行されるため、ここでは検証結果を受けてログインするだけでよい）
      const { data, error } = await supabase.functions.invoke('verify-code', {
        body: { email, code: verificationCode, password }
      })

      if (error || !data?.valid) {
        throw new Error(data?.error || '認証コードが正しくありません')
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) throw signInError

      setToast({ message: 'アカウントを作成しました', type: 'success' })

      // App.tsxのonAuthStateChangeで自動的にオンボーディングへ遷移
    } catch (error: unknown) {
      console.error('Verification error:', error)
      const message = error instanceof Error ? error.message : '認証に失敗しました'
      setToast({ message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (resendCooldown > 0) return
    setLoading(true)
    try {
      await sendVerificationCode()
    } catch {
      // エラーはsendVerificationCode内で処理済み
    } finally {
      setLoading(false)
    }
  }

  const tabClass = (active: boolean) =>
    `flex-1 border-b-[3px] pb-3 text-[15px] font-bold transition-colors ${
      active ? 'border-ink text-ink' : 'border-transparent text-ink-soft hover:text-ink'
    }`

  return (
    <>
    <div className="slip-shadow">
      <div className="slip px-6 sm:px-9">
        {!showVerificationStep && (
          <div className="flex gap-6 border-b border-rule" role="tablist" aria-label="ログインまたは新規登録">
            <button type="button" role="tab" aria-selected={!isLoginMode} className={tabClass(!isLoginMode)} onClick={() => setIsLoginMode(false)}>
              新規登録
            </button>
            <button type="button" role="tab" aria-selected={isLoginMode} className={tabClass(isLoginMode)} onClick={() => setIsLoginMode(true)}>
              ログイン
            </button>
          </div>
        )}

        <div className="mb-6 mt-6">
          <h3 className="text-[22px] font-black tracking-tight">
            {showVerificationStep ? '認証コードを入力' : isLoginMode ? 'おかえりなさい' : 'IToguchiを始める'}
          </h3>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
            {showVerificationStep ? (
              <>
                <span className="font-bold text-ink">{email}</span> に送った6桁のコードを入力してください。
              </>
            ) : isLoginMode ? (
              'ログインして管理画面に進みます。'
            ) : (
              'メールアドレスとパスワードを決めてください。確認のコードをメールでお送りします。'
            )}
          </p>
        </div>

        {showVerificationStep ? (
          <form onSubmit={handleVerifyCode} className="space-y-5">
            <div>
              <label htmlFor="auth-code" className="mb-2 block text-[14px] font-bold">認証コード</label>
              <input
                id="auth-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={verificationCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setVerificationCode(value)
                }}
                className={`${inputClass} text-center font-slip text-2xl tracking-[0.4em]`}
                placeholder="000000"
                required
                maxLength={6}
                pattern="\d{6}"
                autoFocus
              />
              <p className="mt-2 text-[13px] text-ink-soft">
                コードが届いていませんか？
                {resendCooldown > 0 ? (
                  <span className="ml-1">（{resendCooldown}秒後に再送信できます）</span>
                ) : (
                  <button type="button" onClick={handleResendCode} disabled={loading} className={`ml-1 ${textLink} disabled:opacity-50`}>
                    再送信
                  </button>
                )}
              </p>
            </div>

            <button type="submit" disabled={loading || verificationCode.length !== 6} className={`${btnPrimary} w-full`}>
              {loading ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  確認しています
                </>
              ) : (
                '確認して次へ'
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowVerificationStep(false)
                setVerificationCode('')
              }}
              className="w-full text-[14px] font-bold text-ink-soft hover:text-ink"
            >
              入力画面に戻る
            </button>
          </form>
        ) : (
          <form onSubmit={handleAuth} className="space-y-5">
            <div>
              <label htmlFor="auth-email" className="mb-2 block text-[14px] font-bold">メールアドレス</label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="shop@example.com"
                required
              />
            </div>
            <div>
              <label htmlFor="auth-password" className="mb-2 block text-[14px] font-bold">パスワード</label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isLoginMode ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-12`}
                  placeholder="6文字以上"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center text-ink-soft hover:text-ink"
                  aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示する'}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {!isLoginMode && (
              <div>
                <label htmlFor="auth-password2" className="mb-2 block text-[14px] font-bold">パスワード（確認）</label>
                <input
                  id="auth-password2"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  placeholder="もう一度入力"
                  required
                  minLength={6}
                />
              </div>
            )}

            {!isLoginMode && (
              <div className="space-y-3 rounded-lg bg-counter/60 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-1 size-4 shrink-0 cursor-pointer accent-[var(--color-primary-700)]"
                    required
                  />
                  <span className="text-[14px] leading-relaxed">
                    <Link to="/terms" target="_blank" className={`inline-link ${textLink}`} onClick={(e) => e.stopPropagation()}>
                      利用規約
                    </Link>
                    に同意します
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={agreedToPrivacy}
                    onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                    className="mt-1 size-4 shrink-0 cursor-pointer accent-[var(--color-primary-700)]"
                    required
                  />
                  <span className="text-[14px] leading-relaxed">
                    <Link to="/privacy" target="_blank" className={`inline-link ${textLink}`} onClick={(e) => e.stopPropagation()}>
                      プライバシーポリシー
                    </Link>
                    に同意します
                  </span>
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (!isLoginMode && (!agreedToTerms || !agreedToPrivacy))}
              className={`${btnPrimary} w-full`}
            >
              {loading ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  処理しています
                </>
              ) : isLoginMode ? (
                'ログイン'
              ) : (
                'アカウントを作成'
              )}
            </button>
          </form>
        )}
      </div>
    </div>

    {/* 伝票の影（filter）の内側に置くと fixed が効かないため外に出す */}
    {toast && (
      <Toast isVisible={true} message={toast.message} type={toast.type} onClose={() => setToast(null)} />
    )}
    </>
  )
}
