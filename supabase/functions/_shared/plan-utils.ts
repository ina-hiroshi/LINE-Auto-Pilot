export function isPaidPlan(plan: string | null | undefined): boolean {
  return plan === 'pro' || plan === 'executive'
}
