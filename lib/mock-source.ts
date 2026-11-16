// No-account data source: computes every screen from the bundled synthetic data set
// (data/mock/dataset.json, written by scripts/generate-data.mjs). Agent answers and visit
// briefs are scripted templates filled with these numbers and are labeled "Sample AI response".
import raw from '@/data/mock/dataset.json';
import type { SalesSource } from './sales-data';
import { REP_TERRITORY } from './sales-data';
import type { AgentAnswer, Chart, DealerDetail, DealerRow, MetricDefinition, Overview, Pair, Scope, VisitBrief } from './types';
import { vq } from './verified-queries';
import { fmtPct, fmtUsd, fmtNum } from './utils';

interface RawDealer {
  dealer_id: string; dealer_name: string; state: string; zip: string; region: string; territory: string;
  rep_id: string; franchise_brand: string; tier: string; dealer_group: string; onboarded_date: string;
}
interface Dataset {
  months: string[];
  products: { code: string; name: string; band: string; expectedLossRatio: number }[];
  reps: { rep_id: string; rep_name: string; territory: string; region: string }[];
  dealers: RawDealer[];
  facts: number[][]; // [dealer, product, month, contracts, premium, financedContracts, claims, paid]
  deals: number[][]; // [dealer][month] financed deals
  causes: (string | number)[][]; // [dealer, product, cause, claims, paid] (current year)
  market: (string | number)[][]; // [state, product, month, units]
}
const D = raw as unknown as Dataset;

const TTM_START = 24, PRIOR_START = 12;
const periodOf = (m: number) => (m >= TTM_START ? 'ttm' : m >= PRIOR_START ? 'prior' : null);
const div = (a: number, b: number) => (b ? a / b : null);
const repName = Object.fromEntries(D.reps.map((r) => [r.rep_id, r.rep_name]));
const productIdx = Object.fromEntries(D.products.map((p, i) => [p.code, i]));
const factsByDealer: number[][][] = D.dealers.map(() => []);
for (const f of D.facts) factsByDealer[f[0]].push(f);
const dealerIdx = Object.fromEntries(D.dealers.map((d, i) => [d.dealer_id, i]));

// Emulates the row access policy (rep sees one territory) plus the UI filters.
function visible(scope: Scope, ignoreRegion = false): number[] {
  const out: number[] = [];
  D.dealers.forEach((d, i) => {
    if (scope.persona === 'rep' && d.territory !== REP_TERRITORY) return;
    if (!ignoreRegion && scope.region && d.region !== scope.region) return;
    if (scope.tier && d.tier !== scope.tier) return;
    out.push(i);
  });
  return out;
}

interface Totals { contracts: number; premium: number; financed: number; claims: number; paid: number; deals: number }
const zero = (): Totals => ({ contracts: 0, premium: 0, financed: 0, claims: 0, paid: 0, deals: 0 });

function totals(dealers: number[], product: number | null, keyOf: (m: number) => string | null): Map<string, Totals> {
  const out = new Map<string, Totals>();
  const get = (k: string) => { let t = out.get(k); if (!t) { t = zero(); out.set(k, t); } return t; };
  for (const di of dealers) {
    for (const f of factsByDealer[di]) {
      if (product !== null && f[1] !== product) continue;
      const k = keyOf(f[2]); if (k === null) continue;
      const t = get(k);
      t.contracts += f[3]; t.premium += f[4]; t.financed += f[5]; t.claims += f[6]; t.paid += f[7];
    }
    D.deals[di].forEach((n, m) => { const k = keyOf(m); if (k !== null) get(k).deals += n; });
  }
  return out;
}
const pair = (m: Map<string, Totals>, fn: (t: Totals) => number | null): Pair => ({
  ttm: fn(m.get('ttm') ?? zero()) ?? 0, prior: fn(m.get('prior') ?? zero()) ?? 0,
});

function share(dealers: number[], product: number | null, keyOf: (m: number) => string | null): Map<string, number> {
  const states = new Set(dealers.map((i) => D.dealers[i].state));
  const ours = totals(dealers, product, keyOf);
  const market = new Map<string, number>();
  for (const [st, p, m, u] of D.market) {
    if (!states.has(st as string) || (product !== null && p !== product)) continue;
    const k = keyOf(m as number); if (k === null) continue;
    market.set(k, (market.get(k) ?? 0) + (u as number));
  }
  const out = new Map<string, number>();
  for (const [k, mk] of market) out.set(k, (ours.get(k)?.contracts ?? 0) / mk);
  return out;
}

