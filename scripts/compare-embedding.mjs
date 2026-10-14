// 임베딩 두 방식을 같은 청크·질문으로 비교하는 실험 (프로젝트 루트에서: node scripts/compare-embedding.mjs 결과파일.txt)
// A) pipeline("feature-extraction") + mean pooling + normalize  (가이드 방식)
// B) AutoModel + AutoTokenizer 의 sentence_embedding 출력         (모델 카드 방식)
import fs from "node:fs";
import { pipeline, AutoTokenizer, AutoModel } from "@huggingface/transformers";

const MODEL = "onnx-community/embeddinggemma-300m-ONNX";
const DTYPE = "q8";
const OUT = process.argv[2];
const chunks = JSON.parse(fs.readFileSync("data/chunks.json", "utf8"));
const docText = (c) => `title: ${c.section} | text: ${c.text}`;
const qText = (q) => `task: search result | query: ${q}`;
const queries = [
  ["정상", "새 이미지는 언제 올라와요?", "NE-003"],
  ["정상", "노을은 사람이에요?", "NE-007"],
  ["정상", "광고 문의는 어디로 하면 돼요?", "NE-009"],
  ["비슷한 것 구분", "굿즈 팔아요?", "NE-011"],
  ["비슷한 것 구분", "그림 그려줄 수 있어요? 의뢰하고 싶어요", "NE-011"],
  ["비슷한 것 구분", "배경화면으로 써도 돼요?", "NE-010"],
  ["경계", "실명이 뭐예요?", "NE-012"],
  ["경계", "라이브는 언제 해요?", "NE-005"],
  ["무관", "내일 날씨 어때?", null],
  ["무관", "김치찌개 레시피 알려줘", null],
];

const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const norm = (a) => Math.sqrt(dot(a, a));
const toRows = (t) => t.tolist();

// A) pipeline
const extractor = await pipeline("feature-extraction", MODEL, { dtype: DTYPE });
async function embedA(texts) {
  const out = [];
  for (const t of texts) {
    const r = await extractor(t, { pooling: "mean", normalize: true });
    out.push(Array.from(r.data));
  }
  return out;
}

// B) sentence_embedding
const tokenizer = await AutoTokenizer.from_pretrained(MODEL);
const model = await AutoModel.from_pretrained(MODEL, { dtype: DTYPE });
async function embedB(texts) {
  const out = [];
  for (const t of texts) {
    const inputs = await tokenizer([t], { padding: true });
    const { sentence_embedding } = await model(inputs);
    out.push(Array.from(sentence_embedding.data));
  }
  return out;
}

const docs = chunks.map(docText);
const qs = queries.map((q) => qText(q[1]));
const lines = [];
const log = (s = "") => lines.push(s);

const t0 = Date.now();
const dA = await embedA(docs), qA = await embedA(qs);
const tA = Date.now() - t0;
const t1 = Date.now();
const dB = await embedB(docs), qB = await embedB(qs);
const tB = Date.now() - t1;

log(`차원: A=${dA[0].length} B=${dB[0].length} | 노름 A=${norm(dA[0]).toFixed(4)} B=${norm(dB[0]).toFixed(4)} | 시간 A=${tA}ms B=${tB}ms`);
const same = dA.map((v, i) => dot(v, dB[i]) / (norm(v) * norm(dB[i])));
log(`같은 문서에 대한 A·B 벡터 코사인: 최소 ${Math.min(...same).toFixed(3)} 평균 ${(same.reduce((a, b) => a + b) / same.length).toFixed(3)}`);
log("");

function rank(q, D) {
  return D.map((d, i) => [chunks[i].id, dot(q, d)]).sort((a, b) => b[1] - a[1]);
}
const summary = { A: { hit: 0, rel: [], irr: [] }, B: { hit: 0, rel: [], irr: [] } };
log("유형 | 질문 | 기대 | A top3 (점수) | B top3 (점수)");
log("---|---|---|---|---");
queries.forEach(([type, q, expect], i) => {
  const rA = rank(qA[i], dA), rB = rank(qB[i], dB);
  const f = (r) => r.slice(0, 3).map(([id, s]) => `${id} ${s.toFixed(3)}`).join(", ");
  log(`${type} | ${q} | ${expect ?? "-"} | ${f(rA)} | ${f(rB)}`);
  for (const [k, r] of [["A", rA], ["B", rB]]) {
    if (expect) { if (r[0][0] === expect) summary[k].hit++; summary[k].rel.push(r[0][1]); }
    else summary[k].irr.push(r[0][1]);
  }
});
log("");
for (const k of ["A", "B"]) {
  const s = summary[k];
  const relMin = Math.min(...s.rel), irrMax = Math.max(...s.irr);
  log(`${k}: 기대 청크가 1위 ${s.hit}/8 | 관련 질문 1위 점수 최저 ${relMin.toFixed(3)} | 무관 질문 1위 점수 최고 ${irrMax.toFixed(3)} | 간격 ${(relMin - irrMax).toFixed(3)}`);
}
fs.writeFileSync(OUT, lines.join("\n") + "\n", "utf8");
console.log("saved", OUT);
