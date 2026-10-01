# アニミル！ 引き継ぎ資料（Claude Code 向け）

最終更新: 2026-09-29 ／ 前任: Claude Code セッション（SEO・完成度の一括改修）

このファイルは「このリポジトリで次に作業する AI / 開発者」が最初に読む前提で書いています。
運営者（ユーザー）は **シン**。非エンジニア寄りなので、**変更前に何をするか平易な日本語で説明すること**
（過去に「説明もなしに意味の分からないことをしないで」と指摘あり）。

---

## 1. サービス概要

- **アニミル！（Animiru）** — アニメの放送・配信の新着を通知する Web サービス
- 本番: https://www.animiru.com （canonical は必ず `www` 付き）
- リポジトリ: `animemangapushtuchi-prog/anime-notify-web`（main に push → Vercel が自動デプロイ）
- 主な機能: 作品登録→新話の放送/配信をプッシュ通知、マイリスト、放送カレンダー、検索、
  **今期配信一覧 `/streaming`**、**おすすめ記事 `/osusume`**、管理画面 `/admin/streaming`

## 2. 技術スタック

| 項目 | 内容 |
|---|---|
| フレームワーク | **Next.js 16.2.10**（App Router）。`params` は Promise（`await params`）。**AGENTS.md の注意どおり、書く前に `node_modules/next/dist/docs/` を確認** |
| スタイル | Tailwind（任意値クラス `text-[#C2772A]` を多用） |
| バックエンド | Firebase（プロジェクト `anime-notify-app-86ccc`）Auth / Firestore / Cloud Functions（asia-northeast1）/ FCM |
| 外部データ | AniList GraphQL（作品・表紙）、しょぼいカレンダー（放送枠）、Wikipedia（あらすじ、照合済みのみ） |
| ホスティング | Vercel |

### 別リポジトリ（触るときは要注意）
`C:\Users\numas\dev\anime_notify_app`（旧 Flutter アプリ＋ **firestore.rules ＋ Cloud Functions**）
- Flutter/Dart/旧Hosting は**触らない**
- Functions リポジトリでは **`git add -A` 禁止**。変更したファイルだけ stage
- `firestore.rules` 変更後は `firebase deploy --only firestore:rules`

## 3. 絶対に守るルール

- `git reset --hard` / `git checkout --` / ユーザーの変更の削除 は禁止
- `lib/login.ts`, `lib/works.ts` などはユーザー側でも編集されている。**差分があっても勝手に戻さない**
- シークレット・管理者UID・APIキー・トークンをコミットしない（管理者UIDは Vercel の環境変数 `NEXT_PUBLIC_ADMIN_UIDS`）
- 配信情報は**推測で書かない**（タイトルからサービスや日付を推測しない、偽リンクを作らない）
- ~~Prime Video / Netflix は候補から一括で自動確定しない~~ → **2026-09-29 に運営者の判断で撤廃**（個別確認の件数が多く手間なため）。
  `MANUAL_ONLY_SERVICES` は空配列。戻す場合は `["prime-video", "netflix"]` に戻す
- お金がかかる仕組み（有料API・課金・新規アカウント）は、作る前に金額・理由・無料の代替案を説明して了承を取る
- ログイン必須ページのスクレイピング、CAPTCHA回避、大量クロール、非公式APIの利用は禁止
- 公式の説明文・画像を転載しない（表紙は AniList の画像を表示するのみ）

## 4. ブランド / デザイン

- テーマ色: アンバー `#C2772A`（淡色 `#F6E9D5` `#FBF3E6`、濃色 `#8A5518`）
  - **塗りつぶし（ボタン等）は `#A8621F`**：白文字とのコントラストが `#C2772A` だと 3.5:1 で
    WCAG AA（4.5:1）に届かないため。`#A8621F` で 4.7:1。ロゴ・見出しの文字色は `#C2772A` のまま
  - **11〜12px の小さい文字に `#C2772A` は使わない**（白背景で 3.5:1）。`#8A5518` を使う（6.2:1）
