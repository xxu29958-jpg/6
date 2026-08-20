'use strict';
/* t7 — visual baseline：compiled world 与 V4.7 world.js 全部世界数值逐项全等（容差 1e-6）
 * 旧值 = V4.7 world.js 常量表快照（硬编码于本文件，作为回归基准）。 */
const H = require('./helpers.js');
H.loadCore(); H.loadMaps(); H.loadBinding();

const c = H.compileXigu();
const EPS = 1e-6;

/* ---- bounds ---- */
H.near(c.bounds.w, 2048, EPS, 'bounds.w'); H.near(c.bounds.h, 1088, EPS, 'bounds.h');

/* ---- 房屋 sockets / footprint（旧 WORLD.houses 手填绝对坐标 → 新派生值） ---- */
const HOUSES = {
  mill:    { anchor: [600, 640], door: [566, 595], fp: [450, 335, 750, 640],
    wins: [[508, 533, 0.30], [661, 547, 0.44], [702, 537, 0.52]], chimney: [502, 388], rate: 1.0 },
  cottage1:{ anchor: [285, 700], door: [323, 655], fp: [160, 478, 410, 700],
    wins: [[204, 608, 0.26], [247, 615, 0.50], [367, 602, 0.40]], chimney: null },
  cottage2:{ anchor: [1680, 675], door: [1727, 630], fp: [1550, 441, 1810, 675],
    wins: [[1596, 541, 0.36], [1738, 535, 0.56], [1767, 586, 0.46]], chimney: [1622, 460], rate: 0.75 }
};
for (const id of Object.keys(HOUSES)) {
  const exp = HOUSES[id], ent = c.entities[id];
  H.near(ent.transform.x, exp.anchor[0], EPS, id + ' transform.x');
  H.near(ent.transform.y, exp.anchor[1], EPS, id + ' transform.y');
  const d = c.socketOf(id, 'door');
  H.near(d.x, exp.door[0], EPS, id + '.door.x'); H.near(d.y, exp.door[1], EPS, id + '.door.y');
  exp.wins.forEach((w, i) => {
    const s = c.socketOf(id, 'win' + i);
    H.near(s.x, w[0], EPS, id + '.win' + i + '.x');
    H.near(s.y, w[1], EPS, id + '.win' + i + '.y');
    H.near(s.th, w[2], EPS, id + '.win' + i + '.th');
  });
  if (exp.chimney) {
    const ch = c.socketOf(id, 'chimney');
    H.near(ch.x, exp.chimney[0], EPS, id + '.chimney.x');
    H.near(ch.y, exp.chimney[1], EPS, id + '.chimney.y');
  } else {
    H.ok(!c.socketOf(id, 'chimney'), id + ' 不应有 chimney');
  }
  const fp = ent.footprintWorld;
  const xs = fp.map(p => p[0]), ys = fp.map(p => p[1]);
  H.near(Math.min(...xs), exp.fp[0], EPS, id + ' footprint x0');
  H.near(Math.min(...ys), exp.fp[1], EPS, id + ' footprint y0');
  H.near(Math.max(...xs), exp.fp[2], EPS, id + ' footprint x1');
  H.near(Math.max(...ys), exp.fp[3], EPS, id + ' footprint y1');
}

/* ---- 炊烟派生表（旧 WORLD.chimneys） ---- */
H.ok(c.chimneys.length === 2, 'chimneys 应为 2');
H.near(c.chimneys[0].x, 502, EPS, 'chimney0.x'); H.near(c.chimneys[0].y, 388, EPS, 'chimney0.y');
H.near(c.chimneys[0].rate, 1.0, EPS, 'chimney0.rate');
H.near(c.chimneys[1].x, 1622, EPS, 'chimney1.x'); H.near(c.chimneys[1].y, 460, EPS, 'chimney1.y');
H.near(c.chimneys[1].rate, 0.75, EPS, 'chimney1.rate');

