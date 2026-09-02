import type { OptimizeEvent, OptimizeRequest, OptimizeResponse } from "./types";
import type { StateOption } from "./states";

const STREAM_URL = "/api/districts/optimize-stream/";
const BLOCKING_URL = "/api/districts/optimize/";

export interface OptimizeOptions {
  /** Abort the run. The server keeps working, but the UI stops waiting. */
  signal?: AbortSignal;
  /** Called for every record the streaming endpoint emits. */
  onEvent?: (event: OptimizeEvent) => void;
  /** Called when the origin has no streaming endpoint and no progress is coming. */
  onFallback?: () => void;
}

/** True when a thrown value is the caller's own abort rather than a failure. */
export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException ? e.name === "AbortError" : false;
}

/**
 * Runs an optimization, reporting progress as it goes.
 *
 * Prefers /optimize-stream/, which narrates each strategy as it finishes. An
 * origin that predates that endpoint (production, via MEALSCOUNT_API_ORIGIN)
 * 404s, and we fall back to the blocking /optimize/ — same answer, no progress.
 */
export async function optimizeDistrict(
  req: OptimizeRequest,
  opts: OptimizeOptions = {},
): Promise<OptimizeResponse> {
  const streamed = await streamOptimize(req, opts);
  if (streamed) return streamed;
  opts.onFallback?.();
  return blockingOptimize(req, opts.signal);
}

/** Returns null when this origin has no streaming endpoint, so the caller can fall back. */
async function streamOptimize(
  req: OptimizeRequest,
  opts: OptimizeOptions,
): Promise<OptimizeResponse | null> {
  let res: Response;
  try {
    res = await fetch(STREAM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: opts.signal,
    });
  } catch (e) {
    throw unreachable(e);
  }

  // Not implemented here — fall back rather than failing the run.
  if (res.status === 404 || res.status === 405) return null;
  if (!res.ok) throw statusError(res);

  // The endpoint rejects a bad payload with plain JSON before any streaming
  // starts, so a non-ndjson body is an error report, not a stream.
  if (!res.headers.get("content-type")?.includes("ndjson")) {
    return unwrap((await res.json()) as OptimizeResponse);
  }
  if (!res.body) return null;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: OptimizeResponse | null = null;

  const consume = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let event: OptimizeEvent;
    try {
      event = JSON.parse(trimmed) as OptimizeEvent;
    } catch {
      // A truncated final line means the connection died mid-record; the
      // missing "done" below is the error we want to report, not this.
      return;
    }
    opts.onEvent?.(event);
    if (event.event === "error") throw new Error(event.error);
    if (event.event === "done") result = event.result;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Records are newline-delimited; the tail may be a partial one.
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) consume(line);
    }
    consume(buffer);
  } catch (e) {
    if (isAbortError(e)) throw e;
    if (e instanceof Error && !(e instanceof TypeError)) throw e;
    throw unreachable(e);
  } finally {
    void reader.cancel().catch(() => {});
  }

  if (!result) {
    throw new Error(
      "The connection dropped before the optimizer finished. Your schools are still here — " +
        "try running it again.",
    );
  }
  return unwrap(result);
}

/** The original one-shot call. No progress until the whole run completes. */
async function blockingOptimize(
  req: OptimizeRequest,
  signal?: AbortSignal,
): Promise<OptimizeResponse> {
  let res: Response;
  try {
    res = await fetch(BLOCKING_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal,
    });
  } catch (e) {
    throw unreachable(e);
  }
  if (!res.ok) throw statusError(res);
  return unwrap((await res.json()) as OptimizeResponse);
}

function unwrap(data: OptimizeResponse): OptimizeResponse {
  if (data.error) throw new Error(data.error);
  return data;
}

function statusError(res: Response): Error {
  // A 504/502 on a long run is the proxy giving up, not the optimizer failing.
  if (res.status === 502 || res.status === 504) {
    return new Error(
      "The optimizer was still working when the connection timed out. This usually means the " +
        "district is very large — try again, or lower the maximum number of groups.",
    );
  }
  return new Error(
    `The optimizer could not complete the run (error ${res.status}). Please try again.`,
  );
}

function unreachable(cause: unknown): Error {
  if (isAbortError(cause)) return cause as unknown as Error;
  return new Error(
    "The optimizer could not be reached. Check your connection and try again.",
    { cause },
  );
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
