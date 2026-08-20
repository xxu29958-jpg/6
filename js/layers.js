'use strict';
/* ============================================================
 * layers.js — V4 渲染底座 / 资产合成 / 屏幕空间层
 *  ground : L0 烘焙底座 = terrain.png + 静态资产(房屋/井/篱/花, 含烘焙接触影)
 *           + 四向外扩边距（边缘像素延展压暗 → 暗桌面，不露白）
 *  资产合成: 动态资产(树/桥/轮/灌木/草/灯/石)与居民同一 Y-sort 序列逐帧绘制
 *  fg/vig : 前景遮挡草剪影 + vignette（按 viewport 预渲染）
 * ============================================================ */

const LAYERS = { ground: null, far: null, fg: null, vig: null, blob: null };

/* 远山/天空分离层（V4.7）：废弃水平带切割——far 沿 WORLD.ridgePts 山脊轮廓线
 * 蒙版（折线上方归 far，下方归 ground， ridge 下 30px 羽化），缝藏进山脊纹理 */
const FAR_FEATHER = 30, FAR_PAD = 26;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(w));
  c.height = Math.max(2, Math.round(h));
  return c;
}

if (typeof CanvasRenderingContext2D !== 'undefined' &&
    !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) {
    this.rect(x, y, w, h);
    return this;
  };
}

/* 局部调色：正=提亮，负=压暗（居民明暗用） */
function shade(hex, amt) {
  const c = hexRgb(hex);
  const t = amt > 0 ? [255, 255, 255] : [20, 16, 10];
  return css(mixc(c, t, Math.abs(amt) / 100));
}

/* 不规则有机 blob 路径（光池/雾团用） */
function blobPath(g, x, y, rx, ry, seed, amp, n) {
  n = n || 11;
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i % n) / n * TAU;
    const w = 1 + amp * noise1(a * 2.3 + seed) + amp * 0.5 * noise1(a * 5.7 + seed * 1.7);
    const px = x + Math.cos(a) * rx * w, py = y + Math.sin(a) * ry * w;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.closePath();
}

/* 水潭有机轮廓路径（inflate>0 外扩，<0 内缩） */
function pondTrace(g, inflate) {
  const p = WORLD.pond;
  const sx = p.rx + inflate, sy = p.ry + inflate * (p.ry / p.rx);
  const o = p.outline;
  g.moveTo(p.x + o[0][0] * sx, p.y + o[0][1] * sy);
  for (let i = 1; i < o.length; i++) g.lineTo(p.x + o[i][0] * sx, p.y + o[i][1] * sy);
  g.closePath();
}
function pondPath(g, inflate) { g.beginPath(); pondTrace(g, inflate); }

/* 溪流带状裁剪路径：polyline 两侧各 half px（轻噪声破平行边） */
function ribbonOrganic(g, m, half) {
  const n = m.pts.length;
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const d = m.cum[i];
    const w = half + 6 * noise1(d * 0.02 + 2.2);
    const nx = -m.tan[i * 2 + 1], ny = m.tan[i * 2];
    const px = m.pts[i][0] + nx * w, py = m.pts[i][1] + ny * w;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  for (let i = n - 1; i >= 0; i--) {
    const d = m.cum[i];
    const w = half + 6 * noise1(d * 0.023 + 11.3);
    const nx = -m.tan[i * 2 + 1], ny = m.tan[i * 2];
    g.lineTo(m.pts[i][0] - nx * w, m.pts[i][1] - ny * w);
  }
  g.closePath();
}

/* ============================================================
 * 柔和接触影（预制径向渐变 blob，所有资产复用）
 * ============================================================ */
function bakeShadowBlob() {
  const c = makeCanvas(220, 110);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(110, 55, 4, 110, 55, 104);
  gr.addColorStop(0, 'rgba(30,22,13,0.42)');
  gr.addColorStop(0.55, 'rgba(30,22,13,0.20)');
  gr.addColorStop(1, 'rgba(30,22,13,0)');
  g.fillStyle = gr;
  g.save(); g.translate(110, 55); g.scale(1, 0.5); g.translate(-110, -55);
  g.beginPath(); g.arc(110, 55, 104, 0, TAU); g.fill();
  g.restore();
  return c;
}

