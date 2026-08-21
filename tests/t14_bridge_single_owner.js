'use strict';
/* t14 — 桥单一 owner：移动 bridge transform → deck surface / 两岸 portal /
 * occlusion.sortY 全部跟随（fixture 与溪谷双侧断言）。
 * fixture：移动后 compile 仍须通过（deck 自带引道压境，余量内容错）。
 * 溪谷：只动 bridge 不动 nav hints → deck/portal/sortY 跟随且 compile 仍通过
 * （hints 是地图 authored 路线，旧桥位走廊仍是合法低台地步道；
 *  入水/穿墙等真正非法的 hints 拒绝由 t6/t17 覆盖）。 */
const H = require('./helpers.js');
H.loadCore(); H.loadMaps();

/* ---------- fixture：miniBridge (+20, +10) ---------- */
const m1 = H.compileMini();
const def2 = H.clone(MAP_FIXTURE_MINI);
for (const e of def2.entities) if (e.id === 'miniBridge') { e.transform.x += 20; e.transform.y += 10; }
const m2 = WC.compile(def2);   // 必须仍然编译通过

const d1 = m1.surfaceById('miniDeck'), d2 = m2.surfaceById('miniDeck');
H.ok(d2.entity === 'miniBridge', 'miniDeck 必须由 miniBridge 实体拥有');
for (let i = 0; i < d1.polygon.length; i++) {
  H.near(d2.polygon[i][0] - d1.polygon[i][0], 20, 1e-9, 'miniDeck[' + i + '] x 应 +20');
  H.near(d2.polygon[i][1] - d1.polygon[i][1], 10, 1e-9, 'miniDeck[' + i + '] y 应 +10');
}
H.near(d2.occlusion.sortY - d1.occlusion.sortY, 10, 1e-9, 'miniDeck sortY 应随 transform.y +10');
const pw1 = m1.portals.find(p => p.id === 'miniBridgeW');
const pw2 = m2.portals.find(p => p.id === 'miniBridgeW');
const pe1 = m1.portals.find(p => p.id === 'miniBridgeE');
const pe2 = m2.portals.find(p => p.id === 'miniBridgeE');
H.near(pw2.at.x - pw1.at.x, 20, 1e-9, 'miniBridgeW x 应 +20');
H.near(pw2.at.y - pw1.at.y, 10, 1e-9, 'miniBridgeW y 应 +10');
H.near(pe2.at.x - pe1.at.x, 20, 1e-9, 'miniBridgeE x 应 +20');

/* ---------- 溪谷：bridge (+100, 0)，hints 不动 ----------
 * 物理跟随：deck polygon/portal/sortY 全部由 transform 派生。
 * compile 仍然通过——旧 hints 描述的路线仍合法（原桥位走廊在低台地、
 * 该路线无水采样），变化的只是 deck 语义；非法情形由 t6/t17 覆盖。 */
const x1 = H.compileXigu();
const def3 = H.clone(MAP_XIGU);
for (const e of def3.entities) if (e.id === 'bridge') e.transform.x += 100;
const x3 = WC.compile(def3);   // 世界仍合法（hints 未入水/未穿墙）

const xd1 = x1.surfaceById('bridgeDeck'), xd3 = x3.surfaceById('bridgeDeck');
H.ok(xd3.entity === 'bridge', 'bridgeDeck 必须由 bridge 实体拥有');
for (let i = 0; i < xd1.polygon.length; i++) {
  H.near(xd3.polygon[i][0] - xd1.polygon[i][0], 100, 1e-9, 'bridgeDeck[' + i + '] x 应 +100');
  H.near(xd3.polygon[i][1], xd1.polygon[i][1], 1e-9, 'bridgeDeck[' + i + '] y 不变');
}
H.near(xd3.occlusion.sortY, xd1.occlusion.sortY, 1e-9, 'transform.y 未动 → sortY 不变');
const xw1 = x1.portals.find(p => p.id === 'bridgeW'), xw3 = x3.portals.find(p => p.id === 'bridgeW');
const xe1 = x1.portals.find(p => p.id === 'bridgeE'), xe3 = x3.portals.find(p => p.id === 'bridgeE');
H.near(xw3.at.x - xw1.at.x, 100, 1e-9, 'bridgeW x 应 +100');
H.near(xe3.at.x - xe1.at.x, 100, 1e-9, 'bridgeE x 应 +100');

/* transform.y +30 → sortY 同步 +30（sortY 无独立权威） */
const def4 = H.clone(MAP_XIGU);
for (const e of def4.entities) if (e.id === 'bridge') e.transform.y += 30;
const x4 = WC.compile(def4);
H.near(x4.surfaceById('bridgeDeck').occlusion.sortY - xd1.occlusion.sortY, 30, 1e-9,
  'bridge.y +30 → deck sortY 应 +30');

/* 对照：溪谷正常编译时 bridgeW/E 世界坐标 = socket 派生（= V4.8 绝对坐标） */
const bw = x1.portals.find(p => p.id === 'bridgeW'), be = x1.portals.find(p => p.id === 'bridgeE');
H.near(bw.at.x, 510, 1e-9, 'bridgeW at.x = 510（socket 派生）');
H.near(bw.at.y, 621, 1e-9, 'bridgeW at.y = 621');
H.near(be.at.x, 794, 1e-9, 'bridgeE at.x = 794');
H.near(be.at.y, 690, 1e-9, 'bridgeE at.y = 690');
const bd = x1.surfaceById('bridgeDeck');
H.near(bd.occlusion.sortY, 770, 1e-9, 'bridgeDeck sortY = 770（派生）');
H.near(bd.polygon[0][0], 495, 1e-9, 'bridgeDeck 首点 x = 495（派生）');
console.log('t14 bridge single owner OK');
