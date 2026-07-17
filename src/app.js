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
  filter: 'all'
};

const form = document.querySelector('#checker-form');
const textInput = document.querySelector('#text-input');
const htmlInput = document.querySelector('#html-input');
const foregroundInput = document.querySelector('#foreground-input');
const backgroundInput = document.querySelector('#background-input');
const scoreValue = document.querySelector('#score-value');
const scoreRing = document.querySelector('#score-ring');
const scoreLabel = document.querySelector('#score-label');
const scoreHelp = document.querySelector('#score-help');
const summaryGrid = document.querySelector('#summary-grid');
const findingsList = document.querySelector('#findings-list');
const comparisonPanel = document.querySelector('#comparison-panel');
const originalPreview = document.querySelector('#original-preview');
const improvedPreview = document.querySelector('#improved-preview');
const comparisonMeta = document.querySelector('#comparison-meta');
const changeList = document.querySelector('#change-list');
const resetSample = document.querySelector('#reset-sample');
const tabs = [...document.querySelectorAll('.tab')];

form.addEventListener('submit', (event) => {
  event.preventDefault();
  runAnalysis();
});

resetSample.addEventListener('click', () => {
  textInput.value = sample.text;
  htmlInput.value = sample.html;
  foregroundInput.value = sample.foreground;
  backgroundInput.value = sample.background;
  runAnalysis();
});

for (const tab of tabs) {
  tab.addEventListener('click', () => {
    state.filter = tab.dataset.filter;
    for (const item of tabs) item.classList.toggle('is-active', item === tab);
    renderFindings();
  });
}

runAnalysis();

function runAnalysis() {
  const input = {
    text: textInput.value,
    html: htmlInput.value,
    foreground: foregroundInput.value,
    background: backgroundInput.value
  };

  state.report = analyzeAll(input);
  state.improvementPlan = createImprovementPlan(input);

  renderScore();
  renderSummaries();
  renderFindings();
  renderComparison();
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
    scoreHelp.textContent = `${findings.length}개의 개선 지점을 먼저 정리해 보세요.`;
  } else {
    scoreLabel.textContent = '정보 접근 문턱이 높습니다';
    scoreHelp.textContent = '높음 항목부터 고치면 사회적 약자의 이해 부담을 빠르게 줄일 수 있습니다.';
  }
}

function renderSummaries() {
  summaryGrid.replaceChildren(...state.report.sections.map((section) => {
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

function renderFindings() {
  const filtered = state.report.findings.filter((finding) => {
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

function renderComparison() {
  const plan = state.improvementPlan;
  const originalText = [textInput.value.trim(), htmlInput.value.trim()].filter(Boolean).join('\n\n');
  const improvedText = [plan.improved.text, plan.improved.html].filter(Boolean).join('\n\n');

  originalPreview.textContent = originalText || '비교할 원문이 없습니다.';
  improvedPreview.textContent = improvedText || '개선안이 없습니다.';
  comparisonMeta.textContent = `문턱 점수 ${plan.before.score}점 -> ${plan.after.score}점`;
  comparisonPanel.style.setProperty('--before-score', `${plan.before.score}%`);
  comparisonPanel.style.setProperty('--after-score', `${plan.after.score}%`);

  if (plan.changes.length === 0) {
    const item = document.createElement('li');
    item.textContent = '자동 개선이 필요한 항목이 없습니다. 실제 사용자 검토를 함께 진행하세요.';
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
  addDetail(details, '영향', finding.impact.join(', '));
  addDetail(details, '근거', finding.evidence || finding.location);
  addDetail(details, '개선', finding.suggestion);

  article.append(header, details);
  return article;
}

function addDetail(list, term, value) {
  const dt = document.createElement('dt');
  dt.textContent = term;

  const dd = document.createElement('dd');
  dd.textContent = value;

  list.append(dt, dd);
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
