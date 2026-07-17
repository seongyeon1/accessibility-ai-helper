import { analyzeAll } from './analyzer.js';

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
  state.report = analyzeAll({
    text: textInput.value,
    html: htmlInput.value,
    foreground: foregroundInput.value,
    background: backgroundInput.value
  });

  renderScore();
  renderSummaries();
  renderFindings();
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
