import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1'
import {
  buildSocialReplyPrompt,
  parseSocialReplyDraft,
  parseSocialReplyResult,
  SOCIAL_REPLY_HISTORY_MAX_MESSAGES,
} from './social-reply-prompt.ts'

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

Deno.test('buildSocialReplyPrompt: 学習データを店舗情報として載せる', () => {
  const prompt = buildSocialReplyPrompt({
    storeName: 'IToguchi',
    platform: 'instagram',
    displayName: 'ゲスト',
    recentMessages: [{ direction: 'inbound', text: '料金は？' }],
    knowledgeText: 'Proプランは月額2,980円です。',
  })
  const knowledgeSection = prompt.split('# これまでのやり取り')[0]
  assertStringIncludes(knowledgeSection, 'Proプランは月額2,980円です。')
})

Deno.test('buildSocialReplyPrompt: 学習データが無ければ「登録されていません」', () => {
  const prompt = buildSocialReplyPrompt({
    storeName: null,
    platform: 'instagram',
    displayName: null,
    recentMessages: [],
  })
  assertStringIncludes(prompt, '# 店舗情報\n（登録されていません）')
})

Deno.test('buildSocialReplyPrompt: LINE 前提の文言を含まない', () => {
  const prompt = buildSocialReplyPrompt({
    storeName: '店',
    platform: 'instagram',
    displayName: '相手',
    recentMessages: [],
    knowledgeText: '情報',
    mode: 'auto',
  })
  assertEquals(prompt.includes('LINE'), false)
  assertEquals(prompt.includes('メニューの予約'), false)
})

Deno.test('buildSocialReplyPrompt: auto は確認なしで送られる前提と、人に回す条件を伝える', () => {
  const prompt = buildSocialReplyPrompt({
    storeName: '店',
    platform: 'instagram',
    displayName: '相手',
    recentMessages: [],
    mode: 'auto',
  })
  assertStringIncludes(prompt, '確認なしでそのまま相手に送られます')
  assertStringIncludes(prompt, 'needsHuman を true')
})

Deno.test('buildSocialReplyPrompt: 口調とペルソナを反映する', () => {
  const prompt = buildSocialReplyPrompt({
    storeName: '店',
    platform: 'instagram',
    displayName: '相手',
    recentMessages: [],
    tone: 'friendly',
    personaPrompt: '店長として話す',
  })
  assertStringIncludes(prompt, 'フレンドリー')
  assertStringIncludes(prompt, '追加の役割指示: 店長として話す')
})

Deno.test('parseSocialReplyResult: needsHuman を読み取る', () => {
  assertEquals(parseSocialReplyResult('{"draft":"","needsHuman":true}'), { draft: null, needsHuman: true })
  assertEquals(parseSocialReplyResult('{"draft":"はい","needsHuman":false}'), { draft: 'はい', needsHuman: false })
})

Deno.test('parseSocialReplyResult: 本文も needsHuman も無ければ null', () => {
  assertEquals(parseSocialReplyResult('{"draft":""}'), null)
})
