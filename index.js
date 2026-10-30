// 入口薄壳：实现在 lib/index.js。
// 根级 index.js 是 DSH profile 装载器最稳的入口形态（与 templates/decoration 一致），
// exports["."] 指向它；不要再把它移进子目录——2026-10-30 移进 lib/ 后 web boot 失败。
export { name, apply } from './lib/index.js';
