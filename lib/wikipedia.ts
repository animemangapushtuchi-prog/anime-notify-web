// 日本語Wikipediaの作品紹介を取得（機械翻訳は使わない方針。出典表示 CC BY-SA 必須）。
// タイトルで検索→候補を照合→一致したものだけ導入部(intro)を返す。失敗時は null。
//
// 重要: 以前は検索結果の1件目を無条件に採用していたため、作品のWikipedia記事が
// 無い場合に「制作会社の会社概要」を拾ってしまい、まったく別物の説明文が
// 作品ページに出ていた（例: ヤニねこ → バイブリーアニメーションスタジオ）。
// 誤った説明を出すくらいなら null を返す方針に変更している。

export type WikiSummary = { extract: string; url: string; title: string };

// 記事タイトル／本文が「会社・団体の説明」なら作品紹介ではないと判断する
const ORG_WORDS = [
  "株式会社",
  "有限会社",
  "合同会社",
  "合資会社",
  "一般社団法人",
  "公益社団法人",
  "Inc.",
  "Co., Ltd",
  "K.K.",
  "G.K.",
];
// 会社記事の書き出しでよく出る言い回し
const ORG_INTRO = /(に本社を置く|日本のアニメ制作会社|アニメーション制作会社|映像制作会社|に所在する.*会社|日本の企業)/;

function isOrganization(title: string, extract: string): boolean {
  if (ORG_WORDS.some((w) => title.includes(w))) return true;
  // 本文の冒頭200文字だけ見る（後半に社名が出るのは普通なので誤検知を避ける）
  return ORG_INTRO.test(extract.slice(0, 200));
}

// 照合用にタイトルを正規化する。
// 全角/半角、記号、続編表記（Ⅱ/第2期/2nd Season など）、サブタイトルを落として
// 「作品の芯の部分」だけを取り出す。
export function normalizeTitle(s: string): string {
  let t = (s || "")
    // 全角英数を半角へ
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .toLowerCase();

  // サブタイトル（～…～ / -…- / ：以降）を落とす
  t = t.replace(/[～~][^～~]*[～~]?\s*$/, "");
  t = t.replace(/[-−—][^-−—]*[-−—]\s*$/, "");
  t = t.replace(/[：:].*$/, "");

  // 続編・期の表記を落とす
  t = t.replace(
    /(第?\s*[0-9０-９]+\s*(期|期目|クール|シーズン|season)|[0-9]+(st|nd|rd|th)\s*season|final\s*season|season\s*[0-9]+|[ⅡⅢⅣⅤⅥ]|\bii+\b|\biv\b)/gi,
    ""
  );

  // 記号・空白を除去
  t = t.replace(/[\s　・･,，.。!！?？'"“”‘’「」『』()（）\[\]【】\/|]/g, "");
  return t.trim();
}

// 候補の記事タイトルが、その作品のものとして妥当かを判定する
function titleMatches(workTitle: string, pageTitle: string): boolean {
  const w = normalizeTitle(workTitle);
  const p = normalizeTitle(pageTitle);
  if (!w || !p) return false;
  if (w === p) return true;
  // 記事名が作品名を含む（例:「幼女戦記」→「幼女戦記」）／その逆も許す。
  // ただし短すぎる一致は誤爆するので4文字以上を条件にする。
  const shorter = w.length <= p.length ? w : p;
  if (shorter.length < 4) return w === p;
  return p.includes(w) || w.includes(p);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function fetchWikipediaJa(
  title: string,
  revalidate = 86400
): Promise<WikiSummary | null> {
  if (!title) return null;
  try {
    // 1. タイトルで記事を検索（候補を複数取り、あとで照合する）
    const searchUrl =
      "https://ja.wikipedia.org/w/api.php?action=query&list=search&format=json" +
      "&srlimit=5&srsearch=" +
      encodeURIComponent(`${title} アニメ`);
    const sRes = await fetch(searchUrl, { next: { revalidate } });
    if (!sRes.ok) return null;
    const sJson = await sRes.json();
    const hits: any[] = sJson?.query?.search ?? [];
    if (hits.length === 0) return null;

    // 2. 記事名が作品名と一致する候補だけに絞る
    const candidates = hits
      .map((h) => String(h?.title || ""))
      .filter((t) => t && titleMatches(title, t));
    if (candidates.length === 0) return null;

    // 3. 候補の導入部をまとめて取得
    const extractUrl =
      "https://ja.wikipedia.org/w/api.php?action=query&format=json" +
      "&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=" +
      encodeURIComponent(candidates.join("|"));
    const eRes = await fetch(extractUrl, { next: { revalidate } });
    if (!eRes.ok) return null;
    const eJson = await eRes.json();
    const pages: any[] = Object.values(eJson?.query?.pages ?? {});

    // 4. 会社・団体の記事を除外し、残ったものを採用する
    for (const t of candidates) {
      const page = pages.find((p: any) => p?.title === t);
      const extract: string = (page?.extract ?? "").trim();
      if (!extract) continue;
      if (isOrganization(t, extract)) continue;
      return {
        extract,
        title: t,
        url: "https://ja.wikipedia.org/wiki/" + encodeURIComponent(t),
      };
    }
    return null;
  } catch {
    return null;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
