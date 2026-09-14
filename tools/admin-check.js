#!/usr/bin/env node
/* End-to-end check of the admin panel over a real headless Chromium.
   Serves the folder on a local port (localStorage is unreliable on file://),
   unlocks admin.html, hides / pins / renames a game, applies the change and
   reloads the portal to prove the change actually landed.
   usage: node tools/admin-check.js            */
const { spawn } = require('child_process'), http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), PORT = 8731, OUT = '/tmp/portal-admin-check';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
let failures = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${extra ? '  ' + extra : ''}`); if (!cond) failures++; };

const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  /* a fresh browser profile every run, so one run's localStorage cannot fool the next */
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const chrome = spawn('chromium', ['--headless=new', '--remote-debugging-port=9334', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--window-size=1400,900', '--host-resolver-rules=MAP dev-check.github.io 127.0.0.1', '--no-first-run', '--user-data-dir=' + OUT + '/profile', 'about:blank'], { stdio: 'ignore' });

  let targets;
  for (let i = 0; i < 40; i++) { await sleep(250); try { targets = await (await fetch('http://127.0.0.1:9334/json')).json(); break; } catch {} }
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const pending = {}; let logs = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending[m.id]) { pending[m.id](m.result || m.error); delete pending[m.id]; }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('console.error: ' + m.params.args.map(a => a.value || a.description).join(' '));
    if (m.method === 'Runtime.exceptionThrown') logs.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  const ev = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;
  const go = async (page, ready, host = '127.0.0.1') => {
    logs = [];
    await send('Page.navigate', { url: `http://${host}:${PORT}/${page}` });
    for (let i = 0; i < 80; i++) { await sleep(150); if (await ev(ready)) return true; }
    return false;
  };
  const shot = async n => send('Page.captureScreenshot').then(r => fs.writeFileSync(`${OUT}/${n}.png`, Buffer.from(r.data, 'base64')));

  console.log('\n--- portal, untouched ---');
  ok('index.html boots', await go('index.html', "typeof openGame === 'function'"));
  await ev("localStorage.clear(); sessionStorage.clear()");
  await go('index.html', "typeof openGame === 'function'");
  const totalGames = await ev('allGames().length');
  ok('catalogue loads', totalGames > 60, `${totalGames} games`);
  ok('no banner by default', await ev("document.getElementById('announce').hidden"));
  ok('admin link is in Settings', await ev("!!document.getElementById('open-admin')"));
  ok('nothing hidden by default', (await ev('CFG.hidden.length')) === 0);
  const sample = await ev("visible().find(g => g.cat === 'arcade').id");
  console.log('       sample game:', sample);

  console.log('\n--- admin.html, locked ---');
  ok('admin boots', await go('admin.html', "typeof simpleHash === 'function'"));
  ok('lock screen is up', await ev("!document.getElementById('lock').hidden"));
  ok('panel is hidden', await ev("document.getElementById('panel').hidden"));
  await ev("document.getElementById('lock-code').value='nope';document.getElementById('lock-form').dispatchEvent(new Event('submit'))");
  ok('wrong passcode refused', await ev("!document.getElementById('lock').hidden && !document.getElementById('lock-msg').hidden"));
  await shot('01-lock');

  console.log('\n--- admin.html, unlocked ---');
  await ev("document.getElementById('lock-code').value='portal-admin';document.getElementById('lock-form').dispatchEvent(new Event('submit'))");
  await sleep(300);
  ok('right passcode unlocks', await ev("document.getElementById('lock').hidden && !document.getElementById('panel').hidden"));
  const rows = await ev("document.querySelectorAll('#g-body tr').length");
  ok('games table filled', rows === totalGames, `${rows} rows`);
  await shot('02-games');

  console.log('\n--- making changes ---');
  await ev(`toggleHidden('${sample}'); togglePin('3d:slope'); setOverride(orig('3d:slope'), 'title', 'Slope Ball MAX');
            W.announcement = { text: 'New games every Friday', level: 'good' }; W.site.name = 'Theo Games';
            renderGames(); markDirty();`);
  ok('hide recorded', await ev(`W.hidden.includes('${sample}')`));
  ok('pin recorded', await ev("W.featured.includes('3d:slope')"));
  ok('rename recorded', await ev("W.overrides['3d:slope'].title === 'Slope Ball MAX'"));
  ok('unsaved flag shows', await ev("!document.getElementById('unsaved').hidden"));

  console.log('\n--- search and filters ---');
  await ev("gQuery='slope'; renderGames();");
  const found = await ev("document.querySelectorAll('#g-body tr').length");
  ok('search narrows the table', found > 0 && found < totalGames, `${found} rows for "slope"`);
  await ev("gQuery=''; gState='hidden'; renderGames();");
  ok('hidden filter works', (await ev("document.querySelectorAll('#g-body tr').length")) === 1);
  await ev("gState=''; renderGames();");

  console.log('\n--- the generated file ---');
  const text = await ev('configText()');
  ok('file has the header', text.includes('window.SITE_CONFIG'));
  ok('file carries the hide', text.includes(sample));
  ok('file carries the rename', text.includes('Slope Ball MAX'));
  fs.writeFileSync(`${OUT}/site-config.generated.js`, text);
  const probe = { window: {} };
  require('vm').runInNewContext(text, probe);
  ok('generated file is valid JavaScript', !!probe.window.SITE_CONFIG);
  ok('re-read gives the same hidden list', probe.window.SITE_CONFIG.hidden.includes(sample));

  console.log('\n--- site tab ---');
  await ev(`document.querySelector('.chip[data-tab="site"]').click(); fillSite();`);
  ok('site fields filled', (await ev("document.getElementById('s-name').value")) === 'Theo Games');
  ok('feature switches render', (await ev("document.getElementById('f-chat').checked")) === true);
  await shot('02b-site');

  console.log('\n--- stats tab ---');
  await ev("document.querySelector('.chip[data-tab=\\\"stats\\\"]').click()");
  ok('stat tiles render', (await ev("document.querySelectorAll('#stat-tiles .tile').length")) === 5);
  await shot('03-stats');
  await ev("document.querySelector('.chip[data-tab=\\\"publish\\\"]').click()");
  ok('publish preview renders', (await ev("document.getElementById('p-preview').textContent.length")) > 200);
  await shot('04-publish');

  console.log('\n--- apply, then back to the portal ---');
  await ev('applyHere()');
  ok('preview saved to this browser', (await ev("!!localStorage.getItem('gp-site')")));
  ok('portal reloads', await go('index.html', "typeof openGame === 'function'"));
  ok('hidden game is gone from the grid', !(await ev(`visible().some(g => g.id === '${sample}')`)));
  ok('hidden game is still reachable by id', !!(await ev(`!!findGame('${sample}')`)));
  ok('renamed game shows the new name', (await ev("findGame('3d:slope').title")) === 'Slope Ball MAX');
  ok('pinned game is first', (await ev("visible()[0].id")) === '3d:slope');
  ok('banner is showing', !(await ev("document.getElementById('announce').hidden")));
  ok('banner text is right', (await ev("document.getElementById('announce').textContent")) === 'New games every Friday');
  ok('banner colour applied', (await ev("document.getElementById('announce').className")).includes('good'));
  ok('site name applied', (await ev("document.querySelector('.brand-name').textContent")) === 'Theo Games');
  await shot('05-portal-after');

  console.log('\n--- a game still runs ---');
  await ev("openGame('3d:slope')"); await sleep(1200);
  ok('player opened', !(await ev("document.getElementById('player').hidden")));
  ok('stage has content', (await ev("document.getElementById('stage').childElementCount")) > 0);
  await shot('06-game');
  await ev('closeGame()');

  console.log('\n--- undo the preview ---');
  await ev("localStorage.removeItem('gp-site')");
  await go('index.html', "typeof openGame === 'function'");
  ok('portal back to normal', (await ev('allGames().length')) === totalGames && (await ev('CFG.hidden.length')) === 0);
  ok('name back to normal', (await ev("document.querySelector('.brand-name').textContent")) === 'Games Portal');

  /* the same files served under a github.io name must behave like the live site: no admin panel */
  console.log('\n--- live site (fake github.io host) ---');
  ok('portal boots on live host', await go('index.html', "typeof openGame === 'function'", 'dev-check.github.io'));
  ok('IS_LIVE detected', await ev('IS_LIVE') === true);
  ok('no admin link in Settings', await ev("!document.getElementById('open-admin')"));
  ok('admin.html loads on live host', await go('admin.html', "!!document.getElementById('lock-form')", 'dev-check.github.io'));
  ok('panel stays locked', await ev("document.getElementById('panel').hidden && !document.getElementById('lock').hidden"));
  ok('dev-only notice shown', await ev("/dev copy/i.test(document.getElementById('lock-form').textContent)"));
  ok('no passcode box', await ev("!document.getElementById('lock-code')"));
  await shot('07-live-admin');

  console.log('\n' + (logs.length ? 'console output:\n' + logs.join('\n') : 'no console errors on the last page'));
  console.log(`\n${failures ? failures + ' CHECK(S) FAILED' : 'all checks passed'}   screenshots: ${OUT}`);
  ws.close(); chrome.kill(); server.close();
  process.exit(failures ? 1 : 0);
})();
