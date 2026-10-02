import FeaturePage from '../components/site/FeaturePage'
import { AppWindow, ReservationListMini } from '../components/site/AppScreens'
import { LineTalk, PhoneFrame, ReservationFlex } from '../components/site/LinePhone'
import { BookingFlowPhone, WeekCalendarMini } from '../components/site/demos/ReservationDemos'

export default function FeatureReservation() {
  return (
    <FeaturePage
      slug="reservation"
      title={
        <>
          電話を受けなくても、
          <br />
          LINEから予約が入ります
        </>
      }
      lead="お客様は、LINEのトーク画面の下にあるメニューから予約ページを開き、担当・メニュー・日時を選んで予約します。施術中に電話に出る必要がなくなり、電話が苦手なお客様も気軽に予約できます。"
      hero={<BookingFlowPhone />}
      gains={[
        { title: '施術中に電話に出なくて済む', body: '予約はLINEで入るので、手を止めて電話を取る必要がありません。' },
        { title: '電話が苦手なお客様も予約しやすい', body: 'LINEなら、お客様は思い立ったときに時間を気にせず予約できます。' },
        { title: '予約の重なりを防げる', body: 'Googleカレンダーと連携すると、ほかの予定が入っている時間には予約が入りません。', pro: true },
      ]}
      showcases={[
        {
          title: '予約が入ると、お客様のLINEに確認が届きます',
          lead: 'お客様のトークには、日時・メニュー・担当を書いた確認のメッセージが届きます。メッセージのボタンから、お客様が自分で予約の確認や変更もできます。',
          body: (
            <div className="grid items-center gap-10 md:grid-cols-[auto_1fr]">
              <PhoneFrame className="mx-auto w-[17.5rem] sm:w-[18.5rem]">
                <LineTalk
                  showRichMenu={false}
                  height="h-[27rem]"
                  messages={[
                    { id: 'f1', from: 'shop', body: <ReservationFlex date="10月2日（木）" time="14:00〜15:00" menu="カット" staff="田中" /> },
                  ]}
                />
              </PhoneFrame>
              <AppWindow note="管理画面の予約一覧（表示例）">
                <ReservationListMini />
              </AppWindow>
            </div>
          ),
        },
        {
          title: '入った予約は、一覧とカレンダーで確かめられます',
          lead: '管理画面では、入った予約を一覧で見られます。Proプランでは、日・週・月のカレンダー表示とGoogleカレンダーとの同期も使えます。',
          body: (
            <AppWindow note="管理画面のカレンダー表示（表示例・Pro）">
              <WeekCalendarMini />
            </AppWindow>
          ),
        },
      ]}
      steps={[
        { title: '予約の枠を決める', body: '営業時間、予約を受ける時間の枠、メニューごとの所要時間を設定します。' },
        { title: 'リッチメニューに予約ボタンを置く', body: 'LINEのトーク画面の下に、予約ページを開くボタンを置きます。' },
        { title: 'Googleカレンダーとつなぐ', body: 'Googleアカウントと連携すると、カレンダーの予定と予約が同期されます。', pro: true },
      ]}
      plans={{
        free: { name: '基本の予約管理', items: ['予約管理（件数の上限なし）', 'LINEからの予約受付', '予約の確認・変更・キャンセル', '予約の一覧表示'] },
        pro: { name: 'カレンダー連携', items: ['無料プランの機能すべて', 'Googleカレンダー連携', 'Googleカレンダーとの双方向の同期', 'カレンダー表示（日・週・月）', '予約の重なりの防止'] },
      }}
      closing={{ title: '予約の電話を、LINEに任せませんか', body: '予約管理は、無料プランでも件数の上限なく使えます。' }}
    />
  )
}