const productOf = (scope: Scope) => (scope.product ? productIdx[scope.product] ?? null : null);

function overview(scope: Scope): Overview {
  const ds = visible(scope), p = productOf(scope);
  const per = totals(ds, p, periodOf);
  const sh = share(visible({ ...scope, tier: null }), p, periodOf); // share is state-level, like the live query
  const monthly = totals(ds, p, (m) => String(m));
  const trend = D.months.map((month, m) => {
    const t = monthly.get(String(m)) ?? zero();
    return { month, contracts: t.contracts, premium: Math.round(t.premium), lossRatio: div(t.paid, t.premium) };
  });
  const all = visible(scope, true);
  const regions = [...new Set(all.map((i) => D.dealers[i].region))].map((region) => {
    const r = totals(all.filter((i) => D.dealers[i].region === region), p, periodOf);
    return { region, contracts: pair(r, (t) => t.contracts), premium: pair(r, (t) => t.premium) };
  });
  return {
    kpis: {
      premium: pair(per, (t) => t.premium),
      contracts: pair(per, (t) => t.contracts),
      attachRate: pair(per, (t) => div(t.financed, t.deals)),
      lossRatio: pair(per, (t) => div(t.paid, t.premium)),
      share: { ttm: sh.get('ttm') ?? 0, prior: sh.get('prior') ?? 0 },
    },
    trend,
    regions,
  };
}

function dealerRows(scope: Scope): DealerRow[] {
  const p = productOf(scope);
  return visible(scope).map((i) => {
    const d = D.dealers[i];
    const per = totals([i], p, periodOf).get('ttm') ?? zero();
    const prior = totals([i], p, periodOf).get('prior') ?? zero();
    const months = totals([i], p, (m) => (m >= TTM_START ? String(m) : null));
    return {
      id: d.dealer_id, name: d.dealer_name, state: d.state, region: d.region, territory: d.territory,
      tier: d.tier, group: d.dealer_group, rep: repName[d.rep_id],
      contracts: { ttm: per.contracts, prior: prior.contracts }, premium: Math.round(per.premium),
      lossRatio: div(per.paid, per.premium), attachRate: div(per.financed, per.deals),
      spark: Array.from({ length: 12 }, (_, k) => months.get(String(TTM_START + k))?.contracts ?? 0),
    };
  });
}

function dealerDetail(scope: Scope, id: string): DealerDetail | null {
  const i = dealerIdx[id];
  if (i === undefined || !visible({ persona: scope.persona }).includes(i)) return null;
  const d = D.dealers[i];
  const productMix = D.products.map((pr, pi) => {
    const t = totals([i], pi, periodOf);
    return { product: pr.code, productName: pr.name, contracts: pair(t, (x) => x.contracts), premium: pair(t, (x) => Math.round(x.premium)) };
  });
  const monthly = totals([i], null, (m) => String(m));
  const decomposition = D.products.map((pr, pi) => {
    const t = totals([i], pi, periodOf);
    const side = (k: string) => {
      const x = t.get(k) ?? zero();
      return { lossRatio: div(x.paid, x.premium), frequency: div(x.claims, x.contracts), severity: div(x.paid, x.claims), premium: Math.round(x.premium) };
    };
    return { product: pr.code, productName: pr.name, prior: side('prior'), ttm: side('ttm') };
  });
  const causes = D.causes.filter((c) => c[0] === i)
    .map((c) => ({ product: D.products[c[1] as number].code, cause: c[2] as string, claims: c[3] as number, paid: c[4] as number }))
    .sort((a, b) => b.paid - a.paid);
  return {
    dealer: { id: d.dealer_id, name: d.dealer_name, state: d.state, zip: d.zip, region: d.region, territory: d.territory, tier: d.tier, group: d.dealer_group, brand: d.franchise_brand, rep: repName[d.rep_id], onboarded: d.onboarded_date },
    productMix,
    monthly: D.months.map((month, m) => { const t = monthly.get(String(m)) ?? zero(); return { month, contracts: t.contracts, attachRate: div(t.financed, t.deals) }; }),
    decomposition,
    causes,
  };
}

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  { metric: 'Written premium', definition: 'Sum of contract premium for contracts sold in the period.', semanticViewMetric: 'perf.written_premium' },
  { metric: 'Contracts', definition: 'Count of contracts sold in the period.', semanticViewMetric: 'perf.contracts_sold' },
  { metric: 'Attach rate', definition: 'Financed contracts sold / financed deals. Per product this is the share of financed deals with that product; across products it can exceed 100% because one deal can carry several products. Also called penetration.', semanticViewMetric: 'perf.attach_rate' },
  { metric: 'Loss ratio', definition: 'Claims paid in the period / premium written in the period (paid basis, simplified for sales reporting; not an earned-premium actuarial measure).', semanticViewMetric: 'perf.loss_ratio' },
  { metric: 'Claim frequency', definition: 'Paid claims / contracts sold in the period.', semanticViewMetric: 'perf.claim_frequency' },
  { metric: 'Claim severity', definition: 'Paid amount / paid claims.', semanticViewMetric: 'perf.claim_severity' },
  { metric: 'Market share', definition: 'Our contracts / total market units for the same state, product, and month.', semanticViewMetric: 'share.market_share' },
];

