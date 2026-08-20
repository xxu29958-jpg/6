'use strict';
/* t9 — 平板修复（V4.8 关键裁决 §3.6 / 设计 §7）：
 * 1280×800 → zoom=0.625 min-fit 全图，可见 2048×1280，横向完整不裁切 */
const H = require('./helpers.js');
H.loadCore(); H.loadMaps(); H.loadRenderBase();

const c = H.compileXigu();
LAYERS.setWorld(c.bounds);

const cam = new Camera();
cam.setViewport(1280, 800);
cam.fx = cam.baseFx; cam.fy = cam.baseFy; cam.zoom = cam.baseZoom;
for (let i = 0; i < 400; i++) cam.update(0.05);

H.near(cam.zoom, 0.625, 1e-9, '平板 zoom = min(1280/2048, 800/1088) = 0.625');
H.near(cam.baseFx, 1049, 1e-9, '平板 fx = W/2+25');
H.near(cam.baseFy, 640, 1e-9, '平板 fy = vh/zoom/2（顶对齐）');
H.near(cam.fgOnT, 1, 1e-9, '平板前景遮挡开');
H.near(cam.vigT, 0.14, 1e-9, '平板 vigT 0.14');

/* 可见世界矩形：[25, 0] ~ [2073, 1280] —— 全图 + 左右边带各 25px + 底部延展 */
const hw = 1280 / (2 * cam.zoom), hh = 800 / (2 * cam.zoom);
H.near(cam.fx - hw, 25, 1e-6, '可见左界 25');
H.near(cam.fx + hw, 2073, 1e-6, '可见右界 2073');
H.near(cam.fy - hh, 0, 1e-6, '可见上界 0');
H.near(cam.fy + hh, 1280, 1e-6, '可见下界 1280');

/* zoom 下限约束未误伤（0.625 > zoomMin≈0.5904） */
const zoomMin = Math.max(1280 / (2048 + 120), 800 / LAYERS.GH);
H.ok(cam.zoom > zoomMin, '平板 zoom 高于硬下限 ' + zoomMin.toFixed(4));

/* 横竖切换回归：竖屏 800×1280 → focus 分支（vigT 0.10，V4.7 基线） */
const cam2 = new Camera(); cam2.setViewport(800, 1280);
H.near(cam2.baseFx, 680, 1e-9, '旋转竖屏 fx'); H.near(cam2.vigT, 0.10, 1e-9, '旋转竖屏 vigT');
console.log('t9 tablet OK (1280×800 → 可见 2048×1280 全图)');
