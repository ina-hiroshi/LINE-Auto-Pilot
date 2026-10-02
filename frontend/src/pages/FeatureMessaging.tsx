import FeaturePage from '../components/site/FeaturePage'
import { AppWindow, Screenshot } from '../components/site/AppScreens'
import { DraftComposer } from '../components/site/demos/OtherDemos'
import featureMessagingImage from '../assets/feature-messaging.png'

export default function FeatureMessaging() {
  return (
    <FeaturePage
      slug="messaging"
      title={
        <>
          お知らせの文章は、
          <br />
          AIが下書きします
        </>
      }
      lead="「久しぶりのお客様に来てほしい」のように目的を書くと、AIが文章の案をいくつか作ります。選んだ案を手直しして、登録しているお客様全員か、条件で絞ったお客様にLINEで送れます。"
      hero={<DraftComposer />}
      heroTry="AIが作った案から、使う文章を選べます"
      gains={[
        { title: '文章に悩む時間が減る', body: '目的とトーンを選ぶだけで、AIが配信文の案を複数出します。', pro: true },
        { title: '届けたいお客様にだけ送れる', body: '来店の頻度や利用したメニューで絞り込み、必要なお客様にだけお知らせできます。' },
        { title: '送った内容を振り返れる', body: '過去の配信の内容と結果が残るので、次の配信に活かせます。' },
      ]}
      showcases={[
        {
          title: '実際の管理画面です',
          lead: '配信は「配信対象」「メッセージ」「確認・配信」の3つの手順で進みます。AIの案を選ぶと本文に入り、そのあと自由に書き直せます。',
          body: (
            <div className="max-w-3xl">
              <AppWindow note="実際の管理画面（メッセージ配信）">
                <Screenshot src={featureMessagingImage} alt="配信の目的、盛り込みたい内容、文章のトーンを入力し、AIが作った案1が表示されている画面" />
              </AppWindow>
            </div>
          ),
        },
      ]}
      steps={[
        { title: '送る相手を選ぶ', body: '全員に送るか、条件で絞り込むかを選びます。' },
        { title: '文章を作る', body: '自分で書くか、AIに下書きを頼みます。', pro: true },
        { title: '確かめて送る', body: '内容を確かめて、配信します。' },
      ]}
      planNote="配信は無料プランでも使えます。AIによる下書きはProプランの機能です。"
      closing={{ title: 'お知らせも、LINEひとつで', body: 'メッセージ配信は、無料プランから使えます。' }}
    />
  )
}
