'use strict';
/* t6 — compile reject：三种非法 map 篡改全部 throw（错误信息含边/实体 id） */
const H = require('./helpers.js');
H.loadCore(); H.loadMaps();

/* ① 节点移入水域（I → 潭心） */
{
  const def = H.clone(MAP_XIGU);
  def.nav.nodes.I = { x: 1450, y: 880 };
  const e = H.throws(() => WC.compile(def), '节点入水必须 throw');
  H.ok(/I/.test(e.message), '错误信息应含节点 id: ' + e.message);
}

/* ② hint 边途经点改穿房屋障碍（A>C 改走磨坊身体） */
{
  const def = H.clone(MAP_XIGU);
  const e0 = def.nav.edges.find(e => e.a === 'A' && e.b === 'C');
  e0.via = [[600, 520]];
  const e = H.throws(() => WC.compile(def), '路线穿房屋必须 throw');
  H.ok(/A>C/.test(e.message) && /millBody/.test(e.message),
    '错误信息应含边 id 与 obstacle id: ' + e.message);
}

/* ③ 删掉坡道 portal → elevation 0→2 直连必须 throw */
{
  const def = H.clone(MAP_XIGU);
  def.portals = def.portals.filter(p => p.id !== 'slopeHigh');
  const e = H.throws(() => WC.compile(def), '无 portal 直连 elevation0→2 必须 throw');
  H.ok(/portal/.test(e.message) && /(G>H|W>H)/.test(e.message),
    '错误信息应含边 id: ' + e.message);
}

/* 附：fixture 拆桥（删 deck surface + 两端 portal）→ 跨渠路线失去全部合法承载，throw */
{
  const def = H.clone(MAP_FIXTURE_MINI);
  def.surfaces = def.surfaces.filter(s => s.id !== 'miniDeck');
  def.portals = def.portals.filter(p => p.id !== 'miniBridgeW' && p.id !== 'miniBridgeE');
  H.throws(() => WC.compile(def), 'fixture 拆桥必须 throw');
}
console.log('t6 compile reject OK (3+1 种非法篡改全部 throw)');
