(function (root) {
'use strict';
/* ============================================================
 * maps/xigu/behaviour.js — 溪谷地图侧行为配置
 * simulation/residents.js 的地图语义参数：家节点映射 / 桥边坐姿常驻 /
 * 秋千调度 / 夜间规则；interaction.js 的点击判定参数。
 * 物理查询一律走 compiled world，这里只有配置。
 * ============================================================ */
const BEHAVIOUR_XIGU = {
  counts: { desktop: 14, mobile: 10 },     // 居民总数
  interaction: {
    streamClickHalf: 60                    // 溪带点击判定半宽（交互参数，非水物理）
  },
  homes: ['A', 'H', 'J'],                  // 家节点轮转（磨坊/右屋/左屋）
  sitterIndex: 0,                          // 桥边常驻坐姿者
  lanternIndex: 1,                         // 夜晚提灯者
  sit: {
    goal: 'C',                             // 先沿路网回桥西节点
    zone: 'sitSpot',                       // 再走 final 段到坐姿点
    firstDelay: 2,                         // 首开立刻就位
    sitRange: [70, 130],                   // 一次坐姿时长
    reSit: [30, 70]                        // 初始错峰
  },
  swing: {
    node: 'S', entity: 'swing', standSocket: 'stand',
    firstDelay: 8, interval: [10, 18], ride: [10, 16]
  },
  night: {
    enterAt: 0.55, exitAt: 0.3,            // DAY.cur.night 阈值
    outdoorCount: 4,                       // 夜晚留在室外人数
    sitterIdle: [20, 40]
  },
  chat: { dist: 26, prob: 0.6, dur: [8, 15], cooldown: [22, 40] },
  walk: { carryProb: 0.25, speed: [22, 34] }
};

root.BEHAVIOUR_XIGU = BEHAVIOUR_XIGU;
if (typeof module !== 'undefined') module.exports = BEHAVIOUR_XIGU;
})(typeof window !== 'undefined' ? window : globalThis);
