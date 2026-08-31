import { supabase } from './supabase'

export const STORE_ASSETS_BUCKET = 'store-assets'

/**
 * store-assets の公開URLからオブジェクトパスを取り出す。
 * 保存済みURLにはキャッシュバスティング用のクエリが付くため、それを落とした値を返す。
 */
export function extractStoreAssetPath(publicUrl: string | null | undefined): string | null {
  if (!publicUrl) return null

  const marker = `/${STORE_ASSETS_BUCKET}/`
  const markerIndex = publicUrl.indexOf(marker)
  if (markerIndex === -1) return null

  const path = publicUrl.slice(markerIndex + marker.length).split(/[?#]/)[0]
  if (!path) return null

  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

const toPaths = (urls: (string | null | undefined)[]): string[] =>
  [...new Set(urls.map(extractStoreAssetPath).filter((path): path is string => path !== null))]

/** 差し替え・削除によって、どこからも参照されなくなったファイルのパスを求める */
export function findOrphanedStoreAssetPaths(
  previousUrls: (string | null | undefined)[],
  currentUrls: (string | null | undefined)[],
): string[] {
  const kept = new Set(toPaths(currentUrls))
  return toPaths(previousUrls).filter((path) => !kept.has(path))
}

/**
 * 参照されなくなった画像を Storage から削除する。
 * 必ずDBの更新が成功した後に呼ぶこと。先に消すと、保存されなかった場合に
 * DB上のURLだけが残って画像が壊れる。
 * 削除の失敗は利用者の操作結果に影響しないため握りつぶす。
 */
export async function removeOrphanedStoreAssets(
  previousUrls: (string | null | undefined)[],
  currentUrls: (string | null | undefined)[],
): Promise<void> {
  const paths = findOrphanedStoreAssetPaths(previousUrls, currentUrls)
  if (paths.length === 0) return

  try {
    const { error } = await supabase.storage.from(STORE_ASSETS_BUCKET).remove(paths)
    if (error) console.error('Failed to remove store assets:', error)
  } catch (error) {
    console.error('Failed to remove store assets:', error)
  }
}
