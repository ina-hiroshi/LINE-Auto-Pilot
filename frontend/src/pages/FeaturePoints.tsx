import FeaturePage from '../components/site/FeaturePage'
import { AppWindow, Screenshot } from '../components/site/AppScreens'
import { PointsPlayground } from '../components/site/demos/MemberDemos'
import featurePointsImage from '../assets/feature-points.png'

export default function FeaturePoints() {
  return (
    <FeaturePage
      slug="points"
      title={
        <>
          ポイントを付けるのは、
          <br />
          数字を入れて押すだけ
        </>
      }
      lead="お客様のページを開き、付けるポイント数を入れて「実行」を押せば終わりです。お客様はLINEの会員証を見せるだけです。ポイントを使うときも、同じ画面で差し引けます。スタンプカードの形にも切り替えられます。"
      hero={<PointsPlayground />}
      wideHero
      heroTry="ポイント数を入れて「実行」を押してください"
      gains={[
        { title: 'また来るきっかけになる', body: 'ポイントやスタンプが貯まっていると、次の来店の後押しになります。' },
        { title: '紙のカードの管理がいらない', body: 'なくしたり忘れたりする心配がなく、お店でポイントを数え直す手間もかかりません。' },
        { title: 'ポイントとスタンプを選べる', body: 'ポイント制とスタンプ制のどちらでも、同じ画面で運用できます。' },
      ]}
      showcases={[
        {
          title: '実際の管理画面です',
          lead: '顧客詳細ページの「ポイント管理」です。上の体験と同じく、「付与する」か「利用する」を選び、数字を入れて実行します。',
          body: (
            <AppWindow note="実際の管理画面（顧客詳細のポイント管理）">
              <Screenshot src={featurePointsImage} alt="顧客詳細のポイント管理画面。1,250ptの残高と、付与する・利用するの切り替え、ポイント数の入力欄と実行ボタン" />
            </AppWindow>
          ),
        },
      ]}
      steps={[
        { title: 'ポイントかスタンプかを選ぶ', body: 'お店に合う形を選び、付け方のルールを決めます。' },
        { title: 'お会計で会員証を読み取る', body: '管理画面の「会員証読取」から、お客様の会員証のQRコードを読み取ります。' },
        { title: '数字を入れて実行する', body: '付けるポイント数か使うポイント数を入れて「実行」を押します。' },
      ]}
      planNote="ポイントの付与と利用は、無料プランで使えます。会員証のデザインやランク機能はProプランの機能です。"
      closing={{ title: 'ポイントカードも、LINEひとつで', body: 'ポイントの基本機能は、無料プランから使えます。' }}
    />
  )
}
