// Live data source: the same screens, computed in Snowflake from the objects in sql/setup.sql.
// Every query uses bind variables. "View as" switches the session role, so the row access
// policy on DEALERS (not app code) decides which dealers a rep can see.
import snowflake from 'snowflake-sdk';
import type { SalesSource } from './sales-data';
import type { AgentAnswer, Chart, DealerDetail, DealerRow, MetricDefinition, Overview, Pair, Persona, Scope, VisitBrief } from './types';

snowflake.configure({ logLevel: 'ERROR' });

const ROLE: Record<Persona, string> = {
  director: process.env.SNOWFLAKE_ROLE ?? 'INSURANCE_SALES_DEMO_ROLE',
  rep: process.env.SNOWFLAKE_REP_ROLE ?? 'INSURANCE_SALES_REP_ROLE',
};
const AGENT = process.env.SNOWFLAKE_AGENT_NAME ?? 'INSURANCE_SALES_DB.SALES.INSURANCE_SALES_AGENT';
const BRIEF_MODEL = process.env.SNOWFLAKE_BRIEF_MODEL ?? 'claude-sonnet-4-5';

export function isSnowflakeConfigured(): boolean {
  return !!(process.env.SNOWFLAKE_ACCOUNT && process.env.SNOWFLAKE_USERNAME && process.env.SNOWFLAKE_PRIVATE_KEY_PATH);
}

const pool = new Map<Persona, Promise<snowflake.Connection>>();

function connect(persona: Persona): Promise<snowflake.Connection> {
  const existing = pool.get(persona);
  if (existing) return existing;
  const p = new Promise<snowflake.Connection>((resolve, reject) => {
    const conn = snowflake.createConnection({
      account: process.env.SNOWFLAKE_ACCOUNT!,
      username: process.env.SNOWFLAKE_USERNAME!,
      authenticator: 'SNOWFLAKE_JWT',
      privateKeyPath: process.env.SNOWFLAKE_PRIVATE_KEY_PATH!,
      role: ROLE[persona],
      warehouse: process.env.SNOWFLAKE_WAREHOUSE ?? 'INSURANCE_SALES_WH',
      database: process.env.SNOWFLAKE_DATABASE ?? 'INSURANCE_SALES_DB',
      schema: process.env.SNOWFLAKE_SCHEMA ?? 'SALES',
      clientSessionKeepAlive: true,
    });
    conn.connect((err) => (err ? reject(new Error(`Snowflake connection failed: ${err.message}`)) : resolve(conn)));
  });
  p.catch(() => pool.delete(persona));
  pool.set(persona, p);
  return p;
}

type Row = Record<string, unknown>;
async function q<T extends Row = Row>(persona: Persona, sqlText: string, binds: snowflake.Binds = [], retry = true): Promise<T[]> {
  let conn = await connect(persona);
  if (!conn.isUp()) { pool.delete(persona); conn = await connect(persona); }
  try {
    return await new Promise<T[]>((resolve, reject) => {
      conn.execute({
        sqlText, binds,
        complete: (err, _stmt, rows) => (err ? reject(new Error(`Query failed: ${err.message}`)) : resolve((rows ?? []) as T[])),
      });
    });
  } catch (err) {
    // Idle connections can be closed server-side; reconnect once and retry.
    if (retry && /terminated connection|session.*(expired|no longer exists)|authentication token has expired/i.test((err as Error).message)) {
      pool.delete(persona);
      return q<T>(persona, sqlText, binds, false);
    }
    throw err;
  }
}

const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const div = (a: number, b: number) => (b ? a / b : null);
const ym = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 7) : String(v).slice(0, 7));

// Filter predicate shared by queries that join DEALERS d (and optionally product column p).
const dealerFilter = `(?::STRING IS NULL OR d.REGION = ?) AND (?::STRING IS NULL OR d.TIER = ?)`;
const dealerBinds = (s: Scope) => [s.region ?? null, s.region ?? null, s.tier ?? null, s.tier ?? null];
const productFilter = `(?::STRING IS NULL OR p.PRODUCT_CODE = ?)`;
const productBinds = (s: Scope) => [s.product ?? null, s.product ?? null];

