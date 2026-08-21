'use strict';
/* ============================================================
 * residents.js — 微小居民状态机 + 手绘小人绘制（V4.8：只消费 compiled world）
 * idle 停留观察 → walk 沿土径 → pause 看水/树 → carry 搬运
 * → chat 两人相遇短聊 → home 回家/出屋；桥边常驻 1 人坐看水
 * 夜晚：室外 3~4 人（1 人提灯），其余回家
 * 绘制：小斗篷/罩袍式身形（圆弧 path + 受光侧轻提亮），身高 ≈26 world px
 *
 * V4.8：物理查询（节点/路线/水面/秋千落点/坐姿点/房屋门窗）全部来自
 * COMPILED（maps/xigu/map.js 编译产物）；路由 = 手写 Dijkstra（无 BFS）；
 * onBridge 布尔物理删除，改由当前 route segment 的 deck 成员推导（_deck）。
 * 地图侧行为参数在 maps/xigu/behaviour.js（BH）。
 * V4.9 运行期不变量：snap-to-node / final 直线段在产生前过 compile 级
 * validateRoute——非法段根本不会成为路线（不是「走一半被发现」）；
 * 被拦截时 console.error + 合法传送兜底（目标点均经 compile 校验）。
 * ============================================================ */

const BH = (typeof BEHAVIOUR_XIGU !== 'undefined') ? BEHAVIOUR_XIGU : null;

/* 运行期段校验：throw → 拦截 + 报错；返回 false 由调用方做合法兜底 */
function validatedSeg(pts, label) {
  try { WC.validation.validateRoute(COMPILED, pts, label); return true; }
  catch (e) { console.error('[residents] 非法段已拦截: ' + e.message); return false; }
}

const RES = {
  list: [],
  nightMode: false,
  chatCd: 6,
  swingT: 8,          // 秋千首次乘坐倒计时（之后每 10~18s 偶发，V4.7 频率×2）
  houseState: {}      // 房屋运行时态 {id: {peekT, flick}}（位置权威在 compiled）
};

/* 秋千上下点（stand socket world；不再隐含 standX==ax 的巧合） */
function swingStand() { return COMPILED.socketOf(BH.swing.entity, BH.swing.standSocket); }

/* 降饱和、贴场景的斗篷配色：灰苔绿/灰砖红/灰藏青/灰米白/灰李/灰橄榄/灰青
 * 明度压到接近周围草地与土径——缩略看融入环境，细看才发现 */
const TUNICS = ['#6d795c', '#8d6a59', '#5b6578', '#a8a193', '#736371', '#76725c', '#5e7970'];
const SKINS = ['#c9a37f', '#b99575', '#d3af88'];

class Resident {
  constructor(i) {
    this.i = i;
    this.isRes = true;
    this.h = 24 + (i * 37 % 9) * 0.45;                  // 24~28 世界单位高
    this.tunic = TUNICS[i % TUNICS.length];
    this.skin = SKINS[i % SKINS.length];
    this.hood = shade(this.tunic, -34);                 // 兜帽暗部 = 斗篷同色系压暗
    this.home = BH.homes[i % BH.homes.length];          // 家节点（磨坊/右屋/左屋）
    const nk = Object.keys(COMPILED.nav.nodes);
    this.node = nk[(i * 5 + 2) % nk.length];
    const n = COMPILED.nav.nodes[this.node];
    this.x = n.x + arand(-8, 8); this.y = n.y + arand(-6, 6);
    this.state = 'idle';
    this.timer = arand(1, 14);                          // 错峰
    this.route = null; this.ri = 0; this.dest = null;
    this.speed = arand(BH.walk.speed[0], BH.walk.speed[1]);
    this.phase = arand(TAU);
    this.facing = arng() < 0.5 ? 1 : -1;
    this.alpha = 1;
    this.carry = false;
    this.sitter = false;
    this.sitT = arand(BH.sit.reSit[0], BH.sit.reSit[1]);
    this.chatT = 0; this.partner = null;
    this.rideT = 0;
    this.noticedT = 0;
    this.goingHome = false;
    this.exitDelay = 0;
    this._deck = false;       // 当前 route segment 是否 deck 成员边（compile 推导）
    this.hops = [];           // 多跳路由：待走节点队列
    this.final = null;        // 到达末节点后的最后一段直线 {x,y,state}
    this._sy = 0;
  }

