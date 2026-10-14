// STEP 8: 변형별 결과(JSON 여러 개)를 같은 지표로 비교한다. 변형마다 시각을 바꿔 여러 번 돌린 결과의 평균과 범위를 본다.
// 실행(프로젝트 루트에서): node scripts/compare-variants.mjs baseline=experiments/baseline_0045.json,experiments/baseline_0046.json A=... B=...
// 이름 뒤에 "+C"가 붙은 열은 같은 답변에 대해 C의 판정(운영자 확인 조건에서 "근거 ID 없음"을 뺌)을 다시 계산한 것이다. A와 B에 대해서만 만든다.
import fs from "node:fs";

const HOLD_EXPECTED = new Set([13, 14, 15, 16]); // 자료에 없는 질문 3개 + 무관 1개: 보류(또는 "모른다")가 맞는 질문
const HAPSYO = /(습니다|입니다|니다)[.!?]?$/;
const sentences = (a) => a.split(/(?<=[.!?])\s+/).filter((s) => s.trim());

function withoutIdCondition(row) {
  const reasons = row.reasons.filter((r) => r !== "답변에 근거 ID 표시가 없음");
  return { ...row, reasons, needsOperator: reasons.length > 0 };
}

// 한 번의 실행(20개 답변)을 숫자 지표로 바꾼다.
function metrics(rows) {
  const exp = rows.filter((r) => HOLD_EXPECTED.has(r.no));
  const non = rows.filter((r) => !HOLD_EXPECTED.has(r.no));
  return {
    falseHold: non.filter((r) => r.hold).length, // /16
    missedHold: exp.filter((r) => !r.hold).length, // /4
    flagNon: non.filter((r) => r.needsOperator).length, // /16
    flagExp: exp.filter((r) => r.needsOperator).length, // /4
    ids: rows.filter((r) => r.cited.length > 0).length, // /20
    hapsyo: rows.filter((r) => sentences(r.answer).some((s) => HAPSYO.test(s.trim()))).length, // /20
    long4: rows.filter((r) => sentences(r.answer).length > 3).length, // /20
    leak: rows.filter((r) => /근거가 된 (자료|조각)의 ID/.test(r.answer)).length, // /20 지시문이 답에 새어 나옴
    ms: rows.reduce((s, r) => s + r.answerMs, 0) / rows.length / 1000,
  };
}

const ROWS = [
  ["거짓 보류: 보류가 필요 없는 16개 중 보류한 수 (적을수록 좋음)", "falseHold", 16],
  ["놓친 보류: 보류가 맞는 4개 중 보류하지 않은 수 (적을수록 좋음)", "missedHold", 4],
  ["⚑ 운영자 확인이 붙은 수: 필요 없는 16개 (적을수록 좋음)", "flagNon", 16],
  ["⚑ 운영자 확인이 붙은 수: 보류가 맞는 4개 (많을수록 좋음)", "flagExp", 4],
  ["근거 ID가 있는 답변 (많을수록 좋음)", "ids", 20],
  ["합쇼체 문장이 있는 답변 (해요체 규칙에서 벗어남)", "hapsyo", 20],
  ["문장 4개 이상 (2~3문장 규칙 위반)", "long4", 20],
  ["지시문이 답변에 새어 나온 수", "leak", 20],
];

const cols = [];
for (const arg of process.argv.slice(2)) {
  const [label, files] = arg.split("=");
  const runs = files.split(",").map((f) => JSON.parse(fs.readFileSync(f, "utf8")).rows);
  cols.push([label, runs.map(metrics)]);
  if (label === "A" || label === "B") cols.push([`${label}+C`, runs.map((r) => metrics(r.map(withoutIdCondition)))]);
}

const fmt = (vals, d) => {
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return `${mean.toFixed(1)}/${d} (${Math.min(...vals)}–${Math.max(...vals)})`;
};
console.log(`지표 (평균/전체 (최소–최대), 변형당 ${cols[0][1].length}회) | ` + cols.map((c) => c[0]).join(" | "));
console.log(["---", ...cols.map(() => "---")].join(" | "));
for (const [name, key, d] of ROWS) console.log([name, ...cols.map(([, ms]) => fmt(ms.map((m) => m[key]), d))].join(" | "));
console.log(["평균 답변 시간(초)", ...cols.map(([, ms]) => (ms.reduce((s, m) => s + m.ms, 0) / ms.length).toFixed(2))].join(" | "));
