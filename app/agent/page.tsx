'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { BadgeCheck, Bookmark, Bot, Check, Code2, Send, Table2 } from 'lucide-react';
import { api } from '@/lib/client';
import { saveInsight } from '@/lib/insights';
import { PERSONAS, SUGGESTED_QUESTIONS } from '@/lib/sales-data';
import type { AgentAnswer } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useAppState } from '@/components/AppState';
import ChartView from '@/components/ChartView';
import { Card, PoweredBy, RichText, SampleAiLabel } from '@/components/ui';

interface Turn { id: number; question: string; answer?: AgentAnswer; error?: string; saved?: boolean }

export default function AgentPage() {
  return <Suspense><AgentChat /></Suspense>;
}

function AgentChat() {
  const { persona, reportMode } = useAppState();
  const params = useSearchParams();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const asked = useRef(false);
  const end = useRef<HTMLDivElement>(null);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    const id = Date.now();
    setTurns((t) => [...t, { id, question }]);
    setInput(''); setBusy(true);
    try {
      const r = await api.ask({ persona }, question);
      reportMode(r.mode);
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, answer: r.data } : x)));
    } catch (e) {
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, error: (e as Error).message } : x)));
    } finally { setBusy(false); }
  };

  useEffect(() => {
    const q = params.get('q');
    if (q && !asked.current) { asked.current = true; ask(q); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns]);

  const pin = (t: Turn) => {
    if (!t.answer) return;
    saveInsight({ kind: 'answer', title: t.question, body: t.answer.text, sql: t.answer.sql,
      source: t.answer.source === 'sample' ? 'Sample AI response' : `Cortex Agent${t.answer.verifiedQuery ? ' · verified query' : ''}` });
    setTurns((all) => all.map((x) => (x.id === t.id ? { ...x, saved: true } : x)));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Ask the agent</h1>
          <p className="mt-1 text-sm text-muted">Ask &ldquo;why&rdquo; questions in plain English. Every answer shows the SQL it ran. Viewing as {PERSONAS[persona].label.toLowerCase()} ({PERSONAS[persona].detail}).</p>
        </div>
        <div className="flex flex-wrap gap-2"><PoweredBy label="Cortex Agents" /><PoweredBy label="Cortex Analyst · Semantic View" /></div>
      </div>

      {turns.length === 0 && (
        <Card>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><Bot className="h-4 w-4 text-accent" /> Suggested questions</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button key={q} onClick={() => ask(q)} className="rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-left text-sm text-ink-2 hover:border-accent hover:text-ink">{q}</button>
            ))}
          </div>
        </Card>
      )}

      {turns.map((t) => (
        <div key={t.id} className="space-y-3">
          <div className="flex justify-end"><div className="max-w-[80%] rounded-2xl rounded-br-sm bg-accent px-4 py-2.5 text-sm text-white">{t.question}</div></div>
          {!t.answer && !t.error && <Card><div className="animate-pulse text-sm text-muted">Thinking… the agent is planning and running SQL against the semantic view.</div></Card>}
          {t.error && <Card><p className="text-sm text-negative">The agent call failed: {t.error}</p></Card>}
          {t.answer && (
            <Card className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {t.answer.source === 'sample' ? <SampleAiLabel /> : <PoweredBy label="Cortex Agents" />}
                {t.answer.verifiedQuery && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-positive/10 px-2 py-0.5 text-[11px] font-semibold text-positive">
                    <BadgeCheck className="h-3 w-3" aria-hidden /> Verified query
                  </span>
                )}
              </div>
              <RichText text={t.answer.text} />
              {t.answer.chart && <ChartView chart={t.answer.chart} />}
              {t.answer.sql && (
                <details className="rounded-lg border border-line bg-surface-2">
                  <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2 text-xs font-medium text-ink-2"><Code2 className="h-3.5 w-3.5" /> SQL used{t.answer.verifiedQuery ? ' (verified query on INSURANCE_SALES_SV)' : ' (generated over INSURANCE_SALES_SV)'}</summary>
                  <pre className="overflow-x-auto border-t border-line px-3 py-2 text-[11px] leading-relaxed text-ink-2"><code>{t.answer.sql}</code></pre>
                </details>
              )}
              {t.answer.table && (
                <details className="rounded-lg border border-line bg-surface-2">
                  <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2 text-xs font-medium text-ink-2"><Table2 className="h-3.5 w-3.5" /> Result table ({t.answer.table.rows.length} rows)</summary>
                  <div className="overflow-x-auto border-t border-line">
                    <table className="w-full text-xs">
                      <thead><tr>{t.answer.table.columns.map((c) => <th key={c} className="px-3 py-1.5 text-left font-semibold text-muted">{c}</th>)}</tr></thead>
                      <tbody>{t.answer.table.rows.map((r, i) => <tr key={i} className="border-t border-line">{r.map((v, j) => <td key={j} className="px-3 py-1.5 tabular text-ink-2">{typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(3) : String(v ?? '—')}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                </details>
              )}
              {(t.answer.verifiedQuery || t.answer.source === 'cortex-agent') && (
                <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
                  <p className="text-[11px] text-muted">The agent explains data only and takes no actions. Pin what you want to keep.</p>
                  <button onClick={() => pin(t)} disabled={t.saved}
                    className={cn('flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold', t.saved ? 'bg-positive/10 text-positive' : 'border border-line text-ink-2 hover:bg-surface-2')}>
                    {t.saved ? <Check className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />} {t.saved ? 'Pinned' : 'Pin to My insights'}
                  </button>
                </div>
              )}
            </Card>
          )}
        </div>
      ))}
      <div ref={end} />

      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="sticky bottom-4 flex gap-2 rounded-xl border border-line bg-surface p-2 shadow-lg">
        <input value={input} onChange={(e) => setInput(e.target.value)} disabled={busy} aria-label="Ask a question"
          placeholder="e.g. Why is Southeast volume down this year?" className="flex-1 bg-transparent px-2 text-sm text-ink placeholder:text-muted focus:outline-none" />
        <button type="submit" disabled={busy || !input.trim()} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">
          <Send className="h-4 w-4" aria-hidden /> Ask
        </button>
      </form>
      {turns.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.filter((q) => !turns.some((t) => t.question === q)).map((q) => (
            <button key={q} onClick={() => ask(q)} disabled={busy} className="rounded-full border border-line px-3 py-1 text-xs text-ink-2 hover:border-accent disabled:opacity-40">{q}</button>
          ))}
        </div>
      )}
    </div>
  );
}
