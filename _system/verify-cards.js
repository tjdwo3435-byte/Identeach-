/**
 * verify-cards.js — 다시 만든 목록 페이지가 원본과 같은지 확인한다.
 *
 * 카드 격자(<div class="grid">) 안쪽만 떼어내, 공백 차이를 지우고 대조한다.
 *
 *   node _system/verify-cards.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PREVIEW = path.join(__dirname, '_build');
const LISTS = ['together/index.html', 'career/index.html'];

/** <div class="grid"> 안쪽만 꺼낸다 */
function gridInner(html) {
  const open = html.indexOf('<div class="grid">');
  if (open === -1) return null;
  const start = open + '<div class="grid">'.length;
  let depth = 0, end = -1;
  const re = /<div\b[^>]*>|<\/div>/g;
  re.lastIndex = open;
  let m;
  while ((m = re.exec(html))) {
    if (m[0] === '</div>') { depth--; if (depth === 0) { end = m.index; break; } }
    else depth++;
  }
  return end === -1 ? null : html.slice(start, end);
}

/** 카드 단위로 쪼개고 공백을 정규화 */
function cards(inner) {
  return [...inner.matchAll(/<a href="[^"]+" class="card"[\s\S]*?<\/a>/g)]
    .map((m) => m[0].replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim());
}

let mismatch = 0;

for (const rel of LISTS) {
  const origFile = path.join(ROOT, rel);
  const newFile = path.join(PREVIEW, rel);
  console.log(`━━ ${rel}`);
  if (!fs.existsSync(newFile)) { console.log('  생성본 없음\n'); continue; }

  const a = cards(gridInner(fs.readFileSync(origFile, 'utf8')) || '');
  const b = cards(gridInner(fs.readFileSync(newFile, 'utf8')) || '');

  console.log(`  카드 수: 원본 ${a.length} / 생성 ${b.length}`);

  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const slug = (a[i] || b[i] || '').match(/href="([^"]+)"/)?.[1] || `#${i}`;
    if (a[i] === b[i]) { console.log(`  동일  ${slug}`); continue; }
    mismatch++;
    console.log(`  차이  ${slug}`);
    const x = a[i] || '', y = b[i] || '';
    let k = 0;
    while (k < x.length && k < y.length && x[k] === y[k]) k++;
    console.log(`          원본 : …${x.slice(Math.max(0, k - 30), k + 80)}`);
    console.log(`          생성 : …${y.slice(Math.max(0, k - 30), k + 80)}`);
  }
  console.log();
}

console.log(mismatch === 0 ? '모든 카드가 원본과 일치합니다.' : `일치하지 않는 카드 ${mismatch}장`);
