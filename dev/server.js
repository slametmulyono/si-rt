// Preview lokal SiRT 25: menjalankan Code.gs + Logo.gs asli di Node dengan tiruan layanan Google
// (Sheets, Cache, Properties, Lock, Utilities). Data disimpan di dev/db.json.
// Jalankan: node dev/server.js [port]  → http://localhost:8810
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DB_FILE = path.join(__dirname, 'db.json');
const PORT = Number(process.argv[2] || process.env.PORT || 8810);

let db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) : { props: {}, sheets: {} };
const save = () => fs.writeFileSync(DB_FILE, JSON.stringify(db));
const cache = new Map();

function unq(v) { return typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v; }

function makeRange(name, r, c, nr, nc) {
  const rows = () => db.sheets[name];
  const self = {
    getValues() {
      const out = [];
      for (let i = 0; i < nr; i++) { const row = rows()[r - 1 + i] || []; const o = []; for (let j = 0; j < nc; j++) o.push(row[c - 1 + j] ?? ''); out.push(o); }
      return out;
    },
    setValues(v) {
      for (let i = 0; i < v.length; i++) { while (rows().length < r + i) rows().push([]); const row = rows()[r - 1 + i]; for (let j = 0; j < v[i].length; j++) row[c - 1 + j] = unq(v[i][j]); }
      save(); return self;
    },
    setValue(v) { return self.setValues([[v]]); },
    setFontWeight() { return self }, setBackground() { return self }, setFontColor() { return self }, setNumberFormat() { return self }
  };
  return self;
}

function makeSheet(name) {
  return {
    getName: () => name,
    getDataRange() { const rs = db.sheets[name]; const nc = Math.max(1, ...rs.map(x => x.length)); return makeRange(name, 1, 1, Math.max(rs.length, 1), nc); },
    getRange(r, c, nr, nc) { return makeRange(name, r, c, nr || 1, nc || 1); },
    appendRow(v) { db.sheets[name].push(v.map(unq)); save(); },
    deleteRow(r) { db.sheets[name].splice(r - 1, 1); save(); },
    deleteRows(r, n) { db.sheets[name].splice(r - 1, n); save(); },
    getLastRow: () => db.sheets[name].length,
    getLastColumn: () => (db.sheets[name][0] || []).length,
    setFrozenRows() { }, getMaxRows: () => 1000
  };
}

const spreadsheet = {
  getId: () => 'MOCK', getUrl: () => 'http://localhost/mock-sheet',
  getSheetByName: n => (db.sheets[n] ? makeSheet(n) : null),
  insertSheet(n) { db.sheets[n] = []; save(); return makeSheet(n); },
  getSheets: () => Object.keys(db.sheets).map(makeSheet),
  deleteSheet(sh) { delete db.sheets[sh.getName()]; save(); }
};

function fmtDate(d, tz, pat) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    .formatToParts(d).reduce((o, x) => (o[x.type] = x.value, o), {});
  if (p.hour === '24') p.hour = '00';
  return pat.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute).replace('ss', p.second);
}

const sandbox = {
  console,
  Logger: { log: (...a) => console.log('[Logger]', ...a) },
  SpreadsheetApp: { openById: () => spreadsheet, create: () => spreadsheet, flush() { } },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: k => db.props[k] ?? null,
      setProperty(k, v) { db.props[k] = String(v); save(); },
      deleteProperty(k) { delete db.props[k]; save(); },
      getProperties: () => ({ ...db.props })
    })
  },
  CacheService: {
    getScriptCache: () => ({
      get: k => { const x = cache.get(k); return x && x.exp > Date.now() ? x.v : null; },
      put: (k, v, s) => cache.set(k, { v: String(v), exp: Date.now() + (s || 600) * 1000 }),
      remove: k => cache.delete(k)
    })
  },
  LockService: { getScriptLock: () => ({ waitLock() { }, releaseLock() { } }) },
  Utilities: {
    formatDate: fmtDate,
    getUuid: () => crypto.randomUUID(),
    DigestAlgorithm: { SHA_256: 'sha256' },
    Charset: { UTF_8: 'utf8' },
    computeDigest: (alg, s) => Array.from(crypto.createHash('sha256').update(s, 'utf8').digest()).map(b => (b > 127 ? b - 256 : b)),
    base64Encode: bytes => Buffer.from(bytes.map(b => b & 255)).toString('base64'),
    // Konversi HTML→PDF hanya tersedia di Apps Script; di preview PDF kosong (pakai tombol Cetak).
    newBlob: () => ({ getAs: () => ({ getBytes: () => [] }) })
  },
  HtmlService: {}
};
vm.createContext(sandbox);
for (const f of ['Logo.gs', 'Code.gs']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });

