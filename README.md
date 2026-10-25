# MealsCount
MealsCount is a tool created by [Open San Diego](https://opensandiego.org) in partnership with [Nourish CA](https://nourishca.org) (formerly CFPA) and the [San Diego Hunger Coalition](https://www.sandiegohungercoalition.org), to help school districts maximize their reimbursements when participating in the [USDA's Community Eligibility Provision (CEP](https://www.fns.usda.gov/school-meals/community-eligibility-provision).

# What is the Community Eligibility Provision?
The USDA's Community Eligibility Provision (CEP) is a program whereby the federal government provides free and reduced cost meals *without filling out any paperwork*. This eliminates the burden on families in applying, as well as the stigma of students receiving food aid. Hungry students don't learn, so ensuring every student gets the nutrition they need increases the effectiveness of our education system.

# Why MealsCount?
Within the CEP, there is flexibilty for districts who participate in how they group the schools in their district to meet the qualifying criteria. Whether or not schools within a district get the reimbursements from the USDA is based upon how many "identified students" are in their group. This "Identified Student Percentage" (ISP), mutliplied by a factor (ISP X 1.6) must be above 62.5% for full funding, or exceed 40% for partial funding. Any percentage *over* 62.5% is irrelevant. This is where MealsCount comes in. Because you can group schools into any arbitrary grouping, you have the opportunity to take the highest poverty schools who have a high ISP, e.g. 85% (or lots of disadvantaged students, e.g. students already receiving aid, migrant students, homeless and foster students), and bundle them with a middle-level ISP school, e.g. 55%, and potentially have both over 62.5% and get free funding!

For a small district of 3 to 4 schools, this is trivial to do by hand. However for districts with 10 or more schools, we need to use an algorithm to optimize. Add to this that funding is dependant on the number of meals actually served, not the overall enrolled students, and we add mopre complexity. MealsCount provides a tool to run optimization strategies and bundle schools together and maximize reimbursements and free meals. The results of optimization are potentially incredible, with in Calfornia alone the possibility of adding *hundreds of thousand of free meals* to kids over not-optimizing! 

# The Details
We are still in the process of understanding how to best to deliver and facilitate this program. Our "client" is the Nutrition Director and/or CFO of a school district, and our partners are the food policty experts and advocates who can help us navigate various policy details in how best to utilize CEP for any given district in any given state. We are looking for MealsCount to be a tool that brigades can leverage the facilitate districts in maximizing their potential reimbursements via CEP.


# MealsCount Anatomy

The current iteration of MealsCount is centered on the "main" branch (where you are now), and centered on the python classes in the module "strategies", as well as a web frontend for browsing.

The python toolset can either be run from the example Jupyter notebook, the command line tool "cep_estimatory.py" script, or via a REST API from the server.py flask app.

The web frontend is a Next.js + Material UI app in `frontend/` that talks to the server.py API (see `frontend/README.md`). The original Vue.js frontend still lives in the repo root (`src/`, `webpack.config.js`, the root `package.json`) but is no longer the one used for local development -- see [Legacy setup](#legacy-setup-vue-frontend-and-docker).

The original web app is deployed to https://www.mealscount.com/ (hosted by Heroku).

The cep_estimatory.py script will take in as an argument a specially formatted CSV file, and paramteres defining different optimization strategies, and output a JSON file as well as a data table that describes the results of the optimization per district. 

# Running Locally

The app is two processes: the Flask API (`server.py`) and the Next.js frontend
(`frontend/`). The frontend proxies every `/api/*` request to Flask, so you open
only the frontend in your browser.

## Prerequisites

* **Python 3.12** (the version pinned in `.python-version`)
* **Node.js 20 or newer** with npm (tested on Node 22)

## 1. One-time setup

From the repo root:

```bash
# Python API
python3.12 -m venv venv
venv/bin/pip install -r requirements.txt

# Next.js frontend
cd frontend
npm install
cd ..
```

## 2. Start the API

From the repo root:

```bash
venv/bin/flask --app server run --port 5001
```

Port 5001 rather than Flask's default 5000 because on macOS the AirPlay Receiver
already listens on 5000, and Flask fails with `Address already in use`. (You can
use 5000 if you turn AirPlay Receiver off in System Settings > General > AirDrop
& Handoff, and then skip `MEALSCOUNT_API_ORIGIN` below.)

Flask does not serve a page at `/` in this setup -- that route belongs to the
legacy Vue build and returns a 500. Use the API paths, e.g.
<http://127.0.0.1:5001/api/states/>, to check it is up.

## 3. Start the frontend

In a second terminal:

```bash
cd frontend
MEALSCOUNT_API_ORIGIN=http://127.0.0.1:5001 npm run dev
```

Then open <http://localhost:3000>. The frontend hot-reloads as you edit; restart
Flask after Python changes.

To work on the UI without running Python at all, point the frontend at
production instead:

```bash
MEALSCOUNT_API_ORIGIN=https://www.mealscount.com npm run dev
```

## 4. Check it works

Upload a district file on the home page and run the optimizer, or download the
template from the upload panel to get a worked example. Optimizing a district
with more than 16 schools runs the slower heuristic strategies; ~100-200
schools takes a minute or two.

The checks below also run without the browser:

```bash
venv/bin/python -m pytest test_server.py   # API tests
cd frontend && npm run typecheck           # frontend types
```

## Algorithm development (Jupyter)

If you are interested in exploring / experimenting / building on the algorithms,
install the notebook tooling into the same virtual environment and open
"CEP Estimator.ipynb":

```bash
venv/bin/pip install -r jupyter_requirements.txt
venv/bin/jupyter notebook
```

# Comparing Optimization Strategies

The grouping strategies live in `strategies/` and are registered in
`strategies/__init__.py`. Every strategy that has ever shipped is still
registered, so a new approach can be measured against the ones it is meant to
replace rather than quietly swapped in for them.

`compare_strategies.py` scores a set of strategies on the same districts and
reports each as a fraction of the best result anyone found:

    $> python compare_strategies.py data/ca/latest.csv --min-schools 11 --max-schools 16

Below 17 schools the `Exact` strategy proves the optimum, so those fractions are
true optimality ratios. Above that, no strategy here can prove optimality and the
fractions are only relative to the best result found.

One caveat worth understanding before trusting the output: reimbursement is
driven by *meals served*, and the CSVs in `data/` carry enrollment and
eligibility but no meal counts. When meal columns are absent the tool models them
from enrollment using the USDA participation estimates in `strategies/base.py`.
That is a model, not measurement. `--jitter` controls how much per-school
variation it introduces, and the ranking is genuinely sensitive to it, because a
school whose meals do not track its size is exactly the case that breaks the
assumption `IntervalDP` relies on. Use your own meal data where you have it.

# Legacy Setup (Vue frontend and Docker)

These instructions predate the Next.js frontend. They build the original Vue.js
app in the repo root with webpack 4, which pins Node 14, and the Dockerfile uses
Python 3.7. They have not been verified against the current code; prefer
[Running Locally](#running-locally) above.

The Vue app alone, proxying data to https://www.mealscount.com/:

    $> npm install . 
    $> npm run start

The Vue app plus the Flask server (which then serves the built app at `/`):

    $> npm install .
    $> pip install -r requirements.txt
    $> npm run local_dev

## Docker

To use the Dockerfile version, you can do the following (presuming you have [Docker](https://docker.com/) installed):

    $> docker-compose build
    $> docker-compose up

This should make Meals Count available on *http://localhost:5000*

You can also run custom optimizations via the command line with:

    $> docker-compose run app python cep_estimatory.py <csv_file in data folder> <strategies..> <options>

Please see the *cep_estimatory.py* --help for more information on how to run custom runs.

It is also possible to run a jupyter notebook through the Docker container, but takes a few extra steps:

    $> docker-compose run -p 8888:8888 app bash
    $(container)> pip install -r jupyter_requirements.txt
    $(container)> jupyter notebook --no-browser --allow-root --ip 0.0.0.0

Use the url printed by the console, e.g. *http://127.0.0.1:8888/?token=XXXXXXX...* to connect.

# Optimization Strategies

Strategies live in the `strategies/` module and are registered in `strategies/__init__.py`.
Most are heuristics; one is exact.

## Exact (`strategies/exact.py`)

`Exact` returns a **provably optimal** grouping for districts up to 16 schools. Rather than
enumerating every set partition the way `Exhaustive` does, it uses dynamic programming over
subsets:

    dp[S] = max over subsets T of S containing S's lowest member:
                value(T) + dp[S - T]

That is O(3^n) instead of Bell(n) partitions -- 43 million steps at 16 schools where
enumeration would need 10.5 billion. Measured against `Exhaustive` on identical districts it
returns the same answer:

| schools | Exhaustive | Exact   | speedup |
| ------- | ---------- | ------- | ------- |
| 8       | 0.041s     | 0.002s  | 22x     |
| 10      | 1.386s     | 0.012s  | 115x    |
| 13      | --         | 0.282s  | (Exhaustive cannot run) |
| 16      | --         | 8.6s    | (Exhaustive cannot run) |

Two shortcuts skip the search entirely:

* A district already at or above **62.5% ISP** is fully funded as a single group, which is the
  absolute ceiling, so `OneGroup` is optimal by construction.
* A one-school district has only one possible grouping.

When `Exact` runs, the API skips `NYCMODA` and `GreedyLP` -- they cannot beat a proven optimum,
and skipping them makes 12-16 school districts *faster* than before, not slower (a 12-school
district went from ~20s to ~0.1s end to end).

The response reports the proof:

    "best_is_optimal": true,
    "optimality_basis": "proven optimal over all partitions of 12 schools"

Set `EXACT_MAX_SCHOOLS` to change the ceiling (default 16). Cost grows ~3x per school, so
raise it with care. Above the ceiling `Exact` declines rather than guessing, and the response
falls back to the heuristics with `best_is_optimal: false`.

Parameters: `max_schools`, `evaluate_by` (`reimbursement` or `coverage`), `max_groups`.

## IntervalDP (`strategies/interval_dp.py`)

`IntervalDP` sorts the schools by ISP and finds the best set of cuts along that
line, so every group is a run of adjacent schools:

    dp[i] = max over j > i of  value(schools[i:j]) + dp[j]

That is O(n^2) rather than O(3^n), so it answers where `Exact` declines: San Diego
Unified (194 schools) takes **0.06s**. It is provably optimal *within* the
contiguous class, which is not the same as optimal -- it says so in
`optimality_basis`, and `optimal` stays false above the 62.5% shortcut.

It is **not** part of the default strategy set, because measuring it honestly did
not justify auto-running it:

| districts | IntervalDP vs best-found | improved the returned answer |
| --------- | ------------------------ | ---------------------------- |
| 11-16 schools | 0.981 mean | -- (`Exact` proves the optimum here) |
| 17-60 schools | 0.977 mean | **0 of 12** |
| 61+ schools   | 0.994 on the one district measured | **0 of 1** |

On every district tested, `NYCMODA` or `GreedyLP` already reached a grouping at
least as good, so adding `IntervalDP` to the ensemble would cost a strategy card
and payload for no gain. What it does buy is speed: ~98% of the ensemble result
in ~0.00s where the ensemble itself takes 10s or more. That makes it a candidate
*fallback* if very large districts ever need a time budget -- a separate decision
from the default set, and not one this change makes.

Its accuracy depends on meal counts tracking enrollment, because that is what
makes a group's value monotone in ISP order. Measured against `Exact` on
synthetic districts:

| meal counts | IntervalDP mean | worst |
| ----------- | --------------- | ----- |
| exactly proportional to enrollment | 0.997 | 0.888 |
| +/-30% per-school variation | 0.991 | 0.832 |
| drawn independently of enrollment | 0.960 | 0.262 |

Parameters: `evaluate_by` (`reimbursement` or `coverage`), `max_groups`,
`max_block` (caps block width to bound run time; 0 means unlimited below 120
schools).

## CPSAT (`strategies/cp_sat.py`)

`CPSAT` states the grouping problem exactly as an integer program and searches
it with Google OR-Tools' CP-SAT solver (already a dependency), on every core,
for a time budget you choose. It is for districts above `Exact`'s 16 school
ceiling, where the heuristics have stopped improving: across five seeds
`NYCMODA` landed within $24/day of itself on a 195 school district, and 4x the
restarts added $10/day.

| 195 school district (modelled meal counts) | $/day |
| ------------------------------------------ | ----- |
| `OneGroup` / `GreedyLP` | 137,349 |
| `NYCMODA`, best of five seeds | 138,395 |
| `CPSAT`, 5 minutes, warm-started from the default set | 138,508 |
| `Genetic`, under 90 seconds, best of three seeds | **138,551** |
| Ceiling: no grouping can earn more | 144,700 |

`Genetic` (below) has since beaten `CPSAT` on this district and on every real
district measured, in a fraction of the time. What `CPSAT` still offers is
proof: on districts it can finish, it is the only strategy above 16 schools
that can certify an answer is optimal, and it bounds the gap when it cannot.

That is roughly +$20,000 a year for this district -- real, but a fraction of a
percent. The reason the gains are small is structural: when meals track
enrollment, merging two groups that both sit between the 25% floor and 62.5% is
neutral, so grouping only earns money by spending surplus above 62.5%, lifting
schools over the floor, and steering schools with high meals-per-student into
the higher-ISP groups.

How it behaves:

* **It never makes the answer worse.** It warm-starts from the best grouping
  any strategy that already ran on the district produced (so list it *last*),
  and keeps that grouping if the solver cannot beat it.
* **It only claims optimality when it proves it.** Matched against `Exact` it
  agrees on every district tested (150 random, 8 real California). When time
  runs out first, `optimality_basis` says how far below the proven ceiling the
  answer could be. That ceiling is loose, so the true gap is usually far
  smaller than the figure reported.
* **It models the app's arithmetic exactly**, including rounding group ISP to 4
  places, and every grouping is re-scored by `CEPGroup` before it is reported.
* **It is not deterministic.** Multi-threaded CP-SAT under a time limit can
  return a slightly different grouping on each run.

It is off by default. The optimizer page has an **Extended search** checkbox
(unchecked by default); checking it reveals a minutes field (default 9, whole
minutes from 9 to 30). The request carries `extended_search: true` and
`extended_search_minutes`, and above 16 schools the API runs `CPSAT` last,
after `Genetic`, for that long. The server clamps the minutes to the same range
(`EXTENDED_SEARCH_MINUTES_MIN`/`_MAX` in `server.py`), so a hand-written request
cannot ask for more.

Runs past 10 minutes depend on the streaming endpoint: the frontend proxy's
timeout is an idle timeout, which the stream's 5 second heartbeats reset, but
the blocking `/optimize/` fallback sends nothing until it finishes and will be
cut off. A deployed server also needs its worker timeout (gunicorn defaults to
30s) raised to cover the longest run. For longer runs, use the command line:

    $> python compare_strategies.py data/ca/latest.csv --min-schools 17 --max-schools 60 \
           --strategies NYCMODA --strategies "CPSAT?time_limit=600"

Parameters: `time_limit` (seconds, default 60), `workers` (default 0 = every
core), `evaluate_by` (`reimbursement` or `coverage`), `max_groups`.

## Genetic (`strategies/genetic.py`)

`Genetic` is a grouping genetic algorithm with local search. Each individual is
a whole partition of the district. Crossover works on groups, not schools
(after Falkenauer's grouping GA): a child inherits a random subset of one
parent's groups intact and the other parent's groups supply the remaining
schools, since group 3 in one parent has nothing to do with group 3 in the
other. Mutations merge two groups, split one, or scatter a few schools. Every
child is then hill-climbed with two moves, scored incrementally in O(1):

* move one school to another group;
* **swap** two schools between groups.

The swap is what makes it work. In a low-ISP district all the money sits in one
group just above the 25% floor; removing any school drops it below and adding a
weaker one gains nothing, so single moves are stuck. Trading a member for a
better school outside is not. Without swaps it stalled at 76% of the best
result on Antelope Valley Union (district ISP 12.5%), as `NYCMODA` does; with
them it reaches 100%. A regression test pins this down.

Measured on the 15 real California districts of 17-60 schools that
`compare_strategies.py` selects (meal counts modelled, +/-30% jitter), with
`NYCMODA` at the server's own settings:

| strategy | mean vs best found | worst | tied best | total time |
| -------- | ------------------ | ----- | --------- | ---------- |
| `Genetic` | **1.0000** | **1.0000** | **15/15** | **15s** |
| `CPSAT` (60s per district) | 0.9998 | 0.9987 | 10/15 | 549s |
| `NYCMODA` (50 starts x 1000) | 0.9677 | 0.7566 | 3/15 | 129s |

Read that with the usual caveat: above 16 schools nothing here proves the
optimum, so these are ratios to the best result anyone found. Against `Exact`
on small districts it never exceeds the proven optimum, matches it on nearly
all of them, and on the deliberately hard near-threshold case still falls short
on about 1 in 10.

It warm-starts from the best grouping strategies that already ran produced (so
list it after them), keeps the best individual every generation, and so never
returns less than that start. With a fixed seed it is deterministic, unless
`time_limit` cuts the run short.

It is in the default strategy set for districts above 16 schools, running last
so it warm-starts from everything else. `NYCMODA` still runs too, so the
results keep showing what the old workhorse found alongside it.

Parameters: `population` (default 40), `generations` (200), `patience` (stop
after this many generations without improvement, 40), `time_limit` (seconds,
120), `seed` (42), `evaluate_by` (`reimbursement` or `coverage`), `max_groups`.

## How much do the heuristics actually miss?

Measured against `Exact` on real California districts (meals-served figures estimated, since
the CA feed does not carry them), the heuristic ensemble is close to optimal almost everywhere.
The gap concentrates in districts sitting just above the 25% eligibility floor:

| district ISP (median) | ensemble = optimal | mean gap | worst district |
| --------------------- | ------------------ | -------- | -------------- |
| 25%                   | 60%                | 0.00%    | 0.03%          |
| **30%**               | 11%                | **0.06%**| **3.04%**      |
| 47%                   | 11%                | 0.00%    | 0.01%          |
| 81%                   | 93%                | 0.00%    | 0.01%          |

The practical consequence: the value of `Exact` is mostly *certainty* (and speed), not finding
dramatically better groupings. That headroom is for districts of 16 schools or fewer, where the
ensemble includes `Exact`. Above 16 schools there is more: `NYCMODA` averaged 96.8% of the best
grouping found on 17-60 school districts and fell to 76% on one near the eligibility threshold,
which is the gap `Genetic` closes (see above).

# Adding other state data

If you have access to data for other states (aside from California), you can add them to the "data" folder under your state code. There is a README.md referenced in that folder that indicates what your data csv (named latest.csv) should contain.

# Contributing

Please see the Issues for how to help, and contact the [Open San Diego Team on Slack](https://opensandiego.org) on the *#mealscount* channel if you are interested in helping or exploring facilitating school districts in your state in optimizing their CEP reimbursements!

# Additional Resources

* https://cfpa.net/ChildNutrition/ChildNutrition_CFPAPublications/CFPA-CEPLCFFWebinar-2018.pdf
* https://cfpa.net/ChildNutrition/ChildNutrition_Legislation/LCFF-CEP-Factsheet-2014.pdf
* https://www.fns.usda.gov/nslp/community-eligibility-provision-resource-center
* https://www.cde.ca.gov/ds/sd/sd/filescupc.asp  - The CALPADS data file (UPC) used for initial development

# Statewide UI

Experimental

Package for Windows with:
```
virtulenv venv
venv\Scripts\activate
pip install -r requirements.txt
pip install pyinstaller
pyinstaller.exe mealscount-bulk-optimize.spec
mv dist\mealscount-bulk-optimize.exe C:\where\you\want\it\
```
