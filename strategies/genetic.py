import itertools
import random
import time

import numpy as np
from numba import njit

from .base import BaseCEPStrategy, CEPGroup, isp_to_free_rate

# ISP at which the 1.6 multiplier saturates; at or above this one group is fully
# funded and nothing can beat it.
FULL_FUNDING_ISP = 1.0 / 1.6


@njit(cache=True)
def _float_above(E, N):
    '''Sign of fl(E / N) - E / N, exactly: is the double Python would round
    above, on, or below the true fraction? Dekker's product gives d * N with
    its rounding error, and d * N - E then follows without loss.'''
    d = E / N
    b = float(N)
    p = d * b
    c = 134217729.0 * d
    dh = c - (c - d)
    dl = d - dh
    c = 134217729.0 * b
    bh = c - (c - b)
    bl = b - bh
    err = ((dh * bh - p) + dh * bl + dl * bh) + dl * bl
    s = (p - E) + err
    return 1 if s > 0 else (-1 if s < 0 else 0)


@njit(cache=True)
def _value(E, N, A, D, threshold, weight):
    '''A group's value, compiled for _polish_kernel. It inlines
    isp_to_free_rate, and a test pins it to _group_value's answers.

    round(E / N, 4) is done in integers, because Numba's float round can
    differ from Python's at the fourth decimal. Python rounds the double
    nearest E / N, which for whole-number counts always rounds the same way as
    the exact fraction -- except when the fraction sits exactly on a midpoint
    (5181 / 20000 = 0.25905). Then the double is a hair above, below or on it,
    and that decides: up, down, or half to even.'''
    if N <= 0:
        return 0.0
    q = (E * 10000) // N
    twice = 2 * ((E * 10000) % N)
    if twice > N:
        q += 1
    elif twice == N:
        side = _float_above(E, N)
        if side > 0 or (side == 0 and q % 2 == 1):
            q += 1
    isp = q / 10000.0
    free_rate = isp * 1.6
    if free_rate > 1:
        free_rate = 1.0
    elif isp < threshold:
        return 0.0
    if free_rate == 0:
        return 0.0      # not CEP eligible: earns nothing
    return weight * N + A + free_rate * D


@njit(cache=True)
def _polish_kernel(labels, K, e, en, A, D, threshold, weight, seed):
    '''The hill climb behind GeneticCEPStrategy._polish, compiled. Changes
    labels in place and returns the grouping's total value.'''
    np.random.seed(seed)
    n = labels.shape[0]
    TE = np.zeros(K, np.int64)
    TN = np.zeros(K, np.int64)
    TA = np.zeros(K)
    TD = np.zeros(K)
    for i in range(n):
        g = labels[i]
        TE[g] += e[i]; TN[g] += en[i]; TA[g] += A[i]; TD[g] += D[i]
    val = np.empty(K)
    for g in range(K):
        val[g] = _value(TE[g], TN[g], TA[g], TD[g], threshold, weight)
    failures, limit = 0, 3 * n
    while failures < limit:
        i = int(np.random.random() * n)
        src = labels[i]
        if np.random.random() < 0.5:
            j = -1
            dst = int(np.random.random() * K)
        else:
            j = int(np.random.random() * n)
            dst = labels[j]
        if src == dst:
            failures += 1
            continue
        # Net change in each group's totals: i leaves src for dst, and on a
        # swap j makes the reverse trip.
        if j < 0:
            de, dn, da, dd = e[i], en[i], A[i], D[i]
        else:
            de, dn, da, dd = e[i] - e[j], en[i] - en[j], A[i] - A[j], D[i] - D[j]
        new_src = _value(TE[src] - de, TN[src] - dn, TA[src] - da, TD[src] - dd, threshold, weight)
        new_dst = _value(TE[dst] + de, TN[dst] + dn, TA[dst] + da, TD[dst] + dd, threshold, weight)
        if new_src + new_dst > val[src] + val[dst] + 1e-9:
            TE[src] -= de; TN[src] -= dn; TA[src] -= da; TD[src] -= dd
            TE[dst] += de; TN[dst] += dn; TA[dst] += da; TD[dst] += dd
            val[src] = new_src
            val[dst] = new_dst
            labels[i] = dst
            if j >= 0:
                labels[j] = src
            failures = 0
        else:
            failures += 1
    return val.sum()


