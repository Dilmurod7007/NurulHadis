// Ovozdagi jimliklarni o'lchab, index.html dagi kadr vaqtlari (T), davomiylik va
// barcha <audio> teglarini (diktor, musiqa, SFX) qayta yozadi. Musiqani video
// uzunligiga kesib, fade-in/out bilan assets/bgm/track.wav ga tayyorlaydi.
//   node tools/sync.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { findSentenceGaps } from "./gaps.mjs";

const cfg = JSON.parse(fs.readFileSync("audio_cues.json", "utf8"));
const SCENES = cfg.fallbackT.length;
const r2 = (x) => Math.round(x * 100) / 100;

let T = cfg.fallbackT;
let voEnd = null;
if (fs.existsSync(cfg.vo.file)) {
  const { tail, onset, gaps } = findSentenceGaps(cfg.vo.file);
  // Kadr gap boshlanishida (jimlik oxirida) ochiladi; index.html LEAD qadar oldinroq boshlaydi.
  T = [onset, ...gaps.map((g) => g.e)].map((t) => r2(t + cfg.vo.offset));
  voEnd = tail + cfg.vo.offset;
  console.log("jimliklar:", gaps.map((g) => `${r2(g.s)}–${r2(g.e)}`).join(", "));
}
const END = r2((voEnd ?? T[SCENES - 1] + 4) + cfg.tail);

// Musiqa: manbadan END uzunlikda, boshida yumshoq kirish, oxirida so'nish, -16 LUFS.
if (cfg.bgm.source && fs.existsSync(cfg.bgm.source)) {
  const fadeOut = cfg.bgm.fadeOut ?? 2.5;
  const af = [
    `atrim=${cfg.bgm.from ?? 0}:${(cfg.bgm.from ?? 0) + END}`,
    "asetpts=PTS-STARTPTS",
    `afade=t=in:d=${cfg.bgm.fadeIn ?? 1.2}`,
    `afade=t=out:st=${r2(END - fadeOut)}:d=${fadeOut}`,
    "loudnorm=I=-16:TP=-1.5:LRA=11",
    "aresample=48000",
  ].join(",");
  const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", cfg.bgm.source, "-af", af, "-ac", "2", cfg.bgm.file], { encoding: "utf8" });
  if (r.status !== 0) {
    console.error(r.stderr);
    process.exit(1);
  }
}

const tags = [];
if (fs.existsSync(cfg.vo.file)) {
  tags.push(`<audio id="vo" src="${cfg.vo.file}" data-start="${cfg.vo.offset}" data-volume="${cfg.vo.volume}"></audio>`);
}
if (fs.existsSync(cfg.bgm.file)) {
  tags.push(`<audio id="bgm" src="${cfg.bgm.file}" data-start="0" data-duration="${END}" data-volume="${cfg.bgm.volume}"></audio>`);
}
for (const c of cfg.sfx) {
  const at = r2(Math.max(0, T[c.scene] + c.at));
  tags.push(`<audio id="${c.id}" src="${c.file}" data-start="${at}" data-volume="${c.volume}"></audio>`);
}

let html = fs.readFileSync("index.html", "utf8");
html = html.replace(/const T = \[[^\]]*\];/, `const T = [${T.join(", ")}];`);
html = html.replace(/const END = [\d.]+;/, `const END = ${END};`);
html = html.replace(/(data-composition-id="main"[^>]*?data-duration=")[\d.]+"/, `$1${END}"`);
html = html.replace(
  /<!-- AUDIO:BEGIN -->[\s\S]*?<!-- AUDIO:END -->/,
  `<!-- AUDIO:BEGIN -->\n      ${tags.join("\n      ")}\n      <!-- AUDIO:END -->`,
);
fs.writeFileSync("index.html", html);
fs.writeFileSync("timing.json", JSON.stringify({ T, END }, null, 2) + "\n");
console.log(`T = [${T.join(", ")}]  END = ${END}  audio teglar: ${tags.length}`);
