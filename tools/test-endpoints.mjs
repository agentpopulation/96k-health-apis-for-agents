#!/usr/bin/env node
// Re-tests endpoints of this pack with the rule the pack uses. Node 18+, no packages.
//
//   node tools/test-endpoints.mjs [path.csv | path.csv.gz] [--limit 50] [--timeout-ms 10000] [--out results.csv]
//
// With no path it reads the sample in data/. Pass the full list from the latest release (.csv or .csv.gz)
// to test rows from it; --limit takes the first rows of the file (default 50).
// Pass rule: HTTP 2xx and a non-empty body that is not an HTML page. A body of only [], {} or null is empty.
// Polite by design: GET only, no key or cookie sent, at most 4 requests in flight, never two at once to the
// same host, at least 1 second between requests to one host, redirects followed, and a User-Agent that says
// what this is. The host rules apply to the host in the list; a redirect may lead to another host. Reading
// stops once 256 kB of a body is kept.
// A status of "timeout" or "error:<code>" (for example error:ENOTFOUND) means no HTTP answer came back.
// Writes url, status, passed, content_type, ms, checked_at to the --out file and prints a one-line summary.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { StringDecoder } from 'node:string_decoder';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = path.join(HERE, '..', 'data/Health_API_Endpoints_AgentPopulation_Sample.csv');
const USER_AGENT = 'AgentPopulation-endpoint-tester/1.0 (re-tests a pack list; +https://github.com/agentpopulation/96k-health-apis-for-agents)';
const MAX_IN_FLIGHT = 4;
const HOST_GAP_MS = 1000;
const MAX_BODY = 256 * 1024;

/** URLs that describe a dataset or a service rather than return values; they sort after the others. */
const DESCRIBES = /\/erddap\/info\/|action-report\.json$|[?&]request=getcapabilities|\/GeoArea\/[^/?]+\/List|getFullTableDownloadCSV|hub\.worldpop\.org/i;
const byValuesThenDate = (a, b) => (DESCRIBES.test(a.url) ? 1 : 0) - (DESCRIBES.test(b.url) ? 1 : 0) || (a.last_tested < b.last_tested ? 1 : a.last_tested > b.last_tested ? -1 : 0);

/**
 * RFC 4180 CSV parser over a sequence of text pieces: quoted fields may hold commas, quotes and line breaks, and a
 * piece may end anywhere, so a list larger than one JavaScript string can be read in pieces.
 */
function parseCsvPieces(pieces) {
  const out = []; let rec = []; let field = ''; let q = false; let quoteSeen = false;
  for (const text of pieces) {
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (quoteSeen) { quoteSeen = false; if (ch === '"') { field += '"'; continue; } q = false; }
      if (q) { if (ch === '"') quoteSeen = true; else field += ch; continue; }
      if (ch === '"') q = true;
      else if (ch === ',') { rec.push(field); field = ''; }
      else if (ch === '\n') { rec.push(field); out.push(rec); rec = []; field = ''; }
      else if (ch !== '\r') field += ch;
    }
  }
  if (field || rec.length) { rec.push(field); out.push(rec); }
  const [head = [], ...body] = out;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
const parseCsv = (text) => parseCsvPieces([text]);

/** Rows of a .csv or .csv.gz file, decoded 16 MB at a time (the full list of a large pack is bigger than one string). */
function readCsvFile(file) {
  const buf = fs.readFileSync(file);
  const data = file.endsWith('.gz') ? zlib.gunzipSync(buf) : buf;
  const decoder = new StringDecoder('utf8');
  function* pieces() { for (let i = 0; i < data.length; i += 1 << 24) yield decoder.write(data.subarray(i, i + (1 << 24))); yield decoder.end(); }
  return parseCsvPieces(pieces());
}

