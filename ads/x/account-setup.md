# X アカウント作成キット（2026-10-01）

アカウント作成はご本人のスマホ（Xアプリ）で行う。凍結リスクを下げるため、ブラウザ自動操作は使わない。

## 入力内容

| 項目 | 内容 |
|---|---|
| メールアドレス | itoguchi.app@gmail.com |
| 名前（表示名） | IToguchi（イトグチ）｜個人店のLINE公式 |
| ユーザー名 | `@IToguchi_app`（2026-10-01 開設） |
| 自己紹介 | 下記（100字） |
| 場所 | 空欄（または「日本」） |
| ウェブサイト | https://itoguchi-app.jp/monitor |
| アイコン | Instagramと同じ画像 |

※ Instagramのユーザー名は `itoguchi.app`。Xのユーザー名にはドット（.）が使えないため `_` に置き換えた。
※ プロフィールURL：https://x.com/IToguchi_app

自己紹介:
```
個人店のLINE公式を「予約・会員証・自動応答」まで使える状態にするツール IToguchi を作っています。モニター店舗募集中（初期設定代行が無料）→ itoguchi-app.jp/monitor
```

## 作成時の注意（凍結対策）
- 電話番号の認証まで済ませる（未認証のアカウントは制限を受けやすい）。
- 作成直後に、プロフィール編集・大量フォロー・連投をまとめて行わない。初日はプロフィール設定と #1 の投稿・固定まで。
- フォローは1日10〜20件程度に抑える（同業の個人店支援、LINE公式関連のアカウントなど）。
- 最初の約1週間は手動で1日1本（`posts-2026-10.md` の順）。その後APIによる自動投稿に切り替える。

## 自動投稿への切り替え（ならし運転のあと）
1. X Developer Console（console.x.com）にこのアカウントでログインし、アプリを作成する。
2. 権限を「Read and Write」にして、API Key / Secret と Access Token / Secret を発行する。
3. クレジットを $5 程度購入する（料金：URLなしの投稿 $0.015／本、URL入り $0.20／本。https://docs.x.com/x-api/getting-started/pricing）。
4. キーをSupabaseに保存し、`social_posts` に platform=`x` を追加して、毎晩21:00の投稿に組み込む（実装はClaude側）。
