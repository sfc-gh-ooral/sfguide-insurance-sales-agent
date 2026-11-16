'use client';
// "My insights": pinned answers and visit briefs, kept in this browser only (localStorage).
// Nothing is written back to Snowflake; the rep decides what to share.
import type { Insight } from './types';

const KEY = 'isa.insights';

export function loadInsights(): Insight[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Insight[]; } catch { return []; }
}

export function saveInsight(i: Omit<Insight, 'id' | 'createdAt' | 'note'> & { note?: string }): Insight {
  const item: Insight = { ...i, note: i.note ?? '', id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, createdAt: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify([item, ...loadInsights()]));
  return item;
}

export function updateInsights(items: Insight[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function toMarkdown(items: Insight[]): string {
  const out = ['# Visit brief', '', `_Exported ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}. Synthetic data example; review before sharing._`, ''];
  for (const i of items) {
    out.push(`## ${i.title}`, '', `_${i.kind === 'brief' ? 'Visit prep brief' : 'Agent answer'} · ${i.source}_`, '', i.body, '');
    if (i.note) out.push(`**My note:** ${i.note}`, '');
    if (i.sql) out.push('```sql', i.sql, '```', '');
  }
  return out.join('\n');
}
