# Changelog

## 2026-11-15 (snapshot-2026-11-15)

- First release: 96,866 endpoints from 5,827 services, tested 11–15 Nov 2026 (IST), snapshot 15 Nov 2026.
- The repository holds a 1,000-row sample and the services list; the full list is the release download Health_API_Endpoints_AgentPopulation_Snapshot_2026-11-15.csv.gz.
- GitHub name: 96k-health-apis-for-agents (was health-api-endpoints).
- Left out: 11 rows whose URL carried a credential-looking parameter or a login.
- Left out: 6 rows with an email-like address.
- Left out: 934 ArcGIS Survey123 layers (they can hold people's form answers).
- Left out: 3 layers marked editable in the title (they can hold entries that people added).
- Left out: 198 ArcGIS layers that keep a form's default service name (they can hold people's form answers).
- Left out: 1 row that passed a data call only from a network location in India.
- Left out: 4,498 ArcGIS class or coursework layers (lab, assignment, exam, quiz, lesson, exercise, tutorial and final-project layers, copies of class layers, layers named for a person or a person's home, and layers whose name ends in a person's name or holds a student number).
- Left out: 21 ArcGIS layers that hold reports, comments, submissions or form responses sent in by the public.