// ---- Scripted agent answers (Sample AI response) -------------------------------------
function answer(scope: Scope, question: string): AgentAnswer {
  const q = question.toLowerCase();
  const base = { source: 'sample' as const, verifiedQuery: true };

  if (q.includes('southeast') && (q.includes('volume') || q.includes('down') || q.includes('contract'))) {
    const rows = dealerRows({ ...scope, region: 'Southeast', product: null, tier: null })
      .map((r) => ({ ...r, change: r.contracts.ttm - r.contracts.prior }))
      .sort((a, b) => a.change - b.change);
    const tot = rows.reduce((s, r) => ({ ttm: s.ttm + r.contracts.ttm, prior: s.prior + r.contracts.prior }), { ttm: 0, prior: 0 });
    const top3 = rows.slice(0, 3);
    const lost3 = top3.reduce((s, r) => s + r.change, 0);
    const chart: Chart = { kind: 'bar', xKey: 'dealer', yKey: 'change', yLabel: 'Contracts change YoY', format: 'number',
      data: rows.slice(0, 8).map((r) => ({ dealer: r.name, change: r.change })) };
    return { ...base,
      text: `Southeast contracts fell ${fmtPct(Math.abs(tot.ttm / tot.prior - 1))} year over year (${fmtNum(tot.prior)} → ${fmtNum(tot.ttm)}). ` +
        `Three dealers explain the drop: ${top3.map((r) => `**${r.name}** (${r.state}, ${fmtPct(r.change / r.contracts.prior)})`).join(', ')}. ` +
        `Together they lost ${fmtNum(Math.abs(lost3))} contracts, more than the region's net decline, so the rest of the region was roughly flat to slightly up. ` +
        `A drop of about 90% at a few dealers usually means a business change at those dealers, such as moving to another provider; the data alone can't confirm why.`,
      sql: vq('southeast_volume_by_dealer'), chart,
      table: { columns: ['Dealer', 'State', 'Last year', 'This year', 'Change'], rows: rows.slice(0, 10).map((r) => [r.name, r.state, r.contracts.prior, r.contracts.ttm, r.change]) } };
  }

  if (q.includes('gap') && (q.includes('80') || q.includes('above'))) {
    const rows = dealerRows({ ...scope, product: 'GAP', region: null, tier: null })
      .filter((r) => r.premium >= 20000 && (r.lossRatio ?? 0) > 0.8)
      .sort((a, b) => (b.lossRatio ?? 0) - (a.lossRatio ?? 0));
    const ga = rows.filter((r) => r.state === 'GA').length;
    const runoff = rows.filter((r) => r.contracts.ttm < r.contracts.prior * 0.3);
    return { ...base,
      text: `${rows.length} dealers have a GAP loss ratio above 80% this year (dealers with at least $20K of GAP premium). ` +
        (ga ? `Georgia stands out with ${ga} of them. ` : '') +
        (runoff.length ? `The highest ratios, at ${runoff.map((r) => r.name).join(' and ')}, are run-off: claims are still arriving on contracts sold before their volume dropped, while new premium has nearly stopped. ` : '') +
        `For the Georgia dealers, ask "Is the Georgia GAP loss ratio increase driven by frequency or severity?" to see the breakdown.`,
      sql: vq('gap_loss_ratio_above_80'),
      chart: { kind: 'bar', xKey: 'dealer', yKey: 'lossRatio', yLabel: 'GAP loss ratio', format: 'pct', data: rows.slice(0, 10).map((r) => ({ dealer: r.name, lossRatio: r.lossRatio ?? 0 })) },
      table: { columns: ['Dealer', 'State', 'GAP premium', 'Loss ratio'], rows: rows.slice(0, 15).map((r) => [r.name, r.state, fmtUsd(r.premium), fmtPct(r.lossRatio)]) } };
  }

  if (q.includes('share') && (q.includes('texas') || q.includes(' tx'))) {
    const tx = visible({ persona: scope.persona }).filter((i) => D.dealers[i].state === 'TX');
    if (!tx.length) return outOfScope();
    const s = share(tx, productIdx.VSC, periodOf);
    const prior = s.get('prior') ?? 0, ttm = s.get('ttm') ?? 0;
    return { ...base,
      text: `Our VSC (vehicle service contract) share in Texas is ${fmtPct(ttm)} this year, down from ${fmtPct(prior)} last year (${((ttm - prior) * 100).toFixed(1)} points). ` +
        `Our Texas VSC volume held up, but total market units grew faster, so share slipped. Comparing dealer-level volume against the market would show where we're losing ground.`,
      sql: vq('vsc_share_texas'),
      chart: { kind: 'bar', xKey: 'period', yKey: 'share', yLabel: 'TX VSC market share', format: 'pct', data: [{ period: 'Last year', share: prior }, { period: 'This year', share: ttm }] },
      table: { columns: ['Period', 'Market share'], rows: [['Last year', fmtPct(prior)], ['This year', fmtPct(ttm)]] } };
  }

  if (q.includes('georgia') || (q.includes('frequency') && q.includes('severity'))) {
    const ga = visible({ persona: scope.persona }).filter((i) => D.dealers[i].state === 'GA');
    if (!ga.length) return outOfScope();
    const t = totals(ga, productIdx.GAP, periodOf);
    const side = (k: string) => { const x = t.get(k)!; return { lr: x.paid / x.premium, freq: x.claims / x.contracts, sev: x.paid / x.claims }; };
    const p = side('prior'), c = side('ttm');
    return { ...base,
      text: `The Georgia GAP loss ratio rose from ${fmtPct(p.lr)} to ${fmtPct(c.lr)}. It's driven by **severity, not frequency**: ` +
        `claim frequency was steady (${fmtPct(p.freq)} → ${fmtPct(c.freq)}), while the average paid claim rose ${fmtPct(c.sev / p.sev - 1)} (${fmtUsd(p.sev)} → ${fmtUsd(c.sev)}). ` +
        `Larger GAP payouts per claim fit a drop in used-vehicle values, which widens the gap between loan balance and vehicle value.`,
      sql: vq('georgia_gap_frequency_severity'),
      chart: { kind: 'bar', xKey: 'measure', yKey: 'change', yLabel: 'Change vs last year', format: 'pct',
        data: [{ measure: 'Loss ratio', change: c.lr / p.lr - 1 }, { measure: 'Frequency', change: c.freq / p.freq - 1 }, { measure: 'Severity', change: c.sev / p.sev - 1 }] },
      table: { columns: ['Period', 'Loss ratio', 'Frequency', 'Severity'], rows: [['Last year', fmtPct(p.lr), fmtPct(p.freq), fmtUsd(p.sev)], ['This year', fmtPct(c.lr), fmtPct(c.freq), fmtUsd(c.sev)]] } };
  }

  if (q.includes('summit') || (q.includes('attach') && q.includes('group'))) {
    const ids = visible({ persona: scope.persona }).filter((i) => D.dealers[i].dealer_group === 'Summit Auto Group');
    if (!ids.length) return outOfScope();
    const m = totals(ids, null, (x) => String(x));
    const data = D.months.map((month, k) => { const t = m.get(String(k))!; return { month, attachRate: t.financed / t.deals }; });
    const per = totals(ids, null, periodOf);
    const a = (k: string) => per.get(k)!.financed / per.get(k)!.deals;
    return { ...base,
      text: `Summit Auto Group (${ids.length} dealers in OH and MI) has a steadily rising attach rate: ${fmtPct(a('prior'))} last year to ${fmtPct(a('ttm'))} this year, ` +
        `while its financed deal volume also grew. It's one of the fastest-growing groups on this data set.`,
      sql: vq('summit_attach_trend'),
      chart: { kind: 'line', xKey: 'month', yKey: 'attachRate', yLabel: 'Attach rate', format: 'pct', data }, table: null };
  }

  return { source: 'sample', verifiedQuery: false, sql: null, chart: null, table: null,
    text: 'This sample-data example has scripted answers for the suggested questions only. Pick one of them, or connect live mode to ask the Cortex Agent anything about premium, contracts, attach rate, loss ratio, claims, or market share.' };
}

