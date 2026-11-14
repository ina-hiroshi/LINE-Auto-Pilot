import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createSupabaseMock, type SupabaseMock } from '../../../test/supabaseMock'
let mock: SupabaseMock
vi.mock('../../../lib/supabase', () => ({ get supabase() { return mock.supabase } }))
import { EcLinkTab } from './EcLinkTab'

const link = { ec_shop_name: 'お店', ec_shop_url: 'https://shop.itoguchi-app.jp', entitled: true, linked_at: '2026-11-04T00:00:00Z' }
function setup(linked = false) {
  mock = createSupabaseMock({
    handler: () => ({ data: null, error: null }),
    rpc: () => ({ data: linked ? [link] : [], error: null }),
    invoke: () => ({ data: { code: 'ABCD1234', expires_at: '2026-11-04T01:00:00Z' }, error: null }),
  })
  render(<EcLinkTab storeId="store-1" />)
}

describe('IToguchi EC 連携', () => {
  it('自分の連携を取得し、コードを発行して案内する', async () => {
    setup()
    fireEvent.click(await screen.findByRole('button', { name: 'つなぐためのコードを出す' }))
    expect(await screen.findByLabelText('連携コード')).toHaveTextContent('ABCD1234')
    expect(mock.rpcCalls).toContainEqual({ name: 'my_ec_link', args: undefined })
    expect(mock.invocations).toContainEqual({ name: 'ec-link-code', body: { action: 'issue', storeId: 'store-1' } })
    expect(screen.getByText(/『ページの内容』→『LINE』/)).toBeInTheDocument()
  })

  it('有効な連携を表示し、確認した場合だけ外す', async () => {
    setup(true)
    expect(await screen.findByRole('link', { name: 'お店' })).toHaveAttribute('href', link.ec_shop_url)
    expect(screen.getByText('有料の機能を使えます。')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'つなぎを外す' }))
    expect(mock.invocations).toHaveLength(0)
    fireEvent.click(screen.getAllByRole('button', { name: 'つなぎを外す' }).at(-1)!)
    await waitFor(() => expect(mock.invocations).toContainEqual({ name: 'ec-link-code', body: { action: 'unlink', storeId: 'store-1' } }))
  })
})
