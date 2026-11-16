// Shapes shared by the mock source (bundled synthetic JSON) and the live source (Snowflake).

export type Persona = 'director' | 'rep';

export interface Scope {
  persona: Persona;
  region?: string | null;
  product?: string | null;
  tier?: string | null;
}

export interface Pair { ttm: number; prior: number }

export interface Overview {
  kpis: { premium: Pair; contracts: Pair; attachRate: Pair; lossRatio: Pair; share: Pair };
  trend: { month: string; contracts: number; premium: number; lossRatio: number | null }[];
  regions: { region: string; contracts: Pair; premium: Pair }[];
}

export interface DealerRow {
  id: string; name: string; state: string; region: string; territory: string; tier: string; group: string; rep: string;
  contracts: Pair; premium: number; lossRatio: number | null; attachRate: number | null;
  spark: number[]; // last 12 months of contracts
}

export interface DecompRow {
  product: string; productName: string;
  prior: { lossRatio: number | null; frequency: number | null; severity: number | null; premium: number };
  ttm: { lossRatio: number | null; frequency: number | null; severity: number | null; premium: number };
}

export interface DealerDetail {
  dealer: { id: string; name: string; state: string; zip: string; region: string; territory: string; tier: string; group: string; brand: string; rep: string; onboarded: string };
  productMix: { product: string; productName: string; contracts: Pair; premium: Pair }[];
  monthly: { month: string; contracts: number; attachRate: number | null }[];
  decomposition: DecompRow[];
  causes: { product: string; cause: string; claims: number; paid: number }[];
}

export interface MetricDefinition { metric: string; definition: string; semanticViewMetric: string }

export interface Chart { kind: 'bar' | 'line'; xKey: string; yKey: string; yLabel: string; format: 'number' | 'pct' | 'usd'; data: Record<string, string | number>[] }

export interface AgentAnswer {
  text: string;
  sql: string | null;
  verifiedQuery: boolean;
  chart: Chart | null;
  table: { columns: string[]; rows: (string | number | null)[][] } | null;
  source: 'sample' | 'cortex-agent';
}

export interface VisitBrief { text: string; source: 'sample' | 'ai-complete'; model?: string }

export interface Insight {
  id: string;
  kind: 'answer' | 'brief';
  title: string;
  body: string;
  sql?: string | null;
  dealerId?: string;
  source: string;
  note: string;
  createdAt: string;
}
