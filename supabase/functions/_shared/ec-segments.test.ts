import { assertEquals } from 'jsr:@std/assert@^1.0.0'
import { validateEcSegmentParams } from './ec-segments.ts'
Deno.test('EC segment numeric parameters must be explicit positive integers', () => {
  for (const [segment, key] of [['ec_recent', 'recent_days'], ['ec_dormant', 'dormant_days'], ['ec_high_spender', 'top_n']]) {
    for (const value of [undefined, null, '30', 0, -1, 1.5, Infinity, 2147483648]) assertEquals(validateEcSegmentParams(segment, { [key]: value }), false)
    assertEquals(validateEcSegmentParams(segment, { [key]: 30 }), true)
  }
  assertEquals(validateEcSegmentParams('ec_linked', {}), true)
  assertEquals(validateEcSegmentParams('recent', undefined), true)
})
