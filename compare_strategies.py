#!/usr/bin/env python
'''Compare grouping strategies against each other on real district data.

The point is to answer "how much better is the new algorithm than the old one",
so every strategy in --strategies is scored on the same districts and reported
as a fraction of the best result anyone found. Where the district is small
enough for Exact to run, that best result is the *provable* optimum and the
fractions are true optimality ratios.

The source CSVs in data/ carry enrollment and eligibility but not meals served,
and reimbursement is driven by meals -- so with no meal columns every strategy
scores zero and the comparison is vacuous. When meals are missing this
synthesizes them from enrollment using the USDA participation estimates in
strategies/base.py. That is a model, not measured data: --jitter varies
participation per school, and results are sensitive to it, because a school
whose meal counts do not track its enrollment is exactly the case that breaks
the contiguity assumption IntervalDP relies on. Pass --jitter 0.3 or so for a
realistic read, and use your own meal data when you have it.

Example:

    $> python compare_strategies.py data/ca/latest.csv --min-schools 11 --max-schools 16
    $> python compare_strategies.py data/ca/latest.csv --min-schools 17 --max-schools 60 \
           --strategies IntervalDP --strategies NYCMODA --strategies Binning
'''
import csv
import random
import time
from collections import defaultdict

import click
import tabulate

from strategies import STRATEGIES
from strategies.base import (CEPSchool, CEPDistrict, DEFAULT_ISP_THRESHOLD,
                             BREAKFAST_EST_PARTICIPATION, LUNCH_EST_PARTICIPATION)

DEFAULT_STRATEGIES = ("OneToOne","OneGroup","Binning","Spread","Pairs",
                      "IntervalDP","NYCMODA","Exact")


def _pct(value):
    value = (value or "").strip().rstrip("%")
    try:
        return float(value) / 100.0
    except ValueError:
        return None


def build_districts(reader,state,jitter,rnd):
    '''Group CSV rows into districts, filling in what the source data omits.'''
    rows = defaultdict(list)
    for row in reader:
        code = row.get("District Code",row.get("district_code","1"))
        name = row.get("District Name",row.get("district_name","Default"))
        rows[(code,name)].append(row)

    districts,skipped = [],0
    for (code,name),group in rows.items():
        district = CEPDistrict(name,code,state=state)
        incomplete = False
        for row in group:
            enrolled = int(float(row.get("total_enrolled") or 0))
            if enrolled == 0:
                continue

            eligible = (row.get("total_eligible") or "").strip()
            if eligible:
                eligible = min(int(float(eligible)),enrolled)
            else:
                # Fall back to whichever ISP column the export carries.
                isp = _pct(row.get("individual_isp")) or _pct(row.get("claiming_isp"))
                if isp is None:
                    incomplete = True
                    break
                eligible = min(int(round(isp * enrolled)),enrolled)

            bfast = (row.get("daily_breakfast_served") or "").strip()
            lunch = (row.get("daily_lunch_served") or "").strip()
            if not (bfast and lunch):
                # No measured meals: model them off enrollment. See module docstring.
                wobble = lambda: rnd.uniform(1 - jitter,1 + jitter) if jitter else 1.0
                bfast = round(enrolled * BREAKFAST_EST_PARTICIPATION[0] * wobble())
                lunch = round(enrolled * LUNCH_EST_PARTICIPATION[0] * wobble())

            district.add_school(CEPSchool({
                "school_name": row.get("School Name",row.get("school_name")),
                "school_code": row.get("School Code") or row.get("School Name"),
                "total_enrolled": enrolled,
                "total_eligible": eligible,
                "daily_breakfast_served": bfast,
                "daily_lunch_served": lunch,
            }))
        if incomplete:
            skipped += 1
            continue
        if district.schools:
            districts.append(district)
    return districts,skipped


@click.command()
@click.argument("csv_file",nargs=1)
@click.option("--strategies","strategy_names",multiple=True,default=DEFAULT_STRATEGIES,
              help="Strategy to include; repeat the flag. Accepts Name?param=value.")
