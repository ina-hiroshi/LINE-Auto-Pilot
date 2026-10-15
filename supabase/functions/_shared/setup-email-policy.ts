export function isSingleEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 &&
    /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(value)
}

export function normalizeBasicId(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') throw new Error('Basic IDが不正です')
  const id = value.replace(/^@/, '')
  if (!/^[A-Za-z0-9._-]{1,50}$/.test(id)) throw new Error('Basic IDが不正です')
  return id
}

export function canOwnerSendSetupEmail(order: { status: string; paid_at: unknown; amount: unknown }, emailType: string): boolean {
  return emailType === 'payment_confirmation' &&
    ['paid', 'in_progress'].includes(order.status) &&
    typeof order.paid_at === 'string' && Number.isFinite(Date.parse(order.paid_at)) &&
    typeof order.amount === 'number' && Number.isInteger(order.amount) && order.amount >= 0
}
