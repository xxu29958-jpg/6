'use strict';
/* ============================================================
 * dynamic.js — V4 动态层 + 粒子池 + 夜晚辉光
 * 美术底座 = 地形盘+资产；动态只做"光与生命"的叠加：
 * 溪流流光(裁剪±60px) / 两级瀑布滚动亮丝+溅沫+底雾 / 潭面微光+鱼 / 涟漪 /
 * 炊烟 / 薄雾 / 萤火虫 / 鸟群 / 云影 / 落叶 / 黄昏光池 /
 * 夜晚辉光(窗灯·门灯·灯笼·星·月·月柱倒影)
 * （资产 sway/旋转在 layers.js drawScene 的 Y-sort 序列里逐帧绘制）
 * 所有粒子预分配对象池，rAF 内不分配大对象
 * ============================================================ */

const DYN = {
  t: 0,
  Q: 1,                       // 质量系数（移动端 0.55）
  shimmer: [], pondShim: [],
  splash: [], smoke: [], motes: [], flies: [],
  ripples: [], leaves: [], driftLeaves: [],
  smokeT: [],
  birds: { on: false, x: 0, y: 0, vx: 0, n: 0, off: [], next: 12 },
  rippleT: 4,
  treeImp: 0,
  gust: 0
};

const _pt = { x: 0, y: 0, tx: 0, ty: 0 };   // 复用临时对象

function initDynamic(mobile) {
  DYN.Q = mobile ? 0.55 : 1;
  const Q = DYN.Q, sm = WORLD.stream;

  /* 溪流流光种子（顺流推进） */
  const nSh = Math.round(40 * Q);
  for (let i = 0; i < nSh; i++) {
    DYN.shimmer.push({
      d: arand(0, sm.len), off: arand(-0.4, 0.4),
      ph: arand(TAU), sp: arand(16, 30), len: arand(8, 16)
    });
  }
  /* 水潭横向微光 */
  const nP = Math.round(20 * Q);
  for (let i = 0; i < nP; i++) {
    DYN.pondShim.push({
      x: arand(-0.75, 0.75), y: arand(-0.6, 0.6),
      len: arand(16, 44), ph: arand(TAU), sp: arand(3, 7)
    });
  }
  /* 瀑布溅沫池 */
  const nS = Math.round(30 * Q);
  for (let i = 0; i < nS; i++) DYN.splash.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1 });
  DYN.splashT = 0;
  /* 炊烟池（磨坊+中屋烟囱共用） */
  const nSm = Math.round(34 * Q);
  for (let i = 0; i < nSm; i++) DYN.smoke.push({ x: 0, y: 0, r: 2, vx: 0, life: 0, max: 1 });
  DYN.smokeT = WORLD.chimneys.map(() => arand(0, 0.5));
  /* 漂浮微粒 */
  const nM = Math.round(36 * Q);
  for (let i = 0; i < nM; i++) {
    DYN.motes.push({ x: arand(280, 1900), y: arand(330, 1000), ph: arand(TAU), sp: arand(1.5, 4) });
  }
  /* 萤火虫（夜，避开天空） */
  const nF = Math.round(26 * Q);
  for (let i = 0; i < nF; i++) {
    DYN.flies.push({
      x: arand(240, 1900), y: arand(420, 1000),
      a: arand(TAU), ph: arand(TAU), fq: arand(0.5, 1.1)
    });
  }
  /* 涟漪池 */
  for (let i = 0; i < 24; i++) DYN.ripples.push({ x: 0, y: 0, r: 0, life: 0, max: 1, pond: false });
  /* 落叶池 */
  for (let i = 0; i < 8; i++) DYN.leaves.push({ x: 0, y: 0, rot: 0, vr: 0, life: 0, ph: 0 });
  /* 溪流漂叶（顺流缓慢漂移，到潭边消失重生） */
  const leafCols = ['#8a8a52', '#9a8a4e', '#7d8a4e'];
  for (let i = 0; i < 3; i++) {
    DYN.driftLeaves.push({
      d: arand(0, sm.len), off: arand(-0.32, 0.32),
      sp: arand(7, 11), rot: arand(TAU), vr: arand(-0.5, 0.5),
      ph: arand(TAU), col: leafCols[i % 3]
    });
  }
}

/* ---------- 粒子池工具 ---------- */
function poolGet(pool) {
  for (const p of pool) if (p.life <= 0) return p;
  return null;
}

/* ---------- 交互触发型 ---------- */
function spawnRipple(wx, wy, inPond) {
  for (let k = 0; k < 3; k++) {
    const r = poolGet(DYN.ripples);
    if (!r) return;
    r.x = wx; r.y = wy; r.r = 3; r.life = -k * 0.14;   // 错峰扩散（3 圈衰减）
    r.max = 1.3 + k * 0.25; r.pond = inPond;
  }
}
function spawnLeaf() {
  const l = poolGet(DYN.leaves);
  if (!l) return;
  const z = WORLD.tree.leafZone;
  l.x = arand(z.x0, z.x1);
  l.y = z.y + arand(-z.dy, z.dy);
  l.rot = arand(TAU); l.vr = arand(-2, 2);
  l.life = arand(2.6, 3.4); l.ph = arand(TAU);
}
function treeNudge() {
  DYN.treeImp = 1;
  if (arng() < 0.7) { spawnLeaf(); if (arng() < 0.4) spawnLeaf(); }
}
function fishScatter(wx, wy) {
  for (const f of WORLD.fish) {
    const dx = f.x - wx, dy = f.y - wy;
    const d = Math.hypot(dx, dy) || 1;
    const s = 90 * clamp(1 - d / 260, 0.25, 1);
    f.fx += (dx / d) * s; f.fy += (dy / d) * s * 0.6;
    f.flee = 1.4;
  }
}

