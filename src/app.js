import { analyzeAll, buildChangeHighlights, createImprovementPlan } from './analyzer.js';

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
  highlights: [],
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
const intakeView = document.querySelector('#intake-view');
const loadingView = document.querySelector('#loading-view');
const resultView = document.querySelector('#result-view');
const loadingMessage = document.querySelector('#loading-message');
const urlInput = document.querySelector('#url-input');
const fileInput = document.querySelector('#file-input');
const textInput = document.querySelector('#text-input');
const htmlInput = document.querySelector('#html-input');
const foregroundInput = document.querySelector('#foreground-input');
const backgroundInput = document.querySelector('#background-input');
const providerInput = document.querySelector('#provider-input');
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
const screenshotPreview = document.querySelector('#screenshot-preview');
const wirePreview = document.querySelector('#wire-preview');
const boxLayer = document.querySelector('#box-layer');
const visualMapList = document.querySelector('#visual-map-list');
const visualSourceLabel = document.querySelector('#visual-source-label');
const htmlRenderPreview = document.querySelector('#html-render-preview');
const aiPanel = document.querySelector('#ai-panel');
const aiOutput = document.querySelector('#ai-output');
const aiModelLabel = document.querySelector('#ai-model-label');
const resetSample = document.querySelector('#reset-sample');
const analyzeUrlButton = document.querySelector('#analyze-url');
const analyzeFileButton = document.querySelector('#analyze-file');
const runAiReviewButton = document.querySelector('#run-ai-review');
const backToInputButton = document.querySelector('#back-to-input');
const tabs = [...document.querySelectorAll('.tab')];
const modeTabs = [...document.querySelectorAll('.mode-tab')];
const modePanels = [...document.querySelectorAll('.mode-panel')];

form.addEventListener('submit', (event) => {
  event.preventDefault();
  withStatus('붙여넣은 내용을 분석하고 개선안을 만드는 중입니다...', async () => {
    await delay(350);
    runPasteAnalysis();
  });
});

analyzeUrlButton.addEventListener('click', analyzeUrl);
analyzeFileButton.addEventListener('click', analyzeFile);
runAiReviewButton.addEventListener('click', runAiReview);
backToInputButton.addEventListener('click', () => showView('intake'));
providerInput.addEventListener('change', syncProviderDefaults);

resetSample.addEventListener('click', () => {
  textInput.value = sample.text;
  htmlInput.value = sample.html;
  foregroundInput.value = sample.foreground;
  backgroundInput.value = sample.background;
  setStatus('샘플을 복원했습니다. 직접 붙여넣기 분석을 눌러 결과를 확인하세요.');
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
    const provider = providerInput.value;
    const headers = {};
    const token = tokenInput.value.trim();
    if (token && provider === 'anthropic') headers['x-anthropic-api-key'] = token;
    if (token && provider === 'claude-code') headers['x-claude-code-oauth-token'] = token;
    if (token && provider === 'openai') headers['x-codex-auth-token'] = token;

    const result = await postJson('/api/ai-review', {
      provider,
      model: modelInput.value.trim() || defaultModelForProvider(provider),
      text: buildAiContextText(),
      file: state.source.file,
      imageDataUrl: state.source.imageDataUrl
    }, headers);

    aiPanel.hidden = false;
    aiModelLabel.textContent = `${providerLabel(result.provider || provider)} · ${result.model || '모델 응답'}`;
    renderAiOutput(result.text || JSON.stringify(result.result, null, 2));
    setStatus('AI 심화 분석이 완료됐습니다.');
  });
}

function applyAnalysis({ report, improvementPlan, securityIssues = [], screenshot = null, sourceLabel = '' }) {
  state.report = report;
  state.improvementPlan = improvementPlan;
  state.securityIssues = securityIssues;
  state.highlights = buildChangeHighlights({
    findings: [...report.findings, ...securityIssues],
    changes: improvementPlan.changes
  });

  sourceMeta.textContent = sourceLabel;
  renderScreenshot(screenshot);
  renderScore();
  renderSummaries();
  renderVisualReview();
  renderComparison();
  renderFindings();
  setStatus('분석 완료');
  showView('result');
}

function renderScreenshot(screenshot) {
  if (!screenshot) {
    screenshotPreview.hidden = true;
    wirePreview.hidden = false;
    screenshotPreview.removeAttribute('src');
    visualSourceLabel.textContent = '구조 미리보기';
    return;
  }

  screenshotPreview.hidden = false;
  wirePreview.hidden = true;
  screenshotPreview.src = screenshot;
  visualSourceLabel.textContent = '캡처 위 하이라이트';
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
  improvedPreview.innerHTML = renderHighlightedImprovement(
    improvedText || '자동 개선안이 없습니다. AI 심화 분석을 사용하세요.',
    plan.changes
  );
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
    detail.className = 'change-diff';
    const before = document.createElement('span');
    before.className = 'diff-before';
    before.textContent = change.before;
    const arrow = document.createElement('span');
    arrow.className = 'diff-arrow';
    arrow.textContent = '->';
    const after = document.createElement('span');
    after.className = 'diff-after';
    after.textContent = change.after;
    detail.append(before, arrow, after);
    item.append(title, detail);
    return item;
  }));
}

