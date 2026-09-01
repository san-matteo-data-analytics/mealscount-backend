# MealsCount Frontend (Next.js + Material UI)

A front end for the MealsCount CEP optimizer. The Python code in `strategies/` is the system; this
app is a lens over it.

**`/` is the optimizer** — upload a district's schools as CSV or Excel, set the district options, run
it, and read the recommended grouping. It posts to the same `POST /api/districts/optimize/` endpoint
as production; nothing here is mocked.

**`/reference/*` is background reading**, deliberately subordinate to the tool:

| Route | Answers |
| --- | --- |
| `/reference/how-it-works` | Why grouping is worth optimizing at all |
| `/reference/inputs` | Every field you supply, and the rows the API drops silently |
| `/reference/outputs` | The response shape, annotated, in the order to read it |
| `/reference/strategies` | What each of the eight algorithms does and when it wins |

## Uploading schools

The optimizer starts empty. You can:

- **Upload** a `.csv`, `.xlsx` or `.xls` file (drag and drop works).
- **Download a template** — a worked example district, in either format, to fill in or edit.
- **Enter schools by hand** in the table.

Headers are matched case- and punctuation-insensitively against a list of aliases, so `School Code`,
`school_code` and `School ID` all resolve to the same field. If `total_eligible` is missing but
`direct_cert` is present, `direct_cert` is used — the same fallback `CEPSchool` applies in Python.

Rows the API would drop without comment — no school code, or zero enrollment — are **listed back to
you** with their spreadsheet row numbers instead of vanishing. That silent drop is the most common
source of "why is my school missing".

## Running it

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

By default the app proxies `/api/*` to a Flask server on `http://127.0.0.1:5000`. Start that from the
repo root:

```bash
venv/bin/python server.py
```

> On macOS, port 5000 is also claimed by the AirPlay Receiver. If Flask reports
> `Address already in use`, either disable AirPlay Receiver in System Settings → General → AirDrop &
> Handoff, or run Flask on another port and set `MEALSCOUNT_API_ORIGIN` to match.

To work on the UI without running Python at all, point at production:

```bash
MEALSCOUNT_API_ORIGIN=https://www.mealscount.com npm run dev
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload on :3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |

## Layout

```
src/
  app/
    page.tsx                        The optimizer — upload, edit, run, read results
    reference/how-it-works/page.tsx The pipeline and the ISP formula
    reference/inputs/page.tsx       Input field reference
    reference/outputs/page.tsx      Output field reference
    reference/strategies/page.tsx   The eight algorithms
  components/           AppShell, SchoolImport, SchoolEditor, SettingsPanel, ResultsView, IspExplorer, …
  lib/
    types.ts            Mirrors server.py / strategies/base.py
    cep.ts              The CEP arithmetic, ported for live client-side display
    schoolFile.ts       CSV/XLSX import (alias matching, skip reporting) and export
    content.ts          Strategy catalogue and field dictionaries
    sample.ts           The example district behind the downloadable template
    api.ts              Fetch wrapper for the optimize endpoint
```

## Keeping it in sync with Python

Two files intentionally duplicate logic from the backend and will drift if the Python changes:

- `src/lib/cep.ts` mirrors `isp_to_free_rate` and the `CEPRate` rate table in `strategies/base.py`.
  It exists so the ISP explainer can show the formula updating live without a round trip. It is not
  used to compute any displayed result — every number in the results view comes from the API.
- `src/lib/types.ts` mirrors the request and response shapes of `server.py`.

If the USDA rates or the ISP threshold change in `strategies/base.py`, update `cep.ts` to match.

## The sample district

`src/lib/sample.ts` is hand-built, not real data. It is not pre-filled into the table; it is what the
**Download a template** button produces. It is shaped so the value of grouping is visible in one
screen: three schools sit above 62.5% ISP with surplus to spare, and two sit under the 25% threshold
and earn nothing on their own. Optimizing lifts every student into a funded group.

## A note on the `xlsx` dependency

SheetJS is installed from the vendor's own CDN (`https://cdn.sheetjs.com/xlsx-0.20.3/...`) rather than
from npm. The npm registry copy is stuck at 0.18.5, which carries unpatched prototype-pollution and
ReDoS advisories; 0.20.3 fixes both. This is SheetJS's documented install method. If you re-resolve
the lockfile, keep the CDN URL — do not let it fall back to `xlsx@0.18.5`.
