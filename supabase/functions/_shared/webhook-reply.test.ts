import { assertEquals } from 'jsr:@std/assert@1'
import {
  buildLogEntry,
  describeNonTextMessage,
  isBlankText,
  redactSecrets,
} from './webhook-reply.ts'

Deno.test('isBlankText: 半角・全角スペースと改行だけなら空白扱い', () => {
  assertEquals(isBlankText(' '), true)
  assertEquals(isBlankText('　 \n'), true)
  assertEquals(isBlankText(''), true)
  assertEquals(isBlankText(null), true)
  assertEquals(isBlankText(' こんにちは '), false)
})

Deno.test('describeNonTextMessage: 種別ごとの文言、未知の種別は汎用文言', () => {
  assertEquals(describeNonTextMessage('image'), '[画像が送信されました]')
  assertEquals(describeNonTextMessage('sticker'), '[スタンプが送信されました]')
  assertEquals(describeNonTextMessage('unknown'), '[テキスト以外のメッセージが送信されました]')
  assertEquals(describeNonTextMessage(undefined), '[テキスト以外のメッセージが送信されました]')
})

Deno.test('buildLogEntry: 送信成功ならそのまま記録する', () => {
  assertEquals(buildLogEntry({ status: 'auto_replied', replyText: 'こんにちは', replySent: true }), {
    status: 'auto_replied',
    reply_content: 'こんにちは',
  })
  assertEquals(buildLogEntry({ status: 'ai_replied', replyText: 'はい', replySent: true }), {
    status: 'ai_replied',
    reply_content: 'はい',
  })
})

Deno.test('buildLogEntry: enum に無い status は担当者対応にする', () => {
  assertEquals(buildLogEntry({ status: 'rate_limited', replyText: '確認します', replySent: true }), {
    status: 'manual_reply_needed',
    reply_content: '確認します',
  })
  assertEquals(
    buildLogEntry({ status: 'rate_limited_duplicate', replyText: null, replySent: false }),
    { status: 'manual_reply_needed', reply_content: null },
  )
})

Deno.test('buildLogEntry: 返信に失敗したら「返信済み」にしない', () => {
  assertEquals(buildLogEntry({ status: 'auto_replied', replyText: '営業時間は10時です', replySent: false }), {
    status: 'manual_reply_needed',
    reply_content: null,
  })
  assertEquals(buildLogEntry({ status: 'ai_replied', replyText: 'はい', replySent: false }), {
    status: 'manual_reply_needed',
    reply_content: null,
  })
})

Deno.test('buildLogEntry: 返信しない場合は担当者対応のまま', () => {
  assertEquals(buildLogEntry({ status: 'manual_reply_needed', replyText: null, replySent: false }), {
    status: 'manual_reply_needed',
    reply_content: null,
  })
})

Deno.test('redactSecrets: URL 中の API キーを伏せる', () => {
  const err = new TypeError(
    'error sending request for url (https://generativelanguage.googleapis.com/v1beta/models/x:generateContent?key=AIzaSECRET123)',
  )
  const out = redactSecrets(err)
  assertEquals(out.includes('AIzaSECRET123'), false)
  assertEquals(out.includes('key=***'), true)
})
