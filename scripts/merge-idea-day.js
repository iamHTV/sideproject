#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const START = '// IDEA-DAYS-START';
const END = '// IDEA-DAYS-END';
const TRACKS = new Set(['game', 'distill', 'fb', 'webapp']);

function usage() {
  console.error('Usage: node scripts/merge-idea-day.js <day.json> [--html dashboard/idea-crawl.html]');
  process.exit(2);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let html = path.join('dashboard', 'idea-crawl.html');
  const pos = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--html') {
      html = args[++i];
      if (!html) usage();
    } else if (args[i] === '--help' || args[i] === '-h') {
      usage();
    } else {
      pos.push(args[i]);
    }
  }
  if (pos.length !== 1) usage();
  return { html, dayPath: pos[0] };
}

function fail(msg) {
  console.error('merge-idea-day: ' + msg);
  process.exit(1);
}

function extract(html) {
  const s = html.indexOf(START);
  const e = html.indexOf(END);
  if (s < 0 || e < 0 || e < s) fail('Không thấy marker IDEA-DAYS-START / IDEA-DAYS-END');
  if (html.indexOf(START, s + 1) !== -1 || html.indexOf(END, e + 1) !== -1) {
    fail('Marker bị lặp — dừng để khỏi ghi đè nhầm');
  }
  const block = html.slice(s + START.length, e);
  const key = 'var IDEA_DAYS =';
  const k = block.indexOf(key);
  if (k < 0) fail('Không thấy `var IDEA_DAYS =` trong marker');
  let jsonText = block.slice(k + key.length).trim();
  if (jsonText.endsWith(';')) jsonText = jsonText.slice(0, -1).trim();
  let days;
  try {
    days = JSON.parse(jsonText);
  } catch (err) {
    fail('IDEA_DAYS không parse được: ' + err.message);
  }
  if (!Array.isArray(days)) fail('IDEA_DAYS không phải mảng');
  return { s, e, days };
}

function stringifyDays(days) {
  return JSON.stringify(days, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function validateDay(day, label) {
  if (!day || typeof day !== 'object' || Array.isArray(day)) fail(label + ': phải là object một ngày');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date || '')) fail(label + ': date phải là YYYY-MM-DD');
  if (typeof day.label !== 'string' || !day.label.trim()) fail(label + ': thiếu label (vd 03/11)');
  if (typeof day.heading !== 'string' || !day.heading.trim()) fail(label + ': thiếu heading');
  if (typeof day.tz !== 'string' || !day.tz.trim()) fail(label + ': thiếu tz (dùng Asia/Saigon)');
  if (typeof day.note !== 'string') fail(label + ': note phải là chuỗi');
  if (!Array.isArray(day.cards) || day.cards.length === 0) fail(label + ': cards phải là mảng không rỗng');
  const ids = new Set();
  day.cards.forEach((c, i) => {
    const where = day.date + ' thẻ #' + (i + 1);
    if (!c || typeof c !== 'object') fail(where + ' không phải object');
    if (typeof c.id !== 'string' || c.id.indexOf(day.date + '-c') !== 0) {
      fail(where + ': id phải bắt đầu bằng "' + day.date + '-c" (vd ' + day.date + '-c1)');
    }
    if (ids.has(c.id)) fail(where + ': id trùng ' + c.id);
    ids.add(c.id);
    if (!TRACKS.has(c.track)) fail(where + ': track phải là game | distill | fb | webapp');
    if (typeof c.title !== 'string' || !c.title.trim()) fail(where + ': thiếu title');
    if (typeof c.preview !== 'string') fail(where + ': preview phải là chuỗi');
    if (!Array.isArray(c.fields) || c.fields.length === 0) fail(where + ': thiếu fields');
    c.fields.forEach((f, fi) => {
      if (!Array.isArray(f) || f.length !== 2 || typeof f[0] !== 'string' || typeof f[1] !== 'string') {
        fail(where + ': fields[' + fi + '] phải là [nhãn, html]');
      }
    });
    if (!(c.score === null || typeof c.score === 'number')) fail(where + ': score phải là số hoặc null');
    if (typeof c.star !== 'boolean') fail(where + ': star phải là true hoặc false');
  });
}

function main() {
  const { html: htmlPath, dayPath } = parseArgs(process.argv);
  const html = fs.readFileSync(htmlPath, 'utf8');
  let incoming;
  try {
    incoming = JSON.parse(fs.readFileSync(dayPath, 'utf8'));
  } catch (err) {
    fail('Không đọc được ' + dayPath + ': ' + err.message);
  }
  if (!incoming.tz) incoming.tz = 'Asia/Saigon';
  if (typeof incoming.note !== 'string') incoming.note = '';
  validateDay(incoming, incoming.date || 'ngày mới');

  const { s, e, days } = extract(html);
  days.forEach((d) => validateDay(d, d.date || 'ngày cũ'));

  const snapshots = new Map(days.map((d) => [d.date, JSON.stringify(d)]));
  const idx = days.findIndex((d) => d.date === incoming.date);
  const mode = idx >= 0 ? 'updated' : 'added';
  const next = days.slice();
  if (idx >= 0) next[idx] = incoming;
  else next.unshift(incoming);
  next.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  snapshots.forEach((json, date) => {
    const now = next.find((d) => d.date === date);
    if (!now) fail('Từ chối xoá ngày ' + date);
    if (date !== incoming.date && JSON.stringify(now) !== json) fail('Từ chối sửa ngày khác: ' + date);
  });

  const allIds = new Set();
  next.forEach((d) => d.cards.forEach((c) => {
    if (allIds.has(c.id)) fail('id trùng trong kho: ' + c.id);
    allIds.add(c.id);
  }));

  const middle = START + '\nvar IDEA_DAYS = ' + stringifyDays(next) + ';\n';
  const out = html.slice(0, s) + middle + html.slice(e);
  fs.writeFileSync(htmlPath, out);

  const total = next.reduce((n, d) => n + d.cards.length, 0);
  const kept = days.filter((d) => d.date !== incoming.date).map((d) => d.date);
  console.log(mode + ' ' + incoming.date + ': ' + incoming.cards.length + ' thẻ');
  console.log('kho: ' + next.length + ' ngày, ' + total + ' thẻ');
  console.log('thứ tự (mới nhất trước): ' + next.map((d) => d.date).join(', '));
  console.log('ngày giữ nguyên: ' + (kept.join(', ') || '(chưa có ngày cũ)'));
}

main();
