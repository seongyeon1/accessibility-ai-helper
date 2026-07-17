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

AI 심화 분석을 서버 환경변수로 쓰려면 다음 중 하나를 설정합니다.

```bash
export CODEX_AUTH_TOKEN="your_token"
# 또는
export OPENAI_API_KEY="your_api_key"
npm start
```

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
