// STEP 5 관찰 실습: 여러 유형의 질문에 대한 top-3 결과와 점수를 표로 기록한다.
// 실행(프로젝트 루트에서): node scripts/observe-step5.mjs 결과파일.txt
import fs from "node:fs";
import { search, WEAK_THRESHOLD } from "../src/search.mjs";

// [유형, 질문, 기대 청크(정답으로 인정). 없으면 []]
const Q = [
  ["정상", "새 이미지는 언제 올라와요?", ["NE-003"]],
  ["정상", "광고 문의는 어디로 하면 돼요?", ["NE-009"]],
  ["단어가 안 겹침", "며칠마다 새 그림 볼 수 있어요?", ["NE-003"]],
  ["단어가 안 겹침", "손으로 그린 건가요, 기계가 만든 건가요?", ["NE-007", "NE-001"]],
  ["비슷한 것 구분", "굿즈 팔아요?", ["NE-011"]],
  ["비슷한 것 구분", "그림 의뢰하고 싶어요", ["NE-011"]],
  ["비슷한 것 구분", "배경화면으로 써도 돼요?", ["NE-010"]],
  ["비슷한 것 구분", "쇼핑몰 광고에 이미지 써도 되나요?", ["NE-010"]],
  ["경계(답하지 않는 것)", "실명이 뭐예요?", ["NE-012"]],
  ["경계(답하지 않는 것)", "인스타 말고 카톡으로 얘기해요", ["NE-012"]],
  ["경계(답하지 않는 것)", "연락처 알려주세요", ["NE-012"]],
  ["도메인 안, 자료에 없음", "노을은 어떤 AI 모델로 만들었나요?", []],
  ["도메인 안, 자료에 없음", "다음 시즌 주제가 뭐예요?", []],
  ["도메인 안, 자료에 없음", "라이브 질문은 어떻게 보내요?", []],
  ["무관", "내일 날씨 어때?", []],
  ["무관", "김치찌개 레시피 알려줘", []],
  ["실제 DM 말투", "노을 새 사진 언제 올려?? ㅠㅠ 기다리는중", ["NE-003"]],
  ["실제 DM 말투", "굿즈 파는거 있나여", ["NE-011"]],
  ["실제 DM 말투", "굿즈", ["NE-011"]],
  ["실제 DM 말투", "안녕하세요!", []],
  ["실제 DM 말투(영어)", "When do you post new images?", ["NE-003"]],
  ["실제 DM 말투(복합)", "굿즈도 팔고 광고 문의도 받아요?", ["NE-011", "NE-009"]],
];

const lines = [];
const log = (s = "") => lines.push(s);
log("유형 | 질문 | 정답 인정 | 1위 | 2위 | 3위 | ⚠ | 1위 정답?");
log("---|---|---|---|---|---|---|---");
const rows = [];
for (const [kind, q, expect] of Q) {
  const hits = await search(q, 3);
  const weak = hits[0].score < WEAK_THRESHOLD;
  const hit = expect.length
    ? (expect.includes(hits[0].id) ? "O" : (hits.some((h) => expect.includes(h.id)) ? "3위 안" : "X"))
    : "-";
  const f = (h) => `${h.id} ${h.score.toFixed(3)} (${h.section})`;
  log(`${kind} | ${q} | ${expect.join("/") || "-"} | ${f(hits[0])} | ${f(hits[1])} | ${f(hits[2])} | ${weak ? "⚠" : ""} | ${hit}`);
  rows.push({ kind, q, expect, hits, weak, hit });
}
log("");
const withExpect = rows.filter((r) => r.expect.length);
log(`기대 청크가 있는 질문 ${withExpect.length}개: 1위 정답 ${withExpect.filter((r) => r.hit === "O").length}, 3위 안 ${withExpect.filter((r) => r.hit === "3위 안").length}, 놓침 ${withExpect.filter((r) => r.hit === "X").length}`);
log(`⚠(1위 < ${WEAK_THRESHOLD})가 뜬 질문: ${rows.filter((r) => r.weak).map((r) => `"${r.q}"`).join(", ") || "없음"}`);
fs.writeFileSync(process.argv[2], lines.join("\n") + "\n", "utf8");
console.log("saved", process.argv[2]);