- ロゴ: `components/Logo.tsx`（マスコット顔＋「アニミル」＋赤い「！」`#C0392B`）
- マスコット: `components/Mascot.tsx`（pose: stand / point / thumbsup / surprised / worried / cheer / search / sit / device / sleep / face 等）。
  **表示は軽量版 `public/mascot/w/{pose}.webp`**（1枚 9〜41KB。元の PNG は最大1.3MB あり、ロゴにも使われていた）。
  ポーズを足すときは PNG を置いてから sharp で WebP（高さ560px・quality 84、face は192px）を作る

### 2026-10 デザイン刷新（コンセプト「夜のアニメを見張るミーアキャット」）
- 深夜アニメが多いこと／ミーアキャットは群れの見張り番／首の鈴＝通知、をサイトの物語にしている。
  トップの見出し・作品ページの上部・記事の見出し・フッター・404 は夜空（`bg-night`＋`.starfield`）、それ以外は紙の背景
- **色は `app/globals.css` の `@theme` にトークンがある**：`paper`（背景）`paper-2` `line`（罫線）`ink`（文字）`ink-2`（補足の文字）
  `amber` `amber-deep`（塗り）`amber-ink`（小さい文字）`amber-soft` `amber-wash` `bell`（夜の上の金色）`night` `night-2` `night-3` `collar`。
  新しく書くときは `text-[#...]` ではなく `text-ink` などを使う（古い部品はまだ16進のまま。灰色は温かい色に置換済み）
- **フォント**：本文は端末の日本語フォント（通信量ゼロ）。**h1・h2 と `.font-display` だけ Zen Kaku Gothic New の 900**（`app/layout.tsx`）。
  本文まで web フォントにしたら太さ4種類で約4.4MB（381ファイル）になったため、見出し専用・1種類に絞った（約160KB）。
  数字は `.num`（Geist・等幅数字）。見出しは `palt`（字詰め）
- 共通部品：`components/SectionHead.tsx`（節の見出し）、`components/PageHeader.tsx`（ページ上部）、`components/home/Hero.tsx`
- スクロールで出る演出は `class="reveal"`＋`components/Reveal.tsx`。**JS が無いと何もしない＝中身は必ず見える**
  （CSS だけの scroll-driven animation にしたら、画面外の節が検索エンジン・撮影で空白になったため変更）。動きを減らす設定の人には出さない
- トップの「今夜の放送」は `lib/tonight.ts`（`cache/tvSchedule` から翌朝5時まで。AniList の今期作品と題名が一致したものだけ表紙とリンクを付ける）
- SNS 共有画像は `public/og.png`（1200×630。`lib/seo.ts` の `OG_IMAGE`）。作り直すときは夜空＋ミーアキャット＋コピーの構成で
- 見た目の確認は、ローカルの本番ビルドをヘッドレス Chrome で縦長に撮影して行った（1440px と 390px）
- PC は左 `Sidebar.tsx`、モバイルは `BottomTabs.tsx`（6タブ: マイリスト/カレンダー/検索/今期配信/おすすめ/通知）
  → **ナビを増やすときは両方に追加すること**（過去に片方だけ追加して事故った）

## 5. 主要ディレクトリ

```
app/
  page.tsx                 トップ（夜空の見出し＋今夜の放送＋今期の注目など。マイリストは components/MyListHome.tsx）
  work/[id]/page.tsx       作品詳細（SSR, revalidate 3600）
  streaming/               今期配信一覧（/streaming → データがある最新シーズンへredirect）
    [seasonKey]/page.tsx
    [seasonKey]/[serviceKey]/page.tsx
  osusume/                 おすすめ記事（一覧＋[slug]）
  admin/streaming/         配信データ管理画面（管理者のみ）
  api/syobocal/route.ts    しょぼいカレンダー中継
  sitemap.ts / robots.ts
components/                UI部品（OsusumeThumb, StreamingList, StreamingLinks など）
lib/
  anilist.ts               AniList取得（fetchCovers / fetchWorkBriefs など）
  osusume.ts               記事データ層（content/osusume/*.json を読む）
  season.ts                シーズンキー計算（"2026-summer" 形式）
  seasonStreaming.ts       公開配信データ読み取り、latestSeasonKeyWithData()
  seasonAdmin.ts           管理画面用（保存・CSV取り込み・公開同期）
  seasonImport.ts          候補の自動生成（AniList＋番組表）
  streaming.ts             配信サービス定義 SERVICE_DEFS / 検索URL
content/
  osusume/                 公開中の記事 JSON（13本。2026-09-29 に見直し）
  osusume-stock/           公開待ちストック（現在 0本）
scripts/publish-articles.ps1  ストックから記事を公開するスクリプト
docs/HANDOFF.md            このファイル
```

