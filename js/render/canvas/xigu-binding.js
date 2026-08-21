(function (root) {
'use strict';
/* ============================================================
 * render/canvas/xigu-binding.js — 溪谷 Canvas Render Binding（render-only）
 * 这里的数据只决定「怎么画」，不决定「物理上在哪里」。
 * 物理 transform / socket / 水域几何 / 路网全部在 maps/xigu/map.js；
 * 本文件：PNG 键名 / 源图 bbox / pivot / 世界宽度(视觉缩放) / flip 绘制 /
 * sway/spin/shadow/bake / 灯笼点亮阈值 / 天空装饰 / 雾带光池 / 山脊蒙版 /
 * 烘焙外扩边距 / 水渲染裁剪参数。
 * PNG 改裁切 → 只修这里；禁止反向修改物理实体 transform。
 * ============================================================ */

const XB = {
  /* 源图紧致 alpha 包围盒（离线量得，按图键共享） */
  images: {
    mill:     { bbox: [310, 55, 1106, 864] },
    cottage1: { bbox: [247, 73, 1221, 937] },
    cottage2: { bbox: [271, 105, 1170, 913] },
    well:     { bbox: [218, 130, 787, 865] },
    fence:    { bbox: [216, 270, 1325, 856] },
    flowers:  { bbox: [149, 308, 925, 773] },
    tree:     { bbox: [85, 44, 1342, 975] },
    wheel:    { bbox: [176, 117, 881, 927] },
    bridge:   { bbox: [175, 230, 1292, 846] },
    bush1:    { bbox: [64, 120, 967, 959] },
    bush2:    { bbox: [0, 227, 1023, 832] },
    rocks:    { bbox: [184, 288, 852, 778] },
    grass:    { bbox: [276, 227, 840, 814] },
    lantern:  { bbox: [346, 50, 754, 963] }
  },

  /* 每实体渲染记录：img / 世界宽度 w（视觉缩放）/ bake / sway / spin / ph /
   * shadow / pivot（源图枢轴，默认 bbox 底部中心；树 = 树干根部 (646,975)）。
   * flip 的权威在 entity transform（物理镜像），绘制时自 compiled 读出。 */
  entities: {
    mill:     { img: 'mill',     w: 300, bake: true },
    cottage1: { img: 'cottage1', w: 250, bake: true },
    cottage2: { img: 'cottage2', w: 260, bake: true },
    well:     { img: 'well',     w: 75,  bake: true },
    fenceA:   { img: 'fence',    w: 140, bake: true, shadow: 0.6 },
    fenceB:   { img: 'fence',    w: 120, bake: true, shadow: 0.6 },
    flowersA: { img: 'flowers',  w: 90,  bake: true, shadow: 0.5 },
    flowersB: { img: 'flowers',  w: 95,  bake: true, shadow: 0.5 },
    tree:     { img: 'tree',     w: 540, sway: 1, pivot: [646, 975], shadow: 1.6 },
    wheel:    { img: 'wheel',    w: 95,  spin: true, shadow: 0.5 },
    bridge:   { img: 'bridge',   w: 340, shadow: 1.2 },
    bush1a:   { img: 'bush1',    w: 95,  sway: 0.5,  ph: 1.3 },
    bush1b:   { img: 'bush1',    w: 85,  sway: 0.5,  ph: 3.9 },
    bush2a:   { img: 'bush2',    w: 105, sway: 0.55, ph: 2.4 },
    bush2b:   { img: 'bush2',    w: 90,  sway: 0.55, ph: 5.1 },
    rocksA:   { img: 'rocks',    w: 85,  shadow: 0.8 },
    rocksB:   { img: 'rocks',    w: 90,  shadow: 0.8 },
    grassA:   { img: 'grass',    w: 70,  sway: 0.9,  ph: 0.7, shadow: 0.45 },
    grassB:   { img: 'grass',    w: 62,  sway: 0.9,  ph: 2.9, shadow: 0.45 },
    grassC:   { img: 'grass',    w: 70,  sway: 0.9,  ph: 4.6, shadow: 0.45 },
    grassD:   { img: 'grass',    w: 68,  sway: 0.9,  ph: 1.9, shadow: 0.45 },
    grassE:   { img: 'grass',    w: 72,  sway: 0.9,  ph: 3.4, shadow: 0.45 },
    lantern1: { img: 'lantern',  w: 54,  sway: 0.32, ph: 0.9, shadow: 0.5 },
    lantern2: { img: 'lantern',  w: 63,  sway: 0.32, ph: 4.3, shadow: 0.5 },
    bush2c:   { img: 'bush2',    w: 92,  sway: 0.55, ph: 1.8 },
    rocksC:   { img: 'rocks',    w: 82,  shadow: 0.8 },
    grassF:   { img: 'grass',    w: 62,  sway: 0.9,  ph: 5.6, shadow: 0.45 },
    grassG:   { img: 'grass',    w: 60,  sway: 0.9,  ph: 0.2, shadow: 0.45 },
    fenceC:   { img: 'fence',    w: 105, shadow: 0.6 },
    grassH:   { img: 'grass',    w: 64,  sway: 0.9,  ph: 3.1, shadow: 0.45 },
    rocksD:   { img: 'rocks',    w: 66,  shadow: 0.8 }
  },

  /* 灯笼黄昏逐个亮起阈值（灯头世界坐标 = 实体 head socket，物理侧已持） */
  lanternGlow: { lantern1: 0.18, lantern2: 0.32 },

  /* 灯笼灯头源图量测留档（map 侧 head socket local 的换算来源，再生时用）：
   * 灯中心 ≈ (680,310)，锚 = bbox 底心 (550,963) */
  lanternMeasure: { head: [680, 310], anchor: [550, 963] },

  /* 水渲染参数（物理水几何在 map def；±60 裁剪带 / 横向偏移系数仅为视觉） */
  waterRender: { streamClip: 60, streamOffK: 1.4, driftOffK: 1.2 },

  /* 天空 / 氛围装饰（render-only） */
  sky: {
    moon: { x: 1560, y: 90 },
    clouds: [{ x: 300, s: 1.15, v: 7.5 }, { x: 1250, s: 0.9, v: 5.2 }]
  },
  mistBands: [
    { x: 430, y: 560, w: 220, h: 44, ph: 0, always: true },       // 瀑布底常年轻雾
    { x: 1450, y: 870, w: 700, h: 80, ph: 2.1, always: false },   // 潭面（清晨）
    { x: 640, y: 790, w: 300, h: 44, ph: 4.2, always: false }     // 桥边溪面（清晨）
  ],
  lightPools: [
    { x: 880, y: 590, rx: 170, ry: 62 },
    { x: 1150, y: 560, rx: 150, ry: 56 },
    { x: 1560, y: 650, rx: 150, ry: 58 },
    { x: 620, y: 780, rx: 150, ry: 60 },
    { x: 1020, y: 800, rx: 160, ry: 60 },
    { x: 380, y: 560, rx: 120, ry: 50 }
  ],

  /* far 层山脊蒙版折线（Canvas Render Strategy：far 沿脊线切割，缝藏进山脊
   * 纹理；属当前 Canvas renderer 的视觉策略，不进 World Core） */
  ridgeCtrl: [
    [0, 160], [170, 158], [340, 170], [510, 208], [680, 188], [850, 208],
    [1020, 292], [1190, 300], [1360, 336], [1530, 340], [1700, 285],
    [1870, 273], [2048, 280]
  ],

  /* 烘焙底座外扩边距（拖动/pinch 不露白）：左右 MX、天空上 MT、底部桌面延展 MB */
  view: { MX: 170, MT: 90, MB: 240 }
};

/* 派生渲染数据（确定性；只是缓存，不是权威） */
XB.ridgePts = catmull(XB.ridgeCtrl, 6);
XB.ridgeMaxY = 0;
for (const p of XB.ridgePts) if (p[1] > XB.ridgeMaxY) XB.ridgeMaxY = p[1];

/* 水潭有机轮廓扰动（渲染 wobble；物理潭 = map def 椭圆本体） */
XB.pondOutline = [];
for (let i = 0; i < 44; i++) {
  const a = (i / 44) * TAU;
  const w = 1 + 0.07 * noise1(a * 1.8 + 1.3) + 0.04 * noise1(a * 4.1 + 5.1);
  XB.pondOutline.push([Math.cos(a) * w, Math.sin(a) * w]);
}

/* 星空（确定性随机序列的一部分：先于 fish 消费 rand，顺序与 V4.7 一致） */
XB.stars = [];
for (let i = 0; i < 110; i++) {
  XB.stars.push({ x: rand(0, 2048), y: rand(4, 168), r: rand(0.6, 1.5), ph: rand(TAU) });
}

/* ---------- Binding Acceptance Layer（V4.9） ----------
 * 装配线：Physical World → Render Binding → Binding Compiler → Accept/Reject
 *         → Compiled Render Scene。
 * XB.validate 是纯检查（throw = Reject）；XB.compile = validate + build。
 * 违例五类（全部 throw，不是 console.warn）：
 *  [bind-orphan]    绑定记录指向不存在的物理实体
 *  [bind-missing]   物理实体缺少绑定（程序化绘制实体须在 procedural 白名单）
 *  [bind-pivot]     pivot 超出 bbox 容差（外扩 10%）
 *  [bind-footprint] 房屋视觉宽度与物理 footprint 宽度比超出 [0.9, 1.6]
 *  [bind-deck]      桥精灵与 deck surface 水平错位（重叠 < 60% 桥面宽）
 * 另：实体有 footprintLocal 时校验视觉落点 |ay − footprint 底边| ≤ 40。 */
XB.procedural = ['swing'];               // 程序化绘制、无 PNG 的实体白名单

XB.validate = function (compiled) {
  /* A. orphan binding：绑定 → 实体 */
  for (const entId of Object.keys(XB.entities)) {
    if (!compiled.entities[entId]) {
      throw new Error('[bind-orphan] 绑定记录指向不存在的实体: ' + entId);
    }
  }
  /* B. missing binding：实体 → 绑定（procedural 白名单除外） */
  for (const entId of Object.keys(compiled.entities)) {
    if (!XB.entities[entId] && XB.procedural.indexOf(entId) < 0) {
      throw new Error('[bind-missing] 物理实体缺少渲染绑定: ' + entId +
        '（程序化绘制请加入 XB.procedural 白名单）');
    }
  }
  for (const entId of Object.keys(XB.entities)) {
    const b = XB.entities[entId];
    const ent = compiled.entities[entId];
    const bbox = XB.images[b.img].bbox;
    const bw = bbox[2] - bbox[0], bh = bbox[3] - bbox[1];
    /* C. pivot 合理性（容差 = bbox 外扩 10%；历史量测允许贴边） */
    if (b.pivot) {
      const mx = bw * 0.1, my = bh * 0.1;
      if (b.pivot[0] < bbox[0] - mx || b.pivot[0] > bbox[2] + mx ||
          b.pivot[1] < bbox[1] - my || b.pivot[1] > bbox[3] + my) {
        throw new Error('[bind-pivot] ' + entId + ' pivot (' + b.pivot +
          ') 超出 bbox [' + bbox + '] 外扩 10% 容差');
      }
    }
    /* D. 房屋：视觉宽度 ↔ 物理 footprint 宽度 */
    if (ent.tags.indexOf('house') >= 0 && ent.footprintWorld && ent.footprintWorld.length) {
      let fx0 = Infinity, fx1 = -Infinity, fy1 = -Infinity;
      for (const q of ent.footprintWorld) {
        if (q[0] < fx0) fx0 = q[0]; if (q[0] > fx1) fx1 = q[0];
        if (q[1] > fy1) fy1 = q[1];
      }
      const ratio = b.w / (fx1 - fx0);
      if (ratio < 0.9 || ratio > 1.6) {
        throw new Error('[bind-footprint] ' + entId + ' 视觉宽 ' + b.w +
          ' 与物理 footprint 宽 ' + (fx1 - fx0) + ' 比 ' + ratio.toFixed(2) + ' 超出 [0.9,1.6]');
      }
      /* F. 视觉落点（ay = transform.y）应落在物理 footprint 底边附近 */
      if (Math.abs(ent.transform.y - fy1) > 40) {
        throw new Error('[bind-footprint] ' + entId + ' 视觉落点 y=' + ent.transform.y +
          ' 偏离 footprint 底边 y=' + fy1 + ' 超过 40');
      }
    }
    /* E. 桥：精灵水平跨度必须压住 deck surface（≥60% 桥面宽） */
    if (ent.tags.indexOf('bridge') >= 0) {
      let deck = null;
      for (const s of compiled.surfaces) {
        if (s.entity === entId && s.tags.indexOf('deck') >= 0) { deck = s; break; }
      }
      if (!deck) throw new Error('[bind-deck] ' + entId + ' 缺少实体拥有的 deck surface');
      let dx0 = Infinity, dx1 = -Infinity;
      for (const q of deck.polygon) { if (q[0] < dx0) dx0 = q[0]; if (q[0] > dx1) dx1 = q[0]; }
      const sx0 = ent.transform.x - b.w / 2, sx1 = ent.transform.x + b.w / 2;
      const ov = Math.min(sx1, dx1) - Math.max(sx0, dx0);
      if (ov < (dx1 - dx0) * 0.6) {
        throw new Error('[bind-deck] ' + entId + ' 精灵 [' + sx0 + ',' + sx1 +
          '] 与 deck [' + dx0 + ',' + dx1 + '] 水平重叠 ' + Math.round(ov) + ' < 60% 桥面宽');
      }
    }
  }
  return true;
};

/* Binding Compiler：validate（Accept）→ build → Compiled Render Scene */
XB.compile = function (compiled) {
  XB.validate(compiled);
  XB.build(compiled);
  return { assets: XB.assets, dynAssets: XB.dynAssets, staticAssets: XB.staticAssets };
};

/* compiled world + 本 binding → 渲染资产表（旧 WORLD.assets 同构记录：
   ax/ay 来自实体 transform（物理），s/h/bw/bh 派生；改 binding 不动物理）
   注意：外部装配一律走 XB.compile（先 Acceptance）；XB.build 为内部步骤。 */
XB.build = function (compiled) {
  const assets = [];
  for (const entId of Object.keys(compiled.entities)) {
    const b = XB.entities[entId];
    if (!b) continue;                       // 无 PNG 的实体（如 swing）跳过
    const ent = compiled.entities[entId];
    const img = XB.images[b.img];
    const bbox = img.bbox;
    const bw = bbox[2] - bbox[0], bh = bbox[3] - bbox[1];
    const a = {
      entId: entId, img: b.img, bbox: bbox,
      ax: ent.transform.x, ay: ent.transform.y,
      w: b.w, s: b.w / bw, h: bh * (b.w / bw), bw: bw, bh: bh,
      bake: !!b.bake, sway: b.sway || 0, spin: !!b.spin, ph: b.ph || 0,
      shadow: b.shadow == null ? 1 : b.shadow,
      flip: !!ent.transform.flip,
      srcA: b.pivot || null
    };
    assets.push(a);
  }
  XB.assets = assets;
  XB.dynAssets = assets.filter(function (a) { return !a.bake; });
  XB.staticAssets = assets.filter(function (a) { return a.bake; })
    .sort(function (p, q) { return p.ay - q.ay; });
  return assets;
};

root.XB = XB;
if (typeof module !== 'undefined') module.exports = XB;
})(typeof window !== 'undefined' ? window : globalThis);
