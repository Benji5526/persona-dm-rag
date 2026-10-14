// 시스템 메시지와 프롬프트 조립. 내용은 CLAUDE.md의 "생성 계약"을 그대로 옮긴 것이다.
import { WEAK_THRESHOLD } from "./search.mjs";

export const SYSTEM_MESSAGE = [
  "당신은 AI 페르소나 '노을'입니다. 팬이 보낸 DM에 대한 답변 초안을 노을의 말투로 씁니다.",
  "존댓말(해요체)로 따뜻하고 차분하게 2~3문장으로 답하고, 이모지는 한 개까지만 씁니다.",
  "주어진 자료에 질문의 답이 직접 적혀 있을 때만 그 내용으로 답하고, 없거나 확실하지 않으면 지어내지 말고 '확인한 뒤에 답변드릴게요'라고 답합니다.",
  "자료에 없어도 항상 지킵니다: 개인정보를 묻거나 알려 주지 않고, 실제 만남과 사적인 연락처를 주고받자는 요청(다른 메신저로 옮기자는 말 포함)과 의료·법률·금융 조언은 정중히 거절하며, 사람인 것처럼 말하지 않습니다.",
  "근거가 된 자료의 ID만 [NE-003]처럼 대괄호로 감싸 해당 문장 끝에 표시합니다.",
].join(" ");

const INTRO = "다음 자료는 노을의 페르소나 설정과 응대 규칙에서 뽑은 조각입니다.";
const GROUNDING_NORMAL =
  "자료에 질문의 답이 직접 적혀 있을 때만 그 내용으로 답하고, 없으면 '확인한 뒤에 답변드릴게요'라고 말합니다.";
const GROUNDING_WEAK =
  "주의: 검색된 조각의 유사도가 낮습니다. 질문과 맞는 근거가 아닐 수 있으니, 근거에 있는 내용만 짧게 답하고 자료에 없으면 '확인한 뒤에 답변드릴게요'라고 말합니다.";
const CITE_RULE = "근거가 된 조각의 ID만 [NE-003]처럼 대괄호로 감싸 해당 문장 끝에 표시합니다.";
const CITE_REMINDER = "(답할 때 근거로 쓴 자료의 ID를 [NE-003]처럼 문장 끝에 붙입니다.)";

// 현재 시각을 한국 시간으로. 예: "2026년 10월 15일 목요일 09:00"
// 24시간제를 쓴다: 12시간제의 "오전 12:36"(자정 직후)은 작은 모델이 정오로 읽을 위험이 있다.
function nowKST(now = new Date()) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
}

// 문구 묶음. 기본값은 CLAUDE.md 생성 계약이다. 실험(scripts/run-experiment.mjs)에서만 일부를 덮어쓴다.
export const DEFAULT_PARTS = {
  system: SYSTEM_MESSAGE,
  intro: INTRO,
  groundingNormal: GROUNDING_NORMAL,
  groundingWeak: GROUNDING_WEAK,
  citeRule: CITE_RULE,
  citeReminder: CITE_REMINDER,
};

// hits: search()의 결과(점수 내림차순). 1위 점수가 기준 미만이면 근거 원칙이 "약한 근거" 문구로 바뀐다.
// parts: 실험용으로 문구 일부를 덮어쓴다(기본 {}).
export function buildPrompt(question, hits, now = new Date(), parts = {}) {
  const p = { ...DEFAULT_PARTS, ...parts };
  const weak = hits[0].score < WEAK_THRESHOLD;
  const head = [
    p.intro, // ① 자료 소개
    weak ? p.groundingWeak : p.groundingNormal, // ② 근거 원칙
    p.citeRule, // ③ 출처 규칙
    `현재 시각은 ${nowKST(now)}(KST)입니다. '오늘', '내일', '다음 주' 같은 상대 표현은 이 시각을 기준으로 해석합니다.`, // ④ 시각
  ].join("\n");
  const material = hits.map((h) => `[${h.id}] (${h.section}) ${h.text}`).join("\n\n"); // ⑤ 자료 (대괄호 안에는 ID만)
  return `${head}\n\n[자료]\n${material}\n\n[질문]\n${question}\n\n${p.citeReminder}`; // ⑥ 질문, ⑦ 출처 규칙 한 번 더
}

export function buildMessages(question, hits, now = new Date(), parts = {}) {
  const p = { ...DEFAULT_PARTS, ...parts };
  return [
    { role: "system", content: p.system },
    { role: "user", content: buildPrompt(question, hits, now, parts) },
  ];
}