@click.option("--min-schools",default=2,type=int,help="Skip districts smaller than this")
@click.option("--max-schools",default=16,type=int,help="Skip districts larger than this")
@click.option("--limit",default=25,type=int,help="Stop after this many districts")
@click.option("--jitter",default=0.3,type=float,
              help="Per-school variation in modelled participation (0 = tracks enrollment exactly)")
@click.option("--seed",default=1234,type=int,help="Seed for the participation model")
@click.option("--state",default="ca",help="State code, sets reimbursement rates")
@click.option("--isp-threshold",default=DEFAULT_ISP_THRESHOLD,type=float)
@click.option("--per-district",is_flag=True,default=False,help="Show every district, not just the summary")
def cli(csv_file,strategy_names,min_schools,max_schools,limit,jitter,seed,state,
        isp_threshold,per_district):
    '''Score every strategy on the same districts and report the spread.'''
    rnd = random.Random(seed)
    with open(csv_file) as handle:
        districts,skipped = build_districts(csv.DictReader(handle),state,jitter,rnd)

    districts = [d for d in districts if min_schools <= len(d.schools) <= max_schools]
    districts.sort(key=lambda d: d.code)
    districts = districts[:limit]
    if not districts:
        raise click.ClickException("No districts matched. Try widening --min-schools/--max-schools.")

    ratios = defaultdict(list)
    elapsed = defaultdict(float)
    rows = []
    scored = 0

    for district in districts:
        results,failures = {},{}
        for spec in strategy_names:
            name = spec.split("?")[0]
            if name not in STRATEGIES:
                raise click.ClickException("Unknown strategy %r. Known: %s"
                                           % (name,", ".join(sorted(STRATEGIES))))
            from cep_estimatory import parse_strategy
            Klass,params,_ = parse_strategy(spec)
            strategy = Klass(params,spec,isp_threshold=isp_threshold)
            start = time.time()
            try:
                strategy.create_groups(district)
            except Exception as error:      # a strategy that blows up should not stop the run
                failures[spec] = str(error)[:60]
                elapsed[spec] += time.time() - start
                continue
            elapsed[spec] += time.time() - start
            # groups of None means the strategy declined to answer (e.g. Exact
            # above its size limit); that is not the same as scoring zero.
            results[spec] = strategy.reimbursement if strategy.groups else None

        scores = [v for v in results.values() if v is not None]
        if not scores or max(scores) <= 0:
            continue
        best = max(scores)
        scored += 1

        for spec,value in results.items():
            if value is not None:
                ratios[spec].append(value / best)
        rows.append([district.name[:34],len(district.schools),"$%0.0f" % best] +
                    ["--" if results.get(s) is None else "%0.3f" % (results[s] / best)
                     for s in strategy_names])
        for spec,message in failures.items():
            click.echo("  ! %s failed on %s: %s" % (spec,district.name[:30],message))

    if per_district:
        click.echo(tabulate.tabulate(
            rows,headers=["district","n","best"] + [s.split("?")[0] for s in strategy_names]))
        click.echo("")

    proven = "Exact" in [s.split("?")[0] for s in strategy_names] and max_schools <= 16
    summary = []
    for spec in strategy_names:
        values = ratios[spec]
        if not values:
            summary.append([spec.split("?")[0],0,"--","--","--","%0.2fs" % elapsed[spec]])
            continue
        summary.append([
            spec.split("?")[0],
            len(values),
            "%0.4f" % (sum(values) / len(values)),
            "%0.4f" % min(values),
            "%i/%i" % (sum(1 for v in values if v > 0.9999),len(values)),
            "%0.2fs" % elapsed[spec],
        ])
    summary.sort(key=lambda r: r[2],reverse=True)

    click.echo("districts scored: %i (%i skipped for missing ISP data)" % (scored,skipped))
    click.echo("participation model: %s jitter" % (jitter and ("+/-%0.0f%%" % (jitter*100)) or "none"))
    click.echo(tabulate.tabulate(
        summary,
        headers=["strategy","scored","mean","worst",
                 proven and "hit optimum" or "tied best","total time"]))
    if not proven:
        click.echo("\nNote: no strategy here proves optimality, so ratios are against the "
                   "best result found, not a known optimum. The true optimum may be higher.")


if __name__ == "__main__":
    cli()
