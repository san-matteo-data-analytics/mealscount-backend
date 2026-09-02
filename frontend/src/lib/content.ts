/** Plain-language reference content: what each grouping approach does, and what goes into a file. */

export interface StrategyDoc {
  /** Name the optimizer reports for this approach, used to look up the friendly label. */
  key: string;
  label: string;
  tagline: string;
  how: string;
  when: string;
  cost: "trivial" | "cheap" | "moderate" | "expensive";
  autoRun: "always" | "large districts only";
}

/** How long each approach takes, in words a person can plan around. */
export const COST_LABEL: Record<StrategyDoc["cost"], string> = {
  trivial: "instant",
  cheap: "instant",
  moderate: "a few seconds",
  expensive: "can take minutes",
};

export const STRATEGIES: StrategyDoc[] = [
  {
    key: "OneToOne",
    label: "Each school on its own",
    tagline: "What your district gets by not grouping at all.",
    how: "Every school stands alone, so each one qualifies — or does not — on its own numbers. Nothing is shared between schools.",
    when: "This is the starting point, not a recommendation. It is the number every other option has to beat, and the gap between it and the winner is what grouping is worth to you.",
    cost: "trivial",
    autoRun: "always",
  },
  {
    key: "OneGroup",
    label: "One district-wide group",
    tagline: "Every school together in a single group.",
    how: "All schools are pooled, and the district's overall share of identified students sets one free-meal rate for everybody.",
    when: "Wins when need is high and fairly even across the district, so pooling carries every school over the line at once. Loses badly when a few lower-need schools pull the district average down.",
    cost: "trivial",
    autoRun: "always",
  },
  {
    key: "Pairs",
    label: "Paired schools",
    tagline: "Match each high-need school with the largest school it can carry.",
    how: "Sorts schools by need, then pairs each school above 62.5% with the biggest school below it that the pair can still support. Leftovers are matched again against the eligibility floor, and anything that still cannot qualify is set aside on its own.",
    when: "Fast, and often close to the best answer in a smaller district. It is also the easiest grouping to explain to a school board or a superintendent.",
    cost: "cheap",
    autoRun: "always",
  },
  {
    key: "Spread",
    label: "Shared surplus",
    tagline: "Spend each high-need school's surplus down to 62.5%.",
    how: "Gives every school above 62.5% its own group, then keeps adding the next-highest-need school to that group until one more would drop it below 62.5%. Whatever is left forms a final group.",
    when: "Does better than paired schools when one high-need school has enough surplus to carry several small schools rather than just one.",
    cost: "cheap",
    autoRun: "always",
  },
  {
    key: "Binning",
    label: "Grouped by need band",
    tagline: "Sort the district into bands, highest need first.",
    how: "Puts everything above 62.5% into a first band, then steps the cutoff down a little at a time, filling each band from the top of the schools that are still unplaced.",
    when: "Useful in large districts where need is spread smoothly across the schools and there is no obvious pairing to make.",
    cost: "cheap",
    autoRun: "always",
  },
  {
    key: "Exact",
    label: "Best possible grouping",
    tagline: "The best grouping there is — not a guess.",
    how: "Works out the best grouping by building it up from smaller pieces rather than testing arrangements one at a time, which is what makes a complete answer practical at all. Two shortcuts skip the work entirely: a district already above 62.5% overall is fully funded as one group, and a one-school district has only one option.",
    when: "Any district of 16 schools or fewer, which covers about 88% of California districts. When this runs you get a guaranteed answer, and the other approaches are skipped because nothing can beat it.",
    cost: "moderate",
    autoRun: "always",
  },
  {
    key: "Exhaustive",
    label: "Every combination, one by one",
    tagline: "The slow way to a complete answer.",
    how: "Walks through every possible grouping in turn and keeps the best one. The count explodes quickly: 10 schools have about 116,000 arrangements and 15 schools have 1.4 billion. Past its limit it quietly falls back to leaving every school on its own.",
    when: "Kept only as a cross-check. The best-possible grouping reaches the same answer far faster and handles larger districts.",
    cost: "expensive",
    autoRun: "large districts only",
  },
  {
    key: "NYCMODA",
    label: "Guided search",
    tagline: "Try, adjust, and repeat — thousands of times.",
    how: "Starts from a random grouping, moves schools between groups, and keeps the changes that improve the result. It restarts from many different starting points so it does not settle for a merely decent answer. The same district always produces the same result.",
    when: "Districts too large to settle outright. This is the workhorse above 16 schools, and it is skipped below that, where a guaranteed answer is available instead.",
    cost: "expensive",
    autoRun: "large districts only",
  },
  {
    key: "GreedyLP",
    label: "Solver search",
    tagline: "Carve off the strongest group, then start again.",
    how: "Uses a mathematical solver to find the single best group it can, sets those schools aside, and repeats on the schools that remain.",
    when: "Large districts, as a steadier counterweight to the randomness of the guided search. Measured against guaranteed answers on small districts, it is the strongest of the search approaches.",
    cost: "moderate",
    autoRun: "large districts only",
  },
];

