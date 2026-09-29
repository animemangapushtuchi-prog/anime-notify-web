@AGENTS.md

# アニミル！（anime-notify-web）

作業を始める前に必ず `docs/HANDOFF.md` を読むこと（サービス概要・禁止事項・運用手順・未完了タスク）。

@docs/HANDOFF.md

## 最重要ルール（抜粋）
- 変更前に、何をするかを平易な日本語でユーザーに説明する
- `git reset --hard` / `git checkout --` / ユーザー変更の巻き戻しは禁止
- 別リポジトリ `../anime_notify_app`（Functions・firestore.rules）では `git add -A` 禁止
- シークレット・管理者UID・キーをコミットしない
- 配信情報を推測で書かない。Prime Video / Netflix は自動確定しない
- ナビを追加するときは `components/Sidebar.tsx` と `components/BottomTabs.tsx` の両方
- `scripts/*.ps1` は ASCII のみ
