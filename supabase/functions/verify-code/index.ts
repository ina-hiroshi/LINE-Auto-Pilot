import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface RequestBody {
  email: string
  code: string
  password: string
}

serve(async (req) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body: RequestBody = await req.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const { code, password } = body

    if (!email || typeof code !== 'string' || !/^[0-9]{6}$/.test(code) || typeof password !== 'string' || !password) {
      return new Response(
        JSON.stringify({ error: 'メールアドレスと認証コードとパスワードが必要です' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // フロント側の minLength={6} と合わせる。ここを抜けると
    // admin.createUser が弱いパスワードのアカウントを作ってしまう。
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'パスワードは6文字以上で入力してください' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const requestIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip') || 'unknown'
    const { data: outcome, error: verificationError } = await supabase.rpc('consume_verification_code', {
      p_email: email, p_code: code, p_ip: requestIp,
    })
    if (verificationError) throw new Error('認証コードの検証に失敗しました')
    if (outcome !== 'success') {
      return new Response(JSON.stringify({
        error: outcome === 'locked' ? '試行回数が上限に達しました。しばらくしてから再度お試しください。' : '認証コードが無効か、有効期限が切れています',
        valid: false,
      }), { status: outcome === 'locked' ? 429 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // アカウント作成はここでのみ行う。従来はコード検証後にフロントが
    // supabase.auth.signUp() を直接呼んでいたが、signUp は公開の
    // /auth/v1/signup エンドポイントであり anon key だけで誰でも
    // 直接叩けてしまう（このコード検証を一切経由せず、他人のメール
    // アドレスで即座にログイン済みアカウントを作れてしまう）。
    // admin.createUser はサービスロールでのみ呼べるため、このコード
    // 検証を通った場合にのみアカウントが作られることを保証できる。
    //
    // 【重要】この保証はSupabase Dashboard側の
    // Authentication > Sign In / Providers > 「Allow new users to sign up」
    // が OFF であることとセットで初めて成立する。ONに戻すと
    // /auth/v1/signup が復活し、このコード検証を経由しないアカウント作成
    // バイパスが再び開いてしまう。デバッグ等で一時的にONへ戻す場合は
    // 作業後に必ずOFFへ戻すこと。
    const { error: createUserError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createUserError) {
      // 登録済みのメールにもコードを送り、所有を確認してからここへ進む。
      // その場合はエラーにせず「既存アカウントとして扱う」ことでフロントの
      // signInWithPassword にそのまま繋げる。
      if (!createUserError.message?.includes('already been registered')) {
        console.error('createUser error:', createUserError)
        throw new Error('アカウントの作成に失敗しました')
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        valid: true,
        message: '認証に成功しました'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : '認証コードの検証に失敗しました',
        valid: false
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
