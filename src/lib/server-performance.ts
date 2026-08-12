import { AsyncLocalStorage } from "node:async_hooks";

type QueryTiming = {
  count: number;
  totalMs: number;
  maxMs: number;
};

type PerformanceContext = {
  route: string;
  startedAt: number;
  queryCount: number;
  supabaseMs: number;
  queries: Map<string, QueryTiming>;
};

const performanceStorage = new AsyncLocalStorage<PerformanceContext>();

function isEnabled() {
  return process.env.SERVER_PERF_LOGS === "1";
}

function getSafeEndpoint(input: RequestInfo | URL) {
  try {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const url = new URL(rawUrl);

    const isSupabaseHost =
      url.hostname.includes("supabase") ||
      ((url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
        url.port === "54321");
    if (!isSupabaseHost) return null;
    return url.pathname;
  } catch {
    return null;
  }
}

export const profiledFetch: typeof fetch = async (input, init) => {
  const context = performanceStorage.getStore();
  const endpoint = context ? getSafeEndpoint(input) : null;

  if (!context || !endpoint) return fetch(input, init);

  const startedAt = performance.now();
  try {
    return await fetch(input, init);
  } finally {
    const durationMs = performance.now() - startedAt;
    const current = context.queries.get(endpoint) ?? {
      count: 0,
      totalMs: 0,
      maxMs: 0,
    };
    current.count += 1;
    current.totalMs += durationMs;
    current.maxMs = Math.max(current.maxMs, durationMs);
    context.queries.set(endpoint, current);
    context.queryCount += 1;
    context.supabaseMs += durationMs;
  }
};

export async function profileServerOperation<T>(
  route: string,
  operation: () => Promise<T>,
): Promise<T> {
  if (!isEnabled()) return operation();

  const context: PerformanceContext = {
    route,
    startedAt: performance.now(),
    queryCount: 0,
    supabaseMs: 0,
    queries: new Map(),
  };

  return performanceStorage.run(context, async () => {
    try {
      return await operation();
    } finally {
      const queries = [...context.queries.entries()].map(
        ([endpoint, timing]) => ({
          endpoint,
          count: timing.count,
          totalMs: Math.round(timing.totalMs),
          maxMs: Math.round(timing.maxMs),
        }),
      );
      console.info(
        "[server-perf]",
        JSON.stringify({
          route: context.route,
          totalMs: Math.round(performance.now() - context.startedAt),
          queryCount: context.queryCount,
          supabaseMs: Math.round(context.supabaseMs),
          queries,
        }),
      );
    }
  });
}