## 6. 今期配信一覧（/streaming）の仕組み

**Firestore 構造**
- 公開: `seasonStreamingPublic/{seasonKey}`（メタ）＋ `/entries/{anilistId}_{serviceKey}`
  → `confirmed` かつ `published` のものだけが書かれる。誰でも read 可
- 管理: `seasonStreamingAdmin/{seasonKey}/entries/...`（candidate / rejected / メモ含む）。管理者のみ
- **まとめ文書（2026-09-29〜）**: 公開・保存のたびに `refreshSeasonMeta()` が公開エントリー全件を
  親文書 `seasonStreamingPublic/{seasonKey}` の `entries` 配列にまとめて書く。表示側（`getPublishedEntries`）はこれを1回読むだけ。
  以前は表示のたびにコレクションを全件読み、秋は1回の表示で581回の読み取りになっていた（Firestore 無料枠は1日5万回）。
  まとめが無いシーズンは管理画面を開くと自動で作られる（`ensureSeasonSummary`、公開内容と最終確認日は変えない）。
  1MB 制限に近づいたらまとめを作らず従来の全件読みに戻る
- **作品ページ**: 確認済み配信情報はサーバー側で読んでHTMLに入れる（`getWorkEntries`：作品自身のシーズン＋今期の前後）。
  以前はブラウザ側で「今期」だけ読んでいたため、Googleに配信情報が見えず、来期・前期の作品では表示されなかった

**運用フロー**（管理画面 `/admin/streaming`）
1. 「候補を更新」＝AniList＋しょぼカレから候補生成（全部 candidate）
2. 出典URLを集めて CSV で「貼り付けて取り込む」
   形式: `anilistId,title,serviceKey,availability,firstDate,weeklyDay,weeklyTime,sourceUrl`
3. 「出典つき候補を一括で確認済み＋公開」（全サービス対象。各行の「根拠」をざっと確認してから押す）

**公式サイトからの自動収集（2026-09-29 追加・無料）** — 管理画面の「公式サイトから候補を集める」
- AniList の作品一覧から公式サイトURL（Official Site）を取り、1作品ずつ `/api/admin/official-candidates` に送る（管理者のIDトークンを検証してから動く）
- サーバーが公式サイトのトップ＋放送/配信ページ（最大3ページ）を読む（`lib/officialSite.ts`、robots.txt 準拠・`AnimiruBot` を名乗る）
- **AI・有料APIは使わない**（ユーザー方針：お金がかかる仕組みは事前に説明と了承が必要。無断で有料サービスを前提にしない）。
  `lib/extractStreaming.ts` が決まったパターンで読む：
  - サービスはページに名前がある行だけ。1行に複数サービスが並ぶ行は日付を付けない（どれの日付か断定できないため）
  - 日付・曜日・時刻は、サービスが1つだけの行（または直後の行）に書かれているときだけ。曜日は「毎週」と明記時のみ
  - 「木曜深夜0時30分」→ 曜日=木・時刻=24:30（放送の慣習）
  - 除外：前シーズンの案内、特番・PV・一挙・YouTube などの行、シーズン期間外の日付の行、お知らせ欄の掲載日
  - 「dアニメストア for Prime Video」等の Prime Video チャンネルは Prime Video 本体として数えない
- 根拠の文は各行の sourceLabel に「公式サイト：「…」」として残り、管理画面に表示される
- 入るのは「候補」のみ。確認済みの行は空欄だけ補完
- 実測（2026-09-29、秋76作品）: 69作品読めた／候補579行（61作品）／Prime Video 53作品／開始日付き78行。
  人が確認済みの U-NEXT 13作品のうち11作品で一致（外れ2件は、JSで描画するサイトと記載なし）
