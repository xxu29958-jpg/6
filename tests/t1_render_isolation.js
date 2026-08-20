'use strict';
/* t1 — render isolation：改 binding（bbox/pivot/世界宽度）→ physical hash 不变 */
const H = require('./helpers.js');
H.loadCore(); H.loadMaps(); H.loadBinding();

const c1 = H.compileXigu();
const h1 = H.stableHash(c1);
const assets1 = XB.build(c1);
const tree1 = assets1.find(a => a.entId === 'tree');

/* 篡改 binding 渲染参数（模拟 PNG 改裁切/换 pivot/改视觉宽度） */
XB.images.tree.bbox = [80, 40, 1350, 980];
XB.entities.tree.pivot = [640, 970];
XB.entities.mill.w = 310;

const c2 = H.compileXigu();          // 物理重编译
const h2 = H.stableHash(c2);
const assets2 = XB.build(c2);
const tree2 = assets2.find(a => a.entId === 'tree');

H.ok(h1 === h2, 'binding 变更后 physical stableHash 必须不变 (' + h1 + ' vs ' + h2 + ')');
H.ok(tree1.s !== tree2.s || tree1.srcA[0] !== tree2.srcA[0], '渲染记录应确实变化（证明 binding 生效）');
H.ok(tree1.ax === tree2.ax && tree1.ay === tree2.ay, '实体 transform 不受 binding 影响');

/* binding 数据不进入 compiled（compiled 无 img/bbox/sway/spin 字段） */
const e = c2.entities.tree;
H.ok(!('img' in e) && !('bbox' in e) && !('sway' in e), 'compiled 实体不得含渲染字段');
console.log('t1 render isolation OK (hash=' + h1 + ')');
