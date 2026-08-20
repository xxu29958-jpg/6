(function (root) {
'use strict';
/* ============================================================
 * core/compile.js — World Core：Map Definition → Compiled World
 * 唯一 authority 是 mapDef；compiled 全部为派生缓存
 * （socketsWorld/footprintWorld/zonesWorld/ribbon 密折线/nav graph/查询函数）。
 * 修改 mapDef 必须重新 compile；任何模块不得回写 compiled 当权威。
 * compile 失败（validation 不过）直接 throw。
 * ============================================================ */

function compile(mapDef) {
  /* ---- 实体派生 ---- */
  const entities = {};
  for (const ed of mapDef.entities) {
    if (entities[ed.id]) throw new Error('[compile] 实体 id 重复: ' + ed.id);
    entities[ed.id] = WC.entity.derive(ed);
  }

  /* ---- surfaces / waters / obstacles（polygon 已是世界坐标，原样持有） ---- */
  const surfaces = mapDef.surfaces.map(function (s) {
    return { id: s.id, polygon: s.polygon, walkable: s.walkable !== false,
      elevation: s.elevation || 0, cost: s.cost == null ? 1 : s.cost,
      tags: s.tags || [], occlusion: s.occlusion || null };
  });
  const waters = mapDef.waters.map(function (w) { return WC.water.prepare(w); });
  const obstacles = (mapDef.obstacles || []).map(function (o) {
    return { id: o.id, polygon: o.polygon, tags: o.tags || [] };
  });

  /* ---- portal：socket 引用解析为 at（跟随实体 transform） ---- */
  const portals = (mapDef.portals || []).map(function (p) {
    let at = p.at;
    if (!at && p.socket) {
      const ent = entities[p.socket[0]];
      if (!ent) throw new Error('[compile] portal "' + p.id + '" 引用不存在的实体 ' + p.socket[0]);
      at = ent.socketsWorld[p.socket[1]];
      if (!at) throw new Error('[compile] portal "' + p.id + '" 引用不存在的 socket ' + p.socket.join('.'));
    }
    return { id: p.id, at: { x: at.x, y: at.y }, r: p.r || null,
      connects: p.connects || [], elevations: p.elevations || null,
      crossesWater: !!p.crossesWater, tags: p.tags || [] };
  });

  /* ---- navigation hints → graph（cost = 几何长 × costMul） ---- */
  const nav = WC.navigation.build(mapDef.nav);

  /* ---- zones（语义区：地图 authored，非物理水体） ---- */
  const zones = {};
  for (const k of Object.keys(mapDef.zones || {})) zones[k] = mapDef.zones[k];

  const compiled = {
    id: mapDef.id,
    bounds: { w: mapDef.bounds.w, h: mapDef.bounds.h },
    surfaces: surfaces, waters: waters, obstacles: obstacles,
    portals: portals, entities: entities, nav: nav, zones: zones
  };

  /* ---- 派生查询（全部只读） ---- */
  compiled.surfaceAt = function (x, y) { return WC.surface.at(surfaces, x, y); };
  compiled.surfaceById = function (id) { return WC.surface.byId(surfaces, id); };
  compiled.waterAt = function (x, y) { return !!WC.water.at(waters, x, y); };
  compiled.waterById = function (id) {
    for (const w of waters) if (w.id === id) return w;
    return null;
  };
  compiled.segHitsObstacle = function (ax, ay, bx, by) { return WC.obstacle.segHits(obstacles, ax, ay, bx, by); };
  compiled.socketOf = function (entId, name) {
    const e = entities[entId];
    return e ? e.socketsWorld[name] || null : null;
  };
  compiled.entitiesByTag = function (tag) {
    const out = [];
    for (const id of Object.keys(entities)) if (entities[id].tags.indexOf(tag) >= 0) out.push(entities[id]);
    return out;
  };
  /* 运行时 debug 断言用：该点是否「物理干岸」（非水 / deck / 合法跨水 portal） */
  compiled.dryLand = function (x, y) {
    if (!compiled.waterAt(x, y)) return true;
    const s = compiled.surfaceAt(x, y);
    if (s && s.tags.indexOf('deck') >= 0) return true;
    return !!WC.portal.nearCross(portals, x, y);
  };

  /* ---- 边的 deck 成员推导（Y-sort 用：>50% 路线长度在 deck-tagged surface 上 → 桥面边） ---- */
  for (const e of nav.edges) {
    let onLen = 0, total = 0;
    for (let i = 0; i < e.routePts.length - 1; i++) {
      const p = e.routePts[i], q = e.routePts[i + 1];
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      total += L;
      const s = compiled.surfaceAt((p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
      if (s && s.tags.indexOf('deck') >= 0) onLen += L;
    }
    e.isDeck = total > 0 && onLen > total / 2;
  }

  /* ---- 炊烟发射点派生（props.smoke 实体 + chimney socket） ---- */
  compiled.chimneys = [];
  for (const id of Object.keys(entities)) {
    const e = entities[id];
    if (e.props && e.props.smoke && e.socketsWorld.chimney) {
      compiled.chimneys.push({ x: e.socketsWorld.chimney.x, y: e.socketsWorld.chimney.y,
        rate: e.props.rate || 1, house: id });
    }
  }

  /* ---- nav 附加校验段（snap-to-node / final 段的地图声明样例） ---- */
  nav.extraRoutes = [];
  for (const r of mapDef.nav.extraRoutes || []) {
    let pts = r.pts;
    if (!pts) {
      const A = nav.nodes[r.from];
      let bx, by;
      if (r.toZone) { bx = zones[r.toZone].x; by = zones[r.toZone].y; }
      else if (r.toSocket) { const sw = compiled.socketOf(r.toSocket[0], r.toSocket[1]); bx = sw.x; by = sw.y; }
      else { bx = r.to.x; by = r.to.y; }
      pts = [[A.x, A.y], [bx, by]];
    }
    nav.extraRoutes.push({ id: r.id, pts: pts });
  }

  /* ---- compile 期校验：失败 throw，不是 console.warn ---- */
  WC.validation.validateWorld(compiled);

  return compiled;
}

root.WC = root.WC || {};
WC.compile = compile;
if (typeof module !== 'undefined') module.exports = compile;
})(typeof window !== 'undefined' ? window : globalThis);