/* ============================================================
 * 更新
 * ============================================================ */
function updateDynamic(dt) {
  const t = DYN.t += dt;
  const night = DAY.cur.night;
  const Q = DYN.Q;

  /* 风阵（全局低频，树冠/烟共享） */
  DYN.gust = noise1(t * 0.35) * 0.5 + 0.5;

  /* 溪流流光顺流推进 */
  for (const s of DYN.shimmer) {
    s.d += s.sp * dt;
    if (s.d > WORLD.stream.len) s.d -= WORLD.stream.len;
  }

  /* 大树点击冲量衰减 */
  DYN.treeImp *= Math.exp(-dt * 1.4);

  /* 瀑布溅沫 */
  DYN.splashT -= dt;
  if (DYN.splashT <= 0) {
    DYN.splashT = 0.08 / Q;
    const s = poolGet(DYN.splash);
    if (s) {
      const fp = WORLD.fallsPool;
      s.x = fp.x + arand(-16, 16); s.y = fp.y - 4;
      s.vx = arand(-18, 18); s.vy = arand(-46, -18);
      s.life = s.max = arand(0.35, 0.65);
    }
  }
  for (const s of DYN.splash) {
    if (s.life <= 0) continue;
    s.life -= dt;
    s.vy += 110 * dt;
    s.x += s.vx * dt; s.y += s.vy * dt;
  }

  /* 炊烟（夜晚减弱至一缕） */
  for (let ci = 0; ci < WORLD.chimneys.length; ci++) {
    const ch = WORLD.chimneys[ci];
    DYN.smokeT[ci] -= dt;
    if (DYN.smokeT[ci] <= 0) {
      DYN.smokeT[ci] = arand(0.5, 0.95) / ch.rate / Q * (1 + night * 2.2);
      const s = poolGet(DYN.smoke);
      if (s) {
        /* V4.7 炊烟加强：粒子尺寸 ×1.4（相对 V4.6 初值） */
        s.x = ch.x; s.y = ch.y; s.r = arand(2.5, 4.2);
        s.vx = arand(-1.5, 1.5); s.life = s.max = arand(3.6, 5.8);
      }
    }
  }
  const wind = 4 + DYN.gust * 6;
  for (const s of DYN.smoke) {
    if (s.life <= 0) continue;
    s.life -= dt;
    s.y -= (13 + s.r) * dt;
    s.x += (wind + s.vx) * dt;
    s.r += 3.6 * dt;
  }

  /* 漂浮微粒 */
  for (const m of DYN.motes) {
    m.x += (wind * 0.25 + Math.sin(t * 0.5 + m.ph) * 2) * dt * m.sp;
    m.y -= 1.6 * dt * m.sp * 0.4;
    if (m.x > 1960) m.x = 260;
    if (m.y < 320) m.y = 1000;
  }

  /* 萤火虫 */
  if (night > 0.55) {
    for (const f of DYN.flies) {
      f.a += noise1(t * 0.4 + f.ph * 3) * 1.6 * dt;
      f.x += Math.cos(f.a) * 11 * dt;
      f.y += Math.sin(f.a) * 7 * dt - 0.5 * dt;
      if (f.x < 220) f.x = 220; if (f.x > 1920) f.x = 1920;
      if (f.y < 400) f.y = 400; if (f.y > 1020) f.y = 1020;
    }
  }

  /* 涟漪 */
  for (const r of DYN.ripples) {
    if (r.life <= 0) { if (r.life > -0.001) continue; r.life += dt; if (r.life <= 0) continue; }
    r.life += dt;
    r.r += (r.pond ? 34 : 24) * dt;
    if (r.life > r.max) r.life = 0;
  }
  /* 环境小涟漪（鱼偶发啄水面：低频随机，不限于点击；落在某条鱼的位置） */
  DYN.rippleT -= dt;
  if (DYN.rippleT <= 0) {
    DYN.rippleT = arand(4, 9);
    const rr = poolGet(DYN.ripples);
    if (rr) {
      const f = WORLD.fish[Math.floor(arng() * WORLD.fish.length)];
      rr.x = f.x + arand(-8, 8);
      rr.y = f.y + arand(-5, 5);
      rr.r = 1.5; rr.life = 0.01; rr.max = 0.9; rr.pond = true;
    }
  }

  /* 溪流漂叶 */
  for (const l of DYN.driftLeaves) {
    l.d += l.sp * dt;
    l.rot += l.vr * dt;
    if (l.d > WORLD.stream.len - 10) {       // 到潭边：消失重生
      l.d = 0; l.off = arand(-0.32, 0.32);
      l.sp = arand(7, 11); l.vr = arand(-0.5, 0.5);
    }
  }

  /* 秋千（摆动更新；乘坐调度在 residents.js） */
  SWING.update(dt);

  /* 落叶 */
  for (const l of DYN.leaves) {
    if (l.life <= 0) continue;
    l.life -= dt;
    l.y += 22 * dt;
    l.x += Math.sin(t * 2.2 + l.ph) * 11 * dt;
    l.rot += l.vr * dt;
  }

  /* 鱼（潭椭圆内巡游，点击受惊散开） */
  const fa = WORLD.fishArea;
  for (const f of WORLD.fish) {
    f.a += f.speed * dt * (f.flee > 0 ? 2.4 : 1);
    f.wig += dt * 2;
    let tx = fa.x + Math.cos(f.a) * fa.rx * f.ra + Math.sin(f.wig) * 8;
    let ty = fa.y + Math.sin(f.a) * fa.ry * f.ra + Math.cos(f.wig * 0.7) * 5;
    if (f.flee > 0) {
      f.flee -= dt;
      f.fx *= Math.exp(-dt * 1.8); f.fy *= Math.exp(-dt * 1.8);
      tx += f.fx; ty += f.fy;
    }
    f.x = tx; f.y = ty;
  }

  /* 鸟群：偶发掠过 y∈[150,400] */
  const B = DYN.birds;
  if (!B.on) {
    B.next -= dt;
    if (B.next <= 0 && night < 0.6) {
      B.on = true;
      B.n = 4 + Math.floor(arand(0, 3.99) * Q) + (DYN.Q < 1 ? 0 : 1);
      B.x = -100; B.y = arand(150, 400);
      B.vx = arand(64, 86);
      B.off.length = 0;
      for (let i = 0; i < B.n; i++) B.off.push({ dx: -i * arand(12, 19), dy: arand(-18, 18), ph: arand(TAU) });
    }
    if (B.next <= 0) B.next = arand(4, 9);   // 夜晚重试
  } else {
    B.x += B.vx * dt;
    if (B.x > WORLD.W + 140) { B.on = false; B.next = arand(20, 50); }
  }

  /* 房屋窗光点击脉冲衰减 */
  for (const h of WORLD.houses) h.flick *= Math.exp(-dt * 2.2);
}

