/** Reference content: the strategy catalogue and the input/output field dictionaries. */

export interface StrategyDoc {
  /** Key used in `strategies_to_run`, e.g. "NYCMODA?iterations=1000". */
  key: string;
  /** Name the API returns in `strategies[].name`. */
  label: string;
  tagline: string;
  how: string;
  when: string;
  cost: "trivial" | "cheap" | "moderate" | "expensive";
  params?: { name: string; meaning: string; default: string }[];
  source: string;
  autoRun: "always" | "large districts only";
}

export const STRATEGIES: StrategyDoc[] = [
  {
    key: "OneToOne",
    label: "OneToOne",
    tagline: "Every school stands alone.",
    how: "Each school becomes its own group, so its own ISP decides its own funding. No sharing happens at all.",
    when: "The baseline. This is what a district gets by doing nothing clever, so it is the number every other strategy has to beat.",
    cost: "trivial",
    source: "strategies/naive.py",
    autoRun: "always",
  },
  {
    key: "OneGroup",
    label: "OneGroup",
    tagline: "The whole district as a single group.",
    how: "All schools are pooled into one group and the district's overall ISP sets one blended free rate for everyone.",
    when: "Wins in districts with uniformly high poverty, where pooling clears 62.5% for everybody at once. Loses badly when a few low-ISP schools drag a strong district average down.",
    cost: "trivial",
    source: "strategies/naive.py",
    autoRun: "always",
  },
  {
    key: "Pairs",
    label: "Pairs",
    tagline: "Marry each strong school to the largest school it can carry.",
    how: "Sorts schools by ISP, then walks the schools above 62.5% and matches each with the biggest under-threshold school it can absorb while keeping the pair above 62.5%. Leftovers repeat the process against the CEP threshold, and whatever still does not qualify is parked in a 'Not CEP Eligible' group.",
    when: "A fast, intuitive answer that is often close to optimal in small districts, and easy to explain to a school board.",
    cost: "cheap",
    source: "strategies/pairs.py",
    autoRun: "always",
  },
  {
    key: "Spread",
    label: "Spread",
    tagline: "Spend each strong school's surplus ISP down to 62.5%.",
    how: "Gives every above-62.5% school its own group, then keeps adding the next-highest low-ISP school to it until one more would push the group below 62.5%. Anything left over lands in a 'Remainder' group.",
    when: "Extracts more value than Pairs when a single high-ISP school has enough surplus to carry several small schools rather than just one.",
    cost: "cheap",
    source: "strategies/spread.py",
    autoRun: "always",
  },
  {
    key: "Binning",
    label: "Binning",
    tagline: "Slice the district into descending ISP bands.",
    how: "Builds a first bin of everything over 62.5%, then steps the threshold down in fixed-width increments, filling each bin from the top of the remaining schools until it drops below that band's threshold.",
    when: "Useful in large districts where the ISP curve is smooth and there is no natural pairing.",
    cost: "cheap",
    params: [{ name: "isp_width", meaning: "Width of each descending ISP band.", default: "0.02 (2%)" }],
    source: "strategies/binning.py",
    autoRun: "always",
  },
  {
    key: "Exact",
    label: "Exact",
    tagline: "The provably best grouping, by dynamic programming over subsets.",
    how: "Instead of enumerating every partition, it builds the answer up from subsets: the best split of a set is the best single group containing its lowest member, plus the best split of whatever is left. That costs 3^n work instead of Bell(n) — 43 million steps at 16 schools where enumeration would need 10.5 billion partitions. Two shortcuts skip the search entirely: a district already at or above 62.5% ISP is fully funded as one group and cannot be beaten, and a one-school district has only one grouping.",
    when: "Any district up to 16 schools — about 88% of California districts. When it runs, the answer carries a proof, so the response sets optimal: true and the other search strategies are skipped as redundant.",
    cost: "moderate",
    params: [
      { name: "max_schools", meaning: "Largest district it will attempt before declining.", default: "16" },
      { name: "evaluate_by", meaning: "Rank by dollars or by students covered.", default: "reimbursement" },
      { name: "max_groups", meaning: "If the unconstrained optimum needs more groups than this, it re-solves subject to the cap.", default: "unset" },
    ],
    source: "strategies/exact.py",
    autoRun: "always",
  },
  {
    key: "Exhaustive",
    label: "Exhaustive",
    tagline: "Try literally every possible grouping.",
    how: "Enumerates every set partition of the schools and keeps the best. Provably optimal but only tractable at small sizes: the Bell number for 10 schools is 115,975, for 15 it is 1.4 billion. Above its limit it silently falls back to OneToOne, which is easy to mistake for a real result.",
    when: "Superseded by Exact, which returns the identical grouping over 100x faster and handles larger districts. Kept for cross-checking, and still used above the Exact ceiling where it degrades to OneToOne.",
    cost: "expensive",
    params: [
      { name: "max_count", meaning: "Largest district it will actually enumerate before falling back.", default: "10" },
      { name: "evaluate_by", meaning: "Whether to rank partitions by dollars or by students covered.", default: "reimbursement" },
    ],
    source: "strategies/exhaustive.py",
    autoRun: "large districts only",
  },
  {
    key: "NYCMODA",
    label: "NYCMODA — simulated annealing",
    tagline: "Randomized search, restarted many times.",
    how: "Starts from random groupings and repeatedly moves schools between groups, keeping changes that improve the score. Runs many independent fresh starts to avoid getting stuck in a local optimum. Seeded, so the same inputs give the same answer. Note it only anneals above 10 schools — at or below that it returns a single group unchanged.",
    when: "Districts above the Exact ceiling, where optimality cannot be proven. This is the workhorse for large districts. Below the ceiling it is skipped, since it cannot beat a proven optimum.",
    cost: "expensive",
    params: [
      { name: "fresh_starts", meaning: "Independent restarts from a new random grouping.", default: "100 (sync) / 50 (async)" },
      { name: "iterations", meaning: "Moves attempted per start.", default: "2000 (sync) / 1000 (async)" },
      { name: "ngroups", meaning: "Upper bound on groups it will create.", default: "max_groups" },
      { name: "evaluate_by", meaning: "Objective: reimbursement or coverage.", default: "reimbursement" },
    ],
    source: "strategies/nyc_moda_simulated_annealing.py",
    autoRun: "large districts only",
  },
  {
    key: "GreedyLP",
    label: "GreedyLP",
    tagline: "Linear programming, applied greedily.",
    how: "Uses an OR-Tools solver to carve off the best group it can find, removes those schools, and repeats on what remains.",
    when: "Large districts, as a structured counterweight to the randomness of simulated annealing. Measured on small districts against the proven optimum, it is the strongest of the heuristics. Skipped below the Exact ceiling.",
    cost: "moderate",
    source: "strategies/linear_solver.py",
    autoRun: "large districts only",
  },
];

