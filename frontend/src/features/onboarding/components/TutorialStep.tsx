import { motion, AnimatePresence } from 'framer-motion'
import { Play, ArrowRight, ArrowLeft } from 'lucide-react'
import {
  LayoutDashboard,
  Calendar,
  Users,
  MessageSquare,
  CreditCard
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface TutorialItem {
  title: string
  description: string
  icon: LucideIcon
}

const TUTORIAL_ITEMS: TutorialItem[] = [
  {
    title: 'ダッシュボード',
    description: '予約状況、顧客数、メッセージ数などを一目で確認。店舗の状況をリアルタイムで把握できます。',
    icon: LayoutDashboard,
  },
  {
    title: '予約売上管理',
    description: '予約の確認・決済・売上を管理。Googleカレンダーとも連携し、スケジュールを一元管理。',
    icon: Calendar,
  },
  {
    title: '顧客一覧',
    description: '顧客情報、来店履歴、メッセージ履歴を確認。各顧客とのやり取りを詳しく把握できます。',
    icon: Users,
  },
  {
    title: '自動応答',
    description: 'キーワードに対する自動返信を設定。営業時間外でもお客様をお待たせしません。',
    icon: MessageSquare,
  },
  {
    title: 'デジタル会員証',
    description: 'ポイントカードのデザインと設定を管理。お財布いらずで、来店のたびにポイントが貯まります。',
    icon: CreditCard,
  },
]

interface TutorialStepProps {
  tutorialIndex: number
  onTutorialIndexChange: (index: number) => void
  onComplete: () => void
}

export default function TutorialStep({
  tutorialIndex,
  onTutorialIndexChange,
  onComplete,
}: TutorialStepProps) {
  const tutorialItems = TUTORIAL_ITEMS

  return (
    <motion.div
      key="tutorial"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 md:p-8">
        <div className="text-center mb-8">
          <div className="bg-primary-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Play className="text-primary-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">🎉 設定完了！</h1>
          <p className="text-slate-500">IToguchiの主な機能をご紹介します。</p>
        </div>

        {/* チュートリアルカルーセル */}
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={tutorialIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-gradient-to-br from-primary-50 to-primary-100/50 rounded-2xl p-8 text-center"
            >
              <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                {(() => {
                  const Icon = tutorialItems[tutorialIndex].icon
                  return <Icon className="text-primary-600" size={40} />
                })()}
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">{tutorialItems[tutorialIndex].title}</h3>
              <p className="text-slate-600 max-w-md mx-auto">{tutorialItems[tutorialIndex].description}</p>
            </motion.div>
          </AnimatePresence>

          {/* ドットインジケーター */}
          <div className="flex justify-center gap-2 mt-6">
            {tutorialItems.map((_, index) => (
              <button
                key={index}
                onClick={() => onTutorialIndexChange(index)}
                className={`w-2 h-2 rounded-full transition ${
                  index === tutorialIndex ? 'bg-primary-600 w-6' : 'bg-slate-300'
                }`}
              />
            ))}
          </div>
        </div>

        {/* ナビゲーションボタン */}
        <div className="flex justify-between mt-8">
          <button
            onClick={() => onTutorialIndexChange(Math.max(0, tutorialIndex - 1))}
            disabled={tutorialIndex === 0}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={20} />
            前へ
          </button>
          {tutorialIndex < tutorialItems.length - 1 ? (
            <button
              onClick={() => onTutorialIndexChange(tutorialIndex + 1)}
              className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
            >
              次へ
              <ArrowRight size={20} />
            </button>
          ) : (
            <button
              onClick={onComplete}
              className="flex items-center gap-2 bg-primary-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-primary-700 transition shadow-lg shadow-primary-200"
            >
              ダッシュボードを開く
              <ArrowRight size={20} />
            </button>
          )}
        </div>
      </div>

      {/* スキップボタン */}
      {tutorialIndex < tutorialItems.length - 1 && (
        <div className="text-center">
          <button
            onClick={onComplete}
            className="text-slate-500 hover:text-slate-700 text-sm"
          >
            スキップしてダッシュボードへ
          </button>
        </div>
      )}
    </motion.div>
  )
}