- 以前の調査: AniList の配信リンクには dアニメ・ABEMA・U-NEXT が載らない（夏の正解データ108行中0行）、しょぼカレのネット配信枠は ABEMA 中心

**季節の切り替え**: `/streaming` とサイトマップは `latestSeasonKeyWithData()` で
「公開データがある最新シーズン」を選ぶ（今期から過去へさかのぼる）。
**来期の開始21日前からは、来期に公開データがあれば来期を優先する**（2026-09-29 追加。それまでは来期データを先に公開しても開始日まで切り替わらなかった）。
切り替えはページのキャッシュの関係で最大1時間遅れる。サイトマップは1つ前のシーズンの配信ページも残す。

**配信URL収集のノウハウ**（詳細は `C:\Users\numas\dev\配信URL収集_作業中.md` と `秋アニメ_配信URL収集_手順.md`）
- dアニメ: 季節ページ `animestore.docomo.ne.jp/animestore/CF/{spring|summer|fall|winter}` から JS で `workId` 一括抽出
- U-NEXT: `video.unext.jp/genre/anime` から `/title/SIDxxxx` 一括抽出。残りは `freeword?query=` 個別検索（連続でも詰まらない）
- ABEMA: `/video/genre/animation` と「新作アニメラインナップ」から。`/search` は数回で詰まる →
  番組表の slot ページ（`/channels/abema-anime/slots/XXX`）を開くと作品ページ `/video/title/XX-XXX` が取れる
- Netflix / Disney+: ブラウザより WebSearch（公式ドメイン限定）が速い
- 注意: 続編でも ABEMA/U-NEXT は1期と同じ作品ページのことがある

**夏（2026-summer）**: 42作品・111行を公開済み。
**秋（2026-fall）**: AniList に73作品。9月中旬時点では配信各社のラインナップ未公開で未着手 → **次にやる作業の候補**。

## 7. おすすめ記事（/osusume）

**記事の基準（2026-09-29 にシンさんと決定）**
- 書くのは**確かめられること**だけ：アニミル！の配信データ（サービス・開始日・独占）、公式の発表、公式サイトで確認した料金
- **作品の出来の評価は書かない**（誰も見ていない作品の「作画がすごい」「名作」などは作り話になる）。
  感想を入れるなら、シンさんが実際に見た作品についてだけ
- 数字・事実には出典と確認日を付ける。「42作品」のような数は「アニミル！が調べた数」であり、放送された全作品数ではない
- タイトルと中身を一致させる（季節を明記、「◯選」の数を合わせる）。同じ文を囲み・吹き出しで繰り返さない
- 季節の記事は、配信データから数字を計算して作る（手で書き写さない）。2026年秋の2本はこの方式

**2026-09-29 の見直し**
- 取り下げ14本（`next.config.ts` の redirects で転送）：ジャンル別おすすめ7選10本（本数と中身が不一致・評価中心）、
  夏おすすめ10選・異世界7選・続編まとめ・名作5選（見ていない作品の感想が中心）
- 追加2本：2026年秋アニメ配信サービス別まとめ、Prime Videoで見れる2026年秋アニメ
- 修正10本：料金を各社公式で確認して出典を追記（dアニメ660円/アプリ760円、ABEMA広告つき680円/なし1,180円、
  U-NEXT 2,189円/アプリ2,400円・毎月1,200pt）。dアニメの無料期間は「31日間」ではなく「初月無料」。
  出典の無い記述（映画祭ノミネート、あらすじ、U-NEXT無料期間の600pt、ABEMA見逃し「約1週間」など）を削除。
  夏の記事には「2026年夏時点の情報」の注記

- 1記事＝`content/osusume/{slug}.json`。追加して push するだけで公開・サイトマップに自動掲載
- 型は `lib/osusume.ts` の `Osusume` / `OsusumeSection`
- 使えるブロック（section 単位）: `text` / `table` / `bars`（横棒） / `works`（表紙カード, AniList ID） /
  `callout`（info/warn/tip） / `balloon`（マスコット吹き出し） / `stats`（数字カード） / `pros`（○×対比）
