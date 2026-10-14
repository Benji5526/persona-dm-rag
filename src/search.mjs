// [1단계] 질문과 비슷한 청크 top-k를 점수와 함께 보여 준다.
// 사용법: node src/search.mjs "질문1" ["질문2" …] [--k 3]
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { embedQuery, MODEL, DTYPE, METHOD } from "./embedder.mjs";

// 약한 근거 기준점. 여기서만 정의하고 다른 파일은 import한다(CLAUDE.md 검색 계약, docs/search-threshold-experiment.md).
export const WEAK_THRESHOLD = 0.25;
const DEFAULT_K = 3;
const VECTORS_PATH = fileURLToPath(new URL("../data/vectors.json", import.meta.url));

let store = null;
function loadStore() {
  if (store) return store;
  if (!fs.existsSync(VECTORS_PATH)) {
    throw new Error("data/vectors.json이 없습니다. 먼저 node src/build-index.mjs 를 실행하세요.");
  }
  const s = JSON.parse(fs.readFileSync(VECTORS_PATH, "utf8"));
  if (s.model !== MODEL || s.dtype !== DTYPE || s.method !== METHOD) {
    throw new Error(
      `벡터 저장소(${s.model}/${s.dtype}/${s.method})가 현재 설정(${MODEL}/${DTYPE}/${METHOD})과 다릅니다. ` +
        "node src/build-index.mjs 를 다시 실행하세요.",
    );
  }
  store = s;
  return store;
}

const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);

// 질문 → 점수 내림차순 top-k. 벡터가 정규화되어 있으므로 내적 = 코사인 유사도.
export async function search(question, k = DEFAULT_K) {
  const { chunks } = loadStore();
  const qv = await embedQuery(question);
  return chunks
    .map((c) => ({ id: c.id, section: c.section, text: c.text, url: c.url, score: dot(qv, c.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

function bar(score) {
  const n = Math.max(0, Math.min(20, Math.round(score * 20)));
  return "█".repeat(n) + "░".repeat(20 - n);
}

async function main() {
  const args = process.argv.slice(2);
  let k = DEFAULT_K;
  const questions = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--k") {
      k = Number(args[++i]);
      if (!Number.isInteger(k) || k < 1) {
        console.error("--k 는 1 이상의 정수여야 합니다.");
        process.exit(1);
      }
    } else {
      questions.push(args[i]);
    }
  }
  if (questions.length === 0) {
    console.error('사용법: node src/search.mjs "질문1" ["질문2" …] [--k 3]');
    process.exit(1);
  }

  try {
    loadStore();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  for (const q of questions) {
    const hits = await search(q, k);
    const weak = hits[0].score < WEAK_THRESHOLD ? `  ⚠ 관련 자료가 약함(<${WEAK_THRESHOLD})` : "";
    console.log(`\nQ: ${q}${weak}`);
    hits.forEach((h, i) => {
      console.log(`${i + 1}. ${h.id} ${h.score.toFixed(3)} ${bar(h.score)} [${h.section}]`);
      console.log(`   ${h.text.slice(0, 60)}…`);
      console.log(`   출처: ${h.url}`);
    });
  }
}

// 다른 파일이 import할 때는 CLI를 실행하지 않는다 (node -e 처럼 실행 파일 경로가 없을 때도 안전하게)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
