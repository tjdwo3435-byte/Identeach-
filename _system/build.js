/**
 * build.js — 시트(CSV) 를 읽어 프로그램 페이지를 만든다.
 *
 *   node _system/build.js            → _system/_build/ 에 미리보기 생성 (실제 사이트는 그대로)
 *   node _system/build.js --apply    → 실제 사이트 경로에 반영 + 목록·sitemap 갱신
 *
 * 데이터 출처는 _system/data/sheet/*.csv 다.
 * (시트에서 내려받거나, sync.js 로 '웹에 게시' 링크에서 자동으로 받아온다)
 */
const fs = require('fs');
const path = require('path');
const { SITE, CATEGORIES, parseCsv, rowsToData, isYes } = require('./schema');

const ROOT = path.join(__dirname, '..');
const SHEET_DIR = path.join(__dirname, 'data', 'sheet');
const TEMPLATE = path.join(__dirname, 'template.html');
const PREVIEW = path.join(__dirname, '_build');

const APPLY = process.argv.includes('--apply');

// ── 유틸 ────────────────────────────────────────────────
const escAttr = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function readSheet(name) {
  const file = path.join(SHEET_DIR, `${name}.csv`);
  if (!fs.existsSync(file)) return [];
  return parseCsv(fs.readFileSync(file, 'utf8'));
}

// ── 페이지 조립 ──────────────────────────────────────────

/** 검색엔진용 구조화 데이터 (빵부스러기 경로) */
function breadcrumbJson(d, slug) {
  const items = [
    { '@type': 'ListItem', position: 1, name: '홈', item: `${SITE}/` },
    { '@type': 'ListItem', position: 2, name: d.crumbs[1].label, item: SITE + d.crumbs[1].href },
    { '@type': 'ListItem', position: 3, name: d.title, item: `${SITE}/${slug}` },
  ];
  return JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items });
}

/**
 * 자바스크립트가 꺼져 있어도(=검색 크롤러가 봐도) 제목과 소개가 보이도록 하는 초기 내용.
 * 기존 페이지들은 이 부분이 손으로 쓰여 실제 데이터와 어긋나 있었다 — 이제 자동으로 맞춘다.
 */
function mainFallback(d) {
  const sub = (d.description || '').replace(/\n/g, ' ');
  return `<div class="hero-info"><div class="wrap">\n  <h1 class="hero-h1">${escHtml(d.title)}</h1>\n  <p class="hero-sub">${escHtml(sub)}</p>\n</div></div>`;
}

/** 공유 미리보기용 이미지 — 대표사진 첫 장을 절대주소로. 없으면 로고. */
function ogImage(d) {
  const first = (d.heroImages && d.heroImages[0] && d.heroImages[0].src)
    || (d.activity && d.activity.image && d.activity.image.src)
    || '/assets/images/logo.png';
  return first.startsWith('http') ? first : SITE + first;
}

function renderPage(template, slug, d) {
  const values = {
    PAGE_TITLE: escHtml(d.pageTitle),
    PAGE_TITLE_ATTR: escAttr(d.pageTitle),
    PAGE_DESC: escAttr(d.pageDesc),
    CANONICAL: escAttr(d.canonicalUrl),
    OG_IMAGE: escAttr(ogImage(d)),
    BREADCRUMB_JSON: breadcrumbJson(d, slug),
    MAIN_FALLBACK: mainFallback(d),
    PROGRAM_DATA: JSON.stringify(d, null, 2),
  };

  let html = template;
  for (const [key, val] of Object.entries(values)) {
    html = html.split(`{{${key}}}`).join(val);
  }

  const left = html.match(/\{\{[A-Z_]+\}\}/g);
  if (left) throw new Error(`${slug}: 채우지 못한 자리표시자 ${[...new Set(left)].join(', ')}`);
  return html;
}

// ── 목록 페이지 카드 ─────────────────────────────────────

