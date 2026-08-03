/**
 * css-compare.js — 페이지별 <style> 블록을 '규칙 단위'로 비교한다.
 *
 * 줄바꿈·주석 차이는 무시하고 실제 CSS 규칙만 뽑아 비교해서,
 * 통합 템플릿 하나로 모든 페이지를 커버할 수 있는지 판단한다.
 *
 *   node _system/css-compare.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const PAGES = [
  'together/leadership',
  'together/domino',
  'together/schoolping',
  'together/facilitation',
  'together/violence-prevention',
  'career/touching-voice',
];

/** HTML 에서 <style> 안쪽만 꺼낸다 (여러 개면 전부 이어붙임) */
function styleText(html) {
  const out = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out.join('\n');
}

/**
 * CSS 를 규칙 단위로 쪼갠다.
 * 중첩(@media 등)은 통째로 하나의 규칙으로 본다 — 안쪽까지 파고들 필요는 없다.
 */
function rules(css) {
  const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, ''); // 주석 제거
  const out = [];
  let depth = 0;
  let buf = '';

  for (const c of cleaned) {
    buf += c;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        out.push(normalize(buf));
        buf = '';
      }
    }
    // @import 처럼 중괄호 없이 세미콜론으로 끝나는 문
    else if (c === ';' && depth === 0) {
      out.push(normalize(buf));
      buf = '';
    }
  }
  return out.filter(Boolean);
}

/** 공백 차이를 없애 같은 규칙이면 같은 문자열이 되게 한다 */
function normalize(rule) {
  return rule
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};:,>])\s*/g, '$1')
    .trim();
}

function main() {
  const perPage = {};
  for (const slug of PAGES) {
    const html = fs.readFileSync(path.join(ROOT, slug, 'index.html'), 'utf8');
    perPage[slug] = new Set(rules(styleText(html)));
  }

  // 모든 페이지에 공통으로 있는 규칙
  const all = Object.values(perPage);
  const common = [...all[0]].filter((r) => all.every((s) => s.has(r)));

  console.log('페이지별 CSS 규칙 수');
  for (const slug of PAGES) console.log(`  ${String(perPage[slug].size).padStart(4)}  ${slug}`);
  console.log(`\n전 페이지 공통 규칙: ${common.length}개\n`);

  console.log('페이지별 "그 페이지에만 있는" 규칙');
  for (const slug of PAGES) {
    const others = PAGES.filter((s) => s !== slug);
    const only = [...perPage[slug]].filter((r) => others.every((s) => !perPage[s].has(r)));
    console.log(`\n── ${slug} — 단독 규칙 ${only.length}개`);
    only.slice(0, 12).forEach((r) => {
      const sel = r.slice(0, r.indexOf('{') === -1 ? 60 : r.indexOf('{'));
      console.log(`     ${sel.trim().slice(0, 70)}`);
    });
    if (only.length > 12) console.log(`     … 외 ${only.length - 12}개`);
  }

  // 합집합 = 통합 템플릿이 담아야 할 전체
  const union = new Set();
  for (const s of all) for (const r of s) union.add(r);
  console.log(`\n합집합(통합 템플릿이 담아야 할 규칙): ${union.size}개`);
}

main();
