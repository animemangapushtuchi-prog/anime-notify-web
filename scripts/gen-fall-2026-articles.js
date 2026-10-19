// 2026年秋アニメの記事2本（配信サービス別まとめ・Prime Videoの一覧）を、公開中の配信データから作り直す。
// 数字はすべてデータから計算する（手で書き写さない）。2026-09-29 版（Temp/gen_articles.js）を最新データ用に直したもの。
// あわせて「2026年秋アニメの追いかけ方」の該当段落の数字も更新する。
// 使い方: node scripts/gen-fall-2026-articles.js [--write]
// （サイト本体ではなく手元で動かす Node のスクリプトなので require を使う）
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const FT = path.join(process.env.APPDATA, "npm/node_modules/firebase-tools/lib");
const { configstore } = require(path.join(FT, "configstore"));
const auth = require(path.join(FT, "auth"));

const OUT = "C:/Users/numas/dev/anime-notify-web/content/osusume/";
const WRITE = process.argv.includes("--write");
const AS_OF = "2026年10月19日";
const UPDATED = "2026-10-19";
const BASE = "https://firestore.googleapis.com/v1/projects/anime-notify-app-86ccc/databases/(default)/documents";
const MARRONNIER_NOTE =
  "9月29日の時点では「マロニエ王国の七人の騎士」も公式サイトに「世界独占配信」と書かれていましたが、10月9日に確認すると「Prime Video で世界配信」に変わり、NHK Eテレでの放送も案内されていたため、独占の一覧から外しました。";

const v = (o) => {
  if (!o || o.nullValue !== undefined) return null;
  if (o.stringValue !== undefined) return o.stringValue;
  if (o.integerValue !== undefined) return Number(o.integerValue);
  if (o.booleanValue !== undefined) return o.booleanValue;
  return null;
};

