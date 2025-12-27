import { ExternalLink, MessageSquare } from 'lucide-react'

interface GuideTabProps {
  webhookUrl: string
  onCopyWebhook: () => void
  onNavigateConnection: () => void
}

export function GuideTab({ webhookUrl, onCopyWebhook, onNavigateConnection }: GuideTabProps) {
  return (
    <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-6 pb-2 border-b">
        <MessageSquare className="text-[#06C755]" size={24} />
        <h2 className="text-xl font-bold text-gray-800">導入ガイド</h2>
      </div>
      <div className="space-y-8">
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
            <span className="bg-[#06C755] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span>
            LINE公式アカウントの作成
          </h3>
          <p className="text-sm text-gray-600 mb-4 ml-8">
            まだLINE公式アカウントをお持ちでない場合は、以下のリンクから作成してください。
            すでにお持ちの方はスキップしてください。
          </p>
          <div className="ml-8">
            <a
              href="https://www.linebiz.com/jp/entry/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[#06C755] hover:underline font-medium"
            >
              LINE公式アカウント開設ページ <ExternalLink size={16} />
            </a>
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
            <span className="bg-[#06C755] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">2</span>
            LINE Developersへの登録とチャネル作成
          </h3>
          <p className="text-sm text-gray-600 mb-4 ml-8">
            Messaging APIを利用するために、LINE Developersへの登録が必要です。
          </p>
          <ol className="list-decimal list-inside text-sm text-gray-600 ml-8 space-y-2 mb-4">
            <li><a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer" className="text-[#06C755] hover:underline">LINE Developers Console</a>にログインします。</li>
            <li>初めての場合は「プロバイダー作成」を行います（店舗名などでOK）。</li>
            <li>「新規チャネル作成」をクリックし、「Messaging API」を選択します。</li>
            <li>必要な情報を入力してチャネルを作成します。</li>
          </ol>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
            <span className="bg-[#06C755] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">3</span>
            設定情報の取得と入力
          </h3>
          <p className="text-sm text-gray-600 mb-2 ml-8">
            作成したチャネルの「チャネル基本設定」および「Messaging API設定」タブから以下の情報を取得し、
            <button onClick={onNavigateConnection} className="text-[#06C755] hover:underline font-medium mx-1">接続設定</button>
            に入力してください。
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 ml-8 space-y-1">
            <li><strong>Channel ID</strong> (チャネル基本設定タブ)</li>
            <li><strong>Channel Secret</strong> (チャネル基本設定タブ)</li>
            <li><strong>Channel Access Token</strong> (Messaging API設定タブ &gt; チャネルアクセストークン発行)</li>
          </ul>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
            <span className="bg-[#06C755] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">4</span>
            Webhookの設定
          </h3>
          <p className="text-sm text-gray-600 mb-4 ml-8">LINEからのメッセージを受け取るための設定を行います。</p>
          <ol className="list-decimal list-inside text-sm text-gray-600 ml-8 space-y-2">
            <li>
              以下の <strong>Webhook URL</strong> をコピーします。
              <div className="flex gap-2 mt-2 mb-2">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="w-full p-2 border rounded-lg bg-white text-gray-600 outline-none text-xs"
                />
                <button
                  type="button"
                  onClick={onCopyWebhook}
                  className="px-3 py-1 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-xs whitespace-nowrap"
                >
                  コピー
                </button>
              </div>
            </li>
            <li>LINE Developers Consoleの「Messaging API設定」タブを開きます。</li>
            <li>「Webhook設定」の「編集」をクリックし、コピーしたURLを貼り付けて「更新」します。</li>
            <li><strong>「Webhookの利用」をオン</strong>にします。</li>
            <li>「検証」ボタンを押して、成功することを確認します。</li>
          </ol>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
            <span className="bg-[#06C755] text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">5</span>
            応答設定の変更
          </h3>
          <p className="text-sm text-gray-600 mb-4 ml-8">
            LINE公式アカウントの自動応答と競合しないように設定を変更します。
          </p>
          <ol className="list-decimal list-inside text-sm text-gray-600 ml-8 space-y-2">
            <li>LINE Developers Consoleの「Messaging API設定」タブにある「LINE公式アカウント機能」の「応答メッセージ」をクリックします（LINE Official Account Managerが開きます）。</li>
            <li>「応答設定」で以下のように設定します。
              <ul className="list-disc list-inside ml-4 mt-1 text-gray-500">
                <li><strong>応答メッセージ</strong>: オフ</li>
                <li><strong>Webhook</strong>: オン</li>
              </ul>
            </li>
          </ol>
        </div>
      </div>
    </section>
  )
}
