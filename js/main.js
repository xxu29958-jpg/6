'use strict';
/* ============================================================
 * main.js — 初始化 / 图片预加载 / 主循环 / 分层合成（V4 资产合成）
 * L0 地形盘+静态资产(烘焙, 含外扩边距) → 水光/瀑布 →
 * Y-sort 场景(动态资产+居民) → 烟/雾/微粒/鸟/落叶
 * → 云影 → 黄昏光池 → L3 昼夜色调(multiply/overlay 克制)
 * → 前景遮挡 → 辉光('lighter') → vignette
 * ============================================================ */

const ASSETS = {
  terrain: null, tree: null, mill: null, wheel: null,
  cottage1: null, cottage2: null, bridge: null,
  bush1: null, bush2: null, rocks: null, grass: null,
  flowers: null, well: null, fence: null, lantern: null
};

let canvas, ctx, cam;
let COMPILED = null;      // compiled world（V4.8 物理权威 = maps/xigu/map.js 编译产物）
let vw = 0, vh = 0, dpr = 1;
let paused = false, lastTs = 0;
let resizeTimer = 0;

const MOBILE = (function () {
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  return coarse && Math.min(window.innerWidth, window.innerHeight) < 640;
})();

function resize() {
  vw = window.innerWidth; vh = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, MOBILE ? 1.75 : 2);
  canvas.width = Math.round(vw * dpr);
  canvas.height = Math.round(vh * dpr);
  cam.setViewport(vw, vh);
  /* 屏幕空间预渲染层（前景遮挡 / vignette）去抖重建 */
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => bakeScreenLayers(vw, vh), 160);
}

/* 图片预加载完成后才启动循环 */
function preload(sources, done) {
  const keys = Object.keys(sources);
  let left = keys.length;
  for (const k of keys) {
    const img = new Image();
    img.onload = () => { ASSETS[k] = img; if (--left === 0) done(); };
    img.onerror = () => { console.error('asset failed: ' + sources[k]); if (--left === 0) done(); };
    img.src = sources[k];
  }
}

function init() {
  canvas = document.getElementById('world');
  ctx = canvas.getContext('2d', { alpha: false });

  /* V4.9 装配线：Physical World → Render Binding → Binding Compiler
   * → Accept/Reject → Compiled Render Scene（任何一级 throw 即拒绝启动） */
  COMPILED = WC.compile(MAP_XIGU);    // 唯一物理权威；非法地图直接 throw
  XB.compile(COMPILED);               // Binding Acceptance + 装配（物理 ← compiled）
  LAYERS.setWorld(COMPILED.bounds);   // renderer 画幅 = compiled bounds

  cam = new Camera();

  bakeAll(ASSETS.terrain);
  ARTCHECK.buildWaterMask(ASSETS.terrain);   // 像素水掩码 = evidence（不作物理）
  ARTCHECK.report(COMPILED);
  initDynamic(MOBILE);
  initResidents(MOBILE);

  resize();
  bakeScreenLayers(vw, vh);
  /* 相机直接落在预设上（首开不飘） */
  cam.fx = cam.baseFx; cam.fy = cam.baseFy; cam.zoom = cam.baseZoom;

  initInteraction(canvas, cam);

  /* 加载帷幕：主循环启动后首帧即淡出 */
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const v = document.getElementById('veil');
    if (v) { v.classList.add('hide'); setTimeout(() => v.remove(), 1400); }
  }));
  /* 调试：#t=0.47 直接定位到昼夜周期某时刻 */
  const mt = /t=([\d.]+)/.exec(location.hash || '');
  if (mt) DAY.time = (parseFloat(mt[1]) % 1) * DAY.T;
  DAY.update(0);

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    paused = document.hidden;
    lastTs = performance.now();
  });

  lastTs = performance.now();
  requestAnimationFrame(tick);

  /* 验证钩子（只读聚合，不改任何逻辑）：Playwright 探针读 cam.zoom/fx/fy 与 compiled */
  window.__DBG = { cam, get compiled() { return COMPILED; }, WORLD_VERSION: '4.9' };
}

function tick(ts) {
  requestAnimationFrame(tick);
  if (paused) return;
  let dt = (ts - lastTs) / 1000;
  lastTs = ts;
  if (dt <= 0) return;
  dt = Math.min(dt, 0.05);

  DAY.update(dt);
  cam.update(dt);
  updateDynamic(dt);
  updateResidents(dt);
  SOUND.update(dt);
  render();
}

