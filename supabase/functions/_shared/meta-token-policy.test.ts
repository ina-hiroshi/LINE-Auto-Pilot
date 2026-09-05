import { assertEquals } from 'jsr:@std/assert@^1.0.0'
import {
  checkFacebookScopes,
  isNearingExpiry,
  shouldRefreshInstagram,
} from './meta-token-policy.ts'

Deno.test('shouldRefreshInstagram is true when never refreshed', () => {
  assertEquals(shouldRefreshInstagram(null, new Date('2026-09-05T00:00:00Z')), true)
})

Deno.test('shouldRefreshInstagram is false just under 24h', () => {
  const now = new Date('2026-09-05T00:00:00Z')
  const last = new Date(now.getTime() - (24 * 60 * 60 * 1000 - 1))
  assertEquals(shouldRefreshInstagram(last.toISOString(), now), false)
})

Deno.test('shouldRefreshInstagram is true at exactly 24h', () => {
  const now = new Date('2026-09-05T00:00:00Z')
  const last = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  assertEquals(shouldRefreshInstagram(last.toISOString(), now), true)
})

Deno.test('isNearingExpiry is false when expiresAt is null (e.g. FB Page token)', () => {
  assertEquals(isNearingExpiry(null, new Date('2026-09-05T00:00:00Z')), false)
})

Deno.test('isNearingExpiry is false with 15 days left', () => {
  const now = new Date('2026-09-05T00:00:00Z')
  const expires = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000)
  assertEquals(isNearingExpiry(expires.toISOString(), now), false)
})

Deno.test('isNearingExpiry is true at exactly 14 days left', () => {
  const now = new Date('2026-09-05T00:00:00Z')
  const expires = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  assertEquals(isNearingExpiry(expires.toISOString(), now), true)
})

Deno.test('isNearingExpiry is true when already expired', () => {
  const now = new Date('2026-09-05T00:00:00Z')
  const expires = new Date(now.getTime() - 1000)
  assertEquals(isNearingExpiry(expires.toISOString(), now), true)
})

Deno.test('checkFacebookScopes flags all as missing when scopes is null', () => {
  const check = checkFacebookScopes(null)
  assertEquals(check.missingCritical.length, 3)
  assertEquals(check.missingExtended.length, 5)
})

Deno.test('checkFacebookScopes reflects the current real token (no reauth yet)', () => {
  // 実測済みの現行スコープ。再認可前はこれで missingCritical が空であるべき。
  const check = checkFacebookScopes([
    'public_profile', 'pages_show_list', 'pages_read_engagement', 'pages_manage_posts',
  ])
  assertEquals(check.missingCritical, [])
  assertEquals(check.missingExtended, [
    'pages_messaging', 'pages_manage_metadata', 'read_insights', 'ads_read', 'business_management',
  ])
})

Deno.test('checkFacebookScopes flags a missing critical scope (revoked permission)', () => {
  const check = checkFacebookScopes(['public_profile', 'pages_show_list'])
  assertEquals(check.missingCritical, ['pages_read_engagement', 'pages_manage_posts'])
})