export interface FieldDoc {
  name: string;
  type: string;
  required?: boolean;
  meaning: string;
  gotcha?: string;
}

export const SCHOOL_INPUT_FIELDS: FieldDoc[] = [
  {
    name: "school_code",
    type: "string",
    required: true,
    meaning: "Unique identifier for the school within the district. Group memberships in the output are reported by this code.",
    gotcha: "A row with no school_code is skipped without warning — no error, it just vanishes from the results.",
  },
  { name: "school_name", type: "string", meaning: "Display name. Defaults to \"School N\" if omitted." },
  { name: "school_type", type: "string", meaning: "Free-text label (Elementary, Middle, …). Carried through to output; does not affect the math." },
  {
    name: "total_enrolled",
    type: "integer",
    required: true,
    meaning: "Students enrolled. The denominator of ISP.",
    gotcha: "A row with 0 or blank total_enrolled is skipped without warning, same as a missing code.",
  },
  {
    name: "total_eligible",
    type: "integer",
    required: true,
    meaning: "Identified students — directly certified, plus foster, homeless, migrant, and Head Start children. The numerator of ISP.",
    gotcha: "Silently clamped down to total_enrolled if you send a larger number.",
  },
  {
    name: "daily_breakfast_served",
    type: "integer",
    meaning: "Average daily breakfasts served. Multiplied by the per-meal rate to get dollars.",
    gotcha: "Leave this at 0 and every reimbursement in the output is 0 too — the grouping still computes, but there is nothing to compare.",
  },
  { name: "daily_lunch_served", type: "integer", meaning: "Average daily lunches served. The dominant term in the dollar figure." },
  { name: "severe_need", type: "boolean", meaning: "Qualifies the school for the higher severe-need free breakfast rate ($2.73 vs $2.28 in the contiguous 48)." },
  { name: "active", type: "boolean", meaning: "Set false to leave a school out of grouping entirely. It is still echoed in the output's schools list, just never placed in a group." },
];

