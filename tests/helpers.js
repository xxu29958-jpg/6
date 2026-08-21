'use strict';
/* tests/helpers.js — Node 测试装载与断言工具（无依赖）
 * UMD 文件 require 后自动挂 globalThis；util.js 的导出手动并入全局，
 * 模拟浏览器 script 顺序装载。 */
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');

function loadCore() {
  Object.assign(globalThis, require(path.join(ROOT, 'js/util.js')));
  const files = [
    'js/core/geometry.js', 'js/core/transform.js', 'js/core/entity.js',
    'js/core/surface.js', 'js/core/water.js', 'js/core/obstacle.js',
    'js/core/portal.js', 'js/core/navigation.js', 'js/core/validation.js',
    'js/core/compile.js'
  ];
  for (const f of files) require(path.join(ROOT, f));
}

function loadMaps() {
  require(path.join(ROOT, 'js/maps/xigu/map.js'));
  require(path.join(ROOT, 'js/maps/xigu/behaviour.js'));
  require(path.join(ROOT, 'js/maps/fixture/minimap.js'));
}

function loadBinding() {
  require(path.join(ROOT, 'js/render/canvas/xigu-binding.js'));
}

function loadRenderBase() {
  /* layers.js / camera.js 的 Node 可加载部分（LAYERS 常量 / Camera 类） */
  require(path.join(ROOT, 'js/render/canvas/layers.js'));
  require(path.join(ROOT, 'js/render/canvas/camera.js'));
}

function compileXigu() { return WC.compile(globalThis.MAP_XIGU); }
function compileMini() { return WC.compile(globalThis.MAP_FIXTURE_MINI); }

/* ---------- 断言 ---------- */
function ok(cond, msg) {
  if (!cond) throw new Error('ASSERT FAIL: ' + msg);
}
function near(a, b, eps, msg) {
  if (Math.abs(a - b) > (eps == null ? 1e-6 : eps)) {
    throw new Error('ASSERT FAIL: ' + msg + ' (' + a + ' vs ' + b + ')');
  }
}
function throws(fn, msg) {
  try { fn(); } catch (e) { return e; }
  throw new Error('ASSERT FAIL: 应抛出异常 — ' + msg);
}

/* ---------- stableHash：白名单字段 + key 排序 + float 量化 1e-3 + FNV-1a ----------
 * 只覆盖 compiled 的物理面：bounds/surfaces/waters/obstacles/portals/
 * entities(transform+footprint+sockets+zones)/zones/nav(nodes+edges cost)。
 * binding / runtime state / 函数天然不参与。 */
function stableHash(compiled) {
  const snap = {
    bounds: compiled.bounds,
    surfaces: compiled.surfaces.map(s => ({
      id: s.id, polygon: s.polygon, walkable: s.walkable, elevation: s.elevation, cost: s.cost, tags: s.tags
    })),
    waters: compiled.waters.map(w => {
      const o = { id: w.id, kind: w.kind };
      for (const k of ['ctrl', 'half', 'per', 'x', 'y', 'rx', 'ry', 'r', 'x0', 'y0', 'x1', 'y1']) {
        if (w[k] !== undefined) o[k] = w[k];
      }
      return o;
    }),
    obstacles: compiled.obstacles.map(o => ({ id: o.id, polygon: o.polygon, tags: o.tags })),
    portals: compiled.portals.map(p => ({
      id: p.id, at: p.at, r: p.r, connects: p.connects, elevations: p.elevations,
      crossesWater: p.crossesWater, tags: p.tags
    })),
    entities: Object.keys(compiled.entities).sort().map(id => {
      const e = compiled.entities[id];
      return { id: id, transform: e.transform, footprintWorld: e.footprintWorld,
        socketsWorld: e.socketsWorld, zonesWorld: e.zonesWorld, solidsWorld: e.solidsWorld,
        tags: e.tags, props: e.props };
    }),
    zones: compiled.zones,
    nav: {
      nodes: compiled.nav.nodes,
      edges: compiled.nav.edges.map(e => ({ id: e.id, a: e.a, b: e.b, cost: e.cost, len: e.len, isDeck: e.isDeck }))
    }
  };
  const s = stableStringify(snap);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

function stableStringify(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(Math.round(v * 1000));
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const keys = Object.keys(v).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}

/* 深克隆 map def（篡改测试用） */
function clone(o) { return JSON.parse(JSON.stringify(o)); }

/* 读取源码文本（grep 类断言用） */
function src(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

module.exports = { ROOT, loadCore, loadMaps, loadBinding, loadRenderBase,
  compileXigu, compileMini, ok, near, throws, stableHash, stableStringify, clone, src };
