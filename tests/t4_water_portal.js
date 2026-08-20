'use strict';
/* t4 — water portal：不经桥/浅滩跨水 → throw；经桥合法且跨越段在 deck 上 */
const H = require('./helpers.js');
H.loadCore(); H.loadMaps();

const c = H.compileXigu();

/* ① 直线 C→D（横跨溪湾，不经桥）→ 必须 throw */
H.throws(() => WC.validation.validateRoute(c, [[526, 726], [745, 745]], 'cheat C>D'),
  '不经桥直线跨水必须 throw');

/* ② 经桥：C→Cb→Db→D 三条 hint 边全部合法（compile 已保证，显式复核） */
for (const id of ['C>Cb', 'Cb>Db', 'Db>D']) {
  WC.validation.validateRoute(c, c.nav.routeOf[id], 'edge ' + id);
}
/* 跨越段（Cb>Db）中点落在 deck surface，且 deck 声明了 crossesWater 端 portal */
const deckEdge = c.nav.edges.find(e => e.id === 'Cb>Db');
const mid = deckEdge.routePts[Math.floor(deckEdge.routePts.length / 2)];
const surf = c.surfaceAt(mid[0], mid[1]);
H.ok(surf && surf.id === 'bridgeDeck', 'Cb>Db 中点应在 bridgeDeck，实际 ' + (surf && surf.id));
H.ok(surf.tags.indexOf('deck') >= 0, 'bridgeDeck 必须带 deck tag');
H.ok(deckEdge.isDeck === true, 'Cb>Db 应为 deck 成员边');
const bw = c.portals.find(p => p.id === 'bridgeW'), be = c.portals.find(p => p.id === 'bridgeE');
H.ok(bw.crossesWater && be.crossesWater, '桥两端 portal 必须 crossesWater');
/* 引道边不是 deck（V4.7 语义：只有 Cb>Db 全程在桥面绘制序之后） */
H.ok(c.nav.edges.find(e => e.id === 'C>Cb').isDeck === false, 'C>Cb 不是 deck 边');
H.ok(c.nav.edges.find(e => e.id === 'Db>D').isDeck === false, 'Db>D 不是 deck 边');

/* ③ 桥东堍东侧直线跨下游溪 → throw（无 portal） */
H.throws(() => WC.validation.validateRoute(c, [[700, 700], [640, 800]], 'cheat D>stream'),
  '桥东侧直线入下游溪必须 throw');

/* ④ fixture 同规则：直穿水渠 throw / 经桥合法 */
const m = H.compileMini();
H.throws(() => WC.validation.validateRoute(m, [[60, 250], [340, 250]], 'cheat across channel'),
  'fixture 直穿水渠必须 throw');
WC.validation.validateRoute(m, m.nav.routeOf['Q>R'], 'fixture Q>R');
const mmid = m.nav.routeOf['Q>R'][Math.floor(m.nav.routeOf['Q>R'].length / 2)];
H.ok(m.surfaceAt(mmid[0], mmid[1]).id === 'miniDeck', 'fixture 跨越段应在 miniDeck');
console.log('t4 water portal OK');
