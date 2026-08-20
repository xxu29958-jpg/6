'use strict';
/* t11 — second map fixture：同一 core 零改动编译第二张 synthetic map，
 * 覆盖 socket 派生 / Dijkstra / 水拒绝 / 障碍拒绝 / portal 跨水 / elevation 校验 */
const H = require('./helpers.js');
H.loadCore(); H.loadMaps();

const m = H.compileMini();

/* bounds & 结构 */
H.near(m.bounds.w, 400, 1e-9, 'mini bounds.w');
H.ok(m.nav.edges.length === 4 && Object.keys(m.nav.nodes).length === 5, 'mini 结构');

/* socket 派生 + 跟随 */
const d1 = m.socketOf('hut', 'door');
H.near(d1.x, 105, 1e-9, 'hut door x'); H.near(d1.y, 102, 1e-9, 'hut door y');
const def2 = H.clone(MAP_FIXTURE_MINI);
def2.entities.find(e => e.id === 'hut').transform.x += 30;
const m2 = WC.compile(def2);
H.near(m2.socketOf('hut', 'door').x - d1.x, 30, 1e-9, 'hut door 跟随 transform');
/* 门 portal 引用 socket → 同步 */
H.near(m2.portals.find(p => p.id === 'doorHut').at.x -
  m.portals.find(p => p.id === 'doorHut').at.x, 30, 1e-9, 'doorHut portal 跟随');

/* Dijkstra：P→T 经桥 */
const r = WC.navigation.dijkstra(m.nav, 'P', 'T');
H.ok(r.path.join('>') === 'P>Q>R>T', 'P→T 应走桥: ' + r.path.join('>'));

/* 水拒绝：不穿桥面板的直线跨渠 throw */
H.throws(() => WC.validation.validateRoute(m, [[60, 250], [340, 250]], 'cheat'), '直穿水渠 throw');
H.throws(() => WC.validation.validateRoute(m, [[150, 60], [260, 60]], 'cheat2'), '渠北直穿 throw');

/* 障碍拒绝：穿过 boulder 的直线 throw */
H.throws(() => WC.validation.validateRoute(m, [[90, 140], [90, 230]], 'through boulder'),
  '穿 obstacle throw');

/* portal 跨水合法 + deck surface 命中 */
WC.validation.validateRoute(m, m.nav.routeOf['Q>R'], 'Q>R');
const mid = m.nav.routeOf['Q>R'][Math.floor(m.nav.routeOf['Q>R'].length / 2)];
H.ok(m.surfaceAt(mid[0], mid[1]).id === 'miniDeck', '跨越段在 miniDeck');
H.ok(m.nav.edges.find(e => e.id === 'Q>R').isDeck, 'Q>R 为 deck 成员边');

/* elevation：R/T 在 elev1 台地；Q→R 跨越 0→1 且有 ramp portal */
H.near(m.surfaceAt(280, 150).elevation, 1, 1e-9, 'R 在 elev1');
H.near(m.surfaceAt(120, 150).elevation, 0, 1e-9, 'Q 在 elev0');
{
  const def3 = H.clone(MAP_FIXTURE_MINI);
  def3.portals = def3.portals.filter(p => p.id !== 'ramp');
  H.throws(() => WC.compile(def3), '删 ramp portal 后 0→1 直连必须 throw');
}

/* 合法 hint 全过（compile 已含） */
for (const e of m.edges ? m.nav.edges : []) WC.validation.validateRoute(m, e.routePts, e.id);
console.log('t11 second map fixture OK（core 零改动）');
