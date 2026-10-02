import FeaturePage from '../components/site/FeaturePage'
import { RichMenuBuilder } from '../components/site/demos/OtherDemos'
import { LineTalk, PhoneFrame } from '../components/site/LinePhone'

export default function FeatureRichMenu() {
  return (
    <FeaturePage
      slug="rich-menu"
      title={
        <>
          トーク画面の下に、
          <br />
          お店の入り口を置けます
        </>
      }
      lead="リッチメニューは、LINEのトーク画面の下に出るボタンの並びです。予約・問い合わせ・会員証などの行き先をボタンに割り当てると、お客様は迷わずに用事を済ませられます。Proプランでは、ボタンごとにお店の写真を置けます。"
      hero={
        <PhoneFrame className="mx-auto w-[17.5rem] sm:w-[18.5rem]">
          <LineTalk
            height="h-[22rem]"
            messages={[{ id: 'w1', from: 'shop', body: 'いらっしゃいませ。\n下のメニューからご予約いただけます。' }]}
          />
        </PhoneFrame>
      }
      gains={[
        { title: 'お客様が迷わない', body: '予約やメッセージへの入り口が、いつも画面の下に見えています。' },
        { title: '写真を置くだけで、お店らしくなる', body: 'お店の外観やメニューの写真をアップロードするだけで作れます。画像の加工はいりません。', pro: true },
        { title: 'ボタンの数や雰囲気を選べる', body: '2×2、3×2、コンパクト表示などのレイアウトと、テーマを選べます。', pro: true },
      ]}
      showcases={[
        {
          title: 'レイアウトとテーマを選んでみてください',
          lead: '左で選ぶと、右のトーク画面のメニューが切り替わります。管理画面でも、同じように画面を見ながら作れます。',
          body: <RichMenuBuilder />,
          interactive: true,
        },
      ]}
      steps={[
        { title: 'レイアウトを選ぶ', body: 'ボタンの数と並び方を選びます。', pro: true },
        { title: 'ボタンの行き先を決める', body: '予約ページ、会員証、メッセージ、ウェブサイトなどをボタンに割り当てます。' },
        { title: 'LINEに反映する', body: '保存すると、お客様のLINEのトーク画面にメニューが表示されます。' },
      ]}
      planNote="無料プランでも、シンプルなテーマの2×2でリッチメニューを作れます。ほかのレイアウト、テーマ、ボタンごとの写真はProプランの機能です。"
      closing={{ title: 'お店の入り口を、LINEの中に', body: 'リッチメニューは、無料プランから作れます。' }}
    />
  )
}
