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

const UNIVERSAL_DESIGN_PRINCIPLES = [
  {
    id: 'equitable-use',
    label: '공평한 사용',
    source: 'Universal Design',
    rules: ['html:image-alt-missing', 'html:control-label-missing', 'security:'],
    pass: '장애나 환경에 따라 이용 방식이 분리되지 않습니다.',
    action: '이미지 설명, 입력 이름, 개인정보 보호 안내를 같은 화면 흐름 안에 제공합니다.'
  },
  {
    id: 'flexibility',
    label: '유연한 사용',
    source: 'Universal Design',
    rules: ['html:vague-link-text', 'html:control-label-missing'],
    pass: '마우스, 키보드, 보조기기 사용자 모두 같은 과업을 수행할 수 있습니다.',
    action: '링크 목적과 입력 라벨을 명확히 하여 사용자가 원하는 방식으로 탐색하게 합니다.'
  },
  {
    id: 'simple-intuitive',
    label: '단순하고 직관적인 이해',
    source: 'Universal Design',
    rules: ['plain-language:', 'html:heading-level-skip'],
    pass: '경험, 언어 능력, 집중 상태와 관계없이 흐름을 이해하기 쉽습니다.',
    action: '어려운 행정 용어를 풀고 제목 구조를 순서대로 정리합니다.'
  },
  {
    id: 'perceptible-information',
    label: '인지 가능한 정보',
    source: 'Universal Design / WCAG',
    rules: ['visual:contrast-aa', 'html:image-alt-missing', 'document:'],
    pass: '시각 정보가 텍스트·대비·보조기술을 통해 충분히 전달됩니다.',
    action: '색 대비를 높이고 비텍스트 정보에는 동등한 대체 텍스트를 제공합니다.'
  },
  {
    id: 'tolerance-for-error',
    label: '오류 허용',
    source: 'Universal Design',
    rules: ['security:', 'html:control-label-missing'],
    pass: '실수하거나 위험한 행동을 하기 전에 의미 있는 단서가 제공됩니다.',
    action: '폼 제출 보안, 입력 목적, 제출 전 확인 안내를 분명히 합니다.'
  },
  {
    id: 'low-effort',
    label: '적은 신체·인지 부담',
    source: 'Universal Design / UDL',
    rules: ['plain-language:long-sentence', 'html:vague-link-text'],
    pass: '반복 읽기나 추측 없이 핵심 행동을 빠르게 찾을 수 있습니다.',
    action: '긴 문장을 나누고 버튼·링크 이름에 사용자의 다음 행동을 드러냅니다.'
  },
  {
    id: 'multiple-means',
    label: '다양한 표현과 행동 방식',
    source: 'UDL',
    rules: ['plain-language:', 'html:image-alt-missing', 'html:heading-level-skip', 'document:'],
    pass: '텍스트, 구조, 시각 정보가 서로 보완되어 여러 방식으로 이해할 수 있습니다.',
    action: '쉬운 문안, 구조화된 제목, 이미지 설명을 함께 제공해 이해 경로를 늘립니다.'
  }
];

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
    universalDesign: analyzeUniversalDesign(findings),
    score: scoreFindings(findings),
    generatedAt: new Date().toISOString()
  };
}

export function analyzeUniversalDesign(findings = []) {
  return UNIVERSAL_DESIGN_PRINCIPLES.map((principle) => {
    const matched = findings.filter((finding) => {
      return principle.rules.some((rule) => finding.ruleId?.startsWith(rule) || finding.ruleId?.includes(rule));
    });
    const highCount = matched.filter((finding) => finding.severity === 'high').length;
    const status = highCount > 0 ? 'needs-work' : matched.length > 0 ? 'watch' : 'ok';

    return {
      ...principle,
      status,
      findingCount: matched.length,
      evidence: matched.slice(0, 3).map((finding) => finding.title),
      summary: status === 'ok'
        ? principle.pass
        : `${matched.length}개의 관련 장벽이 있어 보완이 필요합니다.`,
      recommendation: status === 'ok' ? '현재 구조를 유지하면서 실제 사용자 테스트로 확인하세요.' : principle.action
    };
  });
}

export function createImprovementPlan({ text = '', html = '', foreground = '#111827', background = '#ffffff' } = {}) {
  const before = analyzeAll({ text, html, foreground, background });
  const textResult = improveText(text);
  const htmlResult = improveHtml(html);
  const contrastResult = improveContrast(foreground, background);
  const improved = {
    text: textResult.value,
    html: htmlResult.value,
    foreground: contrastResult.foreground,
    background: contrastResult.background
  };
  const after = analyzeAll(improved);

  return {
    before,
    after,
    improved,
    changes: [
      ...textResult.changes,
      ...htmlResult.changes,
      ...contrastResult.changes
    ]
  };
}