- `thumb`（一覧カードとヒーロー）: `label/sub/stat/color/workIds`。workIds の表紙を背景に敷く
- 目次は見出し3つ以上で自動表示

**公開スクリプト**（ユーザーが任意のタイミングで実行）
```powershell
cd $env:USERPROFILE\dev\anime-notify-web
.\scripts\publish-articles.ps1 -List      # ストック一覧
.\scripts\publish-articles.ps1            # 3本公開（updatedAt を今日に→build→commit→push）
.\scripts\publish-articles.ps1 -Count 1
```
- **ps1 は ASCII のみで書くこと**（Windows PowerShell 5.1 は BOM なし UTF-8 を ANSI として読むため壊れる）
- ストックは `NN_slug.json`。公開時に番号プレフィックスを外す
- 現在ストック 0本（12本すべて公開済み）

## 8. 広告（AdSense）

- パブリッシャー: `ca-pub-6458901222804186`（AdSense 管理は animemangapushtuchi アカウント、ブラウザでは `/u/3`）
- 2026-07-27 の審査で **「有用性の低いコンテンツ」で要確認** になった
- 対策として実施済み: 記事25本（独自実測データ中心）、未実装UI（プラン変更/プロフィール編集/アプリ版案内）の削除、
  sitemap 改善（lastModified, /streaming）
- **2026-09-29 に本当のSSR化を実施**（それまで `app/page.tsx` は "use client" のままで、
  クローラーには「読み込み中…」しか届いていなかった。§13 参照）
- `components/AdSlot.tsx` は枠IDが入るまで何も出さない（休眠状態）
- 再審査は Search Console でインデックス数が増えたのを確認してから申請する方針

## 9. SEO

- Search Console: animemangapushtuchi アカウント（`/u/3`）。サイトマップは `https://www.animiru.com/sitemap.xml`
- sitemap: 静的7ページ＋記事＋今期人気作品60件＋配信ページ（データがある時のみ）
- ログイン必須ページ（マイリスト/カレンダー/通知/設定）は sitemap に載せない
- 作品ページのタイトル: `{作品名}はどこで見れる？配信・放送情報｜アニミル！`

## 10. アカウント・権限（値はここに書かない）

- 運用系の Google サービスはすべて **animemangapushtuchi** アカウント所有
- 管理画面にログインする管理者アカウントは別（UID は Vercel 環境変数と firestore.rules の `isStreamAdmin()` に設定済み）
- パスワードや管理キーをチャットやファイルに書かない

## 11. 未完了・次の候補タスク

優先度順:

1. **秋アニメ（2026-fall）の配信データ投入** — 手順は §6。配信各社のラインナップが出揃い次第
2. **記事ページのレイアウト改善**（ユーザー保留中・未着手）
   - 問題: 作品カードが固定5列グリッドで、6枚だと2行目が1枚だけになり余白が大きい／縦長ポスターが大きすぎる／画像と文章が分離
   - 提案済みの案: A. 1枚のときは画像左・説明右の横組み、B. 枚数に応じて列数を変える、C. 画像を小さくしてバッジ（独占・無料など）を重ねる、D. 横スクロール帯
   - ユーザーの返答待ち。**勝手に実装しない**
3. 片田舎のおっさん、剣聖になるII の U-NEXT リンク（`SID0305425`）は**1期のページ**（2026-10-01 に確認：2025年・全12話。
   U-NEXT を検索しても「II」のページは見つからない）→ **2026-10-01 にシンさんの判断で現状維持（取り下げない）**。
   夏の記事の U-NEXT 35作品もそのまま
4. 新しいストック記事の作成（秋アニメ向けなど）
5. AdSense 再審査（インデックス状況を見てから）

## 12. 2026-09-29 の一括改修（SEO・完成度）

前回セッションで本番を実測したところ、次の2点が「アクセスが増えない直接の原因」だった。

1. **トップページがクローラーには空だった** — `app/page.tsx` が "use client" で、
   サーバーが返すHTMLは「アニミル！／読み込み中…」の3行だけだった
2. **サイトマップに作品ページが0件だった** — `fetchSeasonPopular()` がビルド時に
   AniListの **429（レート制限）** で失敗し、`catch {}` が黙って握りつぶしていた

