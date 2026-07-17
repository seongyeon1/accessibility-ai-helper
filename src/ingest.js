const TEXTUAL_EXTENSIONS = new Set(['txt', 'md', 'csv', 'tsv', 'json', 'xml']);
const IMAGE_MIME_RE = /^image\/(png|jpe?g|webp|gif|bmp|svg\+xml)$/i;

export function detectDocumentKind({ url = '', filename = '', mimeType = '' } = {}) {
  if (url) return 'website';

  const lowerName = filename.toLowerCase();
  const extension = lowerName.includes('.') ? lowerName.split('.').pop() : '';
  const lowerMime = mimeType.toLowerCase();

  if (lowerMime.includes('pdf') || extension === 'pdf') return 'pdf';
  if (IMAGE_MIME_RE.test(lowerMime) || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(extension)) return 'image';
  if (lowerMime.includes('html') || ['html', 'htm'].includes(extension)) return 'html';
  if (lowerMime.includes('wordprocessingml') || extension === 'docx') return 'docx';
  if (extension === 'hwp' || extension === 'hwpx') return 'hwp';
  if (TEXTUAL_EXTENSIONS.has(extension) || lowerMime.startsWith('text/')) return 'text';
  return 'binary';
}

export function extractDocumentText({ buffer, kind }) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('extractDocumentText expects a Buffer.');
  }

  if (kind === 'html') {
    return {
      text: stripHtml(buffer.toString('utf8')),
      confidence: 'high',
      method: 'html-text'
    };
  }

  if (kind === 'text') {
    return {
      text: normalizeWhitespace(buffer.toString('utf8')).slice(0, 40000),
      confidence: 'high',
      method: 'plain-text'
    };
  }

  if (kind === 'pdf') {
    const extracted = extractPdfText(buffer);
    return {
      text: extracted,
      confidence: extracted.length > 0 ? 'medium' : 'low',
      method: 'pdf-string-scan'
    };
  }

  if (kind === 'docx' || kind === 'hwp' || kind === 'image') {
    return {
      text: '',
      confidence: 'ai-required',
      method: `${kind}-requires-ai`
    };
  }

  return {
    text: printableAsciiAndKorean(buffer).slice(0, 40000),
    confidence: 'low',
    method: 'binary-string-scan'
  };
}

export function summarizeSecurityIssues(html = '') {
  const issues = [];

  for (const match of html.matchAll(/<form\b[^>]*action\s*=\s*["'](http:\/\/[^"']+)["'][^>]*>/gi)) {
    issues.push(createIssue({
      ruleId: 'security:insecure-form-action',
      title: '폼 제출 주소가 HTTPS가 아닙니다',
      severity: 'high',
      evidence: match[1],
      suggestion: '로그인, 신청, 개인정보 입력 폼은 HTTPS 주소로 제출되도록 바꾸세요.'
    }));
  }

  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["'](http:\/\/[^"']+)["'][^>]*>/gi)) {
    issues.push(createIssue({
      ruleId: 'security:insecure-link',
      title: '외부 링크가 HTTP 주소입니다',
      severity: 'medium',
      evidence: match[1],
      suggestion: '가능하면 HTTPS 링크로 바꾸고, 외부 사이트 안내 문구를 함께 제공하세요.'
    }));
  }

  for (const match of html.matchAll(/<script\b[^>]*src\s*=\s*["'](http:\/\/[^"']+)["'][^>]*>/gi)) {
    issues.push(createIssue({
      ruleId: 'security:insecure-script',
      title: '스크립트를 HTTP로 불러옵니다',
      severity: 'high',
      evidence: match[1],
      suggestion: '스크립트는 HTTPS로 불러오고 가능하면 무결성 검사를 적용하세요.'
    }));
  }

  for (const match of html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)) {
    const formTag = match[1];
    const formBody = match[2];
    const hasPassword = /<input\b[^>]*type\s*=\s*["']password["'][^>]*>/i.test(formBody);
    const hasSecureAction = /action\s*=\s*["']https:\/\//i.test(formTag);
    if (hasPassword && !hasSecureAction) {
      issues.push(createIssue({
        ruleId: 'security:password-form-without-https',
        title: '비밀번호 입력 폼의 보안 확인이 필요합니다',
        severity: 'high',
        evidence: 'type="password"',
        suggestion: '비밀번호 입력 폼은 HTTPS 제출 주소와 자동완성 정책을 확인하세요.'
      }));
    }
  }

  return issues;
}

export function buildOpenAIReviewRequest({ model = 'gpt-5-mini', text = '', file = null, imageDataUrl = '' } = {}) {
  const content = [{
    type: 'input_text',
    text: [
      '다음 자료를 사회적 약자 정보 접근성 관점에서 분석해 주세요.',
      '한국어 쉬운 말, 웹 접근성, 문서 접근성, 개인정보/보안 취약점을 함께 보고,',
      '반드시 JSON 형식으로 summary, improvements, risks, rewritten_text 필드를 반환하세요.',
      text ? `\n분석 텍스트:\n${text.slice(0, 30000)}` : ''
    ].join('\n')
  }];

  if (file?.base64 && file?.filename) {
    content.push({
      type: 'input_file',
      filename: file.filename,
      file_data: `data:${file.mimeType || 'application/octet-stream'};base64,${file.base64}`
    });
  }

  if (imageDataUrl) {
    content.push({
      type: 'input_image',
      image_url: imageDataUrl,
      detail: 'high'
    });
  }

  return {
    model,
    input: [{
      role: 'user',
      content
    }]
  };
}

function createIssue({ ruleId, title, severity, evidence, suggestion }) {
  return {
    id: `${ruleId}:${Math.abs(hash(`${evidence}:${suggestion}`)).toString(36)}`,
    ruleId,
    title,
    severity,
    impact: ['개인정보 보호', '보안 취약 사용자', '공공서비스 이용자'],
    evidence,
    suggestion
  };
}

function stripHtml(html) {
  return normalizeWhitespace(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  );
}

function extractPdfText(buffer) {
  const raw = buffer.toString('utf8');
  const literalStrings = [...raw.matchAll(/\(([^()]{2,500})\)\s*Tj/g)]
    .map((match) => decodePdfLiteral(match[1]));
  const visible = literalStrings.join(' ') || printableAsciiAndKorean(buffer);
  return normalizeWhitespace(visible).slice(0, 40000);
}

function decodePdfLiteral(value) {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\([()\\])/g, '$1');
}

function printableAsciiAndKorean(buffer) {
  return normalizeWhitespace(
    buffer
      .toString('utf8')
      .replace(/[^\uAC00-\uD7A3\u3131-\u318E\u1100-\u11FFa-zA-Z0-9\s.,:;!?()[\]{}<>"'/%_-]/g, ' ')
  );
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function hash(value) {
  let hashValue = 0;
  for (let index = 0; index < value.length; index += 1) {
    hashValue = (hashValue << 5) - hashValue + value.charCodeAt(index);
    hashValue |= 0;
  }
  return hashValue;
}