  startWalk(dest, gohome) {
    const from = this.node;
    const key = from + '>' + dest;
    let pts = COMPILED.nav.routeOf[key];
    if (!pts) {
      pts = COMPILED.nav.routeOf[dest + '>' + from];
      if (!pts) return false;
      pts = pts.slice().reverse();
    }
    this.route = pts; this.ri = 1;
    this.dest = dest; this.goingHome = !!gohome;
    /* 桥面绘制序 = 当前边是否为 deck 成员边（>50% 路线长在 deck surface 上，
     * 由 compile 自 surfaces 推导；引道段正常 Y-sort） */
    const e = COMPILED.nav.edgeMap[from + '>' + dest];
    this._deck = !!(e && e.isDeck);
    this.carry = !gohome && arng() < BH.walk.carryProb;
    this.state = 'walk';
    return true;
  }

  /* 沿路网到目标节点（手写 Dijkstra 最短路），可选最后一段直线 */
  routeTo(goal, final, gohome) {
    /* V4.9 snap 不变量：snap 目标 = 距离升序首个「直线段过 validateRoute」的节点
     * （纯最近节点可能隔着崖带/屋墙）；全部候选非法 → 传送到最近节点
     * （合法点，compile 校验过），任何情况下非法直线都不会成为 route。 */
    const cands = Object.keys(COMPILED.nav.nodes)
      .map(id => ({ id: id, n: COMPILED.nav.nodes[id] }))
      .sort((p, q) => Math.hypot(p.n.x - this.x, p.n.y - this.y) - Math.hypot(q.n.x - this.x, q.n.y - this.y));
    let near = cands[0].id, nn = cands[0].n, snapped = false;
    for (const cand of cands) {
      if (Math.hypot(cand.n.x - this.x, cand.n.y - this.y) <= 6 ||
          validatedSeg([[this.x, this.y], [cand.n.x, cand.n.y]], 'snap>' + cand.id)) {
        near = cand.id; nn = cand.n; snapped = true; break;
      }
    }
    if (!snapped) {
      console.error('[residents] 无合法 snap 候选，合法传送兜底 → ' + near);
      this.x = nn.x; this.y = nn.y;
    }
    const sp = WC.navigation.dijkstra(COMPILED.nav, near, goal);
    this.hops = sp ? sp.path.slice(1) : [];
    this.final = final || null;
    this.goingHome = !!gohome;
    if (Math.hypot(nn.x - this.x, nn.y - this.y) > 6) {
      this.route = [[this.x, this.y], [nn.x, nn.y]];   // 已验证合法的 snap 段
      this.ri = 1; this.dest = near; this._deck = false; this.carry = false;
      this.state = 'walk';
    } else if (this.hops.length) {
      this.node = near;
      this.startWalk(this.hops.shift(), gohome);
    } else {
      this.node = near;
      this.beginFinal();
    }
  }

  beginFinal() {
    if (!this.final) return;
    const f = this.final; this.final = null;
    /* final 直线段同样先过 validateRoute；被拦截 → 传送到 final 终点
     * （zone/socket 终点经 compile 期 extraRoutes 校验为合法可达） */
    if (!validatedSeg([[this.x, this.y], [f.x, f.y]], 'final>' + (f.state || 'point'))) {
      this.x = f.x; this.y = f.y;
    }
    this.route = [[this.x, this.y], [f.x, f.y]];
    this.ri = 1; this.dest = null; this._deck = false; this.carry = false;
    this.finalState = f.state;
    this.state = 'walk';
  }

