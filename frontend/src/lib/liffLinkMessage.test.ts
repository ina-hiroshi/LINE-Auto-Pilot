import { beforeEach, describe, expect, it, vi } from 'vitest'

const liffMock = vi.hoisted(() => ({
  isInClient: vi.fn(),
  getContext: vi.fn(),
  permission: { query: vi.fn() },
  sendMessages: vi.fn(),
}))

vi.mock('@line/liff', () => ({ default: liffMock }))

import { sendLinkMessage } from './liffLinkMessage'

const MESSAGE = '予約しました（確認コード ABCD2345）'

describe('sendLinkMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    liffMock.isInClient.mockReturnValue(true)
    liffMock.getContext.mockReturnValue({ type: 'utou' })
    liffMock.permission.query.mockResolvedValue({ state: 'granted' })
    liffMock.sendMessages.mockResolvedValue(undefined)
  })

  it('1対1のトークから開いていれば、テキストとして送る', async () => {
    await expect(sendLinkMessage(MESSAGE)).resolves.toBe(true)
    // Flex / テンプレートは Webhook に届かないので、必ずテキストで送る
    expect(liffMock.sendMessages).toHaveBeenCalledWith([{ type: 'text', text: MESSAGE }])
  })

  it('メッセージが無ければ何もしない', async () => {
    await expect(sendLinkMessage(null)).resolves.toBe(false)
    await expect(sendLinkMessage('')).resolves.toBe(false)
    expect(liffMock.sendMessages).not.toHaveBeenCalled()
  })

  it('LINE アプリの外（ブラウザ）では送らない', async () => {
    liffMock.isInClient.mockReturnValue(false)
    await expect(sendLinkMessage(MESSAGE)).resolves.toBe(false)
    expect(liffMock.sendMessages).not.toHaveBeenCalled()
  })

  it('グループ・複数人トークには送らない', async () => {
    for (const type of ['group', 'room', 'square_chat', 'external', 'none']) {
      liffMock.getContext.mockReturnValue({ type })
      await expect(sendLinkMessage(MESSAGE)).resolves.toBe(false)
    }
    expect(liffMock.sendMessages).not.toHaveBeenCalled()
  })

  it('chat_message.write が使えない設定なら送らない', async () => {
    liffMock.permission.query.mockResolvedValue({ state: 'unavailable' })
    await expect(sendLinkMessage(MESSAGE)).resolves.toBe(false)
    expect(liffMock.sendMessages).not.toHaveBeenCalled()
  })

  it('許可されず送信に失敗しても、例外にしない', async () => {
    liffMock.sendMessages.mockRejectedValue(new Error("user doesn't grant required permissions yet"))
    await expect(sendLinkMessage(MESSAGE)).resolves.toBe(false)
  })
})
