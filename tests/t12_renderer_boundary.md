# t12 — Renderer 边界代码评审（V4.8）

人工评审清单（对应 grep 巡检，结果记录于本文件）：

## 巡检断言

1. `js/render/canvas/*` 与 `js/simulation/residents.js`、`js/interaction.js`
   不出现 `WORLD.` 全局对象（world.js 已整体删除）。
   - ✅ `grep -rn "WORLD\." js/` 仅剩注释中的历史引用说明。
2. renderer 只读 compiled，不回写：
   - ✅ `grep -n "COMPILED\.\w*\s*=" js/render/canvas/*.js js/simulation/*.js js/interaction.js`
     无左值赋值（仅 `_fallsR = [COMPILED...]` 之类的本地派生缓存）。
   - compiled 上不存在任何 `set*/mutate*` 写接口（见 js/core/compile.js，只有只读查询函数）。
3. 物理查询无第二份手填坐标：
   - 水面判定：interaction/residents 全部走 `COMPILED.waterAt / dryLand`；
     像素水掩码仅存于 `render/canvas/artcheck.js`（evidence，console.info 报告）。
   - 房屋点击/门窗/烟囱/灯头/树冠/秋千落点：全部 `COMPILED.entities/socketOf` 派生。
   - 相机边界：`LAYERS.setWorld(COMPILED.bounds)` 注入，无第二份 W/H。
4. PNG 专属数据全部在 `render/canvas/xigu-binding.js`：
   - ✅ `grep -n "assetKey\|bbox\|pivot\|visualScale\|sway\|spin\|bake" js/maps/ js/core/` 无命中。
5. core 无地图专有名：由 t10 自动断言（禁词 grep）。
6. script 顺序固定：util → core/* → maps/* → binding → render → simulation →
   interaction → main（见 index.html 注释块）。

## 评审结论

V4.8 三层边界成立：core（地图无关）/ maps（唯一物理权威 + 行为配置）/
render binding（唯一渲染数据出口）。运行期不存在第二份物理坐标。
