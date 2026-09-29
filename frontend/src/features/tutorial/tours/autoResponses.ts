import type { TabType } from '../../../pages/AutoResponses'
import type { Tour } from '../types'

export const autoResponsesTour: Tour<TabType> = {
  id: 'auto-responses',
  version: 1,
  title: '自動応答の操作方法',
  steps: [
    {
      target: 'auto-responses.tabs',
      tab: 'keyword',
      title: '3つの設定',
      body: '決まった言葉に決まった返事をする「キーワード応答」と、AI が自由に返事をする「AI基本設定」「AI学習データ」があります。AI の2つは Pro プランの機能です。',
      placement: 'bottom',
    },
    {
      target: 'auto-responses.search',
      tab: 'keyword',
      title: 'ルールを探す',
      body: 'キーワードや返信の文面で、登録したルールを検索できます。',
      placement: 'bottom',
    },
    {
      target: 'auto-responses.create',
      tab: 'keyword',
      title: '新しいルールを作る',
      body: '「営業時間」「場所」など、お客様がよく送る言葉に対する返事を登録します。無料プランは10件まで登録できます。',
      placement: 'bottom',
    },
    {
      target: 'auto-responses.rules',
      tab: 'keyword',
      title: '登録したルールの管理',
      body: '左のスイッチで有効・無効を切り替え、右の鉛筆で編集、ごみ箱で削除できます。',
      placement: 'bottom',
    },
    {
      target: 'auto-responses.ai-settings',
      tab: 'ai_settings',
      title: 'AI に返信を任せる',
      body: 'スイッチを入れると、キーワードに当てはまらない質問に AI が返信します。口調やお店の人物像も設定でき、右側のプレビューで返事を試せます。',
      placement: 'bottom',
    },
    {
      target: 'auto-responses.knowledge',
      tab: 'knowledge',
      title: 'お店の資料を AI に覚えさせる',
      body: 'メニュー表や料金表などの PDF・Word・テキスト、またはウェブページの URL を登録すると、AI がその内容をもとに答えます。',
      placement: 'bottom',
    },
  ],
}