  update(dt, t) {
    const night = DAY.cur.night;
    switch (this.state) {

      case 'inside':
        this.alpha = Math.max(0, this.alpha - dt * 2);
        if (!RES.nightMode && night < 0.3) {
          this.exitDelay -= dt;
          if (this.exitDelay <= 0) {
            const dn = COMPILED.nav.nodes[this.home];
            this.x = dn.x; this.y = dn.y; this.node = this.home;
            this.state = 'exit';
          }
        }
        break;

      case 'exit':
        this.alpha = Math.min(1, this.alpha + dt * 1.4);
        if (this.alpha >= 1) { this.state = 'idle'; this.timer = arand(2, 8); }
        break;

      case 'idle': {
        this.timer -= dt;
        if (this.timer > 0) break;
        if (this.sitter && !RES.nightMode) {
          /* 坐姿者先沿路网走回桥西节点，再走最后一段直线上岸 */
          const s = COMPILED.zones[BH.sit.zone];
          this.routeTo(BH.sit.goal, { x: s.x, y: s.y, state: 'sitprep' });
          break;
        }
        const opts = COMPILED.nav.adj[this.node];
        if (!opts || !opts.length) { this.timer = 3; break; }
        let dest = opts[Math.floor(arng() * opts.length)];
        if (opts.length > 1) { let g = 0; while (dest === this.lastNode && g++ < 4) dest = opts[Math.floor(arng() * opts.length)]; }
        this.lastNode = this.node;
        if (!this.startWalk(dest, false)) this.timer = 2;
        break;
      }

      case 'sit': {
        this.sitT -= dt;
        if (RES.nightMode) { this.state = 'idle'; this._deck = false; this.timer = 0.1; break; }
        if (this.sitT <= 0) {
          this.sitT = arand(40, 90);
          this.state = 'idle'; this._deck = false; this.timer = arand(4, 10);
        }
        break;
      }

      case 'walk': {
        const p = this.route[this.ri];
        if (!p) { this.arrive(); break; }
        if (this.walkToward(p[0], p[1], dt)) this.ri++;
        break;
      }

      case 'swing': {
        /* 位置由 SWING.update 跟随座位；荡 rideT 秒后离开（落在秋千台节点 S） */
        this.rideT -= dt;
        if (this.rideT <= 0 || RES.nightMode) {
          if (SWING.rider === this) SWING.rider = null;
          const st = swingStand();
          this.x = st.x; this.y = st.y;
          this.node = BH.swing.node;
          this.state = 'idle'; this.timer = arand(3, 8);
        }
        break;
      }

      case 'pause':
        this.timer -= dt;
        if (this.timer <= 0) { this.state = 'idle'; this.timer = arand(0.5, 4); }
        break;

      case 'chat':
        this.chatT -= dt;
        if (this.chatT <= 0) {
          this.state = 'idle'; this.timer = arand(1, 5);
          if (this.partner && this.partner.state === 'chat') {
            this.partner.state = 'idle'; this.partner.timer = arand(1.5, 6);
            this.partner.partner = null;
          }
          this.partner = null;
        }
        break;

      case 'noticed':
        this.noticedT -= dt;
        if (this.noticedT <= 0) {
          this.state = 'idle'; this.timer = arand(2, 6);
        }
        break;

      case 'entering':
        this.alpha = Math.max(0, this.alpha - dt * 1.6);
        if (this.alpha <= 0) {
          this.state = 'inside';
          this.exitDelay = arand(0, 18);
        }
        break;
    }
  }

