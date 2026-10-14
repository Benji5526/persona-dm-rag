// 임베딩 공통 모듈. 문서용·질문용 임베딩은 반드시 여기서만 만든다(CLAUDE.md 임베딩 계약).
// 방식: 모델 카드의 공식 방법. tokenizer + AutoModel 의 sentence_embedding 출력(이미 크기 1).
import { AutoTokenizer, AutoModel } from "@huggingface/transformers";

export const MODEL = "onnx-community/embeddinggemma-300m-ONNX";
export const DTYPE = "q8";
export const METHOD = "sentence_embedding";
export const DIM = 768;

let loading = null; // 모델은 한 번만 불러와 재사용한다
function load() {
  if (!loading) {
    console.log("임베딩 모델 불러오는 중…(첫 실행은 다운로드)");
    loading = Promise.all([
      AutoTokenizer.from_pretrained(MODEL),
      AutoModel.from_pretrained(MODEL, { dtype: DTYPE }),
    ]);
  }
  return loading;
}

async function embed(text) {
  const [tokenizer, model] = await load();
  const inputs = await tokenizer([text], { padding: true });
  const { sentence_embedding } = await model(inputs);
  return Array.from(sentence_embedding.data);
}

export function embedDocument(chunk) {
  return embed(`title: ${chunk.section} | text: ${chunk.text}`);
}

export function embedQuery(question) {
  return embed(`task: search result | query: ${question}`);
}
