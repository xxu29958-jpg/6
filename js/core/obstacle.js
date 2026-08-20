(function (root) {
'use strict';
/* ============================================================
 * core/obstacle.js — World Core：障碍体
 * obstacle = { id, polygon, tags:[] }（如 building/root/fence/rock/cliff —
 * tag 只是地图声明的语义标签，core 不解释具体类别）。
 * 简单 polygon containment / segment intersection，不上刚体系统。
 * ============================================================ */
const O = {};

/* 线段是否击中任一障碍；命中返回障碍 id，否则 null */
O.segHits = function (obstacles, ax, ay, bx, by) {
  for (const o of obstacles) {
    if (WC.geometry.segHitsPoly(ax, ay, bx, by, o.polygon)) return o.id;
  }
  return null;
};

O.contains = function (obstacles, x, y) {
  for (const o of obstacles) {
    if (WC.geometry.pointInPoly(x, y, o.polygon)) return o.id;
  }
  return null;
};

root.WC = root.WC || {};
WC.obstacle = O;
if (typeof module !== 'undefined') module.exports = O;
})(typeof window !== 'undefined' ? window : globalThis);
