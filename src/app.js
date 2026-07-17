import { analyzeAll, createImprovementPlan } from './analyzer.js';

const sample = {
  text: '본 사업은 취약계층의 복지급여 신청 절차를 간소화하기 위하여 관계기관의 심사를 거쳐 지원대상자를 선정합니다. 주민등록등본 및 소득증빙자료를 첨부하여야 하며 기한 내 미제출 시 접수가 반려될 수 있습니다.',
  html: `<main>
  <h1>복지 서비스 안내</h1>
  <h3>신청 방법</h3>
  <img src="notice.png">
  <a href="/apply">자세히</a>
  <input type="text">
</main>`,
  foreground: '#777777',
  background: '#ffffff'
};

const state = {
  report: null,
  improvementPlan: null,
  securityIssues: [],
  filter: 'all',
  source: {
    kind: 'paste',
    label: '샘플 문서',
    text: sample.text,
    html: sample.html,
    file: null,
    imageDataUrl: ''
  }
};

const form = document.querySelector('#checker-form');
const urlInput = document.querySelector('#url-input');
const fileInput = document.querySelector('#file-input');
const textInput = document.querySelector('#text-input');
const htmlInput = document.querySelector('#html-input');
const foregroundInput = document.querySelector('#foreground-input');
const backgroundInput = document.querySelector('#background-input');
const tokenInput = document.querySelector('#token-input');
const modelInput = document.querySelector('#model-input');
const scoreValue = document.querySelector('#score-value');
const scoreRing = document.querySelector('#score-ring');
const scoreLabel = document.querySelector('#score-label');
const scoreHelp = document.querySelector('#score-help');
const sourceMeta = document.querySelector('#source-meta');
const statusLine = document.querySelector('#status-line');
const summaryGrid = document.querySelector('#summary-grid');
const findingsList = document.querySelector('#findings-list');
const comparisonPanel = document.querySelector('#comparison-panel');
const originalPreview = document.querySelector('#original-preview');
const improvedPreview = document.querySelector('#improved-preview');
const comparisonMeta = document.querySelector('#comparison-meta');
const changeList = document.querySelector('#change-list');
const screenshotCard = document.querySelector('#screenshot-card');
const screenshotPreview = document.querySelector('#screenshot-preview');
const aiPanel = document.querySelector('#ai-panel');
const aiOutput = document.querySelector('#ai-output');
const aiModelLabel = document.querySelector('#ai-model-label');
const resetSample = document.querySelector('#reset-sample');
const analyzeUrlButton = document.querySelector('#analyze-url');
const analyzeFileButton = document.querySelector('#analyze-file');
const runAiReviewButton = document.querySelector('#run-ai-review');
const tabs = [...document.querySelectorAll('.tab')];
const modeTabs = [...document.querySelectorAll('.mode-tab')];
const modePanels = [...document.querySelectorAll('.mode-panel')];

form.addEventListener('submit', (event) => {
  event.preventDefault();
  runPasteAnalysis();
});

analyzeUrlButton.addEventListener('click', analyzeUrl);
analyzeFileButton.addEventListener('click', analyzeFile);
runAiReviewButton.addEventListener('click', runAiReview);

resetSample.addEventListener('click', () => {
  textInput.value = sample.text;
  htmlInput.value = sample.html;
  foregroundInput.value = sample.foreground;
  backgroundInput.value = sample.background;
  runPasteAnalysis();
});

for (const tab of tabs) {
  tab.addEventListener('click', () => {
    state.filter = tab.dataset.filter;
    for (const item of tabs) item.classList.toggle('is-active', item === tab);
    renderFindings();
  });
}

for (const tab of modeTabs) {
  tab.addEventListener('click', () => {
    const mode = tab.dataset.mode;
    for (const item of modeTabs) item.classList.toggle('is-active', item === tab);
    for (const panel of modePanels) panel.classList.toggle('is-active', panel.dataset.panel === mode);
  });
}

runPasteAnalysis();

function runPasteAnalysis() {
  const input = {
    text: textInput.value,
    html: htmlInput.value,
    foreground: foregroundInput.value,
    background: backgroundInput.value
  };
  state.source = {
    kind: 'paste',
    label: '직접 붙여넣은 내용',
    text: input.text,
    html: input.html,
    file: null,
    imageDataUrl: ''
  };
  applyAnalysis({
    report: analyzeAll(input),
    improvementPlan: createImprovementPlan(input),
    securityIssues: [],
    screenshot: null,
    sourceLabel: state.source.label
  });
}