/* ============================================================
 * 绘制（调用方已设置世界变换）
 * ============================================================ */

/* --- 水面流光：顺流高光种子（裁剪 polyline 两侧 55px）+ 潭面横向微光 --- */
function drawWater(g) {
  const c = DAY.cur, t = DYN.t, sm = WORLD.stream;

  g.save();
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = css(c.watH, 1);
  g.lineCap = 'round';

  /* 溪流（裁剪在 ±55px 带内，subtle additive） */
  g.save();
  ribbonOrganic(g, sm, WORLD.streamHalf);
  g.clip();
  for (const s of DYN.shimmer) {
    polyAt(sm, s.d, _pt);
    const ox = -_pt.ty * s.off * WORLD.streamHalf * 1.4;
    const oy = _pt.tx * s.off * WORLD.streamHalf * 1.4;
    const a = 0.07 + 0.06 * Math.sin(t * 1.7 + s.ph);
    if (a < 0.035) continue;
    g.globalAlpha = a;
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(_pt.x + ox - _pt.tx * s.len / 2, _pt.y + oy - _pt.ty * s.len / 2);
    g.lineTo(_pt.x + ox + _pt.tx * s.len / 2, _pt.y + oy + _pt.ty * s.len / 2);
    g.stroke();
  }
  /* 黄昏：溪面断续横向暖金反射条（天空倒影） */
  if (c.dusk > 0.05) {
    for (let i = 0; i < 26; i++) {
      const d = (i / 26) * sm.len + Math.sin(i * 3.7) * 20;
      polyAt(sm, d, _pt);
      const a = c.dusk * (0.10 + 0.07 * Math.sin(t * 0.9 + i * 1.7));
      if (a < 0.02) continue;
      g.globalAlpha = a;
      g.lineWidth = 1.8 + (i % 3) * 0.8;
      const len = 12 + (i % 4) * 9;
      g.beginPath();
      g.moveTo(_pt.x - len / 2, _pt.y + Math.sin(i) * 3);
      g.lineTo(_pt.x + len / 2, _pt.y + Math.sin(i) * 3 + 1);
      g.stroke();
    }
  }
  g.restore();

  /* 水潭（有机轮廓裁剪）：横向微光 + 黄昏碎金 */
  const p = WORLD.pond;
  g.save();
  pondPath(g, -8);
  g.clip();
  g.lineWidth = 2;
  for (const s of DYN.pondShim) {
    const a = 0.06 + 0.05 * Math.sin(t * 1.1 + s.ph);
    if (a < 0.028) continue;
    g.globalAlpha = a;
    const px = p.x + s.x * p.rx + Math.sin(t * 0.3 + s.ph) * s.sp;
    const py = p.y + s.y * p.ry;
    g.beginPath(); g.moveTo(px - s.len / 2, py); g.lineTo(px + s.len / 2, py); g.stroke();
  }
  if (c.dusk > 0.05) {
    for (let i = 0; i < 26; i++) {
      const px = p.x - p.rx * 0.85 + (i / 26) * p.rx * 1.6 + Math.sin(i * 2.9) * 16;
      const py = p.y - p.ry * 0.62 + ((i * 37) % 100) / 100 * p.ry * 1.1;
      const a = c.dusk * (0.09 + 0.06 * Math.sin(t * 0.8 + i * 2.3)) * (1.15 - i / 30);
      if (a < 0.02) continue;
      g.globalAlpha = a;
      g.lineWidth = 2 + (i % 3);
      const len = 26 + (i % 5) * 16;
      g.beginPath(); g.moveTo(px - len / 2, py); g.lineTo(px + len / 2, py + 1); g.stroke();
    }
  }
  g.restore();

  g.restore();
  g.globalAlpha = 1;
}

