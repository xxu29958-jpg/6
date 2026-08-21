# t12 — Renderer 边界代码评审（V4.9 复审）

人工评审清单（对应 grep 巡检，结果记录于本文件）。
V4.9 复审时点：entity-owned solids / 桥单一 owner / Binding Acceptance /
runtime 段验证 / connects 真执行全部落地之后。

## 巡检断言

1. `js/render/canvas/*` 与 `js/simulation/residents.js`、`js/interaction.js`
   不出现 `WORLD.` 全局对象（world.js 已整体删除）。
   - ✅ `grep -rn "WORLD\." js/` 仅剩注释中的历史引用说明
     （artcheck.js:4 / layers.js:19,345 / xigu-binding.js:215）。
2. renderer 只读 compiled，不回写：
   - ✅ `grep -n "COMPILED\.[a-zA-Z_]* *=" js/render/canvas/*.js js/simulation/*.js js/interaction.js`
     无左值赋值。
   - compiled 上不存在任何 `set*/mutate*` 写接口（见 js/core/compile.js，只有只读查询函数）。
3. 物理查询无第二份手填坐标（V4.9 起成立，且有自动化保证）：
   - 实体碰撞体 = 实体 local solids（t13：tree/fence/rock 逐点跟随；
     t2：millBody 随磨坊 +50；世界固定 cliff 不动的对照断言）。
   - 桥面 = bridge 实体 local：deck polygon / 两岸 portal（socket 引用）/
     occlusion.sortY 全部由 transform 派生（t14：fixture + 溪谷双侧断言）。
   - 水面判定：interaction/residents 全部走 `COMPILED.waterAt / dryLand`；
     像素水掩码仅存于 `render/canvas/artcheck.js`（evidence，console.info 报告）。
   - 房屋点击/门窗/烟囱/灯头/树冠/秋千落点：全部 `COMPILED.entities/socketOf` 派生。
   - 相机边界：`LAYERS.setWorld(COMPILED.bounds)` 注入，无第二份 W/H。
4. 运行期不存在第二份物理坐标（V4.8 时此断言为假，V4.9 起为真）：
   - 障碍/桥面/桥 portal/sortY 的权威均为实体 transform（t2/t13/t14 自动化）。
   - 居民 snap/final 直线段先过 validateRoute 再成为 route（t16：
     598 个可达状态全存在合法 snap；潭心反例 17 候选全拦截）。
   - portal.connects 由校验器真执行（t17：失配 throw + 合成世界双侧）。
5. Binding Acceptance Layer 存在且在装配线上：
   - ✅ `js/main.js` 只调用 `XB.compile(COMPILED)`（= XB.validate → XB.build）；
     无 `XB.build` 直接调用。
   - 五类违例 throw：bind-orphan / bind-missing / bind-pivot /
     bind-footprint / bind-deck（t15 自动化）；swing 为程序化绘制白名单。
6. 交互参数不属水物理：
   - ✅ `grep -rn "clickHalf" js/` 仅 core/water.js 的剥离注释与
     `delete w.clickHalf`；判定值驻留 `maps/xigu/behaviour.js interaction.*`；
     tests/helpers.js stableHash 白名单已剔除 clickHalf。
7. PNG 专属数据全部在 `render/canvas/xigu-binding.js`：
   - ✅ `grep -n "bbox\|pivot" js/maps/ js/core/` 无命中（除注释说明）。
8. core 无地图专有名：由 t10 自动断言（禁词 grep）。
9. script 顺序固定：util → core/* → maps/* → binding → render → simulation →
   interaction → main（见 index.html 注释块）。
10. 已知且接受的边界说明：surface `occlusion` 为 map 声明、core 透传的渲染
    元数据（core 不解释语义）；其数值（sortY）由实体 transform + sortYLocal
    派生，不形成第二份坐标权威。

## 评审结论

V4.9 三层边界成立：core（地图无关）/ maps（唯一物理权威 + 行为配置）/
render binding（唯一渲染数据出口 + Acceptance 门禁）。
「运行期不存在第二份物理坐标」在 V4.8 判早，V4.9 起由 t2/t13/t14/t16/t17
自动化保证，复审通过。
