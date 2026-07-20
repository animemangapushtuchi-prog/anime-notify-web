"use client";

// 作品詳細「ネット配信」の一覧。ログイン中で契約中サービスが設定されていれば
// 契約中を先頭に並べ替えて「契約中」バッジを付ける。
// 未ログイン・設定未選択・取得失敗時は、サーバーが渡した従来どおりの順序で表示する。
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getUserPrefs, isSubscribedService, sortSubscribedFirst } from "@/lib/subscriptions";
import ServiceIcon from "@/components/ServiceIcon";

type Item = { name: string; url: string };

export default function StreamingLinks({ items }: { items: Item[] }) {
  const { user } = useAuth();
  const [keys, setKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!user) {
      setKeys([]);
      return;
    }
    getUserPrefs(user.uid)
      .then((p) => setKeys(p.services))
      .catch(() => setKeys([]));
  }, [user]);

  const list = sortSubscribedFirst(items, (i) => i.name, keys);

  return (
    <ul className="mt-2 grid gap-1 sm:grid-cols-2">
      {list.map((s) => {
        const sub = keys.length > 0 && isSubscribedService(s.name, keys);
        return (
          <li key={s.name}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl bg-white px-3 py-2"
            >
              <ServiceIcon name={s.name} size={22} />
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#1C1C2E]">
                {s.name}
              </span>
              {sub && (
                <span className="flex-none rounded-full border border-[#C2772A] bg-[#F6E9D5] px-2 py-0.5 text-[10px] font-bold text-[#C2772A]">
                  ✓ 契約中
                </span>
              )}
              <span className="flex-none text-xs font-bold text-[#C2772A]">開く ›</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
