/* ===================== REMIX GAMES – batch A =====================
   Original games inspired by popular web games, rebuilt from scratch with
   their own names, art and twists. Each help text explains what changed.  */
(() => {
const fmt = n => n >= 1e12 ? (n / 1e12).toFixed(2) + 'T' : n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : Math.floor(n).toString();
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('gp-remix-' + k) || 'null'); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('gp-remix-' + k, JSON.stringify(v)); } catch {} },
};
/* pointer position in canvas pixels */
const cpos = (c, e) => { const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * c.width / (r.width || c.width), y: (e.clientY - r.top) * c.height / (r.height || c.height) }; };
const seeded = s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

GAMES.push(

/* ===== BISCUIT EMPIRE (idle clicker) ===== */
{ id: 'remix:biscuit-empire', title: 'Biscuit Empire', emoji: '🍪', cat: 'remix', colors: ['#7c2d12', '#fbbf24'],
  help: 'Inspired by Cookie Clicker. What\'s different: a Golden Crumb appears now and then for a ×7 rush, you earn biscuits while the game is closed (up to 2 hours), and every million baked lets you Prestige for a permanent bonus. Controls: click/tap the biscuit, click a shop row or press 1–6 to buy, P to prestige.',
  run(stage, api) {
    const W = 560, H = 400; const { c, x } = api.canvas(W, H);
    const SHOP = [
      ['Oven', 15, .1, '🔥'], ['Baker', 100, 1, '👩‍🍳'], ['Bakery', 1100, 8, '🏪'], ['Factory', 12000, 47, '🏭'], ['Crumb Mine', 130000, 260, '⛏️'], ['Biscuit Portal', 1.4e6, 1400, '🌀'],
    ];
    const KEY = 'biscuit-empire';
    let pts, total, owned, prest, rush, crumb, crumbT, pulse, floaters, offline, saveT;
    const mult = () => (1 + prest * .5) * (rush > 0 ? 7 : 1);
    const rate = () => owned.reduce((s, n, i) => s + n * SHOP[i][2], 0) * (1 + prest * .5);
    const cost = i => Math.ceil(SHOP[i][1] * Math.pow(1.15, owned[i]));
    function load() {
      const d = store.get(KEY);
      pts = 0; total = 0; owned = SHOP.map(() => 0); prest = 0; offline = 0;
      if (d) {
        pts = d.pts || 0; total = d.total || 0; owned = SHOP.map((_, i) => (d.owned && d.owned[i]) || 0); prest = d.prest || 0;
        const away = Math.min(7200, Math.max(0, (Date.now() - (d.t || Date.now())) / 1000));
        offline = rate() * away; pts += offline; total += offline;
      }
    }
    function save() { store.set(KEY, { pts, total, owned, prest, t: Date.now() }); }
    function reset() {
      load(); rush = 0; crumb = null; crumbT = 20000 + rnd(30000); pulse = 0; floaters = []; saveT = 0;
      api.score(Math.floor(total));
      api.overlay(`<b>Biscuit Empire</b>${offline > 0 ? 'Welcome back! Your ovens baked ' + fmt(offline) + ' biscuits while you were away.<br>' : ''}<small>click / tap to start baking</small>`);
    }
    function float(tx, ty, s) { floaters.push({ x: tx, y: ty, s, life: 900 }); }
    function clickBiscuit(px, py) {
      const v = (1 + Math.floor(rate() * .05)) * mult();
      pts += v; total += v; pulse = 1; api.beep(500 + rnd(200), .04); float(px, py - 30, '+' + fmt(v));
    }
    function buy(i) {
      if (i < 0 || i >= SHOP.length) return;
      const k = cost(i); if (pts < k) { api.beep(160, .08); return; }
      pts -= k; owned[i]++; api.beep(880, .06); save();
    }
    function prestige() {
      const lv = Math.floor(total / 1e6);
      if (lv <= prest) { api.beep(160, .1); return; }
      prest = lv; pts = 0; owned = SHOP.map(() => 0); api.beep(1200, .2); save();
      api.overlay(`<b>✨ Prestige ${prest}</b>Everything now bakes ×${(1 + prest * .5).toFixed(1)}<br><small>click to keep going</small>`);
    }
    let started = false;
    api.onTap(e => {
      if (!started) { started = true; api.overlay(null); return; }
      if (stage.querySelector && stage.querySelector('.overlay')) { api.overlay(null); return; }
      const p = cpos(c, e);
      if (crumb && Math.hypot(p.x - crumb.x, p.y - crumb.y) < 22) { crumb = null; rush = 12000; api.beep(1500, .15); float(p.x, p.y, '×7 RUSH!'); return; }
      if (Math.hypot(p.x - 150, p.y - 215) < 90) { clickBiscuit(p.x, p.y); return; }
      if (p.x > 300 && p.y > 40 && p.y < 40 + SHOP.length * 50) { buy(Math.floor((p.y - 40) / 50)); return; }
      if (p.x > 300 && p.y > 350) prestige();
    });
    api.onKey(e => {
      if (!started) { started = true; api.overlay(null); return; }
      if (e.key >= '1' && e.key <= '6') buy(+e.key - 1);
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); clickBiscuit(150, 215); }
      if (e.key === 'p' || e.key === 'P') prestige();
    });
    api.onRestart(reset);
    api.every(5000, save);
    api.loop(dt => {
      if (started) {
        const g = rate() * mult() / (1 + prest * .5) * dt / 1000; pts += g; total += g;
        if (rush > 0) rush -= dt;
        if (crumb) { crumb.life -= dt; if (crumb.life <= 0) crumb = null; }
        else { crumbT -= dt; if (crumbT <= 0) { crumb = { x: 40 + rnd(W - 80), y: 40 + rnd(H - 80), life: 8000 }; crumbT = 30000 + rnd(30000); } }
        floaters.forEach(f => { f.life -= dt; f.y -= dt * .04; }); floaters = floaters.filter(f => f.life > 0);
        pulse = Math.max(0, pulse - dt / 200);
        saveT += dt; if (saveT > 5000) { saveT = 0; api.score(Math.floor(total)); }
      }
      draw();
    });
    function biscuit(cx, cy, r) {
      x.fillStyle = '#b45309'; x.beginPath(); x.arc(cx, cy + 4, r, 0, 7); x.fill();
      x.fillStyle = '#d97706'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
      x.fillStyle = '#f59e0b'; x.beginPath(); x.arc(cx - r * .15, cy - r * .15, r * .8, 0, 7); x.fill();
      x.fillStyle = '#451a03';
      [[-.4, -.3, .13], [.3, -.45, .1], [.45, .2, .12], [-.1, .45, .11], [-.5, .3, .09], [.05, -.05, .1], [.25, .5, .08]].forEach(([dx, dy, dr]) => { x.beginPath(); x.arc(cx + dx * r, cy + dy * r, dr * r, 0, 7); x.fill(); });
    }
    function draw() {
      const grd = x.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#451a03'); grd.addColorStop(1, '#1c0a02'); x.fillStyle = grd; x.fillRect(0, 0, W, H);
      if (rush > 0) { x.fillStyle = `rgba(251,191,36,${.1 + .1 * Math.sin(performance.now() / 100)})`; x.fillRect(0, 0, W, H); }
      biscuit(150, 215, 80 + pulse * 10);
      RC.text(x, fmt(pts) + ' biscuits', 150, 30, 20, '#fde68a', 'center');
      RC.text(x, fmt(rate() * (rush > 0 ? 7 : 1)) + ' / sec' + (rush > 0 ? '  ×7 RUSH ' + Math.ceil(rush / 1000) + 's' : ''), 150, 52, 12, rush > 0 ? '#fbbf24' : '#fcd34d', 'center');
      RC.text(x, 'Baked all time: ' + fmt(total), 150, 330, 12, '#d6d3d1', 'center');
      if (prest) RC.text(x, 'Prestige ' + prest + ' · ×' + (1 + prest * .5).toFixed(1), 150, 350, 12, '#c084fc', 'center');
      SHOP.forEach((s, i) => {
        const y = 40 + i * 50, can = pts >= cost(i);
        x.fillStyle = can ? '#78350f' : '#2a1305'; RC.rr(x, 300, y, 250, 44, 8);
        x.font = '22px sans-serif'; x.fillStyle = '#fff'; x.textAlign = 'left'; x.fillText(s[3], 308, y + 31);
        RC.text(x, s[0] + (owned[i] ? '  ×' + owned[i] : ''), 342, y + 18, 13, can ? '#fef3c7' : '#a8a29e');
        RC.text(x, fmt(cost(i)) + ' 🍪  ·  +' + s[2] + '/s', 342, y + 36, 11, can ? '#fbbf24' : '#78716c');
        RC.text(x, String(i + 1), 540, y + 28, 12, '#a8a29e', 'right');
      });
      const lv = Math.floor(total / 1e6), can = lv > prest;
      x.fillStyle = can ? '#6d28d9' : '#2e1065'; RC.rr(x, 300, 350, 250, 40, 8);
      RC.text(x, can ? '✨ Prestige now (P) → ×' + (1 + lv * .5).toFixed(1) : 'Prestige at ' + fmt((prest + 1) * 1e6) + ' baked', 425, 375, 12, can ? '#fff' : '#a78bfa', 'center');
      if (crumb) { const s = 1 + .15 * Math.sin(performance.now() / 120); x.fillStyle = '#fde047'; x.beginPath(); x.arc(crumb.x, crumb.y, 14 * s, 0, 7); x.fill(); x.fillStyle = '#fef9c3'; x.beginPath(); x.arc(crumb.x - 4, crumb.y - 4, 5, 0, 7); x.fill(); RC.text(x, 'GOLDEN CRUMB!', crumb.x, crumb.y - 22, 11, '#fde047', 'center'); }
      floaters.forEach(f => RC.text(x, f.s, f.x, f.y, 14, `rgba(254,240,138,${f.life / 900})`, 'center'));
    }
    reset();
  } },

