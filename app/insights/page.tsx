'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bookmark, Download, Printer, Trash2 } from 'lucide-react';
import { loadInsights, toMarkdown, updateInsights } from '@/lib/insights';
import type { Insight } from '@/lib/types';
import { Card, RichText } from '@/components/ui';

export default function InsightsPage() {
  const [items, setItems] = useState<Insight[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => { const all = loadInsights(); setItems(all); setSelected(new Set(all.map((i) => i.id))); }, []);

  const set = (next: Insight[]) => { setItems(next); updateInsights(next); };
  const chosen = items.filter((i) => selected.has(i.id));
  const exportMd = () => {
    const blob = new Blob([toMarkdown(chosen)], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'visit-brief.md'; a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">My insights</h1>
          <p className="mt-1 text-sm text-muted">Answers and briefs you pinned. Add your own notes, choose what to include, then export a visit brief. Saved in this browser only.</p>
        </div>
        {items.length > 0 && (
          <div className="no-print flex gap-2">
            <button onClick={exportMd} disabled={!chosen.length} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"><Download className="h-4 w-4" /> Export visit brief (.md)</button>
            <button onClick={() => window.print()} disabled={!chosen.length} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-2 hover:bg-surface-2 disabled:opacity-40"><Printer className="h-4 w-4" /> Print / PDF</button>
          </div>
        )}
      </div>

      {items.length === 0 && (
        <Card>
          <div className="flex items-start gap-3">
            <Bookmark className="mt-0.5 h-5 w-5 text-accent" aria-hidden />
            <div className="text-sm text-ink-2">
              Nothing pinned yet. Generate a <Link href="/dealers" className="font-medium text-accent hover:underline">visit prep brief</Link> on a dealer page,
              or pin an answer from <Link href="/agent" className="font-medium text-accent hover:underline">Ask the agent</Link>. Pinned items show up here for review before you share them.
            </div>
          </div>
        </Card>
      )}

      {items.map((i) => (
        <Card key={i.id} className={selected.has(i.id) ? '' : 'no-print opacity-60'}>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <label className="flex items-start gap-2">
              <input type="checkbox" className="no-print mt-1 accent-[var(--accent)]" checked={selected.has(i.id)}
                onChange={(e) => setSelected((s) => { const n = new Set(s); if (e.target.checked) n.add(i.id); else n.delete(i.id); return n; })} />
              <span>
                <span className="block text-sm font-semibold text-ink">{i.title}</span>
                <span className="text-[11px] text-muted">{i.kind === 'brief' ? 'Visit prep brief' : 'Agent answer'} · {i.source} · {new Date(i.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </span>
            </label>
            <div className="no-print flex items-center gap-3">
              {i.dealerId && <Link href={`/dealer?id=${i.dealerId}`} className="text-xs font-medium text-accent hover:underline">Open dealer</Link>}
              <button onClick={() => set(items.filter((x) => x.id !== i.id))} aria-label="Remove" className="text-muted hover:text-negative"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
          <RichText text={i.body} />
          <label className="no-print mt-4 block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">My note</span>
            <textarea value={i.note} onChange={(e) => set(items.map((x) => (x.id === i.id ? { ...x, note: e.target.value } : x)))} rows={2}
              placeholder="Add context or a follow-up for the visit"
              className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent" />
          </label>
          {i.note && <p className="print-only mt-3 text-sm"><strong>My note:</strong> {i.note}</p>}
        </Card>
      ))}
    </div>
  );
}
