const DIFFICULT_TERMS = [
  ['취약계층', '도움이 더 필요한 사람'],
  ['복지급여', '복지 지원금'],
  ['간소화', '절차를 줄임'],
  ['관계기관', '관련 기관'],
  ['지원대상자', '지원을 받을 사람'],
  ['주민등록등본', '주민등록 확인 서류'],
  ['소득증빙자료', '소득을 확인하는 서류'],
  ['첨부', '함께 내기'],
  ['미제출', '내지 않음'],
  ['반려', '접수되지 않음'],
  ['고지', '알림'],
  ['이의신청', '다시 확인 요청']
];

const VAGUE_LINK_TEXT = ['자세히', '클릭', '여기', '바로가기', '더보기'];

export function analyzeText(text = '') {
  const normalized = text.trim();
  const findings = [];

  for (const [term, replacement] of DIFFICULT_TERMS) {
    if (normalized.includes(term)) {
      findings.push(createFinding({
        ruleId: 'plain-language:difficult-term',
        title: `어려운 표현: ${term}`,
        severity: 'medium',
        impact: ['고령자', '아동', '다문화 가정', '발달장애인'],
        location: '본문',
        evidence: term,
        suggestion: `"${term}" 대신 "${replacement}"처럼 풀어 쓰세요.`
      }));
    }
  }

  for (const sentence of splitSentences(normalized)) {
    if (sentence.length >= 50) {
      findings.push(createFinding({
        ruleId: 'plain-language:long-sentence',
        title: '문장이 너무 깁니다',
        severity: 'high',
        impact: ['고령자', '저시력자', '인지 접근성 지원이 필요한 사용자'],
        location: '본문',
        evidence: sentence,
        suggestion: '한 문장에 하나의 행동만 담고, 신청 조건과 제출 서류를 문장으로 나누세요.'
      }));
    }
  }

  if (/(하여야|되어야|선정합니다|반려될 수 있습니다)/.test(normalized)) {
    findings.push(createFinding({
      ruleId: 'plain-language:administrative-tone',
      title: '행정 문체가 어렵게 느껴질 수 있습니다',
      severity: 'low',
      impact: ['고령자', '다문화 가정'],
      location: '본문',
      evidence: normalized.match(/하여야|되어야|선정합니다|반려될 수 있습니다/)?.[0] ?? '',
      suggestion: '"제출하여야 합니다"는 "제출해야 합니다" 또는 "함께 내세요"처럼 직접적인 표현으로 바꾸세요.'
    }));
  }

  return {
    category: 'text',
    label: '쉬운 말 점검',
    summary: summarizeSection('쉬운 말', findings),
    findings
  };
}

export function analyzeHtml(html = '') {
  const source = html.trim();
  const findings = [];

  const imageTags = [...source.matchAll(/<img\b[^>]*>/gi)];
  for (const match of imageTags) {
    const tag = match[0];
    const alt = getAttribute(tag, 'alt');
    if (alt === null || alt.trim() === '') {
      findings.push(createFinding({
        ruleId: 'html:image-alt-missing',
        title: '이미지 대체 텍스트가 없습니다',
        severity: 'high',
        impact: ['시각장애인', '스크린리더 사용자'],
        location: tag,
        evidence: tag,
        suggestion: '이미지가 전달하는 핵심 정보를 alt 속성에 적으세요. 장식 이미지는 alt=""로 표시하세요.'
      }));
    }
  }

  const links = [...source.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)];
  for (const match of links) {
    const text = stripTags(match[1]).trim();
    if (VAGUE_LINK_TEXT.includes(text)) {
      findings.push(createFinding({
        ruleId: 'html:vague-link-text',
        title: '링크 이름만으로 목적을 알기 어렵습니다',
        severity: 'medium',
        impact: ['시각장애인', '키보드 사용자', '인지 접근성 지원이 필요한 사용자'],
        location: match[0],
        evidence: text,
        suggestion: '"자세히" 대신 "복지 서비스 신청 방법 보기"처럼 이동 목적을 구체적으로 쓰세요.'
      }));
    }
  }

  const headingLevels = [...source.matchAll(/<h([1-6])\b[^>]*>/gi)].map((match) => Number(match[1]));
  for (let index = 1; index < headingLevels.length; index += 1) {
    if (headingLevels[index] - headingLevels[index - 1] > 1) {
      findings.push(createFinding({
        ruleId: 'html:heading-level-skip',
        title: '제목 단계가 건너뛰어졌습니다',
        severity: 'medium',
        impact: ['스크린리더 사용자', '키보드 사용자'],
        location: `h${headingLevels[index - 1]} 다음 h${headingLevels[index]}`,
        evidence: headingLevels.join(' > '),
        suggestion: 'h1 다음에는 h2, h2 다음에는 h3처럼 문서 구조 순서를 유지하세요.'
      }));
      break;
    }
  }

  const controls = [...source.matchAll(/<(input|textarea|select)\b[^>]*>/gi)];
  for (const match of controls) {
    const tag = match[0];
    const type = (getAttribute(tag, 'type') ?? '').toLowerCase();
    if (['hidden', 'submit', 'button', 'reset'].includes(type)) continue;

    const hasAccessibleName =
      Boolean(getAttribute(tag, 'aria-label')) ||
      Boolean(getAttribute(tag, 'aria-labelledby')) ||
      Boolean(getAttribute(tag, 'title')) ||
      labelTargetsControl(source, getAttribute(tag, 'id'));

    if (!hasAccessibleName) {
      findings.push(createFinding({
        ruleId: 'html:control-label-missing',
        title: '입력칸에 접근 가능한 이름이 없습니다',
        severity: 'high',
        impact: ['시각장애인', '운동장애인', '음성 입력 사용자'],
        location: tag,
        evidence: tag,
        suggestion: 'label의 for 속성으로 입력칸 id를 연결하거나 aria-label을 제공하세요.'
      }));
    }
  }

  return {
    category: 'html',
    label: '웹 접근성 점검',
    summary: summarizeSection('HTML 접근성', findings),
    findings
  };
}

