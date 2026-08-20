'use strict';
/* ============================================================
 * camera.js — 响应式相机：同一世界，不同取景（禁止整体 scale）
 * Camera = {focus, zoom} + 拖动偏移 + pinch 倍率 + 居民聚焦倍率 + 视差
 * 所有运动用指数趋近 / 临界阻尼弹簧
 * ============================================================ */

class Camera {
  constructor() {
    this.vw = 1440; this.vh = 900;
    /* 当前值（平滑后） */
    this.fx = 800; this.fy = 500; this.zoom = 0.9;
    /* 视口基准预设 */
    this.baseFx = 800; this.baseFy = 500; this.baseZoom = 0.9;
    /* 拖动偏移（世界单位，±60 限幅，松手回弹） */
    this.dragX = 0; this.dragY = 0;
    this.dragTX = 0; this.dragTY = 0;
    this.dragVX = 0; this.dragVY = 0;
    this.dragging = false;
    /* pinch 用户缩放倍率 0.85~1.3 */
    this.pinch = 1; this.pinchT = 1;
    /* 居民聚焦推近倍率 ×1.6 */
    this.resMul = 1; this.resMulT = 1;
    this.resident = null;
    /* pointer 视差（-1..1 平滑值） */
    this.parX = 0; this.parY = 0; this.parTX = 0; this.parTY = 0;
    /* 预设开关量（平滑过渡） */
    this.fgOn = 0; this.fgOnT = 0;      // 前景遮挡启用度
    this.vig = 0.12; this.vigT = 0.12;  // vignette 强度
  }

  /* 按 viewport 选择取景预设（v4-config：世界 = 2048×1088 地形盘） */
  setViewport(vw, vh) {
    this.vw = vw; this.vh = vh;
    const aspect = vw / vh;
    let zoom, fx, fy;
    if (aspect < 0.8) {
      /* 竖屏手机：全高纵向切片 ~500 宽，focus (680,580)
         磨坊完整收进左缘、桥在画面下 1/3、溪流纵贯 */
      zoom = Math.max(vw / 500, vh / 1088); fx = 680; fy = 580;
      this.fgOnT = 0; this.vigT = 0.10;
    } else if (vh < 520 && aspect > 1.4) {
      /* 横屏手机：约 1250×576，focus (1000,580) 村落核心 */
      zoom = Math.max(vw / 1250, vh / 576); fx = 1000; fy = 580;
      this.fgOnT = 0; this.vigT = 0.08;
    } else if (vw < 1400) {
      /* 平板：约 1750×830，focus (1024,560) + 底部前景遮挡 */
      zoom = Math.max(vw / 1750, vh / 830); fx = 1024; fy = 560;
      this.fgOnT = 1; this.vigT = 0.12;
    } else {
      /* 桌面：全图 2048×1088 min-fit 完整入画（下方露出暗桌面）
         + 前景遮挡 + 轻 vignette；焦点 +25 微调配重（左密右补） */
      zoom = Math.min(vw / WORLD.W, vh / WORLD.H);
      fx = WORLD.W / 2 + 25;
      fy = vh / zoom / 2;          // 视图顶对齐世界顶（y=0）
      this.fgOnT = 1; this.vigT = 0.16;
    }
    /* 纵向余量保护：视图高度不超过世界+延展 */
    const maxVH = WORLD.H + WORLD.MT + WORLD.MB;
    if (vh / zoom > maxVH && aspect >= 0.8) {
      zoom = vh / maxVH;
      if (aspect < 0.8 || vw >= 1400) fy = vh / zoom / 2;
    }
    this.baseZoom = zoom; this.baseFx = fx; this.baseFy = fy;
  }

  focusResident(r) { this.resident = r; }
  clearFocus() { this.resident = null; }

  /* 拖动中：直接设定目标偏移（世界单位） */
  setDrag(dx, dy) {
    this.dragTX = clamp(dx, -60, 60);
    this.dragTY = clamp(dy, -60, 60);
  }

