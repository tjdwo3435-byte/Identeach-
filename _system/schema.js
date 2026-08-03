/**
 * schema.js — 구글 시트 ↔ 프로그램 데이터 변환 규칙 (단일 소스)
 *
 * 시트 컬럼이 여기저기 흩어지면 반드시 어긋난다. 그래서 컬럼 정의와
 * 양방향 변환(시트→데이터, 데이터→시트)을 이 파일 하나에만 둔다.
 *
 * 시트는 5개 탭:
 *   프로그램   — 1행 = 1프로그램 (기본 정보)
 *   활용장면   — "어디서, 언제 쓸 수 있나요" 박스들
 *   진행흐름   — "활동이 이렇게 흘러갑니다" 단계들
 *   활동유형   — 활동 유형 예시 (없으면 그 섹션이 통째로 빠짐)
 *   사진       — 대표/개요/갤러리 사진
 */

const SITE = 'https://identeach.co.kr';

/** 분류 → 상위 목록 경로·표시명 */
const CATEGORIES = {
  '학교폭력·리더십': { path: '/together', label: '학교폭력·리더십' },
  '진로교육·체험': { path: '/career', label: '진로교육·체험' },
  '학교행사': { path: '/events', label: '학교행사' },
};

/** 목록 페이지 카드용 컬럼 — 시트와 데이터 양쪽에서 같은 이름을 쓴다 */
const CARD_COLS = ['카드썸네일', '카드썸네일설명', '카드배지', '카드배지색', '카드제목', '카드설명', '카드태그', '준비중'];

/** 탭 이름과 컬럼 순서 — 시트 첫 줄(머리글)이 이것과 같아야 한다 */
const SHEETS = {
  프로그램: [
    '사용', 'ID', '분류', '프로그램명', '한줄배지', '소개문',
    '검색제목', '검색설명',
    '대상', '시간', '인원', '장소',
    '개요제목', '개요내용', '활동유형제목',
    // 목록 페이지(together / career)의 카드에 쓰이는 값들
    '카드썸네일', '카드썸네일설명', '카드배지', '카드배지색', '카드제목', '카드설명', '카드태그', '준비중',
    '비고',
  ],
  활용장면: ['ID', '아이콘', '추천', '제목', '설명'],
  // '학생경험'·'느낌'(이 순간 학생들은 칸)은 2026-08-03 에 화면과 입력 양쪽에서 뺐다
  진행흐름: ['ID', '순서', '아이콘', '단계명', '단계설명'],
  활동유형: ['ID', '이름', '설명'],
  // 캡션 — 지금은 어느 페이지도 화면에 쓰지 않는 값이지만, 기존 데이터를 잃지 않으려고 보존한다
  사진: ['ID', '용도', '경로', '설명', '캡션'],
};

// ─────────────────────────────────────────────────────────
// CSV 읽고 쓰기 (쉼표·줄바꿈·따옴표가 들어가도 안 깨지게)
// ─────────────────────────────────────────────────────────