/* --- 瀑布：两级配准矩形内水幕滚动亮丝 + 底部溅沫 + 泡沫环 --- */
function drawFalls(g) {
  const t = DYN.t;

  g.save();
  g.globalCompositeOperation = 'lighter';
  g.lineCap = 'round';
  for (let r = 0; r < WORLD.falls.length; r++) {
    const R = WORLD.falls[r];
    const h = R.y1 - R.y0;
    g.save();
    g.beginPath(); g.rect(R.x0, R.y0, R.x1 - R.x0, h); g.clip();
    /* 纵向滚动亮丝 */
    const nL = 9;
    for (let i = 0; i < nL; i++) {
      const lx = R.x0 + 6 + (i / (nL - 1)) * (R.x1 - R.x0 - 12) + Math.sin(i * 5.1) * 3;
      const off = (t * 130 + i * 41) % (h + 60);
      const a = 0.10 + 0.08 * Math.sin(t * 5 + i * 2.1 + r * 2);
      if (a < 0.03) continue;
      g.strokeStyle = 'rgba(240,250,246,' + a + ')';
      g.lineWidth = 2.5 + (i % 3);
      g.beginPath();
      g.moveTo(lx, R.y0 + off - 26);
      g.lineTo(lx + Math.sin(t * 1.3 + i) * 2, R.y0 + off);
      g.stroke();
    }
    /* 顶部水缘一线亮 */
    g.strokeStyle = 'rgba(244,250,246,' + (0.10 + 0.05 * Math.sin(t * 2.2 + r)) + ')';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(R.x0 + 4, R.y0 + 6); g.lineTo(R.x1 - 4, R.y0 + 4); g.stroke();
    g.restore();
  }
  g.restore();

  /* 底部泡沫环（溅落池） */
  const fp = WORLD.fallsPool;
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 3; k++) {
    const frac = ((t * 0.9 + k * 0.33) % 1);
    g.strokeStyle = 'rgba(238,246,242,' + (0.20 * (1 - frac)) + ')';
    g.lineWidth = 2.2;
    g.beginPath();
    g.ellipse(fp.x, fp.y + 4, 8 + frac * 30, 4 + frac * 11, 0, 0, TAU);
    g.stroke();
  }
  g.fillStyle = 'rgba(240,246,242,' + (0.16 + 0.05 * Math.sin(t * 5)) + ')';
  g.beginPath();
  g.ellipse(fp.x, fp.y + 3, 16 + Math.sin(t * 5) * 2, 6.5, 0, 0, TAU);
  g.fill();
  /* 溅沫粒子 */
  for (const s of DYN.splash) {
    if (s.life <= 0) continue;
    g.globalAlpha = 0.5 * (s.life / s.max);
    g.fillStyle = '#eef4f0';
    g.fillRect(s.x, s.y, 2, 2);
  }
  g.restore();
  g.globalAlpha = 1;
}

/* --- 涟漪（3 圈衰减） --- */
function drawRipples(g) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.lineWidth = 1.8;
  for (const r of DYN.ripples) {
    if (r.life <= 0) continue;
    const k = r.life / r.max;
    g.strokeStyle = css(DAY.cur.watH, 0.32 * (1 - k));
    g.beginPath();
    g.ellipse(r.x, r.y, r.r, r.r * 0.42, 0, 0, TAU);
    g.stroke();
  }
  g.restore();
}

/* --- 鱼（水潭微小剪影） --- */
function drawFish(g) {
  g.fillStyle = 'rgba(26,40,40,0.5)';
  for (const f of WORLD.fish) {
    const dx = Math.cos(f.a) * f.speed, dy = Math.sin(f.a) * f.speed * 0.5;
    const ang = Math.atan2(dy, dx) + Math.sin(f.wig * 2) * 0.25;
    g.save();
    g.translate(f.x, f.y);
    g.rotate(ang);
    g.beginPath();
    g.ellipse(0, 0, f.len * 0.5, f.len * 0.17, 0, 0, TAU);
    g.moveTo(-f.len * 0.45, 0);
    g.lineTo(-f.len * 0.78, -f.len * 0.2);
    g.lineTo(-f.len * 0.78, f.len * 0.2);
    g.closePath();
    g.fill();
    g.restore();
  }
}

/* --- 炊烟（轻、软、快散；V4.7 不透明度 ×1.3、体积 ×1.4，仍是薄烟；
 *      白天/黄昏都要依稀可见） --- */
