'use strict';
/* t2 — socket follow：house.transform.x += 50 → 全部 socket/footprint/门 portal world +50 */
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
/* 其它实体不动 */
H.near(c2.socketOf('cottage1', 'door').x, c1.socketOf('cottage1', 'door').x, 1e-9, 'cottage1 不受影响');

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