function renderVisualReview() {
  boxLayer.replaceChildren(...state.highlights.map((highlight) => {
    const box = document.createElement('button');
    box.type = 'button';
    box.className = `review-box ${highlight.severity}`;
    box.style.left = `${highlight.box.x}%`;
    box.style.top = `${highlight.box.y}%`;
    box.style.width = `${highlight.box.width}%`;
    box.style.height = `${highlight.box.height}%`;
    box.dataset.highlightId = highlight.id;
    box.setAttribute('aria-label', `${highlight.index}. ${highlight.title}: ${highlight.reasons[0] || '변경 필요'}`);
    box.innerHTML = `<strong>${highlight.index}</strong><span>${escapeHtml(highlight.title)}</span>`;
    box.addEventListener('click', () => focusHighlightCard(highlight.id));
    return box;
  }));

  visualMapList.replaceChildren(...state.highlights.map(renderHighlightCard));
  const html = state.improvementPlan?.improved?.html || '';
  htmlRenderPreview.srcdoc = buildRenderedHtmlPreview(html, state.highlights);
}

function renderHighlightCard(highlight) {
  const card = document.createElement('article');
  card.className = `visual-map-card ${highlight.severity}`;
  card.id = `card-${highlight.id}`;

  const badge = document.createElement('span');
  badge.className = 'map-number';
  badge.textContent = highlight.index;

  const body = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = highlight.title;

  const reason = document.createElement('p');
  reason.textContent = highlight.reasons[0] || '해당 영역에서 접근성 확인이 필요합니다.';

  const detail = document.createElement('dl');
  addDetail(detail, '왜', summarizeReasons(highlight.reasons));
  addDetail(detail, '어떻게', summarizeHighlightChange(highlight));

  body.append(title, reason, detail);
  card.append(badge, body);
  return card;
}

function focusHighlightCard(id) {
  const card = document.querySelector(`#card-${CSS.escape(id)}`);
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  card.classList.add('is-focused');
  setTimeout(() => card.classList.remove('is-focused'), 1200);
}

function summarizeHighlightChange(highlight) {
  const change = highlight.changes?.[0];
  if (change?.after) return change.after;
  if (highlight.target === 'contrast') return '색 대비를 4.5:1 이상으로 조정합니다.';
  if (highlight.target === 'text') return '긴 문장과 행정 용어를 쉬운 문장으로 나눕니다.';
  return '요소에 접근 가능한 이름과 의미를 추가합니다.';
}