  /* 返回 true = 到达 */
  walkToward(tx, ty, dt) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 1.6) return true;
    const sp = this.speed * (0.85 + 0.15 * Math.sin(this.i + DYN.t * 0.5));
    this.x += dx / d * sp * dt;
    this.y += dy / d * sp * dt;
    this.phase += dt * sp * 0.85;
    if (Math.abs(dx) > 0.5) this.facing = dx > 0 ? 1 : -1;
    return false;
  }

  arrive() {
    if (this.dest) this.node = this.dest;
    this.dest = null;
    this.route = null; this._deck = false;
    /* 多跳路由：继续下一跳 / 转入最后一段直线 */
    if (this.hops.length) { this.startWalk(this.hops.shift(), this.goingHome); return; }
    if (this.final) { this.beginFinal(); return; }
    if (this.finalState) {
      const fs = this.finalState; this.finalState = null;
      if (fs === 'sitprep') {
        const s = COMPILED.zones[BH.sit.zone];
        this.facing = s.dir[0] >= 0 ? 1 : -1;
        this.state = 'sit'; this.sitT = arand(BH.sit.sitRange[0], BH.sit.sitRange[1]);
      } else if (fs === 'swingstart') {
        if (RES.nightMode || (SWING.rider && SWING.rider !== this)) { this.state = 'idle'; this.timer = arand(3, 8); }
        else { this.state = 'swing'; SWING.rider = this; this.rideT = arand(BH.swing.ride[0], BH.swing.ride[1]); this.facing = 1; }
      } else { this.state = 'idle'; this.timer = arand(2, 5); }
      return;
    }
    if (this.goingHome) { this.state = 'entering'; this.goingHome = false; return; }
    const n = COMPILED.nav.nodes[this.node];
    if (n.face) {
      this.facing = n.face[0] >= 0 ? 1 : -1;
      this.state = 'pause'; this.timer = arand(4, 10);
    } else {
      this.state = arng() < 0.4 ? 'pause' : 'idle';
      this.timer = arand(3, 9);
    }
  }

  notice() {
    if (this.state === 'inside' || this.state === 'entering') return;
    if (this.state === 'swing') {                 // 从秋千上下来再看镜头
      if (SWING.rider === this) SWING.rider = null;
      const st = swingStand();
      this.x = st.x; this.y = st.y;
      this.node = BH.swing.node;
    }
    this.hops = []; this.final = null; this.finalState = null;
    this.state = 'noticed';
    this.noticedT = arand(3, 5);
  }

  draw(g, t) {
    if (this.alpha < 0.03) return;
    g.save();
    g.translate(this.x, this.y);
    g.globalAlpha = this.alpha;
    drawVillager(g, {
      h: this.h,
      tunic: this.tunic, skin: this.skin, hood: this.hood,
      phase: this.phase, t,
      walk: this.state === 'walk',
      sit: this.state === 'sit',
      chat: this.state === 'chat',
      noticed: this.state === 'noticed',
      carry: this.carry && (this.state === 'walk'),
      lantern: this.lantern && DAY.cur.night > 0.4,
      facing: this.facing,
      seed: this.i
    });
    g.restore();
  }
}

/* ============================================================
 * 手绘小村民（原点 = 脚下，facing +x 朝右）
 * 一体化连帽斗篷剪影：兜帽与袍身同一连续轮廓，无独立圆头；
 * 只在兜帽开口处露一点肤色暗面；背光侧一线深色软描边，
 * 受光侧（左上主光）轻微提亮，脚下接触影落地
 * ============================================================ */
