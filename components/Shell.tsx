'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { BarChart3, BookOpen, Bookmark, Bot, Database, FlaskConical, LineChart, Snowflake, Store, UserRound, X } from 'lucide-react';
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
  const { persona, setPersona, mode, preferred, configured } = useAppState();
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href) || (href === '/dealers' && path.startsWith('/dealer')));
  const live = mode === 'live';

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sidebar-brand lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-lg shadow-sky-500/30"><BarChart3 className="h-4.5 w-4.5" aria-hidden /></div>
          <div>
            <div className="text-sm font-semibold leading-tight text-white">Sales Performance</div>
            <div className="text-[11px] text-sky-200/70">Dealer insurance products</div>
          </div>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={active(href) ? 'page' : undefined}
              className={cn('flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active(href) ? 'bg-white/10 text-white shadow-[inset_3px_0_0_#29b5e8]' : 'text-sky-100/75 hover:bg-white/5 hover:text-white')}>
              <Icon className={cn('h-4 w-4', active(href) && 'text-sky-300')} aria-hidden /> {label}
            </Link>
          ))}
        </nav>
        <div className="hidden px-4 pt-6 lg:block">
          <PersonaSwitch persona={persona} setPersona={setPersona} dark />
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] leading-relaxed text-sky-100/70">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-white">
              <span className={cn('h-2 w-2 rounded-full', live ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-violet-300 shadow-[0_0_8px_#c4b5fd]')} aria-hidden />
              {live ? 'Live: Snowflake' : 'Sample data mode'}
            </div>
            {live ? 'Queries run on your Snowflake account against synthetic data from sql/setup.sql.' : 'Runs on bundled synthetic data. AI answers are scripted samples.'}
          </div>
        </div>
        <div className="mt-auto hidden px-5 py-5 text-[11px] text-sky-200/60 lg:block">
          <span className="inline-flex items-center gap-1.5"><Snowflake className="h-3.5 w-3.5 text-sky-300" aria-hidden /> Built on Snowflake</span>
        </div>
      </aside>

      <main className="flex-1 lg:ml-64">
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface/80 px-5 py-2 backdrop-blur lg:px-8">
          <div className="lg:hidden"><PersonaSwitch persona={persona} setPersona={setPersona} compact /></div>
          <div className="hidden text-xs text-muted lg:block">{PERSONAS[persona].label} · {PERSONAS[persona].detail}</div>
          <ModeSwitch />
        </header>
        {HOSTED_EXAMPLE && (
          <div role="note" className="border-b border-ai/20 bg-ai-soft/60 px-5 py-2 text-xs text-ink-2 backdrop-blur lg:px-8">
            <strong className="text-ink">Sample data mode.</strong> Runs entirely in your browser on synthetic data; no Snowflake account needed.
            AI answers are scripted samples, not live Cortex output.{' '}
            <a className="underline underline-offset-2" href="https://github.com/sfc-gh-ooral/sfguide-insurance-sales-agent">Run it in your own account</a>
          </div>
        )}
        <div key={preferred} className="mx-auto max-w-7xl px-5 py-6 lg:px-8">{configured === null ? <div className="skeleton h-64 rounded-2xl" aria-hidden /> : children}</div>
        <footer className="mx-auto max-w-7xl px-5 pb-8 text-[11px] leading-relaxed text-muted lg:px-8">
          Synthetic data and illustrative logic only. Not production, regulatory, actuarial, or compliance advice. The agent explains data; people make the decisions.
          An example built on Snowflake; not an official Snowflake product.
        </footer>
      </main>
    </div>
  );
}

const LIVE_GUIDE = 'https://github.com/sfc-gh-ooral/sfguide-insurance-sales-agent#live-mode-run-it-in-your-snowflake-account';

// Sample / Live switch. Never collects credentials: Live needs .env.local, so without it we show the setup steps.
function ModeSwitch() {
  const { preferred, setPreferred, configured } = useAppState();
  const [help, setHelp] = useState(false);
  const pickLive = () => (configured ? setPreferred('live') : setHelp(true));
  const opt = (m: 'sample' | 'live', label: string, Icon: typeof Database) => (
    <button role="radio" aria-checked={preferred === m} onClick={() => (m === 'live' ? pickLive() : setPreferred('sample'))}
      className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
        preferred === m ? (m === 'live' ? 'bg-emerald-600 text-white shadow' : 'ai-gradient text-white shadow') : 'text-muted hover:text-ink')}>
      <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
    </button>
  );
  return (
    <div className="relative">
      <div role="radiogroup" aria-label="Data mode" className="flex rounded-lg border border-line bg-surface-2 p-0.5">
        {opt('sample', 'Sample', FlaskConical)}
        {opt('live', 'Live', Database)}
      </div>
      {help && (
        <div role="dialog" aria-label="Set up Live mode" className="fade-up absolute right-0 top-11 z-30 w-[min(92vw,380px)] rounded-xl border border-line bg-surface p-4 text-xs text-ink-2 shadow-2xl">
          <button onClick={() => setHelp(false)} aria-label="Close" className="absolute right-2 top-2 rounded p-1 text-muted hover:text-ink"><X className="h-3.5 w-3.5" /></button>
          <div className="mb-1 text-sm font-semibold text-ink">Live mode runs in your Snowflake account</div>
          {HOSTED_EXAMPLE ? (
            <p>This hosted example always uses sample data. To run it live, clone the repository, run <code>sql/setup.sql</code>, and start it locally. <a className="font-medium text-accent underline" href={LIVE_GUIDE} target="_blank" rel="noreferrer">Read the live-mode guide</a></p>
          ) : (
            <>
              <p>No Snowflake connection is configured, so you&apos;re still in Sample mode. Run <code>sql/setup.sql</code>, then add these lines to <code>.env.local</code>:</p>
              <pre className="my-2 overflow-x-auto rounded-lg bg-surface-2 p-2 text-[11px]">{'SNOWFLAKE_ACCOUNT=<orgname>-<account_name>\nSNOWFLAKE_USERNAME=<YOUR_USER>\nSNOWFLAKE_PRIVATE_KEY_PATH=/absolute/path/rsa_key.p8'}</pre>
              <p>Restart with <code>npm run dev</code>. Credentials stay on your machine; this page never asks for them. <a className="font-medium text-accent underline" href={LIVE_GUIDE} target="_blank" rel="noreferrer">Full guide</a></p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PersonaSwitch({ persona, setPersona, compact, dark }: { persona: 'director' | 'rep'; setPersona: (p: 'director' | 'rep') => void; compact?: boolean; dark?: boolean }) {
  return (
    <div className={cn(compact && 'flex items-center gap-3')}>
      <div className={cn('mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide', dark ? 'text-sky-200/70' : 'text-muted')}>
        <UserRound className="h-3 w-3" aria-hidden /> View as
      </div>
      <div role="radiogroup" aria-label="View as" className={cn('flex rounded-lg p-0.5', dark ? 'border border-white/10 bg-white/5' : 'border border-line bg-surface-2')}>
        {(['director', 'rep'] as const).map((p) => (
          <button key={p} role="radio" aria-checked={persona === p} onClick={() => setPersona(p)}
            className={cn('flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
              persona === p ? (dark ? 'brand-gradient text-white shadow' : 'bg-surface text-ink shadow-sm') : (dark ? 'text-sky-100/70 hover:text-white' : 'text-muted hover:text-ink'))}>
            {PERSONAS[p].short}
          </button>
        ))}
      </div>
      {!compact && <div className={cn('mt-1.5 text-[11px]', dark ? 'text-sky-100/60' : 'text-muted')}>{PERSONAS[persona].label} · {PERSONAS[persona].detail}</div>}
    </div>
  );
}
