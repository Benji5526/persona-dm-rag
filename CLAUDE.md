# 페르소나 DM 안내 챗봇 (로컬 RAG)

## 제품
- 가상의 AI 페르소나를 운영하는 사람(운영자)이, 팬이 보낸 DM에 답하기 전에 쓰는 도구다.
팬의 DM 질문이 들어오면, 페르소나 자료(프로필, 활동 일정, 협업·문의 정책, FAQ 등)에서 근거를 찾아
**페르소나 말투의 답변 초안**을 만든다. 운영자가 초안을 확인한 뒤 직접 보낸다(자동 발송 없음).
- 페르소나는 이 과제를 위해 새로 만든 가상 인물 "노을(Noeul)"이다(AI 페르소나, 밤 산책 큐레이터).
실제 인물이나 기존 프로젝트의 비공개 설정을 쓰지 않는다.
- 근거가 없거나 약한 질문은 지어내서 답하지 않고, "확인 후 답변드릴게요"처럼 보류하고 운영자에게 넘긴다.
- 1단계: 질문과 비슷한 자료를 찾아 보여 준다. 2단계: 찾은 자료 + 질문을 LLM에 넣어 답변 초안을 만든다.

## 비목표
- 실제 SNS 연동과 자동 발송. 웹 화면, 서버, 배포. 로그인.
- 대화 이력과 팬 기억(이전 DM을 기억하기). 질문은 하나씩 독립적으로 처리한다.
- 실제 팬 데이터, 실제 인물 이미지·이름.
- 이미지 생성 등 다른 프로젝트의 기능. 이 폴더는 그 프로젝트와 별개다.

## 환경
- 내 PC에서만 실행한다. Node.js로 만들고 PowerShell 터미널에서 실행한다.
- LLM은 Ollama의 `qwen3.5:2b`.
- 이 폴더는 공개 GitHub 저장소로 제출한다. 비공개 정보를 넣지 않는다.

## 작업 규칙
- 내가 요청한 것만 만든다. 내가 정하지 않은 기능이나 기술 결정을 몰래 넣지 않는다.
- 모르는 사실이나 URL은 지어내지 않는다. 확인하지 못한 것은 [검증 필요]로 표시한다.
- 만들고 나면 직접 실행해 보고, 결과를 같이 보여 준다.
- git commit과 push는 내가 시킬 때만 한다.

## 데이터 계약
- 자료의 원본은 `docs/persona.md`다. `##` 절 하나가 청크 하나이며, 내용을 고칠 때는 persona.md를 먼저 고치고 청크를 다시 만든다.
- 청크 목록은 `data/chunks.json`, 배열이고 각 항목은 `{ id, text, url, section }`.
- id는 `NE-001`부터 연속(NE = Noeul). 한 번 붙인 id의 뜻은 바꾸지 않는다.
- text는 그 절의 내용이며 최소 120자, 사실 하나. `docs/persona.md`에 없는 말을 보태지 않는다.
- url은 `docs/persona.md#제목`(제목의 공백은 하이픈). section은 절 제목.
- 말투는 청크가 아니라 `docs/tone.md`에 둔다(STEP 6에서 시스템 메시지를 쓸 때 참고).

## 임베딩 계약
- 모델 `onnx-community/embeddinggemma-300m-ONNX`, dtype `q8`, transformers.js(`@huggingface/transformers`)로 Node.js에서 실행, 768차원.
- **벡터 만드는 방법은 모델 카드의 공식 방식**이다: `AutoTokenizer` + `AutoModel`을 불러 `tokenizer([text], { padding: true })`를 넣고,
출력의 `sentence_embedding`을 그대로 쓴다(이미 크기 1). `pipeline("feature-extraction")` + mean pooling은 쓰지 않는다.
이유: 두 방식의 벡터는 서로 호환되지 않고(같은 문서의 코사인 0.004), 공식 방식이 질문 구분이 더 뚜렷했다(`docs/embedding-experiment.md`).
- 입력 형식(모델 카드): 문서는 `"title: " + section + " | text: " + text`, 질문은 `"task: search result | query: " + question`.
- `src/embedder.mjs` 한 곳에서만 정의하고 모델은 한 번만 불러와 재사용한다. export: `embedDocument(chunk)`, `embedQuery(question)`, `MODEL`, `DTYPE`, `METHOD`, `DIM`.
- 벡터 저장소 `data/vectors.json`은 `{ model, dtype, method, dim, createdAt, chunks: [{ id, text, url, section, vector }] }`.
저장소의 model·dtype·method가 현재 embedder와 다르면 검색을 거부하고 "build-index를 다시 실행하라"고 안내한다.
- 이 계약의 값을 바꾸면 모든 청크를 다시 임베딩해야 한다.

## 검색 계약
- 벡터는 정규화되어 있으므로 코사인 유사도 = 내적. 점수 내림차순 top-k, 기본 3(`--k`로 변경).
- 약한 근거 기준 `WEAK_THRESHOLD = 0.25`는 `src/search.mjs`에서만 정의·export하고 다른 파일은 import한다.
1위 점수가 이보다 낮으면 "관련 자료가 약함"으로 표시한다. 결과는 버리지 않는다.
근거와 한계: `docs/search-threshold-experiment.md`. 0.55 같은 수업 가이드의 값은 다른 임베딩 방식의 값이라 쓰지 않는다.
- **점수로는 "자료에 없는 노을 질문"을 걸러낼 수 없다**(측정에서 8/8이 기준을 넘음). 그런 질문은 STEP 6의 LLM 규칙으로 다룬다.
- 벡터 저장소의 model·dtype·method가 embedder와 다르면 검색을 거부하고 `build-index`를 다시 실행하라고 안내한다.
- `search.mjs`는 다른 파일이 `search()`를 import해도 CLI가 실행되지 않게, 직접 실행됐을 때만 CLI를 돈다.

## 결정 필요
- LLM에게 어떤 규칙(시스템 메시지)을 줄까? (페르소나 말투, 근거 원칙, 보류 문구)
- 답변 초안의 길이와 형식은? 운영자에게 넘길 때 어떤 표시를 할까?
