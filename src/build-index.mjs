// data/chunks.json → data/vectors.json (벡터 저장소). 실행: node src/build-index.mjs
import fs from "node:fs";
import { embedDocument, MODEL, DTYPE, METHOD, DIM } from "./embedder.mjs";

const CHUNKS_PATH = "data/chunks.json";
const VECTORS_PATH = "data/vectors.json";
const MIN_LEN = 120;

const chunks = JSON.parse(fs.readFileSync(CHUNKS_PATH, "utf8"));

// 먼저 검사: 필드 누락·중복 id는 중단, 120자 미만은 경고
const seen = new Set();
for (const c of chunks) {
  for (const key of ["id", "text", "url", "section"]) {
    if (!c[key]) {
      console.error(`중단: ${c.id ?? "(id 없음)"}에 필드 "${key}"가 없습니다.`);
      process.exit(1);
    }
  }
  if (seen.has(c.id)) {
    console.error(`중단: 중복 id ${c.id}`);
    process.exit(1);
  }
  seen.add(c.id);
  if (c.text.length < MIN_LEN) {
    console.warn(`경고: ${c.id}(${c.section})의 text가 ${MIN_LEN}자 미만(${c.text.length}자)입니다.`);
  }
}

const out = [];
for (const c of chunks) {
  const vector = await embedDocument(c);
  if (vector.length !== DIM) {
    console.error(`중단: ${c.id}의 벡터가 ${vector.length}차원입니다(기대 ${DIM}).`);
    process.exit(1);
  }
  out.push({ ...c, vector });
  console.log(`✓ ${c.id} (${c.section})`);
}

const store = { model: MODEL, dtype: DTYPE, method: METHOD, dim: DIM, createdAt: new Date().toISOString(), chunks: out };
fs.writeFileSync(VECTORS_PATH, JSON.stringify(store), "utf8");

// 학습용 출력: 첫 벡터의 앞 5개 숫자와 크기(노름, 1.0이어야 함)
const v = out[0].vector;
const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
console.log(`첫 벡터 앞 5개: [${v.slice(0, 5).map((x) => x.toFixed(4)).join(", ")}] 노름: ${norm.toFixed(4)}`);
console.log(`저장: ${VECTORS_PATH} — ${out.length}청크 × ${DIM}차원`);
