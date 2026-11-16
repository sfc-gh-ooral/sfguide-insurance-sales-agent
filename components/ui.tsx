'use client';
import { useEffect, useState } from 'react';
import { Sparkles, ShieldCheck, Cpu, TrendingDown, TrendingUp, Minus, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn('fade-up rounded-2xl border border-line bg-surface p-5 card-elev', className)}>{children}</section>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

// Progress panel shown while an AI call runs. Steps advance on a timer that mirrors the real
// pipeline; the last step stays active until the answer arrives. Sample mode says it is simulated.
export function ThinkingSteps({ title, steps, stepMs = 1100, simulated }: { title: string; steps: string[]; stepMs?: number; simulated: boolean }) {
  const [i, setI] = useState(0);
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const tick = setInterval(() => setMs(Date.now() - t0), 100);
    const step = setInterval(() => setI((n) => Math.min(n + 1, steps.length - 1)), stepMs);
    return () => { clearInterval(tick); clearInterval(step); };
  }, [steps.length, stepMs]);
  return (
    <div role="status" aria-live="polite" className="ai-border ai-glow fade-up rounded-2xl bg-surface p-5 card-elev">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="ai-gradient flex h-6 w-6 items-center justify-center rounded-md text-white"><Sparkles className="h-3.5 w-3.5" aria-hidden /></span>
          {title}
          <span className="ml-1 inline-flex gap-1" aria-hidden><i className="typing-dot" /><i className="typing-dot" /><i className="typing-dot" /></span>
        </div>
        <span className="text-[11px] tabular text-muted">{(ms / 1000).toFixed(1)}s{simulated ? ' · simulated processing time' : ''}</span>
      </div>
      <ol className="space-y-1.5">
        {steps.map((s, k) => (
          <li key={s} className={cn('flex items-center gap-2 text-sm transition-opacity', k > i ? 'opacity-35' : 'opacity-100', k === i ? 'text-ink' : 'text-ink-2')}>
            {k < i ? <Check className="h-3.5 w-3.5 text-positive" aria-hidden /> : k === i ? <Loader2 className="spin-slow h-3.5 w-3.5 text-ai" aria-hidden /> : <span className="h-3.5 w-3.5 rounded-full border border-line" aria-hidden />}
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function CardHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

// "Powered by …" badge naming the Snowflake capability behind a component.
export function PoweredBy({ label, policy }: { label: string; policy?: boolean }) {
  const Icon = policy ? ShieldCheck : Cpu;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent-soft px-2.5 py-0.5 text-[11px] font-medium text-accent">
      <Icon className="h-3 w-3" aria-hidden /> {policy ? '' : 'Powered by '}{label}
    </span>
  );
}

// Required label on every scripted (mocked) AI output.
export function SampleAiLabel() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-ai/25 bg-ai-soft px-2.5 py-0.5 text-[11px] font-semibold text-ai">
      <Sparkles className="h-3 w-3" aria-hidden /> Sample AI response
    </span>
  );
}

export function Delta({ value, goodWhenUp = true, unit = 'pct' }: { value: number | null; goodWhenUp?: boolean; unit?: 'pct' | 'pts' }) {
  if (value === null || Number.isNaN(value)) return <span className="text-xs text-muted">—</span>;
  const flat = Math.abs(value) < 0.0005;
  const good = flat ? null : (value > 0) === goodWhenUp;
  const Icon = flat ? Minus : value > 0 ? TrendingUp : TrendingDown;
  const txt = unit === 'pts' ? `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)} pts` : `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium tabular', good === null ? 'text-muted' : good ? 'text-positive' : 'text-negative')}>
      <Icon className="h-3 w-3" aria-hidden /> {txt}
    </span>
  );
}

export function Kpi({ label, value, delta, note }: { label: string; value: string; delta: React.ReactNode; note?: string }) {
  return (
    <div className="kpi-accent lift fade-up rounded-2xl border border-line bg-surface p-4 card-elev">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-ink tabular">{value}</div>
      <div className="mt-1 flex items-center gap-2">{delta}<span className="text-[11px] text-muted">{note ?? 'vs last year'}</span></div>
    </div>
  );
}

export function Sparkline({ values, down, className }: { values: number[]; down?: boolean; className?: string }) {
  const w = 84, h = 24, max = Math.max(1, ...values), min = Math.min(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 2 - ((v - min) / (max - min || 1)) * (h - 4)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden>
      <polyline points={pts} fill="none" strokeWidth="1.5" stroke={down ? 'var(--negative)' : 'var(--chart-1)'} />
    </svg>
  );
}

export function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

// Minimal Markdown for AI text: **bold**, "- " bullets, paragraphs. Escapes everything else.
export function RichText({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const inline = (s: string, k: number) => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={`${k}-${i}`} className="font-semibold text-ink">{part.slice(2, -2)}</strong> : <span key={`${k}-${i}`}>{part}</span>);
  const flush = (k: number) => {
    if (bullets.length) blocks.push(<ul key={`u${k}`} className="ml-5 list-disc space-y-1">{bullets.map((b, i) => <li key={i}>{inline(b, i)}</li>)}</ul>);
    bullets = [];
  };
  text.split('\n').forEach((line, k) => {
    const t = line.trim();
    if (/^[-*•]\s+/.test(t)) { bullets.push(t.replace(/^[-*•]\s+/, '')); return; }
    flush(k);
    if (!t) return;
    const h = t.replace(/^#+\s*/, '');
    blocks.push(<p key={k}>{inline(h, k)}</p>);
  });
  flush(-1);
  return <div className="space-y-2 text-sm leading-relaxed text-ink-2">{blocks}</div>;
}
