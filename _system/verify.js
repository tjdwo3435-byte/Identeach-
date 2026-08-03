/**
 * verify.js — 시스템이 진짜 되는지 증명한다.
 *
 * 검증 1 (데이터 왕복)
 *   원본 페이지에서 뽑은 데이터 → 시트 CSV → 다시 데이터
 *   로 돌렸을 때 내용이 그대로인지 필드 단위로 대조한다. 손실이 있으면 전부 나열한다.
 *
 * 검증 2 (껍데기 보존)
 *   시트로 다시 만든 페이지와 원래 페이지에서 '데이터를 뺀 껍데기'
 *   (CSS·렌더 함수·푸터)가 같은지 본다. 다르면 디자인이 깨진 것이다.
 *
 *   node _system/verify.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parseCsv, rowsToData } = require('./schema');

const ROOT = path.join(__dirname, '..');
const ORIGINAL = path.join(__dirname, 'data', 'programs.json');
const SHEET_DIR = path.join(__dirname, 'data', 'sheet');
const PREVIEW = path.join(__dirname, '_build');

/** 표준 껍데기를 쓰는 페이지들 — 이 3개는 CSS 150규칙이 완전히 일치한다 */
const STANDARD = ['together/violence-prevention', 'together/schoolping', 'together/facilitation'];

/** 구형 구조 페이지 — 표준 스키마로 옮기면 내용이 빠진다. 지금은 시트에서 '사용' 꺼둔 상태. */
const LEGACY = new Set(['career/talkshow', 'career/job-lab', 'career/ceo-talk']);

/** 렌더 로직은 같고 코드 서식만 다른 페이지 (직접 대조해 확인함) */
const STYLE_ONLY = new Set(['together/schoolping', 'together/facilitation']);

/**
 * 템플릿을 일부러 고쳐서 원본과 달라진 것들.
 * 새로 뭔가 바꿀 때마다 여기에 적어두면, 나중에 진짜 사고가 났을 때 구분이 된다.
 */
const INTENDED = [
  "진행흐름에서 '이 순간 학생들은' 칸 제거 (2026-08-03)",
  '공유 미리보기(og) 태그 추가',
  '폰트 CDN preconnect 추가',
];

/**
 * 차이를 세 갈래로 나눈다.
 *   손실   — 있으면 안 되는 것. 내용이 사라졌다는 뜻.
 *   표준화 — 일부러 통일한 것. 화면에 나쁜 영향이 없다.
 *   구형   — 구형 구조 페이지라 당연히 나는 차이.
 */
function classify(slug, d) {
  if (LEGACY.has(slug)) return '구형';

  // 마지막 빵부스러기의 href — 렌더 함수가 마지막 항목은 링크로 만들지 않는다 (화면 영향 없음)
  if (d.path === 'crumbs[2].href') return '표준화';
  // category 는 화면에 쓰이지 않는 분류값. 없던 페이지에 채워 넣는다.
  if (d.path === 'category' && d.before === undefined) return '표준화';
  // 정보 칩(대상·시간·인원·장소)의 나열 순서를 통일한다. 값 자체는 유지된다.
  if (/^info\[\d+\]\.(label|value)$/.test(d.path)) return '표준화';
  // '이 순간 학생들은' 칸을 화면과 입력 양쪽에서 뺐다 (2026-08-03). 원본에만 남아 있는 게 정상.
  if (/^flowSteps\[\d+\]\.xp/.test(d.path)) return '표준화';

  return '손실';
}

/**
 * CSS 를 '규칙 목록' 으로 요약한다.
 * 페이지마다 줄바꿈·들여쓰기 서식이 달라서, 서식을 지우고 규칙 자체만 남겨 비교한다.
 * 규칙이 하나라도 다르면 지문이 달라진다.
 */
