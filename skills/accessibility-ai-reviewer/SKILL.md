---
name: accessibility-ai-reviewer
description: Use when reviewing Korean websites, HTML, PDFs, office documents, images, or public-service notices for accessibility barriers, plain-language issues, privacy/security risks, and concrete before/after improvements for socially vulnerable users.
---

# Accessibility AI Reviewer

Review public-facing information so older adults, people with disabilities, children, immigrants, low-literacy users, and mobile-only users can understand and use it.

## Inputs

Accept any of these:

- Website URL or HTML snippet
- Public notice text
- PDF, DOCX, HWP/HWPX, image, or OCR text
- Screenshot or rendered page capture

When the input is a website, inspect both the visible screen and the HTML structure when possible. When the input is a document or image, extract text first and call out any uncertainty from OCR or parsing.

## Review Workflow

1. Identify the audience and task: who needs this information, and what action must they complete?
2. Check plain Korean: long sentences, administrative wording, difficult terms, missing action steps, and unclear deadlines.
3. Check accessibility: alt text, heading order, form labels, link purpose, keyboard flow, focus visibility, contrast, table structure, captions, and document reading order.
4. Check safety and trust: HTTP links, insecure forms, unnecessary personal data, unclear consent, file downloads, and phishing-like wording.
5. Produce fixes with evidence. Do not only say “improve accessibility”; show what changes.

## Output Format

Return a concise structured report in Korean:

```json
{
  "summary": "핵심 문제와 우선순위 요약",
  "improvements": [
    {
      "area": "바뀌어야 할 위치",
      "reason": "문제가 되는 이유",
      "before": "현재 표현 또는 요소",
      "after": "개선 표현 또는 요소",
      "change": "어떻게 바꾸는지"
    }
  ],
  "risks": ["남은 위험 또는 검증 필요 항목"],
  "rewritten_text": "사용자가 바로 붙여넣을 수 있는 쉬운 표현 또는 개선 문안"
}
```

If the user asks for a visual review, describe bounding boxes as numbered regions:

- `1. 영역명`: approximate screen area or selector
- `why`: the barrier
- `change`: the exact fix

Be explicit when a box is approximate because only a screenshot or partial HTML was available.

## Quality Bar

- Prefer concrete before/after examples.
- Use simple Korean in the rewritten text.
- Prioritize high-impact fixes first: blocked forms, missing labels, missing alt text, unreadable contrast, unclear application steps, and privacy risks.
- Do not invent content that the source does not support. Mark unknowns as `검증 필요`.
