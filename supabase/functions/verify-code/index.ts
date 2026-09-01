import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { decideVerification } from '../_shared/verification-code-guard.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

/**
 * 6桁コード(約90万通り)は、試行回数を制限しないと有効期限の15分間
 * 総当たりで突破されうる。突破されると他人のメールアドレスで
 * signUp が走ってしまう（新規登録の先取り）。
 * この回数を超えたら、正しいコードが後から来ても弾き再送信を要求する。
 */
const MAX_ATTEMPTS = 5

interface RequestBody {
  email: string
  code: string
}

serve(async (req) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { email, code }: RequestBody = await req.json()

    if (!email || !code) {
      return new Response(
        JSON.stringify({ error: 'メールアドレスと認証コードが必要です' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // このメールアドレス宛の、有効期限内・未検証の最新コードを引く
    // （code では絞らない。誤答でも attempts を記録するため）。
    const { data: pending, error: fetchError } = await supabase
      .from('verification_codes')
      .select('*')
      .eq('email', email)
      .eq('verified', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchError) {
      console.error('Database error:', fetchError)
      throw new Error('認証コードの検証に失敗しました')
    }

    const invalidResponse = () =>
      new Response(
        JSON.stringify({
          error: '認証コードが無効か、有効期限が切れています',
          valid: false,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )

    const decision = decideVerification(pending, code, MAX_ATTEMPTS)

    if (decision.outcome === 'not_found') {
      return invalidResponse()
    }

    if (decision.outcome === 'locked') {
      return new Response(
        JSON.stringify({
          error: '試行回数が上限に達しました。認証コードを再送信してください。',
          valid: false,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (decision.outcome === 'wrong') {
      const { error: attemptError } = await supabase
        .from('verification_codes')
        .update({ attempts: decision.nextAttempts })
        .eq('id', pending!.id)
      if (attemptError) {
        console.error('Attempt count update error:', attemptError)
      }
      return invalidResponse()
    }

    // 認証コードを検証済みに更新
    const { error: updateError } = await supabase
      .from('verification_codes')
      .update({ verified: true })
      .eq('id', decision.id)

    if (updateError) {
      console.error('Update error:', updateError)
      throw new Error('認証コードの更新に失敗しました')
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