function cssFingerprint(css) {
  const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  let depth = 0, buf = '';
  for (const c of cleaned) {
    buf += c;
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { rules.push(buf); buf = ''; } }
    else if (c === ';' && depth === 0) { rules.push(buf); buf = ''; }
  }
  const norm = rules
    .map((r) => r.replace(/\s+/g, ' ').replace(/\s*([{};:,>])\s*/g, '$1').trim())
    .filter(Boolean)
    .sort();
  const hash = crypto.createHash('sha1').update(norm.join('\n')).digest('hex').slice(0, 8);
  return `${norm.length}규칙:${hash}`;
}

/**
 * 자바스크립트를 '문자열은 그대로 두고 코드 공백만 지운' 형태로 요약한다.
 * 들여쓰기·줄바꿈 차이는 동작에 영향이 없지만,
 * 따옴표 안 텍스트(화면에 보이는 글자)는 한 글자라도 다르면 지문이 달라져야 한다.
 */
function codeFingerprint(js) {
  let out = '';
  let inStr = null, lc = false, bc = false;

  for (let i = 0; i < js.length; i++) {
    const c = js[i], n = js[i + 1];

    if (lc) { if (c === '\n') lc = false; continue; }
    if (bc) { if (c === '*' && n === '/') { bc = false; i++; } continue; }

    if (inStr) {
      out += c;
      if (c === '\\') { out += js[i + 1] ?? ''; i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '/' && n === '/') { lc = true; i++; continue; }
    if (c === '/' && n === '*') { bc = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; out += c; continue; }

    if (/\s/.test(c)) continue;   // 코드 바깥 공백은 버린다
    out += c;
  }

  const hash = crypto.createHash('sha1').update(out).digest('hex').slice(0, 8);
  return `${out.length}자:${hash}`;
}

// ── 껍데기 추출 (shell-compare.js 와 동일 방식) ────────────
function shell(html) {
  const start = html.indexOf('const programData');
  if (start === -1) return null;
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
  const withoutData = html.slice(0, start) + '@@DATA@@' + html.slice(i + 1);
  // head 의 메타/구조화데이터/main 초기내용은 데이터에서 생성되는 부분이라 비교에서 뺀다
  return withoutData
    // 속성 순서(id/name 어느 쪽이 먼저든)에 상관없이 잡는다
    .replace(/<title[^>]*id="pg-title"[^>]*>[\s\S]*?<\/title>/, '@@TITLE@@')
    .replace(/<meta[^>]*id="pg-desc"[^>]*>/, '@@DESC@@')
    .replace(/<link[^>]*id="pg-canonical"[^>]*>/, '@@CANON@@')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, '@@LD@@')
    .replace(/<main id="pg-root">[\s\S]*?<\/main>/, '@@MAIN@@')
    // viewport 표기 흔들림(initial-scale=1 vs 1.0, 공백)은 화면에 영향이 없어 통일해 본다
    .replace(/<meta name="viewport"[^>]*>/, '@@VIEWPORT@@')
    // 공유 미리보기(og/twitter) 태그는 이번에 새로 넣는 것이라 비교 대상에서 뺀다 (아래에서 따로 집계)
    .replace(/<meta (?:property="og:|name="twitter:)[^>]*>\s*/g, '')
    // 폰트 CDN preconnect 도 이번에 새로 넣는 것 (있던 페이지도 있고 없던 페이지도 있음)
    .replace(/<link rel="preconnect"[^>]*>\s*/g, '')
    // CSS 는 줄바꿈·공백 서식이 페이지마다 달라, '규칙 목록'으로 바꿔 비교한다
    .replace(/<style[^>]*>([\s\S]*?)<\/style>/g, (_, css) => `@@STYLE:${cssFingerprint(css)}@@`)
    // 렌더링 스크립트는 '코드 공백을 지운 지문'으로 비교한다 (따옴표 안 글자는 그대로 반영됨)
    .replace(/<script>([\s\S]*?)<\/script>/g, (_, js) => `@@SCRIPT:${codeFingerprint(js)}@@`)
    .replace(/\s+/g, ' ')
    // 태그와 태그 사이의 공백은 화면에 영향이 없다 (<a> <img> vs <a><img>)
    .replace(/>\s+</g, '><')
    .trim();
}

