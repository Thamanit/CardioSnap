'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface AppAuthUser {
  uid: string;
  id: string;
  email: string | null;
  displayName: string | null;
  user_metadata?: Record<string, any>;
}

export interface UserHookResult {
  user: AppAuthUser | null;
  isUserLoading: boolean;
  userError: Error | null;
}

interface SupabaseContextState {
  user: AppAuthUser | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// ─────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────

const SupabaseContext = createContext<SupabaseContextState | undefined>(undefined);

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function normalizeUser(user: User): AppAuthUser {
  const meta = user.user_metadata ?? {};
  const displayName =
    meta.full_name ||
    (meta.first_name
      ? `${meta.first_name ?? ''} ${meta.last_name ?? ''}`.trim()
      : null);

  return {
    uid: user.id,
    id: user.id,
    email: user.email ?? null,
    displayName,
    user_metadata: meta,
  };
}

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────

interface SupabaseProviderProps {
  children: ReactNode;
}

export function SupabaseProvider({ children }: SupabaseProviderProps) {
  const [user, setUser] = useState<AppAuthUser | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [userError, setUserError] = useState<Error | null>(null);

  useEffect(() => {
    if (!supabase) {
      setUser(null);
      setIsUserLoading(false);
      setUserError(new Error('Supabase client not initialized. Check environment variables.'));
      return;
    }

    let isMounted = true;

    // Get initial session
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase!.auth.getSession();
        if (!isMounted) return;
        if (error) {
          setUserError(error);
          setUser(null);
        } else {
          setUser(session?.user ? normalizeUser(session.user) : null);
        }
      } catch (err) {
        if (!isMounted) return;
        setUserError(err instanceof Error ? err : new Error('Failed to get session'));
        setUser(null);
      } finally {
        if (isMounted) setIsUserLoading(false);
      }
    };

    void initSession();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase!.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (!isMounted) return;
      setUser(session?.user ? normalizeUser(session.user) : null);
      setIsUserLoading(false);
      setUserError(null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const contextValue = useMemo((): SupabaseContextState => ({
    user,
    isUserLoading,
    userError,
  }), [user, isUserLoading, userError]);

  return (
    <SupabaseContext.Provider value={contextValue}>
      {children}
    </SupabaseContext.Provider>
  );
}

// ─────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────

/**
 * Hook to access the authenticated user's state.
 * @returns {UserHookResult} Object with user, isUserLoading, userError.
 */
export function useUser(): UserHookResult {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a SupabaseProvider.');
  }
  return {
    user: context.user,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
  };
}
