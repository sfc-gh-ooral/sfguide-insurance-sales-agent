// Data interface. Two implementations share it:
//   lib/mock-source.ts  bundled synthetic JSON (no-account mode, hosted example)
//   lib/snowflake.ts    live queries against sql/setup.sql objects
import type { AgentAnswer, DealerDetail, DealerRow, MetricDefinition, Overview, Scope, VisitBrief } from './types';

export interface SalesSource {
  overview(scope: Scope): Promise<Overview>;
  dealers(scope: Scope): Promise<DealerRow[]>;
  dealer(scope: Scope, id: string): Promise<DealerDetail | null>;
  definitions(): Promise<MetricDefinition[]>;
  ask(scope: Scope, question: string): Promise<AgentAnswer>;
  brief(scope: Scope, id: string): Promise<VisitBrief>;
}

// "This year" = trailing twelve months Dec 2025 - Nov 2026; "last year" = Dec 2024 - Nov 2025.
export const PERIOD_LABEL = { ttm: 'Dec 2025 – Nov 2026', prior: 'Dec 2024 – Nov 2025' };

// The rep persona maps to INSURANCE_SALES_REP_ROLE, whose row access policy shows one territory.
export const REP_TERRITORY = 'Southeast Inland';

export const PERSONAS = {
  director: { label: 'Regional sales director', short: 'Director', detail: 'All territories' },
  rep: { label: 'Field sales rep', short: 'Rep', detail: REP_TERRITORY },
} as const;

export const SUGGESTED_QUESTIONS = [
  'Why is Southeast volume down this year?',
  'Which dealers have GAP loss ratio above 80%?',
  "What's our VSC share in Texas vs last year?",
  'Is the Georgia GAP loss ratio increase driven by frequency or severity?',
  'Attach rate trend for Summit Auto Group',
];

export const REGIONS = ['Southeast', 'Northeast', 'Midwest', 'South Central', 'West'];
export const TIERS = ['Platinum', 'Gold', 'Silver'];
