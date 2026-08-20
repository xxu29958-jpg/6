(function (root) {
'use strict';
/* ============================================================
 * core/portal.js — World Core：空间连接门
 * portal = { id, at:{x,y} | socket:[entityId,socketName], r?,
 *            connects:[surfaceIdA,surfaceIdB], elevations:[eA,eB],
 *            crossesWater:bool, tags:[] }
 * 桥面端 / 坡道 / 浅滩 / 房门都是 portal 实例，core 无桥特例类型。
 * socket 形式由 compile 解析为 at（跟随实体 transform，不存第二份绝对坐标）。
 * ============================================================ */
const P = {};

P.R_DEFAULT = 40;

/* 跨水豁免：点是否在任一 crossesWater portal 半径内；命中返回 portal */
P.nearCross = function (portals, x, y) {
  for (const p of portals) {
    if (!p.crossesWater) continue;
    const r = p.r || P.R_DEFAULT;
    if (Math.hypot(x - p.at.x, y - p.at.y) <= r) return p;
  }
  return null;
};

/* elevation 跳变合法性：(x,y) 附近存在连接 eA↔eB 的 portal */
P.elevBetween = function (portals, x, y, eA, eB) {
  for (const p of portals) {
    const r = p.r || P.R_DEFAULT;
    if (Math.hypot(x - p.at.x, y - p.at.y) > r) continue;
    const e = p.elevations;
    if (!e) continue;
    if ((e[0] === eA && e[1] === eB) || (e[0] === eB && e[1] === eA)) return p;
  }
  return null;
};

root.WC = root.WC || {};
WC.portal = P;
if (typeof module !== 'undefined') module.exports = P;
})(typeof window !== 'undefined' ? window : globalThis);
