import random
import time

from .base import BaseCEPStrategy, CEPGroup, isp_to_free_rate

# ISP at which the 1.6 multiplier saturates; at or above this one group is fully
# funded and nothing can beat it.
FULL_FUNDING_ISP = 1.0 / 1.6


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
    that CEPGroup uses, so a move costs O(1) to evaluate. The final grouping is
    re-scored by CEPGroup itself before it is reported.

    The population is seeded with the best grouping any strategy that already
    ran on the district produced (so run it after them), and the best
    individual always survives to the next generation, so it can never return
    less than that warm start. With a fixed seed it is deterministic, as long as
    time_limit does not cut the run short.

    Parameters:
        population   -- individuals per generation (default 40)
        generations  -- most generations to run (default 200)
        patience     -- stop after this many generations without improvement (default 40)
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
        scored = sorted(((self._fitness(p), p) for p in pop), key=lambda t: t[0], reverse=True)

        best_fit, best = scored[0]
        stale = 0
        ran = 0
        for ran in range(1, generations + 1):
            elite = [p for _, p in scored[:2]]
            children = []
            while len(children) < population - len(elite):
                a, b = self._tournament(scored), self._tournament(scored)
                child = self._crossover(a, b) if rnd.random() < 0.9 else list(a)
                self._mutate(child)
                children.append(self._polish(child))
            scored = sorted(((self._fitness(p), p) for p in elite + children),
                            key=lambda t: t[0], reverse=True)
            if scored[0][0] > best_fit + 1e-9:
                best_fit, best = scored[0]
                stale = 0
            else:
                stale += 1
            if stale >= patience or time.time() - start > time_limit:
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
        self.coverage_weight = (sum(self.A) + sum(self.D) + 1) if evaluate_by == "coverage" else 0

    def _group_value(self, E, N, A, D):
        if N == 0:
            return 0.0
        free_rate = isp_to_free_rate(round(E / float(N), 4), self.isp_threshold)
        if free_rate == 0:
            return 0.0      # not CEP eligible: earns nothing
        return self.coverage_weight * N + A + free_rate * D

    def _totals(self, labels):
        t = [[0, 0, 0.0, 0.0] for _ in range(self.K)]
        for i, g in enumerate(labels):
            row = t[g]
            row[0] += self.e[i]; row[1] += self.en[i]; row[2] += self.A[i]; row[3] += self.D[i]
        return t

    def _fitness(self, labels):
        return sum(self._group_value(*row) for row in self._totals(labels))

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
        stalled on low-ISP districts at three quarters of the optimum.'''
        labels = list(labels)
        t = self._totals(labels)
        value = [self._group_value(*row) for row in t]
        n = len(labels)
        failures = 0
        while failures < 3 * n:
            i = self.rnd.randrange(n)
            src = labels[i]
            if self.rnd.random() < 0.5:
                j, dst = None, self.rnd.randrange(self.K)
            else:
                j = self.rnd.randrange(n)
                dst = labels[j]
            if src == dst:
                failures += 1
                continue
            # Net change in each group's totals: i leaves src for dst, and on a
            # swap j makes the reverse trip.
            delta = [self.e[i], self.en[i], self.A[i], self.D[i]]
            if j is not None:
                delta = [delta[0] - self.e[j], delta[1] - self.en[j],
                         delta[2] - self.A[j], delta[3] - self.D[j]]
            s, x = t[src], t[dst]
            new_src = self._group_value(*(s[k] - delta[k] for k in range(4)))
            new_dst = self._group_value(*(x[k] + delta[k] for k in range(4)))
            if new_src + new_dst > value[src] + value[dst] + 1e-9:
                for k in range(4):
                    s[k] -= delta[k]
                    x[k] += delta[k]
                value[src], value[dst] = new_src, new_dst
                labels[i] = dst
                if j is not None:
                    labels[j] = src
                failures = 0
            else:
                failures += 1
        return labels
