/**
 * Types mirroring the Python API in server.py / strategies/base.py.
 *
 * Request  -> POST /api/districts/optimize/   (OptimizeRequest)
 * Response <- district.as_dict()              (OptimizeResponse)
 */

/** One school as the optimizer expects it on input. */
export interface SchoolInput {
  /** Unique id within the district. Rows without one are silently dropped. */
  school_code: string;
  school_name: string;
  school_type?: string;
  /** Students enrolled. Rows with 0/blank are silently dropped. */
  total_enrolled: number | string;
  /** "Identified students" — the numerator of ISP. Capped at total_enrolled. */
  total_eligible: number | string;
  /** Average daily meals served. Drives the reimbursement dollars. */
  daily_breakfast_served: number | string;
  daily_lunch_served: number | string;
  /** Severe-need schools earn the higher free breakfast rate. */
  severe_need?: boolean;
  /** Unchecked schools are excluded from grouping entirely. */
  active?: boolean;
}

/** District-level settings — the knobs that change the answer. */
export interface DistrictSettings {
  name: string;
  code: string;
  /** Two-letter, lowercase. Selects the USDA reimbursement rate table. */
  state_code: string;
  /** Community Eligibility Provision claiming percentage floor. 0.25 since Oct 2023. */
  isp_threshold: number;
  /** SFA certified for the performance-based 7 cent lunch add-on. */
  sfa_certified: boolean;
  /** HHFKA §60 paid-lunch-equity band: "less" | "more" | "max". */
  hhfka_sixty: HhfkaSixty;
  /** Cap on how many groups a strategy may return to stay eligible. */
  max_groups: number;
  /** What "best" means when ranking strategies. */
  evaluate_by: EvaluateBy;
}

export type HhfkaSixty = "less" | "more" | "max";
export type EvaluateBy = "reimbursement" | "coverage";

export interface OptimizeRequest extends DistrictSettings {
  schools: SchoolInput[];
  /** Optional explicit strategy list; server picks a sensible set when omitted. */
  strategies_to_run?: string[];
}

/** Per-school USDA rates the server echoes back for each school. */
export interface Rates {
  free_bfast: number;
  paid_bfast: number;
  free_lunch: number;
  paid_lunch: number;
}

export interface SchoolOutput {
  school_code: string;
  school_name: string;
  school_type: string;
  total_enrolled: number;
  total_eligible: number;
  daily_breakfast_served: number;
  daily_lunch_served: number;
  /** total_eligible / total_enrolled, rounded to 4 places. */
  isp: number;
  active: boolean;
  severe_need: boolean;
  rates?: Rates;
}

export interface GroupOutput {
  name: string;
  school_codes: string[];
  /** [school_code, dollars] pairs. */
  school_reimbursements: [string, number][];
  isp: number;
  /** min(isp * 1.6, 1), or 0 when isp is below isp_threshold. */
  free_rate: number;
  paid_rate: number;
  total_eligible: number;
  total_enrolled: number;
  free_rate_students: number;
  paid_rate_students: number;
  cep_eligible: boolean;
  /** Daily dollars for this group. */
  est_reimbursement: number;
  daily_breakfast_served: number;
  daily_lunch_served: number;
  isp_threshold: number;
}

export interface StrategyOutput {
  name: string;
  groups: GroupOutput[];
  /** Exact only: whether this result is proven optimal, not just best-found. */
  optimal?: boolean;
  /** Exact only: why it is (or is not) proven. */
  optimality_basis?: string | null;
  isp: number;
  total_enrolled: number;
  free_rate: number;
  covered_students: number;
  reimbursement: number;
  basis: string;
  isp_threshold: number;
}

export interface OptimizeResponse {
  name: string;
  code: string;
  total_enrolled: number;
  overall_isp: number;
  school_count: number;
  sfa_certified: boolean;
  hhfka_sixty: HhfkaSixty;
  /** Name of the winning strategy. */
  best_strategy: string | null;
  /** Daily dollars under the winning strategy. */
  est_reimbursement: number;
  isp_threshold: number;
  schools: SchoolOutput[];
  strategies: StrategyOutput[];
  /** Index into `strategies` of the winner. Null if every strategy was disqualified. */
  best_index: number | null;
  /** True when the recommended grouping is proven optimal rather than best-found. */
  best_is_optimal?: boolean;
  /** Explanation of the optimality claim. */
  optimality_basis?: string | null;
  state_code?: string;
  evaluate_by?: EvaluateBy;
  max_groups?: number;
  optimization_info?: { timestamp: string; time: number };
  error?: string;
}
