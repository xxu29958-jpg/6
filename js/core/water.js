(function (root) {
'use strict';
/* ============================================================
 * core/water.js — World Core：水体几何 authority
 * water = { id, kind, tags? }，kind ∈
 *   'ribbon'  : { ctrl:[[x,y]..], half:[每控制点半宽], per?, clickHalf? } —— 折线带
 *   'ellipse' : { x, y, rx, ry }
 *   'disc'    : { x, y, r }
 *   'rect'    : { x0, y0, x1, y1 }
 * Renderer 依此画水；任何像素掩码无权反控物理（仅可作 art-vs-world evidence）。
 * ============================================================ */
const W = {};

/* compile 期准备：ribbon 加密折线 + 测度 + 每密点半宽（控制点线性插值） */
W.prepare = function (def) {
  const w = Object.assign({}, def);
  if (def.kind === 'ribbon') {
    const per = def.per || 10;
    w.per = per;
    w.pts = WC.geometry.catmull(def.ctrl, per);
    w.measured = WC.geometry.polyMeasure(w.pts);
  }
  return w;
};

/* ribbon 第 i 个密点段处的半宽 */
W.ribbonHalf = function (w, i) {
  const segF = i / w.per;
  const i0 = Math.min(w.half.length - 2, Math.floor(segF));
  const f = segF - i0;
  return w.half[i0] * (1 - f) + w.half[i0 + 1] * f;
};

W.contains = function (w, x, y) {
  switch (w.kind) {
    case 'ribbon': {
      const pts = w.pts;
      for (let i = 0; i < pts.length - 1; i++) {
        if (WC.geometry.distPointSeg(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) < W.ribbonHalf(w, i)) return true;
      }
      return false;
    }
    case 'ellipse': return WC.geometry.ellipseNorm(x, y, w.x, w.y, w.rx, w.ry) < 1;
    case 'disc': return Math.hypot(x - w.x, y - w.y) < w.r;
    case 'rect': return x > w.x0 && x < w.x1 && y > w.y0 && y < w.y1;
  }
  return false;
};

W.at = function (waters, x, y) {
  for (const w of waters) if (W.contains(w, x, y)) return w;
  return null;
};

root.WC = root.WC || {};
WC.water = W;
if (typeof module !== 'undefined') module.exports = W;
})(typeof window !== 'undefined' ? window : globalThis);
