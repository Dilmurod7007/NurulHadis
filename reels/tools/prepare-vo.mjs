// AI Studio'dan olingan xom ovozni tayyorlaydi: gaplar orasidagi pauzani kamida
// MIN_GAP soniyaga cho'zadi, boshi/oxiridagi ortiqcha jimlikni kesadi, -16 LUFS ga keltiradi.
//   node tools/prepare-vo.mjs "audio/<xom fayl>.wav"
import { spawnSync } from "node:child_process";
import { findSentenceGaps } from "./gaps.mjs";

const MIN_GAP = 1.2;
const src = process.argv[2];
const out = "assets/vo/voiceover.wav";
if (!src) {
  console.error("Foydalanish: node tools/prepare-vo.mjs <xom.wav>");
  process.exit(1);
}

const { dur, onset, tail, gaps } = findSentenceGaps(src);
const start = Math.max(0, onset - 0.08);
const end = Math.min(dur, tail + 0.3);
const cuts = [start, ...gaps.map((g) => (g.s + g.e) / 2), end];
const extras = gaps.map((g) => Math.max(0, MIN_GAP - (g.e - g.s)));

const parts = [];
const labels = [];
for (let i = 0; i < cuts.length - 1; i++) {
  parts.push(`[0:a]atrim=${cuts[i].toFixed(3)}:${cuts[i + 1].toFixed(3)},asetpts=PTS-STARTPTS[s${i}]`);
  labels.push(`[s${i}]`);
  if (i < extras.length && extras[i] > 0.01) {
    parts.push(`aevalsrc=0:c=mono:s=24000:d=${extras[i].toFixed(3)}[z${i}]`);
    labels.push(`[z${i}]`);
  }
}
const graph = `${parts.join(";")};${labels.join("")}concat=n=${labels.length}:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[out]`;
const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", src, "-filter_complex", graph, "-map", "[out]", "-ac", "1", out], { encoding: "utf8" });
if (r.status !== 0) {
  console.error(r.stderr);
  process.exit(1);
}
console.log(`gaplar orasidagi pauzalar: ${gaps.map((g) => (g.e - g.s).toFixed(2)).join(", ")} → kamida ${MIN_GAP}s`);
console.log(`${out}: ${(end - start + extras.reduce((a, b) => a + b, 0)).toFixed(2)}s (xom: ${dur.toFixed(2)}s)`);
