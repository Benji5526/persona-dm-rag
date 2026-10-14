// [2단계] 질문 → 검색 → 프롬프트 조립 → Ollama 답변 → 근거 목록과 운영자 표시.
// 사용법: node src/ask.mjs "질문" [--k 3] [--show-prompt] [--no-rag]
//   --show-prompt: 조립된 system/user 메시지를 출력하고 끝낸다(Ollama 없이도 동작)
//   --no-rag:      검색과 시스템 메시지 없이 질문만 LLM에 보낸다(RAG 비교 실험용)
import { pathToFileURL } from "node:url";
import { search, WEAK_THRESHOLD } from "./search.mjs";
import { buildMessages } from "./prompt.mjs";
import { pingOllama, chatStream, OLLAMA_CHECK_HINT } from "./ollama.mjs";

const HOLD_PHRASE = "확인한 뒤에 답변드릴게요";

// 답변을 분석한다. 근거 표시와 운영자 확인 여부는 LLM이 아니라 프로그램이 판단한다(CLAUDE.md 생성 계약).
// opts(실험용): holdMarker = 보류를 알리는 표시 글자(없으면 보류 문구로 판단), idCondition = "ID 없음"을 운영자 확인 조건에 넣을지(기본 true).
export function analyze(answer, hits, opts = {}) {
  const { holdMarker = null, idCondition = true } = opts;
  const weak = hits[0].score < WEAK_THRESHOLD;
  const cited = new Set(hits.filter((h) => answer.includes(h.id)).map((h) => h.id)); // 괄호 모양과 상관없이 ID 글자가 있으면 ✓
  const hold = holdMarker ? answer.includes(holdMarker) : answer.includes(HOLD_PHRASE);
  const reasons = [];
  if (weak) reasons.push("관련 자료가 약함");
  if (hold) reasons.push(holdMarker ? "모델이 자료에 답이 없다고 표시함" : "답변이 보류 문구를 포함함");
  if (idCondition && cited.size === 0) reasons.push("답변에 근거 ID 표시가 없음");
  return { weak, cited, hold, needsOperator: reasons.length > 0, reasons };
}

// 검색 → 프롬프트 → LLM. onHits(hits)는 검색 직후, onToken(조각)은 답변이 만들어지는 대로 부른다.
// now/parts/analyzeOpts는 실험용(시각 고정, 문구 덮어쓰기, 판정 방식). 기본값은 운영 동작 그대로다.
export async function ask(question, { k = 3, rag = true, onHits, onToken, now, parts, analyzeOpts } = {}) {
  let hits = null;
  let messages = [{ role: "user", content: question }];
  const t0 = Date.now();
  if (rag) {
    hits = await search(question, k);
    messages = buildMessages(question, hits, now, parts);
    onHits?.(hits);
  }
  const searchMs = Date.now() - t0;
  const t1 = Date.now();
  const answer = await chatStream(messages, onToken);
  const answerMs = Date.now() - t1;
  return { hits, answer, analysis: hits ? analyze(answer, hits, analyzeOpts) : null, searchMs, answerMs };
}

async function main() {
  const args = process.argv.slice(2);
  let k = 3;
  let showPrompt = false;
  let rag = true;
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--k") {
      k = Number(args[++i]);
      if (!Number.isInteger(k) || k < 1) {
        console.error("--k 는 1 이상의 정수여야 합니다.");
        process.exit(1);
      }
    } else if (args[i] === "--show-prompt") {
      showPrompt = true;
    } else if (args[i] === "--no-rag") {
      rag = false;
    } else {
      rest.push(args[i]);
    }
  }
  const question = rest.join(" ").trim();
  if (!question) {
    console.error('사용법: node src/ask.mjs "질문" [--k 3] [--show-prompt] [--no-rag]');
    process.exit(1);
  }

  if (showPrompt) {
    const hits = await search(question, k);
    for (const m of buildMessages(question, hits)) console.log(`[${m.role}]\n${m.content}\n`);
    return;
  }

  // LLM을 호출하기 직전에만 Ollama 연결을 확인한다
  if (!(await pingOllama())) {
    console.error(OLLAMA_CHECK_HINT);
    process.exit(1);
  }

  let result;
  if (!rag) console.log("💬 답변"); // RAG가 있으면 검색 결과를 보여 준 뒤 onHits에서 찍는다
  try {
    result = await ask(question, {
      k,
      rag,
      onHits: (hits) => {
        console.log("🔎 검색 결과");
        for (const h of hits) console.log(`${h.id} ${h.score.toFixed(3)} ${h.section}`);
        if (hits[0].score < WEAK_THRESHOLD) console.log(`⚠ 관련 자료가 약함(<${WEAK_THRESHOLD})`);
        console.log("💬 답변");
      },
      onToken: (t) => process.stdout.write(t),
    });
  } catch (e) {
    console.error(`\n${e.message}`);
    process.exit(1);
  }
  console.log("");

  if (rag) {
    const { hits, analysis: a } = result;
    console.log("📚 근거 (LLM에게 넘긴 자료 · ✓ = 답변에 ID가 표시된 자료)");
    for (const h of hits) console.log(`${a.cited.has(h.id) ? "✓" : " "} ${h.id} ${h.section} ${h.url}`);
    if (a.weak) console.log("⚠ 관련 자료가 약해 이 자료들을 답변의 근거로 보기 어렵습니다");
    else if (a.cited.size === 0) console.log("(답변에 ID 표시가 없습니다. 위 자료와 답변을 비교해 확인하세요)");
    if (a.needsOperator) console.log(`⚑ 운영자 확인 필요: ${a.reasons.join(", ")}`);
    console.log(`⏱ 검색 ${(result.searchMs / 1000).toFixed(1)}초 · 답변 ${(result.answerMs / 1000).toFixed(1)}초`);
  } else {
    console.log(`⏱ 답변 ${(result.answerMs / 1000).toFixed(1)}초`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
