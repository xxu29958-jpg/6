(function (root) {
'use strict';
/* ============================================================
 * core/surface.js — World Core：地表片
 * surface = { id, polygon, walkable, elevation, cost=1, tags=[], occlusion? }
 * occlusion 为 renderer 消费的视觉元数据（如 Y-sort 基准），core 不解释。
 * 查询优先级：声明靠后的 surface 覆盖靠前的（局部片叠在基片上）。
 * ============================================================ */
const S = {};

S.at = function (surfaces, x, y) {
  for (let i = surfaces.length - 1; i >= 0; i--) {
    const s = surfaces[i];
    if (WC.geometry.pointInPoly(x, y, s.polygon)) return s;
  }
  return null;
};

S.byId = function (surfaces, id) {
  for (const s of surfaces) if (s.id === id) return s;
  return null;
};

root.WC = root.WC || {};
WC.surface = S;
if (typeof module !== 'undefined') module.exports = S;
})(typeof window !== 'undefined' ? window : globalThis);