  update(dt) {
    /* 居民聚焦：目标焦点跟随居民；居民进屋（淡出）后释放 */
    if (this.resident && this.resident.alpha < 0.2) this.resident = null;
    this.resMulT = this.resident ? 1.6 : 1;

    /* 拖动：拖动中快速跟随目标；松开后临界阻尼弹簧回 0 */
    if (this.dragging) {
      const k = damp(14, dt);
      this.dragX += (this.dragTX - this.dragX) * k;
      this.dragY += (this.dragTY - this.dragY) * k;
      this.dragVX = 0; this.dragVY = 0;
    } else {
      /* 临界阻尼：damp = 2*sqrt(stiff) */
      const stiff = 42, dmp = 2 * Math.sqrt(stiff);
      this.dragVX += (-this.dragX * stiff - this.dragVX * dmp) * dt;
      this.dragVY += (-this.dragY * stiff - this.dragVY * dmp) * dt;
      this.dragX += this.dragVX * dt;
      this.dragY += this.dragVY * dt;
      this.dragTX = 0; this.dragTY = 0;
    }

    /* 目标焦点与缩放 */
    const tx = (this.resident ? this.resident.x : this.baseFx) + this.dragX;
    const ty = (this.resident ? this.resident.y - 8 : this.baseFy) + this.dragY;
    const tz = this.baseZoom * this.pinchT * this.resMulT;

    const k = damp(3.0, dt);
    this.fx += (tx - this.fx) * k;
    this.fy += (ty - this.fy) * k;
    this.zoom += (tz - this.zoom) * k;
    this.pinch += (this.pinchT - this.pinch) * damp(8, dt);
    this.resMul += (this.resMulT - this.resMul) * damp(2.2, dt);

    /* 视差平滑 */
    const kp = damp(4.5, dt);
    this.parX += (this.parTX - this.parX) * kp;
    this.parY += (this.parTY - this.parY) * kp;

    this.fgOn += (this.fgOnT - this.fgOn) * damp(3, dt);
    this.vig += (this.vigT - this.vig) * damp(3, dt);

    /* 视野硬约束（任何视口/缩放/拖动/聚焦后生效）：
     * ① zoom 下限：水平视野 ≤ 世界宽+120（V4.7：失焦边带屏上每侧 ≤60px 等效，
     *    超宽屏自动抬高 zoom 下限），纵向 ≤ 烘焙底座含延展高
     * ② 焦点 clamp 到 [视野半宽-边距, 世界+边距-视野半宽]；视野更宽时居中锁定
     * ③ EDGE_INSET：边带显露阈值向里收 20px（宁少露世界边缘，不露羽化边带外段） */
    const zoomMin = Math.max(this.vw / (WORLD.W + 120), this.vh / WORLD.GH);
    if (this.zoom < zoomMin) this.zoom = zoomMin;
    const EI = 20;
    const halfW = this.vw / (2 * this.zoom), halfH = this.vh / (2 * this.zoom);
    const xLo = halfW - WORLD.MX + EI, xHi = WORLD.W + WORLD.MX - EI - halfW;
    this.fx = xLo > xHi ? WORLD.W / 2 : clamp(this.fx, xLo, xHi);
    const yLo = halfH - WORLD.MT + EI, yHi = WORLD.H + WORLD.MB - EI - halfH;
    this.fy = yLo > yHi ? (WORLD.H + WORLD.MB - WORLD.MT) / 2 : clamp(this.fy, yLo, yHi);
  }

  /* 世界→屏幕变换（shiftX/shiftY 为屏幕 px 视差偏移） */
  apply(ctx, dpr, shiftX, shiftY) {
    ctx.setTransform(
      dpr * this.zoom, 0, 0, dpr * this.zoom,
      dpr * (this.vw / 2 - this.fx * this.zoom + (shiftX || 0)),
      dpr * (this.vh / 2 - this.fy * this.zoom + (shiftY || 0))
    );
  }

  screenToWorld(px, py) {
    return {
      x: (px - this.vw / 2) / this.zoom + this.fx,
      y: (py - this.vh / 2) / this.zoom + this.fy
    };
  }
}
