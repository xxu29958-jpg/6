'use strict';
/* ============================================================
 * daynight.js — 昼夜循环（约 150s 连续插值）
 * 清晨白 → 正午 → 午后暖 → 金色黄昏 → 蓝调 → 夜晚(占比最长) → 黎明前
 * 调色针对手绘清透底座重标定：白昼零染色；黄昏暖金 multiply(α~0.22)
 * + directional 暖渐变；蓝调冷靛；夜晚深靛 multiply(α~0.5，不死黑)。
 * 输出 cur：mul/mulA（multiply 暗化）、tint/tintA（色温 overlay）、
 * night、fog、dusk、starA、watH（水面高光色）、skyB（烟/雾调和色）
 * ============================================================ */

const DAY = {
  T: 150,
  time: 46,          // 初始 = 午后偏暖，第一印象柔和
  ffwdTo: -1,        // 快进目标时刻（-1 无）
  keys: [],
  cur: null
};

(function buildKeys() {
  /* 字段: t 时刻比例; mul/mulA multiply 暗化; tint/tintA 色温 overlay;
   * sun 黄昏夕阳辉光; night 夜晚度; fog 雾; watH 水面高光色;
   * skyB 烟/雾/薄雾的调和色（随时段变化） */
  const K = [
    { t: 0.000, mul: '#ffffff', mulA: 0.00, tint: '#fff2dc', tintA: 0.02, sun: 0.05, night: 0.00, fog: 0.20, watH: '#e8efe6', skyB: '#ece5d2' },
    { t: 0.130, mul: '#ffffff', mulA: 0.00, tint: '#ffffff', tintA: 0.00, sun: 0.02, night: 0.00, fog: 0.04, watH: '#e6ede6', skyB: '#e4e9d9' },
    { t: 0.320, mul: '#f6e8ca', mulA: 0.04, tint: '#ffd9a0', tintA: 0.04, sun: 0.10, night: 0.00, fog: 0.06, watH: '#efe6cc', skyB: '#eedfbd' },
    { t: 0.475, mul: '#c98a52', mulA: 0.22, tint: '#ff9a50', tintA: 0.13, sun: 0.85, night: 0.04, fog: 0.08, watH: '#ffd9a0', skyB: '#f4ac68' },
    { t: 0.600, mul: '#4a5a8c', mulA: 0.34, tint: '#4a5a86', tintA: 0.07, sun: 0.00, night: 0.45, fog: 0.14, watH: '#9aa8c0', skyB: '#96756c' },
    { t: 0.720, mul: '#202a5c', mulA: 0.50, tint: '#2c3866', tintA: 0.06, sun: 0.00, night: 1.00, fog: 0.10, watH: '#5a6a86', skyB: '#1d2438' },
    { t: 0.880, mul: '#1b234e', mulA: 0.52, tint: '#283460', tintA: 0.06, sun: 0.00, night: 1.00, fog: 0.08, watH: '#46566e', skyB: '#1a2132' },
    { t: 0.965, mul: '#3a4266', mulA: 0.32, tint: '#4a5468', tintA: 0.06, sun: 0.02, night: 0.45, fog: 0.20, watH: '#8a96ac', skyB: '#8a6a66' }
  ];
  DAY.keys = K;
  for (const k of K) {
    k._mul = hexRgb(k.mul); k._tint = hexRgb(k.tint);
    k._watH = hexRgb(k.watH); k._skyB = hexRgb(k.skyB);
  }
})();

DAY._cur = {
  mul: [0, 0, 0], mulA: 0, tint: [0, 0, 0], tintA: 0,
  sun: 0, night: 0, fog: 0,
  watH: [0, 0, 0], skyB: [0, 0, 0],
  starA: 0, dusk: 0, day: 0, segName: ''
};

/* 跳到下一时段 */
DAY.skip = function () {
  const tf = DAY.time / DAY.T;
  for (const k of DAY.keys) {
    if (k.t > tf + 0.015) { DAY.ffwdTo = k.t * DAY.T; return; }
  }
  DAY.ffwdTo = DAY.T + DAY.keys[0].t * DAY.T;  // 跨圈到清晨
};

DAY.update = function (dt) {
  if (DAY.ffwdTo >= 0) {
    DAY.time += dt * 7.5;
    if (DAY.time >= DAY.ffwdTo) {
      DAY.time = DAY.ffwdTo % DAY.T; DAY.ffwdTo = -1;
    } else if (DAY.time >= DAY.T) {
      DAY.time -= DAY.T; DAY.ffwdTo -= DAY.T;   // 跨圈快进
    }
  } else {
    DAY.time += dt;
    if (DAY.time >= DAY.T) DAY.time -= DAY.T;
  }

  const tf = DAY.time / DAY.T;
  const K = DAY.keys;
  let i = K.length - 1;
  for (let j = 0; j < K.length; j++) {
    const a = K[j], b = K[(j + 1) % K.length];
    const ta = a.t, tb = (j === K.length - 1) ? 1.0 : b.t;
    if (tf >= ta && tf < tb) { i = j; break; }
  }
  const a = K[i], b = K[(i + 1) % K.length];
  const ta = a.t, tb = (i === K.length - 1) ? 1.0 : b.t;
  let lt = (tf - ta) / (tb - ta);
  lt = lt * lt * (3 - 2 * lt);   // 段内平滑

  const c = DAY._cur;
  c.mul = mixc(a._mul, b._mul, lt); c.mulA = lerp(a.mulA, b.mulA, lt);
  c.tint = mixc(a._tint, b._tint, lt); c.tintA = lerp(a.tintA, b.tintA, lt);
  c.sun = lerp(a.sun, b.sun, lt);
  c.night = lerp(a.night, b.night, lt);
  c.fog = lerp(a.fog, b.fog, lt);
  c.watH = mixc(a._watH, b._watH, lt);
  c.skyB = mixc(a._skyB, b._skyB, lt);

  /* 派生：黄昏度（夕阳辉光最强在 dusk 段） */
  c.dusk = smoothstep(0.40, 0.47, tf) * (1 - smoothstep(0.55, 0.62, tf));
  /* 白昼度：供屏幕空间明暗结构/青空微染门控（白昼=1，黄昏/夜→0） */
  c.day = clamp(1 - c.night * 1.6 - c.dusk * 1.2, 0, 1);
  /* 星空可见度 */
  c.starA = smoothstep(0.55, 0.75, c.night);
  c.segName = ['morning', 'noon', 'afternoon', 'dusk', 'bluehour', 'night', 'deepnight', 'predawn'][i];
  DAY.cur = c;
};
