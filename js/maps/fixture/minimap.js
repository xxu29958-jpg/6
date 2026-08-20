(function (root) {
'use strict';
/* ============================================================
 * maps/fixture/minimap.js — 第二张最小 synthetic map（无 PNG）
 * 通用性证明：与溪谷共用同一套 World Core 完成 compile /
 * socket 派生 / Dijkstra / 水拒绝 / 障碍拒绝 / portal 跨水 / elevation 校验。
 * 内容：两块 walkable 台地（elev 0 / 1）+ 一条不可直接穿越的水渠
 * + 一座桥（entity + deck surface + 2 portal）+ 一个 house + 一个 obstacle
 * + 一个 elevation transition（坡道 portal）。
 * ============================================================ */

const MAP_FIXTURE_MINI = {
  id: 'fixture-mini',
  bounds: { w: 400, h: 300 },

  surfaces: [
    /* 西台地（基片，elev 0） */
    { id: 'west', elevation: 0, walkable: true,
      polygon: [[0, 0], [400, 0], [400, 300], [0, 300]] },
    /* 东台地（elev 1，x≥230 的高台） */
    { id: 'east', elevation: 1, walkable: true,
      polygon: [[230, 60], [400, 60], [400, 260], [230, 260]] },
    /* 桥面（跨水渠，elev 0；含两端引道压境段，比水渠宽） */
    { id: 'miniDeck', elevation: 0, walkable: true, tags: ['deck'],
      occlusion: { sortY: 160 },
      polygon: [[160, 132], [240, 132], [240, 168], [160, 168]] }
  ],

  waters: [
    /* 竖直水渠 x≈200，半宽 18（不经桥不可过） */
    { id: 'channel', kind: 'ribbon',
      ctrl: [[200, 20], [200, 120], [200, 220], [200, 290]],
      half: [18, 18, 18, 18], per: 8, clickHalf: 22 }
  ],

  obstacles: [
    { id: 'boulder', tags: ['rock'], polygon: [[70, 170], [110, 170], [110, 210], [70, 210]] }
  ],

  entities: [
    { id: 'hut', transform: { x: 100, y: 110 }, tags: ['house'],
      props: { name: '小屋', smoke: true, rate: 1 },
      footprintLocal: [[-30, -40], [30, -40], [30, 0], [-30, 0]],
      sockets: {
        door: { x: 5, y: -8 },
        win0: { x: -12, y: -22, th: 0.4 },
        chimney: { x: -10, y: -46 }
      } },
    /* 桥实体：transform + deck surface + 两端 portal */
    { id: 'miniBridge', transform: { x: 200, y: 168 }, tags: ['bridge'] },
    { id: 'lamp1', transform: { x: 120, y: 150 }, tags: ['lantern'],
      sockets: { head: { x: 8, y: -30 } } }
  ],

  portals: [
    { id: 'miniBridgeW', at: { x: 160, y: 150 }, r: 30, connects: ['west', 'miniDeck'],
      elevations: [0, 0], crossesWater: true, tags: ['deck-end'] },
    { id: 'miniBridgeE', at: { x: 240, y: 150 }, r: 30, connects: ['miniDeck', 'west'],
      elevations: [0, 0], crossesWater: true, tags: ['deck-end'] },
    /* 台地坡道：elev 0→1 在桥东堍上岸处 */
    { id: 'ramp', at: { x: 244, y: 150 }, r: 30, connects: ['west', 'east'],
      elevations: [0, 1], tags: ['slope'] },
    { id: 'doorHut', socket: ['hut', 'door'], r: 16, connects: ['west', 'west'],
      elevations: [0, 0], tags: ['door'] }
  ],

  zones: {
    lookout: { x: 60, y: 250, dir: [1, 0] }
  },

  nav: {
    nodes: {
      P: { x: 60, y: 140 },     // 西岸
      Q: { x: 150, y: 150 },    // 桥西引道口
      R: { x: 250, y: 150 },    // 桥东高台口
      T: { x: 340, y: 220 },    // 东台地远端
      U: { x: 60, y: 250 }      // 西南角
    },
    edges: [
      { a: 'P', b: 'Q', via: [[100, 146]] },
      { a: 'Q', b: 'R', costMul: 0.5 },                                   // 过桥直线（桥面 172-228）
      { a: 'R', b: 'T', via: [[300, 190]] },
      { a: 'P', b: 'U', via: [[58, 195]] }
    ],
    extraRoutes: [
      { id: 'lookoutWalk', from: 'U', toZone: 'lookout' }
    ]
  }
};

root.MAP_FIXTURE_MINI = MAP_FIXTURE_MINI;
if (typeof module !== 'undefined') module.exports = MAP_FIXTURE_MINI;
})(typeof window !== 'undefined' ? window : globalThis);
