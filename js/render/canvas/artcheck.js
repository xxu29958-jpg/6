'use strict';
/* ============================================================
 * artcheck.js — art-vs-world evidence（V4.8 降级）
 * 旧 WORLD.isWater 像素掩码（terrain 查色）不再是物理 authority：
 * 水系几何以 maps 下各 map.js 的 waters 为准（compiled.waterAt）。
 * 这里只保留掩码构建 + 与 compiled 几何水的一致率报告（console.info），
 * 供美术回归对照；任何物理/行为逻辑不得消费本模块。
 * ============================================================ */

const ARTCHECK = { isWater: null, stats: null };

/* 视觉水掩码：1/4 分辨率查色，蓝绿占优 = 水（算法与 V4.7 完全一致） */
ARTCHECK.buildWaterMask = function (terrain) {
  const MW = 512, MH = 272;
  const c = document.createElement('canvas');
  c.width = MW; c.height = MH;
  const g = c.getContext('2d');
  g.drawImage(terrain, 0, 0, MW, MH);
  let id;
  try {
    id = g.getImageData(0, 0, MW, MH).data;
  } catch (e) {
    /* file:// 直开时 canvas 被跨域污染：evidence 不可用即跳过（不影响任何物理/渲染） */
    console.info('[artcheck] 像素掩码不可用（' + e.name + '），evidence 跳过');
    ARTCHECK.isWater = null;
    return;
  }
  const m = new Uint8Array(MW * MH);
  for (let i = 0; i < MW * MH; i++) {
    const r = id[i * 4], gg = id[i * 4 + 1], b = id[i * 4 + 2];
    if (b > r + 8 && gg > r + 2 && b > 75) m[i] = 1;
  }
  /* 邻域膨胀 1 格（贴岸抗锯齿边缘也算水，更保守） */
  const m2 = new Uint8Array(MW * MH);
  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) {
      if (!m[y * MW + x]) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < MW && ny >= 0 && ny < MH) m2[ny * MW + nx] = 1;
        }
      }
    }
  }
  const W = LAYERS.W, H = LAYERS.H;
  ARTCHECK.isWater = function (wx, wy) {
    const cx = clamp(Math.round(wx * MW / W), 0, MW - 1);
    const cy = clamp(Math.round(wy * MH / H), 0, MH - 1);
    return m2[cy * MW + cx] === 1;
  };
};

/* 与 compiled 几何水逐格对照（512×272 格网）：纯 evidence，永不参与物理 */
ARTCHECK.report = function (compiled) {
  if (!ARTCHECK.isWater) return null;
  let both = 0, pixOnly = 0, geoOnly = 0, dry = 0;
  for (let gy = 0; gy < 272; gy += 2) {
    for (let gx = 0; gx < 512; gx += 2) {
      const wx = gx * compiled.bounds.w / 512, wy = gy * compiled.bounds.h / 272;
      const pix = ARTCHECK.isWater(wx, wy), geo = compiled.waterAt(wx, wy);
      if (pix && geo) both++;
      else if (pix) pixOnly++;
      else if (geo) geoOnly++;
      else dry++;
    }
  }
  const wet = both + pixOnly + geoOnly;
  const agree = wet ? both / wet : 1;
  ARTCHECK.stats = { both, pixOnly, geoOnly, dry, agree };
  console.info('[artcheck] 像素水 vs 几何水一致率 ' + (agree * 100).toFixed(1) + '%' +
    '（both=' + both + ' pixOnly=' + pixOnly + ' geoOnly=' + geoOnly + '）— evidence only，不作物理依据');
  return ARTCHECK.stats;
};

/* Node 测试可加载 */
if (typeof module !== 'undefined') module.exports = ARTCHECK;
