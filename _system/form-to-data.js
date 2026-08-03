/**
 * form-to-data.js — 입력 폼 탭들을 빌드가 먹는 평면 표로 바꾼다.
 *
 *   data/tabs/*.csv   (탭 하나 = 프로그램 하나, 세로 폼)
 *        ↓
 *   data/sheet/*.csv         홈페이지 빌드용
 *   data/program-info.json   제안서·블로그·AI 참고용 (홈페이지엔 안 쓰는 항목까지 전부)
 *
 * 값은 A열의 항목 이름으로 찾는다. 그래서 사람이 중간에 행을 넣거나 빼도 안 깨진다.
 *
 *   node _system/form-to-data.js
 */
const fs = require('fs');
const path = require('path');
const { SHEETS, toCsv, parseCsvRows } = require('./schema');

const BASE = __dirname;
const SCHEMA = JSON.parse(fs.readFileSync(path.join(BASE, 'form-schema.json'), 'utf8'));
const TAB_DIR = path.join(BASE, 'data', 'tabs');
const SHEET_DIR = path.join(BASE, 'data', 'sheet');
const INFO_OUT = path.join(BASE, 'data', 'program-info.json');

const VAL_FIRST = 1;   // B열 (0부터 셈)
const VAL_LAST = 5;    // F열

// ── 스키마에서 항목·표 목록을 뽑아둔다 ─────────────────────
const FIELDS = [];   // {label, key, multiline, use}
const TABLES = [];   // {key, columns:[label…]}
for (const sec of SCHEMA.sections) {
  for (const f of sec.fields || []) FIELDS.push(f);
  for (const t of [...(sec.table ? [sec.table] : []), ...(sec.tables || [])]) {
    TABLES.push({ key: t.key, columns: t.columns.map((c) => c.label) });
  }
}
const FIELD_BY_LABEL = new Map(FIELDS.map((f) => [f.label, f]));
const TABLE_BY_KEY = new Map(TABLES.map((t) => [t.key, t]));

// ── 폼 탭 한 장 읽기 ─────────────────────────────────────
function readTab(rows) {
  const fields = {};
  const tables = {};

  for (let i = 0; i < rows.length; i++) {
    const label = (rows[i][0] || '').trim();
    if (!label) continue;

    // 표인가?
    const table = TABLE_BY_KEY.get(label);
    if (table) {
      const out = [];
      for (let j = i + 1; j < rows.length; j++) {
        if ((rows[j][0] || '').trim()) break;             // 다음 항목이 나오면 표 끝
        const cells = table.columns.map((_, k) => (rows[j][VAL_FIRST + k] || '').trim());
        if (cells.some(Boolean)) out.push(cells);          // 빈 줄은 건너뛴다
      }
      tables[label] = out;
      continue;
    }

    // 단일 항목인가?
    const field = FIELD_BY_LABEL.get(label);
    if (field) {
      // 값은 B열. (B~F 를 하나로 합쳐 놨으므로 왼쪽 칸에 들어있다)
      fields[field.key] = (rows[i][VAL_FIRST] || '').replace(/\s+$/, '');
    }
  }
  return { fields, tables };
}

/** 사진폴더 + 파일명 → 전체 경로 */
function joinPhoto(folder, name) {
  if (!name) return '';
  if (name.startsWith('/') || name.startsWith('http')) return name;
  return folder ? `${folder.replace(/\/$/, '')}/${name}` : name;
}