async function analyzeUrl() {
  const url = urlInput.value.trim();
  if (!url) {
    setStatus('분석할 URL을 입력하세요.', true);
    return;
  }

  await withStatus('홈페이지 HTML을 가져오고 화면을 캡처하는 중입니다...', async () => {
    const result = await fetchJson(`/api/analyze-url?url=${encodeURIComponent(url)}`);
    state.source = {
      kind: 'website',
      label: result.finalUrl || url,
      text: result.text || '',
      html: result.html || '',
      file: null,
      imageDataUrl: result.screenshot || ''
    };
    applyAnalysis({
      ...result,
      sourceLabel: result.finalUrl || url
    });
  });
}

async function analyzeFile() {
  const file = fileInput.files?.[0];
  if (!file) {
    setStatus('분석할 파일을 선택하세요.', true);
    return;
  }

  await withStatus('파일을 읽고 분석하는 중입니다...', async () => {
    const base64 = await fileToBase64(file);
    const result = await postJson('/api/analyze-file', {
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      base64
    });
    state.source = {
      kind: result.kind,
      label: file.name,
      text: result.extraction?.text || '',
      html: result.kind === 'html' ? result.improvementPlan?.improved?.html || '' : '',
      file: {
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64
      },
      imageDataUrl: result.imageDataUrl || ''
    };
    applyAnalysis({
      ...result,
      sourceLabel: `${file.name} (${kindLabel(result.kind)})`
    });

    if (result.aiRecommended) {
      setStatus(`${file.name} 분석 완료. 이 파일 형식은 AI 심화 분석을 함께 쓰면 더 정확합니다.`);
    }
  });
}

async function runAiReview() {
  await withStatus('AI 모델로 심화 분석하는 중입니다...', async () => {
    const headers = {};
    if (tokenInput.value.trim()) headers['x-codex-auth-token'] = tokenInput.value.trim();

    const result = await postJson('/api/ai-review', {
      model: modelInput.value.trim() || 'gpt-5-mini',
      text: buildAiContextText(),
      file: state.source.file,
      imageDataUrl: state.source.imageDataUrl
    }, headers);

    aiPanel.hidden = false;
    aiModelLabel.textContent = result.model || '모델 응답';
    aiOutput.textContent = result.text || JSON.stringify(result.result, null, 2);
    setStatus('AI 심화 분석이 완료됐습니다.');
  });
}

function applyAnalysis({ report, improvementPlan, securityIssues = [], screenshot = null, sourceLabel = '' }) {
  state.report = report;
  state.improvementPlan = improvementPlan;
  state.securityIssues = securityIssues;

  sourceMeta.textContent = sourceLabel;
  renderScreenshot(screenshot);
  renderScore();
  renderSummaries();
  renderComparison();
  renderFindings();
  setStatus('분석 완료');
}

function renderScreenshot(screenshot) {
  if (!screenshot) {
    screenshotCard.hidden = true;
    screenshotPreview.removeAttribute('src');
    return;
  }

  screenshotCard.hidden = false;
  screenshotPreview.src = screenshot;
}

function renderScore() {
  const { score, findings } = state.report;
  scoreValue.textContent = String(score);
  scoreRing.style.borderColor = scoreColor(score);
  scoreRing.style.borderRightColor = '#f4d35e';

  if (score >= 85) {
    scoreLabel.textContent = '정보 문턱이 낮습니다';
    scoreHelp.textContent = '큰 문제는 적지만 실제 사용자 검토를 함께 진행하세요.';
  } else if (score >= 60) {
    scoreLabel.textContent = '몇 가지 문턱이 보입니다';
    scoreHelp.textContent = `${findings.length + state.securityIssues.length}개의 개선 지점을 먼저 정리해 보세요.`;
  } else {
    scoreLabel.textContent = '정보 접근 문턱이 높습니다';
    scoreHelp.textContent = '높음 항목부터 고치면 사회적 약자의 이해 부담을 빠르게 줄일 수 있습니다.';
  }
}

