'use strict';
/* ============================================================
 * util.js — 数学 / 随机 / 颜色 / 曲线 工具
 * ============================================================ */

const TAU = Math.PI * 2;

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
/* 帧率无关的指数趋近系数 */
function damp(rate, dt) { return 1 - Math.exp(-rate * dt); }

/* 确定性随机（世界生成用同一种子，保证每次打开同一世界） */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20240521);
/* 运行期动画用的独立随机流（不影响世界生成序列） */
const arng = mulberry32(987654321);

function rand(a, b) {
  if (a === undefined) return rng();
  if (b === undefined) return rng() * a;
  return a + rng() * (b - a);
}
function arand(a, b) {
  if (a === undefined) return arng();
  if (b === undefined) return arng() * a;
  return a + arng() * (b - a);
}
function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }

/* ---------- 颜色 ---------- */
function hexRgb(h) {
  h = h.replace('#', '');
  return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
}
function mixc(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
function css(c, a) {
  if (a === undefined) return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
  return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
}

/* ---------- 平滑一维噪声（-1..1，动画相位用） ---------- */
function noise1(x) {
  return Math.sin(x) * 0.55 + Math.sin(x * 2.13 + 1.7) * 0.28 + Math.sin(x * 4.31 + 4.1) * 0.17;
}

/* ---------- Catmull-Rom 样条采样 ----------
 * pts: [[x,y],...]  per: 每段采样数
 * 返回 [[x,y],...]                                        */
function catmull(pts, per) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i];
    const p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let j = 0; j < per; j++) {
      const t = j / per, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
      ]);
    }
  }
  out.push([pts[pts.length - 1][0], pts[pts.length - 1][1]]);
  return out;
}

/* 折线累积长度表 + 切线（返回 {pts, cum, tan, len}） */
function polyMeasure(pts) {
  const n = pts.length;
  const cum = new Float64Array(n);
  const tan = new Float64Array(n * 2);
  let len = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
      len += Math.hypot(dx, dy);
    }
    cum[i] = len;
  }
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    tan[i * 2] = dx / l; tan[i * 2 + 1] = dy / l;
  }
  return { pts, cum, tan, len };
}

/* 沿测度折线取距起点 d 处的点与切线，写入 out {x,y,tx,ty}（无分配） */
function polyAt(m, d, out) {
  const pts = m.pts, cum = m.cum, tan = m.tan, n = pts.length;
  d = clamp(d, 0, m.len);
  let lo = 0, hi = n - 1;
  while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= d) lo = mid; else hi = mid; }
  const seg = cum[hi] - cum[lo] || 1;
  const t = (d - cum[lo]) / seg;
  out.x = lerp(pts[lo][0], pts[hi][0], t);
  out.y = lerp(pts[lo][1], pts[hi][1], t);
  out.tx = lerp(tan[lo * 2], tan[hi * 2], t);
  out.ty = lerp(tan[lo * 2 + 1], tan[hi * 2 + 1], t);
  return out;
}

/* 折线垂直偏移（d>0 向法线正方向） */
function offsetPoly(pts, d) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    out.push([pts[i][0] - dy * d, pts[i][1] + dx * d]);
  }
  return out;
}

function distPointSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  const x = ax + dx * t, y = ay + dy * t;
  return Math.hypot(px - x, py - y);
}

/* 点到折线最近距离 */
function distToPoly(px, py, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distPointSeg(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if (d < best) best = d;
  }
  return best;
}