export function analyzeContrast(foreground = '#111827', background = '#ffffff') {
  const ratio = contrastRatio(foreground, background);
  const passesAA = ratio >= 4.5;
  const findings = passesAA
    ? []
    : [createFinding({
        ruleId: 'visual:contrast-aa',
        title: '본문 색 대비가 WCAG AA 기준보다 낮습니다',
        severity: 'high',
        impact: ['저시력자', '고령자', '야외 모바일 사용자'],
        location: `${foreground} / ${background}`,
        evidence: `대비 ${ratio.toFixed(2)}:1`,
        suggestion: '일반 텍스트는 4.5:1 이상이 되도록 글자색을 더 어둡게 하거나 배경색을 더 밝게 조정하세요.'
      })];

  return {
    category: 'contrast',
    label: '색 대비 점검',
    ratio,
    passesAA,
    summary: passesAA ? `색 대비 ${ratio.toFixed(2)}:1로 AA 기준을 통과합니다.` : `색 대비 ${ratio.toFixed(2)}:1로 개선이 필요합니다.`,
    findings
  };
}

export function analyzeAll({ text = '', html = '', foreground = '#111827', background = '#ffffff' } = {}) {
  const sections = [
    analyzeText(text),
    analyzeHtml(html),
    analyzeContrast(foreground, background)
  ];
  const findings = sections.flatMap((section) => section.findings);

  return {
    sections,
    findings,
    score: scoreFindings(findings),
    generatedAt: new Date().toISOString()
  };
}

export function scoreFindings(findings = []) {
  const penalty = findings.reduce((total, finding) => {
    if (finding.severity === 'high') return total + 18;
    if (finding.severity === 'medium') return total + 12;
    return total + 8;
  }, 0);

  return Math.max(0, 100 - penalty);
}

function createFinding({ ruleId, title, severity, impact, location, evidence, suggestion }) {
  return {
    id: `${ruleId}:${hash(`${location}:${evidence}:${suggestion}`)}`,
    ruleId,
    title,
    severity,
    impact,
    location,
    evidence,
    suggestion
  };
}

function summarizeSection(name, findings) {
  if (findings.length === 0) return `${name} 기준에서 큰 문제가 발견되지 않았습니다.`;
  return `${name} 기준에서 ${findings.length}개의 개선 지점을 찾았습니다.`;
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?。！？]|[다요]\.)\s+|(?<=다\.)/g)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function getAttribute(tag, attribute) {
  const pattern = new RegExp(`${attribute}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = tag.match(pattern);
  if (!match) return null;
  return match[2] ?? match[3] ?? match[4] ?? '';
}

function labelTargetsControl(source, id) {
  if (!id) return false;
  const escaped = escapeRegExp(id);
  return new RegExp(`<label\\b[^>]*for\\s*=\\s*["']${escaped}["'][^>]*>`, 'i').test(source);
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, ' ');
}

function contrastRatio(foreground, background) {
  const fg = relativeLuminance(hexToRgb(foreground));
  const bg = relativeLuminance(hexToRgb(background));
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance([red, green, blue]) {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '').trim();
  const full = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;

  if (!/^[0-9a-f]{6}$/i.test(full)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16)
  ];
}

function hash(value) {
  let hashValue = 0;
  for (let index = 0; index < value.length; index += 1) {
    hashValue = (hashValue << 5) - hashValue + value.charCodeAt(index);
    hashValue |= 0;
  }
  return Math.abs(hashValue).toString(36);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