/* 紧凑接地带（V4.7）：小核心深渐变 blob，6-10px 高窄椭圆紧贴脚底消悬浮 */
function bakeContactDisc() {
  const c = makeCanvas(120, 40);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(60, 20, 2, 60, 20, 58);
  gr.addColorStop(0, 'rgba(22,16,10,0.92)');
  gr.addColorStop(0.5, 'rgba(22,16,10,0.45)');
  gr.addColorStop(1, 'rgba(22,16,10,0)');
  g.fillStyle = gr;
  g.save(); g.translate(60, 20); g.scale(1, 0.33); g.translate(-60, -20);
  g.beginPath(); g.arc(60, 20, 58, 0, TAU); g.fill();
  g.restore();
  return c;
}

/* 在 g 上以资产锚点画一枚接触影（world 空间）：
 * 宽软 AoI blob + V4.7 紧贴脚底的窄椭圆接地带（半透明黑 0.18-0.25） */
function drawContactShadow(g, a, alpha, shiftX) {
  const w = a.w * 0.62 * a.shadow, h = w * 0.30;
  g.globalAlpha = clamp(alpha * a.shadow, 0, 0.6);
  g.drawImage(LAYERS.blob, a.ax - w / 2 + shiftX, a.ay - h * 0.62, w, h);
  const w2 = a.w * 0.48 * Math.min(a.shadow, 1);
  const h2 = clamp(a.w * 0.11, 6, 10);
  g.globalAlpha = clamp(alpha * 0.72 * Math.min(a.shadow, 1), 0.12, 0.25);
  g.drawImage(LAYERS.disc, a.ax - w2 / 2 + shiftX * 0.6, a.ay - h2 * 0.66, w2, h2);
  g.globalAlpha = 1;
}

/* ============================================================
 * 资产绘制（锚点定位：bbox 底部中心 → 世界 (ax,ay)）
 * ============================================================ */
function drawAssetImage(g, a, img) {
  const sx = a.srcA ? a.srcA[0] : (a.bbox[0] + a.bbox[2]) / 2;
  const sy = a.srcA ? a.srcA[1] : a.bbox[3];
  if (a.flip) {
    /* 水平镜像（绕锚点竖线翻转，锚点不动） */
    g.save();
    g.translate(a.ax, 0); g.scale(-1, 1); g.translate(-a.ax, 0);
    g.drawImage(img,
      a.ax - sx * a.s, a.ay - sy * a.s,
      img.width * a.s, img.height * a.s);
    g.restore();
    return;
  }
  g.drawImage(img,
    a.ax - sx * a.s, a.ay - sy * a.s,
    img.width * a.s, img.height * a.s);
}

/* 左右外扩边距 = 世界边缘内容水平镜像翻折 + 渐进式三重羽化
 * 镜像内容仅作底色来源：自世界边缘向外分 3 带，blur 递增(6→14→26)逐带绘制，
 * 整体降饱和——读作微缩沙盘边缘的自然失焦，而非被复制的地形；
 * 接缝处跨缝做一次 blur(8px) 窄带融合，消灭接缝线
 * （g: 目标 ctx；c: 目标 canvas；MX 边距宽；dy/dh 世界内容在 canvas 中的纵向段） */
/* V4.7 边带读作「微缩盘边缘失焦暗角」：4 带 blur 5→24 递增 + 整体压暗 0.82
 * 去饱和 0.7，内容不可辨认；接缝 8px 交叉淡化（镜像内容渐入世界缘内侧） */
