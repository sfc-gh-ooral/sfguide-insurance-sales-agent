// Live-mode check of the agent and visit brief through the app's API (run with the dev server up).
const base = process.env.APP_URL ?? 'http://localhost:3210';
const post = async (op, body) => (await fetch(`${base}/api/${op}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, mode: 'live' }) })).json();

const questions = [
  ['director', 'Why is Southeast volume down this year?'],
  ['director', 'Which dealers have GAP loss ratio above 80%?'],
  ['director', "What's our VSC share in Texas vs last year?"],
  ['director', 'Is the Georgia GAP loss ratio increase driven by frequency or severity?'],
  ['director', 'Attach rate trend for Summit Auto Group'],
  ['rep', "What's our VSC share in Texas vs last year?"],
];
const only = process.argv[2];
for (const [persona, question] of questions) {
  if (only === 'brief') break;
  const t = Date.now();
  const j = await post('ask', { scope: { persona }, question });
  if (j.error) { console.log(`ERR ${question}: ${j.error}`); continue; }
  const a = j.data;
  console.log(`[${persona}] ${question}\n  mode=${j.mode} verified=${a.verifiedQuery} sql=${Boolean(a.sql)} chart=${a.chart ? `${a.chart.kind}/${a.chart.data.length}pts/${a.chart.yLabel}` : 'none'} ${((Date.now() - t) / 1000).toFixed(0)}s`);
  console.log(`  ${a.text.replace(/\n/g, ' ').slice(0, 420)}\n`);
}
for (const [persona, id] of [['director', 'D0004'], ['rep', 'D0045']]) {
  const j = await post('brief', { scope: { persona }, id });
  console.log(`[brief ${persona} ${id}] mode=${j.mode} ${j.error ?? `source=${j.data.source} model=${j.data.model}`}\n${j.data?.text ?? ''}\n`);
}
