/**
 * メール認証コード（6桁）の突合せ判定。
 *
 * 試行回数を記録・上限で打ち切ることで、有効期限内の総当たり
 * （6桁 ≒ 90万通り）を実質的に防ぐ。副作用（DB更新・HTTPレスポンス組み立て）
 * を持たない判定ロジックだけを切り出し、テストできるようにする。
 */

export type PendingVerificationCode = {
  id: string
  code: string
  attempts: number
}

export type VerificationDecision =
  | { outcome: 'not_found' }
  | { outcome: 'locked' }
  | { outcome: 'wrong'; nextAttempts: number }
  | { outcome: 'success'; id: string }

export function decideVerification(
  pending: PendingVerificationCode | null | undefined,
  submittedCode: string,
  maxAttempts: number,
): VerificationDecision {
  if (!pending) return { outcome: 'not_found' }
  if (pending.attempts >= maxAttempts) return { outcome: 'locked' }
  if (pending.code !== submittedCode) {
    return { outcome: 'wrong', nextAttempts: pending.attempts + 1 }
  }
  return { outcome: 'success', id: pending.id }
}