const BAND_BLUR = [5, 10, 17, 24];      // 内→外四带 blur 半径
function featherSideBands(g, c, MX, dy, W, dh) {
  const bw = Math.min(MX, W);
  const bl = makeCanvas(bw, dh), br = makeCanvas(bw, dh);
  bl.getContext('2d').drawImage(c, MX, dy, bw, dh, 0, 0, bw, dh);
  br.getContext('2d').drawImage(c, MX + W - bw, dy, bw, dh, 0, 0, bw, dh);
  const n = BAND_BLUR.length, step = bw / n;
  for (let side = 0; side < 2; side++) {
    const src = side === 0 ? bl : br;
    const seamX = side === 0 ? MX : MX + W;              // 缝 = 世界边缘
    const sgn = side === 0 ? 1 : -1;                     // 外侧方向
    /* 外→内绘制：每带 clip 到「缝至该带外缘」，blur 由外带向内带递减覆盖 */
    for (let i = n - 1; i >= 0; i--) {
      g.save();
      g.beginPath();
      if (side === 0) g.rect(MX - (i + 1) * step, dy - BAND_BLUR[0], (i + 1) * step, dh + BAND_BLUR[0] * 2);
      else g.rect(MX + W, dy - BAND_BLUR[0], (i + 1) * step, dh + BAND_BLUR[0] * 2);
      g.clip();
      g.filter = 'blur(' + BAND_BLUR[i] + 'px) saturate(0.7) brightness(0.82)';
      g.translate(seamX + sgn * bw, dy); g.scale(-1, 1);
      g.drawImage(src, -1, 0, bw + 2, dh);
      g.restore();
    }
  }
  /* 接缝交叉淡化：跨缝 32px 条带（含两侧各 16px）取模糊后重绘，
   * 两侧内容在缝处各半混合，吃掉镜像翻折的导数断点=竖线 */
  for (let side = 0; side < 2; side++) {
    const seamX = side === 0 ? MX : MX + W;
    const strip = makeCanvas(64, dh);
    strip.getContext('2d').drawImage(c, seamX - 32, dy, 64, dh, 0, 0, 64, dh);
    g.save();
    g.beginPath(); g.rect(seamX - 16, dy, 32, dh); g.clip();
    g.filter = 'blur(7px) saturate(0.85) brightness(0.92)';
    g.drawImage(strip, seamX - 32, dy);
    g.restore();
  }
}

/* 边带光影收边：向外缘落入阴影（multiply 方向 #241f16），顶部天空带反向渐浅为雾色
 * skyY = 天空/地面分界（canvas y）；地面段压暗 ~45%，底座段（y≥deskY）更深 ~60% */
function edgeFalloff(g, MX, W, skyY, deskY) {
  const GW = WORLD.GW, GH = WORLD.GH;
  const DARK = '36,31,22';          /* #241f16 暖深褐 */
  const FOG = '188,202,196';        /* 天际线雾霾色方向，略浅 */
  for (let side = 0; side < 2; side++) {
    const x0 = side === 0 ? 0 : MX + W;      /* 边带外→内 */
    const gx0 = side === 0 ? MX : MX + W, gx1 = side === 0 ? 0 : GW;
    /* 地面段：向外压暗 */
    let gr = g.createLinearGradient(gx0, 0, gx1, 0);
    gr.addColorStop(0, 'rgba(' + DARK + ',0)');
    gr.addColorStop(1, 'rgba(' + DARK + ',0.45)');
    g.fillStyle = gr;
    g.fillRect(x0, skyY, MX, GH - skyY);
    /* 底座段：压暗更深（沙盘底边落入阴影） */
    if (deskY < GH) {
      gr = g.createLinearGradient(gx0, 0, gx1, 0);
      gr.addColorStop(0, 'rgba(' + DARK + ',0)');
      gr.addColorStop(1, 'rgba(' + DARK + ',0.30)');
      g.fillStyle = gr;
      g.fillRect(x0, deskY, MX, GH - deskY);
    }
    /* 天空段：向外渐浅为雾色（与天际线雾霾衔接，不压暗） */
    if (skyY > 0) {
      gr = g.createLinearGradient(gx0, 0, gx1, 0);
      gr.addColorStop(0, 'rgba(' + FOG + ',0)');
      gr.addColorStop(1, 'rgba(' + FOG + ',0.55)');
      g.fillStyle = gr;
      g.fillRect(x0, 0, MX, skyY);
    }
  }
}

/* ============================================================
 * L0 底座烘焙：terrain + 静态资产(含接触影) + 外扩边距
 * ============================================================ */
