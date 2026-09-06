#!/usr/bin/env node
/* Real-browser check: drives headless Chromium over CDP (software WebGL), opens each game id given on the
   command line (default: the 3D games), mashes keys, measures fps, screenshots to <outdir>/<id>.png and
   reports console errors.  usage: node tools/browser-shots.js <outdir> [gameId ...]
   Unlike --screenshot with --virtual-time-budget, this really advances requestAnimationFrame. */
const fs = require('fs'), { spawn } = require('child_process');
const OUT = process.argv[2] || '/tmp/portal-shots', URL = 'file://' + require('path').resolve(__dirname, '..', 'index.html');
const GAMES = process.argv.length > 3 ? process.argv.slice(3) : ['3d:slope', '3d:stack', '3d:blaster', '3d:maze', '3d:kart', '3d:builder', '3d:tunnel'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const chrome = spawn('chromium', ['--headless=new', '--remote-debugging-port=9333', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=1100,800', '--no-first-run', '--user-data-dir=' + OUT + '/profile', 'about:blank'], { stdio: 'ignore' });
  let targets; for (let i = 0; i < 40; i++) { await sleep(250); try { targets = await (await fetch('http://127.0.0.1:9333/json')).json(); break; } catch {} }
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const pending = {}; const logs = [];
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending[m.id]) { pending[m.id](m.result || m.error); delete pending[m.id]; }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('console.error: ' + m.params.args.map(a => a.value || a.description).join(' '));
    if (m.method === 'Runtime.exceptionThrown') logs.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)); };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: URL }); for (let i = 0; i < 120; i++) { await sleep(500); if ((await send('Runtime.evaluate', { expression: 'typeof openGame', returnByValue: true })).result?.value === 'function') break; }
  const ev = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;
  console.log('games:', await ev('GAMES.length'), 'web:', await ev('WEB_GAMES.length'), '3d:', await ev("GAMES.filter(g=>g.cat==='3d').map(g=>g.title).join(', ')"), 'offair:', await ev("allGames().some(g=>/offair/i.test(g.title))"));
  console.log('webgl:', await ev("(()=>{const c=document.createElement('canvas');return !!c.getContext('webgl')})()"));
  const key = async (k, code) => { for (const t of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type: t, key: k, code }); };
  for (const g of GAMES) {
    await ev(`openGame('${g}')`); await sleep(700);
    await send('Page.captureScreenshot').then(r => fs.writeFileSync(`${OUT}/${g.slice(3)}-start.png`, Buffer.from(r.data, 'base64')));
    for (let i = 0; i < 12; i++) { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: i % 2 ? 'ArrowRight' : 'ArrowUp', code: i % 2 ? 'ArrowRight' : 'ArrowUp' }); await sleep(120); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: i % 2 ? 'ArrowRight' : 'ArrowUp', code: i % 2 ? 'ArrowRight' : 'ArrowUp' }); if (i % 4 === 0) await key(' ', 'Space'); }
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 600, y: 400 });
    await sleep(2500);
    const fps = await ev(`new Promise(r=>{let n=0,t0=performance.now();const f=()=>{n++;performance.now()-t0<1000?requestAnimationFrame(f):r(n)};requestAnimationFrame(f)})`);
    await send('Page.captureScreenshot').then(r => fs.writeFileSync(`${OUT}/${g.slice(3)}.png`, Buffer.from(r.data, 'base64')));
    const hud = await ev("document.querySelector('.hud3d')?.textContent"), ov = await ev("document.querySelector('#stage .overlay')?.textContent || ''");
    console.log(g.padEnd(12), 'fps(sw)', fps, '| hud:', JSON.stringify(hud), ov ? '| overlay: ' + JSON.stringify(ov.slice(0, 60)) : '');
    await ev('closeGame()'); await sleep(200);
  }
  console.log(logs.length ? logs.join('\n') : 'no console errors / exceptions');
  ws.close(); chrome.kill();
})();