/** 목록 페이지에 들어갈 카드 한 장 */
function renderCard(slug, card) {
  const tagSpans = (card.카드태그 || '')
    .split(',').map((t) => t.trim()).filter(Boolean)
    .map((t) => `<span>${escHtml(t)}</span>`).join('');

  const badgeClass = card.카드배지색 === '주황' ? ' thumb-tag--orange' : '';
  const badge = card.카드배지
    ? `\n            <span class="thumb-tag${badgeClass}">${escHtml(card.카드배지)}</span>`
    : '';

  // '준비 중' 뱃지가 있으면 카드에 position:relative 가 필요하다 (뱃지가 절대배치라서)
  const soon = card.준비중
    ? `\n            <span style="position:absolute;top:10px;right:10px;background:var(--blue);color:#fff;font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;letter-spacing:.04em;">준비 중</span>`
    : '';
  const openTag = card.준비중
    ? `<a href="/${slug}" class="card" style="position:relative;">`
    : `<a href="/${slug}" class="card">`;

  const title = escHtml(card.카드제목).split('|').map((x) => x.trim()).join('<br>');

  return [
    `        ${openTag}`,
    `          <div class="thumb">`,
    `            <img src="${escAttr(card.카드썸네일)}" alt="${escAttr(card.카드썸네일설명)}">${badge}${soon}`,
    `          </div>`,
    `          <div class="body">`,
    `            <h3>${title}</h3>`,
    `            <p>${escHtml(card.카드설명)}</p>`,
    tagSpans ? `            <div class="tags">${tagSpans}</div>` : '',
    `            <span class="more">자세히 보기 →</span>`,
    `          </div>`,
    `        </a>`,
  ].filter(Boolean).join('\n');
}

/**
 * 목록 페이지의 <div class="grid"> 안쪽만 갈아끼운다.
 * 페이지의 나머지(설명글·디자인)는 손대지 않는다.
 */
function updateListPage(file, cards) {
  if (!fs.existsSync(file)) return { ok: false, reason: '파일 없음' };
  const html = fs.readFileSync(file, 'utf8');

  const open = html.indexOf('<div class="grid">');
  if (open === -1) return { ok: false, reason: '<div class="grid"> 를 찾지 못함' };

  // grid 의 짝이 되는 </div> 찾기
  let i = open, depth = 0, end = -1;
  const re = /<div\b[^>]*>|<\/div>/g;
  re.lastIndex = open;
  let m;
  while ((m = re.exec(html))) {
    if (m[0] === '</div>') { depth--; if (depth === 0) { end = m.index; break; } }
    else depth++;
  }
  if (end === -1) return { ok: false, reason: 'grid 의 닫는 태그를 찾지 못함' };

  const body = '\n\n' + cards.join('\n\n') + '\n\n      ';
  const updated = html.slice(0, open + '<div class="grid">'.length) + body + html.slice(end);
  return { ok: true, html: updated, count: cards.length };
}

// ── sitemap ─────────────────────────────────────────────

function buildSitemap(slugs) {
  const fixed = [
    { loc: '/', freq: 'weekly', pri: '1.0' },
    { loc: '/together', freq: 'weekly', pri: '0.9' },
    { loc: '/career', freq: 'weekly', pri: '0.9' },
    { loc: '/events', freq: 'weekly', pri: '0.9' },
  ];
  const tail = [
    { loc: '/about', freq: 'monthly', pri: '0.7' },
    { loc: '/request', freq: 'monthly', pri: '0.7' },
  ];
  const line = (u) => `  <url><loc>${SITE}${u.loc === '/' ? '/' : u.loc}</loc><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`;

  const progs = slugs.map((s) => ({ loc: `/${s}`, freq: 'monthly', pri: '0.8' }));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...fixed.map(line),
    '',
    ...progs.map(line),
    '',
    ...tail.map(line),
    '</urlset>',
    '',
  ].join('\n');
}