/* ===== MANGO MARKET (shop management) ===== */
{ id: 'remix:mango-market', title: 'Mango Market', emoji: '🥭', cat: 'remix', colors: ['#78350f', '#fde68a'],
  help: 'Inspired by Monkey Mart. What\'s different: a Rush Hour hits every 45 seconds with double-paying crowds, customers lose patience and leave if the shelf is bare, and there is a three-branch upgrade tree including a helper who stocks for you. Controls: WASD/arrows or drag to move, 1/2/3 or tap the buttons to buy upgrades.',
  run(stage, api) {
    const W = 560, H = 400; const { c, x } = api.canvas(W, H); const k = RC.keys(api, stage);
    const TREE = { x: 80, y: 200 }, SHELF = { x: 300, y: 130, w: 120, h: 30 }, TILL = { x: 470, y: 300 }, DOOR = { x: 540, y: 390 };
    const UPS = [['Bigger basket', 30, 'cap'], ['Faster feet', 45, 'spd'], ['Helper monkey', 120, 'help']];
    let p, carry, cap, spd, helper, shelf, money, custs, t, rush, rushT, pickT, spawnT, day, over, started, msg, msgT, floaters, target, upLv;
    function reset() {
      p = { x: 200, y: 300 }; carry = 0; cap = 4; spd = 1; helper = null; shelf = 0; money = 0; custs = []; t = 0; rush = 0; rushT = 45000; pickT = 0; spawnT = 1500; day = 180000; over = false; started = false; msg = ''; msgT = 0; floaters = []; target = null; upLv = [0, 0, 0];
      api.score(0); api.overlay('<b>Mango Market</b>Pick mangoes at the tree, stock the shelf, stand at the till to get paid.<br><small>any key / tap to open the shop</small>');
    }
    const say = (s, ms = 1500) => { msg = s; msgT = ms; };
    function buy(i) {
      const lv = upLv[i], price = Math.ceil(UPS[i][1] * Math.pow(1.8, lv));
      if (i === 2 && lv >= 1) { say('You already have a helper'); return; }
      if (money < price) { say('Need $' + price); api.beep(160, .08); return; }
      money -= price; upLv[i]++; api.beep(900, .08);
      if (UPS[i][2] === 'cap') cap += 4; else if (UPS[i][2] === 'spd') spd += .25; else helper = { x: 120, y: 240, carry: 0, st: 'pick', t: 0 };
      say(UPS[i][0] + ' bought!');
    }
    function begin() { if (over) { reset(); return false; } if (!started) { started = true; api.overlay(null); } return true; }
    api.onKey(e => { if (!begin()) return; if (e.key >= '1' && e.key <= '3') buy(+e.key - 1); });
    api.onTap(e => { if (!begin()) return; const q = cpos(c, e); if (q.y < 34) { const i = Math.floor((q.x - 200) / 120); if (q.x >= 200 && i >= 0 && i < 3) { buy(i); return; } } target = q; });
    api.onMove(e => { if (e.buttons && started) target = cpos(c, e); });
    api.on(window, 'pointerup', () => { target = null; });
    api.onRestart(reset);
    const near = (a, b, d) => Math.hypot(a.x - b.x, a.y - b.y) < d;
    api.loop(dt => {
      if (started && !over) {
        const s = dt / 1000; t += dt; day -= dt;
        let dx = k.r - k.l, dy = k.d - k.u;
        if (target) { dx = target.x - p.x; dy = target.y - p.y; const m = Math.hypot(dx, dy); if (m < 6) dx = dy = 0; else { dx /= m; dy /= m; } }
        const m = Math.hypot(dx, dy) || 1; p.x = clamp(p.x + dx / m * 150 * spd * s, 20, W - 20); p.y = clamp(p.y + dy / m * 150 * spd * s, 50, H - 20);
        pickT -= dt;
        if (near(p, TREE, 50) && carry < cap && pickT <= 0) { carry++; pickT = 500; api.beep(700, .03); }
        if (Math.abs(p.x - (SHELF.x + SHELF.w / 2)) < 80 && Math.abs(p.y - SHELF.y) < 45 && carry > 0 && shelf < 12) { shelf += carry; carry = 0; api.beep(500, .05); }
        if (helper) { helper.t -= dt; const h = helper; if (h.st === 'pick') { if (near(h, TREE, 40)) { if (h.t <= 0) { h.carry++; h.t = 900; } if (h.carry >= 3) h.st = 'stock'; } else moveTo(h, TREE, 80 * s); } else { const tgt = { x: SHELF.x + SHELF.w / 2, y: SHELF.y + 40 }; if (near(h, tgt, 20)) { if (shelf < 12) { shelf += h.carry; } h.carry = 0; h.st = 'pick'; } else moveTo(h, tgt, 80 * s); } }
        rushT -= dt; if (rush > 0) { rush -= dt; if (rush <= 0) say('Rush hour over'); } else if (rushT <= 0) { rush = 12000; rushT = 45000; say('🚨 RUSH HOUR! Double pay!', 2500); api.beep(1200, .2); }
        spawnT -= dt; if (spawnT <= 0) { spawnT = (rush > 0 ? 900 : 2600) + rnd(1200); if (custs.length < 9) custs.push({ x: DOOR.x, y: DOOR.y, st: 'shelf', want: 1 + rnd(2), got: 0, pat: 9000, col: RC.PALETTE[rnd(9)], q: 0 }); }
        custs.forEach(cu => {
          if (cu.st === 'shelf') { const tgt = { x: SHELF.x + 20 + (cu.q || 0) * 25, y: SHELF.y + 50 }; if (near(cu, tgt, 10)) { if (shelf > 0) { shelf--; cu.got++; cu.pat = 9000; if (cu.got >= cu.want) cu.st = 'till'; } else { cu.pat -= dt; if (cu.pat <= 0) { cu.st = cu.got ? 'till' : 'leave'; if (!cu.got) { say('A customer left empty-handed'); api.beep(200, .1); } } } } else moveTo(cu, tgt, 90 * s); }
          else if (cu.st === 'till') { const tgt = { x: TILL.x - 40, y: TILL.y + 5 + cu.q * 24 }; if (near(cu, tgt, 8)) { if (near(p, TILL, 55)) { const pay = cu.got * 5 * (rush > 0 ? 2 : 1); money += pay; floaters.push({ x: cu.x, y: cu.y - 20, s: '+$' + pay, life: 900 }); api.beep(1000, .06); cu.st = 'leave'; } } else moveTo(cu, tgt, 90 * s); }
          else if (cu.st === 'leave') { if (near(cu, DOOR, 12)) cu.dead = true; else moveTo(cu, DOOR, 110 * s); }
        });
        custs = custs.filter(cu => !cu.dead);
        let qi = 0, si = 0; custs.forEach(cu => { if (cu.st === 'till') cu.q = qi++; else if (cu.st === 'shelf') cu.q = si++; });
        floaters.forEach(f => { f.life -= dt; f.y -= dt * .04; }); floaters = floaters.filter(f => f.life > 0);
        if (msgT > 0) msgT -= dt;
        api.score(money);
        if (day <= 0) { over = true; api.overlay(`<b>Closing time!</b>You made $${money}<br><small>any key / tap to open again</small>`); }
      }
      draw();
    });
    function moveTo(o, tgt, step) { const dx = tgt.x - o.x, dy = tgt.y - o.y, m = Math.hypot(dx, dy) || 1; o.x += dx / m * Math.min(step, m); o.y += dy / m * Math.min(step, m); }
    function monkey(cx, cy, col, items, hat) {
      x.fillStyle = col; x.beginPath(); x.arc(cx, cy, 12, 0, 7); x.fill();
      x.fillStyle = '#fde68a'; x.beginPath(); x.arc(cx, cy + 2, 7, 0, 7); x.fill();
      x.fillStyle = '#111'; x.fillRect(cx - 4, cy - 2, 2, 2); x.fillRect(cx + 2, cy - 2, 2, 2);
      if (hat) { x.fillStyle = '#dc2626'; x.fillRect(cx - 9, cy - 16, 18, 5); }
      for (let i = 0; i < items; i++) { x.fillStyle = '#f59e0b'; x.beginPath(); x.arc(cx - 8 + (i % 4) * 5.5, cy - 20 - Math.floor(i / 4) * 6, 3.5, 0, 7); x.fill(); }
    }
    function draw() {
      x.fillStyle = '#fef3c7'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#fde68a'; for (let i = 0; i < W; i += 40) for (let j = 40; j < H; j += 40) if ((i + j) / 40 % 2 < 1) x.fillRect(i, j, 40, 40);
      x.fillStyle = '#78350f'; x.fillRect(0, 0, W, 36);
      x.fillStyle = '#92400e'; x.fillRect(TREE.x - 8, TREE.y, 16, 40); x.fillStyle = '#16a34a'; x.beginPath(); x.arc(TREE.x, TREE.y - 15, 38, 0, 7); x.fill();
      x.fillStyle = '#f59e0b'; [[-20, -25], [12, -32], [22, -8], [-8, 0], [5, -12]].forEach(([a, b]) => { x.beginPath(); x.arc(TREE.x + a, TREE.y + b, 6, 0, 7); x.fill(); });
      x.fillStyle = '#a16207'; x.fillRect(SHELF.x, SHELF.y, SHELF.w, SHELF.h); x.fillStyle = '#854d0e'; x.fillRect(SHELF.x, SHELF.y + SHELF.h, SHELF.w, 6);
      for (let i = 0; i < shelf; i++) { x.fillStyle = '#f59e0b'; x.beginPath(); x.arc(SHELF.x + 10 + (i % 6) * 20, SHELF.y + 10 + Math.floor(i / 6) * 12, 6, 0, 7); x.fill(); }
      RC.text(x, 'SHELF ' + shelf + '/12', SHELF.x + SHELF.w / 2, SHELF.y - 8, 11, '#78350f', 'center');
      x.fillStyle = '#334155'; RC.rr(x, TILL.x - 20, TILL.y - 15, 60, 34, 6); RC.text(x, 'TILL', TILL.x + 10, TILL.y + 7, 12, '#fff', 'center');
      x.fillStyle = '#9ca3af'; x.fillRect(DOOR.x - 20, H - 6, 40, 6); RC.text(x, 'DOOR', DOOR.x - 10, H - 10, 10, '#4b5563');
      custs.forEach(cu => { monkey(cu.x, cu.y, cu.col, cu.got); if (cu.st === 'shelf' && shelf === 0) RC.text(x, '?', cu.x, cu.y - 18, 14, '#dc2626', 'center'); if (cu.st === 'till') RC.text(x, '$', cu.x, cu.y - 18, 14, '#16a34a', 'center'); });
      if (helper) monkey(helper.x, helper.y, '#a16207', helper.carry, true);
      monkey(p.x, p.y, '#7c2d12', carry);
      RC.text(x, carry + '/' + cap, p.x, p.y + 26, 10, '#7c2d12', 'center');
      RC.text(x, '$' + money, 12, 24, 18, '#fde68a');
      RC.text(x, Math.ceil(day / 1000) + 's', 120, 24, 13, rush > 0 ? '#fca5a5' : '#fde68a');
      UPS.forEach((u, i) => { const lv = upLv[i], price = Math.ceil(u[1] * Math.pow(1.8, lv)), maxed = i === 2 && lv >= 1; x.fillStyle = maxed ? '#57534e' : money >= price ? '#16a34a' : '#7f1d1d'; RC.rr(x, 202 + i * 120, 5, 116, 26, 6); RC.text(x, (i + 1) + ' ' + u[0] + (maxed ? ' ✓' : ' $' + price), 260 + i * 120, 22, 10, '#fff', 'center'); });
      if (rush > 0) { x.fillStyle = `rgba(239,68,68,${.15 + .1 * Math.sin(performance.now() / 80)})`; x.fillRect(0, 36, W, H - 36); RC.text(x, 'RUSH HOUR ' + Math.ceil(rush / 1000), W / 2, 60, 18, '#dc2626', 'center'); }
      if (msgT > 0) RC.text(x, msg, W / 2, H - 14, 13, '#7c2d12', 'center');
      floaters.forEach(f => RC.text(x, f.s, f.x, f.y, 13, `rgba(22,163,74,${f.life / 900})`, 'center'));
    }
    reset();
  } },

