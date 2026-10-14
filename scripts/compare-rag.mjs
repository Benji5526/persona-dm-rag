// STEP 8 필수 비교: 같은 질문을 "RAG 없이"(--no-rag와 같은 방식)와 "RAG로"(채택된 기본 프롬프트) 각각 3번씩 돌려 기록한다.
// RAG 없는 쪽은 검색도 시스템 메시지도 없이 질문만 LLM에 보낸다. 같은 입력에서도 답이 달라지므로 3번을 본다.
// 핵심 사실 검사는 거친 정규식이다(라이브: 자료는 "밤 10시에 30분 동안"이므로 "10시 30분에"를 정답으로 치지 않는다). 최종 판정은 답변을 읽고 한다.
// 실행(프로젝트 루트에서): node scripts/compare-rag.mjs 결과.json
import fs from "node:fs";
import { ask } from "../src/ask.mjs";
import { pingOllama, OLLAMA_CHECK_HINT } from "../src/ollama.mjs";

// [유형, 질문, 자료에 있는 핵심 사실을 확인하는 정규식(없으면 null)]
const Q = [
  ["정상(일정)", "새 이미지는 언제 올라와요?", (a) => /월/.test(a) && /수/.test(a) && /금/.test(a) && /(저녁\s*)?8\s*시/.test(a)],
  ["구체 사실(연락처)", "광고 문의는 어디로 하면 돼요?", (a) => /collab@noeul\.example/.test(a)],
  ["정책(굿즈)", "굿즈 팔아요?", (a) => /(굿즈|판매).{0,15}(없|않|아니|이용할 수 없)/.test(a) && !/굿즈.{0,6}(팔 수 있|판매할 수 있)/.test(a)],
  ["일정(라이브)", "라이브는 언제 해요?", (a) => /첫째\s*토요일/.test(a) && /10\s*시에?\s*30\s*분\s*동안/.test(a)],
  ["정체", "노을은 사람이에요?", (a) => /노을/.test(a) && /(AI|인공지능)/.test(a) && /(사람이 아니|사람이 아닙|AI 페르소나)/.test(a)],
  ["경계(개인정보)", "실명이 뭐예요?", null],
  ["자료에 없음", "노을은 어떤 AI 모델로 만들었나요?", null],
  ["무관", "내일 날씨 어때?", null],
];

if (!(await pingOllama())) {
  console.error(OLLAMA_CHECK_HINT);
  process.exit(1);
}

const TIMES = ["2026-10-15T00:45:00+09:00", "2026-10-15T00:46:00+09:00", "2026-10-15T00:47:00+09:00"];
const out = [];
for (const [kind, q, fact] of Q) {
  const noRag = [];
  const rag = [];
  for (const t of TIMES) {
    const a = await ask(q, { rag: false });
    noRag.push({ answer: a.answer, ms: a.answerMs });
    const b = await ask(q, { rag: true, now: new Date(t) });
    rag.push({
      answer: b.answer,
      ms: b.answerMs,
      hits: b.hits.map((h) => `${h.id} ${h.score.toFixed(3)}`),
      cited: [...b.analysis.cited],
      hold: b.analysis.hold,
      weak: b.analysis.weak,
    });
  }
  out.push({
    kind,
    q,
    noRag,
    rag,
    factNoRag: fact ? noRag.filter((r) => fact(r.answer)).length : null,
    factRag: fact ? rag.filter((r) => fact(r.answer)).length : null,
  });
  process.stdout.write(".");
}
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2), "utf8");
console.log(`\nsaved ${process.argv[2]}`);
