// STEP 8 실험 변형. 기본(baseline)에서 한 번에 한 곳만 바꾼다. 운영 코드(src/)의 기본 동작은 바꾸지 않는다.
import { DEFAULT_PARTS } from "../src/prompt.mjs";

const OLD_SYSTEM_HOLD = "지어내지 말고 '확인한 뒤에 답변드릴게요'라고 답합니다.";

function mustReplace(text, from, to) {
  if (!text.includes(from)) throw new Error(`교체할 문구를 찾지 못했습니다: ${from}`);
  return text.replace(from, to);
}

// A: 보류 문구의 중복을 없앤다. 시스템 메시지에서 문구를 빼고(→ "모른다고 답합니다"), 근거 원칙(②)에만 남긴다.
const SYSTEM_A = mustReplace(DEFAULT_PARTS.system, OLD_SYSTEM_HOLD, "지어내지 말고 모른다고 답합니다.");

// B: 보류 판단을 프로그램이 한다. 모델은 자료에 답이 없으면 [답 없음]만 쓰고, 프로그램이 이를 보류 응답과 ⚑ 표시로 바꾼다.
//    (A의 변경은 유지하고, 보류 문구 대신 표시 글자를 쓰게 한다.)
export const HOLD_MARKER = "[답 없음]";
const SYSTEM_B = mustReplace(DEFAULT_PARTS.system, OLD_SYSTEM_HOLD, `지어내지 말고 ${HOLD_MARKER}이라고만 씁니다.`);
const GROUNDING_NORMAL_B = `자료에 질문의 답이 직접 적혀 있을 때만 그 내용으로 답합니다. 직접 적혀 있지 않으면 다른 말 없이 ${HOLD_MARKER}이라고만 씁니다.`;
const GROUNDING_WEAK_B = `주의: 검색된 조각의 유사도가 낮습니다. 질문과 맞는 근거가 아닐 수 있습니다. 근거에 직접 적혀 있는 내용만 짧게 답하고, 직접 적혀 있지 않으면 다른 말 없이 ${HOLD_MARKER}이라고만 씁니다.`;

export const VARIANTS = {
  baseline: { parts: {}, analyzeOpts: {} },
  A: { parts: { system: SYSTEM_A }, analyzeOpts: {} },
  B: {
    parts: { system: SYSTEM_B, groundingNormal: GROUNDING_NORMAL_B, groundingWeak: GROUNDING_WEAK_B },
    analyzeOpts: { holdMarker: HOLD_MARKER },
  },
};
