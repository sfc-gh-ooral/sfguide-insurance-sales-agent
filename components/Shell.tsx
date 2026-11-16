'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, BookOpen, Bookmark, Bot, LineChart, Store, UserRound } from 'lucide-react';
import { HOSTED_EXAMPLE } from '@/lib/hosted';
import { PERSONAS } from '@/lib/sales-data';
import { cn } from '@/lib/utils';
import { useAppState } from './AppState';

const NAV = [
  { href: '/', label: 'Territory overview', icon: LineChart },
  { href: '/dealers', label: 'Dealer explorer', icon: Store },
  { href: '/agent', label: 'Ask the agent', icon: Bot },
  { href: '/insights', label: 'My insights', icon: Bookmark },
  { href: '/glossary', label: 'Metric definitions', icon: BookOpen },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { persona, setPersona, mode } = useAppState();
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href) || (href === '/dealers' && path.startsWith('/dealer')));
  const live = mode === 'live';

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-line bg-surface lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white"><BarChart3 className="h-4 w-4" aria-hidden /></div>
          <div>
            <div className="text-sm font-semibold leading-tight text-ink">Sales Performance</div>
            <div className="text-[11px] text-muted">Dealer insurance products</div>
          </div>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={active(href) ? 'page' : undefined}
              className={cn('flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium',
                active(href) ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-surface-2')}>
              <Icon className="h-4 w-4" aria-hidden /> {label}
            </Link>
          ))}
        </nav>
        <div className="hidden px-4 pt-6 lg:block">
          <PersonaSwitch persona={persona} setPersona={setPersona} />
          <div className="mt-4 rounded-lg border border-line bg-surface-2 p-3 text-[11px] leading-relaxed text-muted">
            <div className="mb-1 font-semibold text-ink-2">{live ? 'Live: Snowflake' : 'Sample data mode'}</div>
            {live ? 'Queries run on your Snowflake account against synthetic data from sql/setup.sql.' : 'Runs on bundled synthetic data. AI answers are scripted samples.'}
          </div>
        </div>
      </aside>

      <main className="flex-1 lg:ml-60">
        <div className="border-b border-line bg-surface px-5 py-2 lg:hidden"><PersonaSwitch persona={persona} setPersona={setPersona} compact /></div>
        {HOSTED_EXAMPLE && (
          <div role="note" className="border-b border-line bg-surface-2 px-5 py-2 text-xs text-ink-2 lg:px-8">
            <strong className="text-ink">Sample data mode.</strong> Runs entirely in your browser on synthetic data; no Snowflake account needed.
            AI answers are scripted samples, not live Cortex output.{' '}
            <a className="underline underline-offset-2" href="https://github.com/sfc-gh-ooral/sfguide-insurance-sales-agent">Run it in your own account</a>
          </div>
        )}
        <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8">{children}</div>
        <footer className="mx-auto max-w-7xl px-5 pb-8 text-[11px] leading-relaxed text-muted lg:px-8">
          Synthetic data and illustrative logic only. Not production, regulatory, actuarial, or compliance advice. The agent explains data; people make the decisions.
          An example built on Snowflake; not an official Snowflake product.
        </footer>
      </main>
    </div>
  );
}

function PersonaSwitch({ persona, setPersona, compact }: { persona: 'director' | 'rep'; setPersona: (p: 'director' | 'rep') => void; compact?: boolean }) {
  return (
    <div className={cn(compact && 'flex items-center gap-3')}>
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
        <UserRound className="h-3 w-3" aria-hidden /> View as
      </div>
      <div role="radiogroup" aria-label="View as" className="flex rounded-lg border border-line bg-surface-2 p-0.5">
        {(['director', 'rep'] as const).map((p) => (
          <button key={p} role="radio" aria-checked={persona === p} onClick={() => setPersona(p)}
            className={cn('flex-1 rounded-md px-3 py-1.5 text-xs font-medium', persona === p ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}>
            {PERSONAS[p].short}
          </button>
        ))}
      </div>
      {!compact && <div className="mt-1.5 text-[11px] text-muted">{PERSONAS[persona].label} · {PERSONAS[persona].detail}</div>}
    </div>
  );
}
