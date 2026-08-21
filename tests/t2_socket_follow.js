'use strict';
/* t2 — socket follow：house.transform.x += 50 → 全部 socket/footprint/门 portal
 * world +50；V4.9 起实体 solid（millBody 碰撞体）同样必须 +50。 */
const H = require('./helpers.js');
H.loadCore(); H.loadMaps();

const c1 = H.compileXigu();
const def2 = H.clone(MAP_XIGU);
for (const e of def2.entities) if (e.id === 'mill') e.transform.x += 50;
const c2 = WC.compile(def2);

for (const name of ['door', 'win0', 'win1', 'win2', 'chimney']) {
  const a = c1.socketOf('mill', name), b = c2.socketOf('mill', name);
  H.near(b.x - a.x, 50, 1e-9, 'mill.' + name + ' x 应 +50');
  H.near(b.y - a.y, 0, 1e-9, 'mill.' + name + ' y 不变');
}
const f1 = c1.entities.mill.footprintWorld, f2 = c2.entities.mill.footprintWorld;
for (let i = 0; i < f1.length; i++) {
  H.near(f2[i][0] - f1[i][0], 50, 1e-9, 'footprint[' + i + '] x 应 +50');
  H.near(f2[i][1], f1[i][1], 1e-9, 'footprint[' + i + '] y 不变');
}
/* 门 portal 是 socket 引用 → 同步跟随（无第二份绝对坐标） */
const p1 = c1.portals.find(p => p.id === 'doorMill');
const p2 = c2.portals.find(p => p.id === 'doorMill');
H.near(p2.at.x - p1.at.x, 50, 1e-9, 'doorMill portal 应跟随房屋 transform');
/* V4.9：屋身碰撞体 = 实体 local solid → 同样跟随（评审漏洞：磨坊搬家墙留旧地址） */
const o1 = c1.obstacles.find(o => o.id === 'millBody');
const o2 = c2.obstacles.find(o => o.id === 'millBody');
H.ok(o1 && o2, 'millBody obstacle 必须存在（实体 solid 派生）');
H.ok(o2.owner === 'mill', 'millBody obstacle owner 应为 mill');
for (let i = 0; i < o1.polygon.length; i++) {
  H.near(o2.polygon[i][0] - o1.polygon[i][0], 50, 1e-9, 'millBody[' + i + '] x 应 +50');
  H.near(o2.polygon[i][1], o1.polygon[i][1], 1e-9, 'millBody[' + i + '] y 不变');
}
/* 其它实体不动 */
H.near(c2.socketOf('cottage1', 'door').x, c1.socketOf('cottage1', 'door').x, 1e-9, 'cottage1 不受影响');
H.near(c2.obstacles.find(o => o.id === 'cot1Body').polygon[0][0],
  c1.obstacles.find(o => o.id === 'cot1Body').polygon[0][0], 1e-9, 'cot1Body 不受影响');

/* map.js 内 door/window socket 不得出现绝对世界坐标（local 必须为小数值） */
for (const e of MAP_XIGU.entities) {
  for (const k of Object.keys(e.sockets || {})) {
    if (!/^(door|win)/.test(k)) continue;
    const s = e.sockets[k];
    H.ok(Math.abs(s.x) <= 200 && Math.abs(s.y) <= 320,
      e.id + '.' + k + ' 疑似绝对坐标 (' + s.x + ',' + s.y + ')');
  }
}
console.log('t2 socket follow OK');