/* ===== PIP DASH (precision platformer) ===== */
{ id: 'remix:pip-dash', title: 'Pip Dash', emoji: '🟠', cat: 'remix', colors: ['#3f3f46', '#fb923c'],
  help: 'Inspired by OvO. What\'s different: a dash meter that refills only when you touch the floor (or grab an orb), slide under low gaps by holding down, and a best-time clock for all 9 levels. Controls: A/D or ←/→ move, W/↑/Space jump (press again on a wall to wall-jump), S/↓ slide, Shift or X to dash.',
  run(stage, api) {
    const T = 20, COLS = 30, ROWS = 18, W = COLS * T, H = ROWS * T; const { c, x } = api.canvas(W, H); const k = RC.keys(api, stage);
    const LEVELS = [
      ['##############################', '#                            #', '#                            #', '#                            #', '#                            #', '#                            #', '#                            #', '#                            #', '#                            #', '#                            #', '#                        E   #', '#                     ####   #', '#              ###           #', '#         ###                #', '#   S                        #', '#  ###          ^^^          #', '#          ^^^ #####  ^^^^^  #', '##############################'],
      ['##############################', '#                            #', '#                            #', '#            E               #', '#        #  ###              #', '#        #  #                #', '#        #  #                #', '#        #  #                #', '#        #  #                #', '#        #  #                #', '#        #  #                #', '#        #  #                #', '#        #  #                #', '#        #  #                #', '#        #  #                #', '#  S        #                #', '#############^^^^^^^^^^^^^^^^#', '##############################'],
      ['##############################', '#                            #', '#                            #', '#                            #', '#                            #', '#                            #', '#                            #', '#                            #', '#                            #', '#                            #', '#                            #', '#                E           #', '#  S      o    #####         #', '# ####                       #', '#                            #', '#                            #', '#^^^^^^^^^^^^^^^^^^^^^^^^^^^^#', '##############################'],
      ['##############################', '#                            #', '#                            #', '#                            #', '#   S          ####          #', '#  ###                       #', '#                            #', '#       ###                  #', '#              ###           #', '#                            #', '#                    ###     #', '#                            #', '#       o                    #', '#                       ###  #', '#                            #', '#  ####      ####          E #', '#^^^^^^^^^^^^^^^^^^^^^^^^^####', '##############################'],
      ['##############################', '#                            #', '#                            #', '#  S                     E   #', '# ###   #######   ##### ###  #', '#       #     #   #   #      #', '#       #     #   #   #      #', '#       #     #   #   #      #', '#       #     #   #   #      #', '#       #  o  #   # o #      #', '#       #     #   #   #      #', '#       #     #   #   #      #', '#       #     #   #   #      #', '#       #     #   #   #      #', '#       #     #   #   #      #', '#       #^^^^^#   #^^^#      #', '#^^^^^^^#     #^^^#   #^^^^^^#', '##############################'],
      ['##############################', '#                            #', '#                            #', '#  S                         #', '# ###########                #', '#           #                #', '#           #    ^^^^   ^^^  #', '#           #  #######  ###  #', '#      #    #                #', '#      #    #                #', '#      #    ####  ^^^^       #', '#      #          ####   E   #', '#      #                ###  #', '#   ^^^#                     #', '#  ####          o           #', '#        ^^^^^^^^^^^^^^^^^^^^#', '#        ####################' + '#', '##############################'],
      ['##############################', '#                            #', '#           #                #', '#   S       #        E       #', '#  ###      #       ###      #', '#           #                #', '#           #                #', '#      #    #    #           #', '#      #    #    #           #', '#      #    #    #           #', '#      #    #    #           #', '#      #    #    #           #', '#      #  o #  o #           #', '#      #    #    #           #', '#      #    #    #           #', '#      #    #    #           #', '#^^^^^^#^^^^#^^^^#^^^^^^^^^^^#', '##############################'],
      ['##############################', '#                            #', '#                            #', '#                            #', '#                            #', '#  S                         #', '# ###   ######    ######     #', '#              ^^          E #', '##############################', '##############################', '##############################', '##############################', '##############################', '##############################', '##############################', '##############################', '##############################', '##############################'],
      ['##############################', '#                            #', '#                            #', '#  S    ^     ^     ^        #', '# ###  ###   ###   ###       #', '#                            #', '#                        o   #', '#            ###             #', '#                            #', '#    ###                ###  #', '#                            #', '#          o                 #', '#                  ###       #', '#   ###                      #', '#                            #', '#                 E          #', '#^^^^^^^^^^^^^^^^####^^^^^^^^#', '##############################'],
    ];
    let lv, grid, p, orbs, time, best, deaths, alive, started, done, wallT, dashT, slide, face, particles, fin;
    const solid = (cx, cy) => { const r = Math.floor(cy / T), q = Math.floor(cx / T); if (r < 0 || r >= ROWS || q < 0 || q >= COLS) return true; return grid[r][q] === '#'; };
    const at = (cx, cy) => { const r = Math.floor(cy / T), q = Math.floor(cx / T); if (r < 0 || r >= ROWS || q < 0 || q >= COLS) return ' '; return grid[r][q]; };
    function loadLevel(i) {
      grid = LEVELS[i].map(r => r.split('')); orbs = [];
      grid.forEach((row, r) => row.forEach((ch, q) => { if (ch === 'S') { p = { x: q * T + 3, y: r * T + 2, vx: 0, vy: 0, w: 14, h: 18, g: false, dash: 1 }; row[q] = ' '; } if (ch === 'o') { orbs.push({ x: q * T + T / 2, y: r * T + T / 2, got: 0 }); row[q] = ' '; } }));
      wallT = 0; dashT = 0; slide = false; face = 1; particles = []; fin = 0;
    }
    function reset() { lv = 0; time = 0; deaths = 0; alive = true; started = false; done = false; best = store.get('pip-dash-best') || 0; loadLevel(0); api.score(0); api.overlay('<b>Pip Dash</b>9 levels. Reach the green door. Dash refills on the floor.<br><small>any key / tap to start</small>'); }
    function die() { deaths++; api.beep(120, .2); for (let i = 0; i < 14; i++) particles.push({ x: p.x + 7, y: p.y + 9, vx: (Math.random() - .5) * 300, vy: (Math.random() - .8) * 300, life: 500 }); loadLevel(lv); }
    let jumpQ = 0, dashQ = 0;
    function begin() { if (done) { reset(); return false; } if (!started) { started = true; api.overlay(null); } return true; }
    api.onKey(e => { if (!begin()) return; if ([' ', 'ArrowUp', 'w', 'W'].includes(e.key)) jumpQ = 120; if (['Shift', 'x', 'X'].includes(e.key)) dashQ = 120; });
    api.onTap(e => { if (!begin()) return; const q = cpos(c, e); if (q.y < H * .5) jumpQ = 120; else if (q.x > W * .4 && q.x < W * .6) dashQ = 120; });
    api.onRestart(reset);
    function collideX() { const l = p.x, r = p.x + p.w, t = p.y + 1, b = p.y + p.h - 1; if (p.vx > 0 && (solid(r, t) || solid(r, b))) { p.x = Math.floor(r / T) * T - p.w - .01; p.vx = 0; return 1; } if (p.vx < 0 && (solid(l, t) || solid(l, b))) { p.x = (Math.floor(l / T) + 1) * T + .01; p.vx = 0; return -1; } return 0; }
    function collideY() { const l = p.x + 1, r = p.x + p.w - 1, t = p.y, b = p.y + p.h; p.g = false; if (p.vy > 0 && (solid(l, b) || solid(r, b))) { p.y = Math.floor(b / T) * T - p.h - .01; p.vy = 0; p.g = true; p.dash = 1; } else if (p.vy < 0 && (solid(l, t) || solid(r, t))) { p.y = (Math.floor(t / T) + 1) * T + .01; p.vy = 0; } }
    api.loop(dt => {
      const s = Math.min(dt, 33) / 1000;
      if (started && alive && !done) {
        time += dt;
        const want = k.r - k.l;
        const touchL = solid(p.x - 1, p.y + 4) || solid(p.x - 1, p.y + p.h - 4), touchR = solid(p.x + p.w + 1, p.y + 4) || solid(p.x + p.w + 1, p.y + p.h - 4);
        if (jumpQ > 0) { jumpQ -= dt; if (p.g) { p.vy = -390; p.g = false; jumpQ = 0; api.beep(600, .04); } else if (!p.g && (touchL || touchR)) { p.vy = -350; p.vx = touchL ? 230 : -230; wallT = 160; jumpQ = 0; api.beep(700, .04); } }
        if (dashQ > 0) { dashQ -= dt; if (p.dash > 0 && dashT <= 0) { p.dash = 0; dashT = 160; dashQ = 0; p.vy = k.u ? -300 : 0; p.vx = face * 460; api.beep(900, .06); } }
        const wantSlide = k.d && p.g; if (wantSlide && !slide) { slide = true; p.y += 8; p.h = 10; } else if (!wantSlide && slide) { if (!solid(p.x + 2, p.y - 9) && !solid(p.x + p.w - 2, p.y - 9)) { slide = false; p.y -= 8; p.h = 18; } }
        if (wallT > 0) wallT -= dt; else if (dashT <= 0) { if (want) { p.vx += want * (slide ? 500 : 1400) * s; face = want; } p.vx -= p.vx * (slide ? 1.5 : p.g ? 11 : 4) * s; p.vx = clamp(p.vx, -190, 190); if (slide && Math.abs(p.vx) < 60 && want === 0) p.vx *= .98; }
        if (dashT > 0) dashT -= dt; else p.vy += 1150 * s;
        if (!p.g && (touchL || touchR) && p.vy > 0 && (k.l || k.r)) p.vy = Math.min(p.vy, 70);
        p.vy = Math.min(p.vy, 520);
        p.x += p.vx * s; collideX(); p.y += p.vy * s; collideY();
        const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
        for (const [ox, oy] of [[3, 3], [p.w - 3, 3], [3, p.h - 3], [p.w - 3, p.h - 3]]) if (at(p.x + ox, p.y + oy) === '^') { die(); break; }
        orbs.forEach(o => { if (!o.got && Math.hypot(o.x - cx, o.y - cy) < 16) { o.got = 1; p.dash = 1; api.beep(1000, .05); } });
        if (at(cx, cy) === 'E') { lv++; api.beep(1300, .12); api.score(lv); if (lv >= LEVELS.length) { done = true; if (!best || time < best) { best = time; store.set('pip-dash-best', best); } api.overlay(`<b>All 9 levels!</b>${RC.fmt(time)} · ${deaths} deaths<br>Best ${RC.fmt(best)}<br><small>any key / tap to run again</small>`); } else { loadLevel(lv); fin = 400; } }
        if (p.y > H) die();
      }
      particles.forEach(q => { q.life -= dt; q.x += q.vx * s; q.y += q.vy * s; q.vy += 800 * s; }); particles = particles.filter(q => q.life > 0);
      if (fin > 0) fin -= dt;
      draw();
    });
    function draw() {
      x.fillStyle = '#e4e4e7'; x.fillRect(0, 0, W, H);
      for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) { const ch = grid[r][q]; if (ch === '#') { x.fillStyle = '#27272a'; x.fillRect(q * T, r * T, T, T); x.fillStyle = '#3f3f46'; x.fillRect(q * T, r * T, T, 3); } else if (ch === '^') { x.fillStyle = '#dc2626'; x.beginPath(); x.moveTo(q * T, r * T + T); x.lineTo(q * T + T / 2, r * T + 2); x.lineTo(q * T + T, r * T + T); x.fill(); } else if (ch === 'E') { x.fillStyle = '#16a34a'; x.fillRect(q * T + 3, r * T, T - 6, T); x.fillStyle = '#86efac'; x.fillRect(q * T + 6, r * T + 4, T - 12, T - 4); } }
      orbs.forEach(o => { if (o.got) return; x.fillStyle = '#f97316'; x.beginPath(); x.arc(o.x, o.y, 6 + Math.sin(performance.now() / 150) * 1.5, 0, 7); x.fill(); });
      if (dashT > 0) { x.fillStyle = 'rgba(251,146,60,.4)'; x.fillRect(p.x - face * 20, p.y, p.w + 20, p.h); }
      x.fillStyle = '#18181b'; RC.rr(x, p.x, p.y, p.w, p.h, 4);
      x.fillStyle = p.dash ? '#fb923c' : '#71717a'; x.fillRect(p.x + (face > 0 ? 8 : 2), p.y + 4, 4, 3);
      particles.forEach(q => { x.fillStyle = `rgba(24,24,27,${q.life / 500})`; x.fillRect(q.x, q.y, 4, 4); });
      RC.text(x, 'LEVEL ' + Math.min(lv + 1, LEVELS.length) + '/' + LEVELS.length, 8, 16, 12, '#e4e4e7');
      RC.text(x, RC.fmt(time), W / 2, 16, 12, '#e4e4e7', 'center');
      RC.text(x, 'deaths ' + deaths + (best ? '  ·  best ' + RC.fmt(best) : ''), W - 8, 16, 12, '#e4e4e7', 'right');
      x.fillStyle = '#a1a1aa'; x.fillRect(W / 2 - 30, 22, 60, 4); x.fillStyle = '#fb923c'; x.fillRect(W / 2 - 30, 22, 60 * p.dash, 4);
      if (fin > 0) RC.text(x, 'LEVEL ' + lv + ' CLEAR', W / 2, H / 2, 26, `rgba(22,163,74,${fin / 400})`, 'center');
    }
    reset();
  } },

);

