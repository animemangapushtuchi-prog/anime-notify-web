import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { OG_IMAGE } from "@/lib/seo";
import { getLibrary, libraryServices } from "@/lib/library";
import { jstDateLabel } from "@/lib/workMeta";
import LibraryList from "@/components/LibraryList";
import PageHeader from "@/components/PageHeader";
import ServiceIcon from "@/components/ServiceIcon";

export const revalidate = 86400;

const load = cache(getLibrary);

export async function generateMetadata(): Promise<Metadata> {
  const { works } = await load();
  const title = `人気アニメはどこで見れる？配信サービス早見表（${works.length}作品）｜アニミル！`;
  const description = `人気アニメ${works.length}作品の配信サービスを、人気順の一覧にしました。U-NEXT・dアニメストア・Netflix などの作品ページで確かめた情報だけを載せています。`;
  return {
    title,
    description,
    alternates: { canonical: "/streaming/library" },
    openGraph: { title, description, url: "/streaming/library", images: [OG_IMAGE] },
  };
}

export default async function LibraryPage() {
  const { works, checkedAt } = await load();
  const services = libraryServices(works);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-6 lg:max-w-[1400px] lg:px-8">
      <PageHeader
        crumbs={[{ href: "/", label: "ホーム" }, { href: "/streaming", label: "今期配信" }, { label: "人気アニメの配信早見表" }]}
        eyebrow="Library"
        title={<>人気アニメは<br className="sm:hidden" /> どこで見れる？</>}
        desc={
          <>
            <p>定番の人気アニメの配信先を、AniList の人気順に並べました。作品を選ぶと、配信先の詳しい情報が見られます。</p>
            <p className="mt-1 text-xs">
              各配信サービスの作品ページで、作品名・年・話数が一致すると確かめたものだけを載せています。ここに無いサービスでも配信されている場合があります。
              {checkedAt ? `（最終確認 ${jstDateLabel(checkedAt)}）` : ""}
            </p>
          </>
        }
        aside={
          <div className="rounded-2xl border border-line bg-white px-5 py-3">
            <p className="text-[11px] text-ink-2">作品</p>
            <p className="num text-2xl font-bold text-ink">{works.length}</p>
          </div>
        }
      >
        <nav aria-label="配信サービス" className="mt-5 flex flex-wrap gap-2">
          {services.map((s) => (
            <Link key={s.key} href={`/streaming/library/${s.key}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink transition hover:border-amber">
              <ServiceIcon name={s.name} size={18} />
              {s.name}
              <span className="num text-ink-2">{s.count}</span>
            </Link>
          ))}
        </nav>
      </PageHeader>

      <LibraryList works={works} />

      <p className="mt-8 text-[11px] text-ink-2">出典：各配信サービスの作品ページ・AniList（人気順）</p>
    </main>
  );
}
