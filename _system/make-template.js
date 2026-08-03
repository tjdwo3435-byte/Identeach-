/**
 * make-template.js — 표준 페이지에서 '껍데기'만 남긴 템플릿을 만든다.
 *
 * 기준 페이지: together/violence-prevention
 *   → schoolping · facilitation 과 CSS 150개 규칙이 완전히 동일한 최신 표준형.
 *
 * 데이터가 박혀 있던 6곳을 자리표시자로 바꾼다:
 *   {{PAGE_TITLE}} {{PAGE_DESC}} {{CANONICAL}} {{BREADCRUMB_JSON}}
 *   {{MAIN_FALLBACK}} {{PROGRAM_DATA}}
 *
 *   node _system/make-template.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE = path.join(ROOT, 'together', 'violence-prevention', 'index.html');
const OUT = path.join(__dirname, 'template.html');

/** 딱 한 번만 바뀌어야 하는 치환. 0번이나 2번 이상이면 즉시 멈춘다. */
function replaceOnce(html, re, replacement, label) {
  const matches = html.match(re);
  if (!matches) throw new Error(`[${label}] 대상을 찾지 못했습니다`);
  const count = (html.match(new RegExp(re.source, re.flags.replace('g', '') + 'g')) || []).length;
  if (count !== 1) throw new Error(`[${label}] ${count}곳이 일치합니다 — 1곳이어야 합니다`);
  console.log(`  치환 OK  ${label}`);
  return html.replace(re, replacement);
}

function main() {
  let html = fs.readFileSync(BASE, 'utf8');

  html = replaceOnce(html,
    /<title id="pg-title">[\s\S]*?<\/title>/,
    '<title id="pg-title">{{PAGE_TITLE}}</title>', 'title');

  html = replaceOnce(html,
    /<meta id="pg-desc" name="description" content="[^"]*">/,
    '<meta id="pg-desc" name="description" content="{{PAGE_DESC}}">', 'meta description');

  // canonical 뒤에 공유 미리보기(오픈그래프) 태그를 붙인다.
  // 지금 사이트는 og:image 가 아예 없어 카카오톡·페이스북 공유 시 미리보기가 비어 보인다.
  const OG_BLOCK = [
    '<link id="pg-canonical" rel="canonical" href="{{CANONICAL}}">',
    '<meta property="og:type" content="website">',
    '<meta property="og:locale" content="ko_KR">',
    '<meta property="og:site_name" content="아이덴티치">',
    '<meta property="og:title" content="{{PAGE_TITLE_ATTR}}">',
    '<meta property="og:description" content="{{PAGE_DESC}}">',
    '<meta property="og:url" content="{{CANONICAL}}">',
    '<meta property="og:image" content="{{OG_IMAGE}}">',
    '<meta name="twitter:card" content="summary_large_image">',
    // 폰트를 받아오는 CDN 에 미리 연결해 첫 화면 표시를 앞당긴다
    // (schoolping·facilitation 에만 있던 것 — 모든 페이지에 적용)
    '<link rel="preconnect" href="https://cdn.jsdelivr.net">',
  ].join('\n');

  html = replaceOnce(html,
    /<link id="pg-canonical" rel="canonical" href="[^"]*">/,
    OG_BLOCK, 'canonical + 공유 미리보기(og) 태그');

  html = replaceOnce(html,
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    '<script type="application/ld+json">\n{{BREADCRUMB_JSON}}\n</script>', 'ld+json 구조화데이터');

  html = replaceOnce(html,
    /<main id="pg-root">[\s\S]*?<\/main>/,
    '<main id="pg-root">{{MAIN_FALLBACK}}</main>', 'main 초기내용(SEO 대체 텍스트)');

  // ── '이 순간 학생들은' 칸 제거 (2026-08-03 결정) ──────────
  // 진행 흐름 옆에 붙던 노란 칸. 빼기로 해서 렌더 코드와 배지, 2단 배치를 걷어낸다.
  // 블록을 통째로 정확히 지목한다. (`.*?</div>` 로 자르면 바깥 div 의 닫는 태그까지 먹는다)
  html = replaceOnce(html,
    /<div class="flow-xp"><div class="flow-xp-step">[^<]*<\/div><div class="flow-xp-action">\$\{nl\(s\.xp\.action\)\}<\/div><div class="flow-xp-detail">\$\{s\.xp\.detail\}<\/div><\/div>/,
    '', "진행흐름의 '이 순간 학생들은' 칸");

  html = replaceOnce(html,
    /<span class="flow-badge flow-badge--xp">[^<]*<\/span>/,
    '', "'이 활동에서 학생들은' 배지");

  // 칸이 하나만 남으므로 2단 배치를 1단으로
  html = replaceOnce(html,
    /(\.flow-right\{padding:[^}]*?)grid-template-columns:1fr 1fr/,
    '$1grid-template-columns:1fr', '진행흐름 2단 배치 → 1단');

  // programData 객체 — 중괄호 짝을 세어 정확한 끝을 찾는다
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
  html = html.slice(0, braceStart) + '{{PROGRAM_DATA}}' + html.slice(i + 1);
  console.log('  치환 OK  programData 객체');

  fs.writeFileSync(OUT, html, 'utf8');

  // 자리표시자가 예상한 개수만큼 있는지 확인 (og 태그 때문에 몇 개는 2번 쓰인다)
  const expected = {
    PAGE_TITLE: 1, PAGE_TITLE_ATTR: 1, PAGE_DESC: 2, CANONICAL: 2,
    OG_IMAGE: 1, BREADCRUMB_JSON: 1, MAIN_FALLBACK: 1, PROGRAM_DATA: 1,
  };
  console.log('\n자리표시자 점검');
  let ok = true;
  for (const [h, want] of Object.entries(expected)) {
    const n = (html.match(new RegExp(`\\{\\{${h}\\}\\}`, 'g')) || []).length;
    console.log(`  ${n === want ? 'OK ' : '!! '} {{${h}}} — ${n}개 (기대 ${want})`);
    if (n !== want) ok = false;
  }

  console.log(`\n템플릿 저장 → ${path.relative(ROOT, OUT)}  (${html.length}자)`);
  if (!ok) process.exitCode = 1;
}

main();
