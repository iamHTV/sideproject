#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const TRACKS = ['game', 'distill', 'fb', 'webapp'];
const TRACK_SET = new Set(TRACKS);
const FILES = {
  game: path.join('dashboard', 'game.html'),
  distill: path.join('dashboard', 'web-distill.html'),
  fb: path.join('dashboard', 'quet-facebook.html'),
  webapp: path.join('dashboard', 'webapp-ai.html'),
};

function usage() {
  console.error('Usage: node scripts/merge-idea-day.js <day.json> [--root <repo>]');
  console.error('Mỗi track có mặt (game | distill | fb | webapp) phải có 3–5 thẻ.');
  console.error('Script gắn thẻ vào đúng dashboard. Không ghi dashboard/idea-crawl.html.');
  process.exit(2);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let root = process.cwd();
  const pos = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root') {
      root = args[++i];
      if (!root) usage();
    } else if (args[i] === '--help' || args[i] === '-h') {
      usage();
    } else if (args[i] === '--html') {
      fail('Đã bỏ --html. Script không còn ghi một file idea-crawl.html.');
    } else {
      pos.push(args[i]);
    }
  }
  if (pos.length !== 1) usage();
  return { root, dayPath: pos[0] };
}

function fail(msg) {
  console.error('merge-idea-day: ' + msg);
  process.exit(1);
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeHtml(html) {
  return String(html || '').replace(/<(?![A-Za-z/!?])/g, '&lt;');
}

function countTagLines(html, prefix) {
  return html.split('\n').reduce((n, line) => n + (line.trim().indexOf(prefix) === 0 ? 1 : 0), 0);
}

function htmlToText(html) {
  return String(html || '')
    .replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
      const t = htmlToText(label).trim();
      return t ? t + ' (' + href + ')' : href;
    })
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function field(card, pred) {
  const hit = (card.fields || []).find((f) => pred(f[0]));
  return hit ? hit[1] : '';
}

function fieldStarts(card, prefix) {
  return field(card, (label) => label === prefix || label.indexOf(prefix) === 0);
}

function linksOf(html) {
  const out = [];
  const re = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  const seen = new Set();
  while ((m = re.exec(String(html || '')))) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    const label = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    out.push(label ? label + ' (' + m[1] + ')' : m[1]);
  }
  return out;
}

function dmy(iso) {
  const p = iso.split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
}

function starStr(n) {
  const k = Math.max(0, Math.min(5, n | 0));
  return '★'.repeat(k) + '☆'.repeat(5 - k);
}

function scoreClass(n) {
  if (n >= 9) return 's9';
  if (n >= 8) return 's8';
  if (n >= 7) return 's7';
  return 's6';
}

function scoreLabel(n) {
  return String(n).replace('.', ',');
}

