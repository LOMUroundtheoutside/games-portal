#!/usr/bin/env node
/* Headless smoke test for portal games.
   usage: node tools/smoke.js <file.js> [frames]
   Loads games.js + racing.js, then the target file; every game the target file
   pushed onto GAMES is run in a stubbed DOM, mashed with keys/taps, advanced
   through `frames` animation frames, then stopped. Reports any thrown error. */
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const target = process.argv[2]; const FRAMES = +(process.argv[3] || 400);
if (!target) { console.error('usage: node tools/smoke.js <file.js> [frames]'); process.exit(2); }

const noop = () => {};
function ctx2d() {
  const store = {};
  return new Proxy({}, {
    get(_, p) {
      if (p === 'measureText') return () => ({ width: 10 });
      if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') return () => ({ addColorStop: noop });
      if (p === 'canvas') return null;
      if (p in store) return store[p];
      return noop;
    },
    set(_, p, v) { store[p] = v; return true; },
  });
}
function el(tag) {
  const e = {
    tagName: String(tag).toUpperCase(), children: [], style: {}, dataset: {}, _listeners: {},
    className: '', innerHTML: '', textContent: '', width: 0, height: 0, hidden: false,
    appendChild(c) { e.children.push(c); c.parentNode = e; return c; },
    removeChild(c) { e.children = e.children.filter(k => k !== c); },
    remove() { if (e.parentNode) e.parentNode.removeChild(e); },
    querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener(ev, fn) { (e._listeners[ev] = e._listeners[ev] || []).push(fn); },
    removeEventListener(ev, fn) { if (e._listeners[ev]) e._listeners[ev] = e._listeners[ev].filter(f => f !== fn); },
    dispatch(ev, data) { (e._listeners[ev] || []).forEach(fn => fn(Object.assign({ type: ev, preventDefault: noop, stopPropagation: noop, target: e }, data))); },
    getBoundingClientRect() { return { left: 0, top: 0, width: e.width || 400, height: e.height || 300, right: e.width || 400, bottom: e.height || 300 }; },
    getContext() { return ctx2d(); },
    setAttribute(k, v) { e[k] = v; }, getAttribute(k) { return e[k]; }, focus: noop, blur: noop, click: noop,
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    requestFullscreen: () => Promise.resolve(), toDataURL: () => '',
    offsetWidth: 400, offsetHeight: 300, clientWidth: 400, clientHeight: 300,
  };
  return e;
}
let now = 0, rafQ = [];
const win = {
  addEventListener(ev, fn) { (win._l[ev] = win._l[ev] || []).push(fn); }, _l: {},
  removeEventListener(ev, fn) { if (win._l[ev]) win._l[ev] = win._l[ev].filter(f => f !== fn); },
  dispatch(ev, data) { (win._l[ev] || []).forEach(fn => fn(Object.assign({ type: ev, preventDefault: noop, stopPropagation: noop, target: { tagName: 'DIV' } }, data))); },
  requestAnimationFrame(fn) { rafQ.push(fn); return rafQ.length; },
  cancelAnimationFrame: noop,
  innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
  AudioContext: undefined,
};
const doc = {
  createElement: el, body: el('body'), documentElement: el('html'), fullscreenElement: null,
  getElementById: () => el('div'), querySelector: () => null, querySelectorAll: () => [],
  addEventListener: win.addEventListener, removeEventListener: win.removeEventListener, exitFullscreen: () => Promise.resolve(), hidden: false,
};
const sandbox = {
  window: win, document: doc, performance: { now: () => now }, console,
  requestAnimationFrame: win.requestAnimationFrame, cancelAnimationFrame: noop,
  setTimeout, clearTimeout, setInterval, clearInterval, localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  navigator: { userAgent: 'smoke', maxTouchPoints: 0 }, location: { hostname: 'localhost', href: 'http://localhost/' }, Image: function () { return el('img'); }, Audio: function () { return { play: () => Promise.resolve(), pause: noop }; },
};
sandbox.self = sandbox.globalThis = sandbox.window;
Object.setPrototypeOf(win, sandbox); // let bare `addEventListener`, `innerWidth`, etc. resolve
vm.createContext(sandbox);
const load = f => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
for (const base of ['games.js', 'racing.js']) if (path.resolve(root, base) !== path.resolve(target)) load(base);
const before = vm.runInContext('GAMES.length', sandbox);
if (/\bTHREE\b/.test(fs.readFileSync(target, 'utf8'))) {
  /* three.js games: run the real library (scene graph, maths, raycasting) but stub the WebGL renderer,
     which needs a GPU context the fake canvas cannot give. */
  load('lib/three.min.js');
  const THREE = win.THREE; sandbox.THREE = THREE;
  THREE.WebGLRenderer = function () { this.domElement = el('canvas'); this.shadowMap = {}; };
  THREE.WebGLRenderer.prototype = { setSize: noop, setPixelRatio: noop, render: noop, dispose: noop };
}
load(target);
const games = vm.runInContext(`GAMES.slice(${before})`, sandbox);
console.log(`${target}: ${games.length} game(s)`);
const KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'w', 'a', 's', 'd', 'Enter', 'Shift', 'r', 'x', 'z', '1', '2', '3', '4'];
let fails = 0;
const seenIds = new Set();
for (const g of games) {
  const problems = [];
  for (const k of ['id', 'title', 'emoji', 'cat', 'colors', 'help', 'run']) if (g[k] == null) problems.push('missing ' + k);
  if (seenIds.has(g.id)) problems.push('duplicate id'); seenIds.add(g.id);
  if (/remix/.test(target) && g.help && !/inspired by/i.test(g.help)) problems.push('help lacks "Inspired by"');
  const stage = el('div'); stage.width = 600; stage.height = 420;
  let best = 0;
  const api = vm.runInContext('makeApi', sandbox)(stage, { score: n => { best = Math.max(best, n); }, beep: noop });
  let err = null; now = 0; rafQ = [];
  try {
    g.run(stage, api);
    for (let f = 0; f < FRAMES; f++) {
      if (f % 7 === 0) { const key = KEYS[f / 7 % KEYS.length | 0]; win.dispatch('keydown', { key }); if (f % 14 === 0) win.dispatch('keyup', { key }); }
      if (f % 23 === 0) { stage.dispatch('pointerdown', { clientX: 100 + (f % 300), clientY: 100 + (f % 200), button: 0, buttons: 1 }); stage.dispatch('pointermove', { clientX: 120 + (f % 300), clientY: 110, buttons: 1 }); win.dispatch('pointerup', {}); }
      now += 16.67; const q = rafQ; rafQ = []; q.forEach(fn => fn(now));
      if (f === Math.floor(FRAMES / 2) && api._restart) api._restart();
    }
    api.stop();
  } catch (e) { err = e; }
  const tag = err ? 'FAIL' : problems.length ? 'WARN' : ' ok ';
  if (err) fails++;
  console.log(`[${tag}] ${g.id.padEnd(26)} ${g.title.padEnd(28)} ${problems.join('; ')}${err ? '\n        ' + (err.stack || err).toString().split('\n').slice(0, 3).join('\n        ') : ''}`);
}
process.exit(fails ? 1 : 0);