/* ---- 灯笼灯头（旧派生公式快照：ax ± 130×(w/408)，ay − 653×(w/408)） ---- */
const L1 = { ax: 810, ay: 615, w: 54, flip: true }, L2 = { ax: 740, ay: 815, w: 63, flip: false };
const s1 = L1.w / 408, s2 = L2.w / 408;
const h1 = c.socketOf('lantern1', 'head'), h2 = c.socketOf('lantern2', 'head');
H.near(h1.x, L1.ax - 130 * s1, EPS, 'lantern1.head.x'); H.near(h1.y, L1.ay - 653 * s1, EPS, 'lantern1.head.y');
H.near(h2.x, L2.ax + 130 * s2, EPS, 'lantern2.head.x'); H.near(h2.y, L2.ay - 653 * s2, EPS, 'lantern2.head.y');

/* ---- 大树 canopy / leafZone（旧 WORLD.tree） ---- */
const can = c.socketOf('tree', 'canopy');
H.near(can.x, 1150, EPS, 'canopy.x'); H.near(can.y, 395, EPS, 'canopy.y'); H.near(can.r, 250, EPS, 'canopy.r');
const lz = c.entities.tree.zonesWorld.leafSpawn;
H.near(lz.x0, 980, EPS, 'leafZone.x0'); H.near(lz.x1, 1330, EPS, 'leafZone.x1');
H.near(lz.y, 500, EPS, 'leafZone.y'); H.near(lz.dy, 28, EPS, 'leafZone.dy');

/* ---- 秋千（旧 WORLD.swing） ---- */
const sw = c.entities.swing;
H.near(sw.transform.x, 1090, EPS, 'swing.x'); H.near(sw.transform.y, 416, EPS, 'swing.y');
H.near(sw.props.rope, 90, EPS, 'swing.rope'); H.near(sw.props.seatW, 22, EPS, 'swing.seatW');
const st = c.socketOf('swing', 'stand');
H.near(st.x, 1090, EPS, 'stand.x'); H.near(st.y, 514, EPS, 'stand.y');

/* ---- 桥（旧 WORLD.bridge：锚点 + sortY） ---- */
H.near(c.entities.bridge.transform.x, 640, EPS, 'bridge.x');
H.near(c.entities.bridge.transform.y, 770, EPS, 'bridge.y');
H.near(c.surfaceById('bridgeDeck').occlusion.sortY, 770, EPS, 'deck sortY');

/* ---- 坐姿点 / 鱼区（旧 sitSpot / fishArea） ---- */
H.near(c.zones.sitSpot.x, 450, EPS, 'sitSpot.x'); H.near(c.zones.sitSpot.y, 725, EPS, 'sitSpot.y');
H.near(c.zones.sitSpot.dir[0], 0.85, EPS, 'sitSpot.dir0'); H.near(c.zones.sitSpot.dir[1], 0.5, EPS, 'sitSpot.dir1');
H.near(c.zones.fishArea.x, 1450, EPS, 'fishArea.x'); H.near(c.zones.fishArea.y, 880, EPS, 'fishArea.y');
H.near(c.zones.fishArea.rx, 340, EPS, 'fishArea.rx'); H.near(c.zones.fishArea.ry, 100, EPS, 'fishArea.ry');

/* ---- 水系（旧 streamCtrl / pond / falls / fallsPool） ---- */
const stream = c.waterById('stream');
const OLD_CTRL = [
  [430, 555], [445, 600], [440, 650], [465, 690], [520, 712], [580, 735], [640, 775],
  [640, 815], [625, 860], [630, 900], [680, 935], [760, 955], [920, 945]];
