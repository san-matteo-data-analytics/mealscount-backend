import type { OptimizeRequest, OptimizeResponse } from "./types";
import type { StateOption } from "./states";

/**
 * Posts to the Flask API. In dev this goes through the rewrite in next.config.ts,
 * so the browser only ever talks to the Next server.
 */
export async function optimizeDistrict(req: OptimizeRequest): Promise<OptimizeResponse> {
  const res = await fetch("/api/districts/optimize/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    throw new Error(
      `The optimizer returned ${res.status} ${res.statusText}. Is the Flask server (server.py) running?`,
    );
  }

  const data = (await res.json()) as OptimizeResponse;
  if (data.error) throw new Error(data.error);
  return data;
}

/** One value in the `/api/states/` map (server.py `states()`). */
interface StateResponse {
  name?: string;
  fips?: string;
  state_code?: string;
}

let statesPromise: Promise<StateOption[]> | null = null;

/**
 * The states server.py has data for, keyed by lowercase code on the wire.
 * Cached for the session — the list only changes when data/ does. A failed
 * fetch is not cached, so a later mount retries; callers are expected to fall
 * back to US_JURISDICTIONS since the picker only selects a rate table.
 */
export function fetchStates(): Promise<StateOption[]> {
  if (!statesPromise) {
    statesPromise = loadStates().catch((e) => {
      statesPromise = null;
      throw e;
    });
  }
  return statesPromise;
}

async function loadStates(): Promise<StateOption[]> {
  const res = await fetch("/api/states/");
  if (!res.ok) throw new Error(`/api/states/ returned ${res.status} ${res.statusText}`);
  const data = (await res.json()) as Record<string, StateResponse>;
  return Object.entries(data).map(([code, info]) => ({
    code: (info.state_code ?? code).toLowerCase(),
    name: info.name ?? code.toUpperCase(),
  }));
}