function summarizeReasons(reasons = []) {
  if (reasons.length === 0) return '자동 개선 대상입니다.';
  const unique = [...new Set(reasons)];
  if (unique.length <= 2) return unique.join(', ');
  return `${unique.slice(0, 2).join(', ')} 외 ${unique.length - 2}개`;
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

function renderAiOutput(rawText) {
  const parsed = parseAiJson(rawText);
  if (!parsed) {
    aiOutput.replaceChildren(renderPlainAiText(rawText));
    return;
  }

  const sections = [];
  if (parsed.summary) sections.push(renderAiSection('요약', parsed.summary));
  sections.push(renderAiImprovementSection(parsed.improvements || parsed.changes || []));
  if (parsed.risks) sections.push(renderAiSection('주의할 점', parsed.risks));
  if (parsed.rewritten_text) sections.push(renderAiSection('다시 쓴 내용', parsed.rewritten_text, 'rewritten'));
  aiOutput.replaceChildren(...sections.filter(Boolean));
}

function renderAiImprovementSection(items) {
  const section = document.createElement('section');
  section.className = 'ai-section';
  const title = document.createElement('h4');
  title.textContent = '개선 항목';
  section.append(title);

  const list = Array.isArray(items) ? items : [items].filter(Boolean);
  if (list.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'AI가 별도 개선 항목을 구조화해서 반환하지 않았습니다.';
    section.append(empty);
    return section;
  }

  const grid = document.createElement('div');
  grid.className = 'ai-improvement-grid';
  grid.replaceChildren(...list.map((item, index) => renderAiImprovementCard(item, index + 1)));
  section.append(grid);
  return section;
}

function renderAiImprovementCard(item, index) {
  const card = document.createElement('article');
  card.className = 'ai-improvement-card';
  const title = document.createElement('strong');
  title.textContent = `${index}. ${item.area || item.title || item.where || '검토 항목'}`;
  const details = document.createElement('dl');
  addDetail(details, '어디', item.area || item.where || item.location || '-');
  addDetail(details, '왜', item.reason || item.why || item.issue || String(item));
  addDetail(details, '어떻게', item.change || item.how || item.suggestion || item.after || '-');
  if (item.before || item.after) {
    addDetail(details, '전/후', [item.before, item.after].filter(Boolean).join(' -> '));
  }
  card.append(title, details);
  return card;
}

function renderAiSection(titleText, value, variant = '') {
  const section = document.createElement('section');
  section.className = `ai-section ${variant}`;
  const title = document.createElement('h4');
  title.textContent = titleText;
  section.append(title);

  if (Array.isArray(value)) {
    const list = document.createElement('ul');
    list.replaceChildren(...value.map((item) => {
      const li = document.createElement('li');
      li.textContent = typeof item === 'string' ? item : JSON.stringify(item);
      return li;
    }));
    section.append(list);
  } else {
    const text = document.createElement('p');
    text.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    section.append(text);
  }
  return section;
}

function renderPlainAiText(rawText) {
  const wrapper = document.createElement('div');
  wrapper.className = 'ai-section';
  const title = document.createElement('h4');
  title.textContent = 'AI 응답';
  wrapper.append(title);

  for (const block of String(rawText || '').split(/\n{2,}/).filter(Boolean)) {
    const paragraph = document.createElement('p');
    paragraph.textContent = block.trim();
    wrapper.append(paragraph);
  }
  return wrapper;
}

function parseAiJson(rawText) {
  const text = String(rawText || '').trim();
  const candidates = [
    text,
    text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1],
    text.match(/\{[\s\S]*\}/)?.[0]
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      continue;
    }
  }
  return null;
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
    showLoading(message);
    await task();
  } catch (error) {
    showView('intake');
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

function syncProviderDefaults() {
  const provider = providerInput.value;
  modelInput.value = defaultModelForProvider(provider);
  tokenInput.placeholder = provider === 'claude-code'
    ? '로그인된 claude CLI를 쓰면 비워두세요. setup-token 값도 사용 가능'
    : provider === 'anthropic'
      ? '비워두면 서버의 ANTHROPIC_API_KEY 사용'
      : '비워두면 서버의 CODEX_AUTH_TOKEN 또는 OPENAI_API_KEY 사용';
}

function defaultModelForProvider(provider) {
  if (provider === 'anthropic') return 'claude-sonnet-5';
  if (provider === 'claude-code') return 'claude-code-cli';
  return 'gpt-5-mini';
}

function providerLabel(provider) {
  if (provider === 'anthropic') return 'Anthropic API';
  if (provider === 'claude-code') return 'Claude Code CLI';
  return 'OpenAI API';
}

function setStatus(message, isError = false) {
  statusLine.textContent = message;
  statusLine.classList.toggle('is-error', isError);
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function showView(name) {
  intakeView.classList.toggle('is-active', name === 'intake');
  loadingView.classList.toggle('is-active', name === 'loading');
  resultView.classList.toggle('is-active', name === 'result');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showLoading(message) {
  loadingMessage.textContent = message;
  showView('loading');
}

function renderHighlightedImprovement(text, changes) {
  let html = escapeHtml(text);
  const afterValues = changes
    .map((change) => String(change.after || '').trim())
    .filter((value) => value.length > 0)
    .sort((a, b) => b.length - a.length);

  for (const value of afterValues) {
    const escaped = escapeHtml(value);
    html = html.replaceAll(escaped, `<mark class="diff-mark">${escaped}</mark>`);
  }
  return html;
}

function buildRenderedHtmlPreview(html, highlights) {
  const highlightCss = `
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 18px; color: #172126; background: #fff; line-height: 1.55; }
      img, h1, h2, h3, a, input, textarea, select { outline-offset: 4px; }
      img { max-width: 100%; min-height: 48px; background: #eef5f1; }
      h1, h2, h3 { outline: 3px solid rgba(31, 95, 139, .42); border-radius: 4px; }
      img { outline: 3px solid rgba(18, 107, 87, .48); border-radius: 4px; }
      a { outline: 3px solid rgba(244, 211, 94, .9); border-radius: 4px; }
      input, textarea, select { outline: 3px solid rgba(184, 79, 39, .42); border-radius: 4px; }
      .preview-note { margin-bottom: 12px; border-left: 4px solid #126b57; background: #f3faf7; padding: 10px 12px; font-weight: 700; }
    </style>
  `;
  const note = highlights.length > 0
    ? `<div class="preview-note">${highlights.length}개 영역을 기준으로 개선안을 렌더링했습니다.</div>`
    : '<div class="preview-note">개선 HTML을 렌더링했습니다.</div>';
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">${highlightCss}</head><body>${note}${html || '<p>렌더링할 HTML이 없습니다.</p>'}</body></html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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
