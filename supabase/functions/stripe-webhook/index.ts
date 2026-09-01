// Using Deno.serve instead of @std/http/server
import { createClient } from '@supabase/supabase-js'
import { stripe, Stripe } from '../_shared/stripe-client.ts'

const cryptoProvider = Stripe.createSubtleCryptoProvider();

/**
 * サブスクリプションの現在の請求期間の終了日を ISO 文字列で返す。
 *
 * current_period_end は Stripe の新しいバージョンでサブスクリプション本体から
 * 明細（items.data[]）側へ移った。本体だけを見ていると undefined になり、
 * `new Date(NaN).toISOString()` が RangeError を投げて Webhook 全体が落ちる。
 * その結果 plan の更新まで到達できず、決済が成立しているのにプランが
 * 反映されない状態になっていた。
 *
 * 取得できなかった場合は null を返し、呼び出し側はこの列の更新を見送る。
 * 期間の終了日が分からないことは、プラン反映を止める理由にはならない。
 */
function getCurrentPeriodEnd(subscription: Stripe.Subscription): string | null {
  // 同梱している stripe の型定義は current_period_end が本体にあった頃のもので、
  // 明細側に移った現在の形を知らない。実際に返ってくる値を読むため型を外す。
  const item = subscription.items?.data?.[0] as unknown as
    | { current_period_end?: number }
    | undefined
  const root = subscription as unknown as { current_period_end?: number }

  const candidates = [item?.current_period_end, root.current_period_end]

  for (const seconds of candidates) {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) continue
    const date = new Date(seconds * 1000)
    if (Number.isNaN(date.getTime())) continue
    return date.toISOString()
  }

  console.error(`current_period_end を取得できませんでした: ${subscription.id}`)
  return null
}


/**
 * モニター特典（初期設定代行の無償提供）を付与する。
 *
 * 申込は登録フローのプラン選択時に status='pending' で記録されるだけで、
 * 特典の実体である代行注文はここで初めて作る。
 * 決済ページで離脱した相手に ¥9,980 の作業だけ渡してしまわないよう、
 * サブスクリプションの成立を確認してから付与する。
 */
async function grantMonitorBenefit(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<void> {
  const { data: application, error: appError } = await supabase
    .from('monitor_applications')
    .select('id, store_name, email, phone, has_line_account')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .maybeSingle()

  if (appError) {
    console.error('モニター申込の取得に失敗しました:', appError)
    return
  }
  if (!application) return

  // 既に付与済みなら何もしない（Webhook は再送されうる）
  const { data: existing } = await supabase
    .from('setup_service_orders')
    .select('id')
    .eq('monitor_application_id', application.id)
    .maybeSingle()

  if (existing) {
    console.log('モニター特典は付与済み:', application.id)
    return
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle()

  const { data: order, error: orderError } = await supabase
    .from('setup_service_orders')
    .insert({
      user_id: userId,
      store_id: store?.id ?? null,
      monitor_application_id: application.id,
      amount: 0,
      status: 'in_progress',
      paid_at: new Date().toISOString(),
      contact_email: application.email,
      contact_phone: application.phone,
      has_line_account: application.has_line_account,
      admin_notes: 'モニター特典（初期設定代行の無償提供）',
    })
    .select('id')
    .single()

  if (orderError) {
    console.error('モニター特典の代行注文の作成に失敗しました:', orderError)
    return
  }

  await supabase
    .from('monitor_applications')
    .update({ status: 'approved' })
    .eq('id', application.id)

  // 申込者が次に何をすればよいか分かるよう、初期設定の手順を送る。
  try {
    const res = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-setup-service-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ order_id: order.id, email_type: 'payment_confirmation' }),
      },
    )
    if (!res.ok) {
      console.error('初期設定手順メールの送信に失敗しました:', await res.text())
    }
  } catch (e) {
    console.error('初期設定手順メールの送信でエラー:', e)
  }

  console.log('モニター特典を付与しました:', application.id)
}