function bakeGround(terrain) {
  const W = WORLD.W, H = WORLD.H, MX = WORLD.MX, MT = WORLD.MT, MB = WORLD.MB;
  const c = makeCanvas(WORLD.GW, WORLD.GH);
  const g = c.getContext('2d');

  /* 0) 整底 = 暗桌面色（任何缝隙都不露白） */
  g.fillStyle = '#221a12';
  g.fillRect(0, 0, WORLD.GW, WORLD.GH);

  /* 1) 地形盘本体（全幅 0..H：地面层含完整中景/远山像素——far 层移位或羽化
   *     透出时底下是同一张图，脊线蒙版缝两侧内容连续，拖动零撕裂） */
  g.drawImage(terrain, 0, 0, W, H, MX, MT, W, H);

  /* 2) 静态资产（按锚点 y 排序，含烘焙接触影） */
  g.save();
  g.translate(MX, MT);
  for (const a of WORLD.staticAssets) {
    const img = ASSETS[a.img];
    if (!img) continue;
    drawContactShadow(g, a, 0.30, a.w * 0.05);
    drawAssetImage(g, a, img);
  }

  /* 2.5) 水岸湿石暗边（沿溪带两侧 + 潭岸窄环）+ 桥洞下局部软阴影 —— 烘焙 */
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = 'rgba(26,22,15,0.10)';
  g.lineWidth = 12;
  ribbonOrganic(g, WORLD.stream, 50);
  g.stroke();
  g.strokeStyle = 'rgba(24,20,14,0.20)';
  g.lineWidth = 5;
  ribbonOrganic(g, WORLD.stream, 45);
  g.stroke();
  g.strokeStyle = 'rgba(23,20,14,0.08)';
  g.lineWidth = 15;
  pondPath(g, -9);
  g.stroke();
  g.strokeStyle = 'rgba(22,19,13,0.17)';
  g.lineWidth = 7;
  pondPath(g, -4);
  g.stroke();
  g.strokeStyle = 'rgba(24,21,15,0.10)';
  g.lineWidth = 6;
  pondPath(g, 4);
  g.stroke();
  /* 桥洞下软阴影（桥身固定，影烘焙进水/岸） */
  g.globalAlpha = 0.55;
  g.drawImage(LAYERS.blob, 640 - 100, 742, 200, 56);
  g.globalAlpha = 1;
  g.restore();

  /* 3) 左右边缘：真实内容镜像翻折延展（禁止 1px/2px 拉伸 → 横向拉丝），
   *    三重渐进羽化 + 跨缝融合；顶部随后用整宽（含羽化缘）向上延展 */
  featherSideBands(g, c, MX, MT, W, H);
  g.drawImage(c, 0, MT, WORLD.GW, 2, 0, 0, WORLD.GW, MT);

  /* 4) 底部：草坡边缘向下延展一段（左右缘同样镜像翻折，不拉伸），再渐变到暗桌面 */
  const soilSrcY = H - 96, soilDstH = 150;
  g.drawImage(terrain, 0, soilSrcY, W, 96, MX, MT + H, W, soilDstH);
  featherSideBands(g, c, MX, MT + H, W, soilDstH);
  const deskY = MT + H + soilDstH;
  const dg = g.createLinearGradient(0, MT + H - 30, 0, WORLD.GH);
  dg.addColorStop(0, 'rgba(34,26,18,0)');
  dg.addColorStop(0.28, 'rgba(34,26,18,0.55)');
  dg.addColorStop(0.62, '#221a12');
  dg.addColorStop(1, '#17110c');
  g.fillStyle = dg;
  g.fillRect(0, MT + H - 30, WORLD.GW, WORLD.GH - (MT + H - 30));
  g.fillStyle = '#1c1510';
  g.fillRect(0, deskY, WORLD.GW, WORLD.GH - deskY);

  /* 5) 桌面质感：细密噪点 + 极轻横向木纹（确定性随机） */
  const trng = mulberry32(778899);
  for (let i = 0; i < 2600; i++) {
    const x = trng() * WORLD.GW;
    const y = MT + H + 8 + trng() * (WORLD.GH - MT - H - 8);
    const l = trng();
    g.fillStyle = l < 0.5
      ? 'rgba(0,0,0,' + (0.05 + trng() * 0.10) + ')'
      : 'rgba(255,235,205,' + (0.02 + trng() * 0.05) + ')';
    g.fillRect(x, y, 1 + trng() * 2.5, 1);
  }
  for (let i = 0; i < 26; i++) {
    const y = MT + H + 20 + trng() * (WORLD.GH - MT - H - 30);
    g.strokeStyle = 'rgba(0,0,0,' + (0.03 + trng() * 0.05) + ')';
    g.lineWidth = 0.8 + trng() * 1.4;
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(WORLD.GW * 0.3, y + (trng() - 0.5) * 10,
      WORLD.GW * 0.7, y + (trng() - 0.5) * 10, WORLD.GW, y + (trng() - 0.5) * 6);
    g.stroke();
  }

  /* 6) 边带光影收边：地面/底座段向外落入暖深褐阴影，天空段向外渐浅为雾色；
   *    顶边距（天空向上延展）同样向顶渐浅，不压暗 */
  edgeFalloff(g, MX, W, MT + 170, MT + H + 20);
  const fg0 = g.createLinearGradient(0, MT, 0, 0);
  fg0.addColorStop(0, 'rgba(188,202,196,0)');
  fg0.addColorStop(1, 'rgba(188,202,196,0.35)');
  g.fillStyle = fg0; g.fillRect(0, 0, WORLD.GW, MT);

  return c;
}

