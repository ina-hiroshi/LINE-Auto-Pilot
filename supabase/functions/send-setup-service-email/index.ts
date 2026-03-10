import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const STAFF_LINE_ID = Deno.env.get('SETUP_SERVICE_STAFF_LINE_ID') || 'voltric424'
const FRONTEND_URL = 'https://itoguchi-app.jp/#auth'

interface RequestBody {
  order_id: string
  email_type: 'payment_confirmation' | 'completion'
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { order_id, email_type }: RequestBody = await req.json()

    if (!order_id || !email_type) {
      return new Response(
        JSON.stringify({ error: 'order_idとemail_typeが必要です' }),
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

    // 注文情報を取得
    const { data: order, error: orderError } = await supabase
      .from('setup_service_orders')
      .select('*')
      .eq('id', order_id)
      .single()

    if (orderError || !order) {
      console.error('Order fetch error:', orderError)
      throw new Error('注文情報の取得に失敗しました')
    }

    const email = order.contact_email
    if (!email) {
      throw new Error('メールアドレスが設定されていません')
    }

    // Resendでメール送信
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set')
      throw new Error('メール送信の設定がされていません。管理者にお問い合わせください。')
    }
    
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'Acme <onboarding@resend.dev>'
    
    // メール内容を生成
    let subject = ''
    let html = ''

    if (email_type === 'payment_confirmation') {
      subject = '【IToguchi】初期設定代行サービスのお申し込みありがとうございます'
      
      if (order.has_line_account) {
        // パターンA: LINE公式アカウントを持っている場合
        const basicIdText = order.line_account_basic_id 
          ? `Basic ID: @${order.line_account_basic_id}`
          : ''
        
        html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #00c3dc;">IToguchi</h2>
            <p>この度は、IToguchiのLINE初期設定代行サービスにお申し込みいただき、誠にありがとうございます。</p>
            <p>お支払いが完了いたしましたので、ご連絡いたします。</p>
            
            <h3 style="color: #333; margin-top: 24px; margin-bottom: 12px;">【今後の流れ】</h3>
            <p>メールでのやり取りを通じて、以下の設定作業を実施いたします：</p>
            <ul style="line-height: 1.8;">
              <li>LINE Developersチャネル作成サポート</li>
              <li>認証情報の取得と登録</li>
              <li>Webhook URLの設定</li>
              <li>LINE連携の完了確認</li>
            </ul>
            
            <h3 style="color: #333; margin-top: 24px; margin-bottom: 12px;">【作業方法】</h3>
            <p>お客様のLINE公式アカウントに当社スタッフを一時的にメンバー招待していただき、<br>
            メールでのやり取りを通じて設定作業を実施します。<br>
            作業完了後、すぐにメンバー権限を削除していただきます。</p>
            
            <p>以下のLINE IDでスタッフを招待してください：<br>
            <strong>LINE ID: ${STAFF_LINE_ID}</strong></p>
            
            ${basicIdText ? `
            <h3 style="color: #333; margin-top: 24px; margin-bottom: 12px;">【確認済み情報】</h3>
            <p>申し込み時にご入力いただいたBasic IDを確認済みです。<br>
            ${basicIdText}</p>
            ` : ''}
            
            <p style="margin-top: 24px;">設定完了まで通常3〜5営業日程度かかります。</p>
            
            <p style="margin-top: 24px;">ご不明な点がございましたら、このメールに返信してお問い合わせください。</p>
            
            <p style="margin-top: 24px;">今後ともIToguchiをよろしくお願いいたします。</p>
            
            <p style="margin-top: 24px;">IToguchi運営チーム</p>
          </div>
        `
      } else {
        // パターンB: LINE公式アカウントを持っていない場合
        html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #00c3dc;">IToguchi</h2>
            <p>この度は、IToguchiのLINE初期設定代行サービスにお申し込みいただき、誠にありがとうございます。</p>
            <p>お支払いが完了いたしましたので、ご連絡いたします。</p>
            
            <h3 style="color: #333; margin-top: 24px; margin-bottom: 12px;">【今後の流れ】</h3>
            <p>メールでのやり取りを通じて、以下の設定作業を実施いたします：</p>
            <ul style="line-height: 1.8;">
              <li>LINE公式アカウントの作成サポート</li>
              <li>LINE Developersチャネル作成サポート</li>
              <li>認証情報の取得と登録</li>
              <li>Webhook URLの設定</li>
              <li>LINE連携の完了確認</li>
            </ul>
            
            <h3 style="color: #333; margin-top: 24px; margin-bottom: 12px;">【LINE公式アカウントの作成方法】</h3>
            <p>まず、LINE公式アカウントを作成していただきます。<br>
            以下の手順で作成をお願いいたします：</p>
            
            <ol style="line-height: 1.8;">
              <li>LINE公式アカウントの作成ページにアクセス<br>
              <a href="https://account.line.biz/" style="color: #00c3dc;">https://account.line.biz/</a></li>
              <li>LINEアカウントでログイン（お持ちでない場合は新規作成）</li>
              <li>「新規作成」を選択し、アカウント情報を入力
                <ul>
                  <li>アカウント名（店舗名など）</li>
                  <li>カテゴリ選択</li>
                  <li>プロフィール画像の設定</li>
                </ul>
              </li>
              <li>作成完了後、Basic IDを取得してください<br>
              （設定 > 基本設定 > Basic ID）</li>
            </ol>
            
            <p style="margin-top: 16px;">LINE公式アカウント作成後、当社スタッフを一時的にメンバー招待していただき、<br>
            メールでのやり取りを通じて設定作業を実施します。<br>
            作業完了後、すぐにメンバー権限を削除していただきます。</p>
            
            <p>スタッフのLINE ID: <strong>${STAFF_LINE_ID}</strong></p>
            
            <p style="margin-top: 24px;">設定完了まで通常3〜5営業日程度かかります。</p>
            
            <p style="margin-top: 24px;">ご不明な点がございましたら、このメールに返信してお問い合わせください。</p>
            
            <p style="margin-top: 24px;">今後ともIToguchiをよろしくお願いいたします。</p>
            
            <p style="margin-top: 24px;">IToguchi運営チーム</p>
          </div>
        `
      }
    } else if (email_type === 'completion') {
      subject = '【IToguchi】初期設定代行サービスが完了しました'
      
      html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #00c3dc;">IToguchi</h2>
          <p>この度は、IToguchiのLINE初期設定代行サービスをご利用いただき、ありがとうございました。</p>
          <p>設定作業が完了いたしましたので、ご連絡いたします。</p>
          
          <h3 style="color: #333; margin-top: 24px; margin-bottom: 12px;">【完了した作業】</h3>
          <ul style="line-height: 1.8;">
            <li>✓ LINE Developersチャネル作成</li>
            <li>✓ 認証情報の取得と登録</li>
            <li>✓ Webhook URLの設定</li>
            <li>✓ LINE連携の完了確認</li>
          </ul>
          
          <h3 style="color: #333; margin-top: 24px; margin-bottom: 12px;">【重要】スタッフのメンバー削除について</h3>
          <p>設定作業が完了いたしましたので、LINE公式アカウントから当社スタッフのメンバー権限を削除してください。<br>
          セキュリティのため、お早めの削除をお願いいたします。</p>
          
          <h3 style="color: #333; margin-top: 24px; margin-bottom: 12px;">【次のステップ】</h3>
          <p>IToguchiの管理画面にログインして、以下の設定を進めてください：</p>
          <ol style="line-height: 1.8;">
            <li>店舗情報の登録</li>
            <li>リッチメニューの設定</li>
            <li>予約設定のカスタマイズ</li>
            <li>自動応答の設定</li>
            <li>Googleカレンダー連携（オプション）</li>
          </ol>
          
          <p style="margin-top: 16px;">管理画面: <a href="${FRONTEND_URL}" style="color: #00c3dc;">${FRONTEND_URL}</a></p>
          
          <h3 style="color: #333; margin-top: 24px; margin-bottom: 12px;">【サポート】</h3>
          <p>ご不明な点がございましたら、管理画面の「サポート」からお問い合わせください。<br>
          または、このメールに返信してお問い合わせいただくことも可能です。</p>
          
          <p style="margin-top: 24px;">IToguchiで、LINE運用の自動化を始めましょう！</p>
          
          <p style="margin-top: 24px;">今後ともIToguchiをよろしくお願いいたします。</p>
          
          <p style="margin-top: 24px;">IToguchi運営チーム</p>
        </div>
      `
    }

    console.log(`Sending ${email_type} email to ${email} from ${fromEmail}`)
    
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: subject,
        html: html,
      }),
    })

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text()
      console.error('Resend error status:', resendResponse.status)
      console.error('Resend error body:', errorText)
      throw new Error(`メール送信に失敗しました: ${errorText}`)
    }
    
    console.log(`${email_type} email sent to ${email}`)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'メールを送信しました'
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
        error: error instanceof Error ? error.message : 'メールの送信に失敗しました'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