export const DISTRICT_INPUT_FIELDS: FieldDoc[] = [
  { name: "name", type: "string", meaning: "District name, for labeling only." },
  { name: "code", type: "string", meaning: "District identifier, for labeling only." },
  {
    name: "state_code",
    type: "string",
    required: true,
    meaning: "Two-letter lowercase state code. Selects the USDA rate table — Alaska and Hawaii/PR/GU/VI pay materially more than the contiguous 48.",
  },
  {
    name: "isp_threshold",
    type: "float",
    meaning: "Minimum ISP for a group to earn anything at all. 0.25 since October 2023 (it was 0.40 before).",
    gotcha: "Lowering this is a policy question, not a modeling trick — it changes which groups are legally eligible.",
  },
  { name: "sfa_certified", type: "boolean", meaning: "School Food Authority is certified for the performance-based 7¢ per-lunch add-on." },
  {
    name: "hhfka_sixty",
    type: '"less" | "more" | "max"',
    meaning: "Which Healthy, Hunger-Free Kids Act §60 paid-lunch-equity band the district falls in. Shifts every per-meal rate slightly.",
  },
  {
    name: "max_groups",
    type: "integer",
    meaning: "Any strategy producing more groups than this is disqualified during ranking. Also caps the group count the annealing search will try.",
    gotcha: "Set it too low and good strategies get thrown out; set it high and you may get an unmanageable number of groups to administer.",
  },
  {
    name: "evaluate_by",
    type: '"reimbursement" | "coverage"',
    meaning: "How the winner is chosen: most dollars, or most students in a CEP-eligible group. These do not always agree.",
  },
];

export const OUTPUT_FIELDS: FieldDoc[] = [
  { name: "best_strategy", type: "string", meaning: "Name of the winning strategy — the recommendation." },
  {
    name: "best_is_optimal",
    type: "boolean",
    meaning: "True when the recommendation is proven optimal rather than merely the best of what was tried. Set by the Exact strategy for districts up to 16 schools, and for any district already at or above 62.5% ISP.",
  },
  { name: "optimality_basis", type: "string | null", meaning: "Why the result is (or is not) proven — e.g. \"proven optimal over all partitions of 12 schools\"." },
  { name: "est_reimbursement", type: "float", meaning: "Estimated reimbursement under the winning strategy, in dollars per serving day." },
  { name: "best_index", type: "integer | null", meaning: "Index of the winner inside the strategies array. Null if every strategy was disqualified — for instance when all of them exceeded max_groups." },
  { name: "overall_isp", type: "float", meaning: "District-wide identified student percentage, ignoring grouping." },
  { name: "strategies[]", type: "array", meaning: "Every strategy that ran, with its full grouping. This is what makes the result auditable rather than a black box." },
  { name: "strategies[].groups[]", type: "array", meaning: "The actual grouping proposed: which school codes go together." },
  { name: "groups[].isp", type: "float", meaning: "Pooled ISP for the group: sum(eligible) / sum(enrolled)." },
  { name: "groups[].free_rate", type: "float", meaning: "Share of meals reimbursed at the free rate: min(isp × 1.6, 1), or 0 below the threshold." },
  { name: "groups[].cep_eligible", type: "boolean", meaning: "Whether this group cleared the threshold at all." },
  { name: "groups[].school_reimbursements", type: "[code, dollars][]", meaning: "Per-school dollar breakdown inside the group." },
  { name: "groups[].free_rate_students", type: "integer", meaning: "Students in a CEP-eligible group — the 'coverage' number, equal to total_enrolled when eligible and 0 otherwise." },
  { name: "schools[]", type: "array", meaning: "Every school as parsed, including the computed isp and the rates table applied to it. Check this first when a school seems to be missing." },
  { name: "optimization_info.time", type: "float", meaning: "Wall-clock seconds the optimization took." },
];
