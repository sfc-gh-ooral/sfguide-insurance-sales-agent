'use client';
import { api } from '@/lib/client';
import { VERIFIED_QUERIES } from '@/lib/verified-queries';
import { Card, CardHeader, PoweredBy } from '@/components/ui';
import { ErrorNote, Loading, useQuery } from '@/components/useQuery';

export default function GlossaryPage() {
  const { data, error } = useQuery(() => api.definitions(), []);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Metric definitions</h1>
        <p className="mt-1 text-sm text-muted">One set of definitions behind the overview, the explorer, and the agent, so answers match the BI report. The analytics team owns them in the semantic view.</p>
      </div>
      {error && <ErrorNote message={error} />}
      {!data && !error && <Loading />}
      {data && (
        <Card>
          <CardHeader title="Glossary" subtitle="INSURANCE_SALES_DB.SALES.INSURANCE_SALES_SV" right={<PoweredBy label="Semantic View" />} />
          <dl className="divide-y divide-line">
            {data.map((m) => (
              <div key={m.metric} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]">
                <dt className="text-sm font-semibold text-ink">{m.metric}</dt>
                <dd className="text-sm text-ink-2">{m.definition} <code className="ml-1 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">{m.semanticViewMetric}</code></dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">Synonyms reps use, such as &ldquo;penetration&rdquo; for attach rate or &ldquo;LR&rdquo; for loss ratio, are defined on these metrics so the agent understands them.</p>
        </Card>
      )}
      <Card>
        <CardHeader title={`Verified queries (${VERIFIED_QUERIES.length})`} subtitle="Questions with SQL reviewed by the analytics team. The agent uses them when a question matches." />
        <ul className="space-y-1.5 text-sm text-ink-2">
          {VERIFIED_QUERIES.map((q) => <li key={q.name} className="flex gap-2"><span className="text-positive">✓</span>{q.question}</li>)}
        </ul>
      </Card>
    </div>
  );
}