function shortTep(html) {
  let t = htmlToText(html).replace(/^[\d][\d.\s]*/, '').trim();
  const cut = t.split(/\s+[—–]\s+|\s+\(/)[0].trim();
  t = cut || t;
  if (t.length > 42) {
    const comma = t.indexOf(',');
    if (comma > 12 && comma <= 48) t = t.slice(0, comma).trim();
    else t = t.slice(0, 42).replace(/\s+\S*$/, '').replace(/[,:;]\s*$/, '');
  }
  if (t && t[0] === t[0].toLowerCase()) t = t[0].toUpperCase() + t.slice(1);
  return t;
}

function leadLabel(s) {
  return String(s || '').split('(')[0].trim().replace(/[.…,:;]\s*$/, '').trim();
}

function dayMark(date, kind) {
  return 'IDEA-DAY-' + date + (kind ? '-' + kind : '');
}

function removeMarked(html, startToken, endToken) {
  const start = html.indexOf(startToken);
  if (start < 0) return { html, found: false, block: '' };
  const end = html.indexOf(endToken, start);
  if (end < 0) fail('Thiếu ' + endToken);
  const to = end + endToken.length;
  const block = html.slice(start, to);
  let from = start;
  let stop = to;
  if (html[stop] === '\n') stop += 1;
  return { html: html.slice(0, from) + html.slice(stop), found: true, block };
}

function insertAfter(html, anchor, payload) {
  const at = html.indexOf(anchor);
  if (at < 0) fail('Không thấy điểm chèn: ' + anchor.slice(0, 80));
  let pos = at + anchor.length;
  if (html[pos] === '\n') pos += 1;
  const body = String(payload).replace(/^\n/, '').replace(/\n$/, '');
  return html.slice(0, at + anchor.length) + '\n' + body + '\n' + html.slice(pos);
}

function maxNum(html, re) {
  let max = 0;
  let m;
  const copy = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  while ((m = copy.exec(html))) {
    const n = parseInt(m[1], 10);
    if (n > max) max = n;
  }
  return max;
}

function validateDay(day) {
  if (!day || typeof day !== 'object' || Array.isArray(day)) fail('File JSON phải là object một ngày');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date || '')) fail('date phải là YYYY-MM-DD');
  if (typeof day.label !== 'string' || !/^\d{2}\/\d{2}$/.test(day.label)) fail('label phải là DD/MM (vd 02/11)');
  if (typeof day.heading !== 'string' || !day.heading.trim()) fail('thiếu heading');
  if (day.tz && day.tz !== 'Asia/Saigon') fail('tz nếu có phải là Asia/Saigon');
  if (!Array.isArray(day.cards) || day.cards.length === 0) fail('cards phải là mảng không rỗng');
  const ids = new Set();
  const byTrack = {};
  day.cards.forEach((c, i) => {
    const where = (day.date || '?') + ' thẻ #' + (i + 1);
    if (!c || typeof c !== 'object') fail(where + ' không phải object');
    if (typeof c.id !== 'string' || c.id.indexOf(day.date + '-c') !== 0) {
      fail(where + ': id phải bắt đầu bằng "' + day.date + '-c"');
    }
    if (ids.has(c.id)) fail('id trùng ' + c.id);
    ids.add(c.id);
    if (!TRACK_SET.has(c.track)) fail(where + ': track phải là game | distill | fb | webapp');
    if (typeof c.title !== 'string' || !c.title.trim()) fail(where + ': thiếu title');
    if (typeof c.preview !== 'string' || !c.preview.trim()) fail(where + ': thiếu preview');
    if (!Array.isArray(c.fields) || c.fields.length === 0) fail(where + ': thiếu fields');
    c.fields.forEach((f, fi) => {
      if (!Array.isArray(f) || f.length < 2 || typeof f[0] !== 'string' || typeof f[1] !== 'string') {
        fail(where + ': fields[' + fi + '] phải là [nhãn, html]');
      }
    });
    if (!(c.score === null || typeof c.score === 'number')) fail(where + ': score phải là số hoặc null');
    if (typeof c.star !== 'boolean') fail(where + ': star phải là true hoặc false');
    if (!byTrack[c.track]) byTrack[c.track] = [];
    byTrack[c.track].push(c);
  });
  Object.keys(byTrack).forEach((track) => {
    const n = byTrack[track].length;
    if (n < 3 || n > 5) fail(track + ': cần 3–5 thẻ/ngày, đang có ' + n);
  });
  TRACKS.forEach((track) => {
    if (!byTrack[track]) return;
    if (track === 'distill') {
      byTrack[track].forEach((c) => {
        if (typeof c.score !== 'number' || c.score < 1 || c.score > 5) fail(c.id + ': distill score phải là 1–5');
        ['Nguồn gốc', 'Format chính', 'Ra tiền'].forEach((label) => {
          if (!fieldStarts(c, label)) fail(c.id + ': thiếu field ' + label);
        });
      });
    }
    if (track === 'fb') {
      byTrack[track].forEach((c) => {
        if (!fieldStarts(c, 'Vấn đề')) fail(c.id + ': thiếu field Vấn đề');
        if (!fieldStarts(c, 'Offer')) fail(c.id + ': thiếu field Offer');
      });
    }
    if (track === 'webapp') {
      byTrack[track].forEach((c) => {
        if (typeof c.score !== 'number') fail(c.id + ': webapp cần score');
        if (!fieldStarts(c, 'Tệp')) fail(c.id + ': thiếu field Tệp');
        if (!fieldStarts(c, 'Ra tiền')) fail(c.id + ': thiếu field Ra tiền');
        if (!fieldStarts(c, 'Độ khó')) fail(c.id + ': thiếu field Độ khó');
      });
    }
    if (track === 'game') {
      byTrack[track].forEach((c) => {
        if (!fieldStarts(c, 'Mechanic gốc')) fail(c.id + ': thiếu field Mechanic gốc');
        if (!fieldStarts(c, 'Twist')) fail(c.id + ': thiếu field Twist');
        if (!fieldStarts(c, 'Độ khó')) fail(c.id + ': thiếu field Độ khó');
      });
    }
  });
  return byTrack;
}

