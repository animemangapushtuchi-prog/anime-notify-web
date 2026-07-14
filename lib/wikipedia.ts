// 日本語Wikipediaの作品紹介を取得（機械翻訳は使わない方針。出典表示 CC BY-SA 必須）。
// タイトルで検索→先頭記事の導入部（intro）を取得。失敗時は null。

export type WikiSummary = { extract: string; url: string; title: string };

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function fetchWikipediaJa(
  title: string,
  revalidate = 86400
): Promise<WikiSummary | null> {
  if (!title) return null;
  try {
    // 1. タイトルで記事を検索（アニメ/漫画に寄せる）
    const searchUrl =
      "https://ja.wikipedia.org/w/api.php?action=query&list=search&format=json" +
      "&srlimit=1&srsearch=" + encodeURIComponent(`${title} アニメ`);
    const sRes = await fetch(searchUrl, { next: { revalidate } });
    if (!sRes.ok) return null;
    const sJson = await sRes.json();
    const hit = sJson?.query?.search?.[0];
    if (!hit?.title) return null;
    const pageTitle: string = hit.title;

    // 2. 記事の導入部プレーンテキストを取得
    const extractUrl =
      "https://ja.wikipedia.org/w/api.php?action=query&format=json" +
      "&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=" +
      encodeURIComponent(pageTitle);
    const eRes = await fetch(extractUrl, { next: { revalidate } });
    if (!eRes.ok) return null;
    const eJson = await eRes.json();
    const pages = eJson?.query?.pages ?? {};
    const page: any = Object.values(pages)[0];
    const extract: string = (page?.extract ?? "").trim();
    if (!extract) return null;

    return {
      extract,
      title: pageTitle,
      url: "https://ja.wikipedia.org/wiki/" + encodeURIComponent(pageTitle),
    };
  } catch {
    return null;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