function render() {
  const g = ctx, c = DAY.cur;
  const parX = cam.parX, parY = cam.parY;

  /* 清屏底色 = 暗桌面色（底座边距之外绝不露白） */
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#1a1310';
  g.fillRect(0, 0, vw, vh);

  /* ---- L0 插画底座（世界空间；画布原点在 (-MX,-MT)） ---- */
  cam.apply(g, dpr, parX * -4, parY * -2);
  g.drawImage(LAYERS.ground, -LAYERS.MX, -LAYERS.MT, LAYERS.GW, LAYERS.GH);

  /* ---- L0.5 远山/天空独立视差层（慢层，V4.7 位移降至 ground 的 25%） ---- */
  if (LAYERS.far) {
    cam.apply(g, dpr, parX * -1.0, parY * -0.5);
    g.drawImage(LAYERS.far, -LAYERS.MX, -LAYERS.MT, LAYERS.far.width, LAYERS.far.height);
  }

  /* ---- L2 动态（世界空间） ---- */
  cam.apply(g, dpr, 0, 0);
  drawWater(g);
  drawFalls(g);
  drawFish(g);
  drawRipples(g);
  drawDriftLeaves(g);
  drawScene(g);          /* Y-sort：动态资产 + 居民同一序列 */
  drawPeeks(g);
  drawSmoke(g);
  drawMist(g);
  drawMotes(g);
  drawBirds(g);
  drawLeaves(g);

  /* ---- 云影（移动端关闭） ---- */
  if (!MOBILE) drawCloudShadows(g);

  /* ---- 黄昏暖色光池（世界空间，additive） ---- */
  drawLightPools(g);

  /* ---- L3 昼夜色调（屏幕空间，克制） ---- */
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (c.mulA > 0.005) {
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = css(c.mul, c.mulA);
    g.fillRect(0, 0, vw, vh);
  }
  if (c.tintA > 0.005) {
    g.globalCompositeOperation = 'overlay';
    g.fillStyle = css(c.tint, c.tintA);
    g.fillRect(0, 0, vw, vh);
  }
  g.globalCompositeOperation = 'source-over';
  /* 黄昏方向性：左上暖金光 → 右下渐暗（避免均匀发黄） */
  if (c.dusk > 0.02) {
    const d = c.dusk;
    let dg = g.createLinearGradient(0, 0, vw * 0.85, vh * 0.95);
    dg.addColorStop(0, 'rgba(255,182,112,' + (0.16 * d) + ')');
    dg.addColorStop(0.45, 'rgba(255,182,112,0)');
    g.fillStyle = dg; g.fillRect(0, 0, vw, vh);
    dg = g.createLinearGradient(vw, vh, vw * 0.3, vh * 0.25);
    dg.addColorStop(0, 'rgba(40,32,58,' + (0.15 * d) + ')');
    dg.addColorStop(0.55, 'rgba(40,32,58,0)');
    g.fillStyle = dg; g.fillRect(0, 0, vw, vh);
  }

  /* ---- 白昼明暗结构（克制）：主光左上来 → 底部/右下微暗（multiply α≤0.12）
   *      + 高光区泛极淡青空色（overlay α≤0.06，空气感）；vignette 略收紧见下 ---- */
  if (c.day > 0.02) {
    const dk = c.day;
    g.globalCompositeOperation = 'multiply';
    const mg = g.createLinearGradient(vw * 0.1, vh * 0.15, vw * 0.95, vh);
    mg.addColorStop(0, 'rgba(150,146,150,0)');
    mg.addColorStop(0.55, 'rgba(150,146,150,' + (0.04 * dk) + ')');
    mg.addColorStop(1, 'rgba(150,146,150,' + (0.12 * dk) + ')');
    g.fillStyle = mg; g.fillRect(0, 0, vw, vh);
    g.globalCompositeOperation = 'overlay';
    const sg = g.createLinearGradient(0, 0, 0, vh * 0.8);
    sg.addColorStop(0, 'rgba(166,206,240,' + (0.06 * dk) + ')');
    sg.addColorStop(1, 'rgba(166,206,240,' + (0.025 * dk) + ')');
    g.fillStyle = sg; g.fillRect(0, 0, vw, vh);
    g.globalCompositeOperation = 'source-over';
  }

  /* ---- 前景遮挡（底部虚化草叶，平板/桌面） ---- */
  if (cam.fgOn > 0.02 && LAYERS.fg) {
    g.globalAlpha = cam.fgOn;
    g.drawImage(LAYERS.fg, parX * 14 - 16, parY * 6 - 8, vw + 32, vh + 16);
    g.globalAlpha = 1;
  }

  /* ---- 辉光（'lighter'，不被暗化；黄昏暖窗也走这里） ---- */
  if (c.night > 0.12 || c.dusk > 0.12) {
    cam.apply(g, dpr, 0, 0);
    g.globalCompositeOperation = 'lighter';
    drawGlows(g);
    g.globalCompositeOperation = 'source-over';
  }

  /* ---- vignette ---- */
  if (LAYERS.vig) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalAlpha = clamp(cam.vig * (1 + c.night * 0.4 + c.day * 0.45), 0, 0.5);
    g.drawImage(LAYERS.vig, 0, 0);
    g.globalAlpha = 1;
  }
}

/* 启动：预加载地形盘 + 全部透明资产后再进入主循环 */
preload({
  terrain: 'assets/terrain.png', tree: 'assets/tree.png',
  mill: 'assets/mill.png', wheel: 'assets/wheel.png',
  cottage1: 'assets/cottage1.png', cottage2: 'assets/cottage2.png',
  bridge: 'assets/bridge.png', bush1: 'assets/bush1.png', bush2: 'assets/bush2.png',
  rocks: 'assets/rocks.png', grass: 'assets/grass.png', flowers: 'assets/flowers.png',
  well: 'assets/well.png', fence: 'assets/fence.png', lantern: 'assets/lantern.png'
}, init);