function drawVillager(g, o) {
  const h = o.h, u = h / 26;                  // 尺寸归一
  const t = o.t;

  /* 落地接触影（秋千坐姿悬空：不画） */
  if (!o.swingSeat) {
    g.fillStyle = 'rgba(26,20,13,0.26)';
    g.beginPath();
    g.ellipse(0, 0.6, 7.2 * u, 2.3 * u, 0, 0, TAU);
    g.fill();
  }

  g.save();
  g.scale(o.facing, 1);

  if (o.sit) {
    /* —— 坐姿：斗篷铺开，腿伸向水面，极轻微摇晃 —— */
    const rock = Math.sin(t * 1.15 + o.seed) * 0.035;
    g.rotate(rock);
    /* 伸出的两条腿（深色小圆头） */
    g.strokeStyle = '#37302a';
    g.lineCap = 'round';
    g.lineWidth = 1.9 * u;
    g.beginPath();
    g.moveTo(1.5 * u, -2.6 * u); g.lineTo(8 * u, -1.4 * u);
    g.moveTo(1 * u, -1 * u); g.lineTo(7.2 * u, 0.2 * u);
    g.stroke();
    /* 一体化连帽斗篷（坐态：矮而宽） */
    hoodCloakPath(g, u, 0.62, Math.sin(t * 0.9 + o.seed) * 0.3 * u);
    g.fillStyle = o.tunic; g.fill();
    cloakShade(g, u, 0.62);
    cloakEdges(g, u, 0.62);
    hoodFace(g, o, u, 0.62, 0);
    g.restore();
    return;
  }

  if (o.swingSeat) {
    /* —— 秋千坐姿：袍身缩短，双腿垂下，随摆轻晃 —— */
    g.translate(0, -2.5 * u);
    hoodCloakPath(g, u, 0.64, Math.sin(t * 2.1 + o.seed) * 0.2 * u);
    g.fillStyle = o.tunic; g.fill();
    cloakShade(g, u, 0.64);
    cloakEdges(g, u, 0.64);
    hoodFace(g, o, u, 0.64, 0);
    /* 垂下的双腿（袍摆下两小截深色，随摆微分） */
    g.strokeStyle = '#37302a';
    g.lineCap = 'round';
    g.lineWidth = 1.7 * u;
    const dk = Math.sin(t * 2.1 + o.seed) * 0.5 * u;
    g.beginPath();
    g.moveTo(-1.4 * u, -2.4 * u); g.lineTo(-1.9 * u + dk, 2.4 * u);
    g.moveTo(1.2 * u, -2.4 * u); g.lineTo(1.7 * u - dk, 2.2 * u);
    g.stroke();
    g.restore();
    return;
  }

  /* 身体 bob：走路明显 / 聊天点头 / 待机呼吸 */
  const bob = o.walk ? Math.abs(Math.sin(o.phase)) * 1.05 * u
    : o.chat ? Math.abs(Math.sin(t * 3.1 + o.seed)) * 0.7 * u
    : Math.sin(t * 1.7 + o.seed * 2.3) * 0.3 * u;
  g.translate(0, -bob);

  /* 走路微小前倾 */
  if (o.walk) g.rotate(0.05);

  /* 走路的脚尖（下摆下交替探出） */
  if (o.walk) {
    const lo = Math.sin(o.phase);
    g.fillStyle = '#37302a';
    g.beginPath(); g.ellipse(-1.6 * u + lo * 1.6 * u, -0.6 * u - Math.max(0, lo) * 1.2 * u, 1.6 * u, 0.95 * u, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(1.6 * u - lo * 1.6 * u, -0.6 * u - Math.max(0, -lo) * 1.2 * u, 1.6 * u, 0.95 * u, 0, 0, TAU); g.fill();
  }

  /* 一体化连帽斗篷：下摆随步伐前后轻晃 */
  const sway = (o.walk ? Math.sin(o.phase * 0.5) * 1.15 : Math.sin(t * 1.1 + o.seed) * 0.4) * u;
  hoodCloakPath(g, u, 1, sway);
  g.fillStyle = o.tunic; g.fill();
  cloakShade(g, u, 1);
  cloakEdges(g, u, 1);

  /* 兜帽开口处一点肤色暗面（走路时轻微点头） */
  hoodFace(g, o, u, 1, o.noticed ? 1 : 0);

  /* 携带物：低饱和小包袱（身体前侧） */
  if (o.carry) {
    g.fillStyle = '#9a8767';
    g.beginPath();
    g.ellipse(4.4 * u, -10.8 * u, 2.7 * u, 2.5 * u, 0.12, 0, TAU);
    g.fill();
    g.fillStyle = '#7c6a4c';
    g.beginPath(); g.arc(4.4 * u, -12.8 * u, 1 * u, 0, TAU); g.fill();   // 扎口
  }

  /* 提灯（夜）：手提小灯，辉光由 dynamic 层补 */
  if (o.lantern) {
    g.strokeStyle = '#463626'; g.lineWidth = 0.9 * u;
    g.beginPath(); g.moveTo(4.2 * u, -12 * u); g.lineTo(6.6 * u, -9.4 * u); g.stroke();
    g.fillStyle = '#f4d992';
    g.beginPath(); g.roundRect(5.4 * u, -9.4 * u, 2.6 * u, 3.2 * u, 0.7 * u); g.fill();
  }

  g.restore();
}

/* 一体化连帽斗篷 path：兜帽与袍身一个连续轮廓（k=整体高比例，sway=下摆横摆）
 * facing +x 为前方：兜帽前缘微前突，后缘圆润 */
function hoodCloakPath(g, u, k, sway) {
  const hem = -1 * u;
  const crown = -25.2 * u * k;                // 兜帽顶
  const shY = crown + 8.2 * u * k;            // 肩线
  const hw = 7 * u, sw = 3.5 * u, cw = 4.3 * u;  // 下摆/肩/兜帽半宽
  g.beginPath();
  g.moveTo(0.5 * u, crown);
  /* 兜帽顶 → 后侧（左）圆润下行 → 左肩 */
  g.quadraticCurveTo(-cw - 0.4 * u, crown + 0.5 * u, -cw - 0.5 * u, crown + 3.8 * u * k);
  g.quadraticCurveTo(-cw - 0.6 * u, shY - 1.2 * u, -sw - 0.5 * u, shY + 1.4 * u);
  /* 左肩 → 左下摆（微外鼓） */
  g.quadraticCurveTo(-hw + 0.8 * u, (shY + hem) / 2, -hw + sway, hem - 1.2 * u);
  /* 下摆（两个柔和圆弧，略不对称） */
  g.quadraticCurveTo(-hw * 0.3 + sway * 0.5, hem + 0.9 * u, 0.3 * u, hem - 0.2 * u);
  g.quadraticCurveTo(hw * 0.5 + sway * 0.4, hem + 0.7 * u, hw + sway, hem - 1.4 * u);
  /* 右侧上行 → 右肩 → 兜帽前缘（微前突）→ 回顶 */
  g.quadraticCurveTo(hw - 0.8 * u, (shY + hem) / 2, sw + 0.5 * u, shY + 1.4 * u);
  g.quadraticCurveTo(cw + 0.9 * u, shY - 1.2 * u, cw + 0.7 * u, crown + 3.9 * u * k);
  g.quadraticCurveTo(cw + 0.5 * u, crown + 0.7 * u, 0.5 * u, crown);
  g.closePath();
}

/* 斗篷柔和明暗：受光侧（左）轻提亮 + 右侧轻压暗（clip 在斗篷内） */
function cloakShade(g, u, k) {
  const crown = -25.2 * u * k;
  g.save();
  g.clip();
  const gr = g.createLinearGradient(-7 * u, 0, 7 * u, 0);
  gr.addColorStop(0, 'rgba(255,240,214,0.16)');
  gr.addColorStop(0.45, 'rgba(255,240,214,0.02)');
  gr.addColorStop(1, 'rgba(24,17,22,0.20)');
  g.fillStyle = gr;
  g.fillRect(-9 * u, crown - 2 * u, 18 * u, -crown + 3 * u);
  g.restore();
}

/* 轮廓描边：背光侧（右/后缘）一线深色软描边 + 受光侧（左缘）细亮线 */
function cloakEdges(g, u, k) {
  const hem = -1 * u;
  const crown = -25.2 * u * k;
  g.lineCap = 'round';
  /* 背光侧：宽淡 + 窄实 两层，柔和 */
  g.strokeStyle = 'rgba(22,15,11,0.13)';
  g.lineWidth = 1.7 * u;
  g.beginPath();
  g.moveTo(4.9 * u, crown + 3.6 * u * k);
  g.quadraticCurveTo(5.3 * u, crown + 9 * u * k, 4.2 * u, crown + 12 * u * k);
  g.quadraticCurveTo(6.2 * u, (crown + 8 * u * k + hem) / 2 + 2 * u, 6.9 * u, hem - 1.8 * u);
  g.stroke();
  g.strokeStyle = 'rgba(22,15,11,0.22)';
  g.lineWidth = 0.75 * u;
  g.beginPath();
  g.moveTo(4.9 * u, crown + 3.8 * u * k);
  g.quadraticCurveTo(5.2 * u, crown + 9 * u * k, 4.2 * u, crown + 12 * u * k);
  g.quadraticCurveTo(6.1 * u, (crown + 8 * u * k + hem) / 2 + 2 * u, 6.8 * u, hem - 1.9 * u);
  g.stroke();
  /* 受光侧：一线极细提亮 */
  g.strokeStyle = 'rgba(255,244,216,0.14)';
  g.lineWidth = 0.7 * u;
  g.beginPath();
  g.moveTo(-4.7 * u, crown + 4 * u * k);
  g.quadraticCurveTo(-5 * u, crown + 10 * u * k, -4.2 * u, crown + 12.5 * u * k);
  g.quadraticCurveTo(-6 * u, (crown + 8 * u * k + hem) / 2 + 2 * u, -6.7 * u, hem - 2 * u);
  g.stroke();
}

/* 兜帽开口：暗腔 + 一点肤色暗面（非正圆；peek=1 时点出双眼） */
function hoodFace(g, o, u, k, peek) {
  const crown = -25.2 * u * k;
  const fy = crown + 5 * u * k;               // 开口中心
  /* 兜帽内暗腔（微竖椭圆，前缘略低） */
  g.fillStyle = shade(o.tunic, -48);
  g.beginPath();
  g.ellipse(1.4 * u, fy, 2.5 * u, 2.8 * u, -0.09, 0, TAU);
  g.fill();
  /* 肤色暗面：偏下前的一弯（压暗的肤色，不跳） */
  g.fillStyle = shade(o.skin, -18);
  g.beginPath();
  g.ellipse(1.8 * u, fy + 0.9 * u, 1.65 * u, 1.45 * u, 0.08, 0, TAU);
  g.fill();
  /* 兜帽檐压回一线 → 肤色只余下前缘 */
  g.fillStyle = shade(o.tunic, -40);
  g.beginPath();
  g.ellipse(1.5 * u, fy - 1.15 * u, 2.15 * u, 1.5 * u, -0.06, 0, TAU);
  g.fill();
  /* 脸上受光侧一点点暖（体积感） */
  g.fillStyle = 'rgba(255,228,190,0.10)';
  g.beginPath();
  g.ellipse(1 * u, fy + 1.1 * u, 0.9 * u, 0.8 * u, 0, 0, TAU);
  g.fill();
  if (peek) {
    g.fillStyle = '#241f1a';
    g.beginPath(); g.arc(1.2 * u, fy + 0.7 * u, 0.45 * u, 0, TAU); g.fill();
    g.beginPath(); g.arc(2.5 * u, fy + 0.7 * u, 0.45 * u, 0, TAU); g.fill();
  }
}

/* ---------- 初始化 ---------- */
function initResidents(mobile) {
  const n = mobile ? BH.counts.mobile : BH.counts.desktop;
  RES.list.length = 0;
  /* 房屋运行时态（位置权威在 compiled，这里只有 peekT/flick） */
  RES.houseState = {};
  for (const h of COMPILED.entitiesByTag('house')) {
    RES.houseState[h.id] = { peekT: -99, flick: 0 };
  }
  for (let i = 0; i < n; i++) RES.list.push(new Resident(i));
  RES.list[BH.sitterIndex].sitter = true;
  RES.list[BH.sitterIndex].node = BH.sit.goal;
  RES.list[BH.sitterIndex].x = 520; RES.list[BH.sitterIndex].y = 722;
  RES.list[BH.sitterIndex].timer = BH.sit.firstDelay;
  RES.list[BH.lanternIndex].lantern = true; // 夜晚提灯者
}

/* ---------- 管理 ---------- */
function updateResidents(dt) {
  const t = DYN.t, night = DAY.cur.night;

  if (!RES.nightMode && night > BH.night.enterAt) {
    RES.nightMode = true;
    for (let i = 0; i < RES.list.length; i++) {
      const r = RES.list[i];
      if (i < BH.night.outdoorCount) {       // 3~4 人留在室外
        if (r.sitter) { r.state = 'idle'; r._deck = false; r.timer = arand(BH.night.sitterIdle[0], BH.night.sitterIdle[1]); }
        continue;
      }
      if (r.state === 'inside' || r.state === 'entering') continue;
      r.state = 'idle'; r.timer = arand(0.5, 5); r.goingHome = false;
      r.nightHome = true;
    }
  } else if (RES.nightMode && night < BH.night.exitAt) {
    RES.nightMode = false;
  }

  RES.chatCd -= dt;

  /* 秋千偶发乘坐（每 10~18s 挑一名空闲居民；夜晚不发起） */
  if (!RES.nightMode && !SWING.rider) {
    RES.swingT -= dt;
    if (RES.swingT <= 0) {
      RES.swingT = arand(BH.swing.interval[0], BH.swing.interval[1]);
      const cands = [];
      for (const r of RES.list) {
        if (r.sitter || r.alpha < 0.9) continue;
        if (r.state === 'idle' || r.state === 'walk' || r.state === 'pause') cands.push(r);
      }
      if (cands.length) {
        const r = cands[Math.floor(arng() * cands.length)];
        /* 沿路网走到秋千台节点 S，再走最后一段直线上台（stand socket） */
        const st = swingStand();
        r.routeTo(BH.swing.node, { x: st.x, y: st.y, state: 'swingstart' });
      }
    }
  }

  for (const r of RES.list) {
    if (r.nightHome && r.state === 'idle' && r.timer <= 0.2) {
      r.nightHome = false;
      if (r.node === r.home) { r.state = 'entering'; }
      else r.routeTo(r.home, null, true);      // V4.7 多跳回家
    }
    r.update(dt, t);

    /* 运行期 debug 断言（V4.8）：脚底落在「物理水面」且非 deck 边/跨水 portal → warn
     * （像素掩码已降级为 artcheck evidence，物理查询一律 compiled） */
    if (!r._deck && r.alpha > 0.5 &&
      (r.state === 'walk' || r.state === 'idle' || r.state === 'pause' ||
        r.state === 'sit' || r.state === 'chat' || r.state === 'noticed')) {
      if (!COMPILED.dryLand(r.x, r.y + 1)) {
        if (!RES._warnT || t > RES._warnT) {
          RES._warnT = t + 2;
          console.warn('[residents] feet in water: #' + r.i, r.state,
            '(' + Math.round(r.x) + ',' + Math.round(r.y) + ')');
        }
      }
    }
  }

  /* 相遇短聊 */
  if (RES.chatCd <= 0) {
    outer:
    for (let i = 0; i < RES.list.length; i++) {
      const a = RES.list[i];
      if (a.state !== 'walk' && a.state !== 'idle') continue;
      if (a.sitter || a.alpha < 0.9) continue;
      for (let j = i + 1; j < RES.list.length; j++) {
        const b = RES.list[j];
        if (b.state !== 'walk' && b.state !== 'idle') continue;
        if (b.sitter || b.alpha < 0.9) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < BH.chat.dist && arng() < BH.chat.prob) {
          a.state = 'chat'; b.state = 'chat';
          a.chatT = b.chatT = arand(BH.chat.dur[0], BH.chat.dur[1]);
          a.partner = b; b.partner = a;
          a.facing = b.x >= a.x ? 1 : -1;
          b.facing = -a.facing;
          RES.chatCd = arand(BH.chat.cooldown[0], BH.chat.cooldown[1]);
          break outer;
        }
      }
    }
  }
}

