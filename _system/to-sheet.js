/**
 * to-sheet.js — 추출한 기존 프로그램 데이터를 '시트에 붙여넣을 CSV' 로 바꾼다.
 *
 * 최초 1회용. 이 CSV 5개를 구글 시트의 탭 5개에 그대로 붙여넣으면
 * 지금 홈페이지에 있는 프로그램들이 시트에 그대로 들어온다.
 *
 *   node _system/to-sheet.js
 */
const fs = require('fs');
const path = require('path');
const { SHEETS, toCsv, dataToRows } = require('./schema');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'data', 'programs.json');
const OUT_DIR = path.join(__dirname, 'data', 'sheet');

/**
 * 구형 구조 페이지들 — keywords / studentExperiences / process 를 쓴다.
 * 표준 스키마(활용장면 + 진행흐름)로 그대로 옮기면 내용이 사라지므로
 * 시트에는 넣되 '사용' 을 꺼둔 채로 둔다. (기존 페이지는 손대지 않음)
 */
const LEGACY = {
  'career/talkshow': '구형 구조 — 표준 전환 필요 (keywords/studentExperiences/process 를 활용장면·진행흐름으로 다시 씀)',
  'career/job-lab': '구형 구조 — 표준 전환 필요',
  'career/ceo-talk': '구형 구조 — 표준 전환 필요',
};

/** 표준 CSS 와 값이 조금씩 다른 변종. 다시 빌드하면 표준 디자인으로 통일된다. */
const VARIANT = {
  'together/leadership': 'CSS 변종 — 다시 빌드하면 표준 디자인으로 통일됨 (미리보기로 먼저 확인)',
  'together/domino': 'CSS 변종 — 다시 빌드하면 표준 디자인으로 통일됨 (미리보기로 먼저 확인)',
  'career/touching-voice': 'CSS 변종 — 다시 빌드하면 표준 디자인으로 통일됨 (미리보기로 먼저 확인)',
};

function main() {
  const programs = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const tabs = { 프로그램: [], 활용장면: [], 진행흐름: [], 활동유형: [], 사진: [] };

  // 목록 페이지에 놓인 순서대로 정렬한다 (시트 행 순서 = 화면 노출 순서)
  const entries = Object.entries(programs)
    .sort((a, b) => (a[1]._order ?? 999) - (b[1]._order ?? 999));

  for (const [slug, d] of entries) {
    const legacy = LEGACY[slug];
    const rows = dataToRows(slug, d, {
      use: !legacy,                              // 구형은 꺼둔 상태로
      note: legacy || VARIANT[slug] || '',
    });

    tabs.프로그램.push(rows.프로그램);
    tabs.활용장면.push(...rows.활용장면);
    tabs.진행흐름.push(...rows.진행흐름);
    tabs.활동유형.push(...rows.활동유형);
    tabs.사진.push(...rows.사진);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log('시트 탭별 CSV 생성\n');
  for (const [name, rows] of Object.entries(tabs)) {
    const csv = toCsv(SHEETS[name], rows);
    // 구글 시트/엑셀이 한글을 깨뜨리지 않도록 BOM 을 붙인다
    fs.writeFileSync(path.join(OUT_DIR, `${name}.csv`), '﻿' + csv, 'utf8');
    console.log(`  ${name.padEnd(6)} ${String(rows.length).padStart(3)}행  (${SHEETS[name].length}열)`);
  }

  console.log(`\n→ ${path.relative(ROOT, OUT_DIR)}/`);
  console.log('\n각 CSV 를 구글 시트의 같은 이름 탭에 붙여넣으면 됩니다.');
}

main();
