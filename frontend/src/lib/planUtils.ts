export type PlanType = 'free' | 'pro' | 'executive'

export function isPaidPlan(plan: string | null | undefined): boolean {
  return plan === 'pro' || plan === 'executive'
}