function outOfScope(): AgentAnswer {
  return { source: 'sample', verifiedQuery: false, sql: null, chart: null, table: null,
    text: `That data is outside your territory (${REP_TERRITORY}). The row access policy only returns dealers you cover; switch "View as" to the director to compare.` };
}

// ---- Scripted visit brief (Sample AI response) ------------------------------------------
function brief(scope: Scope, id: string): VisitBrief {
  const d = dealerDetail(scope, id);
  if (!d) return { text: 'Dealer not available in your territory.', source: 'sample' };
  const mix = d.productMix.filter((p) => p.contracts.ttm + p.contracts.prior > 0);
  const tot = mix.reduce((s, p) => ({ ttm: s.ttm + p.contracts.ttm, prior: s.prior + p.contracts.prior }), { ttm: 0, prior: 0 });
  const yoy = tot.prior ? tot.ttm / tot.prior - 1 : 0;
  const movers = [...mix].sort((a, b) => Math.abs(b.contracts.ttm - b.contracts.prior) - Math.abs(a.contracts.ttm - a.contracts.prior));
  const runoff = yoy < -0.6;
  const lrFlags = runoff ? [] : d.decomposition.filter((x) => (x.ttm.lossRatio ?? 0) > 0.75 && x.ttm.premium > 5000);
  const att = (k: number) => d.monthly.slice(k, k + 12);
  const avgAtt = (rows: { attachRate: number | null }[]) => rows.reduce((s, r) => s + (r.attachRate ?? 0), 0) / rows.length;
  const a0 = avgAtt(att(12)), a1 = avgAtt(att(24));
  const lines = [
    `**${d.dealer.name}** (${d.dealer.state}, ${d.dealer.tier}${d.dealer.group !== 'Independent' ? `, ${d.dealer.group}` : ''})`,
    '',
    `**Headline:** ${fmtNum(tot.ttm)} contracts this year, ${yoy >= 0 ? 'up' : 'down'} ${fmtPct(Math.abs(yoy))} from ${fmtNum(tot.prior)}. Attach rate ${fmtPct(a1)} vs ${fmtPct(a0)} last year.`,
    `**Product mix:** ${movers.slice(0, 2).map((p) => `${p.productName} ${p.contracts.ttm - p.contracts.prior >= 0 ? '+' : ''}${fmtNum(p.contracts.ttm - p.contracts.prior)}`).join('; ')} (biggest changes).`,
  ];
  if (runoff) lines.push(`**Loss ratio:** high across products, but mostly run-off: claims are still paying on contracts sold before volume dropped, while new premium has nearly stopped.`);
  for (const x of lrFlags) {
    const fr = x.prior.frequency && x.ttm.frequency ? x.ttm.frequency / x.prior.frequency - 1 : 0;
    const sv = x.prior.severity && x.ttm.severity ? x.ttm.severity / x.prior.severity - 1 : 0;
    lines.push(`**${x.productName} loss ratio ${fmtPct(x.ttm.lossRatio)}** (was ${fmtPct(x.prior.lossRatio)}): mostly ${Math.abs(sv) > Math.abs(fr) ? `severity (avg claim ${sv >= 0 ? '+' : ''}${fmtPct(sv)})` : `frequency (${fr >= 0 ? '+' : ''}${fmtPct(fr)} claims per contract)`}.`);
  }
  if (d.causes[0]) lines.push(`**Top claim cause:** ${d.causes[0].cause} (${d.causes[0].claims} paid claims this year).`);
  lines.push('', '**Topics to discuss:**');
  if (runoff) lines.push('- Confirm whether they moved some or all F&I products to another provider, and when.');
  else if (yoy < -0.2) lines.push('- What changed in their F&I process or provider relationships this year?');
  if (a1 > a0 * 1.05) lines.push('- What is driving the attach-rate gains, and can it carry to other products?');
  if (lrFlags.length) lines.push(`- Share the ${lrFlags.map((x) => x.productName).join(' and ')} claims trend; route pricing or underwriting questions to the product team.`);
  lines.push('- Confirm upcoming inventory mix (new vs used) and financing volume.');
  return { text: lines.join('\n'), source: 'sample' };
}

export const mockSource: SalesSource = {
  overview: async (s) => overview(s),
  dealers: async (s) => dealerRows(s),
  dealer: async (s, id) => dealerDetail(s, id),
  definitions: async () => METRIC_DEFINITIONS,
  ask: async (s, q) => answer(s, q),
  brief: async (s, id) => brief(s, id),
};