async function overview(s: Scope): Promise<Overview> {
  const [per, deals, monthly, regions, share] = await Promise.all([
    q(s.persona, `SELECT p.PERIOD, SUM(p.CONTRACTS) C, SUM(p.PREMIUM) PR, SUM(p.FINANCED_CONTRACTS) F, SUM(p.PAID) PD
      FROM DEALER_PRODUCT_MONTHLY p JOIN DEALERS d ON d.DEALER_ID = p.DEALER_ID
      WHERE ${dealerFilter} AND ${productFilter} GROUP BY 1`, [...dealerBinds(s), ...productBinds(s)]),
    q(s.persona, `SELECT IFF(f.MONTH >= '2025-12-01', 'TTM', IFF(f.MONTH >= '2024-12-01', 'PRIOR_TTM', 'PRIOR_2')) PERIOD, SUM(f.FINANCED_DEALS) N
      FROM DEALER_FINANCED_DEALS f JOIN DEALERS d ON d.DEALER_ID = f.DEALER_ID WHERE ${dealerFilter} GROUP BY 1`, dealerBinds(s)),
    q(s.persona, `SELECT p.MONTH, SUM(p.CONTRACTS) C, SUM(p.PREMIUM) PR, SUM(p.PAID) PD
      FROM DEALER_PRODUCT_MONTHLY p JOIN DEALERS d ON d.DEALER_ID = p.DEALER_ID
      WHERE ${dealerFilter} AND ${productFilter} GROUP BY 1 ORDER BY 1`, [...dealerBinds(s), ...productBinds(s)]),
    q(s.persona, `SELECT d.REGION, p.PERIOD, SUM(p.CONTRACTS) C, SUM(p.PREMIUM) PR
      FROM DEALER_PRODUCT_MONTHLY p JOIN DEALERS d ON d.DEALER_ID = p.DEALER_ID
      WHERE (?::STRING IS NULL OR d.TIER = ?) AND ${productFilter} GROUP BY 1, 2`, [s.tier ?? null, s.tier ?? null, ...productBinds(s)]),
    q(s.persona, `SELECT m.PERIOD, SUM(m.OUR_UNITS) / NULLIF(SUM(m.MARKET_UNITS), 0) S FROM MARKET_SHARE_MONTHLY m
      WHERE m.STATE IN (SELECT d.STATE FROM DEALERS d WHERE (?::STRING IS NULL OR d.REGION = ?))
        AND (?::STRING IS NULL OR m.PRODUCT_CODE = ?) GROUP BY 1`, [s.region ?? null, s.region ?? null, ...productBinds(s)]),
  ]);
  const get = (rows: Row[], period: string) => rows.find((r) => r.PERIOD === period) ?? {};
  const pr = (fn: (r: Row, d: Row) => number | null): Pair => ({
    ttm: fn(get(per, 'TTM'), get(deals, 'TTM')) ?? 0, prior: fn(get(per, 'PRIOR_TTM'), get(deals, 'PRIOR_TTM')) ?? 0,
  });
  const regionNames = [...new Set(regions.map((r) => String(r.REGION)))];
  return {
    kpis: {
      premium: pr((r) => n(r.PR)),
      contracts: pr((r) => n(r.C)),
      attachRate: pr((r, d) => div(n(r.F), n(d.N))),
      lossRatio: pr((r) => div(n(r.PD), n(r.PR))),
      share: { ttm: n(get(share, 'TTM').S), prior: n(get(share, 'PRIOR_TTM').S) },
    },
    trend: monthly.map((r) => ({ month: ym(r.MONTH), contracts: n(r.C), premium: Math.round(n(r.PR)), lossRatio: div(n(r.PD), n(r.PR)) })),
    regions: regionNames.map((region) => {
      const rr = (period: string) => regions.find((r) => r.REGION === region && r.PERIOD === period) ?? {};
      return { region, contracts: { ttm: n(rr('TTM').C), prior: n(rr('PRIOR_TTM').C) }, premium: { ttm: n(rr('TTM').PR), prior: n(rr('PRIOR_TTM').PR) } };
    }),
  };
}

