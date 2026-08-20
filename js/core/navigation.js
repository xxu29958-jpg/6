(function (root) {
'use strict';
/* ============================================================
 * core/navigation.js — World Core：weighted graph + Dijkstra
 * 节点/边/途经点是地图声明的 Navigation Hints（非物理 authority），
 * compile 期统一过 validation。cost = 路线几何长 × 边声明的 costMul。
 * Dijkstra 手写数组实现（节点数十个），同 cost 按节点 id 字典序决胜，
 * 结果与边声明顺序无关。废除「边数组顺序 = 优先级」语义。
 * ============================================================ */
const NAV = {};

/* navDef = { nodes:{id:{x,y,face?}}, edges:[{a,b,via?,costMul?}] }
 * → { nodes, edges:[{id,a,b,cost,len,routePts}], routeOf, adj(字典序), edgeMap } */
NAV.build = function (navDef) {
  const nodes = navDef.nodes;
  const edges = [], routeOf = {}, adj = {}, edgeMap = {};
  for (const e of navDef.edges) {
    const A = nodes[e.a], B = nodes[e.b];
    if (!A || !B) throw new Error('[nav] edge ' + e.a + '>' + e.b + ' 引用不存在的节点');
    const via = e.via || [];
    const pts = catmull([[A.x, A.y]].concat(via, [[B.x, B.y]]), 7);
    const len = polyMeasure(pts).len;
    const cost = len * (e.costMul == null ? 1 : e.costMul);
    const id = e.a + '>' + e.b;
    edges.push({ id: id, a: e.a, b: e.b, cost: cost, len: len, routePts: pts });
    routeOf[id] = pts;
    (adj[e.a] = adj[e.a] || []).push(e.b);
    (adj[e.b] = adj[e.b] || []).push(e.a);
    edgeMap[e.a + '>' + e.b] = edges[edges.length - 1];
    edgeMap[e.b + '>' + e.a] = edges[edges.length - 1];
  }
  for (const k of Object.keys(adj)) adj[k].sort();      // 字典序 → 与声明顺序无关
  return { nodes: nodes, edges: edges, routeOf: routeOf, adj: adj, edgeMap: edgeMap };
};

/* Dijkstra：每轮取未定居节点中 (dist, id) 最小者；严格更小才更新 prev。
 * 定居顺序与决胜规则完全确定 → 路径与 cost 不依赖边声明顺序。 */
NAV.dijkstra = function (nav, from, to) {
  if (from === to) return { path: [from], cost: 0 };
  const ids = Object.keys(nav.nodes);
  const dist = {}, prev = {}, done = {};
  dist[from] = 0;
  for (;;) {
    let u = null, bd = Infinity;
    for (const id of ids) {
      if (done[id] || dist[id] == null) continue;
      if (dist[id] < bd || (dist[id] === bd && (u === null || id < u))) { bd = dist[id]; u = id; }
    }
    if (u === null || u === to) break;
    done[u] = true;
    for (const v of nav.adj[u] || []) {
      const e = nav.edgeMap[u + '>' + v];
      const nd = bd + e.cost;
      if (dist[v] == null || nd < dist[v] - 1e-9) { dist[v] = nd; prev[v] = u; }
    }
  }
  if (dist[to] == null || !done[to]) {
    /* to 可能因提前 break 未标记 done；dist 有值即可达 */
    if (dist[to] == null) return null;
  }
  const path = [to];
  let cur = to;
  while (cur !== from) { cur = prev[cur]; if (cur == null) return null; path.unshift(cur); }
  return { path: path, cost: dist[to] };
};

/* 欧氏最近节点（线性扫，节点数少）。仅作路网接入工具；
 * snap 直线段的合法性由 validation 负责，不由本函数保证。 */
NAV.nearestNode = function (nav, x, y) {
  let best = null, bd = Infinity;
  for (const k of Object.keys(nav.nodes)) {
    const n = nav.nodes[k];
    const d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y);
    if (d < bd) { bd = d; best = k; }
  }
  return best;
};

root.WC = root.WC || {};
WC.navigation = NAV;
if (typeof module !== 'undefined') module.exports = NAV;
})(typeof window !== 'undefined' ? window : globalThis);
