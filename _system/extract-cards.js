/**
 * extract-cards.js — 목록 페이지(together/career)의 프로그램 카드 정보를 뽑아
 * programs.json 에 합친다.
 *
 * 카드는 상세 페이지의 programData 와 별개로 손으로 쓰여 있었다.
 * (썸네일·배지·카드제목·카드설명·태그) 이것까지 시트로 들어와야
 * "시트에 한 줄 쓰면 목록에도 뜬다" 가 성립한다.
 *
 *   node _system/extract-cards.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'data', 'programs.json');
const LISTS = ['together/index.html', 'career/index.html'];

/** <a href="/x/y" class="card" ...> … </a> 한 덩어리씩 잘라낸다 */
function splitCards(html) {
  const gridStart = html.indexOf('<div class="grid">');
  if (gridStart === -1) return [];
  const section = html.slice(gridStart);

  const cards = [];
  const re = /<a href="(\/[^"]+)" class="card"[^>]*>/g;
  let m;
  while ((m = re.exec(section))) {
    // 이 <a> 의 짝이 되는 </a> 를 찾는다 (카드 안에 다른 <a> 는 없다)
    const end = section.indexOf('</a>', m.index);
    if (end === -1) continue;
    cards.push({ href: m[1], openTag: m[0], html: section.slice(m.index, end + 4) });
  }
  return cards;
}

const pick = (re, s, i = 1) => { const m = s.match(re); return m ? m[i].trim() : ''; };

function parseCard(card) {
  const thumb = pick(/<div class="thumb">([\s\S]*?)<\/div>/, card.html);
  const body = pick(/<div class="body">([\s\S]*?)<\/div>\s*<\/a>/, card.html);

  const tagsBlock = pick(/<div class="tags">([\s\S]*?)<\/div>/, card.html);
  const tags = [...tagsBlock.matchAll(/<span>([^<]*)<\/span>/g)].map((x) => x[1].trim());

  return {
    카드썸네일: pick(/<img src="([^"]+)"/, thumb),
    카드썸네일설명: pick(/<img[^>]*alt="([^"]*)"/, thumb),
    카드배지: pick(/<span class="thumb-tag[^"]*">([^<]*)<\/span>/, thumb),
    카드배지색: /thumb-tag--orange/.test(thumb) ? '주황' : '',
    // h3 안의 <br> 은 줄바꿈 위치다. 시트에서는 | 로 표시한다.
    카드제목: pick(/<h3>([\s\S]*?)<\/h3>/, body).replace(/<br\s*\/?>/g, '|').replace(/\s+/g, ' ').trim(),
    카드설명: pick(/<p>([\s\S]*?)<\/p>/, body).replace(/\s+/g, ' ').trim(),
    카드태그: tags.join(', '),
    준비중: /준비 중/.test(card.html) ? 'O' : '',
  };
}

function main() {
  const programs = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  let found = 0;
  const missing = [];

  for (const list of LISTS) {
    const html = fs.readFileSync(path.join(ROOT, list), 'utf8');
    for (const card of splitCards(html)) {
      const slug = card.href.replace(/^\//, '');
      if (!programs[slug]) { missing.push(`${list}: ${slug} — 상세 데이터가 없습니다`); continue; }
      programs[slug]._card = parseCard(card);
      // 목록에 놓인 순서를 기억해 둔다 — 시트 행 순서가 곧 화면 노출 순서가 된다
      programs[slug]._order = found;
      found++;
      const c = programs[slug]._card;
      console.log(`  ${slug}`);
      console.log(`      배지 "${c.카드배지}"${c.카드배지색 ? `(${c.카드배지색})` : ''}${c.준비중 ? ' · 준비중' : ''} / 태그 ${c.카드태그 || '없음'}`);
    }
  }

  // 카드가 없는 프로그램 (목록에 안 올라간 것)
  for (const [slug, d] of Object.entries(programs)) {
    if (!d._card) missing.push(`${slug} — 목록 페이지에 카드가 없습니다`);
  }

  fs.writeFileSync(DATA, JSON.stringify(programs, null, 2), 'utf8');
  console.log(`\n카드 ${found}개 추출 → ${path.relative(ROOT, DATA)}`);
  if (missing.length) {
    console.log('확인 필요:');
    missing.forEach((x) => console.log(`  - ${x}`));
  }
}

main();
