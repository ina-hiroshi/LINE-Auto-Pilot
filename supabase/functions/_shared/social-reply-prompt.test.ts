import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1'
import { buildSocialReplyPrompt, parseSocialReplyDraft, SOCIAL_REPLY_HISTORY_MAX_MESSAGES } from './social-reply-prompt.ts'

Deno.test('buildSocialReplyPrompt: 履歴が無ければその旨を出す', () => {
  const prompt = buildSocialReplyPrompt({
    storeName: '伊奈サロン',
    platform: 'instagram',
    displayName: 'ゲスト',
    recentMessages: [],
  })
  assertStringIncludes(prompt, '（まだやり取りはありません）')
  assertStringIncludes(prompt, 'Instagram')
  assertStringIncludes(prompt, '伊奈サロン')
})

Deno.test('buildSocialReplyPrompt: inbound/outbound を話者名で並べる', () => {
  const prompt = buildSocialReplyPrompt({
    storeName: '伊奈サロン',
    platform: 'facebook',
    displayName: 'たろう',
    recentMessages: [
      { direction: 'inbound', text: '営業時間を教えてください' },
      { direction: 'outbound', text: '10時から19時です' },
    ],
  })
  assertStringIncludes(prompt, 'たろう: 営業時間を教えてください')
  assertStringIncludes(prompt, '伊奈サロン: 10時から19時です')
})

Deno.test('buildSocialReplyPrompt: 本文が空のメッセージは履歴に出さない', () => {
  const prompt = buildSocialReplyPrompt({
    storeName: null,
    platform: 'instagram',
    displayName: null,
    recentMessages: [
      { direction: 'inbound', text: null },
      { direction: 'inbound', text: '  ' },
      { direction: 'inbound', text: 'こんにちは' },
    ],
  })
  const historySection = prompt.split('# 守ること')[0]
  assertEquals((historySection.match(/こんにちは/g) ?? []).length, 1)
})

Deno.test('buildSocialReplyPrompt: 直近の上限件数だけを載せる', () => {
  const many = Array.from({ length: SOCIAL_REPLY_HISTORY_MAX_MESSAGES + 5 }, (_, i) => ({
    direction: 'inbound' as const,
    text: `メッセージ${i}`,
  }))
  const prompt = buildSocialReplyPrompt({
    storeName: '店',
    platform: 'instagram',
    displayName: '相手',
    recentMessages: many,
  })
  // 古いものは切り捨てられ、直近 SOCIAL_REPLY_HISTORY_MAX_MESSAGES 件だけが残る
  assertEquals(prompt.includes('メッセージ0'), false)
  assertStringIncludes(prompt, `メッセージ${many.length - 1}`)
})

Deno.test('parseSocialReplyDraft: 素のJSONをパースする', () => {
  assertEquals(parseSocialReplyDraft('{"draft":"ご連絡ありがとうございます"}'), 'ご連絡ありがとうございます')
})

Deno.test('parseSocialReplyDraft: コードブロックで包まれていても剥がしてパースする', () => {
  assertEquals(parseSocialReplyDraft('```json\n{"draft":"承知しました"}\n```'), '承知しました')
})

Deno.test('parseSocialReplyDraft: draft が空文字なら null', () => {
  assertEquals(parseSocialReplyDraft('{"draft":"   "}'), null)
})

Deno.test('parseSocialReplyDraft: パース不能なら null', () => {
  assertEquals(parseSocialReplyDraft('これはJSONではない'), null)
})
