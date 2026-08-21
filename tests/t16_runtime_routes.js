'use strict';
/* t16 — 运行期不变量：「非法路线不可能产生」。
 * 枚举居民全部可达状态（每条边 routePts 的每个采样点 + 全部节点 ±5 抖动 +
 * sitSpot/秋千 stand socket），对每个状态断言：存在至少一个节点使其
 * snap-to-node 直线段过 compile 级 validateRoute（即 routeTo 的多候选
 * snap 在任何可达状态下都无需传送兜底）；final 段样例合法；反例被拦截。 */
const H = require('./helpers.js');
H.loadCore(); H.loadMaps();

const c = H.compileXigu();
const nodeIds = Object.keys(c.nav.nodes);
let snapChecks = 0, finalChecks = 0;

/* 与 residents.routeTo 同款的多候选 snap：距离升序，首个合法段胜出 */
function anyLegalSnap(x, y, from) {
  const cands = nodeIds
    .map(id => ({ id: id, n: c.nav.nodes[id] }))
    .sort((p, q) => Math.hypot(p.n.x - x, p.n.y - y) - Math.hypot(q.n.x - x, q.n.y - y));
  for (const cand of cands) {
    if (Math.hypot(cand.n.x - x, cand.n.y - y) <= 6) return true;
    try {
      WC.validation.validateRoute(c, [[x, y], [cand.n.x, cand.n.y]], 'snap:' + from);
      return true;
    } catch (e) { /* 该候选非法，试下一个 */ }
  }
  return false;
}

for (const e of c.nav.edges) {
  for (let i = 0; i < e.routePts.length; i++) {
    const p = e.routePts[i];
    H.ok(anyLegalSnap(p[0], p[1], 'edge ' + e.id + '[' + i + ']'),
      'edge ' + e.id + '[' + i + '] (' + p[0] + ',' + p[1] + ') 应存在合法 snap 候选');
    snapChecks++;
  }
}
for (const id of nodeIds) {
  const n = c.nav.nodes[id];
  for (const [jx, jy] of [[5, 4], [-5, -4]]) {   // ≈ 居民 idle 游走范围
    const x = n.x + jx, y = n.y + jy;
    /* 抖动点自身必须可达（干岸 & walkable & 不在 obstacle 内）——
     * 例如 W(井畔) 向潭方向的抖动会落入池塘椭圆，那不是可达状态 */
    const s = c.surfaceAt(x, y);
    if (!s || !s.walkable || c.waterAt(x, y) || c.segHitsObstacle(x, y, x + 0.01, y)) continue;
    H.ok(anyLegalSnap(x, y, 'node ' + id + ' 抖动'),
      'node ' + id + ' 可达抖动点应存在合法 snap 候选');
    snapChecks++;
  }
}
const sit = c.zones.sitSpot, stand = c.socketOf('swing', 'stand');
H.ok(anyLegalSnap(sit.x, sit.y, 'sitSpot'), 'sitSpot 应存在合法 snap 候选');
H.ok(anyLegalSnap(stand.x, stand.y, 'swingStand'), 'swing stand 应存在合法 snap 候选');
snapChecks += 2;

/* final 段样例：桥西节点 → sitSpot；秋千台 → stand socket（= extraRoutes 同款） */
const C = c.nav.nodes.C, S = c.nav.nodes.S;
WC.validation.validateRoute(c, [[C.x, C.y], [sit.x, sit.y]], 'final:sitprep');
WC.validation.validateRoute(c, [[S.x, S.y], [stand.x, stand.y]], 'final:swingstart');
finalChecks += 2;

/* 反例：从潭心出发的任何 snap 段都必须被拦截（不变量确实在拦截，而非空转） */
let blocked = 0;
for (const id of nodeIds) {
  const n = c.nav.nodes[id];
  try { WC.validation.validateRoute(c, [[1450, 870], [n.x, n.y]], 'snap:潭心>' + id); }
  catch (e) { blocked++; }
}
H.ok(blocked === nodeIds.length, '潭心出发的全部 ' + nodeIds.length + ' 个 snap 候选都必须非法');

/* 源码级断言：residents.js 的两处直线段产生点都有 validatedSeg 守卫 */
const src = H.src('js/simulation/residents.js');
H.ok(/validatedSeg\(\[\[this\.x, this\.y\], \[cand\.n\.x, cand\.n\.y\]\]/.test(src),
  'routeTo snap 段必须经 validatedSeg（多候选）');
H.ok(/validatedSeg\(\[\[this\.x, this\.y\], \[f\.x, f\.y\]\]/.test(src),
  'beginFinal 段必须经 validatedSeg');
console.log('t16 runtime routes OK（' + snapChecks + ' 个可达状态全部存在合法 snap；final ' +
  finalChecks + ' 段合法；潭心反例 ' + blocked + ' 候选全拦截）');
