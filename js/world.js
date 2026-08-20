'use strict';
/* ============================================================
 * world.js — V4 Asset-based Diorama 世界数据
 * 世界坐标 = 地形盘像素 2048 × 1088（assets/terrain.png）
 * 美术 = 空地地形盘 + 独立透明资产（锚点/宽度/遮挡见 design/v4-config.md）
 * 资产 bbox = alpha>8 的紧致包围盒（离线量得）；放置约定 = bbox 底部中心
 * ============================================================ */

const WORLD = {
  W: 2048, H: 1088,
  /* 烘焙底座外扩边距（拖动/pinch 不露白）：左右 MX、天空上 MT、底部桌面延展 MB */
  MX: 170, MT: 90, MB: 240,
  /* V4.7 山脊轮廓线：远山（far 视差层）与天空/中景的自然交界，8-14 折点手工登记
   * （自 terrain.png 逐列饱和/色相检测采样修平）；far 层沿此折线蒙版切割，
   * 缝藏在山脊纹理后，拖动/视差时不再滑过中景草地 */
  ridgeCtrl: [
    [0, 160], [170, 158], [340, 170], [510, 208], [680, 188], [850, 208],
    [1020, 292], [1190, 300], [1360, 336], [1530, 340], [1700, 285],
    [1870, 273], [2048, 280]
  ]
};
WORLD.GW = WORLD.W + WORLD.MX * 2;          // 2388
WORLD.GH = WORLD.H + WORLD.MT + WORLD.MB;   // 1418

