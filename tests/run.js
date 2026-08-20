'use strict';
/* tests/run.js — 全量测试入口：逐个 spawn 子进程跑 t*.js，输出 PASS/FAIL 汇总 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const tests = fs.readdirSync(dir)
  .filter(f => /^t\d+_.*\.js$/.test(f))
  .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

let pass = 0, fail = 0;
for (const t of tests) {
  try {
    const out = execFileSync(process.execPath, [path.join(dir, t)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    process.stdout.write(out);
    console.log('PASS ' + t);
    pass++;
  } catch (e) {
    process.stdout.write((e.stdout || '') + (e.stderr || ''));
    console.log('FAIL ' + t);
    fail++;
  }
}
console.log('----');
console.log('TOTAL ' + pass + ' PASS, ' + fail + ' FAIL');
if (fail) process.exit(1);
