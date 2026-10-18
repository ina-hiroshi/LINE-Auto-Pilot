import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resizeImageForUpload } from './resizeImageForUpload'

vi.mock('./supabase', () => ({ supabase: {} }))

const file = (type = 'image/png', name = 'photo.png') => new File(['x'.repeat(100)], name, { type })

describe('resizeImageForUpload', () => {
  const decode = vi.fn()
  const drawImage = vi.fn()
  let encoded: Blob | null

  beforeEach(() => {
    encoded = new Blob(['small'], { type: 'image/webp' })
    decode.mockResolvedValue(undefined)
    vi.stubGlobal('Image', class {
      naturalWidth = 1600
      naturalHeight = 800
      src = ''
      decode = decode
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback) {
      callback(encoded)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('GIFは読み込まず元のファイルを返す', async () => {
    const source = file('image/gif', 'animation.GIF')
    expect(await resizeImageForUpload(source, 384)).toEqual({ blob: source, contentType: 'image/gif', ext: 'gif' })
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('読み込み失敗時は元のファイルを返しURLを解放する', async () => {
    decode.mockRejectedValue(new Error('decode failed'))
    const source = file()
    expect((await resizeImageForUpload(source, 384)).blob).toBe(source)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test')
  })

  it('ファイル名の拡張子が不正でもGIFのMIMEタイプから拡張子を決める', async () => {
    const source = file('image/gif', 'evil.exe')
    expect(await resizeImageForUpload(source, 384)).toEqual({ blob: source, contentType: 'image/gif', ext: 'gif' })
  })

  it.each([100, 101])('変換後が元と同じか大きい場合は元を返す（%i bytes）', async (size) => {
    encoded = new Blob(['x'.repeat(size)], { type: 'image/webp' })
    const source = file()
    expect((await resizeImageForUpload(source, 384)).blob).toBe(source)
  })

  it('縦横比を保って縮小しWebPで出力する', async () => {
    const result = await resizeImageForUpload(file(), 384)
    expect(result).toEqual({ blob: encoded, contentType: 'image/webp', ext: 'webp' })
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 384, 192)
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/webp', 0.85)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test')
  })

  it('小さい画像は拡大しない', async () => {
    await resizeImageForUpload(file(), 2000)
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 800)
  })

  it('JPEGはquality 0.85のJPEGにする', async () => {
    encoded = new Blob(['small'], { type: 'image/jpeg' })
    const result = await resizeImageForUpload(file('image/jpeg', 'photo.jpeg'), 384)
    expect(result).toEqual({ blob: encoded, contentType: 'image/jpeg', ext: 'jpg' })
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.85)
  })

  it('WebP指定でもPNGが返ればPNGの形式と拡張子を使う', async () => {
    encoded = new Blob(['small'], { type: 'image/png' })
    expect(await resizeImageForUpload(file(), 800)).toEqual({ blob: encoded, contentType: 'image/png', ext: 'png' })
  })

  it('canvasが使えない場合は元を返す', async () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null)
    const source = file()
    expect((await resizeImageForUpload(source, 384)).blob).toBe(source)
  })

  it('変換に失敗した場合は元を返す', async () => {
    encoded = null
    const source = file()
    expect((await resizeImageForUpload(source, 384)).blob).toBe(source)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test')
  })
})
