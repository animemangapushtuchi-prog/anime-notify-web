// AdSense 以外の広告タグを、サイト内の小さなページとして返す（AdSlot が iframe で読み込む）。
// 広告会社のタグには document.write を使う古い形式もあり、React の画面に直接入れると壊れることがあるため、枠を分けている。
// 同じドメイン（www.animiru.com）で配信するので、広告会社のサイト確認（どのサイトに貼られているか）も通る。
import { displaySlot, displaySlotNames } from "@/lib/ads";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return displaySlotNames().map((slot) => ({ slot }));
}

export async function GET(_req: Request, ctx: { params: Promise<{ slot: string }> }) {
  const { slot } = await ctx.params;
  const s = displaySlot(slot);
  if (!s) return new Response("Not Found", { status: 404 });
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><base target="_blank"><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}</style></head><body>${s.html}</body></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
