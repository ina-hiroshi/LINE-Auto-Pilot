import { assertEquals } from 'jsr:@std/assert@^1.0.0'
import { parseAdName, UNPARSED_BUCKET } from './ad-name-parser.ts'

Deno.test('parses the standard 業種_訴求_vN pattern', () => {
  const r = parseAdName('美容室_同じ質問_v2')
  assertEquals(r, { raw: '美容室_同じ質問_v2', parsed: true, industry: '美容室', appeal: '同じ質問', version: 2, suffix: null })
})

Deno.test('keeps a trailing suffix separate from the version', () => {
  const r = parseAdName('美容室_二度目来店_v4_link')
  assertEquals(r.parsed, true)
  assertEquals(r.version, 4)
  assertEquals(r.suffix, 'link')
})

Deno.test('joins a multi-segment suffix', () => {
  const r = parseAdName('飲食店_二度目来店_v5_utm_test')
  assertEquals(r.suffix, 'utm_test')
})

Deno.test('buckets a name with no version segment as その他 instead of dropping it', () => {
  const r = parseAdName('とりあえずのテスト広告')
  assertEquals(r.parsed, false)
  assertEquals(r.industry, UNPARSED_BUCKET)
  assertEquals(r.appeal, UNPARSED_BUCKET)
  assertEquals(r.raw, 'とりあえずのテスト広告')
})

Deno.test('buckets a name that looks close but has no v-number as その他', () => {
  const r = parseAdName('美容室_同じ質問_version2')
  assertEquals(r.parsed, false)
  assertEquals(r.industry, UNPARSED_BUCKET)
})

Deno.test('buckets an empty industry or appeal segment as その他', () => {
  const r = parseAdName('_同じ質問_v2')
  assertEquals(r.parsed, false)
})
