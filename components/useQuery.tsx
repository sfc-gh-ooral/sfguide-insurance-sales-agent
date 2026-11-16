'use client';
import { useEffect, useState } from 'react';
import type { Mode } from '@/lib/client';
import { useAppState } from './AppState';

// Loads data for a page and reports whether it came from sample data or Snowflake.
export function useQuery<T>(load: () => Promise<{ data: T; mode: Mode }>, deps: unknown[]) {
  const { reportMode } = useAppState();
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    load()
      .then((r) => { if (live) { setState({ data: r.data, error: null, loading: false }); reportMode(r.mode); } })
      .catch((e: Error) => live && setState({ data: null, error: e.message, loading: false }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="animate-pulse rounded-xl border border-line bg-surface p-8 text-sm text-muted">{label}</div>;
}

export function ErrorNote({ message }: { message: string }) {
  return <div role="alert" className="rounded-xl border border-negative/40 bg-surface p-5 text-sm text-negative">Couldn&apos;t load data: {message}</div>;
}
