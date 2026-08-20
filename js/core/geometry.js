(function (root) {
'use strict';
/* ============================================================
 * core/geometry.js — World Core：地图无关平面几何
 * 点/多边形/线段/椭圆/带状折线。不含任何具体地图内容。
 * 采样几何（catmull/polyMeasure/polyAt/distPointSeg/distToPoly）
 * 由 util.js（地图无关基础层）持有，这里仅再导出便于 core 内部引用。
 * ============================================================ */
const G = {};

/* 射线法点在多边形内 */
G.pointInPoly = function (x, y, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins;
  }
  return ins;
};

/* 椭圆归一化距离²（<1 内部，=1 边界）；调用方按需与 1 / 1.05 等阈值比较 */
G.ellipseNorm = function (x, y, cx, cy, rx, ry) {
  const dx = (x - cx) / rx, dy = (y - cy) / ry;
  return dx * dx + dy * dy;
};

/* 线段严格相交（共线/端点相触不算；含端点 containment 由 segHitsPoly 负责） */
function orient(ax, ay, bx, by, cx, cy) { return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); }
G.segIntersect = function (ax, ay, bx, by, cx, cy, dx, dy) {
  const o1 = orient(ax, ay, bx, by, cx, cy), o2 = orient(ax, ay, bx, by, dx, dy);
  const o3 = orient(cx, cy, dx, dy, ax, ay), o4 = orient(cx, cy, dx, dy, bx, by);
  return (o1 * o2 < 0) && (o3 * o4 < 0);
};

/* 线段是否与多边形相交（含端点落入） */
G.segHitsPoly = function (ax, ay, bx, by, poly) {
  if (G.pointInPoly(ax, ay, poly) || G.pointInPoly(bx, by, poly)) return true;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (G.segIntersect(ax, ay, bx, by, poly[j][0], poly[j][1], poly[i][0], poly[i][1])) return true;
  }
  return false;
};

/* 采样几何再导出（authority 在 util.js，单一算法单份实现） */
G.distPointSeg = distPointSeg;
G.distToPoly = distToPoly;
G.catmull = catmull;
G.polyMeasure = polyMeasure;
G.polyAt = polyAt;

root.WC = root.WC || {};
WC.geometry = G;
if (typeof module !== 'undefined') module.exports = G;
})(typeof window !== 'undefined' ? window : globalThis);