Deno.serve(async (req: Request) => {
  const signature = req.headers.get('Stripe-Signature')
  const body = await req.text()
  
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
      undefined,
      cryptoProvider
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Webhook signature verification failed.`, message);
    return new Response(message, { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    console.log(`Received event: ${event.type}`);
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log(`Processing checkout.session.completed for session: ${session.id}`);
        console.log(`Session mode: ${session.mode}`);
        console.log(`Session metadata:`, JSON.stringify(session.metadata));
        console.log(`Session client_reference_id: ${session.client_reference_id}`);
        
        // 設定代行サービスの一回払い処理
        if (session.mode === 'payment' && session.metadata?.type === 'setup_service') {
          const orderId = session.metadata.order_id || session.client_reference_id;
          console.log(`Processing setup service checkout completion for order: ${orderId}`);
          
          if (orderId) {
            // Payment Intentを取得して決済情報を取得
            const paymentIntentId = session.payment_intent;
            
            // 更新前の状態を確認
            const { data: beforeUpdate } = await supabase
              .from('setup_service_orders')
              .select('id, status, user_id, store_id')
              .eq('id', orderId)
              .single()
            console.log(`Order before update:`, JSON.stringify(beforeUpdate));
            
            // store_idがnullの場合、ユーザーの店舗情報を取得して設定
            let storeIdToUpdate = beforeUpdate?.store_id
            if (!storeIdToUpdate && beforeUpdate?.user_id) {
              const { data: storeData } = await supabase
                .from('stores')
                .select('id')
                .eq('owner_id', beforeUpdate.user_id)
                .maybeSingle()
              
              if (storeData?.id) {
                storeIdToUpdate = storeData.id
                console.log(`Found store_id for user ${beforeUpdate.user_id}: ${storeIdToUpdate}`)
              }
            }
            
            // 既にcompletedの場合は、ステータスを更新しない（冪等性を保つ）
            const currentStatus = beforeUpdate?.status
            const shouldUpdateStatus = currentStatus !== 'completed' && currentStatus !== 'cancelled'
            
            const updateData: Record<string, unknown> = {
              stripe_payment_intent_id: typeof paymentIntentId === 'string' ? paymentIntentId : null,
              stripe_checkout_session_id: session.id,
              updated_at: new Date().toISOString(),
              ...(storeIdToUpdate ? { store_id: storeIdToUpdate } : {})
            }
            
            // ステータスがcompletedまたはcancelledでない場合のみ、paidに更新
            if (shouldUpdateStatus) {
              updateData.status = 'paid'
              // paid_atは初回のみ設定（既に設定されている場合は更新しない）
              if (!beforeUpdate?.paid_at) {
                updateData.paid_at = new Date().toISOString()
              }
            }
            
            const { data: updatedOrder, error } = await supabase
              .from('setup_service_orders')
              .update(updateData)
              .eq('id', orderId)
              .select()
            
            if (error) {
              console.error('Error updating setup order in checkout.session.completed:', error)
              console.error('Error details:', JSON.stringify(error))
            } else {
              console.log('Setup order marked as paid via checkout.session.completed')
              console.log('Updated order:', JSON.stringify(updatedOrder))
              
              // 決済確認メールを送信
              try {
                const emailResponse = await fetch(
                  `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-setup-service-email`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                    },
                    body: JSON.stringify({
                      order_id: orderId,
                      email_type: 'payment_confirmation'
                    })
                  }
                )
                
                if (!emailResponse.ok) {
                  const errorText = await emailResponse.text()
                  console.error('Failed to send payment confirmation email:', errorText)
                } else {
                  console.log('Payment confirmation email sent successfully')
                }
              } catch (emailError) {
                console.error('Error sending payment confirmation email:', emailError)
                // メール送信エラーは決済処理を止めない
              }
            }
          } else {
            console.log(`No orderId found. metadata.order_id: ${session.metadata?.order_id}, client_reference_id: ${session.client_reference_id}`)
          }
        } else {
          console.log(`Skipping setup service processing. mode: ${session.mode}, metadata.type: ${session.metadata?.type}`)
        }
        
        // サブスクリプション処理
        if (session.mode === 'subscription') {
          const subscriptionId = session.subscription;
          const customerId = session.customer;
          const userId = session.client_reference_id;
          console.log(`UserID: ${userId}, CustomerID: ${customerId}, SubscriptionID: ${subscriptionId}`);

          if (userId && typeof subscriptionId === 'string') {
            // Fetch subscription details to ensure plan is updated immediately
            console.log('Fetching subscription details...');
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const status = subscription.status;
            const priceId = subscription.items.data[0].price.id;
            const currentPeriodEnd = getCurrentPeriodEnd(subscription);

            // トライアル期間があるかどうかをチェック
            const isTrialing = status === 'trialing';
            
            // past_due はStripeの自動リトライ（Smart Retries）期間中のステータス。
            // ここで即座にfreeへ落とすと、一時的なカード拒否（残高不足等、数時間後の
            // 再試行で通ることも多い）でも支払っている顧客がPro機能を即座に失う。
            // リトライが尽きて最終的に canceled/unpaid 等になった時点で初めて free に落とす。
            const isPastDue = status === 'past_due';
            console.log(`Subscription status: ${status}, Plan: ${status === 'active' || status === 'trialing' || isPastDue ? 'pro' : 'free'}, isTrialing: ${isTrialing}, isPastDue: ${isPastDue}`);

            let plan = 'free';
            if (status === 'active' || status === 'trialing' || isPastDue) {
              plan = 'pro';
            }

            // トライアルを利用した場合は has_used_trial を true に設定
            const updateData: Record<string, unknown> = { 
              stripe_customer_id: customerId,
              subscription_id: subscriptionId,
              subscription_status: status,
              plan: plan,
              price_id: priceId,
            };

            // 期間の終了日が取れないときはこの列だけ触らず、プランの反映は続行する
            if (currentPeriodEnd) {
              updateData.current_period_end = currentPeriodEnd;
            }

            // トライアル中の場合、has_used_trial フラグを立てる（再利用防止）
            if (isTrialing) {
              updateData.has_used_trial = true;
              console.log('Setting has_used_trial to true (trial period detected)');
            }

            const { error } = await supabase
              .from('profiles')
              .update(updateData)
              .eq('id', userId);
            
            if (error) {
                console.error('Error updating profile with userId:', error);
            } else {
                console.log('Profile updated successfully via userId');
            }
            // 決済が成立したこの時点で、モニター特典を付与する。
            await grantMonitorBenefit(supabase, userId)
          } else {
            // Fallback: Update by stripe_customer_id if client_reference_id is missing
            console.log('No userId found, attempting update via stripe_customer_id');
            const { error } = await supabase
              .from('profiles')
              .update({ 
                subscription_id: subscriptionId,
                stripe_customer_id: customerId
              })
              .eq('stripe_customer_id', customerId);
            
            if (error) console.error('Error updating profile via customerId:', error);
          }
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        console.log(`Processing subscription update for: ${subscription.id}`);
        const status = subscription.status;
        const priceId = subscription.items.data[0].price.id;
        const currentPeriodEnd = getCurrentPeriodEnd(subscription);
        const customerId = subscription.customer;

        // Map Stripe status to internal plan
        // past_due はStripeの自動リトライ期間中のステータスなので、リトライが尽きて
        // canceled/unpaid 等になるまではPro扱いを維持する（理由は上のcheckout.session.completed側と同じ）。
        let plan = 'free';
        if (status === 'active' || status === 'trialing' || status === 'past_due') {
          plan = 'pro';
        }

        console.log(`Updating plan to ${plan} for customer ${customerId}`);

        const subscriptionUpdate: Record<string, unknown> = {
          plan: plan,
          price_id: priceId,
          subscription_status: status,
          subscription_id: subscription.id,
        };

        // 期間の終了日が取れないときはこの列だけ触らず、プランの反映は続行する
        if (currentPeriodEnd) {
          subscriptionUpdate.current_period_end = currentPeriodEnd;
        }

        const { error } = await supabase
          .from('profiles')
          .update(subscriptionUpdate)
          .eq('stripe_customer_id', customerId);
          
        if (error) console.error('Error updating profile in subscription update:', error);
        break;
      }
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const metadata = paymentIntent.metadata;
        
        // 設定代行サービスの決済完了処理（フォールバック）
        // 注: checkout.session.completedでも処理されるが、こちらは確実性のために残す
        if (metadata.type === 'setup_service' && metadata.order_id) {
          console.log(`Processing setup service payment_intent.succeeded for order: ${metadata.order_id}`);
          
          // 既に'paid'ステータスでない場合のみ更新（冪等性を保つ）
          const { data: existingOrder } = await supabase
            .from('setup_service_orders')
            .select('status')
            .eq('id', metadata.order_id)
            .single()
          
          if (existingOrder && existingOrder.status !== 'paid') {
            const { error } = await supabase
              .from('setup_service_orders')
              .update({
                status: 'paid',
                stripe_payment_intent_id: paymentIntent.id,
                paid_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', metadata.order_id)
            
            if (error) {
              console.error('Error updating setup order in payment_intent.succeeded:', error)
            } else {
              console.log('Setup order marked as paid via payment_intent.succeeded')
              
              // 決済確認メールを送信（フォールバック）
              try {
                const emailResponse = await fetch(
                  `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-setup-service-email`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                    },
                    body: JSON.stringify({
                      order_id: metadata.order_id,
                      email_type: 'payment_confirmation'
                    })
                  }
                )
                
                if (!emailResponse.ok) {
                  const errorText = await emailResponse.text()
                  console.error('Failed to send payment confirmation email:', errorText)
                } else {
                  console.log('Payment confirmation email sent successfully')
                }
              } catch (emailError) {
                console.error('Error sending payment confirmation email:', emailError)
                // メール送信エラーは決済処理を止めない
              }
            }
          } else {
            console.log('Order already marked as paid, skipping update')
          }
        }
        break;
      }
    }
  } catch (error: unknown) {
    console.error('Error processing webhook:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    // このファイルには throw が一切ないため、ここに来るのは常に「本当に
    // 予期しない例外」（stripe.subscriptions.retrieve等の通信エラー、
    // items.data[0] が空配列で undefined 参照、等）のみで、DB更新の失敗は
    // 個別に console.error するだけでここには来ない（処理は継続する）。
    // 以前は「Stripeの再送を防ぐため」200を返していたが、これは
    // 「本当に処理が失敗した1件」もStripeの自動リトライ（3日間）の
    // 対象から外してしまい、その1件だけ永久に反映されないまま放置される
    // 副作用があった。500を返してStripe側のリトライに委ねる。
    return new Response(
      JSON.stringify({ received: false, error: message }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  return new Response(
    JSON.stringify({ received: true }), 
    { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  )
})