// ── 메인 ────────────────────────────────────────────────
function main() {
  if (!fs.existsSync(TAB_DIR)) {
    console.error(`탭 폴더가 없습니다: ${TAB_DIR}`);
    console.error('먼저 `python _system/xlsx-to-tabs.py` 를 실행하세요.');
    process.exit(1);
  }

  // 탭이 놓인 순서대로 읽는다 = 홈페이지 목록에 뜨는 순서.
  // (시트에서 탭을 왼쪽으로 끌면 목록에서도 앞으로 나온다)
  const orderFile = path.join(TAB_DIR, '_탭순서.json');
  const order = fs.existsSync(orderFile) ? JSON.parse(fs.readFileSync(orderFile, 'utf8')) : [];
  const onDisk = fs.readdirSync(TAB_DIR).filter((f) => f.endsWith('.csv') && f !== '_탭순서.json');
  const files = [
    ...order.map((n) => `${n}.csv`).filter((f) => onDisk.includes(f)),
    ...onDisk.filter((f) => !order.includes(f.replace(/\.csv$/, ''))),
  ];
  const out = { 프로그램: [], 활용장면: [], 진행흐름: [], 활동유형: [], 사진: [] };
  const info = {};
  const warnings = [];
  const seenIds = new Map();

  for (const file of files) {
    const tabName = file.replace(/\.csv$/, '');
    if (tabName.startsWith('_')) { console.log(`  건너뜀  ${tabName} (안내 탭)`); continue; }

    const rows = parseCsvRows(fs.readFileSync(path.join(TAB_DIR, file), 'utf8'));
    const { fields, tables } = readTab(rows);

    const id = (fields.ID || '').trim();
    if (!id) { warnings.push(`${tabName}: 주소(ID) 가 비어 있어 건너뜁니다`); continue; }
    if (seenIds.has(id)) {
      warnings.push(`${tabName}: 주소(ID) "${id}" 가 [${seenIds.get(id)}] 탭과 겹칩니다 — 뒤엣것이 덮어씁니다`);
    }
    seenIds.set(id, tabName);

    const folder = fields.사진폴더 || '';

    // ① 홈페이지 빌드용 평면 표
    out.프로그램.push({
      사용: fields.사용 || '', ID: id, 분류: fields.분류 || '',
      프로그램명: fields.프로그램명 || '', 한줄배지: fields.한줄배지 || '',
      소개문: fields.소개문 || '',
      검색제목: fields.검색제목 || '', 검색설명: fields.검색설명 || '',
      대상: fields.대상 || '', 시간: fields.시간 || '',
      인원: fields.인원 || '', 장소: fields.장소 || '',
      개요제목: fields.개요제목 || '', 개요내용: fields.개요내용 || '',
      활동유형제목: fields.활동유형제목 || '',
      카드썸네일: fields.카드썸네일 || '', 카드썸네일설명: fields.카드썸네일설명 || fields.프로그램명 || '',
      카드배지: fields.카드배지 || '', 카드배지색: fields.카드배지색 || '',
      카드제목: fields.카드제목 || '', 카드설명: fields.카드설명 || '',
      카드태그: fields.카드태그 || '', 준비중: fields.준비중 || '',
      비고: fields.비고 || '',
    });

    for (const [아이콘, 추천, 제목, 설명] of tables.활용장면 || []) {
      out.활용장면.push({ ID: id, 아이콘, 추천, 제목, 설명 });
    }
    (tables.진행흐름 || []).forEach(([아이콘, 단계명, 단계설명], i) => {
      out.진행흐름.push({ ID: id, 순서: i + 1, 아이콘, 단계명, 단계설명 });
    });
    for (const [이름, 설명] of tables.활동유형 || []) {
      out.활동유형.push({ ID: id, 이름, 설명 });
    }

    if (fields.개요사진) {
      out.사진.push({ ID: id, 용도: '개요', 경로: joinPhoto(folder, fields.개요사진), 설명: fields.개요사진설명 || '', 캡션: '' });
    }
    for (const [파일명, 설명] of tables.대표사진 || []) {
      out.사진.push({ ID: id, 용도: '대표', 경로: joinPhoto(folder, 파일명), 설명, 캡션: '' });
    }
    for (const [파일명, 설명, 캡션] of tables.갤러리사진 || []) {
      out.사진.push({ ID: id, 용도: '갤러리', 경로: joinPhoto(folder, 파일명), 설명, 캡션: 캡션 || '' });
    }

    // ② 제안서·블로그·AI 용 — 홈페이지가 안 쓰는 항목까지 전부 담는다
    info[id] = {
      탭이름: tabName,
      프로그램명: fields.프로그램명 || '',
      분류: fields.분류 || '',
      한줄소개: fields.한줄배지 || '',
      소개문: fields.소개문 || '',
      운영조건: { 대상: fields.대상 || '', 시간: fields.시간 || '', 인원: fields.인원 || '', 장소: fields.장소 || '' },
      개요: { 제목: fields.개요제목 || '', 내용: (fields.개요내용 || '').split('\n').map((s) => s.trim()).filter(Boolean) },
      활용장면: (tables.활용장면 || []).map(([, 추천, 제목, 설명]) => ({ 제목, 설명, 추천: !!추천 })),
      진행흐름: (tables.진행흐름 || []).map(([, 단계명, 단계설명], i) => ({ 순서: i + 1, 단계명, 단계설명 })),
      활동유형: (tables.활동유형 || []).map(([이름, 설명]) => ({ 이름, 설명 })),
      제안서: {
        교육목표: (fields.교육목표 || '').split('\n').map((s) => s.trim()).filter(Boolean),
        기대효과: (fields.기대효과 || '').split('\n').map((s) => s.trim()).filter(Boolean),
        준비물: (fields.준비물 || '').split('\n').map((s) => s.trim()).filter(Boolean),
        진행인력: fields.진행인력 || '',
        단가: fields.단가 || '',
        안전유의사항: (fields.안전 || '').split('\n').map((s) => s.trim()).filter(Boolean),
      },
      블로그: {
        키워드: (fields.블로그키워드 || '').split(',').map((s) => s.trim()).filter(Boolean),
        성수기: fields.성수기 || '',
      },
      홈페이지주소: `https://identeach.co.kr/${id}`,
      사용: /^(o|○|y|yes|true|1|예)$/i.test((fields.사용 || '').trim()),
    };

    const n = (tables.활용장면 || []).length + (tables.진행흐름 || []).length;
    console.log(`  읽음  ${tabName.padEnd(16)} ${id}  (활용장면·진행흐름 ${n}줄)`);

    // 제안서·블로그 항목이 비어 있으면 알려준다 (홈페이지는 정상, 다만 활용도가 떨어짐)
    const empty = ['교육목표', '기대효과', '준비물', '블로그키워드'].filter((k) => !fields[k === '준비물' ? '준비물' : k]);
    if (empty.length === 4) warnings.push(`${tabName}: 제안서·블로그용 항목이 전부 비어 있습니다 (홈페이지는 정상)`);
  }

  fs.mkdirSync(SHEET_DIR, { recursive: true });
  for (const [name, rows] of Object.entries(out)) {
    fs.writeFileSync(path.join(SHEET_DIR, `${name}.csv`), '﻿' + toCsv(SHEETS[name], rows), 'utf8');
  }
  fs.writeFileSync(INFO_OUT, JSON.stringify(info, null, 2), 'utf8');

  console.log(`\n프로그램 ${out.프로그램.length}개`);
  for (const [name, rows] of Object.entries(out)) console.log(`  ${name.padEnd(5)} ${String(rows.length).padStart(3)}행`);
  console.log(`\n제안서·블로그용 정보 → ${path.basename(INFO_OUT)}`);

  if (warnings.length) {
    console.log(`\n확인이 필요한 점 ${warnings.length}건`);
    warnings.forEach((w) => console.log(`  · ${w}`));
  }
  console.log('\n다음: node _system/build.js  (미리보기 생성)');
}

main();