### やったこと

| 対象 | 変更 |
|---|---|
| `app/page.tsx` | サーバー部品に作り直し。h1＋説明＋今期の注目アニメ24件＋配信サービス別＋記事4件を常にHTMLに出す |
| `components/MyListHome.tsx` | 旧 `app/page.tsx`（マイリスト）をそのまま移設。`<main>`→`<section>`、`<h1>`→`<h2>` |
| `lib/anilist.ts` | `anilistFetch()` を追加。429/503 で Retry-After に従って待つ＋同時実行2件まで＋全体クールダウン。`fetchPopularAroundNow()`（今期・来期・前期）を追加 |
| `app/sitemap.ts` | 作品URLを「配信データ＋記事＋AniList」の3系統から集める。AniListが落ちても0件にならない。失敗は `console.error` に残す |
| `app/osusume/[slug]/page.tsx` | JSON-LDが `itemListElement: []` だったのを修正（本文形式の記事は本文の作品から生成、無ければ BlogPosting）。URLを www 付きに。canonical・OGP画像（作品表紙）を追加 |
| 各ページ | canonical を全公開ページに追加。タイトルの「｜Animiru」を「｜アニミル！」に統一 |
| `app/*/layout.tsx`（新規7本） | "use client" のページに metadata を持たせる場所。ログイン必須ページは noindex |
| `components/Footer.tsx`（新規） | 全ページ共通フッター。利用規約・プライバシー・お問い合わせ・出典表記 |
| `app/admin/page.tsx` | URLの合言葉をやめ、`/admin/streaming` と同じ管理者UID方式に（合言葉はクライアントJSに含まれて誰でも読めていた） |
| `firestore.rules`（別リポジトリ） | `cache/*` を全公開→必要な4文書だけ公開に。`cache/stats` は管理者のみ |
| `lib/fcm.ts` | `firebase/messaging` を動的importに（初期JSから約8KB分離） |
| 全体 | 11〜12pxのテーマ色文字を `#C2772A`→`#8A5518` に（白背景で3.5:1→6.2:1。WCAG AA） |

### 確認した数値（ローカル本番ビルド）

- サイトマップ: 39URL（作品0件）→ **178URL（作品139件）**
- トップのHTML本文: 実質0 → **2099文字・作品リンク24本**
- 初期JS: 419KB → 402KB（トップ）、405KB → 388KB（/guide）

### まだ残っている課題

- ~~初期JSの大半（約390KB）は `firebase/auth` + `firestore`~~ → **2026-10-01 に Firestore を軽量版に差し替えて解消**。
  - `lib/firebase.ts` の `db` は **`firebase/firestore/lite`**（リアルタイム更新が無いだけで、読み書きの書き方は同じ）。
    サイト内の `from "firebase/firestore"` はすべて `"firebase/firestore/lite"` に変更
  - **通知ページ（`app/notifications/page.tsx`）だけは通常版**：`onSnapshot`（リアルタイム更新）を使うため、
    `lib/firebaseLive.ts` の `liveDb` と `"firebase/firestore"` の関数を組み合わせている
  - **軽量版の `db` と通常版の関数を混ぜると実行時エラーになる**（型チェックでも弾かれる）。
    新しく Firestore を使うときは `firebase/firestore/lite` から import する。リアルタイム更新が要る画面だけ `liveDb`
  - 実測（gzip、`<script src>` の合計）：/guide 389KB → 254KB、トップ 402KB → 268KB。
    このうち39KBは古いブラウザ用（`noModule`）で、今のブラウザは読み込まない。Firebase 部分は 52KB
  - ログインの処理（`lib/auth.tsx` の中身）は変えていない。Auth をさらに削る（`initializeAuth`）のは効果が10KB程度で見送り
- 配信一覧のカードは、`<a>` の中に `<a>` を入れ子にしない（以前は入れ子でハイドレーションエラー #418 が出ていた）。
  カード全体のリンクは、タイトルのリンクを `after:absolute after:inset-0` で引き伸ばして実現している