// ── 메인 ────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(TEMPLATE)) {
    console.error('template.html 이 없습니다. 먼저 `node _system/make-template.js` 를 실행하세요.');
    process.exit(1);
  }
  const template = fs.readFileSync(TEMPLATE, 'utf8');

  const 프로그램 = readSheet('프로그램');
  if (!프로그램.length) {
    console.error(`시트 데이터가 없습니다: ${path.relative(ROOT, SHEET_DIR)}/프로그램.csv`);
    console.error('시트를 내려받아 넣거나 `node _system/sync.js` 를 먼저 실행하세요.');
    process.exit(1);
  }
  const extra = {
    활용장면: readSheet('활용장면'),
    진행흐름: readSheet('진행흐름'),
    활동유형: readSheet('활동유형'),
    사진: readSheet('사진'),
  };

  const warnings = [];
  const built = [];

  for (const row of 프로그램) {
    if (!isYes(row.사용)) {
      console.log(`  건너뜀  ${row.ID || '(ID없음)'} — 사용 칸이 비어 있음`);
      continue;
    }
    if (!row.ID) { warnings.push('ID 가 빈 행이 있습니다 — 건너뜁니다'); continue; }

    const d = rowsToData(row, extra, (w) => warnings.push(w));
    const html = renderPage(template, row.ID, d);

    const outFile = APPLY
      ? path.join(ROOT, row.ID, 'index.html')
      : path.join(PREVIEW, row.ID, 'index.html');

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, html, 'utf8');
    built.push({ slug: row.ID, title: row.프로그램명, category: row.분류, file: outFile });
    console.log(`  생성  ${row.ID}  (${html.length}자)`);
  }

  // 목록 페이지 — 카테고리별로 카드를 다시 그린다.
  // '사용' 을 꺼둔 프로그램도 페이지가 살아있으면 목록에는 남긴다.
  // 카드 순서 = 시트의 행 순서다. (시트에서 행을 옮기면 목록 순서가 바뀐다)
  const byList = {};
  for (const row of 프로그램) {
    if (!row.ID) continue;
    const alive = built.some((b) => b.slug === row.ID) || fs.existsSync(path.join(ROOT, row.ID, 'index.html'));
    if (!alive) continue;
    const cat = CATEGORIES[row.분류];
    if (!cat || cat.path === '/events') continue;   // 학교행사 페이지는 카드 구조가 아니다
    const listFile = `${cat.path.replace(/^\//, '')}/index.html`;
    (byList[listFile] ||= []).push(renderCard(row.ID, rowsToData(row, extra, () => {})._card));
  }

  for (const [rel, cards] of Object.entries(byList)) {
    const src = path.join(ROOT, rel);
    const res = updateListPage(src, cards);
    if (!res.ok) { warnings.push(`목록 갱신 실패 ${rel}: ${res.reason}`); continue; }
    const out = APPLY ? src : path.join(PREVIEW, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, res.html, 'utf8');
    console.log(`  목록  ${rel} — 카드 ${res.count}장`);
  }

  // sitemap — 이번에 만든 페이지 + '사용' 을 꺼놨지만 사이트에 실제로 살아있는 페이지까지 모두 넣는다
  // (꺼진 페이지를 빼버리면 멀쩡히 있는 페이지가 검색에서 사라진다)
  const sitemapSlugs = [...built.map((b) => b.slug)];
  for (const row of 프로그램) {
    if (!row.ID || sitemapSlugs.includes(row.ID)) continue;
    if (fs.existsSync(path.join(ROOT, row.ID, 'index.html'))) {
      sitemapSlugs.push(row.ID);
      console.log(`  sitemap 유지  ${row.ID} — 빌드 대상은 아니지만 페이지가 살아있음`);
    }
  }
  const sitemap = buildSitemap(sitemapSlugs);
  const sitemapOut = APPLY ? path.join(ROOT, 'sitemap.xml') : path.join(PREVIEW, 'sitemap.xml');
  fs.mkdirSync(path.dirname(sitemapOut), { recursive: true });
  fs.writeFileSync(sitemapOut, sitemap, 'utf8');
  console.log(`  생성  sitemap.xml (프로그램 ${sitemapSlugs.length}개 포함)`);

  console.log(`\n${built.length}개 페이지 → ${APPLY ? '실제 사이트에 반영됨' : path.relative(ROOT, PREVIEW) + '/ (미리보기)'}`);

  if (warnings.length) {
    console.log(`\n확인이 필요한 점 ${warnings.length}건`);
    warnings.forEach((w) => console.log(`  · ${w}`));
  } else {
    console.log('\n경고 없음');
  }

  if (!APPLY) {
    console.log('\n실제 사이트에 반영하려면:  node _system/build.js --apply');
  }
}

main();
