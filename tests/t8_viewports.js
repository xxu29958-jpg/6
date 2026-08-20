'use strict';
/* t8 — 四视口相机数值断言（393×852 / 852×393 / 1440×900 / 1920×1080）
 * 断言 setViewport 基准值 + update 收敛后的可见世界矩形。 */
const H = require('./helpers.js');
H.loadCore(); H.loadMaps(); H.loadRenderBase();

const c = H.compileXigu();
LAYERS.setWorld(c.bounds);

function settle(cam) {
  cam.fx = cam.baseFx; cam.fy = cam.baseFy; cam.zoom = cam.baseZoom;
  for (let i = 0; i < 400; i++) cam.update(0.05);   // 收敛到 clamp 后稳态
}
function visible(cam) {
  const hw = cam.vw / (2 * cam.zoom), hh = cam.vh / (2 * cam.zoom);
  return [cam.fx - hw, cam.fy - hh, cam.fx + hw, cam.fy + hh];
}

/* ① 竖屏手机 393×852：focus 溪桥 (680,580)，zoom=852/1088 */
{
  const cam = new Camera(); cam.setViewport(393, 852); settle(cam);
  H.near(cam.baseZoom, Math.max(393 / 500, 852 / 1088), 1e-9, '竖屏 zoom');
  H.near(cam.baseFx, 680, 1e-9, '竖屏 fx'); H.near(cam.baseFy, 580, 1e-9, '竖屏 fy');
  H.near(cam.vigT, 0.10, 1e-9, '竖屏 vigT（V4.7 基线）'); H.near(cam.fgOnT, 0, 1e-9, '竖屏 fgOnT');
  const v = visible(cam);
  H.ok(v[0] >= 0 && v[2] <= 2048, '竖屏横向不出世界 [' + v[0].toFixed(1) + ',' + v[2].toFixed(1) + ']');
  H.ok(v[1] >= -LAYERS.MT + 19 && v[3] <= 1088 + LAYERS.MB - 19, '竖屏纵向不出烘焙底座');
  /* 内容锚定：桥区 (640,700) 应可见 */
  H.ok(640 > v[0] && 640 < v[2] && 700 > v[1] && 700 < v[3], '竖屏桥区可见');
}

/* ② 横屏手机 852×393：focus 谷地 (1000,580) */
{
  const cam = new Camera(); cam.setViewport(852, 393); settle(cam);
  H.near(cam.baseZoom, Math.max(852 / 1250, 393 / 576), 1e-9, '横屏 zoom');
  H.near(cam.baseFx, 1000, 1e-9, '横屏 fx'); H.near(cam.baseFy, 580, 1e-9, '横屏 fy');
  H.near(cam.vigT, 0.08, 1e-9, '横屏 vigT（V4.7 基线）');
  const v = visible(cam);
  H.ok(v[0] >= 0 && v[2] <= 2048, '横屏横向不出世界');
}

/* ③ 桌面 1440×900：min-fit 全图（zoom=1440/2048=0.703125） */
{
  const cam = new Camera(); cam.setViewport(1440, 900); settle(cam);
  H.near(cam.baseZoom, Math.min(1440 / 2048, 900 / 1088), 1e-9, '桌面 zoom');
  H.near(cam.baseFx, 2048 / 2 + 25, 1e-9, '桌面 fx=1049');
  H.near(cam.baseFy, 900 / cam.baseZoom / 2, 1e-9, '桌面 fy 顶对齐');
  H.near(cam.vigT, 0.16, 1e-9, '桌面 vigT'); H.near(cam.fgOnT, 1, 1e-9, '桌面 fgOnT');
  const v = visible(cam);
  H.near(v[0], 25, 1e-6, '桌面可见左界 25'); H.near(v[2], 2073, 1e-6, '桌面可见右界 2073');
  H.near(v[1], 0, 1e-6, '桌面可见上界 0'); H.near(v[3], 1280, 1e-6, '桌面可见下界 1280');
}

/* ④ 大桌面 1920×1080：min-fit（zoom=1920/2048≈0.9375） */
{
  const cam = new Camera(); cam.setViewport(1920, 1080); settle(cam);
  H.near(cam.baseZoom, Math.min(1920 / 2048, 1080 / 1088), 1e-9, '大桌面 zoom');
  const v = visible(cam);
  H.near(v[0], 25, 1e-6, '大桌面左界 25'); H.near(v[2], 2073, 1e-6, '大桌面右界 2073');
  H.ok(v[3] <= 1088 + LAYERS.MB - 19, '大桌面下界不出烘焙底座');
}
console.log('t8 viewports OK (4 视口)');