- **白文字＋`bg-[#C2772A]` のボタン**は 3.5:1 で AA 未達。濃くする（例 `#A8621F` で4.7:1）と
  ブランドの見た目が変わるため、判断待ち
- **`firestore.rules` は未デプロイ**。`cd ../anime_notify_app; firebase deploy --only firestore:rules`
  （このリポジトリでは `git add -A` 禁止。変更したファイルだけ stage）

## 12-B. 2026-fall の配信データ収集（2026-09-29 時点の調査結果）

**重要：dアニメストアの季節ページは、この時点では秋の新作ラインナップではない。**

`animestore.docomo.ne.jp/animestore/CF/fall` は「2026 AUTUMN」と表示されるが、
中身の73作品をAniListと突き合わせると：

| dアニメ「2026秋」73作品 | 件数 |
|---|---|
| AniListで FALL 2026 | 1件 |
| AniListで SUMMER 2026（7月開始） | 32件 |
| 未一致 | 40件 |

無職転生Ⅲ(7/4開始)・ヤニねこ(7/3)・株式会社マジルミエ 第2期(7/5)など、
**7月開始の夏作品が並んでいる**（2クール作品が秋にまたがる分と思われる）。
薬屋のひとりごと 第3期・ブラッククローバー 第2期・アオのハコ Season2 といった
AniListが秋と判定する作品は**1本も無い**。ここを 2026-fall として取り込んではいけない。

**U-NEXT には秋の新作が入っている。** `video.unext.jp/genre/anime` を
スクロールしながら `a[href*="/title/SID"]` を集めると230件取れ、そのうち
**SID03164xx 台が秋の新作**（薬屋3期=SID0316422 など）。
AniList FALL 2026 と完全一致したのは13件で、CSVを `~/dev/2026-fall_u-next.csv` に出した。

**ABEMA は未取得。** `/video/genre/animation` は31件しか返さずタイトルもバッジ文字列、
`/video/genre/newarrival` は0件だった。番組表の slot ページ経由（§6のノウハウ）を試すか、
ラインナップ公開後にやり直す。

**再開のしかた**
1. AniListの秋一覧は `Page(season: FALL, seasonYear: 2026, perPage:50)` を2ページ取れば94作品
2. タイトル照合は表記ゆれ（ⅡとⅢ、第二期と第2期、2nd season、全角空白、記号）を正規化して
   **完全一致だけ採用**する。部分一致で作品を決めない
3. availability・開始日・更新曜日は**ページで確認できたものだけ**書く。
   確認できなければ `unknown` と空欄のままにして、管理画面で手当てする

## 13. 作業上のコツ・過去の失敗

- **`npm test`**（2026-10-01 追加）：配信情報の抜き出しルール（`lib/extractStreaming.ts`）の確認テスト19件。
  `tests/extractStreaming.test.mjs`。追加ライブラリなし（Node 24 の標準機能）。抜き出しルールを直したら必ず通す。
  新しい読み間違いを見つけたら、その「形」を短い文に作り直してテストに足す（公式サイトの文章は転載しない）
- **`npm run lint`** はエラー0件（2026-10-01）。「effect の中の setState」19件は警告に下げてある（`eslint.config.mjs`）。
  動作の不具合ではなく、書き換えると挙動が変わりうるため。新しく書く部品では避ける
- Prime Video は公式サイトに「見放題／レンタル」の区別が書かれていないことが多い。
  配信サービス別ページと作品ページに「見る前に確認を」の注意書きを出している（availability が unknown のとき）

- ビルド確認はユーザーの PC で `npm run build`。デプロイは
  `npm run build; git add -A; git commit -m "..."; git push`（Web リポジトリのみ `-A` 可）
- PowerShell ではコマンドを `;` で区切る。`cd ...\anime-notify-web.\scripts\...` のように**スペース抜け**に注意
- 新しいナビ項目は Sidebar と BottomTabs の両方に
- 「準備中」表示・押しても動かないボタンは AdSense の減点要因。置かない
- ユーザーに URL を案内するときは `[id]` などのプレースホルダではなく**実在するURL**を示す
- 本番の状態確認は `https://www.animiru.com/...` を実際に取得して確かめる
