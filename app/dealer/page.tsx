'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ArrowLeft, Bookmark, Check, Sparkles } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/client';
import { saveInsight } from '@/lib/insights';
import type { VisitBrief } from '@/lib/types';
import { cn, fmtNum, fmtPct, fmtUsd, monthLabel, yoy } from '@/lib/utils';
import { useAppState } from '@/components/AppState';
import { Card, CardHeader, Delta, PoweredBy, RichText, SampleAiLabel, ThinkingSteps } from '@/components/ui';
import { ErrorNote, Loading, useQuery } from '@/components/useQuery';

// Each step names work the live path really performs (see lib/snowflake.ts brief()).
const BRIEF_STEPS = [
  'Applying your role\'s row access policy (TERRITORY_POLICY)',
  'Querying this dealer\'s metrics on INSURANCE_SALES_WH',
  'Drafting the brief with AI_COMPLETE (claude-sonnet-4-5)',
];

export default function DealerPage() {
  return <Suspense fallback={<Loading />}><DealerDetailView /></Suspense>;
}

function DealerDetailView() {
  const id = useSearchParams().get('id') ?? '';
  const { persona, preferred } = useAppState();
  const { data, error, loading } = useQuery(() => api.dealer({ persona }, id), [persona, id]);
  const [brief, setBrief] = useState<VisitBrief | null>(null);
  const [briefMs, setBriefMs] = useState<number | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (error) return <ErrorNote message={error} />;
  if (loading && !data) return <Loading />;
  if (!data) {
    return (
      <Card>
        <p className="text-sm text-ink-2">This dealer isn&apos;t in your territory. The row access policy only returns dealers you cover.</p>
        <Link href="/dealers" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"><ArrowLeft className="h-3 w-3" /> Back to your dealers</Link>
      </Card>
    );
  }

  const d = data.dealer;
  const totals = data.productMix.reduce((s, p) => ({ ttm: s.ttm + p.contracts.ttm, prior: s.prior + p.contracts.prior, prem: s.prem + p.premium.ttm }), { ttm: 0, prior: 0, prem: 0 });
  const decomp = data.decomposition.filter((x) => x.ttm.premium + x.prior.premium > 0);
  const generate = async () => {
    setBriefLoading(true); setBriefError(null); setSaved(false);
    try { const r = await api.brief({ persona }, id); setBrief(r.data); setBriefMs(r.ms); } catch (e) { setBriefError((e as Error).message); } finally { setBriefLoading(false); }
  };
  const save = () => {
    if (!brief) return;
    saveInsight({ kind: 'brief', title: `Visit brief: ${d.name}`, body: brief.text, dealerId: d.id,
      source: brief.source === 'sample' ? 'Sample AI response' : `AI_COMPLETE (${brief.model})` });
    setSaved(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dealers" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"><ArrowLeft className="h-3 w-3" /> Dealer explorer</Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink">{d.name}</h1>
            <p className="mt-1 text-sm text-muted">{d.state} {d.zip} · {d.territory} · {d.tier} · {d.group} · {d.brand} · Rep {d.rep} · since {d.onboarded.slice(0, 4)}</p>
          </div>
          <div className="flex gap-6 text-right">
            <div><div className="text-[11px] uppercase tracking-wide text-muted">Contracts</div><div className="text-lg font-semibold tabular text-ink">{fmtNum(totals.ttm)}</div><Delta value={yoy(totals.ttm, totals.prior)} /></div>
            <div><div className="text-[11px] uppercase tracking-wide text-muted">Premium</div><div className="text-lg font-semibold tabular text-ink">{fmtUsd(totals.prem)}</div></div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Loss ratio decomposition" subtitle="Loss ratio ≈ frequency (claims per contract) × severity (avg paid claim) ÷ avg premium. This year vs last year." right={<PoweredBy label="Semantic View" />} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted"><th className="pb-2">Product</th><th className="pb-2 text-right">Loss ratio</th><th className="pb-2 text-right">Frequency</th><th className="pb-2 text-right">Severity</th><th className="pb-2 text-right">Driver</th></tr></thead>
                <tbody>
                  {decomp.map((x) => {
                    const fr = x.prior.frequency && x.ttm.frequency ? x.ttm.frequency / x.prior.frequency - 1 : null;
                    const sv = x.prior.severity && x.ttm.severity ? x.ttm.severity / x.prior.severity - 1 : null;
                    const lrUp = (x.ttm.lossRatio ?? 0) - (x.prior.lossRatio ?? 0);
                    const driver = Math.abs(lrUp) < 0.05 || fr === null || sv === null ? 'Stable' : Math.abs(sv) > Math.abs(fr) ? 'Severity' : 'Frequency';
                    return (
                      <tr key={x.product} className="border-t border-line align-top">
                        <td className="py-2.5 font-medium text-ink">{x.productName}</td>
                        <td className="py-2.5 text-right tabular"><span className={cn((x.ttm.lossRatio ?? 0) > 0.8 ? 'font-semibold text-negative' : 'text-ink')}>{fmtPct(x.ttm.lossRatio)}</span><div className="text-[11px] text-muted">was {fmtPct(x.prior.lossRatio)}</div></td>
                        <td className="py-2.5 text-right tabular text-ink-2">{fmtPct(x.ttm.frequency)}<div><Delta value={fr} goodWhenUp={false} /></div></td>
                        <td className="py-2.5 text-right tabular text-ink-2">{fmtUsd(x.ttm.severity)}<div><Delta value={sv} goodWhenUp={false} /></div></td>
                        <td className="py-2.5 text-right">
                          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', driver === 'Stable' ? 'bg-surface-2 text-muted' : lrUp > 0 ? 'bg-negative/10 text-negative' : 'bg-positive/10 text-positive')}>{driver}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Product mix" subtitle="Contracts by product" />
              <div className="h-56" aria-label="Product mix chart, this year vs last year">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.productMix.map((p) => ({ name: p.product, 'Last year': p.contracts.prior, 'This year': p.contracts.ttm }))} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke="var(--grid)" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: 'var(--surface-2)' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar isAnimationActive={false} dataKey="Last year" fill="var(--chart-5)" radius={[3, 3, 0, 0]} />
                    <Bar isAnimationActive={false} dataKey="This year" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card>
              <CardHeader title="Attach rate trend" subtitle="Financed contracts per financed deal, monthly" />
              <div className="h-56" aria-label="Attach rate trend chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.monthly} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid stroke="var(--grid)" vertical={false} />
                    <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false} minTickGap={28} />
                    <YAxis tickFormatter={(v) => fmtPct(v, 0)} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v) => fmtPct(Number(v))} labelFormatter={(l) => monthLabel(String(l))} />
                    <Line isAnimationActive={false} type="monotone" dataKey="attachRate" name="Attach rate" stroke="var(--chart-2)" strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Claim causes" subtitle="Paid claims this year, by cause" />
            {data.causes.length === 0 ? <p className="text-sm text-muted">No paid claims this year.</p> : (
              <ul className="space-y-2">
                {data.causes.slice(0, 8).map((c) => {
                  const max = data.causes[0].paid;
                  return (
                    <li key={`${c.product}-${c.cause}`} className="grid grid-cols-[minmax(0,12rem)_1fr_5rem_4rem] items-center gap-3 text-sm">
                      <span className="truncate text-ink">{c.cause} <span className="text-[11px] text-muted">{c.product}</span></span>
                      <span className="h-2 rounded-full bg-surface-2"><span className="block h-2 rounded-full bg-[var(--chart-3)]" style={{ width: `${(c.paid / max) * 100}%` }} /></span>
                      <span className="text-right tabular text-ink-2">{fmtUsd(c.paid)}</span>
                      <span className="text-right tabular text-xs text-muted">{c.claims} claims</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <Card className="h-fit xl:sticky xl:top-6">
          <CardHeader title="Visit prep brief" subtitle="An AI summary of this dealer for your next visit"
            right={brief?.source === 'sample' ? <SampleAiLabel /> : brief ? <PoweredBy label={`AI_COMPLETE · ${brief.model}`} /> : <PoweredBy label="AI_COMPLETE" />} />
          {!brief && !briefLoading && (
            <button onClick={generate} className="btn-ai flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white">
              <Sparkles className="h-4 w-4" aria-hidden /> Generate visit brief
            </button>
          )}
          {briefLoading && <ThinkingSteps title="Writing the brief" steps={BRIEF_STEPS} stepMs={1600} simulated={preferred !== 'live'} />}
          {briefError && <ErrorNote message={briefError} />}
          {brief && (
            <div className="fade-up space-y-4">
              <RichText text={brief.text} />
              <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                <button onClick={save} disabled={saved}
                  className={cn('flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold', saved ? 'bg-positive/10 text-positive' : 'btn-primary text-white')}>
                  {saved ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />} {saved ? 'Saved to My insights' : 'Save to My insights'}
                </button>
                <button onClick={generate} className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-2 hover:bg-surface-2">Regenerate</button>
              </div>
              <p className="text-[11px] text-muted">Review before you use it. The brief summarizes data; it does not recommend pricing, underwriting, or claims decisions.{briefMs != null && <span className="tabular">{brief.source === 'sample' ? ` Simulated ${(briefMs / 1000).toFixed(1)}s.` : ` Answered in ${(briefMs / 1000).toFixed(1)}s.`}</span>}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
