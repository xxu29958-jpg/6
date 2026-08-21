(function (root) {
'use strict';
/* ============================================================
 * maps/xigu/map.js — 溪谷 Physical Map Definition（唯一世界权威）
 * 世界坐标 = 2048×1088（声明值，恰与 terrain.png 同尺寸；
 * 一致性由 artcheck 验证而非绑定）。
 * 这里只放物理：bounds/台地 surfaces+elevation/水系几何/obstacles/
 * 实体（单 transform + local sockets/zones/solids）/portal/semantic zones/nav hints。
 * PNG 键名、bbox、pivot、视觉缩放、摇曳等全部在 render binding。
 * 实体 local 坐标 = V4.7 世界坐标 − 实体锚点（scale=1）。
 * V4.9 单一 owner：房屋屋身/树根/篱石/井石等碰撞体 = 实体 local solids；
 * 桥面 deck surface/桥洞 portal/sortY 全部 local 于 bridge 实体；
 * 仅世界固定的崖面带保留 top-level obstacles。移动 transform 即整体跟随，
 * 运行期不存在第二份物理坐标。
 * ============================================================ */

const MAP_XIGU = {
  id: 'xigu',
  bounds: { w: 2048, h: 1088 },

  /* ---------- 地表片：三级台地第一次成为逻辑事实 ----------
   * 查询优先级 = 声明靠后覆盖靠前；cliff 默认不可直接跨越，
   * 不同 elevation 之间只有声明 portal 才可连通。 */
  surfaces: [
    { id: 'low',  elevation: 0, walkable: true,
      polygon: [[0, 300], [2048, 300], [2048, 1088], [0, 1088]] },
    /* 中部台地（大树/秋千所在平顶，elev 1） */
    { id: 'mid',  elevation: 1, walkable: true,
      polygon: [[1000, 400], [1250, 400], [1300, 470], [1270, 560], [1050, 570], [970, 500]] },
    /* 右侧台地（台地屋所在，elev 2） */
    { id: 'high', elevation: 2, walkable: true,
      polygon: [[1560, 520], [1900, 520], [1930, 600], [1900, 700], [1650, 710], [1580, 650], [1540, 580]] },
    /* 桥面：bridge 实体拥有的 deck walkable surface——polygon 为 bridge-local
     * 坐标（compile 期由 bridge.transform 派生世界坐标）；occlusion.sortYLocal
     * 同理派生世界 sortY。两岸 portal 以 socket 引用挂在 bridge 上（见 portals）。
     * 移动 bridge.transform → 桥面/portal/sortY 一起跟随。 */
    { id: 'bridgeDeck', entity: 'bridge', elevation: 0, walkable: true, tags: ['deck'],
      occlusion: { sortYLocal: 0 },
      polygon: [[-145, -165], [0, -158], [160, -115], [172, -68], [60, -102], [-95, -122], [-148, -138]] }
  ],

  /* ---------- 水系（物理 authority；renderer 依此画水） ----------
   * stream：带状折线，half = 每控制点物理半宽（瀑布急滩段收窄为白水槽，
   * 桥洞下游渐宽——渲染裁剪参数 ±55/×1.4 留在 binding，不参与物理）。
   * 点击判定半宽是交互参数，不属于水物理——见 behaviour.js interaction。 */
  waters: [
    { id: 'stream', kind: 'ribbon',
      ctrl: [
        [430, 555], [445, 600], [440, 650], [465, 690], [520, 712],
        [580, 735], [640, 775], [640, 815], [625, 860], [630, 900],
        [680, 935], [760, 955], [920, 945]
      ],
      half: [46, 30, 24, 10, 10, 30, 50, 55, 55, 55, 55, 58, 58],
      per: 10 },
    { id: 'pond', kind: 'ellipse', x: 1450, y: 870, rx: 460, ry: 165 },
    { id: 'fallsPool', kind: 'disc', x: 430, y: 555, r: 55 },
    /* 两级水幕：render-register（动画配准矩形，也是水域子区） */
    { id: 'fallsUpper', kind: 'rect', x0: 240, y0: 232, x1: 330, y1: 300, tags: ['render-register'] },
    { id: 'fallsMain',  kind: 'rect', x0: 375, y0: 390, x1: 505, y1: 540, tags: ['render-register'] }
  ],

  /* ---------- 障碍体 ----------
   * 实体拥有的碰撞体（屋身/树根/篱石/井石）全部以 local solids 挂在对应实体上
   * （见 entities[].solids；compile 期并入 compiled.obstacles，保持原 id）。
   * 这里只保留世界固定、不属于任何实体的：台地崖面带
   * （elev 规则之外的物理备份；路径穿越处留豁口，豁口处由坡道 portal 接管）。 */
  obstacles: [
    { id: 'cliffMidW', tags: ['cliff'], polygon: [[960, 556], [1060, 558], [1060, 585], [960, 583]] },
    { id: 'cliffMidE', tags: ['cliff'], polygon: [[1165, 562], [1295, 558], [1295, 595], [1165, 598]] },
    { id: 'cliffHighN', tags: ['cliff'], polygon: [[1520, 545], [1555, 555], [1570, 625], [1535, 615]] }
  ],

  /* ---------- 实体（单 transform + local sockets/zones；渲染数据在 binding） ---------- */
  entities: [
    /* 房屋：footprint local = 旧点击矩形 − 锚点；门/窗/烟囱 = local sockets */
    { id: 'mill', transform: { x: 600, y: 640 }, tags: ['house'],
      props: { name: '磨坊', smoke: true, rate: 1.0 },
      footprintLocal: [[-150, -305], [150, -305], [150, 0], [-150, 0]],
      /* 屋身碰撞体 ⊊ footprint（只挡墙，不挡门阶前沙地——节点 A 在 footprint 内） */
      solids: [{ id: 'millBody', tags: ['building'],
        polygon: [[-130, -160], [125, -160], [125, -50], [-130, -50]] }],
      sockets: {
        door: { x: -34, y: -45 },
        win0: { x: -92, y: -107, th: 0.30 }, win1: { x: 61, y: -93, th: 0.44 }, win2: { x: 102, y: -103, th: 0.52 },
        chimney: { x: -98, y: -252 }
      } },
    { id: 'cottage1', transform: { x: 285, y: 700 }, tags: ['house'],
      props: { name: '溪边屋', smoke: false, rate: 0 },
      footprintLocal: [[-125, -222], [125, -222], [125, 0], [-125, 0]],
      solids: [{ id: 'cot1Body', tags: ['building'],
        polygon: [[-110, -210], [115, -210], [115, -50], [-110, -50]] }],
      sockets: {
        door: { x: 38, y: -45 },
        win0: { x: -81, y: -92, th: 0.26 }, win1: { x: -38, y: -85, th: 0.50 }, win2: { x: 82, y: -98, th: 0.40 }
      } },
    { id: 'cottage2', transform: { x: 1680, y: 675 }, tags: ['house'],
      props: { name: '台地屋', smoke: true, rate: 0.75 },
      footprintLocal: [[-130, -234], [130, -234], [130, 0], [-130, 0]],
      solids: [{ id: 'cot2Body', tags: ['building'],
        polygon: [[-115, -225], [115, -225], [115, -50], [-115, -50]] }],
      sockets: {
        door: { x: 47, y: -45 },
        win0: { x: -84, y: -134, th: 0.36 }, win1: { x: 58, y: -140, th: 0.56 }, win2: { x: 87, y: -89, th: 0.46 },
        chimney: { x: -58, y: -215 }
      } },
    { id: 'well', transform: { x: 1545, y: 720 },
      solids: [{ id: 'wellBase', tags: ['rock'],
        polygon: [[14, 0], [10, 10], [0, 14], [-10, 10],
          [-14, 0], [-10, -10], [0, -14], [10, -10]] }] },
    { id: 'fenceA', transform: { x: 1380, y: 585 },
      solids: [{ id: 'fenceAObs', tags: ['fence'],
        polygon: [[-60, -65], [60, -65], [60, 5], [-60, 5]] }] },
    { id: 'fenceB', transform: { x: 380, y: 660 },
      solids: [{ id: 'fenceBObs', tags: ['fence'],
        polygon: [[-50, -60], [50, -60], [50, 0], [-50, 0]] }] },
    { id: 'flowersA', transform: { x: 250, y: 790 } },
    { id: 'flowersB', transform: { x: 1200, y: 760 } },
    /* 大树：canopy socket（点击判定圆）+ leafSpawn zone（落叶带）+ 树根碰撞体，全 local */
    { id: 'tree', transform: { x: 1150, y: 525 }, tags: ['tree'],
      solids: [{ id: 'treeRoot', tags: ['root'],
        polygon: [[24, -3], [17, 10], [0, 15], [-17, 10],
          [-24, -3], [-17, -16], [0, -21], [17, -16]] }],
      sockets: { canopy: { x: 0, y: -130, r: 250 } },
      zones: { leafSpawn: { x0: -170, x1: 180, y: -25, dy: 28 } } },
    { id: 'wheel', transform: { x: 517, y: 626 } },
    /* 桥：单 owner——deck surface / 两岸 portal（socket 引用）/ sortY 全部
     * 由本 transform 派生；west/east = 桥堍 local socket */
    { id: 'bridge', transform: { x: 640, y: 770 }, tags: ['bridge'],
      sockets: { west: { x: -130, y: -149 }, east: { x: 154, y: -80 } } },
    { id: 'bush1a', transform: { x: 420, y: 760 } },
    { id: 'bush1b', transform: { x: 1450, y: 540 } },
    { id: 'bush2a', transform: { x: 1250, y: 700 } },
    { id: 'bush2b', transform: { x: 560, y: 330 } },
    /* 桥东南滩石组：实心基座取下半部（潭西口小径自其北缘外侧掠过） */
    { id: 'rocksA', transform: { x: 880, y: 780 },
      solids: [{ id: 'rocksAObs', tags: ['rock'],
        polygon: [[-22, 6], [22, 6], [18, 18], [0, 22], [-18, 18]] }] },
    { id: 'rocksB', transform: { x: 300, y: 950 } },
    { id: 'grassA', transform: { x: 520, y: 860 } },
    { id: 'grassB', transform: { x: 960, y: 705 } },
    { id: 'grassC', transform: { x: 1300, y: 625 } },
    { id: 'grassD', transform: { x: 645, y: 905 } },
    { id: 'grassE', transform: { x: 1780, y: 705 } },
    /* 灯笼：head = 灯头 local socket（V4.7 源图量测 (680,310)/(550,963) 经视觉缩放换算，
     * 原始量测常数留在 binding；lantern1 transform.flip=true → 灯头 x 镜像） */
    { id: 'lantern1', transform: { x: 810, y: 615, flip: true }, tags: ['lantern'],
      sockets: { head: { x: 17.205882352941178, y: -86.42647058823529 } } },
    { id: 'lantern2', transform: { x: 740, y: 815 }, tags: ['lantern'],
      sockets: { head: { x: 20.073529411764707, y: -100.83088235294117 } } },
    { id: 'bush2c', transform: { x: 1878, y: 612, flip: true } },
    { id: 'rocksC', transform: { x: 1842, y: 672 },
      solids: [{ id: 'rocksCObs', tags: ['rock'],
        polygon: [[24, 0], [17, 13], [0, 17], [-17, 13],
          [-24, 0], [-17, -13], [0, -17], [17, -13]] }] },
    { id: 'grassF', transform: { x: 1792, y: 578 } },
    { id: 'grassG', transform: { x: 1936, y: 652 } },
    { id: 'fenceC', transform: { x: 1820, y: 726 },
      solids: [{ id: 'fenceCObs', tags: ['fence'],
        polygon: [[-50, -61], [50, -61], [50, 4], [-50, 4]] }] },
    { id: 'grassH', transform: { x: 1952, y: 896 } },
    { id: 'rocksD', transform: { x: 1902, y: 956 },
      solids: [{ id: 'rocksDObs', tags: ['rock'],
        polygon: [[24, 0], [17, 13], [0, 17], [-17, 13],
          [-24, 0], [-17, -13], [0, -17], [17, -13]] }] },
    /* 秋千：挂点 transform；stand = 上下点 socket（不再隐含 standX==ax 的巧合） */
    { id: 'swing', transform: { x: 1090, y: 416 }, tags: ['swing'],
      props: { rope: 90, seatW: 22 },
      sockets: { stand: { x: 0, y: 98 } } }
  ],

  /* ---------- portal 清单 ----------
   * 桥 = 两个 deck-end portal（crossesWater，socket 引用 bridge 实体，跟随 transform）；
   * 急滩浅水踏渡 = ford portal；台地坡道 × 2（elev 0↔1 / 0↔2）；
   * 房门 × 3（socket 引用，跟随房屋 transform）。
   * connects 为强制语义：compile 期 validation 校验跨水 run 的两岸 surface ∈ connects。 */
  portals: [
    { id: 'bridgeW', socket: ['bridge', 'west'], r: 48, connects: ['low', 'bridgeDeck'],
      elevations: [0, 0], crossesWater: true, tags: ['deck-end'] },
    { id: 'bridgeE', socket: ['bridge', 'east'], r: 48, connects: ['bridgeDeck', 'low'],
      elevations: [0, 0], crossesWater: true, tags: ['deck-end'] },
    /* 磨坊岸↔桥西堍之间的急滩浅水踏渡（白水槽，居民涉水点） */
    { id: 'fordW', at: { x: 527, y: 715 }, r: 34, connects: ['low', 'low'],
      elevations: [0, 0], crossesWater: true, tags: ['ford'] },
    { id: 'slopeTree', at: { x: 1113, y: 570 }, r: 80, connects: ['low', 'mid'],
      elevations: [0, 1], tags: ['slope'] },
    { id: 'slopeHigh', at: { x: 1590, y: 660 }, r: 80, connects: ['low', 'high'],
      elevations: [0, 2], tags: ['slope'] },
    { id: 'doorMill', socket: ['mill', 'door'], r: 26, connects: ['low', 'low'],
      elevations: [0, 0], tags: ['door'] },
    { id: 'doorCot1', socket: ['cottage1', 'door'], r: 26, connects: ['low', 'low'],
      elevations: [0, 0], tags: ['door'] },
    { id: 'doorCot2', socket: ['cottage2', 'door'], r: 26, connects: ['high', 'high'],
      elevations: [2, 2], tags: ['door'] }
  ],

  /* ---------- semantic zones（authored 语义点/区，非物理水体） ---------- */
  zones: {
    /* 桥西南岸草径坐姿点（距溪中心线 77px，干爽），面朝东南溪湾 */
    sitSpot: { x: 450, y: 725, dir: [0.85, 0.5] },
    fishArea: { x: 1450, y: 880, rx: 340, ry: 100 }
  },

  /* ---------- navigation hints（非物理 authority；compile 期逐条过 validation） ----------
   * cost = 路线几何长 × costMul；桥三段 costMul=0.5（实测：桥三段几何长 485.6 >
   * 东岸绕路 C-A-B-D 385.6，纯几何 Dijkstra 会错误弃桥；系数 0.5 → 等效 242.8 < 385.6，
   * 桥优先语义由显式 cost 保证，与边声明顺序无关）。
   * 节点 face = 朝向语义（authored）。 */
  nav: {
    nodes: {
      A: { x: 578, y: 600 },    // 磨坊门（门阶前沙地）
      B: { x: 720, y: 700, face: [0.3, 0.95] },   // 溪东小径
      C: { x: 526, y: 726, face: [0.45, 0.9] },   // 桥西（急滩南侧沙岸）
      Cb: { x: 510, y: 621 },   // 桥西堍（deck 西口，端面上沿）
      Db: { x: 794, y: 690 },   // 桥东堍（deck 东口）
      D: { x: 745, y: 745, face: [-0.4, 0.9] },   // 桥东（沙岸）
      E: { x: 900, y: 665 },    // 岔路
      F: { x: 1150, y: 555, face: [0.2, -1] },    // 大树下
      G: { x: 1400, y: 640, face: [0.9, 0.4] },   // 右径（崖脚）
      H: { x: 1700, y: 655 },   // 右屋门
      I: { x: 1098, y: 700, face: [0.6, 0.8] },   // 潭畔
      J: { x: 320, y: 672 },    // 左屋门
      K: { x: 310, y: 940, face: [0.4, 0.9] },    // 左下（西南草径）
      M: { x: 718, y: 804, face: [0.2, 1] },      // 桥东南滩
      N: { x: 900, y: 758 },    // 潭西口
      S: { x: 1090, y: 514 },   // 秋千台
      W: { x: 1495, y: 704, face: [0.7, 0.7] }    // 井畔
    },
    edges: [
      { a: 'C', b: 'Cb', costMul: 0.5, via: [[528, 706], [536, 688], [535, 670], [530, 654], [522, 638], [513, 626]] },
      { a: 'Cb', b: 'Db', costMul: 0.5, via: [[552, 636], [612, 632], [678, 640], [726, 660], [766, 680]] },
      { a: 'Db', b: 'D', costMul: 0.5, via: [[775, 712], [758, 728]] },
      { a: 'A', b: 'B', via: [[628, 640], [668, 670]] },
      { a: 'A', b: 'C', via: [[556, 606], [540, 614], [530, 628], [528, 644], [530, 660], [535, 676], [537, 692], [530, 708]] },
      { a: 'B', b: 'D', via: [[736, 722]] },
      { a: 'C', b: 'J', via: [[480, 722], [440, 718], [400, 714], [364, 712], [340, 706], [330, 692], [326, 678]] },
      { a: 'C', b: 'K', via: [[496, 734], [466, 754], [436, 782], [404, 816], [372, 852], [344, 892], [322, 918]] },
      { a: 'D', b: 'M', via: [[736, 774]] },
      { a: 'D', b: 'E', via: [[826, 700]] },
      { a: 'M', b: 'N', via: [[756, 820], [824, 798]] },
      { a: 'E', b: 'N', via: [[910, 714]] },
      { a: 'N', b: 'I', via: [[952, 740], [1020, 722]] },
      { a: 'E', b: 'F', via: [[958, 642], [1030, 606]] },
      { a: 'E', b: 'G', via: [[1050, 652], [1150, 650], [1280, 646]] },
      { a: 'G', b: 'H', via: [[1480, 646], [1560, 650], [1622, 652]] },
      { a: 'F', b: 'S', via: [[1118, 538]] },
      { a: 'I', b: 'W', via: [[1208, 690], [1328, 686], [1418, 694]] },
      { a: 'W', b: 'H', via: [[1558, 700], [1624, 678]] }
    ],
    /* 附加校验段：snap/final 直线样例（居民上岸点/上下秋千点） */
    extraRoutes: [
      { id: 'sitApproach', from: 'C', toZone: 'sitSpot' },
      { id: 'swingApproach', from: 'S', toSocket: ['swing', 'stand'] }
    ]
  }
};

root.MAP_XIGU = MAP_XIGU;
if (typeof module !== 'undefined') module.exports = MAP_XIGU;
})(typeof window !== 'undefined' ? window : globalThis);
