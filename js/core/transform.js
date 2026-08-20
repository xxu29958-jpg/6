(function (root) {
'use strict';
/* ============================================================
 * core/transform.js — World Core：最小实体变换
 * transform = { x, y, scale=1, flip=false }（无旋转：当前地图不需要，
 * 需要时再加，不预制）。local → world 单向派生，world 坐标不许手填第二份。
 * ============================================================ */
const T = {};

T.scaleOf = function (t) { return t.scale == null ? 1 : t.scale; };

/* local → world（flip = 绕实体锚点竖线镜像 x） */
T.apply = function (t, lx, ly) {
  const s = T.scaleOf(t);
  return { x: t.x + (t.flip ? -lx : lx) * s, y: t.y + ly * s };
};

/* world → local（校验/调试回算用） */
T.invert = function (t, wx, wy) {
  const s = WC.transform.scaleOf(t);
  return { x: (t.flip ? -(wx - t.x) : (wx - t.x)) / s, y: (wy - t.y) / s };
};

root.WC = root.WC || {};
WC.transform = T;
if (typeof module !== 'undefined') module.exports = T;
})(typeof window !== 'undefined' ? window : globalThis);
