'use strict';
/* t3 — route legal：溪谷全部 route（19 hint 边 + snap/final 样例段）过 validateRoute */
const H = require('./helpers.js');
H.loadCore(); H.loadMaps();

const c = H.compileXigu();   // compile 本身已内嵌全量校验（不过会 throw）
H.ok(c.nav.edges.length === 19, '应为 19 条 hint 边，实际 ' + c.nav.edges.length);

for (const e of c.nav.edges) {
  WC.validation.validateRoute(c, e.routePts, 'edge ' + e.id);
  /* 路线采样点不碰任何 obstacle（validateRoute 已含，这里显式复核一遍） */
  for (let i = 0; i < e.routePts.length - 1; i++) {
    const p = e.routePts[i], q = e.routePts[i + 1];
    H.ok(!c.segHitsObstacle(p[0], p[1], q[0], q[1]),
      e.id + ' 段 (' + p + ')-(' + q + ') 穿 obstacle');
  }
}
for (const r of c.nav.extraRoutes) WC.validation.validateRoute(c, r.pts, 'extra ' + r.id);
H.ok(c.nav.extraRoutes.length === 2, '应有 2 条附加校验段（坐姿上岸/秋千上下点）');

/* 全部节点 walkable 且干岸（或有合法跨水 portal） */
for (const id of Object.keys(c.nav.nodes)) {
  const n = c.nav.nodes[id];
  const s = c.surfaceAt(n.x, n.y);
  H.ok(s && s.walkable, '节点 ' + id + ' 必须在 walkable surface');
  H.ok(c.dryLand(n.x, n.y), '节点 ' + id + ' 必须是物理干岸');
}
console.log('t3 route legal OK (19 edges + 2 extra)');