/* ===== RHYTHM RUNNER ENGINE (Beat Blocks family) ===== */
function rhythm(stage, api, o) {
  const W = 600, H = 360, FL = 300, CE = 60, S = 26, B = 30, LEN = o.length || 7000; const { c, x } = api.canvas(W, H);
  let objs, px, py, vy, grav, mode, hold, alive, started, prog, best, attempts, dead, deadT, rot, done, t, trail, speed, zone;
  function gen() {
    const R = seeded(o.seed); objs = []; let cx = 500, g = 1, m = 'cube';
    const spike = (sx, top) => objs.push({ t: 'spike', x: sx, y: top ? CE : FL - B, w: B, h: B, top });
    const block = (bx, by, bw, bh) => objs.push({ t: 'block', x: bx, y: by, w: bw, h: bh });
    const plan = o.plan(R);
    for (const sec of plan) {
      if (sec.mode !== m) { objs.push({ t: 'portal', kind: sec.mode, x: cx, y: CE, w: 22, h: FL - CE }); m = sec.mode; cx += 260; }
      let end = cx + sec.len;
      while (cx < end) {
        if (m === 'cube') {
          const r = R();
          if (o.gravity && r < .08) { objs.push({ t: 'portal', kind: 'grav', x: cx, y: CE, w: 22, h: FL - CE }); g = -g; cx += 240; continue; }
          if (o.zones && r < .18) { const z = R() < .5 ? 'slow' : 'fast'; objs.push({ t: 'zone', kind: z, x: cx, y: CE, w: 200 + Math.floor(R() * 200), h: FL - CE }); cx += 40; continue; }
          const top = g < 0, base = top ? CE : FL;
          if (r < .5) { const n = 1 + Math.floor(R() * 3); for (let i = 0; i < n; i++) spike(cx + i * B, top); cx += n * B + 190 + Math.floor(R() * 90); }
          else if (r < .75) { const hgt = 1 + Math.floor(R() * 2); block(cx, top ? CE : FL - B * hgt, B, B * hgt); if (R() < .5) { for (let i = 0; i < 2; i++) spike(cx + B + i * B, top); } cx += 3 * B + 200 + Math.floor(R() * 80); }
          else { const n = 2 + Math.floor(R() * 2); for (let i = 0; i < n; i++) spike(cx + i * B, top); block(cx - 10, top ? CE + B * 2.2 : FL - B * 3.2, n * B + 20, B); cx += n * B + 220 + Math.floor(R() * 80); }
        } else if (m === 'ship') {
          const gapY = CE + 40 + R() * (FL - CE - 140), gapH = 90 + R() * 30;
          block(cx, CE, 34, gapY - CE); block(cx, gapY + gapH, 34, FL - gapY - gapH); cx += 180 + Math.floor(R() * 60);
        } else {
          const narrow = clamp((cx - (end - sec.len)) / sec.len, 0, 1), gapH = 130 - narrow * 55, gapY = CE + 20 + R() * (FL - CE - 40 - gapH);
          block(cx, CE, 60, gapY - CE); block(cx, gapY + gapH, 60, FL - gapY - gapH); cx += 60;
        }
      }
      cx = Math.max(cx, end);
    }
    objs.push({ t: 'finish', x: cx + 200, y: CE, w: 20, h: FL - CE });
    return cx + 300;
  }
  let total;
  function reset() { total = gen(); attempts = 0; best = store.get(o.id + '-best') || 0; started = false; done = false; spawn(); api.score(Math.floor(best)); api.overlay(`<b>${o.title}</b>${o.intro}<br><small>any key / tap to start</small>`); }
  function spawn() { px = 100; py = FL - S; vy = 0; grav = 1; mode = 'cube'; hold = false; alive = true; prog = 0; dead = false; deadT = 0; rot = 0; t = 0; trail = []; speed = o.speed || 330; zone = null; }
  function begin() { if (done) { reset(); return; } if (!started) { started = true; api.overlay(null); } }
  const down = () => { begin(); hold = true; };
  api.onKey(e => { if ([' ', 'ArrowUp', 'w', 'W'].includes(e.key)) e.preventDefault(); down(); });
  api.onKeyUp(() => { hold = false; });
  api.onTap(down); api.on(window, 'pointerup', () => { hold = false; }); api.on(window, 'blur', () => { hold = false; });
  api.onRestart(reset);
  const hit = (ax, ay, aw, ah, b) => ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y;
  function die() { dead = true; alive = false; deadT = 700; attempts++; api.beep(110, .3); prog = Math.max(prog, 0); if (prog > best) { best = prog; store.set(o.id + '-best', best); api.score(Math.floor(best)); } }
  api.loop(dt => {
    const s = Math.min(dt, 33) / 1000;
    if (dead) { deadT -= dt; if (deadT <= 0) spawn(); }
    else if (started && alive && !done) {
      t += dt;
      let sp = speed; if (zone) sp *= zone.kind === 'slow' ? .6 : 1.5;
      const camx = px - 100;
      const onGround = grav > 0 ? py >= FL - S - .5 : py <= CE + .5;
      if (mode === 'cube') {
        if (hold && onGround) { vy = -720 * grav; api.beep(400, .02); }
        vy += 2200 * grav * s; py += vy * s;
        if (grav > 0 && py > FL - S) { py = FL - S; vy = 0; } if (grav < 0 && py < CE) { py = CE; vy = 0; }
        if (!onGround) rot += 5 * s * grav; else rot = Math.round(rot / (Math.PI / 2)) * (Math.PI / 2);
      } else if (mode === 'ship') {
        vy += (hold ? -1900 : 1900) * s; vy = clamp(vy, -420, 420); py += vy * s; py = clamp(py, CE, FL - S); rot = vy / 900;
      } else { vy = hold ? -sp : sp; py += vy * s; if (py < CE || py > FL - S) { die(); } rot = hold ? -Math.PI / 4 : Math.PI / 4; }
      px += sp * s;
      prog = clamp(px / total * 100, 0, 100);
      zone = null;
      for (const ob of objs) {
        if (ob.x + ob.w < camx - 50 || ob.x > camx + W + 50) continue;
        if (ob.t === 'zone') { if (px + S > ob.x && px < ob.x + ob.w) zone = ob; continue; }
        if (ob.t === 'portal') { if (hit(px, py, S, S, ob) && !ob.used) { ob.used = t; if (ob.kind === 'grav') { grav = -grav; vy = 0; } else { mode = ob.kind; vy = 0; if (mode !== 'cube') grav = 1; } api.beep(1000, .08); } continue; }
        if (ob.t === 'finish') { if (px > ob.x) { done = true; prog = 100; best = 100; store.set(o.id + '-best', 100); api.score(100); api.overlay(`<b>LEVEL COMPLETE!</b>${attempts + 1} attempts<br><small>any key / tap to play again</small>`); } continue; }
        if (ob.t === 'spike') { if (hit(px + 7, py + 7, S - 14, S - 14, ob)) { die(); break; } continue; }
        if (ob.t === 'block') {
          if (!hit(px, py, S, S, ob)) continue;
          if (mode === 'cube') {
            if (grav > 0 && vy >= 0 && py + S - vy * s - 2 <= ob.y) { py = ob.y - S; vy = 0; rot = Math.round(rot / (Math.PI / 2)) * (Math.PI / 2); continue; }
            if (grav < 0 && vy <= 0 && py - vy * s + 2 >= ob.y + ob.h) { py = ob.y + ob.h; vy = 0; continue; }
          }
          die(); break;
        }
      }
      if (t % 60 < 17) trail.push({ x: px, y: py + S / 2, life: 400 });
      trail.forEach(q => q.life -= dt); trail = trail.filter(q => q.life > 0);
      objs.forEach(ob => { if (ob.used && ob.x + ob.w < camx - 100) ob.used = 0; });
    }
    draw();
  });
  function drawObj(ob, camx) {
    const sx = ob.x - camx;
    if (ob.t === 'block') { x.fillStyle = o.block; x.fillRect(sx, ob.y, ob.w, ob.h); x.strokeStyle = o.edge; x.lineWidth = 2; x.strokeRect(sx + 1, ob.y + 1, ob.w - 2, ob.h - 2); }
    else if (ob.t === 'spike') { x.fillStyle = o.spike; x.beginPath(); if (ob.top) { x.moveTo(sx, ob.y); x.lineTo(sx + ob.w / 2, ob.y + ob.h); x.lineTo(sx + ob.w, ob.y); } else { x.moveTo(sx, ob.y + ob.h); x.lineTo(sx + ob.w / 2, ob.y); x.lineTo(sx + ob.w, ob.y + ob.h); } x.closePath(); x.fill(); }
    else if (ob.t === 'portal') { const col = ob.kind === 'grav' ? '#facc15' : ob.kind === 'ship' ? '#f472b6' : ob.kind === 'wave' ? '#22d3ee' : '#4ade80'; x.fillStyle = col + '55'; x.fillRect(sx, ob.y, ob.w, ob.h); x.fillStyle = col; x.fillRect(sx + 6, ob.y, 4, ob.h); x.fillRect(sx + 12, ob.y, 4, ob.h); RC.text(x, ob.kind === 'grav' ? '⇅' : ob.kind.toUpperCase(), sx + 11, ob.y - 6, 11, col, 'center'); }
    else if (ob.t === 'zone') { x.fillStyle = ob.kind === 'slow' ? 'rgba(96,165,250,.18)' : 'rgba(255,255,255,.22)'; x.fillRect(sx, ob.y, ob.w, ob.h); RC.text(x, ob.kind === 'slow' ? '❄ SLUSH' : '❄ ICE', sx + ob.w / 2, ob.y + 16, 11, ob.kind === 'slow' ? '#93c5fd' : '#fff', 'center'); }
    else if (ob.t === 'finish') { x.fillStyle = '#fff'; for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2) x.fillRect(sx + j * 10, ob.y + i * 30, 10, 30); }
  }
  function draw() {
    const camx = px - 100;
    const grd = x.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, o.bg[0]); grd.addColorStop(1, o.bg[1]); x.fillStyle = grd; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(255,255,255,.06)'; x.lineWidth = 1; for (let gx = -(camx * .5 % 60); gx < W; gx += 60) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, H); x.stroke(); }
    x.fillStyle = o.ground; x.fillRect(0, FL, W, H - FL); x.fillRect(0, 0, W, CE);
    x.fillStyle = o.edge; x.fillRect(0, FL, W, 2); x.fillRect(0, CE - 2, W, 2);
    x.fillStyle = 'rgba(255,255,255,.08)'; for (let gx = -(camx % 40); gx < W; gx += 40) { x.fillRect(gx, FL, 20, H - FL); x.fillRect(gx, 0, 20, CE); }
    objs.forEach(ob => { if (ob.x + ob.w > camx - 40 && ob.x < camx + W + 40) drawObj(ob, camx); });
    trail.forEach(q => { x.fillStyle = `rgba(255,255,255,${q.life / 1200})`; x.fillRect(q.x - camx - 4, q.y - 2, 6, 4); });
    if (!dead) {
      x.save(); x.translate(px - camx + S / 2, py + S / 2); x.rotate(rot);
      if (mode === 'ship') { x.fillStyle = o.player; x.beginPath(); x.moveTo(-14, 6); x.lineTo(14, 0); x.lineTo(-14, -6); x.closePath(); x.fill(); x.fillStyle = '#fff'; x.fillRect(-6, -3, 6, 6); }
      else if (mode === 'wave') { x.fillStyle = o.player; x.beginPath(); x.moveTo(14, 0); x.lineTo(-10, -9); x.lineTo(-4, 0); x.lineTo(-10, 9); x.closePath(); x.fill(); }
      else { x.fillStyle = o.player; RC.rr(x, -S / 2, -S / 2, S, S, 4); x.fillStyle = o.bg[1]; x.fillRect(-S / 2 + 5, -S / 2 + 5, S - 10, S - 10); x.fillStyle = o.player; x.fillRect(-4, -4, 8, 8); }
      x.restore();
    } else { x.fillStyle = o.player; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, d = (700 - deadT) / 6; x.fillRect(px - camx + S / 2 + Math.cos(a) * d, py + S / 2 + Math.sin(a) * d, 5, 5); } }
    x.fillStyle = 'rgba(0,0,0,.4)'; RC.rr(x, W / 2 - 150, 12, 300, 12, 6); x.fillStyle = o.player; RC.rr(x, W / 2 - 150, 12, 300 * prog / 100, 12, 6);
    RC.text(x, Math.floor(prog) + '%', W / 2, 40, 13, '#fff', 'center');
    RC.text(x, 'attempt ' + (attempts + 1), 10, 24, 12, 'rgba(255,255,255,.8)');
    RC.text(x, 'best ' + Math.floor(best) + '%', W - 10, 24, 12, 'rgba(255,255,255,.8)', 'right');
    if (mode !== 'cube') RC.text(x, mode.toUpperCase() + (mode === 'ship' ? ' · hold to fly' : ' · hold = up'), W / 2, H - 14, 11, 'rgba(255,255,255,.7)', 'center');
    if (zone) RC.text(x, zone.kind === 'slow' ? 'SLUSH – slow' : 'ICE – fast!', W / 2, H - 14, 11, '#fff', 'center');
  }
  reset();
}

