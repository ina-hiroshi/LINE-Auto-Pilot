import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface RequestBody {
  email: string
  checkExisting?: boolean
}

serve(async (req) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { email, checkExisting = true }: RequestBody = await req.json()

    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: '有効なメールアドレスを入力してください' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Supabaseクライアント初期化
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 既存ユーザーのチェック
    if (checkExisting) {
      const { data: existingUsers } = await supabase.auth.admin.listUsers()
      const existingUser = existingUsers?.users?.find(u => u.email === email)
      
      if (existingUser) {
        return new Response(
          JSON.stringify({ 
            error: 'このメールアドレスは既に登録されています。ログインしてください。',
            existingUser: true
          }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    // 6桁の認証コード生成
    const code = Math.floor(100000 + Math.random() * 900000).toString()

    // 有効期限は15分後
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    // 既存の未検証コードを削除
    await supabase
      .from('verification_codes')
      .delete()
      .eq('email', email)
      .eq('verified', false)

    // 新しいコードを保存
    const { error: dbError } = await supabase
      .from('verification_codes')
      .insert({
        email,
        code,
        expires_at: expiresAt,
        verified: false,
      })

    if (dbError) {
      console.error('Database error:', dbError)
      throw new Error('認証コードの保存に失敗しました')
    }

    // Resendでメール送信
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set')
      throw new Error('メール送信の設定がされていません。管理者にお問い合わせください。')
    }
    
    // Resendのテスト用ドメイン（本番では独自ドメインに変更）
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'Acme <onboarding@resend.dev>'
    
    console.log(`Sending verification code to ${email} from ${fromEmail}`)
    
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: '【IToguchi】認証コード',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #00c3dc;">IToguchi</h2>
            <p>アカウント登録ありがとうございます。</p>
            <p>以下の認証コードを入力して、登録を完了してください。</p>
            <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
              <h1 style="color: #00c3dc; font-size: 36px; margin: 0; letter-spacing: 8px;">${code}</h1>
            </div>
            <p style="color: #666; font-size: 14px;">
              この認証コードは15分間有効です。<br>
              心当たりのない方は、このメールを無視してください。
            </p>
          </div>
        `,
      }),
    })

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text()
      console.error('Resend error status:', resendResponse.status)
      console.error('Resend error body:', errorText)
      throw new Error(`メール送信に失敗しました: ${errorText}`)
    }
    
    console.log(`Verification code sent to ${email}`)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: '認証コードを送信しました'
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
        error: error instanceof Error ? error.message : '認証コードの送信に失敗しました'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
