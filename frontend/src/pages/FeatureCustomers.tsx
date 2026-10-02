import FeaturePage from '../components/site/FeaturePage'
import { AppWindow, Screenshot, TreatmentMemo } from '../components/site/AppScreens'
import { CustomerTableMini } from '../components/site/demos/OtherDemos'
import featureCustomersImage from '../assets/feature-customers.png'

export default function FeatureCustomers() {
  return (
    <FeaturePage
      slug="customers"
      title={
        <>
          お客様ごとの記録を、
          <br />
          その場で見返せます
        </>
      }
      lead="ポイント残高と最終来店日は、お客様の一覧でひと目でわかります。お客様のページには来店ごとの施術メモを残せるので、担当が替わっても前回の内容を確かめてから接客できます。"
      hero={
        // 施術メモは一覧の下端にだけ重ね、一覧の行を隠さない。スマホでは重ねずに下へ置く
        <div>
          <AppWindow>
            <CustomerTableMini />
          </AppWindow>
          <div className="relative ml-auto mt-3 w-[92%] max-w-sm sm:-mr-4 sm:-mt-4 sm:w-[70%]">
            <AppWindow label="顧客詳細 / 施術メモ">
              <TreatmentMemo />
            </AppWindow>
          </div>
        </div>
      }
      gains={[
        { title: '誰が対応しても、同じように接客できる', body: '施術メモが残っているので、初めて担当するスタッフも前回の内容を踏まえて接客できます。' },
        { title: 'フォローするお客様を決めやすい', body: '一覧でポイント残高と最終来店日を見て、しばらく来ていないお客様にすぐ気づけます。' },
        { title: '会員証から、すぐにお客様のページを開ける', body: 'お客様のLINE会員証のQRコードを読み取ると、そのお客様のページが開きます。' },
      ]}
      showcases={[
        {
          title: '施術メモは、来店ごとに残せます',
          lead: '顧客詳細ページの「施術メモ」タブでは、予約ごとに内容を記録できます。次に来店されたときは、前回のメモを見てから接客を始められます。',
          body: (
            <div className="grid items-start gap-8 lg:grid-cols-[0.8fr_1.2fr]">
              <AppWindow note="管理画面の施術メモ（表示例）">
                <TreatmentMemo />
              </AppWindow>
              <AppWindow note="実際の管理画面（顧客一覧）">
                <Screenshot src={featureCustomersImage} alt="顧客一覧の画面。本名、LINE名、ポイント残高、最終来店日、ステータスの列" />
              </AppWindow>
            </div>
          ),
        },
      ]}
      planNote="顧客一覧と施術メモは、無料プランから使えます。"
      closing={{ title: 'お客様の記録も、LINEとひとつに', body: '顧客管理は、無料プランから使えます。' }}
    />
  )
}