GAMES.push(
{ id: 'remix:beat-blocks', title: 'Beat Blocks', emoji: '🟦', cat: 'remix', colors: ['#1e1b4b', '#38bdf8'],
  help: 'Inspired by Geometry Dash. What\'s different: yellow gravity portals flip you onto the ceiling mid-run, the level is generated from a fixed seed so it is the same every attempt but nothing is copied, and your best % is saved. Controls: Space/↑/W or tap to jump. Hold to keep hopping.',
  run(stage, api) { rhythm(stage, api, { id: 'beat-blocks', title: 'Beat Blocks', intro: 'One button. Spikes kill. Yellow portals flip gravity.', seed: 20260903, length: 7000, gravity: true, bg: ['#312e81', '#1e1b4b'], ground: '#1e1b4b', edge: '#818cf8', block: '#3730a3', spike: '#f8fafc', player: '#38bdf8',
    plan: R => [{ mode: 'cube', len: 3200 }, { mode: 'ship', len: 1400 }, { mode: 'cube', len: 2400 }] }); } },

{ id: 'remix:beat-blocks-frost', title: 'Beat Blocks: Frostbite', emoji: '🧊', cat: 'remix', colors: ['#0c4a6e', '#a5f3fc'],
  help: 'Inspired by Geometry Dash SubZero. What\'s different: slush patches slow you down and ice patches speed you up so the rhythm keeps changing, a ship section flies through icicle gaps, and gravity portals still flip you. Controls: Space/↑/W or tap to jump, hold to fly in ship mode.',
  run(stage, api) { rhythm(stage, api, { id: 'beat-blocks-frost', title: 'Frostbite', intro: 'Ice speeds you up, slush slows you down. Watch the rhythm.', seed: 777123, length: 7600, gravity: true, zones: true, speed: 320, bg: ['#0369a1', '#082f49'], ground: '#082f49', edge: '#7dd3fc', block: '#0e7490', spike: '#e0f2fe', player: '#a5f3fc',
    plan: R => [{ mode: 'cube', len: 2400 }, { mode: 'ship', len: 1600 }, { mode: 'cube', len: 2000 }, { mode: 'ship', len: 1200 }] }); } },

{ id: 'remix:beat-blocks-surge', title: 'Beat Blocks: Surge', emoji: '🌊', cat: 'remix', colors: ['#4c1d95', '#c084fc'],
  help: 'Inspired by Geometry Dash Hyper Wave. What\'s different: most of the level is wave mode where holding sends you diagonally up and releasing sends you down, the corridors squeeze tighter the longer a section lasts, and short cube breaks let you breathe. Controls: hold Space/↑ or hold a finger down to rise, let go to dive.',
  run(stage, api) { rhythm(stage, api, { id: 'beat-blocks-surge', title: 'Surge', intro: 'Hold to zig up, release to zag down. Corridors get tighter.', seed: 424242, length: 7200, gravity: false, speed: 300, bg: ['#6d28d9', '#2e1065'], ground: '#2e1065', edge: '#c084fc', block: '#5b21b6', spike: '#fdf4ff', player: '#e879f9',
    plan: R => [{ mode: 'cube', len: 900 }, { mode: 'wave', len: 2200 }, { mode: 'cube', len: 900 }, { mode: 'wave', len: 2600 }] }); } },
);
})();
