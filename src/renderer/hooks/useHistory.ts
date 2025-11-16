import { useCallback, useEffect, useState } from "react";
import type { HistoryEntry } from "../../shared/history/types";

interface UseHistoryOptions {
  deckName?: string | null;
  pageSize?: number;
}

interface UseHistoryResult {
  entries: HistoryEntry[];
  loading: boolean;
  error: string | null;
  total: number;
  hasMore: boolean;
  reload: () => void;
  loadMore: () => void;
}

export function useHistory(options: UseHistoryOptions = {}): UseHistoryResult {
  const { deckName = null, pageSize = 50 } = options;
  
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(pageSize);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  // when deckName or pageSize changes, reset limit & entries
  useEffect(() => {
    setLimit(pageSize);
    setEntries([]);
    setTotal(0);
    setError(null);
    setRefreshToken(prev => prev + 1);
  }, [deckName, pageSize]);

  useEffect(() => {
    let cancelled = false;
    async function fetchHistory() {
      setLoading(true);
      setError(null);

      try {
        const snapshot = await window.api.history.get({
          deck: deckName ?? undefined,
          limit,
        });
        if (cancelled) return;

        setEntries(snapshot.entries ?? []);
        setTotal(snapshot.total ?? 0);
      } catch (err: any) {
        if (cancelled) return;
        const msg = err?.message ?? String(err);
        setError(msg);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    fetchHistory();

    return () => {
      cancelled = true;
    };
  }, [deckName, limit, refreshToken]);

  const reload = useCallback(() => {
    setRefreshToken(prev => prev + 1);
  }, []);

  const loadMore = useCallback(() => {
    setLimit(prev => prev + pageSize);
  }, [pageSize]);

  const hasMore = entries.length < total;

  // subscribe to push updates from main
  useEffect(() => {
    if (!window.api.history?.onUpdate) return;
    const unsubscribe = window.api.history.onUpdate(() => {
      reload();
    });
    return () => {
      unsubscribe();
    };
  }, [reload]);

  return {
    entries,
    loading,
    error,
    total,
    hasMore,
    reload,
    loadMore,
  }
}