function drawSmoke(g) {
  const c = DAY.cur;
  const vis = 0.17 + c.dusk * 0.09 + c.night * 0.06;
  const col = mixc([228, 225, 214], c.skyB, 0.35);
  for (const s of DYN.smoke) {
    if (s.life <= 0) continue;
    const k = s.life / s.max;
    const a = vis * Math.sin(Math.min(1, (1 - k) * 4) * Math.PI * 0.5) * k;
    if (a < 0.008) continue;
    g.fillStyle = css(col, a);
    g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fill();
    g.fillStyle = css(col, a * 0.6);
    g.beginPath(); g.arc(s.x - s.r * 0.5, s.y - s.r * 0.35, s.r * 0.65, 0, TAU); g.fill();
  }
}

/* --- 薄雾带（瀑布底常年轻雾 + 清晨潭面/溪面） --- */
function drawMist(g) {
  const c = DAY.cur, t = DYN.t;
  const col = mixc([240, 240, 235], c.skyB, 0.45);
  for (const m of WORLD.mistBands) {
    const base = m.always ? 0.08 + c.fog * 0.25 : c.fog * 0.5;
    if (base < 0.02) continue;
    const a = base * (0.6 + 0.4 * Math.sin(t * 0.13 + m.ph));
    const x = m.x + Math.sin(t * 0.05 + m.ph) * 40;
    const gr = g.createRadialGradient(x, m.y, 0, x, m.y, m.w / 2);
    gr.addColorStop(0, css(col, a));
    gr.addColorStop(1, css(col, 0));
    g.fillStyle = gr;
    g.save(); g.translate(x, m.y); g.scale(1, m.h / m.w); g.translate(-x, -m.y);
    g.beginPath(); g.arc(x, m.y, m.w / 2, 0, TAU); g.fill();
    g.restore();
  }
}

/* --- 漂浮微粒 --- */
function drawMotes(g) {
  const c = DAY.cur, t = DYN.t;
  const a0 = 0.16 * (1 - c.night * 0.8) * (0.5 + c.dusk * 0.8);
  if (a0 < 0.02) return;
  g.fillStyle = css(mixc([255, 233, 192], c.watH, 0.2), 1);
  for (const m of DYN.motes) {
    g.globalAlpha = a0 * (0.5 + 0.5 * Math.sin(t * 0.8 + m.ph));
    g.fillRect(m.x, m.y, 1.6, 1.6);
  }
  g.globalAlpha = 1;
}

/* --- 鸟群剪影（y∈[150,400] 掠过） --- */
function drawBirds(g) {
  const B = DYN.birds;
  if (!B.on) return;
  g.strokeStyle = 'rgba(44,36,28,0.75)';
  g.lineWidth = 2.2; g.lineCap = 'round';
  const t = DYN.t;
  for (const o of B.off) {
    const x = B.x + o.dx, y = B.y + o.dy + Math.sin(t * 1.1 + o.ph) * 4;
    const w = Math.sin(t * 9 + o.ph) * 4;
    g.beginPath();
    g.moveTo(x - 6.5, y + w);
    g.quadraticCurveTo(x - 2, y - 1.2, x, y);
    g.quadraticCurveTo(x + 2, y - 1.2, x + 6.5, y + w);
    g.stroke();
  }
}

