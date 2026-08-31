import { assertEquals } from 'jsr:@std/assert@^1.0.0'
import {
  GENERATED_RICH_MENU_BUCKET,
  purgeGeneratedRichMenuImages,
  selectGeneratedRichMenuFiles,
  type StorageClient,
} from './rich-menu-assets.ts'

/** list / remove の呼ばれ方を記録するだけの Storage スタブ */
function fakeStorage(initialFiles: string[], options: { listError?: unknown; removeError?: unknown } = {}) {
  let files = [...initialFiles]
  const removed: string[][] = []
  const buckets: string[] = []

  const storage: StorageClient = {
    from(bucket) {
      buckets.push(bucket)
      return {
        list(_path, { limit, search }) {
          if (options.listError) return Promise.resolve({ data: null, error: options.listError })
          const matched = files.filter((name) => name.includes(search)).slice(0, limit)
          return Promise.resolve({ data: matched.map((name) => ({ name })), error: null })
        },
        remove(paths) {
          if (options.removeError) return Promise.resolve({ error: options.removeError })
          removed.push(paths)
          files = files.filter((name) => !paths.includes(name))
          return Promise.resolve({ error: null })
        },
      }
    },
  }

  return { storage, removed, buckets, remaining: () => files }
}

Deno.test('店舗の合成画像だけを抜き出す', () => {
  const files = [
    'rich-menu-store-1-100.png',
    'rich-menu-store-1-200.png',
    'rich-menu-store-2-100.png',
  ]

  assertEquals(selectGeneratedRichMenuFiles(files, ['store-1']), [
    'rich-menu-store-1-100.png',
    'rich-menu-store-1-200.png',
  ])
})

Deno.test('店舗IDが前方一致する別店舗のファイルは巻き込まない', () => {
  // 'store-1' と 'store-10' は prefix にハイフンまで含めることで区別される
  const files = ['rich-menu-store-1-100.png', 'rich-menu-store-10-100.png']

  assertEquals(selectGeneratedRichMenuFiles(files, ['store-1']), ['rich-menu-store-1-100.png'])
})

Deno.test('過去に溜まった分も含めてまとめて消す', async () => {
  const { storage, removed, buckets, remaining } = fakeStorage([
    'rich-menu-store-1-100.png',
    'rich-menu-store-1-200.png',
    'rich-menu-store-1-300.png',
  ])

  await purgeGeneratedRichMenuImages(storage, 'store-1')

  assertEquals(buckets, [GENERATED_RICH_MENU_BUCKET])
  assertEquals(removed, [[
    'rich-menu-store-1-100.png',
    'rich-menu-store-1-200.png',
    'rich-menu-store-1-300.png',
  ]])
  assertEquals(remaining(), [])
})

Deno.test('他店舗のファイルには手を出さない', async () => {
  const { storage, remaining } = fakeStorage([
    'rich-menu-store-1-100.png',
    'rich-menu-store-2-100.png',
  ])

  await purgeGeneratedRichMenuImages(storage, 'store-1')

  assertEquals(remaining(), ['rich-menu-store-2-100.png'])
})

Deno.test('対象が無ければ削除を呼ばない', async () => {
  const { storage, removed } = fakeStorage(['rich-menu-store-2-100.png'])

  await purgeGeneratedRichMenuImages(storage, 'store-1')

  assertEquals(removed, [])
})

Deno.test('1ページに収まらない件数でも消し進める', async () => {
  const files = Array.from({ length: 250 }, (_, i) => `rich-menu-store-1-${i}.png`)
  const { storage, removed, remaining } = fakeStorage(files)

  await purgeGeneratedRichMenuImages(storage, 'store-1')

  assertEquals(removed.map((paths) => paths.length), [100, 100, 50])
  assertEquals(remaining(), [])
})

Deno.test('一覧取得に失敗しても例外を投げない', async () => {
  const { storage, removed } = fakeStorage(['rich-menu-store-1-100.png'], {
    listError: { message: 'boom' },
  })

  await purgeGeneratedRichMenuImages(storage, 'store-1')

  assertEquals(removed, [])
})

Deno.test('削除に失敗しても例外を投げず、繰り返さない', async () => {
  const { storage, remaining } = fakeStorage(['rich-menu-store-1-100.png'], {
    removeError: { message: 'boom' },
  })

  await purgeGeneratedRichMenuImages(storage, 'store-1')

  assertEquals(remaining(), ['rich-menu-store-1-100.png'])
})