/* ============================================================
 * far 层烘焙（V4.7）：terrain 顶部远山/天空独立视差慢层
 * 内容 = terrain 上部 + 天空/左右缘延展；下缘 = WORLD.ridgePts 山脊轮廓线
 * 蒙版（折线下方 30px 羽化透明）——缝沿山脊纹理走，不横切中景丘陵，
 * 且地面层在脊线下方持有同一图像素，视差微移也看不出缝
 * ============================================================ */
function bakeFar(terrain) {
  const W = WORLD.W, MX = WORLD.MX, MT = WORLD.MT;
  const bodyH = WORLD.ridgeMaxY + FAR_FEATHER;
  const FH = MT + bodyH + FAR_PAD;
  const c = makeCanvas(WORLD.GW, FH);
  const g = c.getContext('2d');

  /* 远山/天空本体（运行时额外 grade：去饱和 + 压暗 + 冷偏，远山退远） */
  g.filter = 'saturate(0.75) brightness(0.92)';
  g.drawImage(terrain, 0, 0, W, bodyH, MX, MT, W, bodyH);
  /* 天空向上延展（顶边距） */
  g.drawImage(terrain, 0, 0, W, 2, MX, 0, W, MT);
  g.filter = 'none';
  /* 左右缘：镜像翻折延展（含天空区，禁止拉伸条纹；左右各 MX≫64px 安全边）
   * 渐进四带羽化 + 压暗去饱和 + 跨缝交叉淡化 */
  featherSideBands(g, c, MX, 0, W, MT + bodyH);
  edgeFalloff(g, MX, W, MT + 170, FH);
  /* 冷偏洗（source-atop 只染已画内容，不动 alpha） */
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(150,178,204,0.07)';
  g.fillRect(0, 0, WORLD.GW, FH);
  g.globalCompositeOperation = 'source-over';

  /* 山脊线蒙版：白 = far 持有（脊线上方）；黑 = 归还地面层（脊线下方）；
   * 折线向下 FAR_FEATHER px 羽化（blur ≈ feather/2） */
  /* 蒙版画布外扩 32px，blur 的边缘衰减发生在画布外，不啃 far 层四缘 */
  const MP = 32;
  const msk = makeCanvas(WORLD.GW + MP * 2, FH + MP * 2);
  const mg = msk.getContext('2d');
  mg.fillStyle = '#fff';
  mg.fillRect(0, 0, WORLD.GW + MP * 2, FH + MP * 2);
  mg.fillStyle = '#000';
  mg.beginPath();
  const rp = WORLD.ridgePts;
  mg.moveTo(0, MP + MT + rp[0][1]);
  /* 左右端用端点 y 水平延展到边带外缘（边带内容镜像翻折，脊线同理取平） */
  for (let i = 0; i < rp.length; i++) mg.lineTo(MP + MX + rp[i][0], MP + MT + rp[i][1]);
  mg.lineTo(WORLD.GW + MP * 2, MP + MT + rp[rp.length - 1][1]);
  mg.lineTo(WORLD.GW + MP * 2, FH + MP * 2);
  mg.lineTo(0, FH + MP * 2);
  mg.closePath();
  mg.fill();
  /* 羽化：蒙版整体 blur，使切割带 ≈ 脊线上下 30px 渐隐 */
  const msk2 = makeCanvas(WORLD.GW + MP * 2, FH + MP * 2);
  const m2 = msk2.getContext('2d');
  m2.filter = 'blur(' + (FAR_FEATHER / 2) + 'px)';
  m2.drawImage(msk, 0, 0);
  m2.filter = 'none';
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(msk2, -MP, -MP);
  g.globalCompositeOperation = 'source-over';
  return c;
}

