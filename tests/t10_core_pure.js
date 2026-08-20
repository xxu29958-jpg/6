'use strict';
/* t10 — core 去溪谷化：core/ 不得出现任何地图专有名 */
const H = require('./helpers.js');
const fs = require('fs');
const path = require('path');

const FORBIDDEN = /xigu|mill|pond|cottage|swing|waterfall|sitter|terrace|lantern/i;
const dir = path.join(H.ROOT, 'js/core');
let bad = 0;
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.js')) continue;
  const text = fs.readFileSync(path.join(dir, f), 'utf8');
  const m = FORBIDDEN.exec(text);
  if (m) {
    bad++;
    console.error('core/' + f + ' 含禁词: ' + m[0]);
  }
}
H.ok(bad === 0, 'core/ 存在溪谷专有名');
/* 反向：通用概念必须允许存在（防误删过度） */
H.ok(/water|portal|entity|surface/i.test(
  fs.readdirSync(dir).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')),
  'core 应包含通用概念');
console.log('t10 core pure OK');
