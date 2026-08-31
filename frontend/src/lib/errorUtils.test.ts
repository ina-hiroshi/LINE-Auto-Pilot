import { describe, it, expect } from 'vitest'
import { toErrorMessage, toErrorMessageAsync } from './errorUtils'

describe('toErrorMessage', () => {
  it('returns message from Error instance', () => {
    expect(toErrorMessage(new Error('test error'))).toBe('test error')
  })

  it('returns message from object with message property', () => {
    expect(toErrorMessage({ message: 'object error' })).toBe('object error')
  })

  it('converts string to itself', () => {
    expect(toErrorMessage('string error')).toBe('string error')
  })

  it('converts number to string', () => {
    expect(toErrorMessage(42)).toBe('42')
  })

  it('converts null to string', () => {
    expect(toErrorMessage(null)).toBe('null')
  })

  it('converts undefined to string', () => {
    expect(toErrorMessage(undefined)).toBe('undefined')
  })

  it('ignores non-string message property', () => {
    expect(toErrorMessage({ message: 123 })).toBe('[object Object]')
  })
})

describe('toErrorMessage: FunctionsHttpError の context', () => {
  it('context がパース済みオブジェクトなら error を取り出す', () => {
    expect(toErrorMessage({ context: { error: 'この操作には LINE ログインが必要です' } }))
      .toBe('この操作には LINE ログインが必要です')
  })

  it('message があれば context より message を優先する', () => {
    expect(toErrorMessage({ message: 'FunctionsHttpError', context: { error: '詳細' } }))
      .toBe('FunctionsHttpError')
  })

  it('context.error が空文字なら採用しない', () => {
    expect(toErrorMessage({ context: { error: '' } })).toBe('[object Object]')
  })
})

describe('toErrorMessageAsync', () => {
  /** 別レルムでも動くよう duck typing で判定されるため、最小の Response 相当を作る */
  const responseLike = (body: string) => ({
    clone: () => ({ text: async () => body }),
    text: async () => body,
  })

  it('invoke の response 本文から error を取り出す', async () => {
    const message = await toErrorMessageAsync(
      new Error('Edge Function returned a non-2xx status code'),
      responseLike(JSON.stringify({ error: '予約が見つかりません' })),
    )
    expect(message).toBe('予約が見つかりません')
  })

  it('response が無ければ error.context の本文を読む', async () => {
    const message = await toErrorMessageAsync({
      message: 'FunctionsHttpError',
      context: responseLike(JSON.stringify({ error: 'この予約は決済済みです' })),
    })
    expect(message).toBe('この予約は決済済みです')
  })

  it('response の内容を context より優先する', async () => {
    const message = await toErrorMessageAsync(
      { context: responseLike(JSON.stringify({ error: 'contextの方' })) },
      responseLike(JSON.stringify({ error: 'responseの方' })),
    )
    expect(message).toBe('responseの方')
  })

  it('本文がJSONでなければ通常のメッセージに落とす', async () => {
    const message = await toErrorMessageAsync(new Error('通信に失敗しました'), responseLike('<html>502</html>'))
    expect(message).toBe('通信に失敗しました')
  })

  it('本文が空でも落ちない', async () => {
    const message = await toErrorMessageAsync(new Error('タイムアウト'), responseLike('   '))
    expect(message).toBe('タイムアウト')
  })

  it('error フィールドが無いJSONは採用しない', async () => {
    const message = await toErrorMessageAsync(new Error('不明なエラー'), responseLike(JSON.stringify({ ok: false })))
    expect(message).toBe('不明なエラー')
  })

  it('response が Response 相当でなければ無視する', async () => {
    const message = await toErrorMessageAsync(new Error('元のメッセージ'), { error: '使われない' })
    expect(message).toBe('元のメッセージ')
  })
})