/* ============================================================
 * 动态场景合成（Y-sort）：
 * 动态资产 + 居民按锚点 y 排序绘制；过桥/桥上坐姿居民排在桥之后；
 * 树/灌木/草/灯以锚点为枢轴风摆；水车轮绕轮心旋转；逐资产接触影
 * ============================================================ */
const _scene = [];

function drawDynAsset(g, a, t) {
  const img = ASSETS[a.img];
  if (!img) return;
  const c = DAY.cur;

  /* 接触影：白昼清楚 / 黄昏拉长偏右 / 夜晚淡 */
  const shA = 0.30 * (1 - c.night * 0.55) * (0.8 + c.dusk * 0.25);
  const shX = a.w * (0.04 + c.dusk * 0.10);
  drawContactShadow(g, a, shA, shX);

  if (a.spin) {
    /* 水车轮：绕 bbox 中心（轮心）优雅慢转，~10.4s/圈；
     * 逆时针 = 溪水流经轮下往右下推（轮底随水向 SE），方向与水流一致 */
    const s = a.s;
    const cxI = (a.bbox[0] + a.bbox[2]) / 2, cyI = (a.bbox[1] + a.bbox[3]) / 2;
    const px = a.ax, py = a.ay - (a.bbox[3] - cyI) * s;
    g.save();
    g.translate(px, py);
    g.rotate(-t * TAU / 10.4);
    g.drawImage(img, -cxI * s, -cyI * s, img.width * s, img.height * s);
    g.restore();
    return;
  }

  const sw = a.sway;
  if (sw > 0) {
    /* 风摆：锚点枢轴微旋转 + 呼吸缩放（树额外吃点击冲量） */
    const imp = a.img === 'tree' ? DYN.treeImp : 0;
    const rot = (noise1(t * 0.45 + a.ph * 2.1) * 0.75 * sw
      + imp * Math.sin(t * 8.5) * 2.4) * Math.PI / 180;
    const breathe = 1 + 0.004 * sw * Math.sin(t * 0.6 + a.ph)
      + imp * 0.008 * Math.sin(t * 7.2);
    g.save();
    g.translate(a.ax, a.ay);
    g.rotate(rot);
    g.scale(breathe, breathe);
    g.translate(-a.ax, -a.ay);
    drawAssetImage(g, a, img);
    g.restore();
  } else {
    drawAssetImage(g, a, img);
  }
}

function drawScene(g) {
  const t = DYN.t;
  const items = _scene;
  items.length = 0;
  for (const a of WORLD.dynAssets) { a._sy = a.ay; items.push(a); }
  for (const r of RES.list) {
    if (r.alpha <= 0.03) continue;
    if (r.state === 'swing') continue;          // 秋千上的居民由 SWING 层绘制
    r._sy = r.onBridge ? WORLD.bridge.sortY + 1 : r.y;
    items.push(r);
  }
  SWING._sy = SWING.sortY;
  items.push(SWING);
  items.sort((p, q) => p._sy - q._sy);
  for (const it of items) {
    if (it.isRes) it.draw(g, t);
    else if (it.isSwing) it.draw(g, t);
    else drawDynAsset(g, it, t);
  }
}