H.ok(stream.ctrl.length === OLD_CTRL.length, 'stream ctrl 数量');
OLD_CTRL.forEach((p, i) => {
  H.near(stream.ctrl[i][0], p[0], EPS, 'streamCtrl[' + i + '].x');
  H.near(stream.ctrl[i][1], p[1], EPS, 'streamCtrl[' + i + '].y');
});
/* 密折线 = 旧 streamPts（同一 catmull 算法重算对照） */
const expPts = catmull(OLD_CTRL, 10);
H.ok(stream.pts.length === expPts.length, 'stream 密点数量 ' + stream.pts.length);
expPts.forEach((p, i) => {
  H.near(stream.pts[i][0], p[0], EPS, 'streamPts[' + i + '].x');
  H.near(stream.pts[i][1], p[1], EPS, 'streamPts[' + i + '].y');
});
const pond = c.waterById('pond');
H.near(pond.x, 1450, EPS, 'pond.x'); H.near(pond.y, 870, EPS, 'pond.y');
H.near(pond.rx, 460, EPS, 'pond.rx'); H.near(pond.ry, 165, EPS, 'pond.ry');
const fp2 = c.waterById('fallsPool');
H.near(fp2.x, 430, EPS, 'fallsPool.x'); H.near(fp2.y, 555, EPS, 'fallsPool.y');
const fU = c.waterById('fallsUpper'), fM = c.waterById('fallsMain');
H.near(fU.x0, 240, EPS, 'fallsUpper.x0'); H.near(fU.y0, 232, EPS, 'fallsUpper.y0');
H.near(fU.x1, 330, EPS, 'fallsUpper.x1'); H.near(fU.y1, 300, EPS, 'fallsUpper.y1');
H.near(fM.x0, 375, EPS, 'fallsMain.x0'); H.near(fM.y0, 390, EPS, 'fallsMain.y0');
H.near(fM.x1, 505, EPS, 'fallsMain.x1'); H.near(fM.y1, 540, EPS, 'fallsMain.y1');

/* ---- nav 节点（旧 WORLD.nodes 17 个 + face） ---- */
const OLD_NODES = {
  A: [578, 600], B: [720, 700, [0.3, 0.95]], C: [526, 726, [0.45, 0.9]], Cb: [510, 621],
  Db: [794, 690], D: [745, 745, [-0.4, 0.9]], E: [900, 665], F: [1150, 555, [0.2, -1]],
  G: [1400, 640, [0.9, 0.4]], H: [1700, 655], I: [1098, 700, [0.6, 0.8]], J: [320, 672],
  K: [310, 940, [0.4, 0.9]], M: [718, 804, [0.2, 1]], N: [900, 758], S: [1090, 514],
  W: [1495, 704, [0.7, 0.7]]
};
const ids = Object.keys(c.nav.nodes);
H.ok(ids.length === 17, '节点数 17，实际 ' + ids.length);
H.ok(ids.join(',') === Object.keys(OLD_NODES).join(','), '节点顺序须与 V4.7 一致（居民初始轮转依赖）');
for (const k of Object.keys(OLD_NODES)) {
  const n = c.nav.nodes[k], o = OLD_NODES[k];
  H.near(n.x, o[0], EPS, 'node ' + k + '.x'); H.near(n.y, o[1], EPS, 'node ' + k + '.y');
  if (o[2]) { H.near(n.face[0], o[2][0], EPS, 'node ' + k + '.face0'); H.near(n.face[1], o[2][1], EPS, 'node ' + k + '.face1'); }
}

