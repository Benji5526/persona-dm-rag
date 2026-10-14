// STEP 8 실험 변형. 기본(baseline)에서 한 번에 한 곳만 바꾼다. 운영 코드(src/)의 기본 동작은 이 파일이 바꾸지 않는다.
// 주의: 실험 A는 채택되어 src/prompt.mjs의 기본값이 되었다. 그래서 baseline은 "A 채택 전의 옛 문구"로 복원해 정의하고,
//       A는 현재 기본값 그대로다(실험 결과 experiments/*_00NN.json을 그대로 재현할 수 있다).
import { DEFAULT_PARTS } from "../src/prompt.mjs";

const NEW_HOLD = "지어내지 말고 모른다고 답합니다.";
const OLD_HOLD = "지어내지 말고 '확인한 뒤에 답변드릴게요'라고 답합니다.";

function mustReplace(text, from, to) {
  if (!text.includes(from)) throw new Error(`교체할 문구를 찾지 못했습니다: ${from}`);
  return text.replace(from, to);
}

// baseline: A 채택 전의 시스템 메시지(보류 문구가 시스템 메시지와 근거 원칙(②)에 모두 있음)
const SYSTEM_BASELINE = mustReplace(DEFAULT_PARTS.system, NEW_HOLD, OLD_HOLD);

// B: 보류 판단을 프로그램이 한다. 모델은 자료에 답이 없으면 [답 없음]만 쓰고, 프로그램이 이를 보류와 ⚑로 판단한다. (A의 변경을 유지)
export const HOLD_MARKER = "[답 없음]";
const SYSTEM_B = mustReplace(DEFAULT_PARTS.system, NEW_HOLD, `지어내지 말고 ${HOLD_MARKER}이라고만 씁니다.`);
const GROUNDING_NORMAL_B = `자료에 질문의 답이 직접 적혀 있을 때만 그 내용으로 답합니다. 직접 적혀 있지 않으면 다른 말 없이 ${HOLD_MARKER}이라고만 씁니다.`;
const GROUNDING_WEAK_B = `주의: 검색된 조각의 유사도가 낮습니다. 질문과 맞는 근거가 아닐 수 있습니다. 근거에 직접 적혀 있는 내용만 짧게 답하고, 직접 적혀 있지 않으면 다른 말 없이 ${HOLD_MARKER}이라고만 씁니다.`;

export const VARIANTS = {
  baseline: { parts: { system: SYSTEM_BASELINE }, analyzeOpts: {} },
  A: { parts: {}, analyzeOpts: {} }, // 채택됨 = 현재 기본값
  B: {
    parts: { system: SYSTEM_B, groundingNormal: GROUNDING_NORMAL_B, groundingWeak: GROUNDING_WEAK_B },
    analyzeOpts: { holdMarker: HOLD_MARKER },
  },
  // ---- 자료 확장(17청크) 뒤 "자료에 없음" 보류 후퇴를 줄이는 시험 (docs/hold-regression-test.md) ----
  // askOpts는 ask()에 그대로 넘긴다. 기준(A17)은 현재 기본값(A)이며 청크 17개에서 다시 돌린 것이다.
  A17: { parts: {}, analyzeOpts: {}, askOpts: {} },
  K2: { parts: {}, analyzeOpts: {}, askOpts: { k: 2 } }, // 찾는 자료를 2개로
  K4: { parts: {}, analyzeOpts: {}, askOpts: { k: 4 } }, // 찾는 자료를 4개로 (#15에서 NE-014가 4위로 다시 들어옴)
  PIN14: { parts: {}, analyzeOpts: {}, askOpts: { pin: ["NE-014"] } }, // NE-014(운영자 이관 기준)를 항상 포함
  NO16: { parts: {}, analyzeOpts: {}, askOpts: { exclude: ["NE-016"] } }, // NE-016(DM 답변 방식)만 빼고 3개를 채움 (K2와 달리 청크 수는 그대로)
};
