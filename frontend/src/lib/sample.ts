import type { DistrictSettings, SchoolInput } from "./types";
import { DEFAULT_ISP_THRESHOLD } from "./cep";

/**
 * An illustrative district — not real data. It is shaped to make the point of the
 * whole tool visible in one screen: two schools sit under the 25% threshold and earn
 * nothing on their own, while three sit well above 62.5% with ISP to spare. Grouping
 * moves that surplus around.
 */
export const SAMPLE_SCHOOLS: SchoolInput[] = [
  { school_code: "1001", school_name: "Lincoln Elementary",   school_type: "Elementary",  total_enrolled: 520,  total_eligible: 447, daily_breakfast_served: 291, daily_lunch_served: 411, severe_need: true,  active: true },
  { school_code: "1002", school_name: "Roosevelt Elementary", school_type: "Elementary",  total_enrolled: 610,  total_eligible: 439, daily_breakfast_served: 305, daily_lunch_served: 470, severe_need: true,  active: true },
  { school_code: "1003", school_name: "Chavez Middle",        school_type: "Middle",      total_enrolled: 480,  total_eligible: 302, daily_breakfast_served: 182, daily_lunch_served: 348, severe_need: false, active: true },
  { school_code: "1004", school_name: "Jefferson Elementary", school_type: "Elementary",  total_enrolled: 450,  total_eligible: 225, daily_breakfast_served: 158, daily_lunch_served: 315, severe_need: false, active: true },
  { school_code: "1005", school_name: "Kennedy Middle",       school_type: "Middle",      total_enrolled: 700,  total_eligible: 294, daily_breakfast_served: 210, daily_lunch_served: 462, severe_need: false, active: true },
  { school_code: "1006", school_name: "Riverside High",       school_type: "High",        total_enrolled: 1200, total_eligible: 396, daily_breakfast_served: 288, daily_lunch_served: 720, severe_need: false, active: true },
  { school_code: "1007", school_name: "Oak Grove Elementary", school_type: "Elementary",  total_enrolled: 380,  total_eligible: 87,  daily_breakfast_served: 95,  daily_lunch_served: 228, severe_need: false, active: true },
  { school_code: "1008", school_name: "Valley Continuation",  school_type: "Alternative", total_enrolled: 95,   total_eligible: 19,  daily_breakfast_served: 22,  daily_lunch_served: 52,  severe_need: false, active: true },
];

export const SAMPLE_SETTINGS: DistrictSettings = {
  name: "Sample Unified School District",
  code: "SAMPLE-01",
  state_code: "ca",
  isp_threshold: DEFAULT_ISP_THRESHOLD,
  sfa_certified: true,
  hhfka_sixty: "more",
  max_groups: 10,
  evaluate_by: "reimbursement",
};

export const EMPTY_SCHOOL: SchoolInput = {
  school_code: "",
  school_name: "",
  school_type: "",
  total_enrolled: 0,
  total_eligible: 0,
  daily_breakfast_served: 0,
  daily_lunch_served: 0,
  severe_need: false,
  active: true,
};
