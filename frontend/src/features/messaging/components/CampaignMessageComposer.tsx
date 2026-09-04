import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import type { SegmentType } from '../types'
import { useCampaignGenerate } from '../hooks/useCampaign'

const MAX_MESSAGE_LENGTH = 5000

const TONE_OPTIONS: { value: 'friendly' | 'polite' | 'casual'; label: string }[] = [
  { value: 'friendly', label: '親しみやすく' },
  { value: 'polite', label: '丁寧に' },
  { value: 'casual', label: 'カジュアルに' },
]

type Props = {
  storeId: string
  segmentType: SegmentType
  /** メニュー名・スタッフ名など、AIに渡す対象の補足 */
  targetDetail?: string | null
  messageText: string
  onChangeMessage: (text: string, aiGenerated: boolean) => void
}

export default function CampaignMessageComposer({
  storeId,
  segmentType,
  targetDetail,
  messageText,
  onChangeMessage,
}: Props) {
  const { generate, generating } = useCampaignGenerate()

  const [purpose, setPurpose] = useState('')
  const [keywords, setKeywords] = useState('')
  const [tone, setTone] = useState<'friendly' | 'polite' | 'casual'>('friendly')
  const [variations, setVariations] = useState<string[]>([])
  const [aiError, setAiError] = useState<string | null>(null)
  const [planRequired, setPlanRequired] = useState(false)

  const handleGenerate = async () => {
    setAiError(null)
    setPlanRequired(false)

    const result = await generate({
      storeId,
      segmentType,
      targetDetail,
      purpose,
      tone,
      keywords,
    })

    if (!result.success) {
      setAiError(result.message)
      setPlanRequired(result.planRequired)
      setVariations([])
      return
    }

    setVariations(result.variations)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary-600" />
          <h3 className="text-sm font-bold text-gray-900">AIに下書きを作ってもらう</h3>
          <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full font-medium">
            Proプラン以上
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              配信の目的 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="例: 久しぶりのお客様に再来店してほしい"
              maxLength={200}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              盛り込みたい内容（任意）
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="例: 今月末まで、カット20%オフ"
              maxLength={200}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              割引や期限は、ここに書いた内容だけが本文に入ります。空欄なら特典には触れません。
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">文章のトーン</label>
            <div className="flex gap-2">
              {TONE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTone(option.value)}
                  className={`px-3 py-1 rounded-full text-xs border transition ${
                    tone === option.value
                      ? 'border-primary-500 bg-primary-600 text-white'
                      : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || purpose.trim().length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {variations.length > 0 ? '別の案を作る' : '文章を作ってもらう'}
          </button>

          {aiError && (
            <div
              className={`text-sm rounded-lg p-3 ${
                planRequired ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'
              }`}
            >
              {aiError}
              {planRequired && (
                <p className="text-xs mt-1">
                  配信そのものは全プランでご利用いただけます。文章はご自身で入力してください。
                </p>
              )}
            </div>
          )}

          {variations.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs text-gray-500">
                使いたい案を選ぶと下の本文に入ります。そのあと自由に手直しできます。
              </p>
              {variations.map((variation, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => onChangeMessage(variation, true)}
                  className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition"
                >
                  <div className="text-xs text-gray-400 mb-1">案{index + 1}</div>
                  <div className="text-sm text-gray-800 whitespace-pre-wrap">{variation}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-900 mb-2">
          配信する本文 <span className="text-red-500">*</span>
        </label>
        <textarea
          value={messageText}
          onChange={(e) => onChangeMessage(e.target.value, false)}
          rows={8}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="お客様に送るメッセージを入力してください"
          className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <div className="flex justify-between mt-1">
          <p className="text-xs text-gray-400">
            全員に同じ文面が届きます。お客様ごとの名前の差し込みはできません。
          </p>
          <span className="text-xs text-gray-400">
            {messageText.length} / {MAX_MESSAGE_LENGTH}
          </span>
        </div>
      </div>
    </div>
  )
}
