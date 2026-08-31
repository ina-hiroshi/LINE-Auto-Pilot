import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { Upload, User } from 'lucide-react'
import Modal from '../../../components/Modal'
import { supabase } from '../../../lib/supabase'
import { removeOrphanedStoreAssets } from '../../../lib/storageAssets'
import type { Staff } from '../types'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const ALLOWED_IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp']
const MAX_IMAGE_SIZE = 5 * 1024 * 1024

type StaffFormData = Pick<Staff, 'name' | 'role' | 'image_url'>

interface StaffModalProps {
  isOpen: boolean
  isLoading: boolean
  storeId: string | null
  formData: StaffFormData
  isEditing: boolean
  onClose: () => void
  onConfirm: () => void
  onChange: (next: StaffFormData) => void
  onToast?: (message: string, type: 'success' | 'error') => void
}

export function StaffModal({ isOpen, isLoading, storeId, formData, isEditing, onClose, onConfirm, onChange, onToast }: StaffModalProps) {
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // アップロード完了時に入力中の名前・役職を巻き戻さないよう最新値を参照する
  const formDataRef = useRef(formData)
  formDataRef.current = formData

  // このモーダルでアップロードした、まだ保存されていないファイル。
  // 差し替え・キャンセル時にここだけを消す。保存済みの画像は保存成功後に呼び出し側が消す。
  const unsavedUploadRef = useRef<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setUploading(false)
      setIsDragging(false)
      unsavedUploadRef.current = null
    }
  }, [isOpen])

  const handleImageUpload = useCallback(async (file: File) => {
    if (!storeId) {
      onToast?.('店舗情報が取得できませんでした', 'error')
      return
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      onToast?.('対応形式: JPEG, PNG, GIF, WebP', 'error')
      return
    }

    if (file.size > MAX_IMAGE_SIZE) {
      onToast?.('ファイルサイズは5MB以下にしてください', 'error')
      return
    }

    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png'
      const sanitizedExt = ALLOWED_IMAGE_EXTS.includes(fileExt) ? fileExt : 'png'
      const filePath = `${storeId}/staff_${Date.now()}.${sanitizedExt}`

      const { data, error } = await supabase.storage
        .from('store-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        })

      if (error) {
        console.error('Staff image upload error:', error)
        const errorMsg = error.message || ''
        if (errorMsg.includes('Bucket not found') || errorMsg.includes('bucket')) {
          onToast?.('ストレージバケット「store-assets」が見つかりません。管理者にお問い合わせください。', 'error')
        } else if (errorMsg.includes('row-level security') || errorMsg.includes('policy')) {
          onToast?.('アップロード権限がありません。再度ログインしてください。', 'error')
        } else {
          onToast?.(`アップロードエラー: ${errorMsg}`, 'error')
        }
        return
      }

      const { data: urlData } = supabase.storage
        .from('store-assets')
        .getPublicUrl(data.path)

      if (!urlData?.publicUrl) {
        onToast?.('画像URLの取得に失敗しました', 'error')
        return
      }

      const newUrl = `${urlData.publicUrl}?v=${Date.now()}`
      await removeOrphanedStoreAssets([unsavedUploadRef.current], [newUrl])
      unsavedUploadRef.current = newUrl

      onChange({ ...formDataRef.current, image_url: newUrl })
      onToast?.('スタッフ画像をアップロードしました', 'success')
    } catch (error) {
      console.error('Staff image upload failed:', error)
      const message = error instanceof Error ? error.message : '不明なエラー'
      onToast?.(`アップロードに失敗しました: ${message}`, 'error')
    } finally {
      setUploading(false)
    }
  }, [storeId, onChange, onToast])

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleImageUpload(file)
    // 同じファイルを再選択できるようリセットする
    e.target.value = ''
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (uploading) return
    const file = e.dataTransfer.files?.[0]
    if (file) handleImageUpload(file)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleImageDelete = () => {
    void removeOrphanedStoreAssets([unsavedUploadRef.current], [])
    unsavedUploadRef.current = null
    onChange({ ...formDataRef.current, image_url: '' })
    onToast?.('スタッフ画像を削除しました', 'success')
  }

  // キャンセル時は、保存されないまま残るアップロード済みファイルを片付ける
  const handleClose = () => {
    void removeOrphanedStoreAssets([unsavedUploadRef.current], [])
    unsavedUploadRef.current = null
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={onConfirm}
      title={isEditing ? 'スタッフ編集' : 'スタッフ追加'}
      confirmText={isEditing ? '更新' : '追加'}
      isLoading={isLoading}
      confirmDisabled={uploading}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">名前 <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => onChange({ ...formData, name: e.target.value })}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
            placeholder="例: 山田 花子"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">役職・肩書き</label>
          <input
            type="text"
            value={formData.role || ''}
            onChange={(e) => onChange({ ...formData, role: e.target.value })}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-200 outline-none"
            placeholder="例: 店長, スタイリスト"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">スタッフ画像</label>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-4 text-center transition-all ${
              isDragging
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }`}
          >
            {formData.image_url ? (
              <div className="space-y-3">
                <img
                  key={formData.image_url}
                  src={formData.image_url}
                  alt="スタッフ画像プレビュー"
                  className="w-20 h-20 rounded-full object-cover mx-auto"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="text-xs text-primary-600 hover:text-primary-700 underline disabled:opacity-50"
                  >
                    {uploading ? 'アップロード中...' : '変更する'}
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={handleImageDelete}
                    disabled={uploading}
                    className="text-xs text-red-600 hover:text-red-700 underline disabled:opacity-50"
                  >
                    削除
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
                  <User size={28} className="text-gray-400" />
                </div>
                <p className="text-sm text-gray-600">
                  画像をドラッグ&ドロップ<br />
                  <span className="text-xs text-gray-400">または</span>
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <Upload size={14} />
                  {uploading ? 'アップロード中...' : 'ファイルを選択'}
                </button>
                <p className="text-xs text-gray-400">PNG, JPG, GIF, WebP (最大5MB)</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>
    </Modal>
  )
}
