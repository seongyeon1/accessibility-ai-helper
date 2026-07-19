import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeAll,
  analyzeContrast,
  analyzeHtml,
  analyzeUniversalDesign,
  buildChangeHighlights,
  analyzeText,
  createImprovementPlan,
  scoreFindings
} from '../src/analyzer.js';

test('analyzeText flags long Korean sentences and difficult public-sector terms', () => {
  const result = analyzeText(
    '본 사업은 취약계층의 복지급여 신청 절차를 간소화하기 위하여 관계기관의 심사를 거쳐 지원대상자를 선정합니다. 주민등록등본 및 소득증빙자료를 첨부하여야 하며 기한 내 미제출 시 접수가 반려될 수 있습니다.'
  );

  assert.equal(result.category, 'text');
  assert.ok(result.findings.some((finding) => finding.ruleId === 'plain-language:difficult-term'));
  assert.ok(result.findings.some((finding) => finding.ruleId === 'plain-language:long-sentence'));
  assert.ok(result.summary.includes('쉬운 말'));
});

test('analyzeHtml flags missing alt text, vague links, skipped headings, and unlabeled controls', () => {
  const result = analyzeHtml(`
    <main>
      <h1>복지 서비스 안내</h1>
      <h3>신청 방법</h3>
      <img src="/notice.png">
      <a href="/apply">자세히</a>
      <input type="text">
    </main>
  `);

  const ruleIds = result.findings.map((finding) => finding.ruleId);
  assert.ok(ruleIds.includes('html:image-alt-missing'));
  assert.ok(ruleIds.includes('html:vague-link-text'));
  assert.ok(ruleIds.includes('html:heading-level-skip'));
  assert.ok(ruleIds.includes('html:control-label-missing'));
});

test('analyzeContrast reports WCAG contrast status for normal text', () => {
  const poor = analyzeContrast('#777777', '#ffffff');
  const strong = analyzeContrast('#111827', '#ffffff');

  assert.equal(poor.passesAA, false);
  assert.equal(strong.passesAA, true);
  assert.ok(poor.ratio < strong.ratio);
  assert.ok(poor.findings.some((finding) => finding.ruleId === 'visual:contrast-aa'));
});

test('scoreFindings converts severity into an accessibility barrier score', () => {
  const score = scoreFindings([
    { severity: 'high' },
    { severity: 'medium' },
    { severity: 'low' }
  ]);

  assert.equal(score, 62);
});

test('analyzeAll combines text, html, and contrast checks into one report', () => {
  const report = analyzeAll({
    text: '지원대상자는 소득증빙자료를 첨부하여야 합니다.',
    html: '<img src="notice.png"><a href="/x">클릭</a>',
    foreground: '#777777',
    background: '#ffffff'
  });

  assert.equal(report.sections.length, 3);
  assert.ok(report.findings.length >= 3);
  assert.equal(report.universalDesign.length, 7);
  assert.ok(report.universalDesign.some((principle) => principle.status === 'needs-work'));
  assert.ok(report.score < 100);
});

test('analyzeUniversalDesign maps findings to inclusive design principles', () => {
  const principles = analyzeUniversalDesign([
    { ruleId: 'plain-language:long-sentence', severity: 'high', title: '문장이 너무 깁니다' },
    { ruleId: 'html:image-alt-missing', severity: 'high', title: '이미지 대체 텍스트가 없습니다' }
  ]);

  const simple = principles.find((principle) => principle.id === 'simple-intuitive');
  const perceptible = principles.find((principle) => principle.id === 'perceptible-information');

  assert.equal(simple.status, 'needs-work');
  assert.equal(perceptible.status, 'needs-work');
  assert.ok(simple.recommendation.includes('어려운 행정 용어'));
});

test('createImprovementPlan rewrites difficult text and accessible HTML for comparison', () => {
  const plan = createImprovementPlan({
    text: '지원대상자는 소득증빙자료를 첨부하여야 합니다.',
    html: '<main><h1>복지 서비스 안내</h1><h3>신청 방법</h3><img src="notice.png"><a href="/apply">자세히</a><input id="name" type="text"></main>',
    foreground: '#777777',
    background: '#ffffff'
  });

  assert.ok(plan.improved.text.includes('지원을 받을 사람'));
  assert.ok(plan.improved.text.includes('소득을 확인하는 서류'));
  assert.ok(!plan.improved.text.includes('사람를'));
  assert.ok(!plan.improved.text.includes('줄임하기'));
  assert.ok(plan.improved.html.includes('alt="복지 서비스 안내 관련 안내 이미지"'));
  assert.ok(plan.improved.html.includes('<h2>신청 방법</h2>'));
  assert.ok(plan.improved.html.includes('복지 서비스 안내 신청 방법 보기'));
  assert.ok(plan.improved.html.includes('<label for="name">이름</label>'));
  assert.equal(plan.improved.foreground, '#111827');
  assert.ok(plan.after.score > plan.before.score);
  assert.ok(plan.changes.length >= 5);
});

test('buildChangeHighlights maps findings and changes into visual review targets', () => {
  const plan = createImprovementPlan({
    text: '지원대상자는 소득증빙자료를 첨부하여야 합니다.',
    html: '<main><h1>복지 서비스 안내</h1><h3>신청 방법</h3><img src="notice.png"><a href="/apply">자세히</a><input id="name" type="text"></main>',
    foreground: '#777777',
    background: '#ffffff'
  });
  const highlights = buildChangeHighlights({
    findings: plan.before.findings,
    changes: plan.changes
  });

  assert.ok(highlights.some((highlight) => highlight.target === 'image'));
  assert.ok(highlights.some((highlight) => highlight.target === 'heading'));
  assert.ok(highlights.some((highlight) => highlight.target === 'link'));
  assert.ok(highlights.some((highlight) => highlight.target === 'text'));
  assert.ok(highlights.every((highlight) => Number.isFinite(highlight.box.x)));
});
