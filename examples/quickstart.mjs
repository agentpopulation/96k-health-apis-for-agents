// Node 18+, no packages. Run from a clone of this repository:
//   node examples/quickstart.mjs [path.csv | path.csv.gz] [query words]
// With no path it reads the sample in data/ (or the sample JSON on GitHub when run outside a clone).
// Pass the full list from the latest release (.csv or .csv.gz) instead.
// Two agent tools over the list: find_endpoints searches it, fetch_endpoint calls one URL.
// fetch_endpoint refuses any URL that is not in the list and does not follow redirects, so a
// prompt-injected URL is refused and a listed URL cannot hand the call on to an unlisted address.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { StringDecoder } from 'node:string_decoder';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_FILE = path.join(HERE, '..', 'data/Health_API_Endpoints_AgentPopulation_Sample.csv');
const SAMPLE_URL = 'https://raw.githubusercontent.com/agentpopulation/96k-health-apis-for-agents/main/data/Health_API_Endpoints_AgentPopulation_Sample.json';

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

/** Rows of the given .csv or .csv.gz file; with no file, the sample. Tags come back as an array. */
export async function loadRows(file) {
  const target = file ?? (fs.existsSync(SAMPLE_FILE) ? SAMPLE_FILE : null);
  if (!target) return (await fetch(SAMPLE_URL)).json();
  return readCsvFile(target).map((r) => ({ ...r, tags: r.tags.split('|') }));
}

export function findEndpoints(rows, { query, country, format, limit = 5 }) {
  const words = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  return rows
    .filter((r) => r.tags.includes('agent-ready'))
    .filter((r) => (!country || r.country === country) && (!format || r.format === format))
    .filter((r) => words.every((w) => (r.title + ' ' + r.service + ' ' + r.subcategory).toLowerCase().includes(w)))
    .sort(byValuesThenDate)
    .slice(0, Math.min(20, Math.max(1, limit)))
    .map(({ url, title, service, country: c, format: fm, last_tested }) => ({ url, title, service, country: c, format: fm, last_tested }));
}

export async function fetchEndpoint(allow, url) {
  if (!allow.has(url)) return { error: 'refused: this URL is not in the list' };
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'agent-example/1.0' }, signal: AbortSignal.timeout(15000), redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) return { status: res.status, error: 'redirect to ' + (res.headers.get('location') ?? 'an unknown address') + ' not followed' };
    return { status: res.status, contentType: res.headers.get('content-type'), body: (await res.text()).slice(0, 4000) };
  } catch (err) {
    return { error: 'did not answer now (' + err.message + ')' };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const file = args[0] && /\.csv(\.gz)?$/i.test(args[0]) ? args.shift() : undefined;
  const rows = await loadRows(file);
  const allow = new Set(rows.map((r) => r.url));
  const found = findEndpoints(rows, { query: args.join(' '), limit: 3 });
  console.log(rows.length, 'rows loaded;', found.length, 'found');
  console.log(found);
  if (found[0]) {
    const out = await fetchEndpoint(allow, found[0].url);
    console.log(out.status ?? '', out.contentType ?? '', (out.body ?? out.error).slice(0, 300));
  }
  console.log(await fetchEndpoint(allow, 'https://example.com/not-in-the-list'));
}
