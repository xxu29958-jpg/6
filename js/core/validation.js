(function (root) {
'use strict';
/* ============================================================
 * core/validation.js — World Core：compile 期路线/世界校验
 * 「走错以后发现」→「非法路线根本无法成为合法 route」：
 * 任何验证失败直接 throw（不是 console.warn）。
 * 规则：
 *  ① 每个采样点落在 walkable surface
 *  ② 不入 water——跨水只能经 crossesWater portal 半径内或 deck-tagged surface
 *  ③ segment 不穿 obstacle polygon（精确线段-多边形相交）
 *  ④ elevation 跳变仅发生在连接该两级的 portal 半径内
 * ============================================================ */
const VAL = {};

/* pts: [[x,y],...]；label 用于错误定位（route/edge id） */
VAL.validateRoute = function (compiled, pts, label) {
  let prevE = null, prevX = 0, prevY = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0], ay = pts[i][1], bx = pts[i + 1][0], by = pts[i + 1][1];
    const hit = compiled.segHitsObstacle(ax, ay, bx, by);
    if (hit) throw new Error('[validate] ' + label + ' 段穿过 obstacle "' + hit + '" @(' + Math.round(ax) + ',' + Math.round(ay) + ')-(' + Math.round(bx) + ',' + Math.round(by) + ')');
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 4));
    for (let k = 0; k <= n; k++) {
      const x = ax + (bx - ax) * k / n, y = ay + (by - ay) * k / n;
      const s = compiled.surfaceAt(x, y);
      if (!s || !s.walkable) {
        throw new Error('[validate] ' + label + ' 点 (' + x.toFixed(1) + ',' + y.toFixed(1) + ') 不在 walkable surface');
      }
      if (compiled.waterAt(x, y)) {
        const onDeck = s.tags && s.tags.indexOf('deck') >= 0;
        const cross = WC.portal.nearCross(compiled.portals, x, y);
        if (!onDeck && !cross) {
          throw new Error('[validate] ' + label + ' 点 (' + x.toFixed(1) + ',' + y.toFixed(1) + ') 入水且无 crossesWater portal/deck');
        }
      }
      if (prevE !== null && s.elevation !== prevE) {
        const mx = (x + prevX) / 2, my = (y + prevY) / 2;
        const p = WC.portal.elevBetween(compiled.portals, mx, my, prevE, s.elevation);
        if (!p) {
          throw new Error('[validate] ' + label + ' elevation ' + prevE + '→' + s.elevation +
            ' @(' + mx.toFixed(1) + ',' + my.toFixed(1) + ') 无对应 portal');
        }
      }
      prevE = s.elevation; prevX = x; prevY = y;
    }
  }
  return true;
};

/* 整图校验：节点 → 每条 hint 边 → 附加段 → portal 落点 */
VAL.validateWorld = function (compiled) {
  for (const id of Object.keys(compiled.nav.nodes)) {
    const n = compiled.nav.nodes[id];
    const s = compiled.surfaceAt(n.x, n.y);
    if (!s || !s.walkable) throw new Error('[validate] nav 节点 "' + id + '" (' + n.x + ',' + n.y + ') 不在 walkable surface');
    if (compiled.waterAt(n.x, n.y)) {
      const onDeck = s.tags && s.tags.indexOf('deck') >= 0;
      if (!onDeck && !WC.portal.nearCross(compiled.portals, n.x, n.y)) {
        throw new Error('[validate] nav 节点 "' + id + '" (' + n.x + ',' + n.y + ') 入水');
      }
    }
  }
  for (const e of compiled.nav.edges) VAL.validateRoute(compiled, e.routePts, 'edge ' + e.id);
  for (const r of compiled.nav.extraRoutes || []) VAL.validateRoute(compiled, r.pts, 'extra ' + r.id);
  for (const p of compiled.portals) {
    const s = compiled.surfaceAt(p.at.x, p.at.y);
    if (!s || !s.walkable) throw new Error('[validate] portal "' + p.id + '" (' + p.at.x + ',' + p.at.y + ') 不在 walkable surface');
  }
  return true;
};

root.WC = root.WC || {};
WC.validation = VAL;
if (typeof module !== 'undefined') module.exports = VAL;
})(typeof window !== 'undefined' ? window : globalThis);
