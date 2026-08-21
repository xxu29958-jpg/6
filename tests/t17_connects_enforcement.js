'use strict';
/* t17 — portal.connects 真执行：跨水 run 的入口/出口干岸 surface 必须 ∈
 * 覆盖 portal 的 connects（无序）。
 * 溪谷活体案例 = fordW（全部涉水边由它覆盖）；bridgeW/E 为 deck 保险 portal
 * （当前 authored 路线在其半径内无湿采样，connects 语义同样受校验器约束）。
 * 另用内联合成世界直接驱动入口/出口两种失配；并断言两图无空 connects 声明。 */
const H = require('./helpers.js');
H.loadCore(); H.loadMaps();

/* ---------- 正常世界：connects 声明与几何一致，编译通过 ---------- */
const c = H.compileXigu();
H.compileMini();

/* ---------- 活体反例：fordW.connects 改成不相关 surface → compile throw ----------
 * 边 C>Cb / A>C / C>J / C>K 的湿 run 均由 fordW 覆盖，入口/出口 surface = 'low' */
for (const bad of [['high'], ['mid'], ['bridgeDeck']]) {
  const def = H.clone(MAP_XIGU);
  for (const p of def.portals) if (p.id === 'fordW') p.connects = bad;
  const err = H.throws(() => WC.compile(def), 'fordW.connects=' + JSON.stringify(bad) + ' 必须 throw');
  H.ok(err.message.indexOf('fordW') >= 0 && err.message.indexOf('connects') >= 0,
    '拒绝信息须含 fordW 与 connects（实际: ' + err.message + '）');
}

/* ---------- 合成世界：入口失配与出口失配分别 throw ----------
 * 两块台地 a/b + 一条竖渠 + 一个跨水 portal（connects 可篡改），
 * 直路线 a → 湿 run（portal 覆盖）→ b。 */
function synthWorld(connects) {
  return {
    id: 'synth', bounds: { w: 200, h: 100 },
    surfaces: [
      { id: 'a', elevation: 0, walkable: true, polygon: [[0, 0], [100, 0], [100, 100], [0, 100]] },
      { id: 'b', elevation: 0, walkable: true, polygon: [[100, 0], [200, 0], [200, 100], [100, 100]] }
    ],
    waters: [{ id: 'cut', kind: 'ribbon', ctrl: [[100, 10], [100, 90]], half: [8, 8], per: 4 }],
    obstacles: [],
    entities: [],
    portals: [{ id: 'cross', at: { x: 100, y: 50 }, r: 20, connects: connects,
      elevations: [0, 0], crossesWater: true }],
    zones: {},
    nav: { nodes: { P: { x: 60, y: 50 }, Q: { x: 140, y: 50 } },
      edges: [{ a: 'P', b: 'Q' }], extraRoutes: [] }
  };
}
H.ok(!!WC.compile(synthWorld(['a', 'b'])), 'connects=[a,b] 应通过');
{
  const err = H.throws(() => WC.compile(synthWorld(['b'])), '入口 a 不在 connects 必须 throw');
  H.ok(err.message.indexOf('cross') >= 0 && err.message.indexOf('入口') >= 0,
    '应为入口失配（实际: ' + err.message + '）');
}
{
  const err = H.throws(() => WC.compile(synthWorld(['a'])), '出口 b 不在 connects 必须 throw');
  H.ok(err.message.indexOf('cross') >= 0 && err.message.indexOf('出口') >= 0,
    '应为出口失配（实际: ' + err.message + '）');
}
/* 无序：connects=[b,a] 与 [a,b] 等价 */
H.ok(!!WC.compile(synthWorld(['b', 'a'])), 'connects 无序匹配');

/* ---------- 两图所有 portal 必须显式声明 connects（≥2 端） ---------- */
for (const p of MAP_XIGU.portals) {
  H.ok(p.connects && p.connects.length >= 2, '溪谷 portal ' + p.id + ' 必须声明 connects');
}
for (const p of MAP_FIXTURE_MINI.portals) {
  H.ok(p.connects && p.connects.length >= 2, 'fixture portal ' + p.id + ' 必须声明 connects');
}

/* ---------- 「声明即几何」：活体跨水 portal 半径内确有水体 ----------
 * （deck-end 保险 portal 豁免：其职责是让 deck 两端节点恒为干岸） */
for (const p of c.portals) {
  if (!p.crossesWater || p.tags.indexOf('deck-end') >= 0) continue;
  let found = false;
  for (let a = 0; a < 32 && !found; a++) {
    for (const rr of [p.r * 0.3, p.r * 0.6, p.r * 0.95]) {
      if (c.waterAt(p.at.x + Math.cos(a / 16 * Math.PI) * rr,
                    p.at.y + Math.sin(a / 16 * Math.PI) * rr)) { found = true; break; }
    }
  }
  H.ok(found, 'crossesWater portal ' + p.id + ' 半径内必须真有水体');
}
console.log('t17 connects enforcement OK（fordW×3 篡改 + 合成世界入口/出口失配全部 throw）');