class GeneticCEPStrategy(BaseCEPStrategy):
    '''A grouping genetic algorithm with local search (a "memetic" GA).

    An individual is a partition of the district's schools into at most
    max_groups groups, stored as one group label per school. Plain label-wise
    crossover is meaningless for partitions -- group 3 in one parent has nothing
    to do with group 3 in the other -- so crossover works on whole groups, after
    Falkenauer's grouping GA: the child inherits a random subset of one parent's
    groups intact, and the other parent's groups supply the remaining schools.
    Every child is then polished by hill climbing (move one school to another
    group, keep it if the total improves), which is what makes a GA competitive
    on this kind of problem rather than a slow random search.

    Scoring is incremental: each group keeps running totals, and a group's value
    is A_g + f_g * D_g with f_g from the same rounded ISP and isp_to_free_rate
    that CEPGroup uses, so a move costs O(1) to evaluate. The hill climb, which
    is nearly all of the run time, is compiled with Numba. The final grouping
    is re-scored by CEPGroup itself before it is reported.

    The population is seeded with the best grouping any strategy that already
    ran on the district produced (so run it after them), and the best
    individual always survives to the next generation, so it can never return
    less than that warm start. With a fixed seed it is deterministic, as long as
    time_limit does not cut the run short.

    Parameters:
        population   -- individuals per generation (default 40)
        generations  -- most generations to run (default 200; 0 = no limit)
        patience     -- stop after this many generations without improvement
                        (default 40; 0 = never, so only time_limit stops it)
        time_limit   -- seconds, a safety stop (default 120)
        seed         -- random seed (default 42)
        evaluate_by  -- "reimbursement" (default) or "coverage"
        max_groups   -- cap on the number of groups (default: one per school)
    '''
    name = "Genetic"

    #: A GA proves nothing; only the trivial shortcuts below are optimal.
    optimal = False
    optimality_basis = "not run"

    def create_groups(self, district):
        schools = list(district.schools)
        n = len(schools)
        evaluate_by = self.params.get("evaluate_by", "reimbursement")
        if evaluate_by not in ("reimbursement", "coverage"):
            raise ValueError("Genetic supports evaluate_by of reimbursement or coverage, got %r" % evaluate_by)
        population = int(self.params.get("population", 40))
        generations = int(self.params.get("generations", 200))
        patience = int(self.params.get("patience", 40))
        time_limit = float(self.params.get("time_limit", 120))
        rnd = random.Random(int(self.params.get("seed", 42)))

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

        if evaluate_by == "reimbursement" and district.overall_isp >= FULL_FUNDING_ISP:
            self.groups = [CEPGroup(district, "%s - Consolidated" % district.name, schools, self.isp_threshold)]
            self.optimal = True
            self.optimality_basis = (
                "district ISP of %0.1f%% is at or above 62.5%%, so a single group is "
                "fully funded and cannot be beaten" % (district.overall_isp * 100)
            )
            return self.groups

        self._prepare(district, schools, evaluate_by)
        self.K = min(max_groups, n)
        self.rnd = rnd
        start = time.time()

        seeds = self._prior_groupings(district, schools)
        pop = [self._polish(s) for s in seeds]
        while len(pop) < population:
            pop.append(self._polish(self._random_partition()))
        scored = sorted(pop, key=lambda t: t[0], reverse=True)

        best_fit, best = scored[0]
        stale = 0
        ran = 0
        # With no stop rule (patience=0, generations=0) the run lasts exactly
        # time_limit. Long runs should: at 40 groups on a 195 school district
        # the GA was still improving well past where patience=40 gave up.
        for ran in (itertools.count(1) if generations <= 0 else range(1, generations + 1)):
            elite = scored[:2]
            children = []
            while len(children) < population - len(elite):
                a, b = self._tournament(scored), self._tournament(scored)
                child = self._crossover(a, b) if rnd.random() < 0.9 else list(a)
                self._mutate(child)
                children.append(self._polish(child))
            scored = sorted(elite + children, key=lambda t: t[0], reverse=True)
            if scored[0][0] > best_fit + 1e-9:
                best_fit, best = scored[0]
                stale = 0
            else:
                stale += 1
            if (patience > 0 and stale >= patience) or time.time() - start > time_limit:
                break

        members = {}
        for i, label in enumerate(best):
            members.setdefault(label, []).append(schools[i])
        self.groups = [CEPGroup(district, "Genetic Group %i" % (k + 1), m, self.isp_threshold)
                       for k, m in enumerate(members.values())]
        self.optimality_basis = (
            "best of %i generations of %i in %0.0fs; a genetic algorithm does not prove optimality"
            % (ran, population, time.time() - start)
        )
        return self.groups

    # -- scoring ---------------------------------------------------------------

    def _prepare(self, district, schools, evaluate_by):
        '''Per school constants: once a school's group is fixed it earns A + f * D.'''
        sfa = district.sfa_certified
        self.A, self.D = [], []
        for s in schools:
            s.set_rates(district)
            r = s.rates
            paid = s.bfast_served * r.paid_breakfast_rate + s.lunch_served * r.paid_lunch_rate
            if sfa:
                paid += s.lunch_served * 0.07
            self.A.append(paid)
            self.D.append(s.bfast_served * (r.free_breakfast_rate - r.paid_breakfast_rate)
                          + s.lunch_served * (r.free_lunch_rate - r.paid_lunch_rate))
        self.e = [s.total_eligible for s in schools]
        self.en = [s.total_enrolled for s in schools]
        # Under coverage, students in an eligible group come first and dollars
        # only break ties: weight students above the most dollars possible.
        self.coverage_weight = float(sum(self.A) + sum(self.D) + 1) if evaluate_by == "coverage" else 0.0
        # The same constants as arrays, for _polish_kernel.
        self.arrays = (np.array(self.e, np.int64), np.array(self.en, np.int64),
                       np.array(self.A, np.float64), np.array(self.D, np.float64))

    def _group_value(self, E, N, A, D):
        if N == 0:
            return 0.0
        free_rate = isp_to_free_rate(round(E / float(N), 4), self.isp_threshold)
        if free_rate == 0:
            return 0.0      # not CEP eligible: earns nothing
        return self.coverage_weight * N + A + free_rate * D

    # -- operators -------------------------------------------------------------

    def _random_partition(self):
        k = self.rnd.randint(1, self.K)
        return [self.rnd.randrange(k) for _ in self.e]

    def _prior_groupings(self, district, schools):
        '''Groupings other strategies already found for this district, as labels.'''
        index = {id(s): i for i, s in enumerate(schools)}
        seeds = [[0] * len(schools)]   # everyone in one group
        for s in getattr(district, "strategies", []):
            if s is self or not s.groups or len(s.groups) > self.K:
                continue
            labels = [None] * len(schools)
            for g, group in enumerate(s.groups):
                for school in group.schools:
                    if id(school) in index:
                        labels[index[id(school)]] = g
            if None not in labels:
                seeds.append(labels)
        return seeds

    def _tournament(self, scored, size=3):
        return max(self.rnd.sample(scored, min(size, len(scored))), key=lambda t: t[0])[1]

    def _crossover(self, a, b):
        '''Inherit a random subset of a's groups whole; b's groups fill the rest.'''
        groups_a = sorted(set(a))
        keep = set(g for g in groups_a if self.rnd.random() < 0.5) or {self.rnd.choice(groups_a)}
        child = [None] * len(a)
        relabel = {}
        for i, g in enumerate(a):
            if g in keep:
                child[i] = relabel.setdefault(("a", g), len(relabel))
        for i, g in enumerate(b):
            if child[i] is None:
                child[i] = relabel.setdefault(("b", g), len(relabel))
        # Over the group cap: fold the surplus groups into ones we are keeping.
        if len(relabel) > self.K:
            for i, g in enumerate(child):
                if g >= self.K:
                    child[i] = self.rnd.randrange(self.K)
        return child

    def _mutate(self, labels):
        '''One structural change the hill climber cannot make one school at a time.'''
        used = sorted(set(labels))
        op = self.rnd.random()
        if op < 0.4 and len(used) > 1:                       # merge two groups
            g1, g2 = self.rnd.sample(used, 2)
            for i, g in enumerate(labels):
                if g == g2:
                    labels[i] = g1
        elif op < 0.8 and len(used) < self.K:                # split a group in two
            g = self.rnd.choice(used)
            free = next(k for k in range(self.K) if k not in used)
            for i, label in enumerate(labels):
                if label == g and self.rnd.random() < 0.5:
                    labels[i] = free
        else:                                                # scatter a few schools
            for _ in range(max(1, len(labels) // 20)):
                labels[self.rnd.randrange(len(labels))] = self.rnd.randrange(self.K)

    def _polish(self, labels):
        '''First-improvement hill climbing, scored incrementally from each
        group's running totals, over two kinds of step:

          * move one school to another group;
          * swap two schools between groups.

        Swaps matter near the ISP threshold. A group sitting just above it
        loses everything if any one school leaves and gains nothing from a
        weaker one joining, so single moves cannot improve it -- but trading a
        member for a better school outside can. Without swaps the search
        stalled on low-ISP districts at three quarters of the optimum.

        This is nearly all of the GA's run time, and a long run's result is
        set by how many generations fit in the time, so the loop itself is
        _polish_kernel, compiled by Numba. Its random draws come from NumPy,
        seeded from self.rnd on each call, so a fixed seed still gives a fixed
        result. Returns (fitness, labels).'''
        arr = np.array(labels, np.int64)
        fit = _polish_kernel(arr, self.K, *self.arrays, float(self.isp_threshold),
                             self.coverage_weight, self.rnd.getrandbits(32))
        return fit, arr.tolist()