/** Friendly name for a grouping approach, for results the optimizer reports by its internal name. */
const LABEL_BY_KEY = new Map(STRATEGIES.map((s) => [s.key, s.label]));

export function strategyLabel(name: string): string {
  const key = name.split("?")[0];
  return LABEL_BY_KEY.get(key) ?? key;
}

export interface FieldDoc {
  label: string;
  /** Header to use in a spreadsheet, where the field comes from a file. */
  column?: string;
  required?: boolean;
  meaning: string;
  gotcha?: string;
}

export const SCHOOL_INPUT_FIELDS: FieldDoc[] = [
  {
    label: "School code",
    column: "school_code",
    required: true,
    meaning:
      "The code that identifies this school. Use whatever code your state or district already uses — it is how each school is named in your results.",
    gotcha: "A row with no school code is dropped. The upload here lists any dropped rows instead of losing them quietly.",
  },
  { label: "School name", column: "school_name", meaning: "What the school is called. Used for labeling only." },
  {
    label: "School type",
    column: "school_type",
    meaning: "Elementary, Middle, High, and so on. Carried through to your results; it does not change any of the math.",
  },
  {
    label: "Students enrolled",
    column: "total_enrolled",
    required: true,
    meaning: "Total students enrolled at the school.",
    gotcha: "A row with blank or zero enrollment is dropped, the same as a row with no school code.",
  },
  {
    label: "Identified students",
    column: "total_eligible",
    required: true,
    meaning:
      "Students already identified as eligible without an application: directly certified through SNAP, TANF or Medicaid, plus foster, homeless, migrant, and Head Start students.",
    gotcha: "If this is larger than enrollment it is reduced to match enrollment. Worth checking if a school's percentage looks wrong.",
  },
  {
    label: "Breakfasts served per day",
    column: "daily_breakfast_served",
    meaning: "Average number of breakfasts served on a typical day. Together with lunches, this is what turns eligibility into dollars.",
    gotcha: "Leave breakfasts and lunches at zero and every dollar figure comes back as $0. The grouping still works, but there is nothing to compare.",
  },
  {
    label: "Lunches served per day",
    column: "daily_lunch_served",
    meaning: "Average number of lunches served on a typical day. This drives most of the dollar estimate.",
  },
  {
    label: "Severe need breakfast",
    column: "severe_need",
    meaning:
      "Whether the school qualifies for the higher severe-need breakfast rate ($2.73 instead of $2.28 in the lower 48). Use TRUE or FALSE in a spreadsheet.",
  },
  {
    label: "Include this school",
    column: "active",
    meaning:
      "Leave blank or TRUE for schools you want grouped. Set it to FALSE to hold a school out of the grouping — one that is already covered another way, for instance.",
  },
];

export const DISTRICT_INPUT_FIELDS: FieldDoc[] = [
  { label: "District name", meaning: "Appears on your results. Nothing else uses it." },
  {
    label: "State",
    required: true,
    meaning:
      "Selects the USDA reimbursement rates. Alaska, Hawaii and the territories are paid noticeably more per meal than the lower 48.",
  },
  {
    label: "Eligibility threshold",
    meaning:
      "The lowest identified student percentage a group can have and still earn anything under CEP. The federal floor has been 25% since October 2023; before that it was 40%.",
    gotcha: "Changing this models a different rule — it does not find you more money. Leave it at 25% unless you are testing a what-if.",
  },
  {
    label: "School food authority certified",
    meaning: "Turn on if your SFA is certified for the performance-based extra 7¢ per lunch.",
  },
  {
    label: "Paid lunch equity band",
    meaning:
      "Which paid lunch equity band your district falls in, set under the Healthy, Hunger-Free Kids Act. It shifts every per-meal rate slightly.",
  },
  {
    label: "Maximum number of groups",
    meaning:
      "The most groups you are willing to actually administer. Any grouping that needs more than this is set aside before a winner is picked.",
    gotcha: "Set it too low and good options get discarded; set it too high and you may end up with more groups than your office can manage.",
  },
  {
    label: "Optimize for",
    meaning:
      "Whether the best grouping is the one that brings in the most money, or the one that covers the most students. The two do not always point to the same answer.",
  },
];