export function buildChangeHighlights({ findings = [], changes = [] } = {}) {
  const buckets = new Map();

  for (const finding of findings) {
    const target = targetFromRule(finding.ruleId);
    const current = buckets.get(target) || {
      target,
      title: titleFromTarget(target),
      severity: finding.severity || 'medium',
      reasons: [],
      changes: [],
      box: boxForTarget(target)
    };
    current.reasons.push(finding.title);
    current.severity = strongestSeverity(current.severity, finding.severity);
    buckets.set(target, current);
  }

  for (const change of changes) {
    const target = targetFromChange(change);
    const current = buckets.get(target) || {
      target,
      title: titleFromTarget(target),
      severity: 'medium',
      reasons: [],
      changes: [],
      box: boxForTarget(target)
    };
    current.changes.push(change);
    buckets.set(target, current);
  }

  return [...buckets.values()].map((highlight, index) => ({
    ...highlight,
    index: String(index + 1),
    summary: summarizeHighlight(highlight),
    id: `highlight-${highlight.target}-${index}`
  }));
}

export function scoreFindings(findings = []) {
  const penalty = findings.reduce((total, finding) => {
    if (finding.severity === 'high') return total + 18;
    if (finding.severity === 'medium') return total + 12;
    return total + 8;
  }, 0);

  return Math.max(0, 100 - penalty);
}

function targetFromRule(ruleId = '') {
  if (ruleId.includes('image-alt')) return 'image';
  if (ruleId.includes('document:')) return 'text';
  if (ruleId.includes('heading')) return 'heading';
  if (ruleId.includes('link')) return 'link';
  if (ruleId.includes('control')) return 'form';
  if (ruleId.includes('contrast')) return 'contrast';
  return 'text';
}

function targetFromChange(change = {}) {
  const title = `${change.type || ''} ${change.title || ''}`.toLowerCase();
  const before = String(change.before || '').toLowerCase();
  const after = String(change.after || '').toLowerCase();
  if (title.includes('이미지') || before.includes('<img') || after.includes('<img')) return 'image';
  if (title.includes('제목') || before.includes('<h') || after.includes('<h')) return 'heading';
  if (title.includes('링크') || before.includes('<a') || after.includes('<a')) return 'link';
  if (title.includes('입력') || before.includes('<input') || after.includes('<input') || after.includes('<label')) return 'form';
  if (title.includes('대비') || title.includes('contrast')) return 'contrast';
  return 'text';
}

function titleFromTarget(target) {
  const titles = {
    text: '본문 표현',
    image: '이미지 설명',
    heading: '제목 구조',
    link: '링크 이름',
    form: '입력 영역',
    contrast: '색 대비'
  };
  return titles[target] || '검토 영역';
}

function boxForTarget(target) {
  const boxes = {
    text: { x: 7, y: 12, width: 86, height: 20 },
    heading: { x: 8, y: 38, width: 62, height: 12 },
    image: { x: 8, y: 55, width: 30, height: 20 },
    link: { x: 43, y: 56, width: 38, height: 10 },
    form: { x: 43, y: 71, width: 42, height: 12 },
    contrast: { x: 68, y: 8, width: 24, height: 14 }
  };
  return boxes[target] || boxes.text;
}

function strongestSeverity(a = 'low', b = 'low') {
  const rank = { low: 1, medium: 2, high: 3 };
  return rank[b] > rank[a] ? b : a;
}

function summarizeHighlight(highlight) {
  const firstChange = highlight.changes?.[0];
  if (firstChange) return `${firstChange.before || highlight.title} -> ${firstChange.after}`;
  return highlight.reasons?.[0] || '접근성 개선이 필요한 영역입니다.';
}

function improveText(text) {
  let value = text.trim();
  const changes = [];

  const phrasing = [
    ['주민등록등본 및 소득증빙자료를 첨부하여야 하며 기한 내 미제출 시 접수가 반려될 수 있습니다', '주민등록 확인 서류와 소득을 확인하는 서류를 함께 내야 합니다. 기한 안에 내지 않으면 접수되지 않을 수 있습니다'],
    ['신청 절차를 간소화하기 위하여', '신청 절차를 줄이기 위해'],
    ['첨부하여야 하며', '함께 내야 합니다.'],
    ['첨부하여야 합니다', '함께 내야 합니다'],
    ['제출하여야 합니다', '제출해야 합니다'],
    ['반려될 수 있습니다', '접수되지 않을 수 있습니다'],
    ['선정합니다', '정합니다'],
    ['거쳐', '받아']
  ];

  for (const [before, after] of phrasing) {
    if (value.includes(before)) {
      value = value.replaceAll(before, after);
      changes.push({
        type: 'text',
        title: '행정 문체를 직접적인 표현으로 변경',
        before,
        after
      });
    }
  }

  for (const [term, replacement] of DIFFICULT_TERMS) {
    if (value.includes(term)) {
      value = value.replaceAll(term, replacement);
      changes.push({
        type: 'text',
        title: `쉬운 표현으로 변경: ${term}`,
        before: term,
        after: replacement
      });
    }
  }

  value = smoothKoreanParticles(value);
  value = splitLongText(value);

  return { value, changes };
}

