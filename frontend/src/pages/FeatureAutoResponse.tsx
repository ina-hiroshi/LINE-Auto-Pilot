import FeaturePage from '../components/site/FeaturePage'
import { AppWindow, KeywordRulesMini } from '../components/site/AppScreens'
import AutoReplyPlayground from '../components/site/demos/AutoReplyPlayground'
import HeroDemo from '../components/site/HeroDemo'

export default function FeatureAutoResponse() {
  return (
    <FeaturePage
      slug="auto-response"
      title={
        <>
          {'よく\u2060聞かれる質問には、'}
          <br />
          LINEが代わりに答えます
        </>
      }
      lead="「営業時間は？」「駐車場はありますか？」など、毎日のように届く質問には、あらかじめ決めた文章で自動返信できます。Proプランなら、決まった答えのない質問にもAIが返信します。"
      hero={<HeroDemo />}
      wideHero
      gains={[
        { title: '同じ返事を打つ手間が減る', body: 'よくある質問への返事は自動で届くので、毎回同じ文章を打たずに済みます。' },
        { title: '営業時間外も、お客様を待たせない', body: '深夜や定休日に届いた質問にも、その場で返事が届きます。' },
        { title: '答えに迷う質問はAIに任せられる', body: '登録した言葉に当てはまらない質問にも、AIがお店の情報をもとに返信します。', pro: true },
      ]}
      showcases={[
        {
          title: '質問を選んで、返事が届く様子を試してください',
          lead: '左のスマホで質問を選ぶと、右の管理画面で当てはまったルールが光り、決めておいた文章が返ります。最後の質問はどのキーワードにも当てはまらないため、AIが返信します。',
          body: <AutoReplyPlayground />,
          interactive: true,
        },
        {
          title: '管理画面で、言葉と返事を登録するだけです',
          lead: '反応する言葉（キーワード）と、似た言い回し（サブキーワード）、返す文章を登録します。部分一致か完全一致かを選べて、ルールごとにオン・オフを切り替えられます。',
          body: (
            <div className="max-w-2xl">
              <AppWindow note="管理画面のキーワード応答（表示例）">
                <KeywordRulesMini />
              </AppWindow>
            </div>
          ),
        },
      ]}
      steps={[
        { title: 'キーワードを登録する', body: '「営業時間」「予約」などの言葉と、それに返す文章を設定します。' },
        { title: 'AIの口調を選ぶ', body: '丁寧かフレンドリーかを選び、お店の雰囲気に合わせた指示を書けます。', pro: true },
        { title: 'お店の資料を読み込ませる', body: 'メニュー表やよくある質問の資料を読み込ませると、AIの答えがお店の内容に沿ったものになります。', pro: true },
      ]}
      plans={{
        free: { name: 'キーワード応答', items: ['キーワード応答（10件まで）', 'サブキーワードの設定', '部分一致と完全一致', 'ルールごとのオン・オフ'] },
        pro: { name: 'AI自動応答', items: ['キーワード応答（件数無制限）', 'AIによる自動応答', '口調の選択（丁寧・カジュアル）', 'お店の人物像（ペルソナ）の設定', 'AI学習データのアップロード', 'チャットのプレビュー'] },
      }}
      closing={{ title: '同じ質問への返事を、LINEに任せませんか', body: 'キーワード応答は、無料プランで10件まで使えます。' }}
    />
  )
}