async function dealers(s: Scope): Promise<DealerRow[]> {
  const [rows, spark, deals] = await Promise.all([
    q(s.persona, `SELECT d.DEALER_ID, d.DEALER_NAME, d.STATE, d.REGION, d.TERRITORY, d.TIER, d.DEALER_GROUP, r.REP_NAME,
        SUM(IFF(p.PERIOD = 'TTM', p.CONTRACTS, 0)) C_TTM, SUM(IFF(p.PERIOD = 'PRIOR_TTM', p.CONTRACTS, 0)) C_PRIOR,
        SUM(IFF(p.PERIOD = 'TTM', p.PREMIUM, 0)) PR, SUM(IFF(p.PERIOD = 'TTM', p.PAID, 0)) PD,
        SUM(IFF(p.PERIOD = 'TTM', p.FINANCED_CONTRACTS, 0)) F
      FROM DEALER_PRODUCT_MONTHLY p JOIN DEALERS d ON d.DEALER_ID = p.DEALER_ID JOIN REPS r ON r.REP_ID = d.REP_ID
      WHERE ${dealerFilter} AND ${productFilter} GROUP BY 1, 2, 3, 4, 5, 6, 7, 8`, [...dealerBinds(s), ...productBinds(s)]),
    q(s.persona, `SELECT p.DEALER_ID, p.MONTH, SUM(p.CONTRACTS) C
      FROM DEALER_PRODUCT_MONTHLY p JOIN DEALERS d ON d.DEALER_ID = p.DEALER_ID
      WHERE p.PERIOD = 'TTM' AND ${dealerFilter} AND ${productFilter} GROUP BY 1, 2`, [...dealerBinds(s), ...productBinds(s)]),
    q(s.persona, `SELECT f.DEALER_ID, SUM(f.FINANCED_DEALS) N FROM DEALER_FINANCED_DEALS f JOIN DEALERS d ON d.DEALER_ID = f.DEALER_ID
      WHERE f.MONTH >= '2025-12-01' AND ${dealerFilter} GROUP BY 1`, dealerBinds(s)),
  ]);
  const months = Array.from({ length: 12 }, (_, k) => new Date(Date.UTC(2025, 11 + k, 1)).toISOString().slice(0, 7));
  const sparkBy = new Map<string, Map<string, number>>();
  for (const r of spark) {
    const m = sparkBy.get(String(r.DEALER_ID)) ?? new Map<string, number>();
    m.set(ym(r.MONTH), n(r.C)); sparkBy.set(String(r.DEALER_ID), m);
  }
  const dealsBy = new Map(deals.map((r) => [String(r.DEALER_ID), n(r.N)]));
  return rows.map((r) => ({
    id: String(r.DEALER_ID), name: String(r.DEALER_NAME), state: String(r.STATE), region: String(r.REGION),
    territory: String(r.TERRITORY), tier: String(r.TIER), group: String(r.DEALER_GROUP), rep: String(r.REP_NAME),
    contracts: { ttm: n(r.C_TTM), prior: n(r.C_PRIOR) }, premium: Math.round(n(r.PR)),
    lossRatio: div(n(r.PD), n(r.PR)), attachRate: div(n(r.F), dealsBy.get(String(r.DEALER_ID)) ?? 0),
    spark: months.map((m) => sparkBy.get(String(r.DEALER_ID))?.get(m) ?? 0),
  }));
}