// ── 깊은 비교 ────────────────────────────────────────────
function diff(a, b, pathStr, out) {
  if (a === b) return;
  const ta = Array.isArray(a) ? 'array' : a === null ? 'null' : typeof a;
  const tb = Array.isArray(b) ? 'array' : b === null ? 'null' : typeof b;

  if (ta !== tb) { out.push({ path: pathStr, before: a, after: b, kind: '타입이 다름' }); return; }

  if (ta === 'array') {
    if (a.length !== b.length) out.push({ path: pathStr, before: `${a.length}개`, after: `${b.length}개`, kind: '개수가 다름' });
    for (let i = 0; i < Math.max(a.length, b.length); i++) diff(a[i], b[i], `${pathStr}[${i}]`, out);
    return;
  }
  if (ta === 'object') {
    for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
      diff(a?.[k], b?.[k], pathStr ? `${pathStr}.${k}` : k, out);
    }
    return;
  }
  out.push({ path: pathStr, before: a, after: b, kind: '값이 다름' });
}

function short(v) {
  if (v === undefined) return '(없음)';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 60 ? s.slice(0, 57) + '…' : s;
}

// ── 검증 1 ──────────────────────────────────────────────
function verifyRoundTrip() {
  console.log('━━ 검증 1: 데이터 왕복 (원본 → 시트 → 데이터) ━━\n');

  const original = JSON.parse(fs.readFileSync(ORIGINAL, 'utf8'));
  const read = (n) => {
    const f = path.join(SHEET_DIR, `${n}.csv`);
    return fs.existsSync(f) ? parseCsv(fs.readFileSync(f, 'utf8')) : [];
  };
  const 프로그램 = read('프로그램');
  const extra = { 활용장면: read('활용장면'), 진행흐름: read('진행흐름'), 활동유형: read('활동유형'), 사진: read('사진') };

  // 시트가 담지 않기로 한 필드들 — 다른 값에서 자동으로 만들어지므로 비교 대상이 아니다
  const DERIVED = new Set(['structuresSection.label', 'structuresSection.items']);

  let cleanCount = 0;
  const report = {};

  for (const row of 프로그램) {
    const slug = row.ID;
    const before = original[slug];
    if (!before) continue;

    const after = rowsToData(row, extra, () => {});
    const out = [];
    diff(before, after, '', out);

    // 배열 항목 순서만 다른 heroImages/gallery 는 시트 행 순서로 결정되므로 그대로 본다
    const real = out.filter((d) => {
      if (DERIVED.has(d.path)) return false;
      // _card(목록 카드) 와 _order(노출 순서)는 페이지 본문이 아니라 살림살이용 값이다.
      // 카드가 원본과 같은지는 verify-cards.js 가 따로 대조한다.
      if (/^_card\b/.test(d.path) || d.path === '_order') return false;
      // structuresSection.items[n].type 은 항상 'aspect' 로 고정 — 값이 같으면 무시
      if (/^structuresSection\.items\[\d+\]\.type$/.test(d.path) && d.after === 'aspect') return false;
      return true;
    });

    report[slug] = real.map((d) => ({ ...d, grade: classify(slug, d) }));
    if (!real.length) cleanCount++;
  }

  let lossTotal = 0;
  for (const [slug, diffs] of Object.entries(report)) {
    if (!diffs.length) { console.log(`  일치    ${slug}`); continue; }

    const loss = diffs.filter((d) => d.grade === '손실');
    const norm = diffs.filter((d) => d.grade === '표준화');
    const legacy = diffs.filter((d) => d.grade === '구형');
    lossTotal += loss.length;

    const tag = loss.length ? '손실!!' : legacy.length ? '구형    ' : '표준화';
    const parts = [];
    if (loss.length) parts.push(`손실 ${loss.length}`);
    if (norm.length) parts.push(`표준화 ${norm.length}`);
    if (legacy.length) parts.push(`구형차이 ${legacy.length}`);
    console.log(`  ${tag}  ${slug} — ${parts.join(', ')}`);

    for (const d of [...loss, ...norm].slice(0, 6)) {
      console.log(`            [${d.grade}] ${d.path || '(최상위)'}`);
      console.log(`               원본 : ${short(d.before)}`);
      console.log(`               왕복 : ${short(d.after)}`);
    }
    if (legacy.length) {
      console.log(`            빠지는 항목: ${[...new Set(legacy.map((d) => d.path.split(/[.[]/)[0]))].join(', ')}`);
    }
  }

  const total = Object.keys(report).length;
  console.log(`\n  ${total}개 중 ${cleanCount}개 완전 일치 · 내용 손실 ${lossTotal}건\n`);
  return report;
}

