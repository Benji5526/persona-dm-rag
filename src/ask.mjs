// [2단계] 질문 → 검색 → 프롬프트 조립 → (STEP 7에서) LLM 답변.
// 사용법: node src/ask.mjs "질문" [--k 3] [--show-prompt]
// --show-prompt: 조립된 system/user 메시지를 그대로 출력하고 끝낸다. Ollama 없이도 동작한다.
import { pathToFileURL } from "node:url";
import { search } from "./search.mjs";
import { buildMessages } from "./prompt.mjs";

async function main() {
  const args = process.argv.slice(2);
  let k = 3;
  let showPrompt = false;
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
    } else {
      rest.push(args[i]);
    }
  }
  const question = rest.join(" ").trim();
  if (!question) {
    console.error('사용법: node src/ask.mjs "질문" [--k 3] [--show-prompt]');
    process.exit(1);
  }

  const hits = await search(question, k);
  const messages = buildMessages(question, hits);

  if (showPrompt) {
    for (const m of messages) {
      console.log(`[${m.role}]\n${m.content}\n`);
    }
    return;
  }

  // LLM 호출은 STEP 7에서 만든다.
  console.error("LLM 답변은 아직 구현되지 않았습니다(STEP 7). 조립된 프롬프트는 --show-prompt로 확인하세요.");
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
