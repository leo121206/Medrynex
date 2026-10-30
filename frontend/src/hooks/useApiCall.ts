/**
 * useApiCall — A reusable hook for data-fetching with loading, error, and empty-state handling.
 *
 * Usage:
 *   const { data, loading, error, refetch } = useApiCall(() => recordsService.getRecords(), []);
 *
 * The `initialData` parameter sets the value used before the first fetch completes (typically []).
 * On error, `data` stays as `initialData` and `error` is set.
 */
import { useState, useEffect, useCallback, useRef } from 'react';

interface UseApiCallResult<T> {
  data: T;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApiCall<T>(
  fetcher: () => Promise<T>,
  initialData: T,
  deps: unknown[] = []
): UseApiCallResult<T> {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetcher()
      .then((result) => {
        if (active && mountedRef.current) {
          setData(result);
        }
      })
      .catch((err) => {
        if (active && mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to load data.');
          // Keep initialData on error — no fake substitution
          setData(initialData);
        }
      })
      .finally(() => {
        if (active && mountedRef.current) setLoading(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { data, loading, error, refetch };
}
