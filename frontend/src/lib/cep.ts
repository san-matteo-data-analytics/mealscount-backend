/**
 * The CEP arithmetic, ported from strategies/base.py so the UI can show the
 * intermediate steps live instead of only the optimizer's final answer.
 * Keep this in sync with `isp_to_free_rate` and `CEPRate` on the Python side.
 */
import type { HhfkaSixty, Rates } from "./types";
// USDA per-meal rates by school year, shared with CEPRate on the Python side.
import MEAL_RATES from "../../../strategies/meal_rates.json";

/** 7 CFR 245.9(f)(3)(i) — dropped from 40% to 25% on 2023-10-26. */
export const DEFAULT_ISP_THRESHOLD = 0.25;

/** The USDA multiplier applied to ISP to get the share of meals paid at the free rate. */
export const FREE_RATE_MULTIPLIER = 1.6;

/** ISP at which the multiplier saturates: 1 / 1.6 = 62.5%. */
export const FULL_FUNDING_ISP = 1 / FREE_RATE_MULTIPLIER;

type SchoolYear = keyof typeof MEAL_RATES.school_years;

/** The school year whose rates the optimizer uses unless told otherwise. */
export const DEFAULT_SCHOOL_YEAR = MEAL_RATES.default_school_year as SchoolYear;

/** Performance-based lunch add-on for certified School Food Authorities. */
export const SFA_LUNCH_BONUS = MEAL_RATES.school_years[DEFAULT_SCHOOL_YEAR].sfa_lunch_bonus;

export function ispToFreeRate(isp: number, ispThreshold = DEFAULT_ISP_THRESHOLD): number {
  if (isp < ispThreshold) return 0;
  return Math.min(isp * FREE_RATE_MULTIPLIER, 1);
}

export function paidRate(freeRate: number): number {
  return freeRate === 0 ? 0 : 1 - freeRate;
}

/**
 * Which of the three USDA rate tables a jurisdiction claims under, from the
 * rate_tiers in meal_rates.json -- the same lookup as rate_tier() in strategies/base.py.
 */
export type RateTier = "ak" | "hi" | "contiguous";

export function rateTier(stateCode: string): RateTier {
  const state = stateCode.toUpperCase();
  for (const [tier, states] of Object.entries(MEAL_RATES.rate_tiers)) {
    if (states.includes(state)) return tier as RateTier;
  }
  return "contiguous";
}

/** One-line description of a tier, for UI that explains what the state picker does. */
export const RATE_TIER_LABEL: Record<RateTier, string> = {
  ak: "Alaska meal rates — the highest in the country.",
  hi: "Hawaii and territories meal rates — higher than the lower 48.",
  contiguous: "Standard lower-48 meal rates.",
};

/** Per-meal rates from meal_rates.json, the same table CEPRate in strategies/base.py reads. */
export function getRates(
  stateCode: string,
  hhfkaSixty: HhfkaSixty,
  severeNeed: boolean,
  schoolYear: SchoolYear = DEFAULT_SCHOOL_YEAR,
): Rates {
  const table = MEAL_RATES.school_years[schoolYear][rateTier(stateCode)];
  const lunch = table.lunch[hhfkaSixty];
  const breakfast = severeNeed ? table.breakfast.severe_need : table.breakfast.normal;
  return {
    free_lunch: lunch.free,
    paid_lunch: lunch.paid,
    free_bfast: breakfast.free,
    paid_bfast: breakfast.paid,
  };
}

/** Daily dollars for one school inside a group with the given free rate. */
export function schoolReimbursement(args: {
  breakfastServed: number;
  lunchServed: number;
  freeRate: number;
  rates: Rates;
  sfaCertified: boolean;
}): number {
  const { breakfastServed, lunchServed, freeRate, rates, sfaCertified } = args;
  if (freeRate === 0) return 0;
  const paid = paidRate(freeRate);
  let total =
    breakfastServed * rates.free_bfast * freeRate +
    breakfastServed * rates.paid_bfast * paid +
    lunchServed * rates.free_lunch * freeRate +
    lunchServed * rates.paid_lunch * paid;
  if (sfaCertified) total += lunchServed * SFA_LUNCH_BONUS;
  return Math.round(total * 100) / 100;
}

/** Typical school year length used to annualize the optimizer's daily figure. */
export const SERVING_DAYS_PER_YEAR = 180;

export const usd = (n: number, digits = 0) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export const pct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;

export const num = (n: number) => n.toLocaleString("en-US");
