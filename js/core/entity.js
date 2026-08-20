(function (root) {
'use strict';
/* ============================================================
 * core/entity.js — World Core：可定位实体
 * entity def = { id, transform, footprintLocal:[[x,y]..], sockets:{name:{x,y,r?,..}},
 *                zones:{name:{x0,x1,y,dy?}|{x0,y0,x1,y1}}, props:{}, tags:[] }
 * 任何可定位实体只有一个世界 transform；footprint/socket/zone 全部 local，
 * world 坐标由 compile 期派生（本模块），移动 transform 即整体跟随。
 * ============================================================ */
const E = {};

E.socketWorld = function (ent, s) {
  const p = WC.transform.apply(ent.transform, s.x, s.y);
  const out = { x: p.x, y: p.y };
  const sc = WC.transform.scaleOf(ent.transform);
  if (s.r != null) out.r = s.r * sc;
  if (s.th != null) out.th = s.th;          // 地图侧附带的行为阈值（如点亮时刻），原样透传
  return out;
};

E.footprintWorld = function (ent) {
  return (ent.footprintLocal || []).map(function (p) {
    const w = WC.transform.apply(ent.transform, p[0], p[1]);
    return [w.x, w.y];
  });
};

/* local 矩形 zone → world（支持 {x0,x1,y,dy} 与 {x0,y0,x1,y1} 两种形态；flip 时 x 镜像重排） */
E.zoneWorld = function (ent, z) {
  const t = ent.transform, s = WC.transform.scaleOf(t);
  const xa = t.x + (t.flip ? -z.x1 : z.x0) * s;
  const xb = t.x + (t.flip ? -z.x0 : z.x1) * s;
  const out = { x0: Math.min(xa, xb), x1: Math.max(xa, xb) };
  if (z.y != null) { out.y = t.y + z.y * s; if (z.dy != null) out.dy = z.dy * s; }
  if (z.y0 != null) { out.y0 = t.y + z.y0 * s; out.y1 = t.y + z.y1 * s; }
  return out;
};

/* entity def → 派生实体（compile 产物的一部分，非权威） */
E.derive = function (def) {
  const ent = {
    id: def.id,
    transform: { x: def.transform.x, y: def.transform.y,
      scale: WC.transform.scaleOf(def.transform), flip: !!def.transform.flip },
    footprintLocal: def.footprintLocal || null,
    props: def.props || {},
    tags: def.tags || []
  };
  ent.footprintWorld = E.footprintWorld(ent);
  ent.socketsWorld = {};
  for (const k of Object.keys(def.sockets || {})) ent.socketsWorld[k] = E.socketWorld(ent, def.sockets[k]);
  ent.zonesWorld = {};
  for (const k of Object.keys(def.zones || {})) ent.zonesWorld[k] = E.zoneWorld(ent, def.zones[k]);
  return ent;
};

root.WC = root.WC || {};
WC.entity = E;
if (typeof module !== 'undefined') module.exports = E;
})(typeof window !== 'undefined' ? window : globalThis);