/* ---- 边路线（旧 MID 途经点表重算对照 + 全长 spot） ---- */
const OLD_MID = {
  'A>B': [[628, 640], [668, 670]],
  'A>C': [[556, 606], [540, 614], [530, 628], [528, 644], [530, 660], [535, 676], [537, 692], [530, 708]],
  'B>D': [[736, 722]],
  'C>Cb': [[528, 706], [536, 688], [535, 670], [530, 654], [522, 638], [513, 626]],
  'Cb>Db': [[552, 636], [612, 632], [678, 640], [726, 660], [766, 680]],
  'Db>D': [[775, 712], [758, 728]],
  'C>J': [[480, 722], [440, 718], [400, 714], [364, 712], [340, 706], [330, 692], [326, 678]],
  'C>K': [[496, 734], [466, 754], [436, 782], [404, 816], [372, 852], [344, 892], [322, 918]],
  'D>M': [[736, 774]], 'D>E': [[826, 700]], 'M>N': [[756, 820], [824, 798]],
  'E>N': [[910, 714]], 'N>I': [[952, 740], [1020, 722]],
  'E>F': [[958, 642], [1030, 606]], 'E>G': [[1050, 652], [1150, 650], [1280, 646]],
  'G>H': [[1480, 646], [1560, 650], [1622, 652]], 'F>S': [[1118, 538]],
  'I>W': [[1208, 690], [1328, 686], [1418, 694]], 'W>H': [[1558, 700], [1624, 678]]
};
for (const key of Object.keys(OLD_MID)) {
  const pts = c.nav.routeOf[key];
  H.ok(!!pts, '缺 route ' + key);
  const [a, b] = key.split('>');
  const A = OLD_NODES[a], B = OLD_NODES[b];
  const exp = catmull([[A[0], A[1]]].concat(OLD_MID[key], [[B[0], B[1]]]), 7);
  H.ok(pts.length === exp.length, key + ' 密点数量');
  for (let i = 0; i < exp.length; i++) {
    H.near(pts[i][0], exp[i][0], EPS, key + '[' + i + '].x');
    H.near(pts[i][1], exp[i][1], EPS, key + '[' + i + '].y');
  }
}

/* ---- 邻接关系（旧 WORLD.adj，按集合比较） ---- */
const OLD_ADJ = {
  A: ['B', 'C'], B: ['A', 'D'], C: ['Cb', 'J', 'K', 'A'], Cb: ['C', 'Db'], Db: ['Cb', 'D'],
  D: ['Db', 'B', 'M', 'E'], E: ['D', 'F', 'G', 'N'], F: ['E', 'S'], G: ['E', 'H'],
  H: ['G', 'W'], I: ['N', 'W'], J: ['C'], K: ['C'], M: ['D', 'N'], N: ['M', 'E', 'I'],
  S: ['F'], W: ['I', 'H']
};
for (const k of Object.keys(OLD_ADJ)) {
  H.ok(H.stableStringify(c.nav.adj[k].slice().sort()) === H.stableStringify(OLD_ADJ[k].slice().sort()),
    'adj[' + k + '] 与 V4.7 不一致: ' + c.nav.adj[k]);
}

/* ---- binding 渲染资产表（旧 WORLD.assets/staticAssets/dynAssets 同构核对） ---- */
const assets = XB.build(c);
H.ok(assets.length === 31, '渲染资产 31，实际 ' + assets.length);
H.ok(XB.staticAssets.length === 8, 'staticAssets 8（三屋+井+篱×2+花×2）');
H.ok(XB.dynAssets.length === 23, 'dynAssets 23');
/* 旧 dynAssets 锚点序 spot-check */
const order = ['tree', 'wheel', 'bridge', 'bush1a', 'bush1b', 'bush2a', 'bush2b', 'rocksA', 'rocksB',
  'grassA', 'grassB', 'grassC', 'grassD', 'grassE', 'lantern1', 'lantern2',
  'bush2c', 'rocksC', 'grassF', 'grassG', 'fenceC', 'grassH', 'rocksD'];
H.ok(XB.dynAssets.map(a => a.entId).join(',') === order.join(','), 'dynAssets 顺序须与 V4.7 一致（Y-sort 稳定序）');
const tree = XB.dynAssets.find(a => a.entId === 'tree');
H.near(tree.ax, 1150, EPS, 'tree.ax'); H.near(tree.ay, 525, EPS, 'tree.ay');
H.near(tree.s, 540 / (1342 - 85), EPS, 'tree.s');
H.ok(tree.srcA[0] === 646 && tree.srcA[1] === 975, 'tree pivot');
/* staticAssets 按 ay 升序（烘焙序） */
for (let i = 1; i < XB.staticAssets.length; i++) {
  H.ok(XB.staticAssets[i].ay >= XB.staticAssets[i - 1].ay, 'staticAssets 按 ay 升序');
}
console.log('t7 visual baseline OK（全量数值逐项全等）');
