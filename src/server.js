import { createServer } from 'node:http';
import { readFile, mkdtemp, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { analyzeAll, analyzeUniversalDesign, createImprovementPlan, scoreFindings } from './analyzer.js';
import {
  buildAnthropicReviewRequest,
  buildOpenAIReviewRequest,
  buildReviewPrompt,
  detectDocumentKind,
  extractDocumentText,
  filenameFromUrl,
  summarizeSecurityIssues
} from './ingest.js';

const execFileAsync = promisify(execFile);
const root = resolve(new URL('..', import.meta.url).pathname);
const port = Number(process.env.PORT || 4173);
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === '/api/analyze-url') {
      await handleAnalyzeUrl(url, request, response);
      return;
    }

    if (url.pathname === '/api/analyze-file' && request.method === 'POST') {
      await handleAnalyzeFile(request, response);
      return;
    }

    if (url.pathname === '/api/ai-review' && request.method === 'POST') {
      await handleAiReview(request, response);
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || 'Unexpected server error'
    });
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`AI accessibility helper running at http://127.0.0.1:${port}`);
});

async function handleAnalyzeUrl(url, request, response) {
  const target = url.searchParams.get('url') || '';
  if (!/^https?:\/\//i.test(target)) {
    sendJson(response, 400, { error: 'http 또는 https URL을 입력하세요.' });
    return;
  }

  let htmlResponse;
  try {
    htmlResponse = await fetch(target, {
      headers: {
        'user-agent': 'AccessibilityAIHelper/0.2 (+https://github.com/seongyeon1/accessibility-ai-helper)'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(Number(process.env.URL_FETCH_TIMEOUT_MS || 30000))
    });
  } catch (error) {
    sendJson(response, 504, {
      error: error.name === 'TimeoutError' || error.name === 'AbortError'
        ? 'URL 응답이 너무 오래 걸립니다. 파일을 내려받아 업로드하거나 잠시 후 다시 시도하세요.'
        : `URL을 가져오지 못했습니다: ${error.message}`
    });
    return;
  }

  const mimeType = normalizeContentType(htmlResponse.headers.get('content-type') || '');
  const filename = filenameFromResponse(target, htmlResponse.headers.get('content-disposition') || '');
  const kind = detectDocumentKind({ url: htmlResponse.url || target, filename, mimeType });

  if (kind !== 'website' && kind !== 'html') {
    const buffer = Buffer.from(await htmlResponse.arrayBuffer());
    const result = analyzeDocumentBuffer({
      buffer,
      kind,
      filename,
      mimeType
    });

    sendJson(response, 200, {
      ...result,
      source: target,
      status: htmlResponse.status,
      finalUrl: htmlResponse.url,
      remote: true
    });
    return;
  }

  const html = await htmlResponse.text();
  const text = htmlToReadableText(html);
  const screenshot = await captureScreenshot(target);
  const report = analyzeAll({ text, html, foreground: '#111827', background: '#ffffff' });
  const improvementPlan = createImprovementPlan({ text, html, foreground: '#111827', background: '#ffffff' });
  const securityIssues = summarizeSecurityIssues(html);

  sendJson(response, 200, {
    kind: 'website',
    source: target,
    status: htmlResponse.status,
    finalUrl: htmlResponse.url,
    html: html.slice(0, 120000),
    text: text.slice(0, 40000),
    screenshot,
    report,
    improvementPlan,
    securityIssues
  });
}

async function handleAnalyzeFile(request, response) {
  const body = await readJsonBody(request);
  const filename = body.filename || 'upload.bin';
  const mimeType = body.mimeType || 'application/octet-stream';
  const base64 = body.base64 || '';
  const buffer = Buffer.from(base64, 'base64');
  const kind = detectDocumentKind({ filename, mimeType });
  const result = analyzeDocumentBuffer({
    buffer,
    kind,
    filename,
    mimeType
  });

  sendJson(response, 200, result);
}

function analyzeDocumentBuffer({ buffer, kind, filename, mimeType }) {
  const base64 = buffer.toString('base64');
  const extraction = extractDocumentText({ buffer, kind });
  const html = kind === 'html' ? buffer.toString('utf8') : '';
  const imageDataUrl = kind === 'image' ? `data:${mimeType};base64,${base64}` : '';
  const report = withExtractionFindings(analyzeAll({
    text: extraction.text,
    html,
    foreground: '#111827',
    background: '#ffffff'
  }), extraction, kind);
  const improvementPlan = createImprovementPlan({
    text: extraction.text,
    html,
    foreground: '#111827',
    background: '#ffffff'
  });
  const securityIssues = html ? summarizeSecurityIssues(html) : [];

  return {
    kind,
    filename,
    mimeType,
    size: buffer.length,
    extraction,
    file: {
      filename,
      mimeType,
      base64
    },
    imageDataUrl,
    report,
    improvementPlan,
    securityIssues,
    aiRecommended: ['pdf', 'docx', 'hwp', 'image', 'binary'].includes(kind)
  };
}

function withExtractionFindings(report, extraction, kind) {
  if (!['pdf', 'docx', 'hwp', 'image', 'binary'].includes(kind) || extraction.text) {
    return report;
  }

  const finding = {
    id: `document:text-extraction-low:${kind}`,
    ruleId: 'document:text-extraction-low',
    title: '문서 텍스트를 자동으로 읽지 못했습니다',
    severity: 'medium',
    impact: ['시각장애인', '스크린리더 사용자', '인지 접근성 지원이 필요한 사용자'],
    location: kind.toUpperCase(),
    evidence: `${extraction.method} / ${extraction.confidence}`,
    suggestion: 'OCR 또는 AI 심화 분석으로 문서 내용을 추출한 뒤 쉬운 말, 읽기 순서, 이미지 대체 설명을 점검하세요.'
  };
  const findings = [...report.findings, finding];
  const sections = [
    ...report.sections,
    {
      category: 'document',
      label: '문서 추출 점검',
      summary: '자동 텍스트 추출이 어려워 AI/OCR 기반 심화 분석이 필요합니다.',
      findings: [finding]
    }
  ];

  return {
    ...report,
    sections,
    findings,
    universalDesign: analyzeUniversalDesign(findings),
    score: scoreFindings(findings)
  };
}

async function handleAiReview(request, response) {
  const body = await readJsonBody(request);
  const provider = normalizeProvider(body.provider || process.env.AI_PROVIDER || 'openai');

  if (provider === 'claude-code') {
    await handleClaudeCodeReview(request, response, body);
    return;
  }

  const token = getProviderToken(request, provider);
  if (!token) {
    sendJson(response, 401, {
      error: provider === 'anthropic'
        ? 'ANTHROPIC_API_KEY 또는 화면에서 입력한 Anthropic API key가 필요합니다.'
        : 'CODEX_AUTH_TOKEN, OPENAI_API_KEY, 또는 화면에서 입력한 OpenAI 토큰이 필요합니다.'
    });
    return;
  }

  if (provider === 'anthropic') {
    await handleAnthropicReview(response, token, body);
    return;
  }

  await handleOpenAIReview(response, token, body);
}

async function handleOpenAIReview(response, token, body) {
  const payload = buildOpenAIReviewRequest({
    model: body.model || process.env.OPENAI_MODEL || 'gpt-5-mini',
    text: body.text || '',
    file: body.file || null,
    imageDataUrl: body.imageDataUrl || ''
  });

  const apiResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const result = await apiResponse.json();
  sendJson(response, apiResponse.status, {
    ok: apiResponse.ok,
    provider: 'openai',
    model: payload.model,
    result,
    text: extractResponseText(result)
  });
}

async function handleAnthropicReview(response, token, body) {
  const payload = buildAnthropicReviewRequest({
    model: body.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
    text: body.text || '',
    file: body.file || null,
    imageDataUrl: body.imageDataUrl || ''
  });

  const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': token,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const result = await apiResponse.json();
  sendJson(response, apiResponse.status, {
    ok: apiResponse.ok,
    provider: 'anthropic',
    model: payload.model,
    result,
    text: extractAnthropicText(result)
  });
}

async function handleClaudeCodeReview(request, response, body) {
  const prompt = buildReviewPrompt({
    text: body.text || '',
    file: body.file || null
  });
  const token = String(request.headers['x-claude-code-oauth-token'] || process.env.CLAUDE_CODE_OAUTH_TOKEN || '').trim();
  const env = { ...process.env };
  if (token) env.CLAUDE_CODE_OAUTH_TOKEN = token;

  try {
    const { stdout, stderr } = await execFileAsync(
      process.env.CLAUDE_CLI_PATH || 'claude',
      ['-p', prompt],
      {
        timeout: Number(process.env.CLAUDE_CODE_TIMEOUT_MS || 120000),
        maxBuffer: 2 * 1024 * 1024,
        env
      }
    );

    sendJson(response, 200, {
      ok: true,
      provider: 'claude-code',
      model: 'claude-code-cli',
      result: { stderr: stderr.trim() },
      text: stdout.trim()
    });
  } catch (error) {
    sendJson(response, 502, {
      ok: false,
      provider: 'claude-code',
      error: [
        'Claude Code CLI 실행에 실패했습니다.',
        '`claude` 대화형 세션에서 로그인하거나 `claude setup-token`으로 인증한 뒤 다시 시도하세요.',
        error.stderr || error.message
      ].filter(Boolean).join('\n')
    });
  }
}

async function serveStatic(pathname, response) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = resolve(root, `.${decodeURIComponent(safePath)}`);

  if (!filePath.startsWith(root)) {
    sendJson(response, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const data = await readFile(filePath);
    response.writeHead(200, {
      'content-type': mimeTypes[extname(filePath)] || 'application/octet-stream'
    });
    response.end(data);
  } catch {
    sendJson(response, 404, { error: 'Not found' });
  }
}

async function captureScreenshot(targetUrl) {
  if (!existsSync(chromePath)) return null;

  const tempDir = await mkdtemp(join(tmpdir(), 'accessibility-ai-helper-'));
  const screenshotPath = join(tempDir, 'capture.png');

  try {
    await execFileAsync(chromePath, [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      '--window-size=1365,900',
      `--screenshot=${screenshotPath}`,
      targetUrl
    ], { timeout: 15000 });

    const image = await readFile(screenshotPath);
    return `data:image/png;base64,${image.toString('base64')}`;
  } catch {
    return null;
  } finally {
    await unlink(screenshotPath).catch(() => {});
  }
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  response.end(JSON.stringify(payload));
}

function normalizeProvider(provider) {
  if (provider === 'anthropic' || provider === 'claude-code') return provider;
  return 'openai';
}

function getProviderToken(request, provider) {
  const header = request.headers.authorization || '';
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  if (provider === 'anthropic') {
    if (request.headers['x-anthropic-api-key']) return String(request.headers['x-anthropic-api-key']);
    return process.env.ANTHROPIC_API_KEY || '';
  }
  if (request.headers['x-codex-auth-token']) return String(request.headers['x-codex-auth-token']);
  return process.env.CODEX_AUTH_TOKEN || process.env.OPENAI_API_KEY || '';
}

function normalizeContentType(value = '') {
  return value.split(';')[0].trim().toLowerCase() || 'application/octet-stream';
}

function filenameFromResponse(url, contentDisposition = '') {
  const utf8Match = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match) return decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, ''));

  const filenameMatch = contentDisposition.match(/filename\s*=\s*("?)([^";]+)\1/i);
  if (filenameMatch) return filenameMatch[2].trim();

  return filenameFromUrl(url);
}

function htmlToReadableText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractResponseText(result) {
  if (typeof result.output_text === 'string') return result.output_text;
  const parts = result.output?.flatMap((item) => item.content || []) || [];
  return parts.map((part) => part.text || '').filter(Boolean).join('\n');
}

function extractAnthropicText(result) {
  const parts = result.content || [];
  return parts.map((part) => part.text || '').filter(Boolean).join('\n');
}
