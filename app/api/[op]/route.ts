import { NextResponse } from 'next/server';
import { mockSource } from '@/lib/mock-source';
import { isSnowflakeConfigured, liveSource } from '@/lib/snowflake';
import type { SalesSource } from '@/lib/sales-data';
import type { Persona, Scope } from '@/lib/types';

const OPS = new Set(['overview', 'dealers', 'dealer', 'definitions', 'ask', 'brief']);
const PERSONAS = new Set<Persona>(['director', 'rep']);

function cleanScope(raw: unknown): Scope {
  const s = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.length && v.length < 40 ? v : null);
  return { persona: PERSONAS.has(s.persona as Persona) ? (s.persona as Persona) : 'director', region: str(s.region), product: str(s.product), tier: str(s.tier) };
}

export async function POST(request: Request, ctx: { params: Promise<{ op: string }> }) {
  const { op } = await ctx.params;
  if (!OPS.has(op)) return NextResponse.json({ error: 'Unknown operation' }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const scope = cleanScope(body.scope);
  const id = typeof body.id === 'string' ? body.id.slice(0, 20) : '';
  const question = typeof body.question === 'string' ? body.question.slice(0, 500) : '';

  const live = isSnowflakeConfigured();
  const src: SalesSource = live ? liveSource : mockSource;
  try {
    const data = await ({
      overview: () => src.overview(scope),
      dealers: () => src.dealers(scope),
      dealer: () => src.dealer(scope, id),
      definitions: () => src.definitions(),
      ask: () => src.ask(scope, question),
      brief: () => src.brief(scope, id),
    } as Record<string, () => Promise<unknown>>)[op]();
    return NextResponse.json({ data, mode: live ? 'live' : 'sample' });
  } catch (err) {
    console.error(`[${op}] ${live ? 'live' : 'sample'} source failed:`, err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Request failed' }, { status: 500 });
  }
}
