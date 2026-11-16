// Seeded, deterministic synthetic data for the Insurance Sales Performance Agent.
// Same seed -> same numbers every run, so screenshots match what readers get.
//
//   node scripts/generate-data.mjs
//
// Writes:
//   data/csv/*.csv          row-level tables loaded into Snowflake by sql/load.sh
//   data/mock/*.json        pre-aggregated data the app uses in no-account mode
//
// All names are invented. Planted stories are documented in data/README.md.
import { mkdirSync, writeFileSync, createWriteStream } from "node:fs";

const SEED = 20261112;
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (lo, hi) => lo + rand() * (hi - lo);
const round2 = (x) => Math.round(x * 100) / 100;
function poisson(lambda) {
  if (lambda <= 0) return 0;
  if (lambda > 40) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * gauss()));
  const L = Math.exp(-lambda); let k = 0, p = 1;
  do { k++; p *= rand(); } while (p > L);
  return k - 1;
}
function gauss() {
  const u = Math.max(rand(), 1e-9), v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ---- Calendar: 36 months, Dec 2023 .. Nov 2026 ---------------------------------
const MONTHS = [];
for (let i = 0; i < 36; i++) {
  const d = new Date(Date.UTC(2023, 11 + i, 1));
  MONTHS.push(d.toISOString().slice(0, 7)); // YYYY-MM
}
const SWITCH_MONTH = 25; // index of 2026-01 (provider switch, story 1)

// ---- Geography ----------------------------------------------------------------
const GEO = {
  Southeast: { "Southeast Atlantic": ["GA", "FL"], "Southeast Inland": ["NC", "SC", "AL", "TN"] },
  Northeast: { "Northeast Metro": ["NY", "NJ"], "Northeast Corridor": ["PA", "MA"] },
  Midwest: { "Great Lakes": ["OH", "MI"], "Heartland": ["IL", "IN"] },
  "South Central": { "Texas": ["TX"], "Gulf Plains": ["OK", "LA", "AR"] },
  West: { "Pacific": ["CA", "WA"], "Mountain": ["AZ", "CO"] },
};
const ZIP_PREFIX = { GA: "303", FL: "327", NC: "275", SC: "292", AL: "352", TN: "372", NY: "112", NJ: "070",
  PA: "191", MA: "021", OH: "432", MI: "482", IL: "606", IN: "462", TX: "750", OK: "731", LA: "701",
  AR: "722", CA: "917", WA: "980", AZ: "850", CO: "802" };
const FIRST = ["Avery", "Jordan", "Morgan", "Riley", "Casey", "Taylor", "Quinn", "Reese", "Drew", "Parker",
  "Hayden", "Emerson", "Rowan", "Sawyer"];
const LAST = ["Calloway", "Brennan", "Okafor", "Lindqvist", "Ramires", "Whitfield", "Nakamura", "Delacroix",
  "Hollis", "Pemberton", "Vasquez", "Strand", "Abernathy", "Kowal"];
const PLACE = ["Harborview", "Ridgeline", "Oak Hollow", "Bluewater", "Granite Peak", "Maple Crossing",
  "Cedar Bend", "Silver Lake", "Prairie Wind", "Iron Creek", "Lakeshore", "Westgate", "Pine Valley",
  "Copper Hill", "Riverbend", "Stonebridge", "Fairhaven", "Northfield", "Sunset", "Highland", "Elm Street",
  "Crescent", "Twin Oaks", "Redstone", "Brookside", "Meadowbrook", "Summit View", "Bayfront", "Kingsway",
  "Old Mill", "Foxhill", "Willow Creek", "Seaside", "Hillcrest", "Clearwater", "Briarwood", "Eastpoint",
  "Sterling", "Canyon Ridge", "Glenwood", "Hawthorne", "Ashford", "Bridgewater", "Lone Pine", "Shady Grove",
  "Union Square", "Westbrook", "Gateway", "Millbrook", "Rolling Hills"];
const SUFFIX = ["Motors", "Auto", "Automotive", "Auto Plaza", "Motor Company", "Autos", "Car Center", "Auto Mall"];
const BRANDS = ["Brand A", "Brand B", "Brand C", "Brand D", "Brand E", "Brand F", "Brand G", "Brand H", "Independent"];

const PRODUCTS = [
  { code: "VSC", name: "Vehicle Service Contract", band: "$1,200–$2,800", attach: 0.34, premium: [1200, 2800], lr: 0.62, freq: 0.34, term: [24, 36, 48, 60] },
  { code: "GAP", name: "GAP", band: "$500–$950", attach: 0.24, premium: [500, 950], lr: 0.55, freq: 0.07, term: [36, 48, 60, 72] },
  { code: "TW", name: "Tire & Wheel", band: "$400–$900", attach: 0.15, premium: [400, 900], lr: 0.58, freq: 0.30, term: [36, 48, 60] },
  { code: "APP", name: "Appearance", band: "$300–$700", attach: 0.11, premium: [300, 700], lr: 0.45, freq: 0.16, term: [36, 60] },
  { code: "KEY", name: "Key Replacement", band: "$200–$450", attach: 0.08, premium: [200, 450], lr: 0.40, freq: 0.10, term: [36, 60] },
];
const CAUSES = {
  VSC: ["Engine", "Transmission", "Electrical", "A/C & heating", "Suspension", "Fuel system"],
  GAP: ["Total loss - collision", "Total loss - theft", "Total loss - weather"],
  TW: ["Tire - road hazard", "Wheel - curb damage", "Wheel - bent rim"],
  APP: ["Interior stain", "Paint chip", "Windshield chip"],
  KEY: ["Lost key", "Damaged fob"],
};

// ---- Reps and dealers -----------------------------------------------------------
const reps = [], dealers = [];
const usedNames = new Set();
let repN = 0, dealerN = 0;
for (const [region, terrs] of Object.entries(GEO)) {
  for (const [territory, states] of Object.entries(terrs)) {
    const rep = { rep_id: `R${String(++repN).padStart(2, "0")}`, rep_name: `${FIRST[repN % FIRST.length]} ${LAST[(repN * 5) % LAST.length]}`, territory, region };
    reps.push(rep);
    const nDealers = Math.round(26 * states.length ** 0.5 + 4);
    for (let i = 0; i < nDealers; i++) {
      let name;
      let tries = 0;
      do {
        name = tries < 20 ? `${pick(PLACE)} ${pick(SUFFIX)}` : `${pick(LAST)} ${pick(PLACE)} ${pick(SUFFIX)}`;
        tries++;
      } while (usedNames.has(name));
      usedNames.add(name);
      const state = pick(states);
      const onboard = new Date(Date.UTC(2012 + Math.floor(rand() * 11), Math.floor(rand() * 12), 1));
      dealers.push({
        dealer_id: `D${String(++dealerN).padStart(4, "0")}`, dealer_name: name, state,
        zip: ZIP_PREFIX[state] + String(10 + Math.floor(rand() * 89)), region, territory, rep_id: rep.rep_id,
        franchise_brand: pick(BRANDS), tier: "", dealer_group: "Independent",
        onboarded_date: onboard.toISOString().slice(0, 10),
        size: Math.exp(2.35 + 0.75 * gauss()), // monthly financed deals, lognormal
        attachMult: between(0.75, 1.25), lrMult: between(0.85, 1.15), growth: between(-0.02, 0.08), story: null,
      });
    }
  }
}

// Story 1: three Southeast dealers switch provider in Jan 2026. Size them so they
// carry ~18% of Southeast volume; with ~3% organic growth that lands near -14% YoY.
// Kept out of GA and FL so they don't distort stories 2 and 4.
const se = dealers.filter((d) => d.region === "Southeast" && d.state !== "FL" && d.state !== "GA");
const switchers = [se[3], se[11], se[20]];
const seOthers = dealers.filter((d) => d.region === "Southeast" && !switchers.includes(d));
const othersSize = seOthers.reduce((s, d) => s + d.size, 0);
const target = (0.205 / 0.795) * othersSize;
["Peachtree Auto Plaza", "Magnolia Motor Company", "Blue Ridge Automotive"].forEach((n, i) => {
  Object.assign(switchers[i], { dealer_name: n, size: target * [0.4, 0.33, 0.27][i], growth: 0.03, story: "provider-switch" });
});
for (const d of seOthers) d.growth = 0.03;

// Story 3: Summit Auto Group, six Midwest dealers growing fast with rising attach.
const mw = dealers.filter((d) => d.region === "Midwest");
mw.slice(5, 11).forEach((d, i) => {
  Object.assign(d, { dealer_group: "Summit Auto Group", dealer_name: `Summit ${["Lakeland", "Northgate", "Lakeview", "Riverside", "Parkway", "Crossroads"][i]} Auto`, growth: 0.32, story: "fast-growing-group", attachMult: 0.7 });
});

// Story 4: four Florida dealers sharing ZIP prefix 334 with anomalous Tire & Wheel claims.
const fl = dealers.filter((d) => d.state === "FL" && !d.story).slice(0, 4);
fl.forEach((d, i) => Object.assign(d, { zip: `334${12 + i * 3}`, story: "tw-claims-cluster" }));

// Other dealer groups (plain background)
const GROUPS = ["Lakeside Auto Group", "Keystone Dealer Group", "Pioneer Motor Group", "Frontier Auto Partners"];
dealers.forEach((d, i) => { if (!d.story && i % 9 === 0) d.dealer_group = GROUPS[i % GROUPS.length]; });

// Tier from size
const sizes = dealers.map((d) => d.size).sort((a, b) => b - a);
const t1 = sizes[Math.floor(sizes.length * 0.15)], t2 = sizes[Math.floor(sizes.length * 0.5)];
dealers.forEach((d) => { d.tier = d.size >= t1 ? "Platinum" : d.size >= t2 ? "Gold" : "Silver"; });

// ---- Contracts, financed deals, claims -----------------------------------------------
mkdirSync("data/csv", { recursive: true });
mkdirSync("data/mock", { recursive: true });
const csv = (name, header) => { const s = createWriteStream(`data/csv/${name}.csv`); s.write(header.join(",") + "\n"); return s; };
const cContracts = csv("contracts_sold", ["CONTRACT_ID", "DEALER_ID", "PRODUCT_CODE", "SALE_DATE", "PREMIUM", "TERM_MONTHS", "VEHICLE_CONDITION", "FINANCED_FLAG"]);
const cClaims = csv("claims", ["CLAIM_ID", "CONTRACT_ID", "PAID_DATE", "PAID_AMOUNT", "CAUSE", "STATUS"]);
const cDeals = csv("dealer_financed_deals", ["DEALER_ID", "MONTH", "FINANCED_DEALS"]);

// Aggregates for mock mode: dealer x product x month
// [contracts, premium, financed_contracts, claims, paid, used_claims]
const agg = new Map();
const aggKey = (d, p, m) => `${d}|${p}|${m}`;
const bump = (d, p, m, idx, v) => {
  const k = aggKey(d, p, m); let a = agg.get(k);
  if (!a) { a = [0, 0, 0, 0, 0]; agg.set(k, a); }
  a[idx] += v;
};
const dealsAgg = new Map(); // dealer|month -> financed deals
const causeAgg = new Map(); // dealer|product|cause -> [claims, paid] (last 12 months)
const stateUnits = new Map(); // state|product|month -> units (our)

let contractN = 0, claimN = 0;
for (const d of dealers) {
  for (let m = 0; m < 36; m++) {
    if (d.story === "provider-switch" && m >= SWITCH_MONTH) { cDeals.write(`${d.dealer_id},${MONTHS[m]}-01,${Math.round(d.size * 1.1)}\n`); dealsAgg.set(`${d.dealer_id}|${MONTHS[m]}`, Math.round(d.size * 1.1)); continue; }
    const yr = m / 12;
    const season = 1 + 0.08 * Math.sin(((m + 3) / 12) * 2 * Math.PI);
    const deals = poisson(d.size * season * (1 + d.growth) ** yr);
    cDeals.write(`${d.dealer_id},${MONTHS[m]}-01,${deals}\n`);
    dealsAgg.set(`${d.dealer_id}|${MONTHS[m]}`, deals);
    for (const p of PRODUCTS) {
      let attach = p.attach * d.attachMult;
      if (d.story === "fast-growing-group") attach *= 1 + 0.85 * (m / 35); // 0.7x -> ~1.3x of base
      const financed = poisson(deals * attach);
      const cash = poisson(deals * attach * 0.2);
      for (let c = 0; c < financed + cash; c++) {
        const isFin = c < financed;
        const used = rand() < (p.code === "GAP" ? 0.55 : 0.45);
        const premium = round2(between(...p.premium) * (used ? 1.05 : 1));
        const term = pick(p.term);
        const day = 1 + Math.floor(rand() * 28);
        const id = `C${String(++contractN).padStart(7, "0")}`;
        cContracts.write(`${id},${d.dealer_id},${p.code},${MONTHS[m]}-${String(day).padStart(2, "0")},${premium},${term},${used ? "Used" : "New"},${isFin ? "Y" : "N"}\n`);
        bump(d.dealer_id, p.code, m, 0, 1); bump(d.dealer_id, p.code, m, 1, premium); if (isFin) bump(d.dealer_id, p.code, m, 2, 1);
        const sk = `${d.state}|${p.code}|${m}`; stateUnits.set(sk, (stateUnits.get(sk) ?? 0) + 1);

        // Claims: frequency over the contract life, paid 1..12 months after sale (book is mature after year 1).
        let freq = p.freq * 1.3;
        const lag = 1 + Math.floor(rand() * 12);
        const pm = m + lag;
        if (pm > 35) continue;
        if (d.story === "tw-claims-cluster" && p.code === "TW" && pm >= 30) freq *= 3.2;
        if (rand() >= freq) continue;
        let sev = (p.lr * d.lrMult * premium) / (p.freq * 1.3);
        sev *= between(0.4, 1.6);
        // Story 2: Georgia GAP severity jumps on used vehicles in 2026 (used values fell).
        if (p.code === "GAP" && d.state === "GA" && used && pm >= SWITCH_MONTH) sev *= 2.6;
        let cause = pick(CAUSES[p.code]);
        if (d.story === "tw-claims-cluster" && p.code === "TW" && pm >= 30 && rand() < 0.7) cause = "Wheel - curb damage";
        const denied = rand() < 0.04;
        const paid = denied ? 0 : round2(sev);
        const pdate = `${MONTHS[pm]}-${String(1 + Math.floor(rand() * 28)).padStart(2, "0")}`;
        cClaims.write(`K${String(++claimN).padStart(7, "0")},${id},${pdate},${paid},${cause},${denied ? "DENIED" : "PAID"}\n`);
        if (!denied) {
          bump(d.dealer_id, p.code, pm, 3, 1); bump(d.dealer_id, p.code, pm, 4, paid);
          if (pm >= 24) { const ck = `${d.dealer_id}|${p.code}|${cause}`; const a = causeAgg.get(ck) ?? [0, 0]; a[0]++; a[1] += paid; causeAgg.set(ck, a); }
        }
      }
    }
  }
}
await Promise.all([cContracts, cClaims, cDeals].map((s) => new Promise((r) => s.end(r))));

// ---- Market benchmarks: total regional units by state x product x month ----------
// Base share ~18-24% by state, fixed per state/product so share moves only with our
// volume, except Texas VSC where competitors grow 12% (share slips; question 3).
const cMarket = csv("market_benchmarks", ["STATE", "REGION", "PRODUCT_CODE", "MONTH", "MARKET_UNITS"]);
const stateRegion = Object.fromEntries(dealers.map((d) => [d.state, d.region]));
const market = [];
for (const state of Object.keys(stateRegion).sort()) {
  for (const p of PRODUCTS) {
    // Share basis = our average monthly units in the first 12 months.
    let base = 0; for (let m = 0; m < 12; m++) base += stateUnits.get(`${state}|${p.code}|${m}`) ?? 0;
    base /= 12;
    const share = between(0.18, 0.24);
    for (let m = 0; m < 36; m++) {
      let mk = (base / share) * (1 + 0.03 * (m / 12)) * (1 + 0.08 * Math.sin(((m + 3) / 12) * 2 * Math.PI));
      if (state === "TX" && p.code === "VSC" && m >= 24) mk *= 1.12;
      const units = Math.round(mk * between(0.97, 1.03));
      cMarket.write(`${state},${stateRegion[state]},${p.code},${MONTHS[m]}-01,${units}\n`);
      market.push([state, p.code, m, units]);
    }
  }
}
await new Promise((r) => cMarket.end(r));

// ---- Dimension CSVs ---------------------------------------------------------------
const writeRows = (name, header, rows) => writeFileSync(`data/csv/${name}.csv`, [header.join(","), ...rows.map((r) => r.map((v) => (typeof v === "string" && v.includes(",") ? `"${v}"` : v)).join(","))].join("\n") + "\n");
writeRows("reps", ["REP_ID", "REP_NAME", "TERRITORY", "REGION"], reps.map((r) => [r.rep_id, r.rep_name, r.territory, r.region]));
writeRows("dealers", ["DEALER_ID", "DEALER_NAME", "STATE", "ZIP", "REGION", "TERRITORY", "REP_ID", "FRANCHISE_BRAND", "TIER", "DEALER_GROUP", "ONBOARDED_DATE"],
  dealers.map((d) => [d.dealer_id, d.dealer_name, d.state, d.zip, d.region, d.territory, d.rep_id, d.franchise_brand, d.tier, d.dealer_group, d.onboarded_date]));
writeRows("products", ["PRODUCT_CODE", "PRODUCT_NAME", "PREMIUM_BAND", "EXPECTED_LOSS_RATIO"], PRODUCTS.map((p) => [p.code, p.name, p.band, p.lr]));

// ---- Mock JSON ----------------------------------------------------------------------
const pIdx = Object.fromEntries(PRODUCTS.map((p, i) => [p.code, i]));
const facts = []; // [dealerIdx, productIdx, month, contracts, premium, financedContracts, claims, paid]
const dIdx = Object.fromEntries(dealers.map((d, i) => [d.dealer_id, i]));
for (const [k, a] of agg) {
  const [d, p, m] = k.split("|");
  facts.push([dIdx[d], pIdx[p], Number(m), a[0], Math.round(a[1]), a[2], a[3], Math.round(a[4])]);
}
facts.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);
const deals = dealers.map((d) => MONTHS.map((m) => dealsAgg.get(`${d.dealer_id}|${m}`) ?? 0));
const causes = [...causeAgg].map(([k, [n, paid]]) => { const [d, p, c] = k.split("|"); return [dIdx[d], pIdx[p], c, n, Math.round(paid)]; });
const mock = {
  generatedWith: `seed ${SEED}`,
  months: MONTHS,
  products: PRODUCTS.map((p) => ({ code: p.code, name: p.name, band: p.band, expectedLossRatio: p.lr })),
  reps,
  dealers: dealers.map(({ size, attachMult, lrMult, growth, story, ...d }) => d),
  facts, deals, causes,
  market: market.map(([s, p, m, u]) => [s, pIdx[p], m, u]),
};
writeFileSync("data/mock/dataset.json", JSON.stringify(mock));

