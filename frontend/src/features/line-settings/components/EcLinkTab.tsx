import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import Modal from '../../../components/Modal'

type EcLink = {
  ec_shop_name: string
  ec_shop_url: string
  entitled: boolean
  linked_at: string
}

export function EcLinkTab({ storeId }: { storeId: string | null }) {
  const [link, setLink] = useState<EcLink | null>(null)
  const [code, setCode] = useState<{ code: string; expires_at: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [confirmUnlink, setConfirmUnlink] = useState(false)

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('my_ec_link')
      if (error) throw error
      setLink(data?.[0] ?? null)
      setError('')
    } catch {
      setError('連携の状態を取得できませんでした。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [load])

  const perform = async (action: 'issue' | 'unlink') => {
    if (!storeId) return
    setProcessing(true)
    setError('')
    try {
      const { data, error } = await supabase.functions.invoke('ec-link-code', { body: { action, storeId } })
      if (error || data?.error) throw error ?? new Error(data.error)
      if (action === 'issue') {
        setCode(data)
      } else {
        setLink(null)
        setCode(null)
        setConfirmUnlink(false)
        window.dispatchEvent(new Event('profile-updated'))
        await load()
      }
    } catch {
      setError(action === 'issue' ? 'コードを発行できませんでした。もう一度お試しください。' : '連携を外せませんでした。もう一度お試しください。')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) return <p role="status">連携の状態を読み込み中...</p>

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-gray-900">IToguchi EC</h2>
      {error && <div role="alert" className="text-sm text-red-600">{error}<button className="ml-3 underline" onClick={() => void load()}>再読み込み</button></div>}
      {link ? (
        <div className="space-y-4">
          <a href={link.ec_shop_url} target="_blank" rel="noopener noreferrer" className="text-primary-700 underline">{link.ec_shop_name || 'ネットショップ'}</a>
          <p className="text-sm text-gray-600">つないだ日：{new Date(link.linked_at).toLocaleDateString('ja-JP')}</p>
          <p>{link.entitled ? '有料の機能を使えます。' : '現在、有料の機能は使えません。'}</p>
          <button className="rounded-lg border border-red-300 px-4 py-2 text-red-700 disabled:opacity-50" disabled={processing || !storeId} onClick={() => setConfirmUnlink(true)}>つなぎを外す</button>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-sm leading-relaxed text-gray-600">IToguchi EC（ネットショップ）の 5,500円・9,900円のプランのお店とつなぐと、注文の LINE 通知、購入者への配信などが使えます。つないでいるあいだは、IToguchi の有料の機能も使えます。</p>
          <button className="rounded-lg bg-primary-600 px-4 py-2 text-white disabled:opacity-50" disabled={processing || !storeId || !!error} onClick={() => void perform('issue')}>{processing ? '発行中...' : 'つなぐためのコードを出す'}</button>
          {code && <div className="rounded-xl bg-gray-50 p-6 space-y-3">
            <p className="font-mono text-4xl font-bold tracking-widest" aria-label="連携コード">{code.code}</p>
            <p className="text-lg">有効期限：{new Date(code.expires_at).toLocaleString('ja-JP')}</p>
            <p className="text-sm text-gray-600">IToguchi EC の管理画面の『ページの内容』→『LINE』に入れてください。</p>
          </div>}
        </div>
      )}
      <Modal isOpen={confirmUnlink} onClose={() => setConfirmUnlink(false)} onConfirm={() => void perform('unlink')} title="IToguchi EC とのつなぎを外しますか？" message="EC の契約による有料の機能は使えなくなります。" variant="danger" confirmText="つなぎを外す" isLoading={processing} />
    </div>
  )
}
