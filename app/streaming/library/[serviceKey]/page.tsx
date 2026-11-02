import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OG_IMAGE } from "@/lib/seo";
import { getLibrary } from "@/lib/library";
import { STREAM_SERVICES, serviceNameOf } from "@/lib/streaming";
import LibraryList from "@/components/LibraryList";
import PageHeader from "@/components/PageHeader";
import ServiceIcon from "@/components/ServiceIcon";

export const revalidate = 86400;

type Props = { params: Promise<{ serviceKey: string }> };

const load = cache(getLibrary);
const isKnown = (k: string) => STREAM_SERVICES.some((s) => s.key === k);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { serviceKey } = await params;
  if (!isKnown(serviceKey)) return { title: "人気アニメの配信早見表｜アニミル！" };
  const name = serviceNameOf(serviceKey);
  const { works } = await load();
  const count = works.filter((w) => w.services.some((s) => s.key === serviceKey)).length;
  const title = `${name}で見られる人気アニメ一覧（${count}作品）｜アニミル！`;
  const description = `人気アニメのうち、${name}で配信を確認できた${count}作品を人気順に並べました。作品名・年・話数が一致すると確かめたものだけを載せています。`;
  const path = `/streaming/library/${serviceKey}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, images: [OG_IMAGE] },
    // 作品が少ないサービスは中身の薄いページになるので検索に出さない
    ...(count < 10 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function LibraryServicePage({ params }: Props) {
  const { serviceKey } = await params;
  if (!isKnown(serviceKey)) notFound();
  const name = serviceNameOf(serviceKey);
  const { works } = await load();
  const list = works.filter((w) => w.services.some((s) => s.key === serviceKey));
  if (list.length === 0) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 pb-6 lg:max-w-[1400px] lg:px-8">
      <PageHeader
        crumbs={[
          { href: "/", label: "ホーム" },
          { href: "/streaming/library", label: "人気アニメの配信早見表" },
          { label: name },
        ]}
        eyebrow="Library"
        title={
          <span className="flex items-center gap-3">
            <ServiceIcon name={name} size={40} />
            <span>{name}で見られる人気アニメ</span>
          </span>
        }
        desc={
          <p>
            人気アニメのうち、{name}で配信を確認できた{list.length}作品です。{name}の作品ページで作品名・年・話数が一致すると確かめたものだけを載せています。
            配信は終わることがあるので、見る前に{name}で確かめてください。
          </p>
        }
        aside={
          <div className="rounded-2xl border border-line bg-white px-5 py-3">
            <p className="text-[11px] text-ink-2">作品</p>
            <p className="num text-2xl font-bold text-ink">{list.length}</p>
          </div>
        }
      >
        <div className="mt-5">
          <Link href="/streaming/library" className="inline-flex rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-bold text-amber-ink transition hover:border-amber">
            ← 全サービスの早見表へ
          </Link>
        </div>
      </PageHeader>

      <LibraryList works={list} highlight={serviceKey} />

      <p className="mt-8 text-[11px] text-ink-2">出典：{name}の作品ページ・AniList（人気順）</p>
    </main>
  );
}
