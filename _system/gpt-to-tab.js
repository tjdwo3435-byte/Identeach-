#!/usr/bin/env node
/**
 * GPT가 만든 JSON  ->  구글 시트에 그대로 넣을 수 있는 CSV
 *
 *   node _system/gpt-to-tab.js 새프로그램.json
 *
 * 결과: _system/_gpt출력/<프로그램명>.csv
 * 구글 시트에서  파일 > 가져오기 > 업로드 > "새 시트 삽입" 으로 올리면 탭이 생깁니다.
 *
 * 양식(_양식.csv)의 줄 구조를 그대로 읽어서 채우기 때문에,
 * 나중에 양식이 바뀌어도 이 파일을 고칠 필요가 없습니다.
 */
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const FORM = path.join(HERE, 'data', 'tabs', '_양식.csv');
const OUTDIR = path.join(HERE, '_gpt출력');

/* 표 형태 항목 : 머리행 다음의 빈 줄들을 채운다.
   열 이름은 _양식.csv 머리행에서 직접 읽으므로 양식이 바뀌어도 고칠 필요가 없다. */
const TABLE_NAMES = new Set(['활용장면', '진행흐름', '활동유형', '대표사진', '갤러리사진']);
const colsOf = header => header.slice(1)
  .map(c => (c || '').trim())
  .filter(c => c && !c.includes(':'));   // 맨 끝 도움말 칸 제외

/* 여러 줄로 들어가는 항목 : 배열로 주면 줄바꿈으로 합친다 */
const MULTILINE = new Set([
  '소개문', '개요제목', '개요내용',
  '교육목표', '기대효과', '준비물·장비', '안전 유의사항', '블로그 키워드',
]);

function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const esc = v => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error('사용법: node _system/gpt-to-tab.js <GPT가준JSON파일>');
    process.exit(1);
  }
  if (!fs.existsSync(jsonPath)) {
    console.error('파일을 찾을 수 없습니다: ' + jsonPath);
    process.exit(1);
  }

  let d;
  try {
    d = JSON.parse(fs.readFileSync(jsonPath, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    console.error('JSON 형식이 잘못됐습니다: ' + e.message);
    console.error('GPT 답변에서 { 로 시작해 } 로 끝나는 부분만 저장했는지 확인하세요.');
    process.exit(1);
  }

  const form = parseCSV(fs.readFileSync(FORM, 'utf8').replace(/^﻿/, ''));
  const out = [];
  const used = new Set();
  const warn = [];

  for (let i = 0; i < form.length; i++) {
    const label = (form[i][0] || '').trim();

    if (TABLE_NAMES.has(label)) {              // ---- 표 항목
      out.push(form[i].slice());               // 머리행 그대로
      used.add(label);
      const cols = colsOf(form[i]);
      const items = Array.isArray(d[label]) ? d[label] : [];
      let slot = 0;
      while (i + 1 < form.length && !(form[i + 1][0] || '').trim()) {
        i++;
        const it = items[slot++];
        out.push(it ? ['', ...cols.map(c => it[c] ?? '')] : ['']);
      }
      if (slot < items.length) warn.push(`${label}: 칸이 ${slot}개뿐이라 ${items.length - slot}개를 넣지 못했습니다`);
      continue;
    }

    if (label && Object.prototype.hasOwnProperty.call(d, label)) {   // ---- 값 항목
      let v = d[label];
      if (Array.isArray(v)) v = v.join(MULTILINE.has(label) ? '\n' : ', ');
      const r = form[i].slice();
      r[1] = v == null ? '' : String(v);
      out.push(r);
      used.add(label);
      continue;
    }

    out.push(form[i].slice());                 // ---- 안내문·구분줄 그대로
  }

  const unknown = Object.keys(d).filter(k => !used.has(k));

  const name = (d['프로그램명'] || 'new-program').replace(/[\/:*?"<>|]/g, '');
  fs.mkdirSync(OUTDIR, { recursive: true });
  const file = path.join(OUTDIR, name + '.csv');
  fs.writeFileSync(file, '﻿' + out.map(r => r.map(esc).join(',')).join('\n'), 'utf8');

  console.log('만들었습니다: ' + file);
  console.log('');
  console.log('구글 시트에서:');
  console.log('  파일 > 가져오기 > 업로드 > 위 파일 선택');
  console.log('  가져오기 위치 = [새 시트 삽입]  -> 가져오기');
  console.log(`  생긴 탭 이름을 "${name}" 으로 바꾸세요.`);
  if (warn.length)    { console.log(''); warn.forEach(w => console.log('  [주의] ' + w)); }
  if (unknown.length) { console.log(''); console.log('  [무시됨] 양식에 없는 항목: ' + unknown.join(', ')); }
}

main();
