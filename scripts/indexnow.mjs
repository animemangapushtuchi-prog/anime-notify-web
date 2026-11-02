// サイトの更新を IndexNow（Bing など）へ知らせる。アカウント登録は不要で無料。
// 確認用のキーは public/ の .txt に置いてある（IndexNow の仕組みで公開するもの。秘密ではない）。
// 使い方: node scripts/indexnow.mjs         … 送る内容の確認だけ
//         node scripts/indexnow.mjs --send  … 本番のサイトマップの全URLを送る
import { readdirSync } from "node:fs";

const HOST = "www.animiru.com";
const key = readdirSync("public").find((f) => /^[0-9a-f]{32}\.txt$/.test(f))?.replace(".txt", "");
if (!key) throw new Error("public/ にキーのファイルがありません");

const xml = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
console.log(`${urls.length}件`, urls.slice(0, 3));
if (!process.argv.includes("--send")) process.exit(0);

// キーのファイルが本番に出ていないと受け付けられない
const check = await fetch(`https://${HOST}/${key}.txt`);
if (!check.ok) throw new Error(`キーのファイルが本番にありません（${check.status}）。デプロイの後に実行してください`);

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${key}.txt`, urlList: urls.slice(0, 10000) }),
});
console.log("IndexNow の応答:", res.status, await res.text());
