// ads.txt（広告を出してよい会社の一覧）。以前は public/ads.txt の固定ファイルだった。
// AdSense の行は常に出し、ほかの広告会社に指定された行は content/ads.json の adsTxt に足す。
import { extraAdsTxtLines } from "@/lib/ads";

export const dynamic = "force-static";

const ADSENSE = "google.com, pub-6458901222804186, DIRECT, f08c47fec0942fa0";

export function GET() {
  const body = [ADSENSE, ...extraAdsTxtLines()].join("\n") + "\n";
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
