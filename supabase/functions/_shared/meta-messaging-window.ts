/**
 * DM 送信が許されるかどうかを判定する唯一の関門。
 *
 * 送信経路（自動応答・AI下書き承認・プライベートリプライ・手動）は
 * すべてここを通す。Meta のメッセージングウィンドウ規約:
 *
 *   - last_inbound_at が無い会話には送れない（ユーザー起点でない DM は送れない）
 *   - 経過 < 24h                          → 許可、タグなし
 *   - 24h ≤ 経過 < 7d かつ 手動送信       → 許可、HUMAN_AGENT タグ付き
 *   - 24h ≤ 経過 < 7d かつ 自動送信       → 拒否
 *   - 経過 ≥ 7d                           → 拒否
 *
 * HUMAN_AGENT は「人間の担当者がサポート目的で使う」タグであり、
 * bot が付けるとポリシー違反になる。sentBy を手動系（'manual' extends
 * ManualSentBy）に絞った関数だけがタグ付き許可を返せるようにし、
 * 自動系の型（AutomatedSentBy）から呼べる関数には最初から
 * HUMAN_AGENT の分岐が存在しない（型レベルで到達不能にする）。
 */

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS

export type ManualSentBy = 'manual' | 'ai_draft_approved'
export type AutomatedSentBy = 'keyword_rule' | 'private_reply'

export type WindowDecision =
  | { allowed: true; tag: null }
  | { allowed: true; tag: 'HUMAN_AGENT' }
  | { allowed: false; reason: 'no_inbound' | 'window_expired' | 'automated_outside_24h' }

/**
 * 経過時間を計算する。Meta の created_time と Edge Function 側の時計は
 * 別系統のため、数秒程度の時計ずれで「たった今届いた inbound」が
 * 未来時刻に見えることがある。ここを素直に負の値のまま扱うと、
 * 自動応答が本来最優先で拾うべき「今届いたメッセージ」を no_inbound として
 * 拒否してしまう（サイレントな取りこぼし）。0 未満は 0 に丸める。
 * 一方 Date.parse が壊れた文字列を渡されて NaN になった場合は、
 * 0 に丸めず「受信なし」として拒否する（すり抜けさせない）。
 */
function elapsedSinceInbound(lastInboundAt: string, now: Date): number | null {
  const parsed = Date.parse(lastInboundAt)
  if (Number.isNaN(parsed)) return null
  return Math.max(0, now.getTime() - parsed)
}

/**
 * 自動送信経路（キーワードルール・プライベートリプライ）用の判定。
 * 24h を超えた時点で理由を問わず拒否する。HUMAN_AGENT へ分岐する
 * コードパス自体がここには存在しない。
 */
export function evaluateAutomatedWindow(
  lastInboundAt: string | null,
  now: Date = new Date(),
): WindowDecision {
  if (!lastInboundAt) return { allowed: false, reason: 'no_inbound' }

  const elapsed = elapsedSinceInbound(lastInboundAt, now)
  if (elapsed === null) return { allowed: false, reason: 'no_inbound' }
  if (elapsed < ONE_DAY_MS) return { allowed: true, tag: null }
  return { allowed: false, reason: 'automated_outside_24h' }
}

/**
 * 手動送信経路（管理画面からの返信・AI下書きを人が承認して送信）用の判定。
 * 24h〜7d は HUMAN_AGENT タグ付きで許可する。
 */
export function evaluateManualWindow(
  lastInboundAt: string | null,
  now: Date = new Date(),
): WindowDecision {
  if (!lastInboundAt) return { allowed: false, reason: 'no_inbound' }

  const elapsed = elapsedSinceInbound(lastInboundAt, now)
  if (elapsed === null) return { allowed: false, reason: 'no_inbound' }
  if (elapsed < ONE_DAY_MS) return { allowed: true, tag: null }
  if (elapsed < SEVEN_DAYS_MS) return { allowed: true, tag: 'HUMAN_AGENT' }
  return { allowed: false, reason: 'window_expired' }
}

// sentBy の型に応じてどちらの判定関数を使うべきかを実行時の文字列比較で
// 振り分ける共通入口は意図的に置かない。DB から読んだ string を union に
// キャストして通されると、その一箇所の分岐だけが HUMAN_AGENT 到達可否の
// 唯一の防波堤になってしまう。呼び出し側（自動応答の評価・ドレイナーは
// evaluateAutomatedWindow、手動返信アクションは evaluateManualWindow）に
// 必ずどちらを呼ぶかを名指しさせることで、「自動経路から HUMAN_AGENT に
// 到達しない」を型ではなくコード構造そのもので保証する。
