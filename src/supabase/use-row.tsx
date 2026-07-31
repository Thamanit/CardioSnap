'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface UseRowResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  /** Manually re-fetch data */
  refetch: () => void;
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

/**
 * React hook to fetch a single row from a Supabase table by its primary key.
 * Optionally subscribes to real-time changes.
 *
 * @template T The expected row type.
 * @param table The table name to query.
 * @param id The primary key value (uses 'id' column by default).
 * @param options Additional options.
 */
export function useRow<T = any>(
  table: string | null | undefined,
  id: string | number | null | undefined,
  options: {
    /** The primary key column name. Defaults to 'id'. */
    idColumn?: string;
    /** Select specific columns or join syntax. Defaults to '*'. */
    select?: string;
    /** Whether to subscribe to real-time changes. Defaults to false. */
    realtime?: boolean;
  } = {},
): UseRowResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const idColumn = options.idColumn ?? 'id';
  const select = options.select ?? '*';
  const realtime = options.realtime ?? false;

  const fetchData = useCallback(async () => {
    if (!table || id === null || id === undefined) {
      setData(null);
      setIsLoading(false);
      return;
    }

    const supabase = getSupabaseClient();
    setIsLoading(true);
    setError(null);

    try {
      const { data: row, error: queryError } = await supabase
        .from(table)
        .select(select)
        .eq(idColumn, id)
        .single();

      if (queryError) {
        setError(queryError);
        setData(null);
      } else {
        setData(row as T);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch row'));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [table, id, idColumn, select]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time subscription
  useEffect(() => {
    if (!table || !id || !realtime) return;

    const supabase = getSupabaseClient();

    const channel = supabase
      .channel(`row-${table}-${id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `${idColumn}=eq.${id}`,
        },
        () => {
          fetchData();
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, id, idColumn, realtime, fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
