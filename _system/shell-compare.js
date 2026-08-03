/**
 * shell-compare.js — 페이지에서 programData 를 걷어낸 '껍데기'가 서로 같은지 본다.
 *
 * 껍데기(HTML 뼈대 + CSS + 렌더 함수 + 푸터)가 동일하다면
 * 그 껍데기를 템플릿으로 삼고 데이터만 갈아끼우면 된다는 뜻이다.
 *
 *   node _system/shell-compare.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const PAGES = [
  'together/violence-prevention',
  'together/schoolping',
  'together/facilitation',
  'together/leadership',
  'together/domino',
  'career/touching-voice',
];

/** programData 블록의 시작/끝 위치를 찾는다 (extract.js 와 같은 방식) */
function dataRange(html) {
  const start = html.indexOf('const programData');
  const braceStart = html.indexOf('{', start);
  let depth = 0, i = braceStart, inStr = null, lc = false, bc = false;
  for (; i < html.length; i++) {
    const c = html[i], n = html[i + 1];
    if (lc) { if (c === '\n') lc = false; continue; }
    if (bc) { if (c === '*' && n === '/') { bc = false; i++; } continue; }
    if (inStr) { if (c === '\\') { i++; continue; } if (c === inStr) inStr = null; continue; }
    if (c === '/' && n === '/') { lc = true; i++; continue; }
    if (c === '/' && n === '*') { bc = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) break; }
  }
  return [start, i + 1];
}

/** 데이터를 빼낸 껍데기. 공백 차이는 무시하고 비교하기 위해 정규화한다. */
function shell(html) {
  const [s, e] = dataRange(html);
  const withoutData = html.slice(0, s) + '@@DATA@@' + html.slice(e);
  return withoutData.replace(/\s+/g, ' ').trim();
}

function main() {
  const hashes = {};
  for (const slug of PAGES) {
    const html = fs.readFileSync(path.join(ROOT, slug, 'index.html'), 'utf8');
    const sh = shell(html);
    hashes[slug] = { hash: crypto.createHash('sha1').update(sh).digest('hex').slice(0, 10), len: sh.length, sh };
  }

  console.log('껍데기 지문 (같은 지문 = 완전히 같은 껍데기)\n');
  for (const slug of PAGES) {
    console.log(`  ${hashes[slug].hash}  ${String(hashes[slug].len).padStart(6)}자  ${slug}`);
  }

  // 지문별로 묶어 보여준다
  const groups = {};
  for (const slug of PAGES) (groups[hashes[slug].hash] ||= []).push(slug);
  console.log('\n묶음:');
  for (const [h, slugs] of Object.entries(groups)) {
    console.log(`  ${h} → ${slugs.length}개  ${slugs.join(', ')}`);
  }

  // 기준(violence-prevention) 과 다른 페이지들이 어디서 갈라지는지 첫 지점을 보여준다
  const base = hashes['together/violence-prevention'].sh;
  console.log('\n기준(violence-prevention) 대비 첫 차이 지점:');
  for (const slug of PAGES) {
    if (slug === 'together/violence-prevention') continue;
    const other = hashes[slug].sh;
    let i = 0;
    while (i < base.length && i < other.length && base[i] === other[i]) i++;
    if (i === base.length && i === other.length) { console.log(`  ${slug}: 차이 없음`); continue; }
    console.log(`  ${slug}: ${i}자 지점`);
    console.log(`      기준 : …${base.slice(Math.max(0, i - 40), i + 60)}`);
    console.log(`      해당 : …${other.slice(Math.max(0, i - 40), i + 60)}`);
  }
}

main();
