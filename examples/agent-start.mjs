// Node 18+, no packages. Run from a clone of this repository:
//   node examples/agent-start.mjs                calls the most recently tested agent-ready row of the sample in data/
//   node examples/agent-start.mjs <path>         the same for a .csv or .csv.gz file, such as the full list from the latest release
//   node examples/agent-start.mjs --recommended  calls the first recommended service of the Agent tools bucket (recommended.json)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { StringDecoder } from 'node:string_decoder';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RAW = 'https://raw.githubusercontent.com/agentpopulation/96k-health-apis-for-agents/main/recommended.json';
const SAMPLE = path.join(HERE, '..', 'data/Health_API_Endpoints_AgentPopulation_Sample.csv');
const RECOMMENDED = path.join(HERE, '..', 'recommended.json');
const USAGE = 'usage: node examples/agent-start.mjs [path.csv | path.csv.gz | --recommended]';

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

const fail = (msg) => { console.error(msg); process.exit(1); };
let pick;
const arg = process.argv[2];
if (arg && arg.startsWith('-') && arg !== '--recommended') fail(USAGE);
if (arg !== '--recommended') {
  const file = arg ?? SAMPLE;
  if (!fs.existsSync(file)) fail('no such file: ' + file + '\n' + USAGE);
  const agent = readCsvFile(file)
    .filter((r) => (r.tags ?? '').split('|').includes('agent-ready'))
    .sort(byValuesThenDate);
  if (!agent.length) { console.log('no agent-ready rows in ' + file); process.exit(0); }
  pick = { service: agent[0].service, sample_url: agent[0].url, sample_last_tested: agent[0].last_tested };
} else {
  let rec;
  try {
    rec = fs.existsSync(RECOMMENDED)
      ? JSON.parse(fs.readFileSync(RECOMMENDED, 'utf8'))
      : await (await fetch(RAW, { signal: AbortSignal.timeout(15000) })).json();
  } catch (err) {
    fail('recommended.json not found next to examples/ and not reachable at ' + RAW + ' (' + err.message + ')');
  }
  pick = rec.buckets.find((b) => b.id === 'agent').services[0];
}

try {
  const res = await fetch(pick.sample_url, {
    headers: { 'User-Agent': 'agent-example/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  console.log(pick.service, res.status, res.headers.get('content-type'));
  console.log((await res.text()).slice(0, 300));
} catch (err) {
  console.log('did not answer now; last passed ' + pick.sample_last_tested + ' (' + err.message + ')');
}