/* --- 溪流漂叶（小椭圆叶色块顺流漂移，两端淡入淡出） --- */
function drawDriftLeaves(g) {
  const sm = WORLD.stream, t = DYN.t;
  for (const l of DYN.driftLeaves) {
    const fade = smoothstep(0, 30, l.d) * (1 - smoothstep(sm.len - 60, sm.len - 12, l.d));
    if (fade < 0.03) continue;
    polyAt(sm, l.d, _pt);
    const ox = -_pt.ty * l.off * WORLD.streamHalf * 1.2;
    const oy = _pt.tx * l.off * WORLD.streamHalf * 1.2;
    g.save();
    g.translate(_pt.x + ox, _pt.y + oy + Math.sin(t * 1.6 + l.ph) * 1.2);
    g.rotate(l.rot + Math.sin(t * 0.9 + l.ph) * 0.3);
    g.globalAlpha = 0.8 * fade;
    g.fillStyle = l.col;
    g.beginPath(); g.ellipse(0, 0, 3.6, 1.9, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(40,36,20,0.35)';
    g.beginPath(); g.ellipse(0.4, 0.3, 2.6, 1.2, 0, 0, TAU); g.fill();
    g.restore();
  }
  g.globalAlpha = 1;
}

/* ============================================================
 * 绳秋千（挂在大树左侧低垂枝）：程序绘制双绳 + 小木座
 * 单摆缓动、幅度极小；空挂时随风/树 sway 轻晃；
 * 居民乘坐时摆幅略增（residents.js 调度 rider）
 * ============================================================ */
const SWING = {
  isSwing: true,
  sortY: 532,               // 紧跟大树（ay=525）之后绘制
  rider: null,
  theta: 0, osc: 0, oscAmp: 0,
  _sy: 532,

  update(dt) {
    const t = DYN.t;
    /* 常驻微晃：空置 ~3.4° 振幅 / 2.6s 周期（无乘客也轻摆，V4.7 加大到可辨）；
     * 有乘坐者 ~6.5° */
    const target = this.rider ? 0.115 : 0.06;
    this.oscAmp += (target - this.oscAmp) * damp(this.rider ? 0.9 : 0.5, dt);
    this.osc += dt * TAU / 2.6;                    // 单摆周期 ~2.6s
    this.theta = this.oscAmp * Math.sin(this.osc)
      + 0.014 * noise1(t * 0.45 + 2.1)             // 随树 sway 轻晃
      + 0.006 * noise1(t * 1.15 + 5.3);
    /* 乘坐者跟随座位 */
    if (this.rider) {
      const s = WORLD.swing;
      this.rider.x = s.ax + Math.sin(this.theta) * s.rope;
      this.rider.y = s.ay + Math.cos(this.theta) * s.rope + 2;
    }
  },

  draw(g, t) {
    const s = WORLD.swing, th = this.theta;
    const dx = Math.sin(th), dy = Math.cos(th);
    const sx = s.ax + dx * s.rope, sy = s.ay + dy * s.rope;
    const px = dy, py = -dx;                        // 摆动平面内垂直向（座位宽方向）

    /* 地面落影（挂在半空，影在下方土台，随摆横移） */
    g.fillStyle = 'rgba(26,20,13,' + (this.rider ? 0.17 : 0.10) + ')';
    g.beginPath();
    g.ellipse(s.ax + dx * s.rope * 0.55, s.standY + 6, this.rider ? 13 : 10, 3.2, 0, 0, TAU);
    g.fill();

    /* 双绳（挂点略分开，落到座位两端）：暖棕加粗 + 受光侧微高光 */
    g.lineCap = 'round';
    for (const side of [-1, 1]) {
      const x0 = s.ax + side * 3.4, y0 = s.ay;
      const x1 = sx + side * (s.seatW / 2) * px, y1 = sy + side * (s.seatW / 2) * py;
      g.strokeStyle = 'rgba(107,74,47,0.95)';
      g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.strokeStyle = 'rgba(232,202,152,0.38)';
      g.lineWidth = 0.7;
      g.beginPath(); g.moveTo(x0 - 0.5, y0); g.lineTo(x1 - 0.5, y1); g.stroke();
    }
    /* 绳在挂点处一小段缠绕枝干的深色 */
    g.strokeStyle = 'rgba(64,46,30,0.95)';
    g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(s.ax - 5.5, s.ay - 1.2); g.lineTo(s.ax + 5.5, s.ay - 1.8); g.stroke();

    /* 木座（近乎水平，随摆微倾；暖木带厚度，上缘亮线） */
    g.save();
    g.translate(sx, sy);
    g.rotate(-th * 0.55);
    g.fillStyle = '#7a5636';
    g.beginPath(); g.roundRect(-s.seatW / 2 - 2.5, -2.2, s.seatW + 5, 4.4, 1.8); g.fill();
    g.fillStyle = 'rgba(46,32,20,0.5)';
    g.beginPath(); g.roundRect(-s.seatW / 2 - 2.5, 0.9, s.seatW + 5, 1.3, 0.6); g.fill();
    g.fillStyle = 'rgba(228,198,148,0.5)';
    g.beginPath(); g.roundRect(-s.seatW / 2 - 2.5, -2.2, s.seatW + 5, 1.5, 0.75); g.fill();
    g.restore();

    /* 乘坐者（坐秋千姿态，由 residents.drawVillager 绘制） */
    const r = this.rider;
    if (r) {
      g.save();
      g.translate(sx, sy - 1);
      g.rotate(-th * 0.4);
      g.globalAlpha = r.alpha;
      drawVillager(g, {
        h: r.h, tunic: r.tunic, skin: r.skin, hood: r.hood,
        phase: r.phase, t,
        walk: false, sit: false, chat: false, noticed: false,
        carry: false, lantern: false, swingSeat: true,
        facing: 1, seed: r.i
      });
      g.restore();
    }
  }
};

/* --- 落叶 --- */
function drawLeaves(g) {
  for (const l of DYN.leaves) {
    if (l.life <= 0) continue;
    const fade = l.life < 0.6 ? l.life / 0.6 : 1;
    g.save();
    g.translate(l.x, l.y);
    g.rotate(l.rot);
    g.globalAlpha = 0.85 * fade;
    g.fillStyle = '#a8a45e';
    g.beginPath(); g.ellipse(0, 0, 3.4, 1.8, 0, 0, TAU); g.fill();
    g.restore();
  }
  g.globalAlpha = 1;
}

/* --- 云影（大面积极低透明度，缓慢横移；调用方限桌面/平板） --- */
function drawCloudShadows(g) {
  const c = DAY.cur;
  const a = 0.05 * (1 - c.night);
  if (a < 0.012) return;
  g.fillStyle = 'rgba(30,36,44,' + a + ')';
  for (let i = 0; i < WORLD.clouds.length; i++) {
    const cl = WORLD.clouds[i];
    const x = ((cl.x + DYN.t * cl.v) % 2600) - 280;
    const y = 520 + i * 260;
    g.beginPath();
    g.ellipse(x, y, 300 * cl.s, 100 * cl.s, 0, 0, TAU);
    g.fill();
  }
}

/* --- 黄昏暖色光池（低角度阳光照亮的一块块地面，克制 additive） --- */
function drawLightPools(g) {
  const d = DAY.cur.dusk;
  if (d < 0.03) return;
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const p of WORLD.lightPools) {
    const a = d * 0.16;
    const layers = [[1, 0.16], [0.8, 0.18], [0.62, 0.2], [0.44, 0.23], [0.28, 0.26]];
    for (let k = 0; k < layers.length; k++) {
      const s = layers[k][0], aa = a * layers[k][1];
      g.fillStyle = 'rgba(255,' + (k < 3 ? 186 : 172) + ',' + (k < 3 ? 108 : 96) + ',' + aa + ')';
      blobPath(g,
        p.x + noise1(p.x * 0.01 + k * 3.1) * p.rx * 0.07,
        p.y + noise1(p.y * 0.013 + k * 2.3) * p.ry * 0.1,
        p.rx * s, p.ry * s, p.x * 0.01 + k * 0.77, 0.2, 18);
      g.fill();
    }
  }
  g.restore();
}

