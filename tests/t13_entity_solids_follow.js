'use strict';
/* t13 — entity-owned solids：移动 tree/fenceA/rocksC transform →
 * treeRoot/fenceAObs/rocksCObs 碰撞体逐点跟随；世界固定 cliff 不动。
 * 并断言命中查询（WC.obstacle.contains）在新旧位置的正确性。 */
const H = require('./helpers.js');
H.loadCore(); H.loadMaps();

const c1 = H.compileXigu();

const MOVES = [
  ['tree', 'treeRoot', 30, -12],
  ['fenceA', 'fenceAObs', -130, 8],   // 位移须大于 solid 尺寸，保证旧位置完全离开
  ['rocksC', 'rocksCObs', 14, 20]
];
for (const [entId, solidId, dx, dy] of MOVES) {
  const def2 = H.clone(MAP_XIGU);
  for (const e of def2.entities) if (e.id === entId) { e.transform.x += dx; e.transform.y += dy; }
  const c2 = WC.compile(def2);
  const o1 = c1.obstacles.find(o => o.id === solidId);
  const o2 = c2.obstacles.find(o => o.id === solidId);
  H.ok(o1 && o2, solidId + ' 必须存在于 compiled.obstacles');
  H.ok(o2.owner === entId, solidId + ' owner 应为 ' + entId);
  H.ok(o1.polygon.length === o2.polygon.length, solidId + ' 顶点数不变');
  for (let i = 0; i < o1.polygon.length; i++) {
    H.near(o2.polygon[i][0] - o1.polygon[i][0], dx, 1e-9, solidId + '[' + i + '] x 应 +' + dx);
    H.near(o2.polygon[i][1] - o1.polygon[i][1], dy, 1e-9, solidId + '[' + i + '] y 应 +' + dy);
  }
  /* 命中查询：质心采样（注意实体 solid 间可重叠，如 fenceCObs/rocksCObs，
   * 故断言「该 solid polygon 含点」而非「contains 首个命中即它」） */
  let cx = 0, cy = 0;
  for (const p of o1.polygon) { cx += p[0]; cy += p[1]; }
  cx /= o1.polygon.length; cy /= o1.polygon.length;
  H.ok(WC.geometry.pointInPoly(cx, cy, o1.polygon), solidId + ' 旧位置应在自身 polygon 内');
  H.ok(WC.geometry.pointInPoly(cx + dx, cy + dy, o2.polygon), solidId + ' 新位置应在自身 polygon 内');
  H.ok(!WC.geometry.pointInPoly(cx, cy, o2.polygon), solidId + ' 搬走后旧位置应已离开 polygon');
}

/* 世界固定 cliff 不受任何实体移动影响 */
const def3 = H.clone(MAP_XIGU);
for (const e of def3.entities) if (e.id === 'tree') e.transform.x += 30;
const c3 = WC.compile(def3);
const k1 = c1.obstacles.find(o => o.id === 'cliffMidW');
const k3 = c3.obstacles.find(o => o.id === 'cliffMidW');
H.near(k3.polygon[0][0], k1.polygon[0][0], 1e-9, 'cliffMidW 为世界固定，不应跟随 tree');

/* map.js 源码级断言：实体拥有的 obstacle id 不再出现为 top-level obstacles */
const src = H.src('js/maps/xigu/map.js');
const top = src.slice(src.indexOf('obstacles:'), src.indexOf('entities:'));
for (const id of ['millBody', 'cot1Body', 'cot2Body', 'treeRoot', 'fenceAObs',
  'fenceBObs', 'fenceCObs', 'wellBase', 'rocksAObs', 'rocksCObs', 'rocksDObs']) {
  H.ok(top.indexOf("id: '" + id + "'") < 0, id + ' 不应再是 top-level obstacle');
}
console.log('t13 entity solids follow OK');
