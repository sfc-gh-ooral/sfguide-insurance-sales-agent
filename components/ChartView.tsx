'use client';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Chart } from '@/lib/types';
import { fmtNum, fmtPct, monthLabel } from '@/lib/utils';

const fmt = (f: Chart['format']) => (v: number) => (f === 'pct' ? fmtPct(v, 0) : f === 'usd' ? `$${fmtNum(v)}` : fmtNum(v));

export default function ChartView({ chart, height = 240 }: { chart: Chart; height?: number }) {
  const f = fmt(chart.format);
  const isMonth = /^\d{4}-\d{2}/.test(String(chart.data[0]?.[chart.xKey] ?? ''));
  const xFmt = (v: string) => (isMonth ? monthLabel(v) : v.length > 16 ? `${v.slice(0, 15)}…` : v);
  const common = {
    data: chart.data,
    margin: { top: 8, right: 12, left: 4, bottom: chart.kind === 'bar' && chart.data.length > 4 ? 48 : 8 },
  };
  return (
    <figure aria-label={chart.yLabel}>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {chart.kind === 'line' ? (
            <LineChart {...common}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey={chart.xKey} tickFormatter={xFmt} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tickFormatter={f} tickLine={false} axisLine={false} width={52} />
              <Tooltip formatter={(v) => f(Number(v))} labelFormatter={(l) => xFmt(String(l))} />
              <Line isAnimationActive={false} type="monotone" dataKey={chart.yKey} name={chart.yLabel} stroke="var(--chart-1)" strokeWidth={2} dot={false} />
            </LineChart>
          ) : (
            <BarChart {...common}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey={chart.xKey} tickFormatter={xFmt} tickLine={false} axisLine={false} interval={0}
                angle={chart.data.length > 4 ? -30 : 0} textAnchor={chart.data.length > 4 ? 'end' : 'middle'} />
              <YAxis tickFormatter={f} tickLine={false} axisLine={false} width={52} />
              <Tooltip formatter={(v) => f(Number(v))} cursor={{ fill: 'var(--surface-2)' }} />
              <Bar isAnimationActive={false} dataKey={chart.yKey} name={chart.yLabel} radius={[4, 4, 0, 0]}>
                {chart.data.map((d, i) => <Cell key={i} fill={Number(d[chart.yKey]) < 0 ? 'var(--negative)' : 'var(--chart-1)'} />)}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-1 text-center text-[11px] text-muted">{chart.yLabel}</figcaption>
    </figure>
  );
}
