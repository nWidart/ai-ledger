// The pages' read of the API: a thin adapter over TanStack Query's useQuery that keeps the interface they were written
// against ({ data, error, loading, retry }, null for nothing to fetch, keepPrevious for a page changing filters). The
// cache, the dedupe of equal requests, cancellation of a request nobody shows any more, and eviction are Query's; the
// keys and fetchers are in queries.ts.
import { skipToken, useQuery, type QueryKey, type UseQueryOptions } from "@tanstack/react-query";
import { useCallback, useState } from "react";

export { ApiError, getJson } from "./api";

export interface ApiState<T> {
  data: T | undefined;
  /** The last failure, reported only while no fetch is under way (Retry clears it at once). */
  error: Error | undefined;
  /** A request is under way (data may still be the previous answer). */
  loading: boolean;
  /** data is the last key's, kept (keepPrevious) while this key loads or after it failed. */
  previous: boolean;
  retry: () => void;
}

/**
 * The query's data (null: nothing to fetch). data stays while the same key refetches after an invalidation.
 * keepPrevious: also keep the last key's data while a new key loads or fails (a page changing filters keeps its numbers on screen).
 */
export function useApi<T, K extends QueryKey = QueryKey>(options: UseQueryOptions<T, Error, T, K> | null, opts: { keepPrevious?: boolean } = {}): ApiState<T> {
  const q = useQuery<T, Error, T, K>(options ?? { queryKey: ["idle"] as unknown as K, queryFn: skipToken });
  // Kept here rather than as placeholderData: it also holds the old data when the new key fails, which placeholderData drops.
  const [kept, setKept] = useState<T | undefined>(undefined);
  if (q.data !== undefined && q.data !== kept) setKept(q.data);
  const { refetch } = q;
  return {
    data: q.data ?? (opts.keepPrevious ? kept : undefined),
    error: q.isFetching ? undefined : q.error ?? undefined,
    loading: q.isFetching || (options != null && q.isPending),
    previous: q.data === undefined && !!opts.keepPrevious && kept !== undefined,
    retry: useCallback(() => { void refetch(); }, [refetch]),
  };
}
