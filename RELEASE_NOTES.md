## Health API endpoints, snapshot 15 Nov 2026

- 96,866 endpoints passed a keyless data call, tested 11–15 Nov 2026 (IST)
- 5,827 services · 249 country codes · 68,037 keyless JSON rows

### Download

- `Health_API_Endpoints_AgentPopulation_Snapshot_2026-11-15.csv.gz`: the full list, 96,866 rows, 4.6 MB gzipped (29.1 MB as CSV), SHA-256 `625de757e759ff0b70bdac19f971e21a55532853d317d3e5b2d9a20e24ad6f8b`
- `SHA256SUMS.txt`: the checksum of that file

Check the download in the folder that holds both files:

```bash
sha256sum -c SHA256SUMS.txt          # Linux
shasum -a 256 -c SHA256SUMS.txt      # macOS
certutil -hashfile Health_API_Endpoints_AgentPopulation_Snapshot_2026-11-15.csv.gz SHA256   # Windows: compare with SHA256SUMS.txt
```

Then `gunzip Health_API_Endpoints_AgentPopulation_Snapshot_2026-11-15.csv.gz` and pass the CSV path to the examples or to `node tools/test-endpoints.mjs`. The repository itself holds a 1,000-row sample and the services list.

### What's in it for you

- 🤖 Agent tools: 46,240 · Wrap the WHO indicator query as a get_health_indicator tool: pass an indicator code and a country code, return the values by year (and by sex where the indicator has it) with a timeout.
- 📱 App features: 6,143 · Build a find_nearest_hospital card: load facility layers for one area, return name, type and address for the nearest few, and show them on a map.
- 🧠 Grounding and data pipelines: 34,865 · Load mortality, vaccination and life-expectancy series on a schedule into your own store, so answers about a country's health cite a dated source.
- 🧪 Evals and testing: 96,866 · Run your health tool against a fixed set of URLs across formats; check that indicator values, years and facility names parse, and keep last_tested as the baseline for your own re-tests.

### Changes

- First release
- Left out: 11 rows whose URL carried a credential-looking parameter or a login.
- Left out: 6 rows with an email-like address.
- Left out: 934 ArcGIS Survey123 layers (they can hold people's form answers).
- Left out: 3 layers marked editable in the title (they can hold entries that people added).
- Left out: 198 ArcGIS layers that keep a form's default service name (they can hold people's form answers).
- Left out: 1 row that passed a data call only from a network location in India.
- Left out: 4,498 ArcGIS class or coursework layers (lab, assignment, exam, quiz, lesson, exercise, tutorial and final-project layers, copies of class layers, layers named for a person or a person's home, and layers whose name ends in a person's name or holds a student number).
- Left out: 21 ArcGIS layers that hold reports, comments, submissions or form responses sent in by the public.
- Overlap: 2,989 of these URLs are also in 190k-weather-apis-for-agents.
- Overlap: 271 of these URLs are also in 270k-transit-apis-for-agents.
- Overlap: 156 of these URLs are also in 270k-water-apis-for-agents.
- Overlap: 1,139 of these URLs are also in 130k-finance-economy-apis-for-agents.
- Overlap: 2,107 of these URLs are also in 130k-india-apis-for-agents.
- Overlap: 6 of these URLs are also in 86k-oceans-apis-for-agents.
- Overlap: 184 of these URLs are also in 20k-air-quality-apis-for-agents.
- Overlap: 68,037 of these URLs are also in 2.5m-agent-ready-apis.
- Overlap: 132 of these URLs are also in 24k-traffic-apis-for-agents.
- Overlap: 1 of these URLs is also in 12k-parking-apis-for-agents.
- Overlap: 3 of these URLs are also in 10k-earthquake-apis-for-agents.

On the date in last_tested (IST), one GET to the URL, sent with no key, returned HTTP 2xx and a non-empty data body. HTML pages and empty results did not pass. The format column records what came back. This is a test result for that date, not a promise that the URL answers today. Licences, terms, rate limits, accuracy and freshness were not reviewed. Endpoints are URLs, not separate APIs; many share one service. This pack was tested 11–15 Nov 2026; snapshot 15 Nov 2026.

For the latest tested endpoints, search agentpopulation.com/apis. This pack is a snapshot from 15 Nov 2026.

Credit: Health API endpoints by AgentPopulation (https://agentpopulation.com), CC BY 4.0, snapshot 15 Nov 2026.

Compiled by [AgentPopulation](https://agentpopulation.com) with [AP Desk](https://github.com/agentpopulation/apdesk) · corrections: [@agentpopulation](https://x.com/agentpopulation) on X
