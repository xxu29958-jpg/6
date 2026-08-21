'use strict';
/* t15 — Binding Acceptance Layer：装配线 = Physical World → Render Binding
 * → Binding Compiler → Accept/Reject → Compiled Render Scene。
 * 断言：正常世界 Accept；五类违例各自 Reject（throw）；t1 式美术微调不误伤。 */
const H = require('./helpers.js');
H.loadCore(); H.loadMaps(); H.loadBinding();

/* ---------- 正常世界：Accept ---------- */
const c0 = H.compileXigu();
H.ok(XB.validate(c0) === true, '正常溪谷世界必须通过 Binding Acceptance');
const scene = XB.compile(c0);
H.ok(scene.assets.length === 31 && scene.dynAssets.length === 23 && scene.staticAssets.length === 8,
  'Compiled Render Scene 资产数 31/23/8');

/* ---------- [bind-orphan]：绑定指向不存在的实体 ---------- */
{
  const def = H.clone(MAP_XIGU);
  def.entities = def.entities.filter(e => e.id !== 'well');
  const c = WC.compile(def);
  const err = H.throws(() => XB.validate(c), '删除 well 实体后 validate 必须 throw');
  H.ok(err.message.indexOf('[bind-orphan]') >= 0 && err.message.indexOf('well') >= 0,
    '应为 [bind-orphan] well（实际: ' + err.message + '）');
}

/* ---------- [bind-missing]：物理实体缺少绑定 ---------- */
{
  const def = H.clone(MAP_XIGU);
  def.entities.push({ id: 'ghostRock', transform: { x: 1000, y: 800 } });
  const c = WC.compile(def);
  const err = H.throws(() => XB.validate(c), '新增无绑定实体后 validate 必须 throw');
  H.ok(err.message.indexOf('[bind-missing]') >= 0 && err.message.indexOf('ghostRock') >= 0,
    '应为 [bind-missing] ghostRock（实际: ' + err.message + '）');
  /* 白名单豁免：swing 无 PNG（程序化绘制）不触发 */
  H.ok(XB.procedural.indexOf('swing') >= 0, 'swing 必须在 procedural 白名单');
}

/* ---------- [bind-pivot]：pivot 超出 bbox 容差 ---------- */
{
  const keep = XB.entities.tree.pivot;
  XB.entities.tree.pivot = [5000, 5000];
  const err = H.throws(() => XB.validate(c0), '荒谬 pivot 必须 throw');
  H.ok(err.message.indexOf('[bind-pivot]') >= 0, '应为 [bind-pivot]（实际: ' + err.message + '）');
  XB.entities.tree.pivot = keep;
  H.ok(XB.validate(c0), '恢复后必须通过');
}

/* ---------- [bind-footprint]：视觉宽度与物理 footprint 严重不符 ---------- */
{
  const keep = XB.entities.mill.w;
  XB.entities.mill.w = 900;                    // 900/300 = 3.0 > 1.6
  const err = H.throws(() => XB.validate(c0), 'w=900 必须 throw');
  H.ok(err.message.indexOf('[bind-footprint]') >= 0, '应为 [bind-footprint]（实际: ' + err.message + '）');
  /* t1 式美术微调（w=310，ratio 1.033）不误伤 */
  XB.entities.mill.w = 310;
  H.ok(XB.validate(c0), 't1 式微调（w=310）必须仍通过 Acceptance');
  XB.entities.mill.w = keep;
}

/* ---------- [bind-deck]：桥精灵与 deck surface 错位 ---------- */
{
  const keep = XB.entities.bridge.w;
  XB.entities.bridge.w = 100;                  // 精灵缩到 100 → 重叠 < 60% 桥面宽
  const err = H.throws(() => XB.validate(c0), '桥精灵 w=100 必须 throw');
  H.ok(err.message.indexOf('[bind-deck]') >= 0, '应为 [bind-deck]（实际: ' + err.message + '）');
  XB.entities.bridge.w = keep;
  H.ok(XB.validate(c0), '恢复后必须通过');
}

/* ---------- t1 式 bbox/pivot 篡改不误伤（acceptance 阈值与隔离测试兼容） ---------- */
{
  const kb = XB.images.tree.bbox, kp = XB.entities.tree.pivot;
  XB.images.tree.bbox = [80, 40, 1350, 980];
  XB.entities.tree.pivot = [640, 970];
  H.ok(XB.validate(c0), 't1 式 tree bbox/pivot 篡改必须仍通过 Acceptance');
  XB.images.tree.bbox = kb; XB.entities.tree.pivot = kp;
}
console.log('t15 binding acceptance OK（5 类违例全部 throw，正常世界与 t1 式微调 Accept）');
