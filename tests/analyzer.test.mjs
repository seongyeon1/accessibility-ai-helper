import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeAll,
  analyzeContrast,
  analyzeHtml,
  analyzeText,
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
  assert.ok(report.score < 100);
});
