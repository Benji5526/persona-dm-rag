// STEP 7 관찰: 질문 여러 개를 ask()로 실행해 답변과 근거·운영자 표시를 기록한다. (CLI와 같은 코드 경로)
// 실행(프로젝트 루트에서): node scripts/run-step7.mjs 결과파일.md
import fs from "node:fs";
import { ask } from "../src/ask.mjs";
import { WEAK_THRESHOLD } from "../src/search.mjs";
import { pingOllama, OLLAMA_CHECK_HINT } from "../src/ollama.mjs";

import { Q } from "./questions-step7.mjs";

if (!(await pingOllama())) {
  console.error(OLLAMA_CHECK_HINT);
  process.exit(1);
}

// 말투를 대략 가늠하는 지표(자동). 정확도 판정은 사람이 답변을 읽고 한다.
function style(answer) {
  const sentences = answer.split(/(?<=[.!?])\s+/).filter((s) => s.trim());
  const emoji = (answer.match(/\p{Extended_Pictographic}/gu) || []).length;
  const hapsyo = sentences.filter((s) => /(습니다|입니다|니다)[.!?]?$/.test(s.trim())).length;
  const haeyo = sentences.filter((s) => /요[.!?]?$/.test(s.trim())).length;
  const third = /노을(은|이|께서|의)\s/.test(answer) || /(올리시|하십|않으십|계십)/.test(answer);
  return { sentences: sentences.length, emoji, hapsyo, haeyo, third };
}

const out = [];
const log = (s = "") => out.push(s);
const summary = [];
for (const [kind, q] of Q) {
  const r = await ask(q, {});
  const a = r.analysis;
  const st = style(r.answer);
  summary.push({ kind, q, a, st, r });
  log(`### [${kind}] ${q}`);
  log(`- 검색: ${r.hits.map((h) => `${h.id} ${h.score.toFixed(3)}`).join(", ")}${a.weak ? " (⚠ 약함)" : ""}`);
  log(`- 답변: ${r.answer.replace(/\n+/g, " ")}`);
  log(`- 근거 ✓: ${[...a.cited].join(", ") || "없음"} | 보류 문구: ${a.hold ? "있음" : "없음"} | ⚑ 운영자 확인: ${a.needsOperator ? a.reasons.join(", ") : "아님"}`);
  log(`- 말투 지표: 문장 ${st.sentences}, 이모지 ${st.emoji}, 합쇼체 ${st.hapsyo}문장, 해요체 ${st.haeyo}문장, 3인칭·높임 표현 ${st.third ? "있음" : "없음"} | ⏱ 답변 ${(r.answerMs / 1000).toFixed(1)}초`);
  log("");
  process.stdout.write(".");
}

const n = summary.length;
const count = (f) => summary.filter(f).length;
log("## 집계 (자동 지표. 내용의 정확성은 사람이 읽고 판정한다)");
log(`- 질문 ${n}개, ⚠ 기준 ${WEAK_THRESHOLD}`);
log(`- 답변에 근거 ID가 하나라도 있음: ${count((s) => s.a.cited.size > 0)}/${n}`);
log(`- 보류 문구가 있는 답변: ${count((s) => s.a.hold)}/${n}`);
log(`- ⚑ 운영자 확인이 붙은 답변: ${count((s) => s.a.needsOperator)}/${n}`);
log(`- 이모지가 2개 이상(규칙 위반): ${count((s) => s.st.emoji > 1)}/${n}`);
log(`- 문장이 4개 이상(규칙 위반): ${count((s) => s.st.sentences > 3)}/${n}`);
log(`- 합쇼체 문장이 있는 답변(해요체 규칙에서 벗어남): ${count((s) => s.st.hapsyo > 0)}/${n}`);
log(`- 3인칭·높임 표현이 있는 답변(노을이 자기를 높임): ${count((s) => s.st.third)}/${n}`);
fs.writeFileSync(process.argv[2], out.join("\n") + "\n", "utf8");
console.log("\nsaved", process.argv[2]);
