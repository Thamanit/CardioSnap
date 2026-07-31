'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type WithId<T> = T & { id: string | number };

export interface UseTableOptions {
  /** Column to filter on, e.g. { column: 'patient_id', value: 123 } */
  filter?: { column: string; value: any } | { column: string; value: any }[];
  /** Column to order by */
  orderBy?: { column: string; ascending?: boolean };
  /** Limit number of rows */
  limit?: number;
  /** Select specific columns or join syntax, defaults to '*' */
  select?: string;
  /** Whether to subscribe to real-time changes. Defaults to false. */
  realtime?: boolean;
}

export interface UseTableResult<T> {
  data: T[] | null;
  isLoading: boolean;
  error: Error | null;
  /** Manually re-fetch data */
  refetch: () => void;
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

/**
 * React hook to fetch rows from a Supabase table.
 * Optionally subscribes to real-time changes via Supabase Realtime.
 *
 * @template T The expected row type.
 * @param table The table name to query.
 * @param options Filter, ordering, limit, and real-time options.
 */
export function useTable<T = any>(
  table: string | null | undefined,
  options: UseTableOptions = {},
): UseTableResult<T> {
  const [data, setData] = useState<T[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Serialize options for dependency tracking
  const optionsKey = JSON.stringify({
    filter: options.filter,
    orderBy: options.orderBy,
    limit: options.limit,
    select: options.select,
    realtime: options.realtime,
  });

  const fetchData = useCallback(async () => {
    if (!table) {
      setData(null);
      setIsLoading(false);
      return;
    }

    const supabase = getSupabaseClient();
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase.from(table).select(options.select ?? '*');

      // Apply filters
      if (options.filter) {
        const filters = Array.isArray(options.filter) ? options.filter : [options.filter];
        for (const f of filters) {
          query = query.eq(f.column, f.value);
        }
      }

      // Apply ordering
      if (options.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.ascending ?? true,
        });
      }

      // Apply limit
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data: rows, error: queryError } = await query;

      if (queryError) {
        setError(queryError);
        setData(null);
      } else {
        setData(rows as T[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
      setData(null);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, optionsKey]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time subscription
  useEffect(() => {
    if (!table || !options.realtime) return;

    const supabase = getSupabaseClient();

    const channel = supabase
      .channel(`table-${table}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          // Re-fetch on any change to the table
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, options.realtime, fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
