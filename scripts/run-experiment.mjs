// STEP 8 실험 실행기: 같은 질문 20개를 한 변형으로 돌려 JSON으로 저장한다.
// 시각을 고정해 변형끼리 입력이 같게 한다(프롬프트의 현재 시각 줄이 분마다 달라지는 것을 막음).
// 실행(프로젝트 루트에서): node scripts/run-experiment.mjs <baseline|A|B> 결과.json
import fs from "node:fs";
import { ask } from "../src/ask.mjs";
import { pingOllama, OLLAMA_CHECK_HINT } from "../src/ollama.mjs";
import { Q } from "./questions-step7.mjs";
import { VARIANTS } from "./experiment-variants.mjs";

const [name, outPath] = process.argv.slice(2);
if (!VARIANTS[name] || !outPath) {
  console.error(`사용법: node scripts/run-experiment.mjs <${Object.keys(VARIANTS).join("|")}> 결과.json [시각]`);
  process.exit(1);
}
if (!(await pingOllama())) {
  console.error(OLLAMA_CHECK_HINT);
  process.exit(1);
}

const NOW = new Date(process.argv[4] ?? "2026-10-15T00:45:00+09:00"); // 기본: 목요일 00:45 KST (지난 STEP 7 관찰과 같은 요일). 4번째 인자로 바꿔 흔들림을 잴 수 있다
const { parts, analyzeOpts, askOpts = {} } = VARIANTS[name];
const rows = [];
for (const [i, [kind, q]] of Q.entries()) {
  const r = await ask(q, { now: NOW, parts, analyzeOpts, ...askOpts });
  const a = r.analysis;
  rows.push({
    no: i + 1,
    kind,
    q,
    hits: r.hits.map((h) => ({ id: h.id, score: Number(h.score.toFixed(3)) })),
    answer: r.answer,
    cited: [...a.cited],
    hold: a.hold,
    weak: a.weak,
    needsOperator: a.needsOperator,
    reasons: a.reasons,
    answerMs: r.answerMs,
  });
  process.stdout.write(".");
}
fs.writeFileSync(outPath, JSON.stringify({ variant: name, now: NOW.toISOString(), rows }, null, 2), "utf8");
console.log(`\nsaved ${outPath} (${rows.length}개)`);
