// 記事「2027年冬アニメの続編、前作はどこで見れる？」を、公開中の配信データと放送予定から作る。
// 数字はすべてデータから計算する（手で書き写さない）。配信先は確認済みの行だけ。評価は書かない。
// 使い方: node scripts/gen-winter-2027-sequels.js [--write]
// （サイト本体ではなく手元で動かす Node のスクリプトなので require を使う）
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");

const OUT = "C:/Users/numas/dev/anime-notify-web/content/osusume/2027-fuyu-zokuhen-zensaku.json";
const WRITE = process.argv.includes("--write");
const UPDATED = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const AS_OF = `${Number(UPDATED.slice(0, 4))}年${Number(UPDATED.slice(5, 7))}月${Number(UPDATED.slice(8, 10))}日`;
const BASE = "https://firestore.googleapis.com/v1/projects/anime-notify-app-86ccc/databases/(default)/documents/seasonStreamingPublic";
const SEASONS = ["catalog", "2026-winter", "2026-spring", "2026-summer", "2026-fall", "2027-winter"];

// 続編 → 前作（AniList の前作のつながり。シリーズで分かれているものは手で足す）
const EXTRA = {
  189323: [176508, 151970], // シャングリラ・フロンティア：2nd と 1st
  213752: [199547], // マリッジトキシン
  204363: [177709, 184237], // SAKAMOTO DAYS：第1クールと第2クール
  209980: [153845], // いせれべ：AniList の前作はスペシャルなので TV 版を見る
};

const STATUS_SKIP = new Set([170110]); // いせれべのスペシャル（配信案内の対象ではない）

const monthDay = (s) => {
  const [, m, d] = s.match(/^\d{4}-(\d{2})(?:-(\d{2}))?$/);
  return d ? `${Number(m)}月${Number(d)}日` : `${Number(m)}月`;
};