async function dealer(s: Scope, id: string): Promise<DealerDetail | null> {
  const [info, byProduct, monthly, deals, causes] = await Promise.all([
    q(s.persona, `SELECT d.*, r.REP_NAME FROM DEALERS d JOIN REPS r ON r.REP_ID = d.REP_ID WHERE d.DEALER_ID = ?`, [id]),
    q(s.persona, `SELECT pr.PRODUCT_CODE, pr.PRODUCT_NAME, p.PERIOD, SUM(p.CONTRACTS) C, SUM(p.PREMIUM) PR, SUM(p.CLAIMS) K, SUM(p.PAID) PD
      FROM DEALER_PRODUCT_MONTHLY p JOIN DEALERS d ON d.DEALER_ID = p.DEALER_ID JOIN PRODUCTS pr ON pr.PRODUCT_CODE = p.PRODUCT_CODE
      WHERE p.DEALER_ID = ? GROUP BY 1, 2, 3`, [id]),
    q(s.persona, `SELECT p.MONTH, SUM(p.CONTRACTS) C, SUM(p.FINANCED_CONTRACTS) F
      FROM DEALER_PRODUCT_MONTHLY p JOIN DEALERS d ON d.DEALER_ID = p.DEALER_ID WHERE p.DEALER_ID = ? GROUP BY 1 ORDER BY 1`, [id]),
    q(s.persona, `SELECT f.MONTH, f.FINANCED_DEALS N FROM DEALER_FINANCED_DEALS f JOIN DEALERS d ON d.DEALER_ID = f.DEALER_ID WHERE f.DEALER_ID = ?`, [id]),
    q(s.persona, `SELECT c.PRODUCT_CODE, c.CAUSE, SUM(c.CLAIMS) K, SUM(c.PAID) PD FROM CLAIM_CAUSES_MONTHLY c
      WHERE c.DEALER_ID = ? AND c.PERIOD = 'TTM' GROUP BY 1, 2 ORDER BY PD DESC`, [id]),
  ]);
  if (!info.length) return null; // filtered out by the row access policy
  const d = info[0];
  const products = [...new Map(byProduct.map((r) => [String(r.PRODUCT_CODE), String(r.PRODUCT_NAME)]))];
  const order = ['VSC', 'GAP', 'TW', 'APP', 'KEY'];
  products.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  const cell = (code: string, period: string) => byProduct.find((r) => r.PRODUCT_CODE === code && r.PERIOD === period) ?? {};
  const dealsBy = new Map(deals.map((r) => [ym(r.MONTH), n(r.N)]));
  const side = (r: Row) => ({ lossRatio: div(n(r.PD), n(r.PR)), frequency: div(n(r.K), n(r.C)), severity: div(n(r.PD), n(r.K)), premium: Math.round(n(r.PR)) });
  return {
    dealer: { id, name: String(d.DEALER_NAME), state: String(d.STATE), zip: String(d.ZIP), region: String(d.REGION), territory: String(d.TERRITORY),
      tier: String(d.TIER), group: String(d.DEALER_GROUP), brand: String(d.FRANCHISE_BRAND), rep: String(d.REP_NAME),
      onboarded: d.ONBOARDED_DATE instanceof Date ? d.ONBOARDED_DATE.toISOString().slice(0, 10) : String(d.ONBOARDED_DATE) },
    productMix: products.map(([code, name]) => ({ product: code, productName: name,
      contracts: { ttm: n(cell(code, 'TTM').C), prior: n(cell(code, 'PRIOR_TTM').C) },
      premium: { ttm: Math.round(n(cell(code, 'TTM').PR)), prior: Math.round(n(cell(code, 'PRIOR_TTM').PR)) } })),
    monthly: monthly.map((r) => ({ month: ym(r.MONTH), contracts: n(r.C), attachRate: div(n(r.F), dealsBy.get(ym(r.MONTH)) ?? 0) })),
    decomposition: products.map(([code, name]) => ({ product: code, productName: name, prior: side(cell(code, 'PRIOR_TTM')), ttm: side(cell(code, 'TTM')) })),
    causes: causes.map((r) => ({ product: String(r.PRODUCT_CODE), cause: String(r.CAUSE), claims: n(r.K), paid: Math.round(n(r.PD)) })),
  };
}

async function definitions(): Promise<MetricDefinition[]> {
  const rows = await q('director', `SELECT METRIC, DEFINITION, SEMANTIC_VIEW_METRIC FROM METRIC_DEFINITIONS`);
  return rows.map((r) => ({ metric: String(r.METRIC), definition: String(r.DEFINITION), semanticViewMetric: String(r.SEMANTIC_VIEW_METRIC) }));
}

// ---- Cortex Agent ------------------------------------------------------------------------
interface ContentItem {
  type: string;
  text?: string;
  tool_use?: { type?: string; input?: { sql?: string; verified_query_used?: boolean } };
  table?: { result_set?: { data?: unknown[][]; resultSetMetaData?: { rowType?: { name: string; type: string }[] } } };
}