function renderSummaries() {
  const items = state.report.sections.map((section) => ({
    label: section.label,
    summary: section.summary
  }));

  if (state.securityIssues.length > 0) {
    items.push({
      label: '취약성 점검',
      summary: `보안·개인정보 관점에서 ${state.securityIssues.length}개의 확인 지점을 찾았습니다.`
    });
  }

  summaryGrid.replaceChildren(...items.map((section) => {
    const item = document.createElement('article');
    item.className = 'summary-item';

    const title = document.createElement('strong');
    title.textContent = section.label;

    const text = document.createElement('p');
    text.textContent = section.summary;

    item.append(title, text);
    return item;
  }));
}

function renderComparison() {
  const plan = state.improvementPlan;
  const originalText = [state.source.text, state.source.html].filter(Boolean).join('\n\n');
  const improvedText = [plan.improved.text, plan.improved.html].filter(Boolean).join('\n\n');

  originalPreview.textContent = originalText || '텍스트를 자동 추출하지 못했습니다. AI 심화 분석을 사용하세요.';
  improvedPreview.textContent = improvedText || '자동 개선안이 없습니다. AI 심화 분석을 사용하세요.';
  comparisonMeta.textContent = `문턱 점수 ${plan.before.score}점 -> ${plan.after.score}점`;
  comparisonPanel.style.setProperty('--before-score', `${plan.before.score}%`);
  comparisonPanel.style.setProperty('--after-score', `${plan.after.score}%`);

  if (plan.changes.length === 0) {
    const item = document.createElement('li');
    item.textContent = '자동 개선이 필요한 항목이 없거나 텍스트를 추출하지 못했습니다.';
    changeList.replaceChildren(item);
    return;
  }

  changeList.replaceChildren(...plan.changes.map((change) => {
    const item = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = change.title;
    const detail = document.createElement('span');
    detail.textContent = `${change.before} -> ${change.after}`;
    item.append(title, detail);
    return item;
  }));
}

function renderFindings() {
  const allFindings = [...state.report.findings, ...state.securityIssues];
  const filtered = allFindings.filter((finding) => {
    return state.filter === 'all' || finding.severity === state.filter;
  });

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = state.filter === 'all'
      ? '발견된 접근성 문제가 없습니다.'
      : '선택한 심각도에 해당하는 문제가 없습니다.';
    findingsList.replaceChildren(empty);
    return;
  }

  findingsList.replaceChildren(...filtered.map(renderFinding));
}

function renderFinding(finding) {
  const article = document.createElement('article');
  article.className = `finding ${finding.severity}`;

  const header = document.createElement('div');
  header.className = 'finding-header';

  const title = document.createElement('h3');
  title.textContent = finding.title;

  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = severityLabel(finding.severity);

  header.append(title, badge);

  const details = document.createElement('dl');
  addDetail(details, '영향', (finding.impact || []).join(', ') || '접근성/보안');
  addDetail(details, '근거', finding.evidence || finding.location || finding.ruleId);
  addDetail(details, '개선', finding.suggestion);

  article.append(header, details);
  return article;
}

function addDetail(list, term, value) {
  const dt = document.createElement('dt');
  dt.textContent = term;

  const dd = document.createElement('dd');
  dd.textContent = value || '-';

  list.append(dt, dd);
}

async function withStatus(message, task) {
  try {
    setStatus(message);
    await task();
  } catch (error) {
    setStatus(error.message || '처리 중 오류가 발생했습니다.', true);
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '요청에 실패했습니다.');
  return data;
}

async function postJson(url, body, headers = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers
    },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '요청에 실패했습니다.');
  return data;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    });
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function buildAiContextText() {
  return [
    `자료 유형: ${state.source.kind}`,
    `자료 이름: ${state.source.label}`,
    state.source.text ? `추출 텍스트:\n${state.source.text}` : '',
    state.source.html ? `HTML:\n${state.source.html.slice(0, 30000)}` : ''
  ].filter(Boolean).join('\n\n');
}

function setStatus(message, isError = false) {
  statusLine.textContent = message;
  statusLine.classList.toggle('is-error', isError);
}

function kindLabel(kind) {
  const labels = {
    website: '홈페이지',
    html: 'HTML',
    text: '텍스트',
    pdf: 'PDF',
    docx: 'Word 문서',
    hwp: 'HWP 문서',
    image: '이미지',
    binary: '바이너리'
  };
  return labels[kind] || kind;
}

function severityLabel(severity) {
  if (severity === 'high') return '높음';
  if (severity === 'medium') return '보통';
  return '낮음';
}

function scoreColor(score) {
  if (score >= 85) return '#126b57';
  if (score >= 60) return '#b98a17';
  return '#b84f27';
}
