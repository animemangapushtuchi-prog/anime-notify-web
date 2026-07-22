"use client";

// シリーズ・関連作品：前作・続編チェーンを公開順の目安で表示し、
// 登録済み・視聴状況の確認と「シリーズをまとめて登録」までこの欄で完結させる。
// 開いた時（親のCollapsibleが開く）に初めて実行される＝AniList負荷の軽減。
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, ensureGuestSession, authErrorJa } from "@/lib/auth";
import {
  fetchSeriesInfo,
  formatJa,
  seasonLabel,
  type SeriesEntry,
  type RelatedWork,
  type SeriesInfo,
} from "@/lib/anilist";
import { getWorks, addWorks, type Work } from "@/lib/works";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-[#6B7280]">{title}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
function AnimeRow({ id, label }: { id: number; label: string }) {
  return (
    <a href={`/work/${id}`} className="flex items-center justify-between py-1 text-sm">
      <span className="font-semibold text-[#C2772A] hover:underline">{label}</span>
      <span className="flex-none text-black/30">›</span>
    </a>
  );
}

// チェーン作品の状態バッジ（色だけに依存せず文言で区別）
function ChainBadge({ mine, isCurrent }: { mine: Work | undefined; isCurrent: boolean }) {
  if (isCurrent) {
    return <span className="flex-none rounded-full bg-[#F6E9D5] px-2 py-0.5 text-[10px] font-bold text-[#C2772A]">この作品</span>;
  }
  if (!mine) {
    return <span className="flex-none rounded-full border border-[#ECECF2] px-2 py-0.5 text-[10px] font-bold text-black/40">未登録</span>;
  }
  if (mine.watchStatus === "watched") {
    return <span className="flex-none rounded-full bg-[#F1E9FE] px-2 py-0.5 text-[10px] font-bold text-[#7C3AED]">✓ 視聴済み</span>;
  }
  if (mine.watchedEpisode && mine.watchedEpisode > 0) {
    return (
      <span className="flex-none rounded-full bg-[#E6F7F1] px-2 py-0.5 text-[10px] font-bold text-[#047857]">
        第{mine.watchedEpisode}話まで視聴
      </span>
    );
  }
  return <span className="flex-none rounded-full bg-[#E6F7F1] px-2 py-0.5 text-[10px] font-bold text-[#047857]">🔔 通知登録中</span>;
}

// チェーンから一括登録候補（Work）を作る。seriesIdは公開順で最初の作品ID
function toCandidates(chain: SeriesEntry[]): Work[] {
  const seriesId = chain[0]?.id;
  const seriesTitle = chain[0]?.title;
  return chain.map((c, i) => {
    const w: Work = {
      id: c.id,
      title: c.title,
      meta: [formatJa(c.format), seasonLabel(c.season, c.seasonYear)].filter(Boolean).join("・"),
      status: c.status === "RELEASING" ? "RELEASING" : "FINISHED",
      seriesId,
      seriesOrder: i,
    };
    if (c.cover) w.cover = c.cover;
    if (c.episodes != null) w.episodes = c.episodes;
    if (seriesTitle) w.seriesTitle = seriesTitle;
    return w;
  });
}

export default function RelatedWorks({
  id,
  fallback,
}: {
  id: number;
  fallback: RelatedWork[];
}) {
  const { user, slotCap } = useAuth();
  const [data, setData] = useState<SeriesInfo | null>(null);
  const [works, setWorks] = useState<Work[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchSeriesInfo(id)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {
        if (alive) setData({ chain: [], related: fallback, complete: false });
      });
    return () => {
      alive = false;
    };
  }, [id, fallback]);

  useEffect(() => {
    if (!user) {
      setWorks(null);
      return;
    }
    getWorks(user.uid)
      .then(setWorks)
      .catch(() => setWorks([]));
  }, [user]);

  if (!data) {
    return <p className="py-1 text-xs text-black/50">シリーズ全体を確認中…</p>;
  }

  const related = data.related.length > 0 ? data.related : fallback;
  const movies = related.filter((r) => r.format === "MOVIE");
  const otherAnime = related.filter(
    (r) => r.mediaType === "ANIME" && r.format !== "MOVIE"
  );
  const manga = related.filter((r) => r.mediaType === "MANGA");

  const empty =
    data.chain.length === 0 &&
    movies.length === 0 &&
    otherAnime.length === 0 &&
    manga.length === 0;

  const myIds = new Set((works ?? []).map((w) => w.id));
  const registeredCount = data.chain.filter((c) => myIds.has(c.id)).length;
  const unregistered = data.chain.filter((c) => !myIds.has(c.id));
  const freeSlots = works ? Math.max(0, slotCap - works.length) : 0;
  const showBulk = data.chain.length >= 2;

  // まとめて登録：枠不足なら保存前に不足を通知（部分登録しない）
  const bulkRegister = async () => {
    if (!user || busy || works === null || unregistered.length === 0) return;
    if (unregistered.length > freeSlots) {
      setMsg(`空き枠が足りません。あと${unregistered.length - freeSlots}枠必要です（既存作品の解除や個別登録をご検討ください）。`);
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await addWorks(user.uid, toCandidates(data.chain));
      setWorks(r.works);
      if (r.blocked) {
        setMsg(`空き枠が足りません。あと${r.needed - r.free}枠必要です（既存作品の解除や個別登録をご検討ください）。`);
      } else if (r.addedIds.length > 0) {
        setMsg(`${r.addedIds.length}作品を通知登録しました。`);
      } else {
        setMsg("すべて登録済みです。");
      }
    } catch {
      setMsg("登録に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setBusy(false);
    }
  };

  // 未ログイン：押したときにだけ匿名ゲストを開始してまとめて登録（枠不足なら一件も登録しない）
  const guestBulkRegister = async () => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const u = await ensureGuestSession();
      const r = await addWorks(u.uid, toCandidates(data.chain));
      setWorks(r.works);
      if (r.blocked) {
        setMsg(`ゲストの登録枠（5件）では足りません。あと${r.needed - r.free}枠必要です。メール登録で枠を増やせます。`);
      } else if (r.addedIds.length > 0) {
        setMsg(`${r.addedIds.length}作品をこの端末へ保存しました（ゲスト利用）。メール登録するとデータを保護できます。`);
      } else {
        setMsg("すべて登録済みです。");
      }
    } catch (e) {
      setMsg(authErrorJa(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {data.chain.length > 0 && (
        <Section title="テレビシリーズ（公開順の目安）">
          <div className="divide-y divide-black/5">
            {data.chain.map((c, i) => {
              const mine = (works ?? []).find((w) => w.id === c.id);
              return (
                <a key={c.id} href={`/work/${c.id}`} className="flex items-center gap-2.5 py-1.5">
                  {c.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.cover} alt={c.title} className="h-12 w-8 flex-none rounded object-cover" />
                  ) : (
                    <span className="h-12 w-8 flex-none rounded bg-black/5" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-semibold ${c.isCurrent ? "text-[#1C1C2E]" : "text-[#C2772A] hover:underline"}`}>
                      {i + 1}. {c.title}
                    </span>
                    <span className="block text-[10px] text-[#6B7280]">
                      {[seasonLabel(c.season, c.seasonYear) || (c.startYear ? `${c.startYear}年` : ""), c.episodes ? `全${c.episodes}話` : "", formatJa(c.format)]
                        .filter(Boolean)
                        .join("　")}
                    </span>
                  </span>
                  <ChainBadge mine={mine} isCurrent={c.isCurrent} />
                </a>
              );
            })}
          </div>

          {/* シリーズをまとめて登録（現在見つかっているテレビシリーズのみ。劇場版・OVA等は個別登録） */}
          {showBulk && (
            <div className="mt-2 rounded-xl bg-[#FBF3E6] p-3">
              {user ? (
                works === null ? (
                  <p className="text-xs text-black/40">登録状況を確認中…</p>
                ) : (
                  <>
                    <p className="text-[11px] text-[#6B7280]">
                      登録済み {registeredCount}作品／未登録 {unregistered.length}作品　（使用枠 {unregistered.length}・空き枠 {freeSlots}）
                    </p>
                    <button
                      type="button"
                      onClick={bulkRegister}
                      disabled={busy || unregistered.length === 0}
                      className={`mt-2 w-full rounded-xl py-2.5 text-sm font-bold ${
                        unregistered.length === 0
                          ? "bg-[#E6F7F1] text-[#047857]"
                          : "bg-[#C2772A] text-white disabled:opacity-60"
                      }`}
                    >
                      {busy
                        ? "登録中…"
                        : unregistered.length === 0
                          ? "✓ シリーズ登録済み"
                          : registeredCount > 0
                            ? `未登録の${unregistered.length}作品をまとめて登録`
                            : "🔔 シリーズをまとめて登録"}
                    </button>
                  </>
                )
              ) : (
                <>
                  <button
                    type="button"
                    onClick={guestBulkRegister}
                    disabled={busy}
                    className="block w-full rounded-xl bg-[#C2772A] py-2.5 text-center text-sm font-bold text-white disabled:opacity-60"
                  >
                    {busy ? "登録中…" : "🔔 シリーズをまとめて登録（登録なしでOK）"}
                  </button>
                  <p className="mt-1 text-[10px] leading-snug text-black/40">
                    メール登録なしでも5作品まで使えます（押すとゲスト利用が始まります）。
                    <Link href={`/login?next=${encodeURIComponent(`/work/${id}`)}`} className="font-bold text-[#C2772A]">
                      ログイン／メール登録
                    </Link>
                  </p>
                </>
              )}
              <p aria-live="polite" className="mt-1">
                {msg && <span className="block text-[11px] font-semibold text-[#1C1C2E]">{msg}</span>}
              </p>
              <p className="mt-1 text-[10px] leading-snug text-black/40">
                現在見つかっているテレビシリーズをまとめて登録します。将来発表される続編は含まれません。
              </p>
            </div>
          )}
        </Section>
      )}
      {movies.length > 0 && (
        <Section title="劇場版・映画">
          {movies.map((r) => (
            <AnimeRow key={r.id} id={r.id} label={r.title} />
          ))}
        </Section>
      )}
      {otherAnime.length > 0 && (
        <Section title="その他のアニメ（OVA・SP等）">
          {otherAnime.map((r) => (
            <AnimeRow key={r.id} id={r.id} label={`${r.title}（${r.relation}）`} />
          ))}
        </Section>
      )}
      {manga.length > 0 && (
        <Section title="原作・漫画・小説">
          {manga.map((r) => (
            <p key={r.id} className="py-1 text-sm text-[#1C1C2E]">
              {r.title}
              <span className="ml-1 text-xs text-[#6B7280]">
                （{formatJa(r.format)}）
              </span>
            </p>
          ))}
        </Section>
      )}
      {empty && <p className="py-1 text-xs text-black/50">関連作品は見つかりませんでした。</p>}
      {!data.complete && (
        <p className="text-[10px] text-black/40">
          ※ 一部を取得できませんでした（開き直すと再取得します）
        </p>
      )}
    </div>
  );
}
