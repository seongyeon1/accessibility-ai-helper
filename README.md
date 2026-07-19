# AI 접근성 도우미

사회적 약자의 정보 접근성을 높이기 위한 오픈소스 접근성 체크 도구입니다. 공공기관, 학교, 복지기관의 홈페이지 URL, 안내문, HTML, PDF, 문서, 이미지 파일을 넣으면 쉬운 말, 웹 접근성, 색 대비, 보안·개인정보 관점의 개선 지점을 찾아 리포트로 보여줍니다.

## 주요 기능

- 어려운 행정 용어와 긴 문장을 찾아 쉬운 표현을 제안합니다.
- 이미지 대체 텍스트 누락, 모호한 링크명, 제목 단계 건너뜀, 입력칸 라벨 누락을 점검합니다.
- 글자색과 배경색의 WCAG AA 색 대비 기준 통과 여부를 계산합니다.
- 문턱 점수, 영향받는 사용자 유형, 수정 제안을 한 화면에서 확인할 수 있습니다.
- 붙여넣은 안내문과 HTML을 더 쉬운 버전으로 자동 변환하고 원본과 개선안을 나란히 비교합니다.
- 유니버설디자인, WCAG, UDL 관점으로 결과를 다시 묶어 모두를 위한 설계 장벽을 보여줍니다.
- 홈페이지 URL을 서버에서 직접 가져와 HTML을 분석하고, 로컬 Chrome이 있으면 화면 캡처를 함께 제공합니다.
- HTML, 텍스트, 일부 PDF 텍스트 파일을 업로드해 즉시 분석합니다.
- 이미지, HWP, DOCX, 스캔 PDF는 AI 심화 분석 흐름으로 보낼 수 있습니다.
- OpenAI API, Anthropic API, Claude Code CLI 중 하나를 선택해 AI 심화 분석을 호출할 수 있습니다.

## 실행 방법

```bash
cd accessibility-ai-helper
npm test
npm start
```

브라우저에서 `http://127.0.0.1:4173`을 열면 됩니다.

## AI Provider와 토큰 설정

AI 심화 분석은 세 가지 방식 중 하나를 선택할 수 있습니다.

### 1. OpenAI API

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

### Codex 유료요금과 `CODEX_AUTH_TOKEN`

Codex 유료요금은 Codex 앱, CLI, IDE 같은 Codex 클라이언트에서 사용하는 권한/사용량입니다. 이 웹앱의 Node 서버가 OpenAI Responses API를 직접 호출할 때는 보통 `OPENAI_API_KEY`가 필요합니다. Codex에 로그인되어 있어도 그 로그인 토큰이 로컬 웹앱 서버로 자동 전달되지는 않습니다.

`CODEX_AUTH_TOKEN`은 별도의 공개 발급 페이지에서 사용자가 직접 만드는 토큰이 아닙니다. 이 프로젝트에서는 Codex나 자동화 실행 환경에서 이미 인증 토큰이 환경변수로 주입되어 있는 경우를 위해 호환용으로 지원합니다.

대부분의 로컬 실행/배포 환경에서는 `CODEX_AUTH_TOKEN` 대신 `OPENAI_API_KEY`를 사용하세요. Enterprise 환경에서 Codex access token이 제공되는 경우에는 Codex CLI 로그인용으로 쓰는 토큰이며, 일반 OpenAI API 호출용 key와는 다릅니다.

```bash
export CODEX_AUTH_TOKEN="your_token"
npm start
```

화면의 `토큰 또는 API key` 입력칸에 임시로 토큰을 넣어 테스트할 수도 있습니다. 이 값은 브라우저 저장소에 저장하지 않고 요청 헤더로만 전송됩니다.

### 2. Anthropic API

