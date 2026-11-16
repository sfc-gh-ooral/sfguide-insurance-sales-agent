'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, BookOpen, Bot } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/client';
import { PERIOD_LABEL, PERSONAS, REGIONS, TIERS } from '@/lib/sales-data';
import { fmtNum, fmtPct, fmtUsd, monthLabel, yoy } from '@/lib/utils';
import { useAppState } from '@/components/AppState';
import { Card, CardHeader, Delta, Kpi, PoweredBy, Select } from '@/components/ui';
import { ErrorNote, Loading, useQuery } from '@/components/useQuery';

const PRODUCTS = [
  { value: '', label: 'All products' }, { value: 'VSC', label: 'Vehicle service contract' }, { value: 'GAP', label: 'GAP' },
  { value: 'TW', label: 'Tire & wheel' }, { value: 'APP', label: 'Appearance' }, { value: 'KEY', label: 'Key replacement' },
];
type Metric = 'contracts' | 'premium' | 'lossRatio';

export default function OverviewPage() {
  const { persona } = useAppState();
  const [region, setRegion] = useState('');
  const [product, setProduct] = useState('');
  const [tier, setTier] = useState('');
  const [metric, setMetric] = useState<Metric>('contracts');
  const scope = { persona, region: region || null, product: product || null, tier: tier || null };
  const { data, error, loading } = useQuery(() => api.overview(scope), [persona, region, product, tier]);

  const fmtMetric = (v: number) => (metric === 'premium' ? fmtUsd(v) : metric === 'lossRatio' ? fmtPct(v, 0) : fmtNum(v));
  const worst = data ? [...data.regions].sort((a, b) => (yoy(a.contracts.ttm, a.contracts.prior) ?? 0) - (yoy(b.contracts.ttm, b.contracts.prior) ?? 0))[0] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">Territory overview</h1>
          <p className="mt-1 text-sm text-muted">
            {PERSONAS[persona].detail} · This year ({PERIOD_LABEL.ttm}) vs last year ({PERIOD_LABEL.prior})
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {persona === 'director' && <Select label="Region" value={region} onChange={setRegion} options={[{ value: '', label: 'All regions' }, ...REGIONS.map((r) => ({ value: r, label: r }))]} />}
          <Select label="Product" value={product} onChange={setProduct} options={PRODUCTS} />
          <Select label="Tier" value={tier} onChange={setTier} options={[{ value: '', label: 'All tiers' }, ...TIERS.map((t) => ({ value: t, label: t }))]} />
        </div>
      </div>

      {error && <ErrorNote message={error} />}
      {!data && !error && <Loading />}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Kpi label="Written premium" value={fmtUsd(data.kpis.premium.ttm)} delta={<Delta value={yoy(data.kpis.premium.ttm, data.kpis.premium.prior)} />} />
            <Kpi label="Contracts" value={fmtNum(data.kpis.contracts.ttm)} delta={<Delta value={yoy(data.kpis.contracts.ttm, data.kpis.contracts.prior)} />} />
            <Kpi label="Attach rate" value={fmtPct(data.kpis.attachRate.ttm)} delta={<Delta unit="pts" value={data.kpis.attachRate.ttm - data.kpis.attachRate.prior} />} />
            <Kpi label="Loss ratio" value={fmtPct(data.kpis.lossRatio.ttm)} delta={<Delta unit="pts" goodWhenUp={false} value={data.kpis.lossRatio.ttm - data.kpis.lossRatio.prior} />} />
            <Kpi label="Market share" value={fmtPct(data.kpis.share.ttm)} delta={<Delta unit="pts" value={data.kpis.share.ttm - data.kpis.share.prior} />} />
          </div>
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <BookOpen className="h-3.5 w-3.5" aria-hidden />
            Matches BI report: every number uses the shared metric definitions in the semantic view.
            <Link href="/glossary" className="font-medium text-accent underline-offset-2 hover:underline">See definitions</Link>
            <PoweredBy label="Semantic View" />
          </p>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="Monthly trend" subtitle={`${monthLabel(data.trend[0].month)} – ${monthLabel(data.trend[data.trend.length - 1].month)}`}
                right={(['contracts', 'premium', 'lossRatio'] as Metric[]).map((m) => (
                  <button key={m} onClick={() => setMetric(m)} aria-pressed={metric === m}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${metric === m ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink'}`}>
                    {m === 'contracts' ? 'Contracts' : m === 'premium' ? 'Premium' : 'Loss ratio'}
                  </button>
                ))} />
              <div className="h-64" aria-label={`Monthly ${metric} trend chart`}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--grid)" vertical={false} />
                    <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false} minTickGap={28} />
                    <YAxis tickFormatter={fmtMetric} tickLine={false} axisLine={false} width={56} />
                    <Tooltip formatter={(v) => fmtMetric(Number(v))} labelFormatter={(l) => monthLabel(String(l))} />
                    <Area isAnimationActive={false} type="monotone" dataKey={metric} stroke="var(--chart-1)" strokeWidth={2} fill="url(#fill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <CardHeader title="Contracts by region" subtitle="This year vs last year" />
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted"><th className="pb-2 font-semibold">Region</th><th className="pb-2 text-right font-semibold">This year</th><th className="pb-2 text-right font-semibold">YoY</th></tr></thead>
                <tbody>
                  {[...data.regions].sort((a, b) => b.contracts.ttm - a.contracts.ttm).map((r) => (
                    <tr key={r.region} className="border-t border-line">
                      <td className="py-2 text-ink">{r.region}</td>
                      <td className="py-2 text-right tabular text-ink-2">{fmtNum(r.contracts.ttm)}</td>
                      <td className="py-2 text-right"><Delta value={yoy(r.contracts.ttm, r.contracts.prior)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {worst && (yoy(worst.contracts.ttm, worst.contracts.prior) ?? 0) < -0.05 && (
                <div className="mt-4 rounded-lg border border-line bg-surface-2 p-3 text-xs text-ink-2">
                  <strong className="text-ink">{worst.region}</strong> contracts are down {fmtPct(Math.abs(yoy(worst.contracts.ttm, worst.contracts.prior) ?? 0))}.
                  <Link href={`/agent?q=${encodeURIComponent(`Why is ${worst.region} volume down this year?`)}`}
                    className="mt-2 flex items-center gap-1 font-medium text-accent hover:underline">
                    <Bot className="h-3.5 w-3.5" aria-hidden /> Ask the agent why <ArrowRight className="h-3 w-3" aria-hidden />
                  </Link>
                </div>
              )}
            </Card>
          </div>
          {loading && <p className="text-xs text-muted">Refreshing…</p>}
        </>
      )}
    </div>
  );
}
