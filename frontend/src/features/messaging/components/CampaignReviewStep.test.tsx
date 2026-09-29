import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import CampaignReviewStep from './CampaignReviewStep'

const quota = (limit: number, totalUsage: number) =>
  ({ type: 'limited', limit, totalUsage }) as never

const base = {
  segmentType: 'all' as const,
  segmentParams: {},
  messageText: '10月のお知らせ',
  quotaInfo: null,
  sending: false,
  onSend: vi.fn(),
}

const sendButton = () => screen.getByRole('button', { name: /配信する/ })

describe('CampaignReviewStep', () => {
  it('友だち全員（人数が分かる）: 人数の目安を出して配信できる', () => {
    render(<CampaignReviewStep {...base} broadcast friendCountKnown recipientCount={42} />)
    expect(screen.getByText('友だち全員（約42名）')).toBeInTheDocument()
    expect(sendButton()).toHaveTextContent('友だち全員に配信する')
    expect(sendButton()).toBeEnabled()
  })

  it('友だち全員（人数が不明）: 0名でも配信できる（LINE 側で集計される）', () => {
    render(<CampaignReviewStep {...base} broadcast friendCountKnown={false} recipientCount={0} />)
    expect(screen.getByText('友だち全員（人数はLINE側で集計）')).toBeInTheDocument()
    expect(sendButton()).toBeEnabled()
  })

  it('友だち全員（人数が分かる）: 今月の残りが足りなければ配信できない', () => {
    render(
      <CampaignReviewStep
        {...base}
        broadcast
        friendCountKnown
        recipientCount={300}
        quotaInfo={quota(200, 0)}
      />,
    )
    expect(screen.getByText(/配信可能数が足りません/)).toBeInTheDocument()
    expect(sendButton()).toBeDisabled()
  })

  it('友だち全員（人数が不明）: 事前には足りないと決めつけない', () => {
    render(
      <CampaignReviewStep
        {...base}
        broadcast
        friendCountKnown={false}
        recipientCount={0}
        quotaInfo={quota(200, 190)}
      />,
    )
    expect(screen.queryByText(/配信可能数が足りません/)).not.toBeInTheDocument()
    expect(sendButton()).toBeEnabled()
  })

  it('絞り込み配信: 0名なら配信できない', () => {
    render(<CampaignReviewStep {...base} segmentType="visited" recipientCount={0} />)
    expect(sendButton()).toBeDisabled()
  })

  it('絞り込み配信: 人数を出して配信できる', () => {
    render(<CampaignReviewStep {...base} segmentType="visited" recipientCount={5} />)
    expect(screen.getByText('5名')).toBeInTheDocument()
    expect(sendButton()).toHaveTextContent('5名に配信する')
    expect(sendButton()).toBeEnabled()
  })
})
