import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAnthropicReviewRequest,
  buildOpenAIReviewRequest,
  buildReviewPrompt,
  detectDocumentKind,
  extractDocumentText,
  summarizeSecurityIssues
} from '../src/ingest.js';

test('detectDocumentKind recognizes website and common upload types', () => {
  assert.equal(detectDocumentKind({ url: 'https://example.com' }), 'website');
  assert.equal(detectDocumentKind({ filename: 'notice.pdf', mimeType: 'application/pdf' }), 'pdf');
  assert.equal(detectDocumentKind({ filename: 'photo.png', mimeType: 'image/png' }), 'image');
  assert.equal(detectDocumentKind({ filename: 'plan.hwp', mimeType: '' }), 'hwp');
  assert.equal(detectDocumentKind({ filename: 'page.html', mimeType: 'text/html' }), 'html');
});

test('extractDocumentText pulls readable text from html and pdf-like buffers', () => {
  const html = Buffer.from('<main><h1>안내</h1><p>취약계층 신청 안내</p><script>alert(1)</script></main>');
  const pdfLike = Buffer.from('%PDF-1.7\n(복지급여 신청 안내) Tj\n(소득증빙자료 제출) Tj');

  assert.equal(extractDocumentText({ buffer: html, kind: 'html' }).text, '안내 취약계층 신청 안내');
  assert.ok(extractDocumentText({ buffer: pdfLike, kind: 'pdf' }).text.includes('복지급여 신청 안내'));
});

test('summarizeSecurityIssues flags insecure links and risky forms', () => {
  const issues = summarizeSecurityIssues(`
    <form action="http://example.com/login"><input type="password"></form>
    <a href="http://example.com">외부 링크</a>
    <script src="http://cdn.example.com/app.js"></script>
  `);

  assert.ok(issues.some((issue) => issue.ruleId === 'security:insecure-form-action'));
  assert.ok(issues.some((issue) => issue.ruleId === 'security:insecure-link'));
  assert.ok(issues.some((issue) => issue.ruleId === 'security:insecure-script'));
});

test('buildOpenAIReviewRequest creates multimodal Responses API payload', () => {
  const payload = buildOpenAIReviewRequest({
    model: 'gpt-5-mini',
    text: '취약계층 복지급여 신청 안내',
    file: {
      filename: 'notice.pdf',
      mimeType: 'application/pdf',
      base64: Buffer.from('pdf bytes').toString('base64')
    },
    imageDataUrl: 'data:image/png;base64,abc123'
  });

  const content = payload.input[0].content;
  assert.equal(payload.model, 'gpt-5-mini');
  assert.ok(content.some((part) => part.type === 'input_text'));
  assert.ok(content.some((part) => part.type === 'input_file' && part.filename === 'notice.pdf'));
  assert.ok(content.some((part) => part.type === 'input_image'));
});

test('buildAnthropicReviewRequest creates Messages API image payload', () => {
  const payload = buildAnthropicReviewRequest({
    model: 'claude-sonnet-5',
    text: '취약계층 복지급여 신청 안내',
    imageDataUrl: 'data:image/png;base64,abc123'
  });

  const content = payload.messages[0].content;
  assert.equal(payload.model, 'claude-sonnet-5');
  assert.equal(payload.max_tokens, 3000);
  assert.ok(content.some((part) => part.type === 'text'));
  assert.ok(content.some((part) => part.type === 'image' && part.source.media_type === 'image/png'));
});

test('buildReviewPrompt includes required JSON fields and file context', () => {
  const prompt = buildReviewPrompt({
    text: '교육 신청 안내',
    file: { filename: 'guide.hwp', mimeType: 'application/x-hwp' }
  });

  assert.match(prompt, /"summary"/);
  assert.match(prompt, /"improvements"/);
  assert.match(prompt, /"risks"/);
  assert.match(prompt, /"rewritten_text"/);
  assert.match(prompt, /guide\.hwp/);
  assert.match(prompt, /교육 신청 안내/);
});
