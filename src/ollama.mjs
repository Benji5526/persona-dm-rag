// Ollama 연결 확인과 스트리밍 호출 (CLAUDE.md 생성 계약).
// 브라우저가 아니라 Node.js가 localhost:11434로 직접 요청한다.
const BASE = "http://localhost:11434";
export const LLM_MODEL = "qwen3.5:2b";
export const OLLAMA_CHECK_HINT = "Ollama가 실행 중인지 확인하세요 (확인: curl.exe http://localhost:11434/api/tags)";

// GET /api/tags: 켜져 있으면 true
export async function pingOllama() {
  try {
    const res = await fetch(`${BASE}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

// POST /api/chat (stream). 토큰(글자 조각)이 올 때마다 onToken을 부르고, 전체 답변 문자열을 돌려준다.
export async function chatStream(messages, onToken) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages,
      stream: true,
      think: false,
      options: { temperature: 0 },
    }),
  });
  if (!res.ok) {
    throw new Error(`Ollama 오류 ${res.status}: ${await res.text()}`);
  }

  const decoder = new TextDecoder("utf-8"); // { stream: true }로 써서 한글이 조각 경계에서 깨지지 않게 한다
  let buffer = "";
  let full = "";

  const handleLine = (line) => {
    const text = line.trim();
    if (!text) return;
    const obj = JSON.parse(text); // 줄 하나가 JSON 하나(NDJSON)
    if (obj.error) throw new Error(`Ollama 오류: ${obj.error}`);
    const token = obj.message?.content ?? "";
    if (token) {
      full += token;
      onToken?.(token);
    }
  };

  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      handleLine(buffer.slice(0, nl));
      buffer = buffer.slice(nl + 1); // 덜 받은 줄은 버퍼에 남겨 다음 조각과 합친다
    }
  }
  buffer += decoder.decode(); // 남은 바이트 마무리
  handleLine(buffer);
  return full;
}
