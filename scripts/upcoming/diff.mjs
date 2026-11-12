// 前回 build が通ったときの公式ページの本文と、今回 scan で読んだ本文を比べ、作品ごとに増えた行・消えた行を出す。
//   node scripts/upcoming/diff.mjs
// 何十作品もの出力を毎回全部読まなくても、本文が変わった作品だけを見ればよくなる。
// 前回の記録（OS の一時フォルダ）が無いときは、その旨を表示する（そのときは scan の出力を全部読む）。
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CACHE_DIR, CHECKED_DIR, readJson, pagesOf } from "./common.mjs";

if (!existsSync(CHECKED_DIR)) {
  console.log("前回の記録がありません。scan の出力を全作品ぶん読んでください（build が通ると次回から比べられます）。");
  process.exit(0);
}

const linesOf = (dir, file) => {
  const saved = readJson(join(dir, file), null);
  if (!saved) return null;
  const set = new Set();
  for (const p of pagesOf(saved)) for (const l of p.text.split("\n")) if (l.trim()) set.add(l.trim());
  return { title: saved.title, set };
};

const files = new Set([...readdirSync(CHECKED_DIR), ...readdirSync(CACHE_DIR)].filter((f) => /^\d+\.json$/.test(f)));
let changed = 0;
for (const f of [...files].sort()) {
  const before = linesOf(CHECKED_DIR, f);
  const now = linesOf(CACHE_DIR, f);
  if (!before || !now) {
    changed++;
    console.log(`\n■ ${f.replace(".json", "")} ${(now ?? before).title}：${now ? "新しく読んだ作品（scan の出力を読む）" : "今回は読んでいない"}`);
    continue;
  }
  const added = [...now.set].filter((l) => !before.set.has(l));
  const removed = [...before.set].filter((l) => !now.set.has(l));
  if (!added.length && !removed.length) continue;
  changed++;
  console.log(`\n■ ${f.replace(".json", "")} ${now.title}：増えた ${added.length}行／消えた ${removed.length}行`);
  for (const l of added.slice(0, 40)) console.log("  ＋", l.slice(0, 200));
  if (added.length > 40) console.log(`  ＋ …ほか ${added.length - 40}行`);
  for (const l of removed.slice(0, 15)) console.log("  －", l.slice(0, 200));
  if (removed.length > 15) console.log(`  － …ほか ${removed.length - 15}行`);
}
console.log(`\n本文が変わった作品：${changed} / ${files.size}`);
