/**
 * The CEP arithmetic, ported from strategies/base.py so the UI can show the
 * intermediate steps live instead of only the optimizer's final answer.
 * Keep this in sync with `isp_to_free_rate` and `CEPRate` on the Python side.
 */
import type { HhfkaSixty, Rates } from "./types";

/** 7 CFR 245.9(f)(3)(i) — dropped from 40% to 25% on 2023-10-26. */
export const DEFAULT_ISP_THRESHOLD = 0.25;

/** The USDA multiplier applied to ISP to get the share of meals paid at the free rate. */
export const FREE_RATE_MULTIPLIER = 1.6;

/** ISP at which the multiplier saturates: 1 / 1.6 = 62.5%. */
export const FULL_FUNDING_ISP = 1 / FREE_RATE_MULTIPLIER;

/** Performance-based lunch add-on for certified School Food Authorities. */
export const SFA_LUNCH_BONUS = 0.07;

export function ispToFreeRate(isp: number, ispThreshold = DEFAULT_ISP_THRESHOLD): number {
  if (isp < ispThreshold) return 0;
  return Math.min(isp * FREE_RATE_MULTIPLIER, 1);
}

export function paidRate(freeRate: number): number {
  return freeRate === 0 ? 0 : 1 - freeRate;
}

/**
 * Which of the three USDA rate tables a jurisdiction claims under.
 * Mirrors the branches in CEPRate.__init__ (strategies/base.py) exactly --
 * note "GM" is the code the Python side checks, so Guam ("gu") falls through
 * to the contiguous-48 table on both sides.
 */
export type RateTier = "ak" | "hi" | "contiguous";

export function rateTier(stateCode: string): RateTier {
  const state = stateCode.toUpperCase();
  if (state === "AK") return "ak";
  if (["PR", "GM", "HI", "VI"].includes(state)) return "hi";
  return "contiguous";
}

/** One-line description of a tier, for UI that explains what the state picker does. */
export const RATE_TIER_LABEL: Record<RateTier, string> = {
  ak: "Alaska meal rates — the highest in the country.",
  hi: "Hawaii and territories meal rates — higher than the lower 48.",
  contiguous: "Standard lower-48 meal rates.",
};

/** SY23-24 rate table from CEPRate in strategies/base.py. */
export function getRates(
  stateCode: string,
  hhfkaSixty: HhfkaSixty,
  severeNeed: boolean,
): Rates {
  let freeLunch: number, paidLunch: number;

  switch (rateTier(stateCode)) {
    case "ak":
      [freeLunch, paidLunch] =
        hhfkaSixty === "less" ? [6.9, 0.66] : hhfkaSixty === "more" ? [6.92, 0.68] : [7.14, 0.76];
      return {
        free_lunch: freeLunch,
        paid_lunch: paidLunch,
        free_bfast: severeNeed ? 4.39 : 3.66,
        paid_bfast: 0.58,
      };

    case "hi":
      [freeLunch, paidLunch] =
        hhfkaSixty === "less" ? [5.54, 0.53] : hhfkaSixty === "more" ? [5.56, 0.55] : [5.74, 0.61];
      return {
        free_lunch: freeLunch,
        paid_lunch: paidLunch,
        free_bfast: severeNeed ? 3.53 : 2.95,
        paid_bfast: 0.47,
      };

    default:
      [freeLunch, paidLunch] =
        hhfkaSixty === "less" ? [4.25, 0.4] : hhfkaSixty === "more" ? [4.27, 0.42] : [4.42, 0.48];
      return {
        free_lunch: freeLunch,
        paid_lunch: paidLunch,
        free_bfast: severeNeed ? 2.73 : 2.28,
        paid_bfast: 0.38,
      };
  }
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