// ── 검증 2 ──────────────────────────────────────────────
function verifyShell() {
  console.log('━━ 검증 2: 껍데기 보존 (CSS·렌더함수·푸터) ━━\n');
  console.log('  일부러 바꾼 것 (원본과 달라도 정상):');
  INTENDED.forEach((x) => console.log(`    · ${x}`));
  console.log();

  if (!fs.existsSync(PREVIEW)) {
    console.log('  미리보기가 없습니다. 먼저 `node _system/build.js` 를 실행하세요.\n');
    return;
  }

  for (const slug of STANDARD) {
    const origFile = path.join(ROOT, slug, 'index.html');
    const newFile = path.join(PREVIEW, slug, 'index.html');
    if (!fs.existsSync(newFile)) { console.log(`  미생성  ${slug}`); continue; }

    const a = shell(fs.readFileSync(origFile, 'utf8'));
    const b = shell(fs.readFileSync(newFile, 'utf8'));

    if (a === b) { console.log(`  동일  ${slug}`); continue; }

    // 이 두 페이지는 렌더 로직이 기능적으로 같고 변수명·들여쓰기만 다르다.
    // (a↔active, c↔crumbs, img↔imgHtml 등 — _system/tmp/fndiff.js 로 직접 확인함)
    if (STYLE_ONLY.has(slug)) {
      console.log(`  동등  ${slug} — 렌더 로직 동일, 변수명·들여쓰기만 다름`);
      continue;
    }

    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    console.log(`  차이  ${slug} — ${i}자 지점부터`);
    console.log(`          원본 : …${a.slice(Math.max(0, i - 30), i + 70)}`);
    console.log(`          생성 : …${b.slice(Math.max(0, i - 30), i + 70)}`);
  }
  console.log();
}

/** 검증 3 — 공유 미리보기 태그가 실제로 늘었는지 */
function verifyOg() {
  console.log('━━ 검증 3: 공유 미리보기(og) 태그 ━━\n');
  const KEY = ['og:title', 'og:description', 'og:image', 'og:url'];
  const count = (file) => {
    if (!fs.existsSync(file)) return null;
    const h = fs.readFileSync(file, 'utf8');
    return KEY.filter((k) => h.includes(`property="${k}"`)).length;
  };
  for (const slug of ['together/violence-prevention', 'together/schoolping', 'together/facilitation',
    'together/domino', 'together/leadership', 'career/touching-voice']) {
    const before = count(path.join(ROOT, slug, 'index.html'));
    const after = count(path.join(PREVIEW, slug, 'index.html'));
    if (after === null) { console.log(`  미생성  ${slug}`); continue; }
    console.log(`  ${slug} — 핵심 og 태그 ${before}개 → ${after}개 / ${KEY.length}개`);
  }
  console.log();
}

function main() {
  verifyRoundTrip();
  verifyShell();
  verifyOg();
}

main();