if (!db.props.SPREADSHEET_ID) { db.props.SPREADSHEET_ID = 'MOCK'; save(); }
if (!db.sheets.USERS) { vm.runInContext('isiDataContoh()', sandbox); }

const SHIM = `<script>
window.google = { script: { run: (function () {
  function mk(ok, fail) {
    return {
      withSuccessHandler: function (f) { return mk(f, fail); },
      withFailureHandler: function (f) { return mk(ok, f); },
      api: function (t, a, p) {
        fetch('/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: t, a: a, p: p }) })
          .then(function (r) { return r.text(); }).then(function (x) { ok && ok(x); }).catch(function (e) { fail && fail(e); });
      }
    };
  }
  return mk(null, null);
})() } };
</script>`;

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/rpc') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const { t, a, p } = JSON.parse(body);
      sandbox.__args = [t, a, p];
      let out;
      try { out = vm.runInContext('_cache = {}; api.apply(null, __args)', sandbox); }
      catch (e) { out = JSON.stringify({ ok: false, error: 'Mock error: ' + e.message }); }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(out);
    });
    return;
  }
  // Khusus uji lokal: jalankan ekspresi di dalam sandbox Code.gs (mis. ubah data uji).
  if (req.method === 'POST' && req.url === '/dev/eval') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      let out;
      try { out = JSON.stringify(vm.runInContext('_cache = {};' + JSON.parse(body).code, sandbox)); }
      catch (e) { out = JSON.stringify({ error: e.message }); }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(out ?? 'null');
    });
    return;
  }
  // Halaman pengirim: membaca file proyek lalu mengirimnya ke jendela editor Apps Script yang membuka halaman ini.
  if (req.url === '/kirim') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif"><p id="s">Mengirim...</p><script>' +
      'Promise.all(["Code.gs","Index.html","Logo.gs"].map(function(f){return fetch("/raw/"+f).then(function(r){return r.text();}).then(function(t){return {nama:f,isi:t};});}))' +
      '.then(function(files){ if(!window.opener){document.getElementById("s").textContent="Tidak ada jendela pembuka";return;} window.opener.postMessage({sirt:true,files:files},"https://script.google.com"); document.getElementById("s").textContent="Terkirim "+files.length+" file"; });' +
      '</script></body>');
    return;
  }
  // Sumber file mentah untuk membantu menyalin kode ke editor Apps Script (hanya 3 file proyek).
  const raw = req.url.match(/^\/raw\/(Code\.gs|Logo\.gs|Index\.html)$/);
  if (raw) {
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': 'https://script.google.com',
      'Access-Control-Allow-Private-Network': 'true'
    });
    res.end(fs.readFileSync(path.join(ROOT, raw[1]), 'utf8'));
    return;
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': 'https://script.google.com', 'Access-Control-Allow-Private-Network': 'true', 'Access-Control-Allow-Methods': 'GET' });
    res.end();
    return;
  }
  if (req.url === '/' || req.url.startsWith('/?')) {
    const html = fs.readFileSync(path.join(ROOT, 'Index.html'), 'utf8').replace('<script>', SHIM + '\n<script>');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }
  res.writeHead(404); res.end('not found');
}).listen(PORT, '127.0.0.1', () => console.log('SiRT 25 preview → http://localhost:' + PORT));
