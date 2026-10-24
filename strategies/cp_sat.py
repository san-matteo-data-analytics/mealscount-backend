from ortools.sat.python import cp_model

from .base import BaseCEPStrategy, CEPGroup

# ISP at which the 1.6 multiplier saturates; at or above this one group is fully
# funded and nothing can beat it.
FULL_FUNDING_ISP = 1.0 / 1.6

# Free rate resolution inside the model. The app rounds group ISP to 4 places,
# so its free rate is 1.6 * k/10000 = 16k/100000 for a whole k, capped at 1:
# in these units, exactly 16 * k, and the cap (100000) is itself 16 * 6250.
RATE_SCALE = 100000
RATE_STEP = 16


class CPSATCEPStrategy(BaseCEPStrategy):
    '''Time-budgeted exact search with Google OR-Tools' CP-SAT solver.

    Exact proves the optimum but costs O(3^n), so it stops at ~16 schools. Above
    that the heuristics plateau: NYCMODA lands within a few dollars a day of
    itself across seeds, and 4x the restarts buys almost nothing. This instead
    states the whole problem as an integer program and lets CP-SAT search it on
    every core for as long as it is given, which keeps improving where the
    heuristics stop (+$104/day over NYCMODA's best on a 195 school district in
    ten minutes).

    The model is exact, not an approximation. Once a school's group is fixed it
    earns

        A_i + f_g * D_i     (A_i paid-rate dollars, D_i free-minus-paid dollars)

    where f_g = min(1, 1.6 * ISP_g), and a group under the ISP threshold earns
    nothing at all. So per group g: binary x_ig (school i is in g), binary y_g
    (g is eligible), integer f_g; w_ig = f_g when x_ig else 0, which makes the
    rate cap linear in w and x. The app rounds group ISP to 4 places before
    applying 1.6, and that rounding is modelled too -- f_g is forced to a
    multiple of the rate one 0.01% of ISP buys, and the cap allows the half
    step that rounding up grants. Ignoring it left the model a few cents short
    of Exact on some districts. Every grouping is still re-scored by CEPGroup
    before it is reported.

    It warm-starts from the best grouping any strategy that already ran on the
    district produced (run it last), and keeps that grouping if the solver
    cannot beat it -- so adding CPSAT to a run can never make the answer worse.

    It also adds a proven ceiling on any grouping's dollars as a constraint,
    which gives the solver a far tighter bound than the model alone: grouping
    can only redistribute the district's free-rate "credit" (1.6 per identified
    student), so no grouping beats spending all of it on the schools where a
    funded student is worth the most. When the search stops short of proof, the
    reported basis says how far below that ceiling the answer could be.

    Multi-worker CP-SAT is not deterministic under a time limit, so two runs of
    the same district can return slightly different groupings.

    Parameters:
        time_limit  -- seconds to search (default 60)
        workers     -- solver threads (default 0, meaning every core)
        evaluate_by -- "reimbursement" (default) or "coverage"
        max_groups  -- cap on the number of groups (default: one per school)
    '''
    name = "CPSAT"

    #: True only when CP-SAT proved no better grouping exists.
    optimal = False
    optimality_basis = "not run"

    def create_groups(self, district):
        schools = list(district.schools)
        n = len(schools)
        evaluate_by = self.params.get("evaluate_by", "reimbursement")
        if evaluate_by not in ("reimbursement", "coverage"):
            raise ValueError("CPSAT supports evaluate_by of reimbursement or coverage, got %r" % evaluate_by)
        time_limit = float(self.params.get("time_limit", 60))
        workers = int(self.params.get("workers", 0))

        max_groups = self.params.get("max_groups", None)
        if max_groups in (None, "", "None", "null"):
            max_groups = n
        else:
            max_groups = int(max_groups)

        self.optimal = False

        if n == 0:
            self.groups = []
            self.optimality_basis = "no schools"
            return self.groups

        if n == 1:
            self.groups = [CEPGroup(district, schools[0].name, schools, self.isp_threshold)]
            self.optimal = True
            self.optimality_basis = "single school, only one possible grouping"
            return self.groups

        # Same shortcut as Exact, and for the same reason only under reimbursement.
        if evaluate_by == "reimbursement" and district.overall_isp >= FULL_FUNDING_ISP:
            self.groups = [CEPGroup(district, "%s - Consolidated" % district.name, schools, self.isp_threshold)]
            self.optimal = True
            self.optimality_basis = (
                "district ISP of %0.1f%% is at or above 62.5%%, so a single group is "
                "fully funded and cannot be beaten" % (district.overall_isp * 100)
            )
            return self.groups

        K = min(max_groups, n)
        hint = self._best_prior_grouping(district, schools, K, evaluate_by)

        model, x, scale = self._build_model(district, schools, K, evaluate_by, hint)
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = time_limit
        solver.parameters.num_workers = workers
        status = solver.solve(model)

        found = None
        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            members = [[schools[i] for i in range(n) if (i, g) in x and solver.value(x[i, g])]
                       for g in range(K)]
            found = [CEPGroup(district, "CPSAT Group %i" % (k + 1), m, self.isp_threshold)
                     for k, m in enumerate(m for m in members if m)]

        # Keep whichever scores better once re-scored by CEPGroup itself.
        kept_hint = not found or self._score(hint, evaluate_by) > self._score(found, evaluate_by)
        self.groups = hint if kept_hint else found

        self.optimal = status == cp_model.OPTIMAL
        if self.optimal:
            self.optimality_basis = "proven optimal by CP-SAT over every grouping of %i schools" % n
            if K < n:
                self.optimality_basis += " using at most %i groups" % K
        elif evaluate_by == "reimbursement":
            bound = solver.best_objective_bound / scale if found else None
            achieved = self.reimbursement
            if bound and bound > 0:
                self.optimality_basis = (
                    "best found in %0.0fs; no grouping can earn more than %0.2f%% above it"
                    % (solver.wall_time, max(0.0, (bound - achieved) / achieved * 100))
                )
            else:
                self.optimality_basis = "best found in %0.0fs; not proven optimal" % solver.wall_time
        else:
            self.optimality_basis = "best found in %0.0fs; not proven optimal" % solver.wall_time
        if kept_hint:
            self.optimality_basis += " (kept the warm-start grouping, which the solver did not beat)"
        return self.groups

    def _score(self, groups, evaluate_by):
        dollars = sum(g.est_reimbursement() for g in groups)
        if evaluate_by == "coverage":
            return (sum(g.covered_students for g in groups), dollars)
        return (dollars, 0)

    def _best_prior_grouping(self, district, schools, K, evaluate_by):
        '''The best usable grouping from strategies already run on this district,
        rebuilt on our own CEPGroups. Falls back to everyone in one group.'''
        ids = {id(s) for s in schools}
        best = [CEPGroup(district, "CPSAT Group 1", list(schools), self.isp_threshold)]
        for s in getattr(district, "strategies", []):
            if s is self or not s.groups or len(s.groups) > K:
                continue
            members = [list(g.schools) for g in s.groups if g.schools]
            placed = [id(m) for gs in members for m in gs]
            if len(placed) != len(schools) or set(placed) != ids:
                continue  # not a partition of this district's active schools
            groups = [CEPGroup(district, "CPSAT Group %i" % (k + 1), m, self.isp_threshold)
                      for k, m in enumerate(members)]
            if self._score(groups, evaluate_by) > self._score(best, evaluate_by):
                best = groups
        return best

    def _build_model(self, district, schools, K, evaluate_by, hint):
        n = len(schools)
        S = RATE_SCALE
        sfa = district.sfa_certified
        A, D = [], []          # per school, in cents
        for s in schools:
            s.set_rates(district)
            r = s.rates
            paid = s.bfast_served * r.paid_breakfast_rate + s.lunch_served * r.paid_lunch_rate
            if sfa:
                paid += s.lunch_served * 0.07
            A.append(round(paid * 100))
            D.append(round((s.bfast_served * (r.free_breakfast_rate - r.paid_breakfast_rate)
                            + s.lunch_served * (r.free_lunch_rate - r.paid_lunch_rate)) * 100))
        e = [s.total_eligible for s in schools]
        en = [s.total_enrolled for s in schools]
        threshold = round(self.isp_threshold * 10000)

        m = cp_model.CpModel()
        # Groups are interchangeable; letting school i use only groups 0..i
        # removes most of that symmetry without excluding any partition.
        x = {(i, g): m.new_bool_var("x%i_%i" % (i, g)) for i in range(n) for g in range(min(i + 1, K))}
        y = [m.new_bool_var("y%i" % g) for g in range(K)]
        f = [m.new_int_var(0, S, "f%i" % g) for g in range(K)]
        w, v = {}, {}

        for i in range(n):
            m.add_exactly_one(x[i, g] for g in range(K) if (i, g) in x)

        for g in range(K):
            members = [i for i in range(n) if (i, g) in x]
            # f_g = 16 * k_g, k_g being the group ISP in whole 0.01% steps.
            k = m.new_int_var(0, S // RATE_STEP, "k%i" % g)
            m.add(f[g] == RATE_STEP * k)
            m.add(f[g] == 0).only_enforce_if(~y[g])
            # Eligible only if ISP, rounded to 4 places, reaches the threshold:
            # 10000 * E / N >= threshold - 1/2.
            m.add(sum((20000 * e[i] - (2 * threshold - 1) * en[i]) * x[i, g] for i in members)
                  >= 0).only_enforce_if(y[g])
            for i in members:
                w[i, g] = m.new_int_var(0, S, "w%i_%i" % (i, g))
                m.add(w[i, g] == f[g]).only_enforce_if(x[i, g])
                m.add(w[i, g] == 0).only_enforce_if(~x[i, g])
                v[i, g] = m.new_bool_var("v%i_%i" % (i, g))     # in g, and g eligible
                m.add_bool_and([x[i, g], y[g]]).only_enforce_if(v[i, g])
                m.add_bool_or([~x[i, g], ~y[g]]).only_enforce_if(~v[i, g])
            # k_g <= round(10000 * E / N), i.e. k_g * N <= 10000 * E + N / 2;
            # times 16, and with w carrying f_g = 16 * k_g into each member:
            m.add(sum(2 * en[i] * w[i, g] for i in members)
                  <= sum((2 * RATE_STEP * 10000 * e[i] + RATE_STEP * en[i]) * x[i, g] for i in members))

        dollars = sum(A[i] * S * v[i, g] + D[i] * w[i, g] for (i, g) in w)
        if evaluate_by == "coverage":
            # Students in an eligible group first; dollars only break ties.
            weight = (sum(A) + sum(D)) * S + 1
            m.maximize(weight * sum(en[i] * v[i, g] for (i, g) in v) + dollars)
            scale = None
        else:
            m.add(dollars <= self._ceiling(A, D, e, en) * S)
            m.maximize(dollars)
            scale = S * 100.0

        self._add_hint(m, x, y, f, w, v, schools, hint, e, en, threshold)
        return m, x, scale

    def _ceiling(self, A, D, e, en):
        '''Most any grouping can earn, in cents (see the class docstring).

        Summed over groups, the free-rate credit spent, sum_i enrolled_i * f_i,
        is at most 1.6 * total identified students (plus the half step of ISP
        that rounding can add to each group). Relaxing to a funded share per
        school gives a fractional knapsack: fund the highest D_i/enrolled_i
        first. Ignoring the threshold only loosens it, so it stays valid.
        '''
        budget = 1.6 * sum(e) + 1.6 * 0.00005 * sum(en)
        total = float(sum(A))
        for d, size in sorted(zip(D, en), key=lambda t: t[0] / t[1] if t[1] else 0, reverse=True):
            if budget <= 0 or size <= 0:
                continue
            take = min(1.0, budget / size)
            total += d * take
            budget -= size * take
        return int(total) + 1

    def _add_hint(self, m, x, y, f, w, v, schools, hint, e, en, threshold):
        '''A complete warm start, so the solver begins from a known-good grouping.

        Groups are renumbered by their first member, which keeps every school in
        a group index no larger than its own (the symmetry rule above).'''
        index = {id(s): i for i, s in enumerate(schools)}
        members = sorted((sorted(index[id(s)] for s in g.schools) for g in hint), key=lambda ms: ms[0])
        group_of = {i: g for g, ms in enumerate(members) for i in ms}
        for g in range(len(y)):
            ms = members[g] if g < len(members) else []
            E, N = sum(e[i] for i in ms), sum(en[i] for i in ms)
            eligible = bool(ms) and 20000 * E >= (2 * threshold - 1) * N
            steps = (20000 * E + N) // (2 * N) if eligible else 0     # round(10000 * E / N)
            rate = min(RATE_SCALE, RATE_STEP * steps)
            m.add_hint(y[g], eligible)
            m.add_hint(f[g], rate)
            for i in range(len(schools)):
                if (i, g) in x:
                    inside = group_of[i] == g
                    m.add_hint(x[i, g], inside)
                    m.add_hint(w[i, g], rate if inside else 0)
                    m.add_hint(v[i, g], inside and eligible)
