# 微缩活体世界 · Miniature Living World — V4.8

一个运行在浏览器里的「微缩活体世界」：溪谷地形、溪流与瀑布、木桥、水车磨坊、
农舍、英雄大树、秋千、灯笼，以及 10–20 个按物理世界寻路生活的居民。
Vanilla JS + Canvas 2D，零构建、零依赖，`file://` 双击 `index.html` 或
`python3 -m http.server` 均可运行。

V4.8 = **Physical World Authority + Map/Core Boundary Cutover**：
世界先于美术存在，地图先于 Renderer 存在，溪谷属于 Map 不属于 Core。

## 目录结构（三层边界）

```
index.html                  入口（script 顺序固定，见文件头注释）
css/style.css
js/
  util.js                   数学/曲线工具（catmull、mulberry32 等）
  core/                     A. World Core —— 地图无关，禁词 grep 见 tests/t10
    geometry.js  transform.js  entity.js  surface.js  water.js
    obstacle.js  portal.js     navigation.js(加权图+Dijkstra)
    validation.js(compile 期 throw)  compile.js(Physical→Compiled)
  maps/
    xigu/map.js             B. 溪谷 Physical Map Definition —— 唯一物理权威
    xigu/behaviour.js       行为/昼夜/相机 focus 配置（非物理）
    fixture/minimap.js      合成第二地图（无 PNG，证明 core 零改动可编译）
  render/canvas/
    xigu-binding.js         C. Render Binding —— PNG 数据的唯一出口
    layers.js  dynamic.js  camera.js  daynight.js  artcheck.js
  simulation/residents.js   居民（compiled 寻路的消费者）
  interaction.js  main.js
tests/                      Node 测试（无依赖）：node tests/run.js
assets/                     15 张手绘透明 PNG（见下方说明）
```

## 权威 / 派生 / 纯渲染

- **Authority（唯一真源）**：`maps/xigu/map.js` —— bounds、walkable surfaces
  （含 bridgeDeck）、水系（溪流宽度剖面/潭/瀑池）、障碍、portal、
  实体 transform + local sockets/footprint/zones、nav 节点与带权边。
- **Derived（编译派生，永不为权威）**：`WC.compile(map)` 产物 ——
  socketsWorld / footprintWorld / zonesWorld、路线密点、Dijkstra、
  deck 成员判定（长度加权）。非法地图在 compile 期直接 `throw`。
- **Render-only**：`xigu-binding.js` 决定「怎么画」，永不决定「物理上在哪里」。
  像素水掩码降级为 `artcheck.js` 的 evidence（console.info 报告）。

## 测试

```
node tests/run.js     # TOTAL 11 PASS, 0 FAIL
```

t1 渲染中性（改 binding 物理 hash 不变）/ t2 socket 跟随 / t3 全路线合法 /
t4 跨水必须经桥（否则 throw）/ t5 边声明顺序无关（20 种子 × 272 节点对）/
t6 非法地图 compile 期拒绝（3+1 种）/ t7 V4.7 数值全量回归（1e-6）/
t8 四视口相机断言 / t9 1280×800 平板过放大修复 / t10 core 去溪谷化 /
t11 第二地图 fixture / t12 Renderer 边界人工评审清单。

## 说明

- 15 张手绘 PNG（约 18.6 MB）未收入本仓库（二进制资产经文本通道传输有损
  风险）；代码引用的资产键与几何裁切表见 `js/render/canvas/xigu-binding.js`。
- 浏览器验证钩子：`window.__DBG`（只读：cam / compiled / WORLD_VERSION）。
