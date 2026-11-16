'use client';
// Browser-side access to the data layer. The hosted example calls the mock source directly;
// `npm run dev` goes through /api/*, which uses Snowflake when .env.local is configured.
import { HOSTED_EXAMPLE } from './hosted';
import type { SalesSource } from './sales-data';
import type { AgentAnswer, DealerDetail, DealerRow, MetricDefinition, Overview, Scope, VisitBrief } from './types';

export type Mode = 'sample' | 'live';

// The header switch sets this; every request carries it so the server serves the chosen source.
let requested: Mode = 'sample';
export const setRequestedMode = (m: Mode) => { requested = m; };

async function call<T>(op: string, body: Record<string, unknown>): Promise<{ data: T; mode: Mode; ms: number }> {
  const t0 = performance.now();
  const done = <R extends { data: T; mode: Mode }>(r: R) => ({ ...r, ms: Math.round(performance.now() - t0) });
  if (HOSTED_EXAMPLE) {
    const { mockSource } = await import('./mock-source');
    const src = mockSource as SalesSource;
    const s = body.scope as Scope;
    const data = await ({
      overview: () => src.overview(s),
      dealers: () => src.dealers(s),
      dealer: () => src.dealer(s, body.id as string),
      definitions: () => src.definitions(),
      ask: () => src.ask(s, body.question as string),
      brief: () => src.brief(s, body.id as string),
    } as Record<string, () => Promise<unknown>>)[op]();
    return done({ data: data as T, mode: 'sample' as Mode });
  }
  const res = await fetch(`/api/${op}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, mode: requested }) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return done(json as { data: T; mode: Mode });
}

export const api = {
  overview: (scope: Scope) => call<Overview>('overview', { scope }),
  dealers: (scope: Scope) => call<DealerRow[]>('dealers', { scope }),
  dealer: (scope: Scope, id: string) => call<DealerDetail | null>('dealer', { scope, id }),
  definitions: () => call<MetricDefinition[]>('definitions', {}),
  ask: (scope: Scope, question: string) => call<AgentAnswer>('ask', { scope, question }),
  brief: (scope: Scope, id: string) => call<VisitBrief>('brief', { scope, id }),
};