function jsString(s) {
  return JSON.stringify(String(s)).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

function gameLiteral(card, mid) {
  const mechanic = fieldStarts(card, 'Mechanic gốc');
  const bold = mechanic.match(/<b>([\s\S]*?)<\/b>/i);
  const from = bold ? htmlToText(bold[1]) : htmlToText(mechanic).slice(0, 80);
  const time = htmlToText(fieldStarts(card, 'Độ khó'));
  const parts = [card.preview.trim()];
  const twist = htmlToText(fieldStarts(card, 'Twist'));
  const role = htmlToText(fieldStarts(card, 'Vai người chơi'));
  const channel = htmlToText(fieldStarts(card, 'Kênh'));
  if (twist) parts.push('Twist: ' + twist);
  if (role) parts.push('Vai người chơi: ' + role);
  if (channel) parts.push('Kênh · ra tiền: ' + channel);
  const sources = [];
  (card.fields || []).forEach((f) => linksOf(f[1]).forEach((link) => {
    if (sources.indexOf(link) < 0) sources.push(link);
  }));
  const draft = parts.join(' ');
  const extra = sources.filter((link) => {
    const url = (link.match(/https?:\/\/[^)\s]+/) || [])[0];
    return url && draft.indexOf(url) < 0;
  });
  if (extra.length) parts.push('Nguồn: ' + extra.join('; '));
  const star = card.star ? ', star:true' : '';
  return '        { mid:' + jsString(mid) + ', name:' + jsString(card.title) + ', from:' + jsString(from) +
    ', round:' + jsString('Lượt ' + dmy(card.id.slice(0, 10))) + ', time:' + jsString(time) + star + ',\n' +
    '          play:' + jsString(parts.join(' ')) + ' }';
}

function sliceIdeas(html) {
  const startKey = 'var IDEAS = [';
  const at = html.indexOf(startKey);
  if (at < 0) fail('game.html: không thấy var IDEAS');
  const renderAt = html.indexOf('/* ============ RENDER ============ */');
  if (renderAt < 0) fail('game.html: không thấy marker RENDER');
  const close = html.lastIndexOf('];', renderAt);
  if (close < at) fail('game.html: không thấy kết thúc mảng IDEAS');
  return { at, openEnd: at + startKey.length, close, renderAt };
}

