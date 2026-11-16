'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, Search } from 'lucide-react';
import { api } from '@/lib/client';
import { PERSONAS, REGIONS, TIERS } from '@/lib/sales-data';
import type { DealerRow } from '@/lib/types';
import { cn, fmtNum, fmtPct, fmtUsd, yoy } from '@/lib/utils';
import { useAppState } from '@/components/AppState';
import { Card, Delta, PoweredBy, Select, Sparkline } from '@/components/ui';
import { ErrorNote, Loading, useQuery } from '@/components/useQuery';

type SortKey = 'name' | 'contracts' | 'yoy' | 'premium' | 'lossRatio' | 'attachRate';
const PRODUCTS = [{ value: '', label: 'All products' }, { value: 'VSC', label: 'VSC' }, { value: 'GAP', label: 'GAP' }, { value: 'TW', label: 'Tire & wheel' }, { value: 'APP', label: 'Appearance' }, { value: 'KEY', label: 'Key replacement' }];

export default function DealersPage() {
  const { persona } = useAppState();
  const [tab, setTab] = useState<'all' | 'movers'>('all');
  const [region, setRegion] = useState('');
  const [product, setProduct] = useState('');
  const [tier, setTier] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'premium', desc: true });
  const { data, error } = useQuery(() => api.dealers({ persona, region: region || null, product: product || null, tier: tier || null }), [persona, region, product, tier]);

  const val = (r: DealerRow, k: SortKey): number | string =>
    k === 'name' ? r.name : k === 'contracts' ? r.contracts.ttm : k === 'yoy' ? (yoy(r.contracts.ttm, r.contracts.prior) ?? 0)
      : k === 'premium' ? r.premium : k === 'lossRatio' ? (r.lossRatio ?? -1) : (r.attachRate ?? -1);
  const rows = useMemo(() => {
    if (!data) return [];
    const s = search.trim().toLowerCase();
    const filtered = data.filter((r) => !s || `${r.name} ${r.state} ${r.group} ${r.rep}`.toLowerCase().includes(s));
    return [...filtered].sort((a, b) => {
      const x = val(a, sort.key), y = val(b, sort.key);
      const c = typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number);
      return sort.desc ? -c : c;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, search, sort]);
  const movers = useMemo(() => {
    if (!data) return { up: [], down: [] };
    const withChange = data.filter((r) => r.contracts.prior >= 50).map((r) => ({ ...r, change: r.contracts.ttm - r.contracts.prior }));
    return { down: [...withChange].sort((a, b) => a.change - b.change).slice(0, 10), up: [...withChange].sort((a, b) => b.change - a.change).slice(0, 10) };
  }, [data]);

  const Th = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th scope="col" aria-sort={sort.key === k ? (sort.desc ? 'descending' : 'ascending') : 'none'} className={cn('pb-2 font-semibold', right && 'text-right')}>
      <button onClick={() => setSort((s) => ({ key: k, desc: s.key === k ? !s.desc : true }))} className="inline-flex items-center gap-1 hover:text-ink">
        {label}{sort.key === k && (sort.desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
      </button>
    </th>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">Dealer explorer</h1>
          <p className="mt-1 text-sm text-muted">{data ? `${data.length} dealers` : 'Dealers'} · {PERSONAS[persona].detail} · this year vs last year</p>
        </div>
        {persona === 'rep' && <PoweredBy policy label="Row access policy applied: your territory only" />}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="View" className="flex rounded-lg border border-line bg-surface p-0.5">
          {(['all', 'movers'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={cn('rounded-md px-3 py-1.5 text-sm font-medium', tab === t ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink')}>
              {t === 'all' ? 'All dealers' : 'Movers'}
            </button>
          ))}
        </div>
        {persona === 'director' && <Select label="Region" value={region} onChange={setRegion} options={[{ value: '', label: 'All' }, ...REGIONS.map((r) => ({ value: r, label: r }))]} />}
        <Select label="Product" value={product} onChange={setProduct} options={PRODUCTS} />
        <Select label="Tier" value={tier} onChange={setTier} options={[{ value: '', label: 'All' }, ...TIERS.map((t) => ({ value: t, label: t }))]} />
        {tab === 'all' && (
          <label className="flex items-center gap-2 rounded-md border border-line bg-surface px-2 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted" aria-hidden />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Dealer, state, group, rep" aria-label="Search dealers"
              className="w-48 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none" />
          </label>
        )}
      </div>

      {error && <ErrorNote message={error} />}
      {!data && !error && <Loading />}
      {data && tab === 'all' && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted [&>th]:px-4 [&>th]:pt-4">
                <Th k="name" label="Dealer" />
                <th className="pb-2 font-semibold">Last 12 months</th>
                <Th k="contracts" label="Contracts" right />
                <Th k="yoy" label="YoY" right />
                <Th k="premium" label="Premium" right />
                <Th k="attachRate" label="Attach" right />
                <Th k="lossRatio" label="Loss ratio" right />
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 150).map((r) => (
                <tr key={r.id} className="border-t border-line hover:bg-surface-2 [&>td]:px-4 [&>td]:py-2.5">
                  <td>
                    <Link href={`/dealer?id=${r.id}`} className="font-medium text-ink hover:text-accent">{r.name}</Link>
                    <div className="text-[11px] text-muted">{r.state} · {r.tier}{r.group !== 'Independent' ? ` · ${r.group}` : ''}</div>
                  </td>
                  <td><Sparkline values={r.spark} down={(yoy(r.contracts.ttm, r.contracts.prior) ?? 0) < -0.1} /></td>
                  <td className="text-right tabular text-ink-2">{fmtNum(r.contracts.ttm)}</td>
                  <td className="text-right"><Delta value={yoy(r.contracts.ttm, r.contracts.prior)} /></td>
                  <td className="text-right tabular text-ink-2">{fmtUsd(r.premium)}</td>
                  <td className="text-right tabular text-ink-2">{fmtPct(r.attachRate)}</td>
                  <td className={cn('text-right tabular', (r.lossRatio ?? 0) > 0.8 ? 'font-semibold text-negative' : 'text-ink-2')}>{fmtPct(r.lossRatio)}</td>
                  <td><Link href={`/dealer?id=${r.id}`} aria-label={`Open ${r.name}`}><ChevronRight className="h-4 w-4 text-muted" /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 150 && <p className="border-t border-line px-4 py-2 text-xs text-muted">Showing 150 of {rows.length}. Filter or search to narrow down.</p>}
        </Card>
      )}
      {data && tab === 'movers' && (
        <div className="grid gap-5 lg:grid-cols-2">
          {([['Biggest decliners', movers.down], ['Biggest gainers', movers.up]] as const).map(([title, list]) => (
            <Card key={title}>
              <h2 className="mb-3 text-sm font-semibold text-ink">{title}</h2>
              <p className="mb-3 text-xs text-muted">Contracts change, this year vs last year (dealers with 50+ contracts last year)</p>
              <ol className="space-y-1">
                {list.map((r, i) => {
                  const max = Math.max(...list.map((x) => Math.abs(x.change)));
                  return (
                    <li key={r.id}>
                      <Link href={`/dealer?id=${r.id}`} className="grid grid-cols-[1.25rem_1fr_6rem_4.5rem] items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-surface-2">
                        <span className="text-xs text-muted">{i + 1}</span>
                        <span className="truncate text-ink">{r.name} <span className="text-[11px] text-muted">{r.state}</span></span>
                        <span className="h-2 rounded-full bg-surface-2"><span className="block h-2 rounded-full" style={{ width: `${(Math.abs(r.change) / max) * 100}%`, background: r.change < 0 ? 'var(--negative)' : 'var(--positive)' }} /></span>
                        <span className={cn('text-right tabular text-xs font-medium', r.change < 0 ? 'text-negative' : 'text-positive')}>{r.change > 0 ? '+' : ''}{fmtNum(r.change)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
