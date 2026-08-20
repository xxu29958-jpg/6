'use strict';
/* t5 — edge order 无关：shuffle 边声明 ×20 种子，全部节点对 Dijkstra 路径+cost 不变 */
const H = require('./helpers.js');
H.loadCore(); H.loadMaps();

function seededShuffle(arr, seed) {
  const rnd = mulberry32(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function allPairs(nav) {
  const ids = Object.keys(nav.nodes);
  const out = {};
  for (const a of ids) for (const b of ids) {
    if (a === b) continue;
    const r = WC.navigation.dijkstra(nav, a, b);
    out[a + '>' + b] = r.path.join(',') + '@' + r.cost.toFixed(6);
  }
  return out;
}

const base = H.compileXigu();
const ref = allPairs(base.nav);
const nPairs = Object.keys(ref).length;

for (let seed = 1; seed <= 20; seed++) {
  const def = H.clone(MAP_XIGU);
  def.nav.edges = seededShuffle(def.nav.edges, seed * 7919);
  const c = WC.compile(def);
  const cur = allPairs(c.nav);
  for (const k of Object.keys(ref)) {
    H.ok(cur[k] === ref[k], 'seed ' + seed + ' 节点对 ' + k + ' 路径/cost 漂移: ' + cur[k] + ' vs ' + ref[k]);
  }
  /* adjacency 内容（字典序）亦与声明顺序无关 */
  H.ok(H.stableStringify(c.nav.adj) === H.stableStringify(base.nav.adj), 'seed ' + seed + ' adj 漂移');
}
console.log('t5 edge order OK (' + nPairs + ' 节点对 × 20 种子)');