function improveHtml(html) {
  let value = html.trim();
  const changes = [];
  const headingText = stripTags(value.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '안내문');

  value = value.replace(/<img\b([^>]*?)>/gi, (tag, attributes) => {
    const alt = getAttribute(tag, 'alt');
    if (alt !== null && alt.trim() !== '') return tag;

    changes.push({
      type: 'html',
      title: '이미지 대체 텍스트 추가',
      before: tag,
      after: `<img${attributes} alt="${headingText} 관련 안내 이미지">`
    });
    return `<img${attributes} alt="${headingText} 관련 안내 이미지">`;
  });

  value = normalizeHeadingSkips(value, changes);

  value = value.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (tag, attributes, content) => {
    const label = stripTags(content).trim();
    if (!VAGUE_LINK_TEXT.includes(label)) return tag;

    const betterLabel = `${headingText} 신청 방법 보기`;
    changes.push({
      type: 'html',
      title: '링크 이름을 구체적으로 변경',
      before: label,
      after: betterLabel
    });
    return `<a${attributes}>${betterLabel}</a>`;
  });

  value = value.replace(/<(input|textarea|select)\b([^>]*?)>/gi, (tag, elementName, attributes) => {
    const type = (getAttribute(tag, 'type') ?? '').toLowerCase();
    const id = getAttribute(tag, 'id');
    const hasAccessibleName =
      ['hidden', 'submit', 'button', 'reset'].includes(type) ||
      Boolean(getAttribute(tag, 'aria-label')) ||
      Boolean(getAttribute(tag, 'aria-labelledby')) ||
      Boolean(getAttribute(tag, 'title')) ||
      labelTargetsControl(value, id);

    if (hasAccessibleName) return tag;

    if (id) {
      changes.push({
        type: 'html',
        title: '입력칸 라벨 추가',
        before: tag,
        after: `<label for="${id}">${guessControlLabel(id)}</label> ${tag}`
      });
      return `<label for="${id}">${guessControlLabel(id)}</label> ${tag}`;
    }

    changes.push({
      type: 'html',
      title: '입력칸 접근 이름 추가',
      before: tag,
      after: `<${elementName}${attributes} aria-label="입력 내용">`
    });
    return `<${elementName}${attributes} aria-label="입력 내용">`;
  });

  return { value, changes };
}

function improveContrast(foreground, background) {
  if (analyzeContrast(foreground, background).passesAA) {
    return { foreground, background, changes: [] };
  }

  return {
    foreground: '#111827',
    background,
    changes: [{
      type: 'contrast',
      title: '본문 색 대비 개선',
      before: foreground,
      after: '#111827'
    }]
  };
}

function splitLongText(text) {
  return splitSentences(text).map((sentence) => {
    if (sentence.length < 50) return sentence;
    return sentence
      .replace(/ 합니다\.\s*/g, ' 합니다.\n')
      .replace(/ 하며\s*/g, ' 합니다.\n')
      .replace(/ 및 /g, '와 ');
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function smoothKoreanParticles(text) {
  return text
    .replaceAll('사람를', '사람을')
    .replaceAll('사람는', '사람은')
    .replaceAll('서류를 함께 내기하여야 합니다', '서류를 함께 내야 합니다')
    .replaceAll('접수되지 않음될 수 있습니다', '접수되지 않을 수 있습니다')
    .replaceAll('절차를 줄임하기', '절차를 줄이기');
}

function normalizeHeadingSkips(source, changes) {
  let value = source;
  const headingMatches = [...value.matchAll(/<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi)];
  let previousLevel = null;

  for (const match of headingMatches) {
    const currentLevel = Number(match[1]);
    if (previousLevel !== null && currentLevel - previousLevel > 1) {
      const nextLevel = previousLevel + 1;
      const before = match[0];
      const after = `<h${nextLevel}${match[2]}>${match[3]}</h${nextLevel}>`;
      value = value.replace(before, after);
      changes.push({
        type: 'html',
        title: '제목 단계를 순서대로 정리',
        before,
        after
      });
      previousLevel = nextLevel;
    } else {
      previousLevel = currentLevel;
    }
  }

  return value;
}

function guessControlLabel(id) {
  const normalized = id.toLowerCase();
  if (normalized.includes('name')) return '이름';
  if (normalized.includes('phone') || normalized.includes('tel')) return '연락처';
  if (normalized.includes('email')) return '이메일';
  if (normalized.includes('address')) return '주소';
  return '입력 내용';
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
