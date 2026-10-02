import FeaturePage from '../components/site/FeaturePage'
import { AppWindow, Screenshot } from '../components/site/AppScreens'
import { LineTalk, PhoneFrame } from '../components/site/LinePhone'
import { AiReportSample } from '../components/site/demos/OtherDemos'
import featureAiImage from '../assets/feature-ai.png'

// チャットの文面は、実際の管理画面のチャットプレビュー（feature-ai.png）と同じ
const AI_CHAT = [
  { id: 'a1', from: 'customer' as const, body: '営業時間を教えてください' },
  { id: 'a2', from: 'shop' as const, body: '営業時間は10:00〜19:00です。定休日は毎週火曜日となっております。' },
  { id: 'a3', from: 'customer' as const, body: '駐車場はありますか？' },
  { id: 'a4', from: 'shop' as const, body: 'はい、店舗前に2台分の駐車スペースがございます。お車でお越しの際はご利用ください。' },
]

export default function FeatureAI() {
  return (
    <FeaturePage
      slug="ai"
      title={
        <>
          <span className="inline-block">決まった答えのない</span>
          <span className="inline-block">質問にも、</span>
          <br />
          <span className="inline-block">AIがお店の情報で</span>
          <span className="inline-block">答えます</span>
        </>
      }
      lead="キーワード応答で拾えない質問には、AIが返信します。メニュー表やよくある質問を読み込ませておくと、AIはお店の内容に沿って答えます。届いたメッセージや予約の傾向もAIがまとめ、次に何をすればよいかを提案します。"
      hero={
        <PhoneFrame className="mx-auto w-[17.5rem] sm:w-[18.5rem]">
          <LineTalk storeName="AIアシスタント" messages={AI_CHAT} showRichMenu={false} height="h-[30rem]" />
        </PhoneFrame>
      }
      gains={[
        { title: '深夜や早朝の質問にも、その場で返事が届く', body: 'キーワードに当てはまらない質問にも、AIがすぐに返信します。' },
        { title: 'お店の情報に沿って答える', body: 'メニュー表やよくある質問、Webページを読み込ませると、お店に合った答えを返します。' },
        { title: '口調をお店に合わせられる', body: '丁寧かフレンドリーかを選び、「創業50年の和菓子屋の店主」のような人物像も指示できます。' },
        { title: 'データから改善の提案が届く', body: '過去30日間のメッセージと予約をAIが分析し、よくある質問の分類や改善の提案をまとめます。' },
      ]}
      showcases={[
        {
          title: '口調と資料を決めれば、AIが接客します',
          lead: '管理画面でAIの口調を選び、お店の人物像を書き、メニュー表などの資料をアップロードします。右のプレビューで、AIがどう答えるかをその場で確かめられます。',
          body: (
            <AppWindow note="実際の管理画面（AIの設定とチャットのプレビュー）">
              <Screenshot src={featureAiImage} alt="AIの口調の選択、追加の指示、AI学習データのアップロード欄と、AIが営業時間と駐車場の質問に答えるチャットのプレビュー" />
            </AppWindow>
          ),
        },
        {
          title: 'お店のデータから、次の一手を提案します',
          lead: '過去30日間のメッセージと予約をAIが分析し、ダッシュボードにまとめます。どんな質問が多いか、どの時間に問い合わせが集まるかがわかります。',
          body: <AiReportSample />,
        },
      ]}
      steps={[
        { title: 'AI自動応答をオンにする', body: '管理画面のスイッチをオンにすれば、すぐに使い始められます。' },
        { title: '口調と人物像を決める', body: '丁寧かフレンドリーかを選び、お店のイメージに合わせた指示を書きます。' },
        { title: '資料を読み込ませる', body: 'メニュー表やよくある質問のファイルをアップロードします。URLから読み込むこともできます。' },
      ]}
      plans={{
        free: { name: 'キーワード応答', items: ['キーワード応答（10件まで）', 'サブキーワードの設定', '部分一致と完全一致', 'ルールごとのオン・オフ'] },
        pro: { name: 'AI自動応答と分析', items: ['キーワード応答（件数無制限）', 'AIによる自動応答', '口調の選択（丁寧・カジュアル）', 'お店の人物像（ペルソナ）の設定', 'AI学習データのアップロード', 'AIによるデータ分析'] },
      }}
      closing={{ title: 'AIの接客を、30日間無料で試せます', body: 'AIの機能はProプランで使えます。初めてお申し込みの方は、30日間無料です。' }}
    />
  )
}
