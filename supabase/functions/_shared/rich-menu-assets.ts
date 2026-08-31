/**
 * 合成したリッチメニュー画像（Canvas で生成し LINE に渡す PNG）の後始末。
 *
 * このバケットはフォルダを切らず、ファイル名に店舗IDを埋め込んでいる。
 * LINE は画像の実体を取り込むため、転送が終わったファイルは二度と参照されない。
 * 消さないと「LINEに適用」のたびに 1MB 前後が積み上がるので、過去分ごとここで片付ける。
 */

export const GENERATED_RICH_MENU_BUCKET = 'rich_menus'

export const generatedRichMenuPrefix = (storeId: string): string => `rich-menu-${storeId}-`

/** ファイル名の一覧から、指定した店舗が生成した合成画像だけを抜き出す */
export function selectGeneratedRichMenuFiles(fileNames: string[], storeIds: string[]): string[] {
  const prefixes = storeIds.map(generatedRichMenuPrefix)
  return fileNames.filter((name) => prefixes.some((prefix) => name.startsWith(prefix)))
}

/** Storage クライアントのうち、この処理が必要とする部分だけを表す */
type StorageBucket = {
  list(
    path: string,
    options: { limit: number; search: string },
  ): Promise<{ data: { name: string }[] | null; error: unknown }>
  remove(paths: string[]): Promise<{ error: unknown }>
}

export type StorageClient = { from(bucket: string): StorageBucket }

const PAGE_SIZE = 100
/** 1回の呼び出しで消す上限。消し切れなかった分は次回の適用時に拾う */
const MAX_PAGES = 10

/**
 * 店舗が生成した合成画像をまとめて削除する。
 * 失敗しても利用者の操作結果（リッチメニューの適用や退会）には影響しないため、
 * ログを残して黙って諦める。
 */
export async function purgeGeneratedRichMenuImages(
  storage: StorageClient,
  storeId: string,
): Promise<void> {
  const bucket = storage.from(GENERATED_RICH_MENU_BUCKET)
  const prefix = generatedRichMenuPrefix(storeId)

  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await bucket.list('', { limit: PAGE_SIZE, search: prefix })
    if (error) {
      console.error('[rich-menu-assets] failed to list generated images (ignoring):', error)
      return
    }
    if (!data?.length) return

    // search はサーバー側の絞り込みなので、他店舗のファイルを掴まないよう自前でも確認する
    const names = selectGeneratedRichMenuFiles(data.map((file) => file.name), [storeId])
    if (names.length === 0) return

    const { error: removeError } = await bucket.remove(names)
    if (removeError) {
      console.error('[rich-menu-assets] failed to remove generated images (ignoring):', removeError)
      return
    }

    // 消した分だけ次ページが繰り上がるので、常に先頭から取り直す
    if (data.length < PAGE_SIZE) return
  }
}
