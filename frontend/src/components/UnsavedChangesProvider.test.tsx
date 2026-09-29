import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const click = (text: string) => fireEvent.click(screen.getByText(text))
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import UnsavedChangesProvider from './UnsavedChangesProvider'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges'

function Settings({ isDirty, save }: { isDirty: boolean; save: () => Promise<boolean> }) {
  useUnsavedChanges(isDirty, save)
  return <div>設定画面</div>
}

function CurrentPath() {
  return <div data-testid="path">{useLocation().pathname}</div>
}

function renderApp(isDirty: boolean, save: () => Promise<boolean> = async () => true) {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <Link to="/other">別の画面へ</Link>
      <UnsavedChangesProvider>
        <Routes>
          <Route path="/settings" element={<Settings isDirty={isDirty} save={save} />} />
          <Route path="*" element={<div>別の画面</div>} />
        </Routes>
      </UnsavedChangesProvider>
      <CurrentPath />
    </MemoryRouter>,
  )
}

describe('UnsavedChangesProvider', () => {
  it('変更がなければそのまま移動できる', async () => {
    renderApp(false)
    click('別の画面へ')
    expect(screen.getByTestId('path')).toHaveTextContent('/other')
    expect(screen.queryByText('設定がまだ反映されていません')).not.toBeInTheDocument()
  })

  it('変更があると確認モーダルが出て、移動は止まる', async () => {
    renderApp(true)
    click('別の画面へ')
    expect(screen.getByText('設定がまだ反映されていません')).toBeInTheDocument()
    expect(screen.getByText('設定を反映しますか？')).toBeInTheDocument()
    expect(screen.getByTestId('path')).toHaveTextContent('/settings')
  })

  it('「編集に戻る」で画面に留まる', async () => {
    renderApp(true)
    click('別の画面へ')
    click('編集に戻る')
    expect(screen.queryByText('設定がまだ反映されていません')).not.toBeInTheDocument()
    expect(screen.getByTestId('path')).toHaveTextContent('/settings')
  })

  it('「反映せずに移動」は保存せずに移動する', async () => {
    const save = vi.fn(async () => true)
    renderApp(true, save)
    click('別の画面へ')
    click('反映せずに移動')
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByTestId('path')).toHaveTextContent('/other')
  })

  it('「反映して移動」は保存に成功したら移動する', async () => {
    const save = vi.fn(async () => true)
    renderApp(true, save)
    click('別の画面へ')
    click('反映して移動')
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/other'))
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('「反映して移動」は保存に失敗したら画面に留まる', async () => {
    const save = vi.fn(async () => false)
    renderApp(true, save)
    click('別の画面へ')
    click('反映して移動')
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('path')).toHaveTextContent('/settings')
  })

  it('変更があるときだけ beforeunload を止める', () => {
    const dirty = renderApp(true)
    const dirtyEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(dirtyEvent)
    expect(dirtyEvent.defaultPrevented).toBe(true)
    dirty.unmount()

    renderApp(false)
    const cleanEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(cleanEvent)
    expect(cleanEvent.defaultPrevented).toBe(false)
  })
})