/* ============================================================
 * 前景遮挡草剪影（屏幕空间，底部两角）+ vignette
 * ============================================================ */
function bakeForeground(vw, vh) {
  const c = makeCanvas(vw, vh);
  const g = c.getContext('2d');
  g.filter = 'blur(9px)';
  const blade = (bx, tipX, tipY, w, col, a) => {
    g.fillStyle = col; g.globalAlpha = a;
    const mx = (bx + tipX) / 2, my = (vh + tipY) / 2;
    g.beginPath();
    g.moveTo(bx - w, vh + 26);
    g.quadraticCurveTo(mx - w * 0.55, my, tipX, tipY);
    g.quadraticCurveTo(mx + w * 0.5, my + 14, bx + w, vh + 26);
    g.closePath(); g.fill();
  };
  g.globalAlpha = 1;
  const band = g.createLinearGradient(0, vh - 44, 0, vh);
  band.addColorStop(0, 'rgba(24,30,18,0)');
  band.addColorStop(1, 'rgba(24,30,18,0.30)');
  g.fillStyle = band; g.fillRect(0, vh - 44, vw, 44);
  blade(vw * 0.012, vw * 0.058, vh - 150, 14, '#39431f', 0.62);
  blade(vw * 0.048, vw * 0.014, vh - 104, 11, '#2f3a1c', 0.58);
  blade(vw * 0.078, vw * 0.108, vh - 76, 9, '#3d4723', 0.52);
  blade(vw * 0.104, vw * 0.072, vh - 50, 8, '#333e1e', 0.48);
  blade(vw * 0.986, vw * 0.938, vh - 162, 15, '#39431f', 0.62);
  blade(vw * 0.949, vw * 0.992, vh - 108, 11, '#2f3a1c', 0.56);
  blade(vw * 0.916, vw * 0.892, vh - 68, 9, '#3d4723', 0.50);
  g.filter = 'none';
  return c;
}

function bakeVignette(vw, vh) {
  const c = makeCanvas(vw, vh);
  const g = c.getContext('2d');
  const r = Math.hypot(vw, vh) * 0.62;
  const gr = g.createRadialGradient(vw / 2, vh / 2, r * 0.45, vw / 2, vh / 2, r);
  gr.addColorStop(0, 'rgba(16,12,8,0)');
  gr.addColorStop(1, 'rgba(16,12,8,1)');
  g.fillStyle = gr; g.fillRect(0, 0, vw, vh);
  return c;
}

/* ---------- 视觉水掩码（V4.7）：1/4 分辨率查色，蓝绿占优 = 水；
 * 居民寻路断言用它，与肉眼所见水面严格一致 ---------- */
function buildWaterMask(terrain) {
  const MW = 512, MH = 272;
  const c = makeCanvas(MW, MH);
  const g = c.getContext('2d');
  g.drawImage(terrain, 0, 0, MW, MH);
  const id = g.getImageData(0, 0, MW, MH).data;
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
  WORLD.isWater = function (wx, wy) {
    const cx = clamp(Math.round(wx * MW / WORLD.W), 0, MW - 1);
    const cy = clamp(Math.round(wy * MH / WORLD.H), 0, MH - 1);
    return m2[cy * MW + cx] === 1;
  };
}

/* ---------- 总入口（图片预加载完成后调用） ---------- */
function bakeAll(terrain) {
  LAYERS.blob = bakeShadowBlob();
  LAYERS.disc = bakeContactDisc();
  buildWaterMask(terrain);
  LAYERS.ground = bakeGround(terrain);
  LAYERS.far = bakeFar(terrain);
}

function bakeScreenLayers(vw, vh) {
  LAYERS.fg = bakeForeground(vw, vh);
  LAYERS.vig = bakeVignette(vw, vh);
}
