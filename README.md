# 微缩活体世界 · Miniature Living World — V4.9

一个运行在浏览器里的「微缩活体世界」：溪谷地形、溪流与瀑布、木桥、水车磨坊、
农舍、英雄大树、秋千、灯笼，以及 10–20 个按物理世界寻路生活的居民。
Vanilla JS + Canvas 2D，零构建、零依赖，`file://` 双击 `index.html` 或
`python3 -m http.server` 均可运行。

V4.9 = **Entity-owned Physics + Bridge Single Owner + Binding Acceptance**：
每个可定位实体是它全部物理几何的唯一 owner；桥是一块整体物理；
Render Binding 必须经 Acceptance 编译（Accept/Reject）才能成为渲染场景。
运行期不存在第二份物理坐标——该断言由 t2/t13/t14 以 transform 跟随测试保证。

## 目录结构（三层边界 + 装配线）

```
index.html                  入口（script 顺序固定，见文件头注释）
css/style.css
js/
  util.js                   数学/曲线工具（catmull、mulberry32 等）
  core/                     A. World Core —— 地图无关，禁词 grep 见 tests/t10
    geometry.js  transform.js  entity.js(含 solids 派生)  surface.js
    water.js(拒绝持有交互参数)  obstacle.js  portal.js
    navigation.js(加权图+Dijkstra)  validation.js(compile 期 throw，
    含 portal.connects 真执行)  compile.js(Physical→Compiled)
  maps/
    xigu/map.js             B. 溪谷 Physical Map Definition —— 唯一物理权威
    xigu/behaviour.js       行为/昼夜/交互判定配置（非物理）
    fixture/minimap.js      合成第二地图（无 PNG，证明 core 零改动可编译）
  render/canvas/
    xigu-binding.js         C. Render Binding + Acceptance（XB.validate/compile）
    layers.js  dynamic.js  camera.js  daynight.js  artcheck.js
  simulation/residents.js   居民（compiled 寻路的消费者；snap/final 段先验证后产生）
  interaction.js  main.js
tests/                      Node 测试（无依赖）：node tests/run.js
assets/                     15 张手绘透明 PNG（见下方说明）
```

装配线：`WC.compile(MAP)` → `XB.validate(COMPILED)`（五类违例 throw）→
`XB.build` → Compiled Render Scene。main.js 只调用 `XB.compile`。

## 权威 / 派生 / 纯渲染

- **Authority（唯一真源）**：`maps/xigu/map.js` —— bounds、walkable surfaces
  （bridgeDeck 为 bridge 实体 local）、水系（溪流宽度剖面/潭/瀑池）、
  世界固定障碍（仅崖面带）、portal（桥堍/房门为实体 socket 引用）、
  实体 transform + local sockets/footprint/zones/**solids**、nav 节点与带权边。
  房屋屋身/树根/篱石/井石碰撞体 = 实体 local solids，移动 transform 即跟随
  （t13/t14 逐点断言，含 deck polygon 与 occlusion.sortY）。
- **Derived（编译派生，永不为权威）**：`WC.compile(map)` 产物 ——
  socketsWorld / footprintWorld / zonesWorld / solidsWorld、实体拥有的
  surface 世界多边形与 sortY、路线密点、Dijkstra、deck 成员判定。
  非法地图在 compile 期直接 `throw`（含跨水 portal connects 失配）。
- **Render-only**：`xigu-binding.js` 决定「怎么画」，永不决定「物理上在哪里」。
  绑定与物理的一致性由 XB.validate 强制（orphan/missing/pivot/footprint/deck
  五类违例 throw）；像素水掩码降级为 `artcheck.js` 的 evidence。
- **Runtime 不变量**：居民的 snap-to-node / final 直线段在产生前过
  compile 级 validateRoute；非法段不会成为路线（多候选合法 snap，
  全部非法时合法传送兜底，console.error 留痕）。

## 测试

```
node tests/run.js     # TOTAL 16 PASS, 0 FAIL
```

t1 渲染中性（改 binding 物理 hash 不变）/ t2 socket+solid 跟随 /
t3 全路线合法 / t4 跨水必须经桥（否则 throw）/ t5 边声明顺序无关 /
t6 非法地图 compile 期拒绝 / t7 V4.7 数值全量回归（1e-6）/
t8 四视口相机断言 / t9 1280×800 平板过放大修复 / t10 core 去溪谷化 /
t11 第二地图 fixture / t12 Renderer 边界人工评审清单 /
t13 实体 solids 跟随（tree/fence/rock + cliff 世界固定对照）/
t14 桥单一 owner（deck/portal/sortY 随 transform 派生，双图断言）/
t15 Binding Acceptance（五类违例 throw，t1 式美术微调不误伤）/
t16 运行期路线不变量（598 个可达状态全部存在合法 snap；反例全拦截）/
t17 portal.connects 真执行（篡改失配 throw + 合成世界入口/出口双侧）。

## 说明

- 15 张手绘 PNG（约 18.6 MB）未收入本仓库（二进制资产经文本通道传输有损
  风险）；代码引用的资产键与几何裁切表见 `js/render/canvas/xigu-binding.js`。
- 浏览器验证钩子：`window.__DBG`（只读：cam / compiled / WORLD_VERSION）。
- surface 的 `occlusion` 字段是 map 声明、core 透传的渲染 Y-sort 元数据
  （core 不解释其语义；数值由实体 transform 派生，见 compile.js）。
