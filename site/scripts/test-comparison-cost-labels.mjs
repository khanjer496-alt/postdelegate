// Focused source/data checks; no Astro build or installed dependencies are needed.
// Run from the repository root with Node >=22.23.4.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

const read = (path) => fs.readFileSync(path, 'utf8');
const plain = (text) => stripTypeScriptTypes(text.replace(/^import .*;\n/gm, ''), { mode: 'strip' }).replace(/\bexport /g, '');
const plans = vm.runInNewContext(plain(read('site/src/data/plans.ts')) + ';({PLANS, TRIAL_DAYS})');
const networks = vm.runInNewContext(plain(read('site/src/data/networks.ts')) + ';({AVAILABLE_NETWORKS, NETWORKS, WAITING_NETWORKS, networkStatus})');
const TOOLS = Object.fromEntries(fs.readdirSync('site/src/data/tools').filter((f) => f.endsWith('.json')).map((f) => {
  const tool = JSON.parse(read(`site/src/data/tools/${f}`));
  return [tool.slug, tool];
}));
const api = vm.runInNewContext(plain(read('site/src/data/best-lists.ts')) + ';({BEST_LISTS, bestEntries, bestUnranked, bestLeftOut, bestFact, orderRule, bestMissingLabel: typeof bestMissingLabel === "undefined" ? undefined : bestMissingLabel})', {
  ...plans, ...networks, TOOLS,
  planFor: (n) => plans.PLANS.find((p) => p.channels >= n) ?? plans.PLANS.at(-1),
  SITE: { url: 'https://postdelegate.com' },
  ogCardFor: (path) => read('site/src/data/og-cards.mjs').includes(`'${path}'`),
});
const list = (slug) => api.BEST_LISTS.find((entry) => entry.slug === slug);
const blue = list('bluesky-schedulers');
assert.match(api.bestUnranked(blue).title, /No comparable total verified in this comparison/);
const costLabel = 'No comparable total verified in this comparison';
assert.equal(api.bestMissingLabel('cost.3'), costLabel);
assert.equal(api.bestMissingLabel('cost.30'), costLabel);
assert.equal(api.bestMissingLabel('license'), 'Not listed');
for (const slug of ['recurpost', 'post-planner', 'coschedule']) {
  assert(api.bestUnranked(blue).tools.some((tool) => tool.slug === slug));
  assert(!api.bestEntries(blue).some((tool) => tool.slug === slug));
  assert.equal(api.bestFact(TOOLS[slug], 'cost.3'), undefined);
}
assert(api.bestUnranked(list('mastodon-schedulers')).tools.some((tool) => tool.slug === 'coschedule'));
assert(api.bestEntries(blue).some((tool) => tool.slug === 'buffer'));
assert.equal(api.bestFact(TOOLS.buffer, 'cost.3').value, '$0 / $18');
assert(!api.bestUnranked(blue).tools.some((tool) => tool.slug === 'buffer'));
assert.match(api.orderRule(blue), /without a comparable total verified in this comparison/);
assert.doesNotMatch(api.orderRule(blue), /no published figure/);
const multiple = list('social-media-schedulers-for-multiple-accounts');
assert.match(multiple.rule, /normalized calculations remain pending/i);
assert.match(multiple.rule, /not an exhaustive assessment of published vendor pricing/);
assert.match(multiple.shortAnswer, /30-account scenarios verified here/);
assert.doesNotMatch(multiple.rule, /Every tool.*publishes enough/);
for (const slug of ['recurpost', 'post-planner', 'rella', 'coschedule']) {
  assert(api.bestLeftOut(multiple).some((tool) => tool.slug === slug));
  assert.equal(api.bestFact(TOOLS[slug], 'cost.30'), undefined);
  assert(multiple.rule.includes(TOOLS[slug].name));
}
const template = read('site/src/components/BestList.astro');
assert(template.includes('missingLabel={bestMissingLabel(f.key)}'));
assert(template.includes('missingLabel={bestMissingLabel(list.requires)}'));
assert(template.includes('list.requires.startsWith(\'cost.\')'));
assert.match(template, /These scenarios are outside the current price ranking/);
assert.match(template, /vendors may publish prices/);
assert.match(template, /Missing cost cells mean no comparable total was verified in this comparison/);
const cell = read('site/src/components/compare/FactCell.astro');
assert.match(cell, /class="fact-missing">\{missingLabel\}/);
const cellData = (props) => vm.runInNewContext(plain(cell.split('---')[1]) + ';({fact, missingLabel})', { Astro: { props }, sources: () => [] });
assert.equal(cellData({ vendor: 'RecurPost', missingLabel: costLabel }).missingLabel, costLabel);
assert.equal(cellData({ vendor: 'Unknown' }).missingLabel, 'Not listed');
assert.equal(cellData({ vendor: 'Buffer', fact: TOOLS.buffer.cost['3'], missingLabel: costLabel }).fact.value, '$0 / $18');
assert.match(TOOLS.coschedule.networks.note, /conflict/);
assert.match(TOOLS.rella.entryPaid.note, /October 2026/);
const planable = read('site/src/pages/compare/planable.astro');
assert.equal((planable.match(/every plan, including the free trial/g) ?? []).length, 2);
console.log('PASS: missing normalized costs stay unranked and use comparison-unknown labels; audited scope/pending scenarios agree; known Buffer price, X/Rella caveats and Planable trial wording preserved.');