/* ============================================================
 * 辉光 pass（'lighter'，在昼夜色调之后绘制，不被 multiply 压暗）
 * 星 / 月 / 潭面月柱 / 窗灯·门灯（黄昏半亮、夜晚全亮呼吸）/
 * 提灯居民 / 萤火虫 / 黄昏天空暖洗 + 金色水光
 * ============================================================ */
function drawGlows(g) {
  const c = DAY.cur, t = DYN.t, night = c.night;
  /* 灯门控：t<0.40（白昼）灯笼/窗灯 glow 严格为 0；黄昏段（0.40→0.47）渐亮 */
  const tf = ((DAY.time / DAY.T) % 1 + 1) % 1;
  const lampGate = smoothstep(0.40, 0.47, tf);
  /* 窗灯/门灯亮度：黄昏提前半亮，夜晚全亮 */
  const gl = Math.max(night, c.dusk * 0.62) * lampGate;
  const warm = [255, 206, 163];

  const glow = (x, y, r, col, a) => {
    if (a < 0.015) return;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, css(col, a));
    gr.addColorStop(1, css(col, 0));
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  };

  /* 星空（y<280 区域，twinkle） */
  if (c.starA > 0.02) {
    for (let i = 0; i < WORLD.stars.length; i++) {
      const s = WORLD.stars[i];
      const a = c.starA * (0.28 + 0.55 * Math.abs(noise1(t * 0.7 + i * 1.37)));
      if (a < 0.05) continue;
      g.fillStyle = css([238, 236, 222], a);
      g.fillRect(s.x - 0.8, s.y - 0.8, s.r * 1.7, s.r * 1.7);
    }
  }

  /* 月亮 (1700,130)：盘面 + 光晕 */
  if (night > 0.22) {
    const ma = smoothstep(0.22, 0.6, night);
    glow(WORLD.moon.x, WORLD.moon.y, 130, [200, 212, 228], 0.15 * ma);
    g.fillStyle = css([235, 230, 214], 0.9 * ma);
    g.beginPath(); g.arc(WORLD.moon.x, WORLD.moon.y, 24, 0, TAU); g.fill();
    g.fillStyle = css([188, 186, 170], 0.5 * ma);
    g.beginPath();
    g.arc(WORLD.moon.x - 8, WORLD.moon.y - 6, 5.5, 0, TAU);
    g.arc(WORLD.moon.x + 9, WORLD.moon.y + 8, 4, 0, TAU);
    g.fill();
  }

  /* 黄昏天空暖洗（落日方向 = 左上，additive 极柔） */
  if (c.dusk > 0.05) {
    const gr = g.createRadialGradient(240, 240, 30, 240, 240, 720);
    gr.addColorStop(0, 'rgba(255,164,96,' + (0.20 * c.dusk * c.sun) + ')');
    gr.addColorStop(1, 'rgba(255,154,90,0)');
    g.fillStyle = gr;
    g.fillRect(-200, -60, 1200, 700);
  }

  if (gl >= 0.12) {
    /* 窗灯（逐个亮起 + 呼吸 + 点击脉冲） */
    for (const h of WORLD.houses) {
      for (const wn of h.windows) {
        let lit = smoothstep(wn.th, wn.th + 0.18, gl);
        if (lit <= 0.005) continue;
        lit *= 0.82 + 0.18 * Math.sin(t * 1.2 + wn.wx * 0.7);
        lit *= 1 + h.flick * 0.65 * Math.sin(t * 26);
        lit = clamp(lit, 0, 1);
        /* 窗芯：紧致柔光核 + 大晕（无硬边圆盘，融入插画墙面） */
        glow(wn.wx, wn.wy, 15, [255, 230, 184], lit * 0.85);
        glow(wn.wx, wn.wy, 58, warm, lit * 0.36);
      }
      /* 门口小暖光 */
      const dlit = smoothstep(0.28, 0.55, gl) * 0.55;
      glow(h.door.wx, h.door.wy - 8, 30, warm, dlit * 0.3);
    }
    /* 灯笼 ×3：黄昏逐个亮、夜晚全亮带呼吸（光晕半径/峰值较 V4.5 各降 ~40%） */
    for (const ln of WORLD.lanterns) {
      let lit = smoothstep(ln.th, ln.th + 0.16, gl);
      if (lit <= 0.005) continue;
      lit *= 0.8 + 0.2 * Math.sin(t * 1.6 + ln.x * 0.5);
      glow(ln.x, ln.y, 28, warm, lit * 0.30);
      glow(ln.x, ln.y, 7, [255, 234, 190], lit * 0.55);
    }
  }

  /* 提灯居民（夜晚移动暖光点） */
  if (typeof RES !== 'undefined') {
    const lp = RES.lanternLight();
    if (lp && night > 0.4) {
      const sway = Math.sin(t * 1.8) * 2;
      glow(lp.x + sway, lp.y, 52, warm, 0.42 * (0.85 + 0.15 * Math.sin(t * 2.3)));
      glow(lp.x + sway, lp.y, 9, [255, 234, 190], 0.85);
    }
  }

  /* 黄昏金色水光（additive：反射落日的水面发光，不被 multiply 压暗） */
  if (c.dusk > 0.2) {
    const d = c.dusk, sm = WORLD.stream;
    const gold = [255, 196, 110];
    const pt = { x: 0, y: 0, tx: 0, ty: 0 };
    g.save();
    ribbonOrganic(g, sm, WORLD.streamHalf);
    g.clip();
    g.strokeStyle = css(gold, 1); g.lineCap = 'round';
    for (let i = 0; i < 20; i++) {
      polyAt(sm, (i / 20) * sm.len + Math.sin(i * 4.1) * 16, pt);
      const a = d * (0.08 + 0.06 * Math.sin(t * 1.1 + i * 2.2));
      if (a < 0.02) continue;
      g.globalAlpha = a;
      g.lineWidth = 2 + (i % 3) * 0.9;
      const len = 14 + (i % 4) * 9;
      g.beginPath();
      g.moveTo(pt.x - len / 2, pt.y + Math.sin(i) * 2.5);
      g.lineTo(pt.x + len / 2, pt.y + Math.sin(i) * 2.5 + 1);
      g.stroke();
    }
    g.restore();
    g.globalAlpha = 1;
    /* 水潭：左半面大反射光斑（向落日方向） */
    const p = WORLD.pond;
    g.save();
    pondPath(g, -10);
    g.clip();
    glow(p.x - p.rx * 0.42, p.y - p.ry * 0.28, p.rx * 0.6, gold, d * 0.10);
    g.restore();
    /* 瀑布水幕暖反光（主级） */
    const R = WORLD.falls[1];
    glow((R.x0 + R.x1) / 2 - 6, (R.y0 + R.y1) / 2, (R.x1 - R.x0) * 0.9, [255, 214, 150], d * 0.08);
    /* 树冠受光侧暖辉 */
    const H = WORLD.tree.hit;
    glow(H.x - 90, H.y - 60, 210, [255, 200, 120], d * 0.08);
  }

  /* 萤火虫（暖绿微光） */
  if (night > 0.55) {
    const fcol = [216, 230, 154];
    const fa = smoothstep(0.55, 0.8, night);
    for (const f of DYN.flies) {
      const blink = Math.pow(Math.max(0, Math.sin(t * f.fq * 2 + f.ph)), 3);
      const a = blink * fa;
      if (a < 0.03) continue;
      glow(f.x, f.y, 9, fcol, a * 0.5);
      g.fillStyle = css([240, 248, 200], a);
      g.fillRect(f.x - 0.8, f.y - 0.8, 1.6, 1.6);
    }
  }

  /* 潭面月柱倒影（x≈1450，纵向微光带） */
  if (night > 0.3) {
    const p = WORLD.pond;
    const ma = smoothstep(0.3, 0.75, night);
    g.save();
    pondPath(g, -12);
    g.clip();
    /* 柔光柱体（径向渐变压扁，无硬边） */
    g.save();
    g.translate(1450, p.y - 6);
    g.scale(1, 3.6);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 30);
    gr.addColorStop(0, css([184, 200, 220], 0.11 * ma * (0.85 + 0.15 * Math.sin(t * 0.9))));
    gr.addColorStop(1, css([184, 200, 220], 0));
    g.fillStyle = gr;
    g.beginPath(); g.arc(0, 0, 30, 0, TAU); g.fill();
    g.restore();
    /* 月柱碎光（断续短划，摇曳） */
    g.strokeStyle = css([200, 214, 230], 1); g.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const py = p.y - p.ry * 0.62 + i * p.ry * 0.135;
      const a = 0.09 * ma * (0.4 + 0.6 * Math.abs(Math.sin(t * 1.3 + i * 2.4)));
      if (a < 0.02) continue;
      g.globalAlpha = a;
      g.lineWidth = 1.8;
      const len = (10 + (i % 3) * 8) * (1 - Math.abs(i - 4.5) / 7);
      g.beginPath(); g.moveTo(1450 - len / 2, py); g.lineTo(1450 + len / 2, py); g.stroke();
    }
    g.restore();
    g.globalAlpha = 1;
  }
}
