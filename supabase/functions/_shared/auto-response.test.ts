import { assertEquals } from 'jsr:@std/assert@^1.0.0'
import { normalizeText, SCORING, scoreRule, selectAutoResponse } from './auto-response.ts'

type Rule = {
  keyword: string
  sub_keywords?: unknown
  response_text: string
}

const rule = (keyword: string, over: Partial<Rule> = {}): Rule => ({
  keyword,
  response_text: `${keyword}への返信`,
  ...over,
})

const matched = (text: string, rules: Rule[]) => selectAutoResponse(text, rules)?.rule.keyword ?? null

// ---- normalizeText ----

Deno.test('normalizeText: 大文字小文字を吸収する', () => {
  assertEquals(normalizeText('Reserve'), 'reserve')
})

Deno.test('normalizeText: 全角英数字・全角カナをNFKCで揃える', () => {
  assertEquals(normalizeText('ＹＯＹＡＫＵ'), 'yoyaku')
  assertEquals(normalizeText('ﾖﾔｸ'), 'ヨヤク')
})

Deno.test('normalizeText: 空白と一部の記号を落とす', () => {
  assertEquals(normalizeText('営業 時間 は？'), '営業時間は')
  assertEquals(normalizeText('予約したい！'), '予約したい')
  assertEquals(normalizeText('こんにちは。'), 'こんにちは')
})

Deno.test('normalizeText: NFKC後のASCII記号も落とす（全角?!は?!になる）', () => {
  assertEquals(normalizeText('営業時間?'), '営業時間')
  assertEquals(normalizeText('予約したい!'), '予約したい')
  // 全角と半角のどちらで送られても同じ結果になる
  assertEquals(normalizeText('営業時間？'), normalizeText('営業時間?'))
})

Deno.test('selectAutoResponse: 疑問符付きでも完全一致として扱う', () => {
  const rules = [rule('営業時間'), rule('営業')]
  const result = selectAutoResponse('営業時間？', rules)
  assertEquals(result?.rule.keyword, '営業時間')
  assertEquals(result?.score, SCORING.EXACT_MATCH)
})

// ---- scoreRule ----

Deno.test('scoreRule: 完全一致は最高スコア', () => {
  assertEquals(scoreRule(normalizeText('営業時間'), rule('営業時間')), SCORING.EXACT_MATCH)
})

Deno.test('scoreRule: 部分一致は基礎点＋キーワード長ボーナス', () => {
  // キーワード4文字 → ボーナス 8
  assertEquals(
    scoreRule(normalizeText('お店の営業時間を教えてください'), rule('営業時間')),
    SCORING.PARTIAL_MATCH + 8,
  )
})

Deno.test('scoreRule: 長さボーナスには上限がある', () => {
  const long = 'あ'.repeat(50)
  assertEquals(
    scoreRule(normalizeText(`${long}について`), rule(long)),
    SCORING.PARTIAL_MATCH + SCORING.MAX_LENGTH_BONUS,
  )
})

Deno.test('scoreRule: サブキーワードの一致ごとに加点する', () => {
  const r = rule('予約', { sub_keywords: ['明日', 'カット'] })
  const score = scoreRule(normalizeText('明日のカットを予約したい'), r)
  assertEquals(score, SCORING.PARTIAL_MATCH + 4 + SCORING.SUB_KEYWORD_MATCH * 2)
})

Deno.test('scoreRule: 一致しなければ0', () => {
  assertEquals(scoreRule(normalizeText('こんにちは'), rule('営業時間')), 0)
})

Deno.test('scoreRule: 空白のみのキーワードは全文一致扱いにせず0にする', () => {
  // '   ' は正規化すると '' になり、includes('') が常に true になるため、
  // 素通しすると全メッセージを横取りしてしまう。
  assertEquals(scoreRule(normalizeText('なんでもいいメッセージ'), rule('   ')), 0)
  assertEquals(scoreRule(normalizeText(''), rule('   ')), 0)
})

Deno.test('scoreRule: 空のサブキーワードは加点しない', () => {
  const r = rule('予約', { sub_keywords: ['', '   '] })
  assertEquals(scoreRule(normalizeText('予約したい'), r), SCORING.PARTIAL_MATCH + 4)
})

Deno.test('scoreRule: 文字列以外のサブキーワードを無視する', () => {
  const r = rule('予約', { sub_keywords: [null, 123, { a: 1 }] })
  assertEquals(scoreRule(normalizeText('予約したい'), r), SCORING.PARTIAL_MATCH + 4)
})

// ---- selectAutoResponse ----

Deno.test('selectAutoResponse: ルールが無ければ null', () => {
  assertEquals(selectAutoResponse('予約したい', []), null)
  assertEquals(selectAutoResponse('予約したい', null), null)
})

Deno.test('selectAutoResponse: しきい値未満なら null（AI応答へフォールバック）', () => {
  // サブキーワード1件だけの一致は 10 点で THRESHOLD(25) に届かない
  const rules = [rule('営業時間', { sub_keywords: ['明日'] })]
  assertEquals(selectAutoResponse('明日は空いてますか', rules), null)
})

Deno.test('selectAutoResponse: 完全一致するルールを選ぶ', () => {
  const rules = [rule('料金'), rule('営業時間'), rule('予約')]
  assertEquals(matched('営業時間', rules), '営業時間')
})

Deno.test('selectAutoResponse: 表記ゆれがあっても一致する', () => {
  const rules = [rule('営業時間')]
  assertEquals(matched('営業 時間 は？', rules), '営業時間')
})

Deno.test('selectAutoResponse: 完全一致を部分一致より優先する', () => {
  const rules = [
    rule('予約', { sub_keywords: ['したい', 'いま', 'すぐ'] }),
    rule('予約したい'),
  ]
  assertEquals(matched('予約したい', rules), '予約したい')
})

Deno.test('selectAutoResponse: 同点ならキーワードが長い方を選ぶ', () => {
  // どちらも部分一致だが、より具体的な方を採用する
  const rules = [rule('カット'), rule('カットとカラー')]
  assertEquals(matched('カットとカラーをお願いします', rules), 'カットとカラー')
})

Deno.test('selectAutoResponse: 空白のみのキーワードが全メッセージを横取りしない', () => {
  // 管理画面のバリデーションは空文字しか弾かないため、
  // 空白のみのルールが登録される余地がある。
  const rules = [rule('   '), rule('営業時間')]

  assertEquals(matched('こんにちは', rules), null)
  assertEquals(matched('営業時間を教えて', rules), '営業時間')
})

Deno.test('selectAutoResponse: 選ばれたルールの応答文を返す', () => {
  const rules = [rule('営業時間', { response_text: '10:00〜19:00です' })]
  assertEquals(selectAutoResponse('営業時間', rules)?.rule.response_text, '10:00〜19:00です')
})

Deno.test('selectAutoResponse: スコアも返す', () => {
  const rules = [rule('営業時間')]
  assertEquals(selectAutoResponse('営業時間', rules)?.score, SCORING.EXACT_MATCH)
})