// ---- Summary (sanity check for the planted stories) --------------------------------
const sum = (fn) => facts.reduce((s, f) => s + fn(f), 0);
const inLast = (m) => m >= 24, inPrior = (m) => m >= 12 && m < 24;
const reg = (f) => dealers[f[0]].region;
const seL = sum((f) => (reg(f) === "Southeast" && inLast(f[2]) ? f[3] : 0)), seP = sum((f) => (reg(f) === "Southeast" && inPrior(f[2]) ? f[3] : 0));
const gaLR = (sel) => { const prem = sum((f) => (dealers[f[0]].state === "GA" && f[1] === 1 && sel(f[2]) ? f[4] : 0)); const paid = sum((f) => (dealers[f[0]].state === "GA" && f[1] === 1 && sel(f[2]) ? f[7] : 0)); const n = sum((f) => (dealers[f[0]].state === "GA" && f[1] === 1 && sel(f[2]) ? f[6] : 0)); const c = sum((f) => (dealers[f[0]].state === "GA" && f[1] === 1 && sel(f[2]) ? f[3] : 0)); return { lr: (paid / prem).toFixed(3), freq: (n / c).toFixed(4), sev: Math.round(paid / n) }; };
console.log(`dealers ${dealers.length}, reps ${reps.length}, contracts ${contractN}, claims ${claimN}`);
console.log(`Southeast contracts YoY: ${(((seL - seP) / seP) * 100).toFixed(1)}%`);
console.log("GA GAP prior", gaLR(inPrior), "last", gaLR(inLast));
const gapStat = (stateSel, sel) => { const F = facts.filter((f) => f[1] === 1 && stateSel(dealers[f[0]].state) && sel(f[2])); const s = (i) => F.reduce((a, f) => a + f[i], 0); return { lr: (s(7) / s(4)).toFixed(3), freq: (s(6) / s(3)).toFixed(4), sev: Math.round(s(7) / s(6)) }; };
console.log("non-GA GAP prior", gapStat((s) => s !== "GA", inPrior), "last", gapStat((s) => s !== "GA", inLast));
const summit = dealers.map((d, i) => [d, i]).filter(([d]) => d.dealer_group === "Summit Auto Group").map(([, i]) => i);
const att = (sel) => { const F = facts.filter((f) => summit.includes(f[0]) && sel(f[2])); const fin = F.reduce((a, f) => a + f[5], 0); const dl = summit.reduce((a, i) => a + deals[i].filter((_, m) => sel(m)).reduce((x, y) => x + y, 0), 0); return (fin / dl).toFixed(3); };
console.log("Summit attach prior", att(inPrior), "last", att(inLast));
