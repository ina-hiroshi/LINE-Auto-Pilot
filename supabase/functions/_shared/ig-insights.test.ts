import { assertEquals } from 'jsr:@std/assert@^1.0.0'
import { classifyGraphError, describeGraphError, jstDate, pickInsightValue } from './ig-insights.ts'

Deno.test('pickInsightValue reads values[0].value', () => {
  const res = { data: [{ name: 'reach', values: [{ value: 12 }] }, { name: 'saved', values: [{ value: 0 }] }] }
  assertEquals(pickInsightValue(res, 'reach'), 12)
  assertEquals(pickInsightValue(res, 'saved'), 0)
})

Deno.test('pickInsightValue reads total_value.value', () => {
  const res = { data: [{ name: 'reach', total_value: { value: 7 } }] }
  assertEquals(pickInsightValue(res, 'reach'), 7)
})

Deno.test('pickInsightValue is null when the metric is missing or the response is empty', () => {
  assertEquals(pickInsightValue({ data: [] }, 'reach'), null)
  assertEquals(pickInsightValue({ error: { code: 10 } }, 'reach'), null)
  assertEquals(pickInsightValue(null, 'reach'), null)
})

Deno.test('describeGraphError keeps code and a truncated message', () => {
  assertEquals(describeGraphError({ code: 10, message: 'Permission denied' }), 'code 10: Permission denied')
  assertEquals(describeGraphError({ code: 100, error_subcode: 33, message: 'x' }), 'code 100/33: x')
  assertEquals(describeGraphError({ message: 'a'.repeat(300) }).length, 'error: '.length + 200)
})

Deno.test('classifyGraphError separates permission, unsupported and other', () => {
  assertEquals(classifyGraphError({ code: 10, message: '(#10) Application does not have permission' }), 'permission')
  assertEquals(classifyGraphError({ code: 100, message: 'metric[0] must be one of the following values' }), 'other')
  assertEquals(classifyGraphError({ code: 100, message: 'Media does not support this metric' }), 'unsupported')
  assertEquals(classifyGraphError({ code: 100, message: 'Not enough followers to see this metric' }), 'unsupported')
  assertEquals(classifyGraphError(null), 'other')
})

Deno.test('jstDate rolls over at 15:00 UTC', () => {
  assertEquals(jstDate(new Date('2026-10-12T14:59:00Z')), '2026-10-12')
  assertEquals(jstDate(new Date('2026-10-12T15:00:00Z')), '2026-10-13')
})
