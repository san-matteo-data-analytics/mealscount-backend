/**
 * The jurisdictions the state picker can offer.
 *
 * `/api/states/` (server.py) is the live source, but it only lists a state once
 * `dist/static/<code>/districts.json` exists — a build artifact of the old
 * frontend — so it currently returns 50 entries and omits DC and the
 * territories. Picking a state here only selects a USDA rate table; it does not
 * require MealsCount to hold district data for that state. So the live list is
 * merged over this baseline rather than replacing it.
 *
 * Guam / American Samoa / the Northern Marianas are deliberately absent:
 * CEPRate in strategies/base.py checks "GM" rather than "GU" and has no branch
 * for AS or MP, so those would silently claim contiguous-48 rates.
 */
export interface StateOption {
  /** Two-letter, lowercase — what the optimizer expects as `state_code`. */
  code: string;
  name: string;
}

export const US_JURISDICTIONS: StateOption[] = [
  { code: "al", name: "Alabama" },
  { code: "ak", name: "Alaska" },
  { code: "az", name: "Arizona" },
  { code: "ar", name: "Arkansas" },
  { code: "ca", name: "California" },
  { code: "co", name: "Colorado" },
  { code: "ct", name: "Connecticut" },
  { code: "de", name: "Delaware" },
  { code: "dc", name: "District of Columbia" },
  { code: "fl", name: "Florida" },
  { code: "ga", name: "Georgia" },
  { code: "hi", name: "Hawaii" },
  { code: "id", name: "Idaho" },
  { code: "il", name: "Illinois" },
  { code: "in", name: "Indiana" },
  { code: "ia", name: "Iowa" },
  { code: "ks", name: "Kansas" },
  { code: "ky", name: "Kentucky" },
  { code: "la", name: "Louisiana" },
  { code: "me", name: "Maine" },
  { code: "md", name: "Maryland" },
  { code: "ma", name: "Massachusetts" },
  { code: "mi", name: "Michigan" },
  { code: "mn", name: "Minnesota" },
  { code: "ms", name: "Mississippi" },
  { code: "mo", name: "Missouri" },
  { code: "mt", name: "Montana" },
  { code: "ne", name: "Nebraska" },
  { code: "nv", name: "Nevada" },
  { code: "nh", name: "New Hampshire" },
  { code: "nj", name: "New Jersey" },
  { code: "nm", name: "New Mexico" },
  { code: "ny", name: "New York" },
  { code: "nc", name: "North Carolina" },
  { code: "nd", name: "North Dakota" },
  { code: "oh", name: "Ohio" },
  { code: "ok", name: "Oklahoma" },
  { code: "or", name: "Oregon" },
  { code: "pa", name: "Pennsylvania" },
  { code: "ri", name: "Rhode Island" },
  { code: "sc", name: "South Carolina" },
  { code: "sd", name: "South Dakota" },
  { code: "tn", name: "Tennessee" },
  { code: "tx", name: "Texas" },
  { code: "ut", name: "Utah" },
  { code: "vt", name: "Vermont" },
  { code: "va", name: "Virginia" },
  { code: "wa", name: "Washington" },
  { code: "wv", name: "West Virginia" },
  { code: "wi", name: "Wisconsin" },
  { code: "wy", name: "Wyoming" },
  { code: "pr", name: "Puerto Rico" },
  { code: "vi", name: "U.S. Virgin Islands" },
];

/**
 * Union of several lists, keyed by code — earlier lists win on the display name,
 * so the server's name for a state beats the baseline's. Sorted for the picker.
 */
export function mergeStates(...lists: StateOption[][]): StateOption[] {
  const byCode = new Map<string, StateOption>();
  for (const list of lists) {
    for (const s of list) {
      const code = s.code.toLowerCase();
      if (!byCode.has(code)) byCode.set(code, { code, name: s.name });
    }
  }
  return [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name));
}
