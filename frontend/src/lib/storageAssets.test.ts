import { describe, expect, it } from 'vitest'
import { extractStoreAssetPath, findOrphanedStoreAssetPaths } from './storageAssets'

const publicUrl = (path: string) =>
  `https://example.supabase.co/storage/v1/object/public/store-assets/${path}`

describe('extractStoreAssetPath', () => {
  it('公開URLからバケット内のパスを取り出す', () => {
    expect(extractStoreAssetPath(publicUrl('store-1/staff_100.png'))).toBe('store-1/staff_100.png')
  })

  it('キャッシュバスティングのクエリは無視する', () => {
    expect(extractStoreAssetPath(`${publicUrl('store-1/logo_100.png')}?v=12345`)).toBe('store-1/logo_100.png')
    expect(extractStoreAssetPath(`${publicUrl('store-1/logo_100.png')}?t=12345`)).toBe('store-1/logo_100.png')
  })

  it('URLエンコードされたファイル名は元に戻す', () => {
    expect(extractStoreAssetPath(publicUrl('store-1/%E5%BA%97%E8%88%97.png'))).toBe('store-1/店舗.png')
  })

  it('空文字・null・undefined は null', () => {
    expect(extractStoreAssetPath('')).toBeNull()
    expect(extractStoreAssetPath(null)).toBeNull()
    expect(extractStoreAssetPath(undefined)).toBeNull()
  })

  it('別バケットや外部URLは削除対象にしない', () => {
    expect(extractStoreAssetPath('https://example.supabase.co/storage/v1/object/public/rich_menus/a.png')).toBeNull()
    expect(extractStoreAssetPath('https://example.com/avatar.png')).toBeNull()
  })
})

describe('findOrphanedStoreAssetPaths', () => {
  it('差し替えられた旧ファイルだけを返す', () => {
    expect(
      findOrphanedStoreAssetPaths([publicUrl('store-1/old.png')], [publicUrl('store-1/new.png')]),
    ).toEqual(['store-1/old.png'])
  })

  it('引き続き使われているファイルは残す', () => {
    expect(
      findOrphanedStoreAssetPaths([publicUrl('store-1/keep.png')], [publicUrl('store-1/keep.png')]),
    ).toEqual([])
  })

  it('クエリ違いだけの同一ファイルは削除しない', () => {
    expect(
      findOrphanedStoreAssetPaths(
        [`${publicUrl('store-1/keep.png')}?v=1`],
        [`${publicUrl('store-1/keep.png')}?v=2`],
      ),
    ).toEqual([])
  })

  it('画像を外した場合は旧ファイルを返す', () => {
    expect(findOrphanedStoreAssetPaths([publicUrl('store-1/old.png')], [''])).toEqual(['store-1/old.png'])
    expect(findOrphanedStoreAssetPaths([publicUrl('store-1/old.png')], [null])).toEqual(['store-1/old.png'])
  })

  it('複数スロットのうち入れ替わった分だけを返す', () => {
    expect(
      findOrphanedStoreAssetPaths(
        [publicUrl('store-1/slot1.png'), publicUrl('store-1/slot2.png')],
        [publicUrl('store-1/slot1.png'), publicUrl('store-1/slot2-new.png')],
      ),
    ).toEqual(['store-1/slot2.png'])
  })

  it('同じファイルを重複して渡しても一度しか返さない', () => {
    expect(
      findOrphanedStoreAssetPaths([publicUrl('store-1/old.png'), publicUrl('store-1/old.png')], []),
    ).toEqual(['store-1/old.png'])
  })
})