/* ---------- 房屋点击反馈：门口一小村民探头 2.6s + 窗光脉冲 ----------
 * 门点 = compiled door socket；peekT/flick = RES.houseState 运行时态 */
function drawPeeks(g) {
  const t = DYN.t;
  for (const h of COMPILED.entitiesByTag('house')) {
    const hst = RES.houseState[h.id];
    const dt2 = t - hst.peekT;
    if (dt2 < 0 || dt2 > 2.6) continue;
    const k = dt2 < 0.4 ? dt2 / 0.4 : (dt2 > 2.1 ? (2.6 - dt2) / 0.5 : 1);
    const dx = h.socketsWorld.door.x, dy = h.socketsWorld.door.y;
    g.save();
    g.translate(dx, dy);
    g.globalAlpha = k;
    drawVillager(g, {
      h: 24,
      tunic: TUNICS[(h.id.length * 7) % TUNICS.length],
      skin: '#e8bd94',
      hood: '#4a3828',
      phase: 0, t,
      walk: false, sit: false, chat: true, noticed: true,
      carry: false, lantern: false,
      facing: 1, seed: h.id.length
    });
    g.restore();
    /* 门口暖光（夜） */
    if (DAY.cur.night > 0.3) {
      g.fillStyle = 'rgba(255,214,160,' + 0.22 * k * DAY.cur.night + ')';
      g.beginPath(); g.ellipse(dx, dy - 8, 12, 15, 0, 0, TAU); g.fill();
    }
  }
}

/* ---------- 对外接口 ---------- */
RES.lanternLight = function () {
  const r = RES.list[1];
  if (!r || r.alpha < 0.5 || r.state === 'inside') return null;
  return { x: r.x + r.facing * r.h * 0.26, y: r.y - r.h * 0.36 };
};
RES.residentAt = function (wx, wy) {
  for (const r of RES.list) {
    if (r.alpha < 0.5) continue;
    if (Math.abs(wx - r.x) < 13 && wy > r.y - r.h - 5 && wy < r.y + 5) return r;
  }
  return null;
};
RES.notice = function (r) { r.notice(); };
/* 房屋点击（传实体 id；运行时态在 RES.houseState） */
RES.peek = function (houseId) {
  const hst = RES.houseState[houseId];
  if (hst && DYN.t - hst.peekT > 4) { hst.peekT = DYN.t; hst.flick = 1; }
};
