# AI 접근성 도우미

사회적 약자의 정보 접근성을 높이기 위한 오픈소스 접근성 체크 도구입니다. 공공기관, 학교, 복지기관의 홈페이지 URL, 안내문, HTML, PDF, 문서, 이미지 파일을 넣으면 쉬운 말, 웹 접근성, 색 대비, 보안·개인정보 관점의 개선 지점을 찾아 리포트로 보여줍니다.

## 주요 기능

- 어려운 행정 용어와 긴 문장을 찾아 쉬운 표현을 제안합니다.
- 이미지 대체 텍스트 누락, 모호한 링크명, 제목 단계 건너뜀, 입력칸 라벨 누락을 점검합니다.
- 글자색과 배경색의 WCAG AA 색 대비 기준 통과 여부를 계산합니다.
- 문턱 점수, 영향받는 사용자 유형, 수정 제안을 한 화면에서 확인할 수 있습니다.
- 붙여넣은 안내문과 HTML을 더 쉬운 버전으로 자동 변환하고 원본과 개선안을 나란히 비교합니다.
- 홈페이지 URL을 서버에서 직접 가져와 HTML을 분석하고, 로컬 Chrome이 있으면 화면 캡처를 함께 제공합니다.
- HTML, 텍스트, 일부 PDF 텍스트 파일을 업로드해 즉시 분석합니다.
- 이미지, HWP, DOCX, 스캔 PDF는 AI 심화 분석 흐름으로 보낼 수 있습니다.
- `CODEX_AUTH_TOKEN`, `OPENAI_API_KEY`, 또는 화면의 세션 토큰으로 OpenAI Responses API 분석을 호출할 수 있습니다.

## 실행 방법

```bash
cd accessibility-ai-helper
npm test
npm start
```

브라우저에서 `http://127.0.0.1:4173`을 열면 됩니다.

## AI 토큰 설정

AI 심화 분석에는 OpenAI API 인증 토큰이 필요합니다. 일반적으로 직접 발급해서 사용하는 값은 `OPENAI_API_KEY`입니다.

### OpenAI API key 발급

1. [OpenAI API keys](https://platform.openai.com/api-keys)에 접속합니다.
2. OpenAI 계정으로 로그인합니다.
3. `Create new secret key`를 눌러 새 API key를 만듭니다.
4. 생성된 키는 다시 볼 수 없으므로 안전한 곳에 보관합니다.
5. 서버 실행 전에 환경변수로 설정합니다.

```bash
export OPENAI_API_KEY="your_api_key"
npm start
```

OpenAI 공식 문서는 API key를 안전한 위치에 보관하고, 서버의 환경변수나 키 관리 시스템에서 불러오도록 안내합니다. 브라우저에 직접 노출되는 코드에는 API key를 넣지 마세요.

### CODEX_AUTH_TOKEN은 어디서 받나요?

`CODEX_AUTH_TOKEN`은 별도의 공개 발급 페이지에서 사용자가 직접 만드는 토큰이 아닙니다. 이 프로젝트에서는 Codex나 자동화 실행 환경에서 이미 인증 토큰이 환경변수로 주입되어 있는 경우를 위해 호환용으로 지원합니다.

대부분의 로컬 실행/배포 환경에서는 `CODEX_AUTH_TOKEN` 대신 `OPENAI_API_KEY`를 사용하세요. 만약 사용하는 Codex 환경에서 `CODEX_AUTH_TOKEN`이 이미 제공된다면 다음처럼 실행할 수 있습니다.

```bash
export CODEX_AUTH_TOKEN="your_token"
npm start
```

화면의 `세션 토큰` 입력칸에 임시로 토큰을 넣어 테스트할 수도 있습니다. 이 값은 브라우저 저장소에 저장하지 않고 요청 헤더로만 전송됩니다.

## 프로젝트 구조

```text
accessibility-ai-helper/
  index.html
  styles.css
  src/
    analyzer.js
    app.js
    ingest.js
    server.js
  tests/
    analyzer.test.mjs
    ingest.test.mjs
```

## 향후 확장

- OCR을 연결해 이미지 안내문 속 텍스트를 점검합니다.
- PDF 텍스트 추출과 태그 구조 검사를 추가합니다.
- HWP, DOCX 구조 파서를 추가해 AI 없이도 더 많은 문서를 분석합니다.
- 기관별 리포트 PDF 내보내기와 개선 이력 저장 기능을 추가합니다.
