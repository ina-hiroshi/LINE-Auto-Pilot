import { assertEquals } from 'jsr:@std/assert@^1.0.0'
import { extractHtml } from './extract-html.ts'

Deno.test('DOMからタイトル・本文を取得しscript/styleを除く', () => {
  assertEquals(extractHtml('<title>店舗 &amp; 案内</title><body><script>secret</script><style>hidden</style><p>予約はこちら</p></body>', 'https://example.com'), {
    title: '店舗 & 案内', content: '予約はこちら',
  })
})
Deno.test('本文が空ならDOMのメタ情報を使用する', () => {
  assertEquals(extractHtml('<meta property="og:title" content="店舗"><meta name="description" content="営業時間">', 'https://example.com'), {
    title: '店舗', content: '店舗 営業時間',
  })
})
Deno.test('閉じ括弧のない大量のタグ記号でもDOMだけで処理する', () => {
  const result = extractHtml('<'.repeat(100000), 'https://example.com')
  assertEquals(typeof result.content, 'string')
})