(async () => {
  const plan = JSON.parse(fs.readFileSync("C:/Users/numas/dev/anime-notify-web/content/upcoming/2027-winter.json", "utf8"));
  const tv = plan.works.filter((w) => w.kind === "tv");

  // 前作のつながり
  const Q = `query($ids:[Int]){Page(perPage:50){media(id_in:$ids){id relations{edges{relationType node{id type format title{native}}}}}}}`;
  const j = await (await fetch("https://graphql.anilist.co", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query: Q, variables: { ids: tv.map((w) => w.id) } }) })).json();
  const pre = new Map();
  for (const m of j.data.Page.media) {
    const list = m.relations.edges.filter((e) => e.relationType === "PREQUEL" && e.node.type === "ANIME" && !STATUS_SKIP.has(e.node.id)).map((e) => e.node.id);
    if (list.length) pre.set(m.id, list);
  }
  for (const [id, list] of Object.entries(EXTRA)) pre.set(Number(id), [...new Set([...list, ...(pre.get(Number(id)) ?? [])])]);

  // 公開中の配信データ（作品ごと）
  const rows = new Map();
  for (const k of SEASONS) {
    const d = await (await fetch(`${BASE}/${k}`)).json();
    for (const v of d.fields?.entries?.arrayValue?.values ?? []) {
      const f = v.mapValue.fields;
      const id = Number(f.anilistId.integerValue);
      const name = f.serviceName?.stringValue;
      const r = rows.get(id) ?? { title: f.title?.stringValue, names: new Set(), keys: new Set() };
      if ((f.availability?.stringValue ?? "") !== "rental") {
        r.names.add(name);
        r.keys.add(f.serviceKey.stringValue);
      }
      rows.set(id, r);
    }
  }

  // 前作の作品名（配信データに無い作品のぶんも）
  const allPre = [...new Set([...pre.values()].flat())];
  const Q2 = `query($ids:[Int]){Page(perPage:50){media(id_in:$ids){id title{native}}}}`;
  const j2 = await (await fetch("https://graphql.anilist.co", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query: Q2, variables: { ids: allPre } }) })).json();
  const nameOf = new Map(j2.data.Page.media.map((m) => [m.id, m.title.native]));

  const list = tv.filter((w) => pre.has(w.id)).map((w) => ({ ...w, pre: pre.get(w.id).map((id) => ({ id, t: nameOf.get(id), names: [...(rows.get(id)?.names ?? [])], keys: [...(rows.get(id)?.keys ?? [])] })) }));
  const known = list.filter((w) => w.pre.some((p) => p.names.length));
  const unknown = list.filter((w) => !w.pre.some((p) => p.names.length));

  const short = (names) => (names.length > 4 ? `${names.slice(0, 4).join("・")} ほか${names.length - 4}社` : names.join("・") || "確認中");
  const table = {
    head: ["続編", "放送開始", "前作", "前作の配信先"],
    rows: list.flatMap((w) => w.pre.map((p, i) => [i === 0 ? w.title : "", i === 0 ? monthDay(w.start) : "", p.t, short(p.names)])),
    note: `${AS_OF}時点。社数は各公式サイト・配信サービスの作品ページで確かめたものだけを数えています。ここに無いサービスでも配信されている場合があります。`,
  };

  // どのサービスなら前作をいちばん多く見られるか（続編の単位で数える：その続編の前作がすべて見られるとき1と数える）
  const cover = new Map();
  for (const w of known) {
    const seen = w.pre.filter((p) => p.names.length);
    const keys = new Set(seen[0].keys);
    for (const p of seen) for (const k of [...keys]) if (!p.keys.includes(k)) keys.delete(k);
    for (const k of keys) {
      const n = seen[0].names[seen[0].keys.indexOf(k)];
      cover.set(n, (cover.get(n) ?? 0) + 1);
    }
  }
  const ranking = [...cover.entries()].sort((a, b) => b[1] - a[1]);
  const bars = ranking.slice(0, 6).map(([label, value]) => ({ label, value, max: known.length, suffix: "作品" }));
  const top = ranking[0];
  const topTied = ranking.filter((r) => r[1] === top[1]).map((r) => r[0]);

  const a = {
    title: `2027年冬アニメの続編、前作はどこで見れる？【${list.length}作品】`,
    description: `2027年1月から放送される続編${list.length}作品について、前のシーズンの配信先をまとめました。各作品の公式サイトと配信サービスの作品ページで確かめた情報だけを載せています。`,
    intro: `2027年冬（1月〜）に放送される続編のうち、前作が分かる${list.length}作品について、前のシーズンがどこで見られるかをまとめました（${AS_OF}時点）。\n\n放送が始まる前に見返したい人のための一覧です。作品の評価はしていません。続編そのものの配信先は、発表され次第「2027年冬アニメ 放送日一覧」に追加します。`,
    updatedAt: UPDATED,
    tags: ["2027年冬", "続編", "配信"],
    thumb: { label: "2027年冬の続編", sub: "前作はどこで見れる？", stat: `${list.length}作品`, color: "#2B2750", workIds: known.flatMap((w) => w.pre.map((p) => p.id)).slice(0, 5) },
    body: [
      {
        heading: "調べ方",
        text: `2027年冬の作品のうち、公式サイトで放送時期を確かめられた作品から、AniList に前作のつながりが登録されている続編を選びました。\n\n続編の公式サイトには前のシーズンの配信案内が残っていることがあります。これは続編の配信先ではありませんが、前作の配信先としては正しい情報です。そこで、続編の配信先としては使わず、前作の情報として載せています。`,
      },
      {
        heading: "続編と前作の配信先の一覧",
        table,
      },
      ...(bars.length
        ? [
            {
              heading: "1社でいちばん多く前作を見られるサービス",
              text: `配信先を確認できた${known.length}作品のうち、前作をいちばん多く見られるのは${topTied.join("・")}で、${top[1]}作品でした。`,
              bars: { items: bars, note: "複数シーズンある作品は、確認できた前作をすべて見られるときに1作品と数えています。" },
            },
          ]
        : []),
      {
        heading: "続編ごとの放送開始",
        works: { ids: list.map((w) => w.id) },
        text: list
          .map((w) => `${w.title}：${monthDay(w.start)}${w.tv ? `から${w.tv}` : "から放送"}`)
          .join("\n"),
      },
      ...(unknown.length
        ? [
            {
              heading: "前作の配信先を確認できていない作品",
              text: `${unknown.map((w) => w.title).join("、")}は、前作の配信先をまだ確認できていません。確認でき次第、追加します。`,
            },
          ]
        : []),
    ],
    faq: [
      { q: "2027年冬アニメの続編は何作品ありますか？", a: `アニミル！が公式サイトで放送時期を確かめた作品のうち、前作が分かる続編は${list.length}作品です（${AS_OF}時点）。` },
      ...(top ? [{ q: "前作をまとめて見るならどのサービスがいいですか？", a: `確認できた${known.length}作品のうち、いちばん多く見られるのは${topTied.join("・")}で${top[1]}作品です。` }] : []),
      { q: "続編の配信先はいつ分かりますか？", a: "多くの作品は放送の少し前に発表されます。発表され次第「2027年冬アニメ 放送日一覧」に追加します。" },
    ],
    entries: [],
  };

  console.log(a.title);
  console.log("配信先あり", known.length, "／未確認", unknown.map((w) => w.title).join("、"));
  console.log(ranking.slice(0, 6).map((r) => r.join(" ")).join(" / "));
  if (!WRITE) return console.log("確認のみ。書き込むときは --write");
  fs.writeFileSync(OUT, JSON.stringify(a, null, 2) + "\n");
  console.log("書き込みました");
})();
