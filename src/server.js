import { createServer } from 'node:http';
import { readFile, mkdtemp, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { analyzeAll, createImprovementPlan } from './analyzer.js';
import {
  buildOpenAIReviewRequest,
  detectDocumentKind,
  extractDocumentText,
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

  const htmlResponse = await fetch(target, {
    headers: {
      'user-agent': 'AccessibilityAIHelper/0.2 (+https://github.com/seongyeon1/accessibility-ai-helper)'
    },
    redirect: 'follow'
  });

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
  const extraction = extractDocumentText({ buffer, kind });
  const html = kind === 'html' ? buffer.toString('utf8') : '';
  const imageDataUrl = kind === 'image' ? `data:${mimeType};base64,${base64}` : '';
  const report = analyzeAll({
    text: extraction.text,
    html,
    foreground: '#111827',
    background: '#ffffff'
  });
  const improvementPlan = createImprovementPlan({
    text: extraction.text,
    html,
    foreground: '#111827',
    background: '#ffffff'
  });
  const securityIssues = html ? summarizeSecurityIssues(html) : [];

  sendJson(response, 200, {
    kind,
    filename,
    mimeType,
    size: buffer.length,
    extraction,
    imageDataUrl,
    report,
    improvementPlan,
    securityIssues,
    aiRecommended: ['pdf', 'docx', 'hwp', 'image', 'binary'].includes(kind)
  });
}

async function handleAiReview(request, response) {
  const token = getAuthToken(request);
  if (!token) {
    sendJson(response, 401, {
      error: 'CODEX_AUTH_TOKEN, OPENAI_API_KEY, 또는 화면에서 입력한 세션 토큰이 필요합니다.'
    });
    return;
  }

  const body = await readJsonBody(request);
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
    model: payload.model,
    result,
    text: extractResponseText(result)
  });
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

function getAuthToken(request) {
  const header = request.headers.authorization || '';
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  if (request.headers['x-codex-auth-token']) return String(request.headers['x-codex-auth-token']);
  return process.env.CODEX_AUTH_TOKEN || process.env.OPENAI_API_KEY || '';
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