(async () => {
  // 公開データ（誰でも読めるまとめ文書）
  const meta = await (await fetch(`${BASE}/seasonStreamingPublic/2026-fall`)).json();
  const rows = meta.fields.entries.arrayValue.values.map((x) => {
    const g = x.mapValue.fields;
    return {
      id: v(g.anilistId), t: v(g.title), svc: v(g.serviceKey), name: v(g.serviceName), av: v(g.availability),
      first: v(g.firstAvailableAt), wt: v(g.weeklyTime), ex: v(g.isExclusive) === true,
    };
  });

  // 独占の根拠文は管理用の行（sourceLabel）から取る（公開用には根拠文を置いていないため）
  const token = (await auth.getAccessToken(configstore.get("tokens").refresh_token, [])).access_token;
  const evidenceOf = {};
  for (const r of rows.filter((x) => x.ex)) {
    const d = await (await fetch(`${BASE}/seasonStreamingAdmin/2026-fall/entries/${r.id}_${r.svc}`, { headers: { Authorization: `Bearer ${token}` } })).json();
    const label = d.fields?.sourceLabel?.stringValue || "";
    evidenceOf[`${r.id}_${r.svc}`] = label.replace(/^公式サイト：「/, "").replace(/」.*$/, "").replace(/^.*?(\d{4}\.\d{2}\.\d{2}より)/, "$1").split(/(?<=[。！!])/)[0];
  }

  // AniList の秋アニメ全体の数（調べ方の説明用）
  const Q = `query ($page: Int) { Page(page: $page, perPage: 50) { pageInfo { hasNextPage }
    media(season: FALL, seasonYear: 2026, type: ANIME, format_in: [TV, TV_SHORT, ONA], isAdult: false) { id externalLinks { site } } } }`;
  const all = [];
  for (let page = 1; page <= 4; page++) {
    const j = await (await fetch("https://graphql.anilist.co", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query: Q, variables: { page } }) })).json();
    all.push(...j.data.Page.media);
    if (!j.data.Page.pageInfo.hasNextPage) break;
  }
  const anilistTotal = all.length;

  const works = new Map();
  for (const r of rows) {
    if (!works.has(r.id)) works.set(r.id, { id: r.id, t: r.t, rows: [] });
    works.get(r.id).rows.push(r);
  }
  const W = [...works.values()];
  const total = W.length;
  const has = (w, k) => w.rows.some((r) => r.svc === k);
  const md = (s) => { const d = new Date(s * 1000 + 9 * 3600e3); return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`; };
  const counts = {};
  for (const r of rows) counts[r.name] = (counts[r.name] || 0) + 1;
  const svcSorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const countOf = (k) => W.filter((w) => has(w, k)).length;
  const shortTitle = (t) => (t.length > 34 ? t.slice(0, 33) + "…" : t);
  const uniq = (a) => [...new Set(a)];
  const pct = (n) => Math.round((n / total) * 100);

  const major = ["prime-video", "u-next", "abema", "d-anime", "dmm-tv", "netflix", "hulu", "lemino"];
  const nameOf = (k) => rows.find((r) => r.svc === k).name;
  const pairs = [];
  for (let a = 0; a < major.length; a++)
    for (let b = a + 1; b < major.length; b++)
      pairs.push([`${nameOf(major[a])}＋${nameOf(major[b])}`, W.filter((w) => has(w, major[a]) || has(w, major[b])).length]);
  pairs.sort((a, b) => b[1] - a[1]);
  // 同数で並ぶ組み合わせがあれば、どれか1つを「1位」とは書かない
  const topPairs = pairs.filter((p) => p[1] === pairs[0][1]).map((p) => p[0]);
  const pairSentence = topPairs.length > 1
    ? `最も多いのは${topPairs.map((p) => `「${p}」`).join("・")}の${topPairs.length}つで、どれも${pairs[0][1]}作品でした。`
    : `最も多い組み合わせは「${topPairs[0]}」の${pairs[0][1]}作品でした。`;

  const exRows = rows.filter((r) => r.ex);
  const exWorks = uniq(exRows.map((r) => r.id));
  const exText = exRows.map((r) => `${r.name}の「${r.t}」`).join("、");

  const firstBy = new Map();
  for (const r of rows.filter((x) => x.first)) {
    const c = firstBy.get(r.id);
    if (!c || r.first < c.first) firstBy.set(r.id, { first: r.first, t: r.t, names: [r.name] });
    else if (r.first === c.first) c.names.push(r.name);
  }
  const dated = [...firstBy.values()].sort((a, b) => a.first - b.first);
  const topWorks = [...W].sort((a, b) => b.rows.length - a.rows.length).slice(0, 5).map((w) => w.id);
  const svcList = (names) => { const u = uniq(names); return u.slice(0, 3).join("・") + (u.length > 3 ? ` ほか${u.length - 3}社` : ""); };

  // 「最も多かったのは…」の文（同数かどうかで言い方を変える）
  const [s0, s1] = svcSorted;
  const topSentence = s0[1] === s1[1]
    ? `最も多かったのは${s0[0]}と${s1[0]}で、どちらも${s0[1]}作品でした。${total}作品の${pct(s0[1])}%にあたります。続いて${svcSorted.slice(2, 6).map(([n, c]) => `${n}（${c}作品）`).join("、")}です。`
    : `最も多かったのは${s0[0]}で、${s0[1]}作品でした。${total}作品の${pct(s0[1])}%にあたります。続いて${svcSorted.slice(1, 5).map(([n, c]) => `${n}（${c}作品）`).join("、")}です。`;

  const a1 = {
    title: `2026年秋アニメはどこで見れる？配信サービス別まとめ【${total}作品・Prime Video対応】`,
    description: `2026年秋アニメ${total}作品について、公式サイトに書かれた配信サービスを集計しました。サービスごとの配信本数、2社の組み合わせで見られる本数、独占配信、配信開始日をまとめています。`,
    intro: `2026年秋（10〜12月）のアニメのうち、配信先を確認できた${total}作品について、各作品の公式サイトの「放送・配信」ページに書かれている配信サービスを集計しました（${AS_OF}時点）。\n\nこの記事では、作品の出来の評価はしていません。「どこで見られるか」という事実だけをまとめています。`,
    updatedAt: UPDATED,
    tags: ["2026年秋", "配信"],
    thumb: { label: "2026年秋アニメ", sub: "どこで見れる？", stat: `${total}作品を集計`, color: "#8A5518", workIds: topWorks },
    body: [
      {
        heading: "調べ方と、数字の読み方",
        text: `AniListに登録されている2026年秋のテレビアニメ・短編・配信アニメ${anilistTotal}作品について、各作品の公式サイトを確認しました。そのうち配信先が確認できたのが${total}作品です。残りの作品は、公式サイトが自動での読み取りを断っている、配信情報が載っていない、といった理由で確認できていません。\n\nこの記事の数字は「公式サイトにそのサービス名が書かれていた作品の数」です。サービス名が文字ではなくロゴ画像で載っているサイトは、ロゴとリンク先で確認しました。見放題かレンタルか、放送の何日後から配信されるかは、公式サイトに書かれていないことが多いため、ここでは区別していません。契約する前に、見たい作品がそのサービスにあるかを作品名で確認してください。`,
        stats: { items: [
          { value: `${total}作品`, label: "配信先を確認" },
          { value: `${svcSorted.length}社`, label: "名前が出たサービス" },
          { value: `${exWorks.length}作品`, label: "「独占」と明記" },
        ] },
      },
      {
        heading: "サービスごとの配信本数",
        text: `${topSentence}\n\nNetflixは${counts["Netflix"] ?? 0}作品、Disney+は${counts["Disney+"] ?? 0}作品で、国内の配信サービスに比べると本数は少なめです。\n\nなお「dアニメストア for Prime Video」は、Prime Videoの中にある別料金のチャンネルです。Prime Videoの本数には含めていません。「アニメタイムズ」も同じくPrime Videoの中のチャンネルで、別に数えています。`,
        bars: {
          items: svcSorted.map(([n, c]) => ({ label: n, value: c, max: total, suffix: "作品" })),
          note: `${total}作品中、公式サイトにサービス名の記載があった作品数（${AS_OF}時点）`,
        },
      },
      {
        heading: "2社の組み合わせで何作品見られるか",
        text: `1社だけで全作品を見られるサービスはありませんでした。主なサービスを2社組み合わせた場合に、${total}作品のうち何作品が見られるかを数えています。${pairSentence}\n\n料金は各社で改定されることがあるため、この記事には載せていません。各サービスの公式ページで確認してください。`,
        table: { head: ["組み合わせ", "見られる作品数"], rows: pairs.slice(0, 8).map(([n, c]) => [n, `${c} / ${total}作品`]), note: "主要8サービス同士の組み合わせのうち、見られる作品数が多い上位8つ" },
      },
      {
        heading: "「独占配信」と公式サイトに書かれている作品",
        text: `公式サイトに「独占」と明記されていたのは次の${exWorks.length}作品です。書かれているサービス以外では見られない可能性が高い作品です。\n\n配信先が1社しか書かれていない作品はほかにもありますが、「独占」と書かれていないものは、あとから他のサービスでも配信されることがあるため、ここには入れていません。「独占先行配信」（最初だけ1社で、あとから他社でも配信）も、独占には含めていません。\n\n${MARRONNIER_NOTE}`,
        table: { head: ["作品", "サービス", "公式サイトの記載"], rows: exRows.map((r) => [r.t, r.name, evidenceOf[`${r.id}_${r.svc}`].slice(0, 70)]) },
        works: { ids: exWorks },
      },
      {
        heading: "公式サイトに書かれた配信開始日",
        text: `公式サイトに配信開始日が書かれていた${dated.length}作品を、早い順に並べました。同じ作品でもサービスによって開始日が違うことがあるため、ここでは最も早く始まるサービスを載せています。`,
        table: { head: ["配信開始日", "作品", "最初に配信するサービス"], rows: dated.map((d) => [md(d.first), shortTitle(d.t), svcList(d.names)]), note: "日付は公式サイトの記載どおり。放送局での放送開始日とは異なる場合があります" },
      },
      {
        heading: "作品ごとの配信先を確かめるには",
        text: "作品ごとの配信先は、アニミル！の作品ページと「2026年秋アニメ 配信サービス別一覧」で確認できます。配信サービス別の一覧では、サービスを選ぶとそのサービスで見られる作品だけを表示できます。\n\n配信の予定は追加・変更されることがあります。アニミル！では、作品を登録しておくと、新しい話の放送や配信が始まったときにお知らせします。",
      },
    ],
    entries: [],
  };

  // ---- 記事2：Prime Video ----
  const prime = W.filter((w) => has(w, "prime-video"));
  const primeEx = exRows.filter((r) => r.svc === "prime-video");
  const primeExWorks = uniq(primeEx.map((r) => r.id));
  const primeRow = (w) => w.rows.find((r) => r.svc === "prime-video");
  const primeDated = prime.filter((w) => primeRow(w).first).sort((a, b) => primeRow(a).first - primeRow(b).first);
  const MAIN = ["u-next", "d-anime", "abema", "netflix", "dmm-tv", "hulu"];
  const others = (w) => uniq(w.rows.filter((r) => MAIN.includes(r.svc)).map((r) => r.name));
  const notPrime = W.filter((w) => !has(w, "prime-video"));
  const primeAv = prime.map((w) => primeRow(w).av);
  const inc = primeAv.filter((a) => a === "included").length;
  const ren = primeAv.filter((a) => a === "rental").length;
  const avSentence = inc === 0 && ren === 0
    ? "今回確認した公式サイトには、どちらなのかを書いている作品がありませんでした。"
    : `公式サイトにどちらか書かれていたのは、「見放題」が${inc}作品${ren ? `、「レンタル」が${ren}作品` : ""}で、残りの${prime.length - inc - ren}作品は書かれていませんでした。`;
  const avLabel = (a) => (a === "included" ? "見放題" : a === "rental" ? "レンタル" : "記載なし");

  const a2 = {
    title: `Prime Videoで見れる2026年秋アニメ一覧【${prime.length}作品】独占・配信開始日つき`,
    description: `2026年秋アニメのうち、公式サイトにPrime Videoでの配信が書かれている${prime.length}作品の一覧です。見放題かどうかの記載、Prime Video独占と明記された作品、配信開始日、ほかに見られるサービスもまとめています。`,
    intro: `2026年秋（10〜12月）のアニメで、配信先を確認できた${total}作品のうち、公式サイトに「Prime Video」での配信が書かれていたのは${prime.length}作品でした（${AS_OF}時点）。\n\n作品の評価はしていません。どの作品がPrime Videoで見られるか、という事実だけをまとめています。`,
    updatedAt: UPDATED,
    tags: ["2026年秋", "Prime Video", "配信"],
    thumb: { label: "Prime Video", sub: "2026年秋アニメ", stat: `${prime.length}作品`, color: "#1A6FB5", workIds: uniq([...primeExWorks, ...topWorks.filter((id) => prime.some((w) => w.id === id)), ...prime.map((w) => w.id)]).slice(0, 5) },
    body: [
      {
        heading: "この一覧の読み方",
        text: `ここに載せているのは、各作品の公式サイトの「放送・配信」ページに「Prime Video」と書かれていた作品です。\n\nPrime Videoには、会員なら追加料金なしで見られる「見放題」と、1話ごとにお金を払う「レンタル・購入」があります。${avSentence}見たい作品が見放題かどうかは、Prime Videoで作品名を検索して確認してください。\n\n「dアニメストア for Prime Video」「アニメタイムズ」など、Prime Videoの中にある別料金のチャンネルでだけ配信される作品は、この一覧に含めていません。`,
        stats: { items: [
          { value: `${prime.length}作品`, label: `確認できた${total}作品のうち` },
          { value: `${inc}作品`, label: "「見放題」と記載" },
          { value: `${primeDated.length}作品`, label: "配信開始日の記載あり" },
        ] },
      },
      {
        heading: "Prime Video独占と書かれている作品",
        text: `公式サイトに、Prime Videoでの「独占配信」と明記されていたのは次の${primeExWorks.length}作品です（${AS_OF}に確認）。\n\n${MARRONNIER_NOTE}`,
        table: { head: ["作品", "公式サイトの記載"], rows: primeEx.map((r) => [r.t, evidenceOf[`${r.id}_${r.svc}`].slice(0, 80)]) },
        works: { ids: primeExWorks },
      },
      {
        heading: "Prime Videoでの配信開始日が分かる作品",
        text: "公式サイトに、Prime Videoでの配信開始日が書かれていた作品です。時刻は、毎週の配信時刻が書かれていた場合だけ載せています。",
        table: {
          head: ["配信開始日", "作品"],
          rows: primeDated.map((w) => [md(primeRow(w).first) + (primeRow(w).wt ? ` ${primeRow(w).wt}` : ""), w.t]),
          note: "深夜の時刻は24時を過ぎた表記です（例：24:30＝翌日の午前0時30分）",
        },
      },
      {
        heading: `Prime Videoで見られる${prime.length}作品`,
        text: "作品名の順に並べています。「見放題」の列は公式サイトの記載です。右の列は、Prime Video以外に配信がある主なサービスです（U-NEXT・dアニメストア・ABEMA・Netflix・DMM TV・Huluのうち、公式サイトに書かれていたもの）。",
        table: {
          head: ["作品", "見放題", "ほかに見られる主なサービス"],
          rows: [...prime].sort((a, b) => a.t.localeCompare(b.t, "ja")).map((w) => [shortTitle(w.t), avLabel(primeRow(w).av), others(w).join("・") || "（記載なし）"]),
        },
      },
      {
        heading: "Prime Videoの記載がなかった作品",
        text: `確認できた${total}作品のうち、次の${notPrime.length}作品は公式サイトにPrime Videoの記載がありませんでした。あとから追加されることもあるので、見たい作品がある場合はもう一度確認してください。`,
        table: { head: ["作品", "記載があった配信サービス"], rows: notPrime.map((w) => [shortTitle(w.t), svcList(w.rows.map((r) => r.name))]) },
      },
      {
        heading: "調べ方",
        text: `AniListに登録されている2026年秋のテレビアニメ・短編・配信アニメ${anilistTotal}作品について、公式サイトの「放送・配信」ページを確認しました（${AS_OF}時点）。配信先を確認できたのは${total}作品で、この記事はそのうちPrime Videoの記載があった作品をまとめたものです。\n\n配信の予定は変わることがあります。最新の情報は、Prime Videoと各作品の公式サイトで確認してください。誤りに気づいた場合は、作品ページの「情報の不足・誤りを報告」から教えてください。`,
      },
    ],
    entries: [],
  };

  // ---- 「2026年秋アニメの追いかけ方」の該当段落 ----
  const guide = JSON.parse(fs.readFileSync(OUT + "2026-aki-anime.json", "utf8"));
  const sec = guide.body.find((s) => s.heading === "サービスの見直しどき");
  if (!sec) throw new Error("2026-aki-anime の節が見つからない");
  const top4 = ["prime-video", "u-next", "abema", "d-anime"].map((k) => [nameOf(k), countOf(k)]).sort((a, b) => b[1] - a[1]);
  sec.text = [
    `2026年秋アニメで配信先を確認できた${total}作品では、公式サイトに記載があった作品数は、${top4.map(([n, c]) => `${n}が${c}作品`).join("、")}でした（${AS_OF}時点）。1社で${pct(top4[top4.length - 1][1])}〜${pct(top4[0][1])}%をカバーでき、2社を組み合わせると最大${pairs[0][1]}作品（${topPairs.join("、")}）まで見られます。`,
    `「独占」と明記されているのは、${exText}の${exWorks.length}作品です。見たい独占作品がある月だけ契約する、という判断もできます。`,
    "サブスクは月単位で止められます。使わない月は解約し、必要な月に再契約するだけで、年間の支出は変わります。サービスごとの本数や配信開始日は「2026年秋アニメはどこで見れる？配信サービス別まとめ」にまとめています。",
  ].join("\n\n");
  guide.updatedAt = UPDATED;

  console.log("記事1:", a1.title);
  console.log(" ", topSentence);
  console.log("  組み合わせ上位:", pairs.slice(0, 3).map((p) => p.join(" ")).join(" / "), "／開始日", dated.length, "作品");
  console.log("  独占:", exRows.map((r) => `${r.t}→${r.name}「${evidenceOf[`${r.id}_${r.svc}`]}」`).join(" / "));
  console.log("記事2:", a2.title);
  console.log("  見放題記載", inc, "／レンタル", ren, "／開始日", primeDated.length, "／記載なし作品", notPrime.length);
  console.log("追いかけ方:", sec.text.split("\n\n").slice(0, 2).join(" ｜ "));
  console.log("AniList 秋", anilistTotal, "作品");
  if (!WRITE) return console.log("確認のみ。書き込むときは --write");
  fs.writeFileSync(OUT + "2026-aki-anime-haishin.json", JSON.stringify(a1, null, 2) + "\n");
  fs.writeFileSync(OUT + "prime-video-2026-aki-anime.json", JSON.stringify(a2, null, 2) + "\n");
  fs.writeFileSync(OUT + "2026-aki-anime.json", JSON.stringify(guide, null, 2) + "\n");
  console.log("書き込みました");
})().catch((e) => { console.error(e); process.exit(1); });
