import FeaturePage from '../components/site/FeaturePage'
import { CardStudio, MemberCardPhone } from '../components/site/demos/MemberDemos'
import { AppWindow, Screenshot } from '../components/site/AppScreens'
import { CustomerTableMini } from '../components/site/demos/OtherDemos'
import featurePointsImage from '../assets/feature-points.png'

export default function FeatureMembership() {
  return (
    <FeaturePage
      slug="membership"
      title={
        <>
          お客様のLINEが、
          <br />
          そのまま会員証になります
        </>
      }
      lead="紙のカードを作らなくても、お客様のLINEでお店の会員証を開けます。ポイントカードにもスタンプカードにもでき、お会計では会員証のQRコードを読み取るだけでポイントを付けられます。"
      hero={<MemberCardPhone />}
      gains={[
        { title: 'カードを刷って配る手間がかからない', body: '会員証はお客様のLINEの中にあるので、紙のカードを用意する必要がありません。' },
        { title: 'お客様がカードを忘れる心配がない', body: 'スマートフォンさえあれば、いつでも会員証を出せます。付けそびれるポイントも減ります。' },
        { title: 'また来たくなるきっかけになる', body: 'ポイントやスタンプが貯まっていると、次の来店の後押しになります。' },
        { title: '常連のお客様に特別感を出せる', body: 'Bronze・Silver・Goldのランクで、通ってくださるお客様を分けられます。', pro: true },
      ]}
      showcases={[
        {
          title: 'お会計は、会員証を見せてもらうだけ',
          lead: 'お客様がLINEの会員証を開き、お店は管理画面の「会員証読取」でQRコードを読み取ります。そのまま、そのお客様のページでポイントを付けられます。',
          body: (
            <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <AppWindow note="管理画面の顧客一覧。右上の「会員証読取」からQRコードを読み取ります（表示例）">
                <CustomerTableMini />
              </AppWindow>
              <AppWindow note="実際の管理画面（読み取ったお客様のポイント管理）">
                <Screenshot src={featurePointsImage} alt="顧客詳細のポイント管理画面。1,250ptの残高と、付与する・利用するの切り替え" />
              </AppWindow>
            </div>
          ),
        },
        {
          title: '会員証のデザインは4種類から',
          lead: 'シンプル、ダーク、エレガント、ポップの4種類から選べます。ポイントカードとスタンプカードのどちらの形でも使えます。ここに出している会員証は、お客様が実際に見るものと同じ見た目です。',
          body: <CardStudio />,
          interactive: true,
        },
      ]}
      steps={[
        { title: 'デザインを選ぶ', body: 'テンプレートを選び、お店の色とロゴを設定します。', pro: true },
        { title: 'ポイントかスタンプかを決める', body: 'ポイント制かスタンプ制かを選び、付け方のルールを決めます。' },
        { title: 'QRコードで運用を始める', body: 'お客様の会員証のQRコードを読み取るだけで、ポイントを付けたり使ったりできます。' },
      ]}
      plans={{
        free: { name: '基本のポイントカード', items: ['ポイント・スタンプの管理', 'QRコードでの付与と利用', '会員証の表示（シンプル）', '会員番号の表示', 'LINEの名前での表示'] },
        pro: { name: 'デザインとランク', items: ['無料プランの機能すべて', 'カードのテンプレート選択', 'お店の色の設定', 'ロゴ画像のアップロード', 'ランク機能（Bronze・Silver・Gold）', 'カードの見出しの変更'] },
      }}
      closing={{ title: '紙のカードを、LINEの会員証に', body: 'ポイントカードの基本機能は、無料プランで使えます。' }}
    />
  )
}
