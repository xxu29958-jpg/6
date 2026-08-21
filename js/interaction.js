'use strict';
/* ============================================================
 * interaction.js — 克制优雅的交互 + 环境控件 + 程序化音频
 * pointer 视差 / 点水涟漪鱼散 / 点树摇落 / 点房探头
 * 点居民推近 / 拖动平移回弹 / 双指缩放 clamp
 * ============================================================ */

const INPUT = {
  pointers: new Map(),
  downX: 0, downY: 0, downT: 0, moved: false,
  pinchD0: 0, pinchStart: 1
};

function handleClick(px, py, cam) {
  const w = cam.screenToWorld(px, py);

  /* 居民：镜头推近 + 停下看镜头 */
  const r = RES.residentAt(w.x, w.y);
  if (r) {
    cam.focusResident(r);
    RES.notice(r);
    return;
  }

  /* 房屋：窗光脉冲 + 门口居民探头（判定矩形 = compiled footprint + 交互边距） */
  for (const h of COMPILED.entitiesByTag('house')) {
    const fp = h.footprintWorld;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of fp) {
      if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0];
      if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1];
    }
    if (w.x > x0 - 12 && w.x < x1 + 12 && w.y > y0 - 14 && w.y < y1 + 10) {
      RES.peek(h.id);
      return;
    }
  }

  /* 大树：sway 冲量 + 偶尔落叶（树冠判定圆 = canopy socket world） */
  const T = COMPILED.socketOf('tree', 'canopy');
  if (Math.hypot(w.x - T.x, w.y - T.y) < T.r) {
    treeNudge();
    return;
  }

  /* 水面：涟漪 + 鱼散（水几何 authority = compiled waters；
   * 溪带判定半宽 = behaviour.interaction.streamClickHalf，交互参数不属水物理） */
  const p = COMPILED.waterById('pond');
  const pe = ((w.x - p.x) / p.rx) ** 2 + ((w.y - p.y) / p.ry) ** 2;
  if (pe < 1.05) {
    spawnRipple(w.x, w.y, true);
    fishScatter(w.x, w.y);
    return;
  }
  const stream = COMPILED.waterById('stream');
  const streamHalf = (typeof BEHAVIOUR_XIGU !== 'undefined' &&
    BEHAVIOUR_XIGU.interaction && BEHAVIOUR_XIGU.interaction.streamClickHalf) || 60;
  if (distToPoly(w.x, w.y, stream.pts) < streamHalf) {
    spawnRipple(w.x, w.y, false);
    return;
  }

  /* 空白：镜头缓回 */
  cam.clearFocus();
}

function initInteraction(canvas, cam) {
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    INPUT.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (INPUT.pointers.size === 1) {
      INPUT.downX = e.clientX; INPUT.downY = e.clientY;
      INPUT.downT = performance.now();
      INPUT.moved = false;
      cam.dragging = false;
    } else if (INPUT.pointers.size === 2) {
      /* 进入 pinch */
      const ps = [...INPUT.pointers.values()];
      INPUT.pinchD0 = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) || 1;
      INPUT.pinchStart = cam.pinchT;
      INPUT.moved = true;
      cam.dragging = false;
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    /* 视差（始终跟随） */
    cam.parTX = (e.clientX / cam.vw) * 2 - 1;
    cam.parTY = (e.clientY / cam.vh) * 2 - 1;

    if (!INPUT.pointers.has(e.pointerId)) return;
    const prev = INPUT.pointers.get(e.pointerId);
    INPUT.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (INPUT.pointers.size === 2) {
      const ps = [...INPUT.pointers.values()];
      const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) || 1;
      cam.pinchT = clamp(INPUT.pinchStart * d / INPUT.pinchD0, 0.85, 1.3);
      return;
    }

    if (INPUT.pointers.size === 1) {
      const dx = e.clientX - INPUT.downX, dy = e.clientY - INPUT.downY;
      if (!INPUT.moved && Math.hypot(dx, dy) > 7) {
        INPUT.moved = true;
        cam.dragging = true;
        INPUT.dragBaseX = cam.dragX; INPUT.dragBaseY = cam.dragY;
      }
      if (cam.dragging) {
        cam.setDrag(
          (INPUT.dragBaseX || 0) + dx / cam.zoom,
          (INPUT.dragBaseY || 0) + dy / cam.zoom
        );
      }
    }
  });

  const endPointer = (e) => {
    const wasDragging = cam.dragging;
    INPUT.pointers.delete(e.pointerId);
    if (INPUT.pointers.size < 2) INPUT.pinchD0 = 0;
    if (INPUT.pointers.size === 0) {
      cam.dragging = false;      // 松手：弹簧回弹
      const quick = performance.now() - INPUT.downT < 500;
      if (!INPUT.moved && !wasDragging && quick) {
        handleClick(e.clientX, e.clientY, cam);
      }
    }
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  /* 桌面触控板捏合（ctrl+wheel） */
  canvas.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    cam.pinchT = clamp(cam.pinchT * (e.deltaY > 0 ? 0.94 : 1.06), 0.85, 1.3);
  }, { passive: false });

  /* 离开窗口时视差归零 */
  window.addEventListener('blur', () => { cam.parTX = 0; cam.parTY = 0; });

  initControls();
}

