from .base import BaseCEPStrategy, CEPGroup, isp_to_free_rate

# ISP at which the 1.6 multiplier saturates; at or above this one group is fully
# funded and nothing can beat it.
FULL_FUNDING_ISP = 1.0 / 1.6


class IntervalDPCEPStrategy(BaseCEPStrategy):
    '''Optimal grouping restricted to contiguous blocks of ISP-sorted schools.

    Exact solves the true problem but costs O(3^n), so it stops at ~16 schools.
    This restricts the search to partitions whose groups are runs of schools once
    sorted by ISP, which collapses the search to a one-dimensional DP:

        dp[i] = max over j > i of  value(schools[i:j]) + dp[j]

    That is O(n^2) blocks, so it runs on a 793 school district in well under a
    second, and it is provably optimal *within the contiguous class* -- not
    overall. The restriction is the same intuition Binning and Spread encode by
    hand (pair high ISP schools with the next ones down until the group falls to
    the threshold); doing it as a DP just stops the greedy from committing early.

    Measured against Exact on real 11-16 school California districts, this lands
    at 99.7% of the true optimum when meal participation tracks enrollment and
    99.3% when participation varies per school. It is not a replacement for
    SimulatedAnnealing -- the two miss on different districts, and taking the
    better of the two (which evaluate_strategies already does) beats either.

    Why contiguity is a reasonable restriction: a group's value is
    sum_i (K_i + free_rate * D_i) over its members, where K_i and D_i are per
    school constants. Only free_rate depends on the grouping, and it is monotone
    in group ISP, so blocks of adjacent ISP capture the trade almost always. It
    loses ground exactly when D_i stops tracking ISP, which is what varying
    participation rates do.

    Parameters:
        evaluate_by -- "reimbursement" (default) or "coverage"
        max_groups  -- cap on the number of groups; re-solves under the cap
        max_block   -- largest block to consider (0 = unlimited, the default
                       below 120 schools). Bounds the run time on huge districts.
    '''
    name = "IntervalDP"

    #: True only when the contiguous optimum is also the overall optimum.
    optimal = False
    optimality_basis = "not run"

    def create_groups(self, district):
        schools = sorted(district.schools, key=lambda s: s.isp)
        n = len(schools)
        evaluate_by = self.params.get("evaluate_by", "reimbursement")
        if evaluate_by not in ("reimbursement", "coverage"):
            raise ValueError(
                "IntervalDP supports evaluate_by of reimbursement or coverage, got %r" % evaluate_by)

        max_groups = self.params.get("max_groups", None)
        if max_groups in (None, "", "None", "null"):
            max_groups = None
        else:
            max_groups = int(max_groups)

        max_block = int(self.params.get("max_block", 0)) or (n if n <= 120 else 60)

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

        # Same shortcut Exact uses: at or above 62.5% district ISP one group is
        # fully funded, which is the ceiling. Only sound for reimbursement.
        if evaluate_by == "reimbursement" and district.overall_isp >= FULL_FUNDING_ISP:
            self.groups = [CEPGroup(district, "%s - Consolidated" % district.name,
                                    list(district.schools), self.isp_threshold)]
            self.optimal = True
            self.optimality_basis = (
                "district ISP of %0.1f%% is at or above 62.5%%, so a single group is "
                "fully funded and cannot be beaten" % (district.overall_isp * 100)
            )
            return self.groups

        block_value = self._block_scorer(district, schools, evaluate_by)
        cuts = self._solve(n, block_value, max_block, max_groups)

        if cuts is None:
            self.groups = None
            self.optimality_basis = "no grouping exists within the %s group limit" % max_groups
            return self.groups

        self.groups = []
        for k, (i, j) in enumerate(cuts, 1):
            self.groups.append(
                CEPGroup(district, "Block %i" % k, schools[i:j], self.isp_threshold))

        if n <= max_block and max_groups is None:
            self.optimality_basis = (
                "optimal over all ISP-contiguous groupings of %i schools "
                "(not proven optimal over all partitions)" % n)
        else:
            self.optimality_basis = (
                "optimal over ISP-contiguous groupings of %i schools, blocks of at most %i%s"
                % (n, max_block, max_groups and (", at most %i groups" % max_groups) or ""))
        return self.groups

    def _block_scorer(self, district, schools, evaluate_by):
        '''Return f(i,j) -> comparable value of schools[i:j], scored the way
        CEPGroup does. A school's dollars are round()ed to cents before summing,
        exactly as CEPGroup.school_reimbursement does, so the value the DP
        optimises is the value the app will report back.
        '''
        for s in schools:
            s.set_rates(district)
        sfa = district.sfa_certified

        # amount_i = free_rate*A_i + (1-free_rate)*B_i + C_i
        A = [s.bfast_served * s.rates.free_breakfast_rate
             + s.lunch_served * s.rates.free_lunch_rate for s in schools]
        B = [s.bfast_served * s.rates.paid_breakfast_rate
             + s.lunch_served * s.rates.paid_lunch_rate for s in schools]
        C = [(s.lunch_served * s.rates.sfa_lunch_bonus if sfa else 0.0) for s in schools]

        n = len(schools)
        pe = [0] * (n + 1)
        pE = [0] * (n + 1)
        for k, s in enumerate(schools):
            pe[k + 1] = pe[k] + s.total_eligible
            pE[k + 1] = pE[k] + s.total_enrolled

        threshold = self.isp_threshold
        by_coverage = evaluate_by == "coverage"

        def value(i, j):
            enrolled = pE[j] - pE[i]
            if enrolled == 0:
                return (0.0, 0.0)
            isp = round((pe[j] - pe[i]) / float(enrolled), 4)
            free_rate = isp_to_free_rate(isp, threshold)
            if free_rate == 0:
                return (0.0, 0.0)      # not CEP eligible: earns nothing at all
            paid_rate = 1.0 - free_rate
            total = 0.0
            for k in range(i, j):
                total += round(free_rate * A[k] + paid_rate * B[k] + C[k], 2)
            if by_coverage:
                # Rank on students in an eligible group, break ties on dollars.
                return (float(enrolled), total)
            return (total, 0.0)

        return value

    def _solve(self, n, value, max_block, max_groups):
        '''Return the chosen [i,j) blocks, or None if the group cap is infeasible.'''
        NEG = (float("-inf"), float("-inf"))

        if max_groups is None:
            dp = [NEG] * (n + 1)
            nxt = [None] * (n + 1)
            dp[n] = (0.0, 0.0)
            for i in range(n - 1, -1, -1):
                best, best_j = NEG, None
                for j in range(i + 1, min(i + max_block, n) + 1):
                    sub = dp[j]
                    if sub == NEG:
                        continue
                    v = value(i, j)
                    total = (v[0] + sub[0], v[1] + sub[1])
                    if total > best:
                        best, best_j = total, j
                dp[i], nxt[i] = best, best_j
            if nxt[0] is None:
                return None
            cuts, i = [], 0
            while i < n:
                j = nxt[i]
                cuts.append((i, j))
                i = j
            return cuts

        # Group-count constrained: dp[k][i] = best value covering schools[i:] with k blocks.
        dp = [[NEG] * (n + 1) for _ in range(max_groups + 1)]
        nxt = [[None] * (n + 1) for _ in range(max_groups + 1)]
        for k in range(max_groups + 1):
            dp[k][n] = (0.0, 0.0)
        for k in range(1, max_groups + 1):
            for i in range(n - 1, -1, -1):
                best, best_j = NEG, None
                for j in range(i + 1, min(i + max_block, n) + 1):
                    sub = dp[k - 1][j]
                    if sub == NEG:
                        continue
                    v = value(i, j)
                    total = (v[0] + sub[0], v[1] + sub[1])
                    if total > best:
                        best, best_j = total, j
                dp[k][i], nxt[k][i] = best, best_j

        best_k, best_v = None, NEG
        for k in range(1, max_groups + 1):
            if dp[k][0] != NEG and dp[k][0] > best_v:
                best_k, best_v = k, dp[k][0]
        if best_k is None:
            return None

        cuts, i, k = [], 0, best_k
        while i < n:
            j = nxt[k][i]
            cuts.append((i, j))
            i, k = j, k - 1
        return cuts

    def as_dict(self):
        result = super(IntervalDPCEPStrategy, self).as_dict()
        result["optimal"] = self.optimal
        result["optimality_basis"] = self.optimality_basis
        return result
