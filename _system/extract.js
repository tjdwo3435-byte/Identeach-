/**
 * extract.js — 기존 프로그램 페이지에서 programData 를 뽑아 JSON 으로 저장한다.
 *
 * 지금 홈페이지의 프로그램 페이지들은 각자 안에 `const programData = {...}` 를 품고 있다.
 * 그 데이터만 꺼내오면 "페이지 = 템플릿 + 데이터" 로 나눌 수 있다.
 * 이 스크립트는 최초 1회만 쓰면 된다. (이후엔 시트가 데이터의 원본)
 *
 *   node _system/extract.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'data', 'programs.json');

// 페이지 목록 — slug 는 URL 경로 그대로
const PAGES = [
  { slug: 'together/leadership' },
  { slug: 'together/domino' },
  { slug: 'together/schoolping' },
  { slug: 'together/facilitation' },
  { slug: 'together/violence-prevention' },
  { slug: 'career/touching-voice' },
  { slug: 'career/talkshow' },
  { slug: 'career/job-lab' },
  { slug: 'career/ceo-talk' },
];

/** HTML 안의 `const programData = { ... };` 블록을 찾아 객체로 만든다. */
function extractProgramData(html, label) {
  const start = html.indexOf('const programData');
  if (start === -1) throw new Error(`${label}: programData 를 찾지 못했습니다`);

  const braceStart = html.indexOf('{', start);
  if (braceStart === -1) throw new Error(`${label}: 여는 중괄호가 없습니다`);

  // 문자열/주석 안의 중괄호에 속지 않도록 직접 훑으며 짝을 맞춘다.
  let depth = 0;
  let i = braceStart;
  let inStr = null;      // 따옴표 종류 (' " `)
  let inLineComment = false;
  let inBlockComment = false;

  for (; i < html.length; i++) {
    const c = html[i];
    const next = html[i + 1];

    if (inLineComment) {
      if (c === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (c === '*' && next === '/') { inBlockComment = false; i++; }
      continue;
    }
    if (inStr) {
      if (c === '\\') { i++; continue; }      // 이스케이프 문자는 통째로 건너뛴다
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '/' && next === '/') { inLineComment = true; i++; continue; }
    if (c === '/' && next === '*') { inBlockComment = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }

    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) break;
    }
  }

  if (depth !== 0) throw new Error(`${label}: 중괄호 짝이 맞지 않습니다`);

  const objText = html.slice(braceStart, i + 1);
  // 본인 사이트의 자기 데이터라 eval 로 읽는다 (JSON 이 아니라 JS 객체 리터럴이라 JSON.parse 불가)
  return eval('(' + objText + ')');
}

function main() {
  const result = {};
  const failures = [];

  for (const { slug } of PAGES) {
    const file = path.join(ROOT, slug, 'index.html');
    if (!fs.existsSync(file)) {
      failures.push(`${slug}: 파일 없음 (${file})`);
      continue;
    }
    try {
      const html = fs.readFileSync(file, 'utf8');
      const data = extractProgramData(html, slug);

      // heroImage(단수) 를 쓰던 옛 페이지는 heroImages(복수) 로 통일한다
      if (!data.heroImages && data.heroImage) {
        data.heroImages = [data.heroImage];
        delete data.heroImage;
      }

      result[slug] = data;
      const sections = Object.keys(data).join(', ');
      console.log(`  OK  ${slug}\n      → ${sections}`);
    } catch (e) {
      failures.push(`${slug}: ${e.message}`);
      console.log(`  !!  ${slug} — ${e.message}`);
    }
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2), 'utf8');

  console.log(`\n추출 ${Object.keys(result).length}개 → ${path.relative(ROOT, OUT)}`);
  if (failures.length) {
    console.log(`실패 ${failures.length}개:`);
    failures.forEach((f) => console.log(`  - ${f}`));
  }
}

main();