function csvEscape(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function toCsv(header, rows) {
  const lines = [header.map(csvEscape).join(',')];
  for (const r of rows) lines.push(header.map((h) => csvEscape(r[h])).join(','));
  return lines.join('\r\n');
}

/**
 * CSV 를 '행 배열' 그대로 돌려준다.
 * 입력 폼 탭처럼 머리글이 따로 없고 자리로 읽어야 하는 표에 쓴다.
 */
function parseCsvRows(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  const src = text.replace(/^﻿/, '');

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === ',') { row.push(field); field = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  const src = text.replace(/^﻿/, ''); // 엑셀이 붙이는 BOM 제거

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === ',') { row.push(field); field = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1)
    .filter((r) => r.some((v) => v.trim() !== ''))   // 빈 줄 무시
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

// ─────────────────────────────────────────────────────────
// 데이터 → 시트 행
// ─────────────────────────────────────────────────────────

/** info 배열에서 라벨로 값 찾기 */
function infoVal(info, label) {
  const hit = (info || []).find((x) => x.label === label);
  return hit ? hit.value : '';
}

function dataToRows(slug, d, opts = {}) {
  const cat = d.category || (d.crumbs && d.crumbs[1] && d.crumbs[1].label) || '';

  const 프로그램 = {
    사용: opts.use === false ? '' : 'O',
    ID: slug,
    분류: cat,
    프로그램명: d.title || '',
    한줄배지: d.tagline || '',
    소개문: d.description || '',
    검색제목: d.pageTitle || '',
    검색설명: d.pageDesc || '',
    대상: infoVal(d.info, '대상'),
    시간: infoVal(d.info, '시간'),
    인원: infoVal(d.info, '인원'),
    장소: infoVal(d.info, '장소'),
    개요제목: (d.activity && d.activity.headline) || '',
    개요내용: ((d.activity && d.activity.bullets) || []).join('\n'),
    활동유형제목: (d.structuresSection && d.structuresSection.title) || '',
    ...CARD_COLS.reduce((acc, k) => { acc[k] = (d._card && d._card[k]) || ''; return acc; }, {}),
    비고: opts.note || '',
  };

  const 활용장면 = (d.useCases || []).map((c) => ({
    ID: slug, 아이콘: c.icon || '', 추천: c.rec ? 'O' : '',
    제목: c.title || '', 설명: c.desc || '',
  }));

  const 진행흐름 = (d.flowSteps || []).map((s, i) => ({
    ID: slug, 순서: i + 1, 아이콘: s.icon || '',
    단계명: (s.proc && s.proc.title) || '',
    단계설명: (s.proc && s.proc.desc) || '',
  }));

  const 활동유형 = ((d.structuresSection && d.structuresSection.items) || []).map((it) => ({
    ID: slug, 이름: it.name || '', 설명: it.desc || '',
  }));

  const 사진 = [];
  const photoRow = (용도, img) => ({
    ID: slug, 용도, 경로: img.src, 설명: img.alt || '', 캡션: img.caption || '',
  });
  if (d.activity && d.activity.image) 사진.push(photoRow('개요', d.activity.image));
  for (const img of d.heroImages || []) 사진.push(photoRow('대표', img));
  for (const img of (d.gallery && d.gallery.images) || []) 사진.push(photoRow('갤러리', img));

  return { 프로그램, 활용장면, 진행흐름, 활동유형, 사진 };
}

// ─────────────────────────────────────────────────────────
// 시트 행 → 데이터 (빌드가 쓰는 방향)
// ─────────────────────────────────────────────────────────

/** 여러 줄 텍스트를 줄 단위 배열로 (빈 줄 제거) */
function lines(s) {
  return (s || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
}

/** 시트에서 '예'를 뜻하는 여러 표기를 모두 참으로 본다 (O, ○, Y, TRUE, 추천, ✓ …) */
function isYes(v) {
  return /^(o|○|●|y|yes|true|1|v|✓|추천|예)$/i.test((v || '').trim());
}

function rowsToData(row, extra, warn = () => {}) {
  const slug = row.ID;
  const cat = row.분류;
  const catInfo = CATEGORIES[cat];
  if (!catInfo) warn(`${slug}: 분류 "${cat}" 를 모르겠습니다 (${Object.keys(CATEGORIES).join(' / ')} 중 하나여야 합니다)`);

  const parentPath = catInfo ? catInfo.path : '/';
  const parentLabel = catInfo ? catInfo.label : cat;

  const pick = (list) => (list || []).filter((r) => r.ID === slug);

  const 사진 = pick(extra.사진);
  const toImg = (p) => (p.캡션 ? { src: p.경로, alt: p.설명, caption: p.캡션 } : { src: p.경로, alt: p.설명 });
  const heroImages = 사진.filter((p) => p.용도 === '대표').map(toImg);
  const galleryImages = 사진.filter((p) => p.용도 === '갤러리').map(toImg);
  const overview = 사진.find((p) => p.용도 === '개요');

  const info = [];
  for (const label of ['대상', '시간', '인원', '장소']) {
    if (row[label]) info.push({ label, value: row[label] });
  }

  const d = {
    pageTitle: row.검색제목 || `${row.프로그램명} | 아이덴티치`,
    pageDesc: row.검색설명 || '',
    canonicalUrl: `${SITE}/${slug}`,
    navActive: parentPath,
    crumbs: [
      { label: '홈', href: '/' },
      { label: parentLabel, href: parentPath },
      { label: row.프로그램명, href: null },
    ],
    category: cat,
    title: row.프로그램명,
    tagline: row.한줄배지,
    description: row.소개문,
    heroImages,
    info,
    activity: {
      image: overview ? toImg(overview) : (heroImages[0] || { src: '', alt: '' }),
      headline: row.개요제목,
      bullets: lines(row.개요내용),
    },
    useCases: pick(extra.활용장면).map((c) => ({
      icon: c.아이콘,
      rec: isYes(c.추천),
      title: c.제목,
      desc: c.설명,
    })),
    flowSteps: pick(extra.진행흐름)
      .slice()
      .sort((a, b) => Number(a.순서 || 0) - Number(b.순서 || 0))
      .map((s) => ({
        icon: s.아이콘,
        proc: { title: s.단계명, desc: s.단계설명 },
      })),
    gallery: { images: galleryImages },
  };

  const 유형 = pick(extra.활동유형);
  if (row.활동유형제목 && 유형.length) {
    d.structuresSection = {
      label: row.활동유형제목,
      title: row.활동유형제목,
      items: 유형.map((it) => ({ name: it.이름, type: 'aspect', desc: it.설명 })),
    };
  }

  // 목록 페이지 카드 — 비어 있으면 상세 내용에서 적당히 끌어온다
  d._card = {
    카드썸네일: row.카드썸네일 || (heroImages[0] && heroImages[0].src) || '',
    카드썸네일설명: row.카드썸네일설명 || row.프로그램명 || '',
    카드배지: row.카드배지 || '',
    카드배지색: row.카드배지색 || '',
    카드제목: row.카드제목 || row.프로그램명 || '',
    카드설명: row.카드설명 || (row.소개문 || '').replace(/\n/g, ' '),
    카드태그: row.카드태그 || '',
    준비중: row.준비중 || '',
  };
  if (!row.카드썸네일) warn(`${slug}: 카드썸네일이 비어 대표사진으로 대신합니다 (목록용 webp 를 넣는 편이 가볍습니다)`);

  // 사람이 빠뜨리기 쉬운 것들을 미리 잡아준다
  if (!row.프로그램명) warn(`${slug}: 프로그램명이 비어 있습니다`);
  if (!heroImages.length) warn(`${slug}: 대표 사진이 없습니다`);
  if (!d.useCases.length) warn(`${slug}: 활용장면이 없습니다 — 해당 섹션이 비어 보입니다`);
  if (!d.flowSteps.length) warn(`${slug}: 진행흐름이 없습니다 — 해당 섹션이 비어 보입니다`);
  if (!row.검색설명) warn(`${slug}: 검색설명(meta description)이 비어 있습니다 — 검색 노출에 불리합니다`);

  return d;
}

module.exports = { SITE, CATEGORIES, SHEETS, CARD_COLS, toCsv, parseCsv, parseCsvRows, dataToRows, rowsToData, lines, isYes };