/* ============================================================
 * 右下角 3 个极小控件：声音 / 昼夜快进 / 全屏
 * ============================================================ */
function initControls() {
  const btnSound = document.getElementById('btnSound');
  const btnTime = document.getElementById('btnTime');
  const btnFull = document.getElementById('btnFull');

  btnSound.addEventListener('click', () => {
    const on = SOUND.toggle();
    btnSound.classList.toggle('on', on);
  });
  btnTime.addEventListener('click', () => DAY.skip());
  btnFull.addEventListener('click', () => {
    try {
      /* 跨域 iframe（预览/嵌入环境）下全屏被 Permissions-Policy 拒绝：
         requestFullscreen 返回的 Promise 会 reject，try/catch 接不住异步拒绝，
         必须显式 .catch，否则控制台抛 Unhandled Promise Rejection */
      if (document.fullscreenElement) {
        const p = document.exitFullscreen();
        if (p && p.catch) p.catch(() => {});
      } else {
        const p = document.documentElement.requestFullscreen();
        if (p && p.catch) p.catch(() => {});
      }
    } catch (err) { /* 忽略 */ }
  });
}

/* ============================================================
 * WebAudio 程序化音景：溪流白噪 + 偶发鸟鸣（默认关）
 * ============================================================ */
const SOUND = {
  on: false, ctx: null, master: null,
  birdT: 5,

  toggle() {
    this.on = !this.on;
    if (this.on) {
      if (!this.ctx) this._build();
      if (!this.ctx) { this.on = false; return false; }
      const rp = this.ctx.resume(); if (rp && rp.catch) rp.catch(() => {});
      this.master.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.8);
    } else if (this.ctx) {
      this.master.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.4);
    }
    return this.on;
  },

  _build() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = this.ctx = new AC();
      const master = this.master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);

      /* 噪声缓冲 */
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      /* 溪流主体：低通白噪 */
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 780; lp.Q.value = 0.6;
      const g1 = ctx.createGain(); g1.gain.value = 0.075;
      src.connect(lp); lp.connect(g1); g1.connect(master);
      src.start();

      /* 潺潺层：带通 + 缓慢 LFO */
      const src2 = ctx.createBufferSource();
      src2.buffer = buf; src2.loop = true; src2.playbackRate.value = 0.7;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 330; bp.Q.value = 2.2;
      const g2 = ctx.createGain(); g2.gain.value = 0.05;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
      const lfoG = ctx.createGain(); lfoG.gain.value = 120;
      lfo.connect(lfoG); lfoG.connect(bp.frequency);
      src2.connect(bp); bp.connect(g2); g2.connect(master);
      src2.start(); lfo.start();
    } catch (err) {
      this.ctx = null;
    }
  },

  /* 偶发鸟鸣（白天）；主循环驱动 */
  update(dt) {
    if (!this.on || !this.ctx || this.ctx.state !== 'running') return;
    if (DAY.cur.night > 0.4) return;
    this.birdT -= dt;
    if (this.birdT > 0) return;
    this.birdT = 6 + Math.random() * 14;
    try {
      const ctx = this.ctx, t0 = ctx.currentTime + 0.05;
      const rep = 2 + Math.floor(Math.random() * 2);
      const base = 2100 + Math.random() * 900;
      for (let i = 0; i < rep; i++) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const ts = t0 + i * 0.19;
        o.frequency.setValueAtTime(base + Math.random() * 300, ts);
        o.frequency.exponentialRampToValueAtTime(base * 0.72, ts + 0.1);
        g.gain.setValueAtTime(0, ts);
        g.gain.linearRampToValueAtTime(0.028, ts + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, ts + 0.13);
        o.connect(g); g.connect(this.master);
        o.start(ts); o.stop(ts + 0.15);
      }
    } catch (err) { /* 忽略 */ }
  }
};