Claude API를 직접 쓰려면 [Anthropic Console](https://console.anthropic.com/)에서 API key를 발급하고 `ANTHROPIC_API_KEY`로 설정합니다.

```bash
export AI_PROVIDER="anthropic"
export ANTHROPIC_API_KEY="your_anthropic_api_key"
export ANTHROPIC_MODEL="claude-sonnet-5"
npm start
```

화면에서 Provider를 `Anthropic API`로 선택하면 서버의 `ANTHROPIC_API_KEY`를 사용합니다. 입력칸에 API key를 넣으면 해당 요청에만 헤더로 전달합니다.

### 3. Claude Code CLI

Claude Code 유료 구독이나 OAuth 로그인을 쓰고 싶다면 API key를 억지로 추출하지 말고 로컬 `claude` CLI를 사용하세요. 이 프로젝트의 `Claude Code CLI` Provider는 서버에서 `claude -p`를 실행해 이미 로그인된 Claude Code 세션을 사용합니다.

```bash
claude
```

Claude Code가 열리면 브라우저 로그인을 진행하거나, 필요하면 대화형 입력창에서 `/login`을 실행합니다. 로그인이 끝나면 Claude Code를 종료하고 서버를 실행합니다.

```bash
npm start
```

브라우저 로그인이 어려운 CI나 스크립트 환경에서는 Claude Code가 제공하는 토큰 설정 명령을 사용할 수 있습니다.

```bash
claude setup-token
export CLAUDE_CODE_OAUTH_TOKEN="generated_token"
npm start
```

그 다음 화면에서 Provider를 `Claude Code CLI`로 선택하고 AI 심화 분석을 누르면 됩니다. 이미 `claude` CLI가 로그인되어 있다면 토큰 입력칸은 비워둘 수 있습니다.

주의할 점:

- `ANTHROPIC_API_KEY`는 Anthropic API 직접 호출용입니다.
- `CLAUDE_CODE_OAUTH_TOKEN`은 Claude Code CLI/스크립트 실행용입니다.
- Claude Code의 로컬 로그인 파일이나 OS keychain에서 토큰을 강제로 읽어오는 방식은 안전하지 않으므로 지원하지 않습니다.

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
  skills/
    accessibility-ai-reviewer/
      SKILL.md
      agents/openai.yaml
  tests/
    analyzer.test.mjs
    ingest.test.mjs
```

## Codex/Claude Code Skill로 사용하기

`skills/accessibility-ai-reviewer/SKILL.md`는 이 프로젝트의 접근성 분석 절차를 재사용 가능한 Skill 형태로 정리한 파일입니다.

Codex에서 쓰려면 폴더째 복사합니다.

```bash
mkdir -p ~/.codex/skills
cp -R skills/accessibility-ai-reviewer ~/.codex/skills/
```

Claude Code에서도 Skill을 지원하는 환경이라면 같은 폴더를 Claude Code의 skills 경로에 복사해 사용할 수 있습니다. 이후 “접근성 리뷰어 스킬로 이 홈페이지/문서를 분석해줘”처럼 요청하면 쉬운 말, 웹 접근성, 보안·개인정보 위험, 변경 전/후 개선안을 같은 형식으로 받을 수 있습니다.

## 반영한 접근성 기준

- NC State Center for Universal Design의 7원칙: 공평한 사용, 유연한 사용, 단순하고 직관적인 사용, 인지 가능한 정보, 오류 허용, 적은 신체 부담, 충분한 크기와 공간.
- W3C WCAG 2.2의 4대 원칙: 인식 가능, 운용 가능, 이해 가능, 견고함.
- CAST UDL Guidelines 3.0의 3대 축: 참여, 표상, 행동과 표현의 다양한 방식.

앱에서는 이 기준을 결과 화면의 `모두를 위한 설계 점검` 패널에 반영합니다. 자동 검사 결과를 원칙별로 다시 묶어 “왜 문제가 되는지”와 “어떻게 바꿔야 하는지”를 사용자 관점으로 보여줍니다.

## 향후 확장

- OCR을 연결해 이미지 안내문 속 텍스트를 점검합니다.
- PDF 텍스트 추출과 태그 구조 검사를 추가합니다.
- HWP, DOCX 구조 파서를 추가해 AI 없이도 더 많은 문서를 분석합니다.
- 기관별 리포트 PDF 내보내기와 개선 이력 저장 기능을 추가합니다.