async function ask(s: Scope, question: string): Promise<AgentAnswer> {
  const body = JSON.stringify({ messages: [{ role: 'user', content: [{ type: 'text', text: question }] }] });
  const rows = await q<{ R: string }>(s.persona, `SELECT SNOWFLAKE.CORTEX.DATA_AGENT_RUN(?, ?, TRUE) AS R`, [AGENT, body]);
  const resp = JSON.parse(rows[0].R) as { content?: ContentItem[] };
  const content = resp.content ?? [];
  // The final answer is the text after the agent's last tool step; earlier text is interim reasoning.
  const lastTool = content.reduce((k, c, i) => (c.type === 'tool_use' || c.type === 'tool_result' ? i : k), -1);
  const finalTexts = content.slice(lastTool + 1).filter((c) => c.type === 'text' && c.text);
  const texts = finalTexts.length ? finalTexts : content.filter((c) => c.type === 'text' && c.text);
  const sqlUses = content.filter((c) => c.type === 'tool_use' && c.tool_use?.input?.sql);
  const tables = content.filter((c) => c.type === 'table' && c.table?.result_set);
  const lastSql = sqlUses[sqlUses.length - 1]?.tool_use?.input;
  const rs = tables[tables.length - 1]?.table?.result_set;
  const columns = rs?.resultSetMetaData?.rowType?.map((r) => r.name) ?? [];
  const types = rs?.resultSetMetaData?.rowType?.map((r) => r.type) ?? [];
  const data = (rs?.data ?? []).map((r) => r.map((v, i) => (types[i] === 'fixed' || types[i] === 'real') && v !== null ? Number(v) : (v as string | null)));
  return {
    text: texts.length ? texts.map((t) => t.text!.trim()).join('\n\n') : 'The agent returned no text answer.',
    sql: lastSql?.sql ?? null,
    verifiedQuery: sqlUses.some((c) => c.tool_use?.input?.verified_query_used),
    chart: chartFrom(columns, types, data),
    table: columns.length ? { columns, rows: data.slice(0, 20) } : null,
    source: 'cortex-agent',
  };
}

// Pick the first label column and the first numeric column (preferring rates/changes) for a chart.
function chartFrom(columns: string[], types: string[], data: (string | number | null)[][]): Chart | null {
  if (!columns.length || data.length < 2) return null;
  const x = types.findIndex((t) => t === 'text' || t === 'date');
  const nums = types.map((t, i) => (t === 'fixed' || t === 'real' ? i : -1)).filter((i) => i >= 0);
  if (x < 0 || !nums.length) return null;
  const pref = nums.find((i) => /RATIO|SHARE|RATE|CHANGE|PCT/i.test(columns[i])) ?? nums[nums.length - 1];
  const isPct = /RATIO|SHARE|RATE|PCT|FREQUENCY/i.test(columns[pref]);
  return {
    kind: types[x] === 'date' || /MONTH/i.test(columns[x]) ? 'line' : 'bar',
    xKey: 'x', yKey: 'y', yLabel: columns[pref].toLowerCase().replace(/_/g, ' '), format: isPct ? 'pct' : 'number',
    data: data.slice(0, 36).map((r) => ({ x: String(r[x]).slice(0, 24), y: Number(r[pref] ?? 0) })),
  };
}

// ---- AI_COMPLETE visit brief ------------------------------------------------------------------
async function brief(s: Scope, id: string): Promise<VisitBrief> {
  const d = await dealer(s, id);
  if (!d) return { text: 'Dealer not available in your territory.', source: 'ai-complete', model: BRIEF_MODEL };
  const facts = {
    dealer: d.dealer, productMix: d.productMix,
    attachRateLast24Months: d.monthly.slice(-24).map((m) => ({ month: m.month, attachRate: m.attachRate && +m.attachRate.toFixed(3) })),
    lossRatioDecomposition: d.decomposition, topClaimCauses: d.causes.slice(0, 5),
  };
  const prompt = `You are preparing a field sales rep for a visit to a car dealer that sells our dealer-distributed insurance products ` +
    `(VSC = vehicle service contract, GAP, TW = tire & wheel, APP = appearance, KEY = key replacement). "ttm" is this year (Dec 2025-Nov 2026) and "prior" is last year. ` +
    `Loss ratio is claims paid / premium written; frequency = claims per contract; severity = average paid claim. ` +
    `Write a visit prep brief in Markdown, under 170 words: a bold dealer line, then **Headline**, **Product mix**, **Loss ratio** (say whether changes come from frequency or severity), ` +
    `**Top claim cause**, and **Topics to discuss** (3-4 bullets phrased as questions or discussion topics). Use only the numbers below, show percentages with one decimal, ` +
    `and when a loss ratio changed, name whichever of frequency or severity changed more in relative terms. If total contracts fell by more than half, explain that the high loss ratio ` +
    `and frequency are mostly run-off (claims on contracts sold before the drop) rather than a claims trend. Do not use headings with #, ` +
    `and do not recommend pricing, underwriting, or claims decisions.\n\nDATA:\n${JSON.stringify(facts)}`;
  const rows = await q<{ R: string }>(s.persona, `SELECT AI_COMPLETE(?, ?) AS R`, [BRIEF_MODEL, prompt]);
  return { text: String(rows[0].R).trim(), source: 'ai-complete', model: BRIEF_MODEL };
}

export const liveSource: SalesSource = { overview, dealers, dealer, definitions, ask, brief };