(function buildWorld() {

  /* ---------- 资产表 ----------
   * img   : ASSETS 键名
   * bbox  : [x0,y0,x1,y1] 紧致 alpha 包围盒（源图像素）
   * ax,ay : 世界锚点（bbox 底部中心；树 = 树干根部）
   * w     : 世界宽度 px
   * bake  : true → 静态，烘进 L0 底座；false → 每帧 Y-sort 动态绘制
   * sway  : 风摆强度（0=不动，1=树级）；spin → 绕 bbox 中心旋转（水车轮）
   * ph    : 风摆相位                                                        */
  const A = (img, bbox, ax, ay, w, o) =>
    Object.assign({ img, bbox, ax, ay, w, bake: false, sway: 0, spin: false, ph: 0, shadow: 1 }, o || {});

  WORLD.assets = [
    /* —— 静态烘焙（居民路径不经过其后方，Y-sort 无关紧要） —— */
    A('mill',     [310, 55, 1106, 864],  600, 640, 300, { bake: true }),
    A('cottage1', [247, 73, 1221, 937],  285, 700, 250, { bake: true }),
    A('cottage2', [271, 105, 1170, 913], 1680, 675, 260, { bake: true }),
    A('well',     [218, 130, 787, 865],  1545, 720, 75, { bake: true }),
    A('fence',    [216, 270, 1325, 856], 1380, 585, 140, { bake: true, shadow: 0.6 }),
    A('fence',    [216, 270, 1325, 856], 380, 660, 120, { bake: true, shadow: 0.6 }),
    A('flowers',  [149, 308, 925, 773],  250, 790, 90, { bake: true, shadow: 0.5 }),
    A('flowers',  [149, 308, 925, 773],  1200, 760, 95, { bake: true, shadow: 0.5 }),

    /* —— 动态（Y-sort：sway / 旋转 / 需与居民互相遮挡） —— */
    /* 树：锚 = 树干根部中心（源图 (646,975)，离线量得）；加大 ~12%（480→540） */
    A('tree',   [85, 44, 1342, 975],  1150, 525, 540, { sway: 1, srcA: [646, 975], shadow: 1.6 }),
    A('wheel',  [176, 117, 881, 927], 517, 626, 95, { spin: true, shadow: 0.5 }),
    A('bridge', [175, 230, 1292, 846], 640, 770, 340, { shadow: 1.2 }),
    A('bush1',  [64, 120, 967, 959],  420, 760, 95, { sway: 0.5, ph: 1.3 }),
    A('bush1',  [64, 120, 967, 959],  1450, 540, 85, { sway: 0.5, ph: 3.9 }),
    A('bush2',  [0, 227, 1023, 832],  1250, 700, 105, { sway: 0.55, ph: 2.4 }),
    A('bush2',  [0, 227, 1023, 832],  560, 330, 90, { sway: 0.55, ph: 5.1 }),
    A('rocks',  [184, 288, 852, 778], 880, 780, 85, { shadow: 0.8 }),
    A('rocks',  [184, 288, 852, 778], 300, 950, 90, { shadow: 0.8 }),
    A('grass',  [276, 227, 840, 814], 520, 860, 70, { sway: 0.9, ph: 0.7, shadow: 0.45 }),
    A('grass',  [276, 227, 840, 814], 960, 705, 62, { sway: 0.9, ph: 2.9, shadow: 0.45 }),
    A('grass',  [276, 227, 840, 814], 1300, 625, 70, { sway: 0.9, ph: 4.6, shadow: 0.45 }),
    A('grass',  [276, 227, 840, 814], 645, 905, 68, { sway: 0.9, ph: 1.9, shadow: 0.45 }),
    A('grass',  [276, 227, 840, 814], 1780, 705, 72, { sway: 0.9, ph: 3.4, shadow: 0.45 }),
    /* 路灯 ×2（去重复）：台地小径 = 水平镜像 + 缩放 0.9；桥东 = 缩放 1.05 */
    A('lantern', [346, 50, 754, 963], 810, 615, 54, { sway: 0.32, ph: 0.9, shadow: 0.5, flip: true }),
    A('lantern', [346, 50, 754, 963], 740, 815, 63, { sway: 0.32, ph: 4.3, shadow: 0.5 }),
    /* —— V4.6 右侧配重（左密右空收敛；不动大树/磨坊/桥/两房） —— */
    /* 右坡（x1750-2000, y500-700）：灌木(镜像) + 石组 + 草簇×2 + 沿径短篱 */
    A('bush2',  [0, 227, 1023, 832], 1878, 612, 92, { sway: 0.55, ph: 1.8, flip: true }),
    A('rocks',  [184, 288, 852, 778], 1842, 672, 82, { shadow: 0.8 }),
    A('grass',  [276, 227, 840, 814], 1792, 578, 62, { sway: 0.9, ph: 5.6, shadow: 0.45 }),
    A('grass',  [276, 227, 840, 814], 1936, 652, 60, { sway: 0.9, ph: 0.2, shadow: 0.45 }),
    A('fence',  [216, 270, 1325, 856], 1820, 726, 105, { shadow: 0.6 }),
    /* 右下岸（x1850-1980, y820-950，椭圆外 ≥1.2 安全）：草簇 + 小石组 */
    A('grass',  [276, 227, 840, 814], 1952, 896, 64, { sway: 0.9, ph: 3.1, shadow: 0.45 }),
    A('rocks',  [184, 288, 852, 778], 1902, 956, 66, { shadow: 0.8 })
  ];
  /* 预计算派生量 */
  for (const a of WORLD.assets) {
    const bw = a.bbox[2] - a.bbox[0], bh = a.bbox[3] - a.bbox[1];
    a.s = a.w / bw;                 // 世界缩放
    a.h = bh * a.s;                 // 世界高度
    a.bw = bw; a.bh = bh;
  }
  WORLD.dynAssets = WORLD.assets.filter(a => !a.bake);
  WORLD.staticAssets = WORLD.assets.filter(a => a.bake).sort((p, q) => p.ay - q.ay);

  /* 灯笼灯头（源图量得：灯中心 ≈ (680,310)，锚 = bbox 底心 (550,963)；镜像灯偏移取反） */
  WORLD.lanterns = WORLD.assets.filter(a => a.img === 'lantern').map((a, i) => ({
    x: a.ax + (a.flip ? -1 : 1) * (680 - 550) * a.s,
    y: a.ay - (963 - 310) * a.s,
    th: 0.18 + i * 0.14              // 黄昏逐个亮起
  }));

  /* 山脊密折线（供 far 层蒙版） */
  WORLD.ridgePts = catmull(WORLD.ridgeCtrl, 6);
  WORLD.ridgeMaxY = 0;
  for (const p of WORLD.ridgePts) if (p[1] > WORLD.ridgeMaxY) WORLD.ridgeMaxY = p[1];

  /* ---------- 溪流中心线 polyline（溅落池 → 桥洞 → 水潭） ----------
   * V4.7 按 terrain 视觉水面逐行重测登记（旧线在东弯处偏到干岸上） */
  const streamCtrl = [
    [430, 555], [445, 600], [440, 650], [465, 690], [520, 712],
    [580, 735], [640, 775], [640, 815], [625, 860], [630, 900],
    [680, 935], [760, 955], [920, 945]
  ];
  WORLD.streamPts = catmull(streamCtrl, 10);
  WORLD.stream = polyMeasure(WORLD.streamPts);
  WORLD.streamHalf = 60;            // 流光/点击判定半宽

  /* ---------- 水潭（有机形近似椭圆 + 轮廓扰动） ---------- */
  WORLD.pond = { x: 1450, y: 870, rx: 460, ry: 165 };
  WORLD.pond.outline = [];
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * TAU;
    const w = 1 + 0.07 * noise1(a * 1.8 + 1.3) + 0.04 * noise1(a * 4.1 + 5.1);
    WORLD.pond.outline.push([Math.cos(a) * w, Math.sin(a) * w]);
  }
  WORLD.fishArea = { x: 1450, y: 880, rx: 340, ry: 100 };

  /* ---------- 瀑布（两级水幕配准矩形 + 溅落池） ---------- */
  WORLD.falls = [
    /* 上级：y0=232 与 terrain 画好的水幕顶缘对齐（原 210 悬在崖顶上空 → 天上白条） */
    { x0: 240, y0: 232, x1: 330, y1: 300 },   // 上级
    { x0: 375, y0: 390, x1: 505, y1: 540 }    // 主级
  ];
  WORLD.fallsPool = { x: 430, y: 555 };

  /* ---------- 桥 ---------- */
  WORLD.bridge = { ax: 640, ay: 770, sortY: 770 };
  /* 坐姿者常驻：桥西南岸草径边（V4.6.2 自 (616,718) 迁出——旧点在桥拱泛白水花上仍读作泡水；
     新点 7×7 luma 0.65 干爽草径、距溪中心线 77px 过 74px 阈值），面朝东南溪湾 */
  WORLD.sitSpot = { x: 450, y: 725, dir: [0.85, 0.5] };

  /* ---------- 建筑（点击矩形 / 门 / 窗光点 / 烟囱；按锚点+宽度推得） ---------- */
  WORLD.houses = [
    {
      id: 'mill', name: '磨坊', x0: 450, y0: 335, x1: 750, y1: 640,
      door: { wx: 566, wy: 595 },
      windows: [{ wx: 508, wy: 533, th: 0.30 }, { wx: 661, wy: 547, th: 0.44 }, { wx: 702, wy: 537, th: 0.52 }],
      chimney: { x: 502, y: 388 },
      smoke: true, rate: 1.0
    },
    {
      id: 'cottage1', name: '溪边屋', x0: 160, y0: 478, x1: 410, y1: 700,
      door: { wx: 323, wy: 655 },
      windows: [{ wx: 204, wy: 608, th: 0.26 }, { wx: 247, wy: 615, th: 0.50 }, { wx: 367, wy: 602, th: 0.40 }],
      chimney: null,
      smoke: false, rate: 0
    },
    {
      id: 'cottage2', name: '台地屋', x0: 1550, y0: 441, x1: 1810, y1: 675,
      door: { wx: 1727, wy: 630 },
      windows: [{ wx: 1596, wy: 541, th: 0.36 }, { wx: 1738, wy: 535, th: 0.56 }, { wx: 1767, wy: 586, th: 0.46 }],
      chimney: { x: 1622, y: 460 },
      smoke: true, rate: 0.75
    }
  ];
  WORLD.chimneys = WORLD.houses.filter(h => h.smoke)
    .map(h => ({ x: h.chimney.x, y: h.chimney.y, rate: h.rate }));
  for (const h of WORLD.houses) { h.flick = 0; h.peekT = -99; }

  /* ---------- 大树（交互/落叶配准） ---------- */
  WORLD.tree = {
    ax: 1150, ay: 525,
    hit: { x: 1150, y: 395, r: 250 },                 // 点击判定圆（树冠）
    leafZone: { x0: 980, x1: 1330, y: 500, dy: 28 }   // 落叶 spawn（树冠下缘）
  };

  /* ---------- 绳秋千（V4.7 东移：挂在树干左下横枝 (1090,416) 上——
   * 旧挂点 (1012,388) 座板悬出高台前缘、背后衬深色崖面；
   * 新位座板 (1090,506) 悬在树下浅色沙土台正上方（树资产自带根丘，L≈200），
   * 座板底缘 508 ≤ 台前缘 535；站立点在沙土台前缘） ----------
   * ax,ay = 挂点（世界坐标）；rope = 绳长；stand = 居民走近站立点          */
  WORLD.swing = { ax: 1090, ay: 416, rope: 90, seatW: 22, standX: 1090, standY: 514 };

  /* ---------- 居民路径图（V4.7 折线路由：每边 3-8 个沿视觉土径的途经点） ----------
   * 主径：K 左下 → C 桥西 →（西引道 Cb → 桥面 → 东堍 Db）→ D 桥东 → M 南滩
   *      → N 潭西口 → I 潭畔 → W 井畔 → H 右屋门；
   * 支路：A 磨坊门 → C 桥西（西引道走廊）；F 大树下 → S 秋千台；
   * 西路：C → J 左屋门；岔路 E 上接大树/右径。途经点已逐点过视觉水像素校验 */
  const N = WORLD.nodes = {
    A: { x: 578, y: 600 },    // 磨坊门（门阶前沙地）
    B: { x: 720, y: 700 },    // 溪东小径
    C: { x: 526, y: 726 },    // 桥西（急滩南侧沙岸，V4.7 引道落点）
    Cb: { x: 510, y: 621 },   // 桥西堍（deck 西口，端面上沿）
    Db: { x: 794, y: 690 },   // 桥东堍（deck 东口）
    D: { x: 745, y: 745 },    // 桥东（沙岸）
    E: { x: 900, y: 665 },    // 岔路
    F: { x: 1150, y: 555 },   // 大树下
    G: { x: 1400, y: 640 },   // 右径（崖脚）
    H: { x: 1700, y: 655 },   // 右屋门（实测门前小径）
    I: { x: 1098, y: 700 },   // 潭畔（潭北岸土径，视觉水区外）
    J: { x: 320, y: 672 },    // 左屋门（实测门前）
    K: { x: 310, y: 940 },    // 左下（西南草径）
    M: { x: 718, y: 804 },    // 桥东南滩（沙地，湿滩外）
    N: { x: 900, y: 758 },    // 潭西口
    S: { x: 1090, y: 514 },   // 秋千台（沙土台前缘）
    W: { x: 1495, y: 704 }    // 井畔（井西侧干径）
  };
  N.B.face = [0.3, 0.95]; N.I.face = [0.6, 0.8];
  N.F.face = [0.2, -1]; N.G.face = [0.9, 0.4];
  N.C.face = [0.45, 0.9]; N.D.face = [-0.4, 0.9];
  N.M.face = [0.2, 1]; N.W.face = [0.7, 0.7]; N.K.face = [0.4, 0.9];

  /* 边序即 BFS 发现序：桥三段列最前，保证桥西↔桥东的多跳路由走桥面
   *（C-A-B-D 东岸绕路同为 3 跳，列后则桥面优先被发现） */
  const E = WORLD.edges = [
    ['C', 'Cb'], ['Cb', 'Db'], ['Db', 'D'],      // 过桥三段（Cb>Db = 桥面）
    ['A', 'B'], ['A', 'C'], ['B', 'D'],
    ['C', 'J'], ['C', 'K'],
    ['D', 'M'], ['D', 'E'], ['M', 'N'], ['E', 'N'], ['N', 'I'],
    ['E', 'F'], ['E', 'G'], ['G', 'H'], ['F', 'S'],
    ['I', 'W'], ['W', 'H']
  ];
  /* 桥面边：走桥面的居民画在桥之后（真正踏上 deck 的一段） */
  WORLD.bridgeEdge = 'Cb>Db';
  /* 边途经点（沿 terrain 视觉土径采样；桥段走桥面实测行走线 deck y≈613-690） */
  const MID = {
    'A>B': [[628, 640], [668, 670]],
    'A>C': [[556, 606], [540, 614], [530, 628], [528, 644], [530, 660], [535, 676], [537, 692], [530, 708]],
    'B>D': [[736, 722]],
    'C>Cb': [[528, 706], [536, 688], [535, 670], [530, 654], [522, 638], [513, 626]],
    'Cb>Db': [[552, 636], [612, 632], [678, 640], [726, 660], [766, 680]],
    'Db>D': [[775, 712], [758, 728]],
    'C>J': [[480, 722], [440, 718], [400, 714], [364, 712], [340, 706], [330, 692], [326, 678]],
    'C>K': [[496, 734], [466, 754], [436, 782], [404, 816], [372, 852], [344, 892], [322, 918]],
    'D>M': [[736, 774]],
    'D>E': [[826, 700]],
    'M>N': [[756, 820], [824, 798]],
    'E>N': [[910, 714]],
    'N>I': [[952, 740], [1020, 722]],
    'E>F': [[958, 642], [1030, 606]],
    'E>G': [[1050, 652], [1150, 650], [1280, 646]],
    'G>H': [[1480, 646], [1560, 650], [1622, 652]],
    'F>S': [[1118, 538]],
    'I>W': [[1208, 690], [1328, 686], [1418, 694]],
    'W>H': [[1558, 700], [1624, 678]]
  };
  WORLD.routes = {};
  for (const [a, b] of E) {
    const An = N[a], Bn = N[b];
    const m = MID[a + '>' + b] || [(An.x + Bn.x) / 2, (An.y + Bn.y) / 2];
    const via = Array.isArray(m[0]) ? m : [m];
    WORLD.routes[a + '>' + b] = catmull([[An.x, An.y], ...via, [Bn.x, Bn.y]], 7);
  }
  WORLD.adj = {};
  for (const [a, b] of E) {
    (WORLD.adj[a] = WORLD.adj[a] || []).push(b);
    (WORLD.adj[b] = WORLD.adj[b] || []).push(a);
  }
  /* 全源 BFS 下一跳表（gosit/goswing 等「沿路网购最近节点」用） */
  WORLD.nextHop = {};
  for (const from of Object.keys(N)) {
    WORLD.nextHop[from] = {};
    const prev = { [from]: null }, q = [from];
    while (q.length) {
      const u = q.shift();
      for (const v of WORLD.adj[u] || []) {
        if (!(v in prev)) { prev[v] = u; q.push(v); }
      }
    }
    for (const to of Object.keys(N)) {
      if (to === from || !(to in prev)) continue;
      let cur = to; while (prev[cur] !== from) cur = prev[cur];
      WORLD.nextHop[from][to] = cur;
    }
  }
  /* 离任意点最近的节点（线性扫，节点数少） */
  WORLD.nearestNode = function (x, y) {
    let best = null, bd = Infinity;
    for (const k of Object.keys(N)) {
      const d = (N[k].x - x) * (N[k].x - x) + (N[k].y - y) * (N[k].y - y);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  };

  /* ---------- 天空 / 星 / 月（overlay 仅 y<170） ---------- */
  WORLD.moon = { x: 1560, y: 90 };
  WORLD.stars = [];
  for (let i = 0; i < 110; i++) {
    WORLD.stars.push({ x: rand(0, 2048), y: rand(4, 168), r: rand(0.6, 1.5), ph: rand(TAU) });
  }
  WORLD.clouds = [
    { x: 300, s: 1.15, v: 7.5 },
    { x: 1250, s: 0.9, v: 5.2 }
  ];

  /* ---------- 薄雾带：瀑布底 + 清晨潭面/桥边溪面 ---------- */
  WORLD.mistBands = [
    { x: 430, y: 560, w: 220, h: 44, ph: 0, always: true },       // 瀑布底常年轻雾
    { x: 1450, y: 870, w: 700, h: 80, ph: 2.1, always: false },   // 潭面（清晨）
    { x: 640, y: 790, w: 300, h: 44, ph: 4.2, always: false }     // 桥边溪面（清晨）
  ];

  /* ---------- 黄昏暖色光池 ---------- */
  WORLD.lightPools = [
    { x: 880, y: 590, rx: 170, ry: 62 },
    { x: 1150, y: 560, rx: 150, ry: 56 },
    { x: 1560, y: 650, rx: 150, ry: 58 },
    { x: 620, y: 780, rx: 150, ry: 60 },
    { x: 1020, y: 800, rx: 160, ry: 60 },
    { x: 380, y: 560, rx: 120, ry: 50 }
  ];

  /* ---------- 水潭鱼 ---------- */
  WORLD.fish = [];
  for (let i = 0; i < 5; i++) {
    WORLD.fish.push({
      a: rand(TAU),
      ra: rand(0.3, 0.85),
      speed: rand(0.10, 0.2) * (rng() < 0.5 ? 1 : -1),
      wig: rand(TAU), x: 0, y: 0,
      fx: 0, fy: 0, flee: 0,
      len: rand(9, 14)
    });
  }
})();
