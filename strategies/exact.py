from .base import BaseCEPStrategy, CEPGroup, DEFAULT_ISP_THRESHOLD, isp_to_free_rate

# ISP at which the 1.6 multiplier saturates. At or above this a group is fully
# funded, so no regrouping can add anything.
FULL_FUNDING_ISP = 1.0 / 1.6


class ExactCEPStrategy(BaseCEPStrategy):
    '''Provably optimal grouping, via dynamic programming over subsets.

    Exhaustive enumerates every set partition -- Bell(n) of them, which is
    115,975 at n=10 and 10.5 billion at n=16. This computes the same answer by
    building up from subsets instead:

        dp[S] = max over subsets T of S containing S's lowest member:
                    value(T) + dp[S - T]

    which costs O(3^n) -- 43 million steps at n=16, and about 178x faster than
    Exhaustive at n=10. That raises the size of district we can prove optimal
    for from 10 schools to roughly 16.

    Two shortcuts avoid the search entirely:
      * A district already at or above 62.5% ISP is fully funded as one group,
        which is the absolute ceiling, so OneGroup is optimal by construction.
      * Districts of 0 or 1 school have only one partition.

    Parameters:
        max_schools  -- largest district to attempt (default 16)
        evaluate_by  -- "reimbursement" (default) or "coverage"
        max_groups   -- if the unconstrained optimum uses more groups than this,
                        re-solve subject to the cap so the result stays usable
    '''
    name = "Exact"

    #: True once we have actually proven optimality for this district.
    optimal = False
    #: Human-readable note on why (or why not).
    optimality_basis = "not run"

    def create_groups(self, district):
        schools = list(district.schools)
        n = len(schools)
        evaluate_by = self.params.get("evaluate_by", "reimbursement")
        max_schools = int(self.params.get("max_schools", 16))

        max_groups = self.params.get("max_groups", None)
        if max_groups in (None, "", "None", "null"):
            max_groups = None
        else:
            max_groups = int(max_groups)

        if evaluate_by not in ("reimbursement", "coverage"):
            raise ValueError("Exact supports evaluate_by of reimbursement or coverage, got %r" % evaluate_by)

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

        # A district at or above 62.5% ISP has every school fully funded in one
        # group. Nothing can beat that, so skip the search. (Only sound for
        # reimbursement -- under coverage, ties are broken on dollars and a
        # different partition could tie on students but pay more.)
        if evaluate_by == "reimbursement" and district.overall_isp >= FULL_FUNDING_ISP:
            self.groups = [CEPGroup(district, "%s - Consolidated" % district.name, schools, self.isp_threshold)]
            self.optimal = True
            self.optimality_basis = (
                "district ISP of %0.1f%% is at or above 62.5%%, so a single group is "
                "fully funded and cannot be beaten" % (district.overall_isp * 100)
            )
            return self.groups

        if n > max_schools:
            # Say nothing rather than return a guess under a name that claims
            # optimality. evaluate_strategies() skips strategies with no groups.
            self.groups = None
            self.optimality_basis = (
                "district has %i schools, above the %i school limit for exact solving" % (n, max_schools)
            )
            return self.groups

        value = self._subset_values(district, schools, evaluate_by)
        picks = self._solve(n, value)
        groups = self._rebuild(district, schools, picks, n)

        if max_groups is not None and len(groups) > max_groups:
            picks = self._solve(n, value, max_groups=max_groups)
            if picks is None:
                self.groups = None
                self.optimality_basis = "no grouping exists within the %i group limit" % max_groups
                return self.groups
            groups = self._rebuild(district, schools, picks, n)
            self.optimality_basis = (
                "proven optimal over all %i school partitions using at most %i groups" % (n, max_groups)
            )
        else:
            self.optimality_basis = "proven optimal over all partitions of %i schools" % n

        self.groups = groups
        self.optimal = True
        return self.groups

    def _subset_values(self, district, schools, evaluate_by):
        '''Score every subset exactly the way CEPGroup does.

        CEPGroup.school_reimbursement rounds each school to cents before summing,
        so we round per school too -- otherwise the DP could prefer a partition
        that scores a cent lower once re-scored by the real code.
        '''
        n = len(schools)
        sfa = district.sfa_certified
        for s in schools:
            s.set_rates(district)

        e = [s.total_eligible for s in schools]
        E = [s.total_enrolled for s in schools]

        size = 1 << n
        sum_e = [0] * size
        sum_E = [0] * size
        value = [None] * size
        value[0] = (0.0, 0.0)

        for S in range(1, size):
            low = (S & -S).bit_length() - 1
            rest = S & (S - 1)
            sum_e[S] = sum_e[rest] + e[low]
            sum_E[S] = sum_E[rest] + E[low]

            enrolled = sum_E[S]
            isp = round(sum_e[S] / float(enrolled), 4) if enrolled else 0
            free_rate = isp_to_free_rate(isp, self.isp_threshold)

            if free_rate == 0:
                value[S] = (0.0, 0.0)   # not CEP eligible: earns nothing
                continue

            paid_rate = 1.0 - free_rate
            total = 0.0
            T = S
            while T:
                i = (T & -T).bit_length() - 1
                T &= T - 1
                s = schools[i]
                r = s.rates
                amount = (
                    s.bfast_served * r.free_breakfast_rate * free_rate
                    + s.bfast_served * r.paid_breakfast_rate * paid_rate
                    + s.lunch_served * r.free_lunch_rate * free_rate
                    + s.lunch_served * r.paid_lunch_rate * paid_rate
                )
                if sfa:
                    amount += s.lunch_served * 0.07
                total += round(amount, 2)

            if evaluate_by == "coverage":
                # Rank on students in an eligible group, break ties on dollars.
                value[S] = (float(enrolled), total)
            else:
                value[S] = (total, 0.0)

        return value

    def _solve(self, n, value, max_groups=None):
        '''Return pick[] mapping each subset to the group taken off it first.'''
        size = 1 << n
        NEG = (float("-inf"), float("-inf"))

        if max_groups is None:
            dp = [NEG] * size
            pick = [0] * size
            dp[0] = (0.0, 0.0)
            for S in range(1, size):
                low = S & -S
                rest = S ^ low
                best = NEG
                best_T = 0
                T = rest
                while True:
                    cand = T | low          # every subset of S that contains its lowest member
                    sub = dp[S ^ cand]
                    if sub != NEG:
                        v = value[cand]
                        total = (v[0] + sub[0], v[1] + sub[1])
                        if total > best:
                            best = total
                            best_T = cand
                    if T == 0:
                        break
                    T = (T - 1) & rest
                dp[S] = best
                pick[S] = best_T
            return pick

        # Group-count constrained: dp[k][S] = best value partitioning S into k groups.
        dp = [[NEG] * size for _ in range(max_groups + 1)]
        pick = [[0] * size for _ in range(max_groups + 1)]
        dp[0][0] = (0.0, 0.0)
        for k in range(1, max_groups + 1):
            for S in range(1, size):
                low = S & -S
                rest = S ^ low
                best = NEG
                best_T = 0
                T = rest
                while True:
                    cand = T | low
                    sub = dp[k - 1][S ^ cand]
                    if sub != NEG:
                        v = value[cand]
                        total = (v[0] + sub[0], v[1] + sub[1])
                        if total > best:
                            best = total
                            best_T = cand
                    if T == 0:
                        break
                    T = (T - 1) & rest
                dp[k][S] = best
                pick[k][S] = best_T

        full = size - 1
        best_k, best_v = None, NEG
        for k in range(1, max_groups + 1):
            if dp[k][full] != NEG and dp[k][full] > best_v:
                best_k, best_v = k, dp[k][full]
        if best_k is None:
            return None

        # Flatten the k-indexed picks into the same shape the caller expects.
        flat = [0] * size
        S, k = full, best_k
        while S:
            flat[S] = pick[k][S]
            S ^= pick[k][S]
            k -= 1
        return flat

    def _rebuild(self, district, schools, pick, n):
        groups = []
        S = (1 << n) - 1
        i = 1
        while S:
            members = [schools[b] for b in range(n) if pick[S] >> b & 1]
            groups.append(CEPGroup(district, "Group %i" % i, members, self.isp_threshold))
            S ^= pick[S]
            i += 1
        return groups

    def as_dict(self):
        result = super(ExactCEPStrategy, self).as_dict()
        result["optimal"] = self.optimal
        result["optimality_basis"] = self.optimality_basis
        return result