function readArgs(argv) {
  const o = { file: SAMPLE, limit: 50, timeoutMs: 10000, out: 'results.csv' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--limit') o.limit = Number(argv[++i]);
    else if (a === '--timeout-ms') o.timeoutMs = Number(argv[++i]);
    else if (a === '--out') o.out = argv[++i];
    else if (a === '--help' || a === '-h') o.help = true;
    else if (a.startsWith('--')) throw new Error('unknown option ' + a);
    else o.file = a;
  }
  if (!(o.limit > 0) || !(o.timeoutMs > 0) || !o.out) throw new Error('--limit and --timeout-ms take a positive number, --out a file name');
  return o;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hostOf = (url) => { try { return new URL(url).host; } catch { return ''; } };
const isEmpty = (text) => { const t = text.trim(); return t === '' || t === '[]' || t === '{}' || t === 'null'; };
const looksHtml = (type, text) => /text\/html|application\/xhtml/i.test(type) || /^\s*(<!doctype html|<html[\s>]|<head[\s>]|<body[\s>])/i.test(text);
const cell = (v) => { const s = String(v ?? ''); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

/** One GET with a timeout; reads at most MAX_BODY bytes of the body. */
async function testOne(url, timeoutMs) {
  const out = { url, status: '', passed: false, content_type: '', ms: 0, checked_at: new Date().toISOString() };
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    if (!/^https?:$/.test(new URL(url).protocol)) throw new Error('not an http address');
    const res = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': USER_AGENT, Accept: '*/*' }, signal: ctrl.signal });
    out.status = res.status;
    out.content_type = res.headers.get('content-type') ?? '';
    const chunks = []; let size = 0;
    if (res.body) {
      const reader = res.body.getReader();
      while (size < MAX_BODY) {
        const { done, value } = await reader.read();
        if (done) break;
        const part = value.length > MAX_BODY - size ? value.subarray(0, MAX_BODY - size) : value;
        chunks.push(Buffer.from(part)); size += part.length;
      }
      reader.cancel().catch(() => {});
    }
    const text = Buffer.concat(chunks).toString('utf8');
    out.passed = res.status >= 200 && res.status < 300 && !isEmpty(text) && !looksHtml(out.content_type, text);
  } catch (err) {
    if (out.status === '') out.status = ctrl.signal.aborted ? 'timeout' : 'error:' + String(err.cause?.code ?? err.code ?? err.cause?.message ?? err.message ?? 'unknown').replace(/\s+/g, '-');
  } finally {
    clearTimeout(timer);
    out.ms = Date.now() - started;
  }
  return out;
}

/** Runs the tests: at most MAX_IN_FLIGHT at once, one at a time per host, HOST_GAP_MS between calls to a host. */
async function runAll(urls, timeoutMs) {
  const pending = urls.map((url, i) => ({ url, i, host: hostOf(url) }));
  const results = new Array(urls.length);
  const busy = new Set();
  const last = new Map();
  const running = new Set();
  while (pending.length || running.size) {
    while (running.size < MAX_IN_FLIGHT) {
      const now = Date.now();
      const k = pending.findIndex((j) => !busy.has(j.host) && now - (last.get(j.host) ?? -Infinity) >= HOST_GAP_MS);
      if (k < 0) break;
      const job = pending.splice(k, 1)[0];
      busy.add(job.host);
      last.set(job.host, now);
      const p = testOne(job.url, timeoutMs).then((r) => {
        results[job.i] = r;
        busy.delete(job.host);
        last.set(job.host, Date.now());
        running.delete(p);
      });
      running.add(p);
    }
    if (pending.length || running.size) await Promise.race([...running, sleep(100)]);
  }
  return results;
}

const USAGE = 'usage: node tools/test-endpoints.mjs [path.csv | path.csv.gz] [--limit 50] [--timeout-ms 10000] [--out results.csv]';

async function main() {
  const opts = readArgs(process.argv.slice(2));
  if (opts.help) { console.log(USAGE); return; }
  if (!fs.existsSync(opts.file)) throw new Error('no such file: ' + opts.file);
  const urls = [...new Set(readCsvFile(opts.file).map((r) => r.url).filter(Boolean))].slice(0, opts.limit);
  const results = await runAll(urls, opts.timeoutMs);
  const cols = ['url', 'status', 'passed', 'content_type', 'ms', 'checked_at'];
  fs.writeFileSync(opts.out, [cols.join(','), ...results.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n');
  const passed = results.filter((r) => r.passed).length;
  console.log('tested ' + results.length + ', passed ' + passed + ', did not pass ' + (results.length - passed) + ' (results in ' + opts.out + ')');
}

main().catch((err) => {
  console.error('test-endpoints: ' + err.message + '\n' + USAGE);
  process.exit(1);
});
