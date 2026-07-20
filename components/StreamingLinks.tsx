"use client";

// 作品詳細「ネット配信」の一覧。
// AniListの配信リンクと、しょぼいカレンダー由来のネット配信枠(cache/streamSchedule)を
// 正規化サービスキーで統合して表示する。配信日時は番組表に根拠がある場合のみ表示（推測しない）。
// 契約中サービスは先頭＋バッジ。未ログイン・未設定・取得失敗時は従来どおりの一覧。
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getUserPrefs } from "@/lib/subscriptions";
import {
  getStreamSchedule,
  matchPrograms,
  mergeStreaming,
  subscribedServiceKeys,
  type MergedStream,
} from "@/lib/streaming";
import ServiceIcon from "@/components/ServiceIcon";

type Item = { name: string; url: string };
const CONTACT = "animemangapushtuchi@gmail.com";
const WD = ["日", "月", "火", "水", "木", "金", "土"];

// 配信日時の表示（JST。深夜は25時表記にせず素直に表示）
function fmtAt(st: number): string {
  const d = new Date((st + 9 * 3600) * 1000);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${WD[d.getUTCDay()]}）${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
}

export default function StreamingLinks({
  items,
  title,
  workId,
}: {
  items: Item[];
  title: string;
  workId: number;
}) {
  const { user } = useAuth();
  const [subKeys, setSubKeys] = useState<string[]>([]);
  const [merged, setMerged] = useState<MergedStream[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let alive = true;
    getStreamSchedule()
      .then((r) => {
        if (!alive) return;
        setMerged(mergeStreaming(items, matchPrograms(title, r.programs)));
        setUpdatedAt(r.updatedAt);
      })
      .catch(() => {
        if (alive) setMerged(mergeStreaming(items, []));
      });
    return () => {
      alive = false;
    };
  }, [items, title]);

  useEffect(() => {
    if (!user) {
      setSubKeys([]);
      return;
    }
    getUserPrefs(user.uid)
      .then((p) => setSubKeys(subscribedServiceKeys(p.services)))
      .catch(() => setSubKeys([]));
  }, [user]);

  const list = merged ?? mergeStreaming(items, []);
  // 契約中サービスを先頭へ（元の順序は保つ安定並べ替え）
  const sub = list.filter((s) => subKeys.includes(s.key));
  const rest = list.filter((s) => !subKeys.includes(s.key));
  const sorted = [...sub, ...rest];

  const mailto = `mailto:${CONTACT}?subject=${encodeURIComponent(
    `【配信情報の報告】${title}（AniList ${workId}）`
  )}&body=${encodeURIComponent(
    `作品：${title}（AniList ID: ${workId}）\n\n■ 不足しているサービス：\n（例：ABEMAで配信中なのに表示されない など）\n\n■ 誤っている情報：\n（例：配信していないサービスが表示されている など）\n`
  )}`;

  return (
    <div>
      {sorted.length === 0 ? (
        <p className="mt-2 text-xs text-[#6B7280]">日本で見られる配信情報は現在確認中です</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-[#6B7280]">
            配信日時は取得できた公式相当の番組表情報のみ表示しています
          </p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {sorted.map((s) => {
              const isSub = subKeys.includes(s.key);
              const inner = (
                <>
                  <ServiceIcon name={s.name} size={22} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-[#1C1C2E]">{s.name}</span>
                    {s.nextAt != null && (
                      <span className="block text-[10px] text-[#6B7280]">
                        次回：{fmtAt(s.nextAt)}
                        {s.nextEp != null ? `　第${s.nextEp}話` : ""}
                      </span>
                    )}
                  </span>
                  {isSub && (
                    <span className="flex-none rounded-full border border-[#C2772A] bg-[#F6E9D5] px-2 py-0.5 text-[10px] font-bold text-[#C2772A]">
                      ✓ 契約中
                    </span>
                  )}
                  {s.url ? (
                    <span className="flex-none text-xs font-bold text-[#C2772A]">開く ›</span>
                  ) : (
                    <span className="flex-none text-[10px] text-black/40">リンクなし</span>
                  )}
                </>
              );
              return (
                <li key={s.key}>
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-xl bg-white px-3 py-2"
                    >
                      {inner}
                    </a>
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-2">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <p className="mt-2 text-[10px] text-[#6B7280]">
        出典：AniList／しょぼいカレンダー
        {updatedAt
          ? `　配信情報の最終更新：${updatedAt.getMonth() + 1}/${updatedAt.getDate()} ${String(updatedAt.getHours()).padStart(2, "0")}:${String(updatedAt.getMinutes()).padStart(2, "0")}`
          : ""}
      </p>
      <p className="mt-1 text-[10px]">
        <a href={mailto} className="font-bold text-[#C2772A] underline-offset-2 hover:underline">
          情報の不足・誤りを報告
        </a>
      </p>
    </div>
  );
}