function stampMids(interior) {
  let max = -1;
  const seen = interior.match(/mid:"(i-\d+)"/g) || [];
  seen.forEach((m) => {
    const n = parseInt(m.match(/i-(\d+)/)[1], 10);
    if (n > max) max = n;
  });
  const out = interior.replace(/\{(?!\s*mid:)(\s*)name:/g, (full, sp) => {
    max += 1;
    return '{ mid:"i-' + max + '",' + sp + 'name:';
  });
  return { interior: out, next: max + 1 };
}

function existingMids(block) {
  const mids = [];
  const re = /mid:"(i-\d+)"/g;
  let m;
  while ((m = re.exec(block))) mids.push(m[1]);
  return mids;
}

function mergeGame(html, day, cards) {
  const tokenS = '/* ' + dayMark(day.date) + '-START */';
  const tokenE = '/* ' + dayMark(day.date) + '-END */';
  const removed = removeMarked(html, tokenS, tokenE);
  const loc = sliceIdeas(removed.html);
  let interior = removed.html.slice(loc.openEnd, loc.close);
  const keptMids = existingMids(removed.block);
  const stamped = stampMids(interior);
  const mids = cards.map((_, i) => keptMids[i] || ('i-' + (stamped.next + i)));
  const block = tokenS + '\n' + cards.map((c, i) => gameLiteral(c, mids[i])).join(',\n') + ',\n' + tokenE;
  interior = '\n' + block + '\n' + stamped.interior.replace(/^\n/, '');
  let next = removed.html.slice(0, loc.openEnd) + interior + removed.html.slice(loc.close);
  const ideaLoc = sliceIdeas(next);
  const ideaCount = (next.slice(ideaLoc.openEnd, ideaLoc.close).match(/\{ mid:/g) || []).length;
  const gamesLocStart = next.indexOf('var GAMES = [');
  const gamesLocEnd = next.indexOf('var IDEAS = [');
  const gameCount = (next.slice(gamesLocStart, gamesLocEnd).match(/\{ name:/g) || []).length;
  next = next.replace(
    /<div class="stat"><b>\d+<\/b> idea chờ duyệt<\/div>/,
    '<div class="stat"><b>' + ideaCount + '</b> idea chờ duyệt</div>'
  );
  next = next.replace(/(<p class="sec-sub">)\d+( idea remix)/, '$1' + ideaCount + '$2');
  next = next.replace(
    /(id="btn-tab1"[^>]*>[\s\S]*?<span class="count">)\d+(<\/span>)/,
    '$1' + (gameCount + ideaCount) + '$2'
  );
  const roundPhrase = 'lượt ' + day.label;
  if (next.indexOf(roundPhrase) < 0) {
    next = next.replace(
      / và (lượt \d{2}\/\d{2}(?:\/\d{4})?)(\. Tất cả đang ở trạng thái chờ duyệt)/,
      ', $1 và lượt ' + day.label + '$2'
    );
  }
  const full = 'lượt ' + dmy(day.date);
  if (next.indexOf(full) < 0) {
    next = next.replace(
      /(<footer>[\s\S]*?) và (lượt \d{2}\/\d{2}\/\d{4})\./,
      '$1, $2 và lượt ' + dmy(day.date) + '.'
    );
  }
  const outsideBefore = namesIn(removed.html);
  const outsideAfter = namesIn(removeMarked(next, tokenS, tokenE).html);
  if (outsideBefore.join('\n') !== outsideAfter.join('\n')) {
    fail('game: thẻ cũ bị đổi ngoài ngày ' + day.date);
  }
  return { html: next, summary: 'game ' + cards.length + ' (idea chờ duyệt: ' + ideaCount + ', tab 1: ' + (gameCount + ideaCount) + ')' };
}

function namesIn(html) {
  const loc = sliceIdeas(html);
  const body = html.slice(loc.openEnd, loc.close);
  const names = [];
  const re = /name:("(?:\\.|[^"\\])*")/g;
  let m;
  while ((m = re.exec(body))) {
    try { names.push(JSON.parse(m[1])); } catch (e) { names.push(m[1]); }
  }
  return names;
}

function mergeDistill(html, day, cards) {
  const tokenS = '<!-- ' + dayMark(day.date) + '-START -->';
  const tokenE = '<!-- ' + dayMark(day.date) + '-END -->';
  const removed = removeMarked(html, tokenS, tokenE);
  let batch = 0;
  const batchHit = removed.block.match(/data-batch="(\d+)"/);
  if (batchHit) batch = parseInt(batchHit[1], 10);
  else batch = maxNum(removed.html, /data-batch="(\d+)"/) + 1;
  const oldIds = [];
  const idRe = /data-id="(\d+)"/g;
  let im;
  while ((im = idRe.exec(removed.block))) oldIds.push(im[1]);
  const base = maxNum(removed.html, /data-id="(\d+)"/);
  const articles = cards.map((c, i) => {
    const id = oldIds[i] || String(base + 1 + i);
    const stars = Math.max(1, Math.min(5, c.score | 0));
    const rankClass = i === 0 ? 'rank r1' : 'rank';
    return [
      '    <article class="card" data-batch="' + batch + '" data-date="' + dmy(day.date) + '" data-stars="' + stars + '" data-id="' + id + '">',
      '      <div class="card-top">',
      '        <span class="' + rankClass + '">#' + (i + 1) + '</span>',
      '        <span class="num">#' + id + '</span>',
      '        <span class="stars" title="Tự động hoá: ' + stars + '/5">' + starStr(stars) + '</span>',
      '      </div>',
      '      <h3 class="name">' + esc(c.title) + '</h3>',
      '      <p class="sub">' + esc(c.preview) + '</p>',
      '      <details class="detail"><summary>Chi tiết</summary><dl class="meta">',
      '        <div><dt>Nguồn gốc · Bản quyền</dt><dd>' + safeHtml(fieldStarts(c, 'Nguồn gốc')) + '</dd></div>',
      '        <div><dt>Format chính</dt><dd>' + safeHtml(fieldStarts(c, 'Format chính')) + '</dd></div>',
      '        <div><dt>Ra tiền</dt><dd>' + safeHtml(fieldStarts(c, 'Ra tiền')) + '</dd></div>',
      '      </dl></details>',
      '      <div class="card-foot"><span class="badge">B' + batch + ' · ' + dmy(day.date) + '</span><button class="markbtn" data-mark="interested">Quan tâm</button><button class="markbtn" data-mark="done">Đã làm</button></div>',
      '    </article>'
    ].join('\n');
  }).join('\n');
  const payload = tokenS + '\n' + articles + '\n' + tokenE;
  const anchorEnd = removed.html.indexOf('-->', removed.html.indexOf('<!-- BATCH_MOI:'));
  if (anchorEnd < 0) fail('web-distill.html: không thấy BATCH_MOI');
  const anchor = removed.html.slice(removed.html.indexOf('<!-- BATCH_MOI:'), anchorEnd + 3);
  let next = insertAfter(removed.html, anchor, payload);
  const beforeArticles = countTagLines(removed.html, '<article class="card"');
  const afterArticles = countTagLines(next, '<article class="card"');
  const expected = beforeArticles + cards.length;
  if (afterArticles !== expected) fail('distill: số thẻ đổi lệch (' + beforeArticles + ' → ' + afterArticles + ', mong ' + expected + ')');
  next = next.replace(/(data-tab="all">Tất cả \()\d+(\))/, '$1' + afterArticles + '$2');
  return { html: next, summary: 'distill ' + cards.length + ' (batch ' + batch + ', tổng thẻ ' + afterArticles + ')' };
}

function fbCardBits(card) {
  const problem = fieldStarts(card, 'Vấn đề');
  const signal = fieldStarts(card, 'Tín hiệu');
  const offer = fieldStarts(card, 'Offer');
  const other = fieldStarts(card, 'Khác thẻ');
  const risk = fieldStarts(card, 'Rủi ro');
  const sigParts = [problem, signal].filter(Boolean).map(safeHtml);
  const ideaParts = [];
  if (card.preview) ideaParts.push(esc(card.preview));
  if (offer) ideaParts.push(safeHtml(offer));
  if (other) ideaParts.push(safeHtml(other));
  if (risk) ideaParts.push(safeHtml(risk));
  return { sig: sigParts.join(' '), idea: ideaParts.join(' ') };
}

function mergeFb(html, day, cards) {
  const navS = '<!-- ' + dayMark(day.date, 'NAV') + ' -->';
  const quickS = '<!-- ' + dayMark(day.date, 'QUICK') + '-START -->';
  const quickE = '<!-- ' + dayMark(day.date, 'QUICK') + '-END -->';
  const secS = '<!-- ' + dayMark(day.date) + '-START -->';
  const secE = '<!-- ' + dayMark(day.date) + '-END -->';
  let next = html;
  const navAt = next.indexOf(navS);
  if (navAt >= 0) {
    let stop = next.indexOf('\n', navAt);
    const line2 = next.indexOf('\n', stop + 1);
    if (next.slice(stop + 1, line2).indexOf('href="#d' + day.date + '"') >= 0) stop = line2;
    if (next[stop] === '\n') stop += 1;
    next = next.slice(0, navAt) + next.slice(stop);
  }
  next = removeMarked(next, quickS, quickE).html;
  next = removeMarked(next, secS, secE).html;
  const top = cards.slice().sort((a, b) => (b.score || 0) - (a.score || 0))[0];
  const navLine = navS + '\n    <a href="#d' + day.date + '">' + day.label + '</a>';
  const navAnchor = '<!-- DAY-NAV:';
  const navAnchorEnd = next.indexOf('-->', next.indexOf(navAnchor));
  if (navAnchorEnd < 0) fail('quet-facebook.html: không thấy DAY-NAV');
  const navAnchorText = next.slice(next.indexOf(navAnchor), navAnchorEnd + 3);
  next = insertAfter(next, navAnchorText, navLine);

  const quick = [
    quickS,
    '      <div class="quick-card"><span class="badge badge-date">' + day.label + '</span><div class="qlabel">Vấn đề nổi bật nhất</div><div class="qprob">' + esc(top.title) + '</div><div class="qdeep">Đào sâu nhất: <b>' + esc(top.title) + '</b></div></div>',
    quickE
  ].join('\n');
  const quickAnchor = '<!-- QUICK-ROWS:';
  const quickAnchorEnd = next.indexOf('-->', next.indexOf(quickAnchor));
  if (quickAnchorEnd < 0) fail('quet-facebook.html: không thấy QUICK-ROWS');
  next = insertAfter(next, next.slice(next.indexOf(quickAnchor), quickAnchorEnd + 3), quick);

  const problems = cards.map((c, i) => {
    const bits = fbCardBits(c);
    const id = 'd' + day.date + '-' + (i + 1);
    return '    <div class="card pcard" data-id="' + id + '"><span class="rank">' + (i + 1) + '</span><div class="body"><div class="preview"><b>' + esc(c.title) + '</b> — <span class="sig">' + bits.sig + '</span></div></div></div>';
  }).join('\n');
  const ideas = cards.map((c, i) => {
    const bits = fbCardBits(c);
    const id = 'd' + day.date + '-' + (cards.length + i + 1);
    return '    <div class="card icard" data-id="' + id + '"><div class="preview"><b>' + esc(c.title) + '</b> — ' + bits.idea + '</div></div>';
  }).join('\n');
  const section = [
    secS,
    '<section class="day" id="d' + day.date + '">',
    '  <h2>' + esc(day.heading) + '</h2>',
    '  <div class="meta">Lượt ' + dmy(day.date) + ' · ' + cards.length + ' ý tưởng pain→offer. Link nguồn nằm trong từng thẻ.</div>',
    '  <h3>Vấn đề nổi bật</h3>',
    '  <div class="grid">',
    problems,
    '  </div>',
    '  <h3>Ý tưởng</h3>',
    '  <div class="grid">',
    ideas,
    '  </div>',
    '  <div class="deep">Đáng đào sâu nhất: <b>' + esc(top.title) + '</b> — ' + esc(top.preview) + '</div>',
    '</section>',
    secE
  ].join('\n');
  const dayAnchor = '<!-- DAY-SECTIONS:';
  const dayAnchorEnd = next.indexOf('-->', next.indexOf(dayAnchor));
  if (dayAnchorEnd < 0) fail('quet-facebook.html: không thấy DAY-SECTIONS');
  next = insertAfter(next, next.slice(next.indexOf(dayAnchor), dayAnchorEnd + 3), section);
  const ids = next.match(/data-id="d[^"]+"/g) || [];
  const uniq = new Set(ids);
  if (uniq.size !== ids.length) fail('fb: data-id trùng sau khi gắn ngày ' + day.date);
  if (next.indexOf('id="d' + day.date + '"') < 0) fail('fb: thiếu section ngày');
  if ((next.match(new RegExp('id="d' + day.date + '"', 'g')) || []).length !== 1) fail('fb: section ngày bị lặp');
  return { html: next, summary: 'fb ' + cards.length + ' (ngày ' + day.date + ', ' + (cards.length * 2) + ' ô vấn đề+ý tưởng)' };
}

function mergeWebapp(html, day, cards) {
  const tokenS = '<!-- ' + dayMark(day.date) + '-START -->';
  const tokenE = '<!-- ' + dayMark(day.date) + '-END -->';
  const removed = removeMarked(html, tokenS, tokenE);
  let luot = 0;
  const luotHit = removed.block.match(/data-luot="Lượt (\d+)/);
  if (luotHit) luot = parseInt(luotHit[1], 10);
  else luot = maxNum(removed.html, /data-luot="Lượt (\d+)/) + 1;
  const oldStt = [];
  const sttRe = /data-stt="(\d+)"/g;
  let sm;
  while ((sm = sttRe.exec(removed.block))) oldStt.push(sm[1]);
  const base = maxNum(removed.html, /data-stt="(\d+)"/);
  const articles = cards.map((c, i) => {
    const stt = oldStt[i] || String(base + 1 + i);
    const tepFull = fieldStarts(c, 'Tệp');
    const tep = shortTep(tepFull);
    const diffFull = htmlToText(fieldStarts(c, 'Độ khó'));
    const parts = diffFull.split(/\s·\s/);
    const diff = leadLabel(parts[0] || diffFull) || diffFull;
    const comp = leadLabel(parts[1] || '') || '—';
    const money = htmlToText(fieldStarts(c, 'Ra tiền'));
    const cls = scoreClass(c.score);
    const bits = [];
    if (c.star) bits.push('<b>LÀM NGAY.</b>');
    bits.push('<b>Ngày:</b> ' + esc(dmy(day.date)) + '.');
    bits.push('<b>Tệp:</b> ' + safeHtml(tepFull));
    const pain = fieldStarts(c, 'Nỗi đau') || fieldStarts(c, 'Tín hiệu');
    if (pain) bits.push('<b>Nỗi đau:</b> ' + safeHtml(pain));
    const prod = fieldStarts(c, 'Form');
    if (prod) bits.push('<b>Sản phẩm:</b> ' + safeHtml(prod));
    const moneyHtml = fieldStarts(c, 'Ra tiền');
    if (moneyHtml) bits.push('<b>Ra tiền:</b> ' + safeHtml(moneyHtml));
    const diffHtml = fieldStarts(c, 'Độ khó');
    if (diffHtml) bits.push('<b>Độ khó · cạnh tranh:</b> ' + safeHtml(diffHtml));
    bits.push('<b>Tóm tắt:</b> ' + esc(c.preview));
    return [
      '<article class="idea-card" data-tep="' + esc(tep) + '" data-luot="Lượt ' + luot + '" data-diem="' + c.score + '" data-stt="' + stt + '">',
      '  <div class="card-top"><span class="idea-num">#' + stt + '</span><span class="score ' + cls + '">' + scoreLabel(c.score) + '</span></div>',
      '  <h2>' + esc(c.title) + '</h2>',
      '  <div class="tag-row" aria-label="Tệp người dùng"><span class="chip">' + esc(tep) + '</span></div>',
      '  <dl class="meta">',
      '    <div><dt>Độ khó</dt><dd>' + esc(diff) + '</dd></div>',
      '    <div><dt>Cạnh tranh</dt><dd>' + esc(comp) + '</dd></div>',
      '    <div class="money"><dt>Ra tiền</dt><dd>' + esc(money) + '</dd></div>',
      '  </dl>',
      '  <div class="card-foot"><span class="batch-chip">Lượt ' + luot + '</span><div class="state-btns"><button type="button" class="state-btn" data-state="interested">Quan tâm</button><button type="button" class="state-btn" data-state="done">Đã làm</button></div></div>',
      '  <details class="idea-details"><summary>Chi tiết</summary><div class="detail-body">' + bits.join(' ') + '</div></details>',
      '</article>'
    ].join('\n');
  }).join('\n');
  const payload = tokenS + '\n' + articles + '\n' + tokenE;
  const anchor = '<main class="idea-grid" id="idea-grid">';
  if (removed.html.indexOf(anchor) < 0) fail('webapp-ai.html: không thấy idea-grid');
  let next = insertAfter(removed.html, anchor, payload);
  const n = countTagLines(next, '<article class="idea-card"');
  const before = countTagLines(removed.html, '<article class="idea-card"');
  if (n !== before + cards.length) fail('webapp: số thẻ đổi lệch (' + before + ' → ' + n + ')');
  const luotMax = maxNum(next, /data-luot="Lượt (\d+)/);
  const batchTxt = next.indexOf('data-luot="Nền"') >= 0 ? (luotMax + ' + báo cáo nền') : String(luotMax);
  next = next.replace(/(id="total-ideas">)\d+/, '$1' + n);
  next = next.replace(/(id="total-batches">)[^<]+/, '$1' + batchTxt);
  const cur = (next.match(/id="last-updated">([^<]+)/) || [])[1] || '';
  const curIso = cur.split('/').reverse().join('-');
  if (!curIso || curIso <= day.date) {
    next = next.replace(/(id="last-updated">)[^<]+/, '$1' + dmy(day.date));
  }
  const stts = next.match(/data-stt="\d+"/g) || [];
  if (new Set(stts).size !== stts.length) fail('webapp: data-stt trùng');
  return { html: next, summary: 'webapp ' + cards.length + ' (Lượt ' + luot + ', tổng ' + n + ')' };
}

function main() {
  const { root, dayPath } = parseArgs(process.argv);
  const absDay = path.resolve(dayPath);
  let incoming;
  try {
    incoming = JSON.parse(read(absDay));
  } catch (err) {
    fail('Không đọc được ' + dayPath + ': ' + err.message);
  }
  if (!incoming.tz) incoming.tz = 'Asia/Saigon';
  const byTrack = validateDay(incoming);
  const mergers = { game: mergeGame, distill: mergeDistill, fb: mergeFb, webapp: mergeWebapp };
  const outputs = [];
  TRACKS.forEach((track) => {
    if (!byTrack[track]) return;
    const file = path.join(root, FILES[track]);
    const html = read(file);
    const result = mergers[track](html, incoming, byTrack[track]);
    outputs.push({ file, html: result.html, summary: result.summary });
  });
  outputs.forEach((o) => fs.writeFileSync(o.file, o.html));
  console.log((outputs.some((o) => true) ? 'gắn ' : '') + incoming.date + ' → ' + outputs.map((o) => o.summary).join(' | '));
  const skipped = TRACKS.filter((t) => !byTrack[t]);
  if (skipped.length) console.log('bỏ qua (không có thẻ): ' + skipped.join(', '));
}

main();
