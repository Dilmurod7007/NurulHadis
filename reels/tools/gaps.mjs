// Ovozdagi gaplar orasidagi jimliklarni topish (sync.mjs va prepare-vo.mjs uchun umumiy).
import { spawnSync } from "node:child_process";
import fs from "node:fs";

export function probeDuration(file) {
  const p = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
  return parseFloat(p.stdout);
}

export function scriptLines() {
  return JSON.parse(fs.readFileSync("audio_request.json", "utf8")).lines[0].text.split(/\n\s*\n/).map((l) => l.trim());
}

// Qaytaradi: { dur, onset, tail, gaps: [{s,e}] } — gaps.length === lines.length - 1
export function findSentenceGaps(file, lines = scriptLines()) {
  const dur = probeDuration(file);
  const err = spawnSync("ffmpeg", ["-hide_banner", "-i", file, "-af", "silencedetect=noise=-28dB:d=0.18", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const starts = [...err.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
  const ends = [...err.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
  const sil = starts.map((s, i) => ({ s, e: ends[i] ?? dur }));
  const onset = sil.length && sil[0].s < 0.05 ? sil[0].e : 0;
  const tail = sil.length && sil.at(-1).e >= dur - 0.05 ? sil.at(-1).s : dur;

  // Har chegara uchun matn uzunligiga mutanosib kutilgan joy; gaplar orasidagi pauza
  // gap ichidagidan uzunroq bo'lgani uchun masofadan pauza uzunligini ayiramiz.
  const lens = lines.map((l) => l.length);
  const total = lens.reduce((a, b) => a + b, 0);
  let acc = 0;
  let pool = sil.filter((g) => g.s > onset + 0.2 && g.e < tail);
  const gaps = [];
  for (let i = 0; i < lines.length - 1; i++) {
    acc += lens[i];
    const expected = onset + ((tail - onset) * acc) / total;
    if (!pool.length) throw new Error(`${i + 1}-gapdan keyin jimlik topilmadi`);
    const cost = (g) => Math.abs((g.s + g.e) / 2 - expected) - 1.5 * (g.e - g.s);
    const best = pool.reduce((a, b) => (cost(b) < cost(a) ? b : a));
    gaps.push(best);
    pool = pool.filter((g) => g.s > best.e);
  }
  return { dur, onset, tail, gaps };
}
