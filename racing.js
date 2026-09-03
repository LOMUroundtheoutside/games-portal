/* ===================== RACING GAMES =====================
   20 car games. Shared helpers live in RC; every game is pushed onto GAMES
   (defined in games.js) so app.js picks them up automatically.            */

const RC = {
  /* held-key tracker. Arrows/WASD → l r u d, Space → sp, Shift → sh.
     Touch: left/right 40% of the stage steers, any touch also counts as throttle (t). */
  keys(api, stage) {
    const k = { l: 0, r: 0, u: 0, d: 0, sp: 0, sh: 0, t: 0 };
    const map = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd', ' ': 'sp', Shift: 'sh' };
    api.onKey(e => { const m = map[e.key]; if (m) { e.preventDefault(); k[m] = 1; } });
    api.onKeyUp(e => { const m = map[e.key]; if (m) k[m] = 0; });
    const touch = e => { const r = stage.getBoundingClientRect(); const fx = (e.clientX - r.left) / r.width; k.l = fx < .4 ? 1 : 0; k.r = fx > .6 ? 1 : 0; k.t = 1; };
    api.on(stage, 'pointerdown', touch);
    api.on(stage, 'pointermove', e => { if (e.buttons) touch(e); });
    api.on(window, 'pointerup', () => { k.l = k.r = k.t = 0; });
    api.on(window, 'blur', () => { for (const q in k) k[q] = 0; });
    return k;
  },
  rr(x, a, b, w, h, r) { r = Math.min(r, w / 2, h / 2); x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); x.fill(); },
  /* top-down car, nose pointing along +x when ang = 0. L = length, Wd = width */
  car(x, cx, cy, ang, L, Wd, col, o = {}) {
    x.save(); x.translate(cx, cy); x.rotate(ang);
    const wl = L * .22, ww = Wd * .3;
    x.fillStyle = '#111';
    for (const [px, py] of [[-L * .34, -Wd / 2 - 1.5], [L * .12, -Wd / 2 - 1.5], [-L * .34, Wd / 2 - ww + 1.5], [L * .12, Wd / 2 - ww + 1.5]]) x.fillRect(px, py, wl, ww);
    x.fillStyle = col; RC.rr(x, -L / 2, -Wd / 2, L, Wd, Math.min(4, Wd / 3));
    x.fillStyle = 'rgba(0,0,0,.42)'; x.fillRect(L * .04, -Wd * .34, L * .2, Wd * .68);
    x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(-L * .42, -Wd * .34, L * .3, Wd * .68);
    x.fillStyle = o.dark ? '#555' : '#fef08a'; x.fillRect(L / 2 - 3, -Wd / 2 + 1, 3, Wd * .22); x.fillRect(L / 2 - 3, Wd / 2 - 1 - Wd * .22, 3, Wd * .22);
    x.fillStyle = o.brake ? '#ff3b3b' : '#991b1b'; x.fillRect(-L / 2, -Wd / 2 + 1, 2.5, Wd * .22); x.fillRect(-L / 2, Wd / 2 - 1 - Wd * .22, 2.5, Wd * .22);
    if (o.siren) { x.fillStyle = Math.floor(performance.now() / 150) % 2 ? '#3b82f6' : '#ef4444'; x.fillRect(-L * .12, -Wd * .3, L * .2, Wd * .6); }
    if (o.wreck) { x.fillStyle = 'rgba(0,0,0,.55)'; RC.rr(x, -L / 2, -Wd / 2, L, Wd, 3); }
    x.restore();
  },
  text(x, s, px, py, size = 14, col = '#fff', align = 'left') { x.font = `bold ${size}px monospace`; x.fillStyle = col; x.textAlign = align; x.fillText(s, px, py); x.textAlign = 'left'; },
  lerp: (a, b, t) => a + (b - a) * t,
  ang: a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; },
  fmt: ms => (ms / 1000).toFixed(2) + 's',
  /* Catmull-Rom spline through closed control points → dense path with curvature */
  spline(pts, per = 12) {
    const out = [], n = pts.length;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      for (let j = 0; j < per; j++) {
        const t = j / per, t2 = t * t, t3 = t2 * t;
        out.push({
          x: .5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          y: .5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        });
      }
    }
    const N = out.length;
    out.forEach((p, i) => { const a = out[(i - 1 + N) % N], b = out[(i + 1) % N]; p.a = Math.atan2(b.y - a.y, b.x - a.x); p.len = Math.hypot(b.x - p.x, b.y - p.y); });
    out.forEach((p, i) => { const b = out[(i + 1) % N]; p.k = Math.abs(RC.ang(b.a - p.a)) / Math.max(1, p.len); });
    return out;
  },
  /* index of the closest path point, searching ±win around hint (or everywhere) */
  nearest(path, px, py, hint, win = 18) {
    const N = path.length; let best = 0, bd = 1e12;
    const from = hint == null ? 0 : hint - win, to = hint == null ? N - 1 : hint + win;
    for (let j = from; j <= to; j++) { const i = ((j % N) + N) % N; const d = (path[i].x - px) ** 2 + (path[i].y - py) ** 2; if (d < bd) { bd = d; best = i; } }
    return { i: best, d: Math.sqrt(bd) };
  },
  PALETTE: ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#eab308', '#e2e8f0'],
};

GAMES.push(

/* ===== HIGHWAY RUSH ===== */
{ id: 'highway', title: 'Highway Rush', emoji: '🚗', cat: 'racing', colors: ['#1e3a8a', '#f59e0b'],
  help: '← → (or A/D) change lane, hold ↑ to floor it. Dodge traffic – near misses score extra.',
  run(stage, api) {
    const W = 360, H = 520, LANES = 3, RX = 60, RW = 240, LW = RW / LANES, PY = H - 90; const { c, x } = api.canvas(W, H);
    const k = RC.keys(api, stage);
    const laneX = l => RX + LW * l + LW / 2;
    let lane, px, cars, dist, speed, alive, started, spawn, score, near;
    function reset() { lane = 1; px = laneX(1); cars = []; dist = 0; speed = 5; alive = true; started = false; spawn = 0; score = 0; near = 0; api.score(0); api.overlay('<b>Highway Rush</b><small>← → to switch lane · any key to start</small>'); }
    function begin() { if (!alive) { reset(); return false; } if (!started) { started = true; api.overlay(null); } return true; }
    api.onKey(e => { if (!begin()) return; if (['ArrowLeft', 'a', 'A'].includes(e.key)) lane = Math.max(0, lane - 1); if (['ArrowRight', 'd', 'D'].includes(e.key)) lane = Math.min(LANES - 1, lane + 1); });
    api.onTap(e => { if (!begin()) return; const r = stage.getBoundingClientRect(); const fx = (e.clientX - r.left) / r.width; lane = fx < .5 ? Math.max(0, lane - 1) : Math.min(LANES - 1, lane + 1); });
    api.onRestart(reset);
    api.loop(dt => {
      const s = dt / 16.67;
      if (started && alive) {
        const target = 5 + dist / 400 + (k.u || k.t ? 3 : 0); speed += (target - speed) * .02 * s;
        dist += speed * s * .08;
        px += (laneX(lane) - px) * .25 * s;
        spawn -= dt;
        if (spawn <= 0) { spawn = Math.max(280, 900 - dist / 4) + rnd(300); const l = rnd(LANES); if (!cars.some(o => o.lane === l && o.y < 140) && cars.filter(o => o.y < 220).length < 2) cars.push({ lane: l, y: -80, v: 1.5 + Math.random() * 2, col: RC.PALETTE[rnd(9)], passed: false }); }
        cars.forEach(o => {
          o.y += (speed - o.v) * s;
          if (!o.passed && o.y > PY + 20) { o.passed = true; score += 5; const dx = Math.abs(laneX(o.lane) - px); if (dx > LW * .55 && dx < LW * 1.05) { score += 25; near = 700; api.beep(900, .06); } }
        });
        cars = cars.filter(o => o.y < H + 80);
        for (const o of cars) if (Math.abs(laneX(o.lane) - px) < LW * .62 && Math.abs(o.y - PY) < 58) { alive = false; api.beep(100, .5); api.overlay(`<b>Crash!</b>${Math.floor(dist)} m · ${score + Math.floor(dist)} pts<br><small>any key / tap to retry</small>`); }
        if (near > 0) near -= dt;
        api.score(score + Math.floor(dist));
      }
      draw();
    });
    function draw() {
      x.fillStyle = '#14532d'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#374151'; x.fillRect(RX, 0, RW, H);
      x.fillStyle = '#fbbf24'; x.fillRect(RX - 4, 0, 4, H); x.fillRect(RX + RW, 0, 4, H);
      x.fillStyle = '#e5e7eb'; const off = (dist * 12) % 60; for (let l = 1; l < LANES; l++) for (let y = -60; y < H; y += 60) x.fillRect(RX + l * LW - 2, y + off, 4, 30);
      cars.forEach(o => RC.car(x, laneX(o.lane), o.y, Math.PI / 2, 56, 30, o.col));
      RC.car(x, px, PY, -Math.PI / 2, 56, 30, '#f43f5e', { brake: k.d });
      RC.text(x, Math.floor(dist) + ' m', 10, 22); RC.text(x, (score + Math.floor(dist)) + ' pts', W - 10, 22, 14, near > 0 ? '#fde047' : '#fff', 'right');
      RC.text(x, Math.round(speed * 22) + ' km/h', 10, H - 12, 12, '#cbd5e1');
      if (near > 0) RC.text(x, 'NEAR MISS +25', W / 2, PY - 60, 16, '#fde047', 'center');
    }
    reset();
  } },

/* ===== OVERTAKE ===== */
{ id: 'overtake', title: 'Overtake', emoji: '🏎️', cat: 'racing', colors: ['#dc2626', '#111827'],
  help: '← → steer, ↑ ↓ throttle. Tuck in behind a car to charge DRS, then Space to boost past. Count your overtakes.',
  run(stage, api) {
    const W = 380, H = 520, RX = 40, RW = 300, PY = H - 100; const { c, x } = api.canvas(W, H);
    const k = RC.keys(api, stage);
    let px, speed, cars, over, alive, started, drs, boost, dist, spawn;
    function reset() { px = W / 2; speed = 6; cars = []; over = 0; alive = true; started = false; drs = 0; boost = 0; dist = 0; spawn = 0; api.score(0); api.overlay('<b>Overtake</b><small>any key to start</small>'); }
    function begin() { if (!alive) reset(); else if (!started) { started = true; api.overlay(null); } }
    api.onKey(e => { begin(); if (e.key === ' ' && drs >= 100 && alive && started) { boost = 1500; drs = 0; api.beep(800, .1); } });
    api.onTap(begin); api.onRestart(reset);
    api.loop(dt => {
      const s = dt / 16.67;
      if (started && alive) {
        const top = 9 + Math.min(4, dist / 1500) + (boost > 0 ? 6 : 0);
        if (k.u || k.t) speed = Math.min(top, speed + .12 * s); else if (k.d) speed = Math.max(3, speed - .25 * s); else speed = Math.max(3, speed - .03 * s);
        if (boost > 0) { boost -= dt; speed = Math.max(speed, top); }
        px = clamp(px + (k.r - k.l) * 5 * s * Math.min(1, speed / 6), RX + 16, RX + RW - 16);
        dist += speed * s * .1; spawn -= dt;
        if (spawn <= 0) { spawn = 650 + rnd(600); const lx = RX + 30 + rnd(RW - 60); if (!cars.some(o => o.y < 80 && Math.abs(o.x - lx) < 60)) cars.push({ x: lx, y: -60, v: 4 + Math.random() * 3.5, col: RC.PALETTE[rnd(9)], passed: false, wob: Math.random() * 6 }); }
        let slip = false;
        cars.forEach(o => {
          o.y += (speed - o.v) * s; o.wob += dt / 700; o.x = clamp(o.x + Math.sin(o.wob) * .3 * s, RX + 14, RX + RW - 14);
          if (!o.passed && o.y > PY + 30) { o.passed = true; over++; api.beep(600, .05); }
          if (o.y < PY && o.y > PY - 140 && Math.abs(o.x - px) < 22) slip = true;
        });
        drs = clamp(drs + (slip ? dt / 12 : -dt / 60), 0, 100);
        cars = cars.filter(o => o.y < H + 80 && o.y > -400);
        for (const o of cars) if (Math.abs(o.x - px) < 24 && Math.abs(o.y - PY) < 48) { alive = false; api.beep(100, .5); api.overlay(`<b>Contact!</b>${over} overtakes<br><small>any key / tap to retry</small>`); }
        api.score(over);
      }
      draw();
    });
    function draw() {
      x.fillStyle = '#065f46'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#4b5563'; x.fillRect(RX, 0, RW, H);
      const off = (dist * 10) % 40;
      for (let y = -40; y < H; y += 40) { x.fillStyle = (Math.floor((y + off) / 40) % 2) ? '#ef4444' : '#f9fafb'; x.fillRect(RX - 8, y + off, 8, 20); x.fillRect(RX + RW, y + off, 8, 20); }
      cars.forEach(o => RC.car(x, o.x, o.y, Math.PI / 2, 48, 22, o.col));
      if (boost > 0) { x.fillStyle = 'rgba(96,165,250,.55)'; x.fillRect(px - 6, PY + 24, 12, 40); }
      RC.car(x, px, PY, -Math.PI / 2, 48, 22, '#dc2626', { brake: k.d });
      RC.text(x, over + ' overtakes', 10, 22); RC.text(x, Math.round(speed * 28) + ' km/h', W - 10, 22, 14, '#fff', 'right');
      x.fillStyle = '#111827'; x.fillRect(10, H - 22, 120, 12); x.fillStyle = drs >= 100 ? '#4ade80' : '#60a5fa'; x.fillRect(10, H - 22, 1.2 * drs, 12);
      RC.text(x, drs >= 100 ? 'DRS READY – Space' : 'DRS (slipstream)', 136, H - 12, 12, drs >= 100 ? '#4ade80' : '#fff');
    }
    reset();
  } },

/* ===== DRAG STRIP ===== */
{ id: 'drag', title: 'Drag Strip', emoji: '🚦', cat: 'racing', colors: ['#111827', '#facc15'],
  help: 'Hold ↑ (or touch) the instant the light goes green – too early is a red-light foul. Space to shift up while the rev bar is in the green.',
  run(stage, api) {
    const W = 600, H = 300, VMAX = [17, 29, 45, 64, 88], LEN = 402; const { c, x } = api.canvas(W, H);
    const k = RC.keys(api, stage);
    let phase, lights, t, p, ai, et, msg, msgT;
    function reset() { phase = 'wait'; lights = 0; t = 0; p = { d: 0, v: 0, g: 0, rpm: 0, bonus: 0, done: 0 }; ai = { d: 0, v: 0, g: 0, rpm: 0, done: 0, react: 180 + rnd(220) }; et = 0; msg = ''; msgT = 0; api.overlay('<b>Drag Strip</b>Quarter mile, best of one.<br><small>any key to stage up</small>'); }
    function start() { phase = 'tree'; lights = 0; t = -700 - rnd(900); api.overlay(null); }
    function say(m, ms = 900) { msg = m; msgT = ms; }
    function shift() {
      if (phase !== 'race' || p.g >= 4 || p.done) return;
      const good = p.rpm > .82 && p.rpm < .98;
      const early = p.rpm <= .82;
      p.g++; p.rpm = p.v / VMAX[p.g];
      if (good) { p.bonus = 700; say('PERFECT SHIFT'); api.beep(900, .08); } else { say(early ? 'shifted too early' : 'bounced the limiter'); api.beep(300, .08); }
    }
    api.onKey(e => { if (phase === 'wait') start(); else if (phase === 'done') reset(); else if (e.key === ' ' || e.key === 'Shift') shift(); });
    api.onTap(() => { if (phase === 'wait') start(); else if (phase === 'done') reset(); else if (phase === 'race') shift(); });
    api.onRestart(reset);
    const gas = () => k.u || k.t;
    const torque = r => r > 1 ? 0 : .5 + .5 * Math.sin(Math.min(1, r) * Math.PI);
    api.loop(dt => {
      const s = dt / 1000;
      if (msgT > 0) { msgT -= dt; if (msgT <= 0) msg = ''; }
      if (phase === 'tree') {
        t += dt; lights = t < 0 ? 0 : Math.min(4, 1 + Math.floor(t / 500));
        if (gas() && lights < 4) { phase = 'done'; api.overlay('<b>RED LIGHT</b>Jumped the start – foul!<br><small>any key to retry</small>'); api.beep(150, .4); }
        else if (lights === 4) { phase = 'race'; et = 0; api.beep(700, .1); }
      } else if (phase === 'race') {
        et += dt;
        if (!p.done) {
          p.rpm = p.v / VMAX[p.g];
          const acc = gas() ? 21 * torque(p.rpm) / (1 + p.g * .32) * (p.bonus > 0 ? 1.25 : 1) : -2;
          p.v = Math.max(0, p.v + acc * s); p.d += p.v * s; if (p.bonus > 0) p.bonus -= dt;
          if (p.d >= LEN) { p.done = et; api.beep(1000, .1); }
        }
        if (!ai.done && et > ai.react) {
          ai.rpm = ai.v / VMAX[ai.g]; if (ai.rpm > .9 && ai.g < 4) { ai.g++; ai.rpm = ai.v / VMAX[ai.g]; }
          ai.v += 20.2 * torque(ai.rpm) / (1 + ai.g * .32) * s; ai.d += ai.v * s; if (ai.d >= LEN) ai.done = et;
        }
        if ((p.done && ai.done) || (p.done && et - p.done > 3000) || (ai.done && et - ai.done > 4000)) {
          phase = 'done'; const win = p.done && (!ai.done || p.done <= ai.done); const sc = p.done ? Math.max(0, Math.round((16 - p.done / 1000) * 100)) : 0; api.score(sc);
          api.overlay(`<b>${win ? '🏆 You win!' : 'Beaten…'}</b>You ${p.done ? RC.fmt(p.done) : '–'} · Rival ${ai.done ? RC.fmt(ai.done) : '–'}<br>${sc} pts<br><small>any key to race again</small>`);
        }
      }
      draw();
    });
    function draw() {
      x.fillStyle = '#0f172a'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#1f2937'; x.fillRect(0, 90, W, 180);
      x.fillStyle = '#fbbf24'; for (let i = 0; i < 13; i++) x.fillRect(i * 52 - (p.d * 3) % 52, 178, 26, 4);
      x.fillStyle = '#fff'; for (let y = 90; y < 270; y += 12) { x.fillRect(W - 40, y, 6, 6); x.fillRect(W - 34, y + 6, 6, 6); }
      const car = (o, y, col) => { const sx = 60 + Math.min(1, o.d / LEN) * (W - 140); if (phase === 'race' && !o.done && o.v > 5) { x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(sx - 70, y - 8, 40, 16); } RC.car(x, sx, y, 0, 64, 28, col); };
      car(ai, 135, '#3b82f6'); car(p, 225, '#ef4444');
      const off = ['#78350f', '#78350f', '#78350f', '#14532d'], on = ['#f59e0b', '#f59e0b', '#f59e0b', '#22c55e'];
      for (let i = 0; i < 4; i++) { x.fillStyle = (phase === 'tree' || phase === 'race') && lights > i ? on[i] : off[i]; x.beginPath(); x.arc(W / 2 - 60 + i * 40, 40, 14, 0, 7); x.fill(); }
      x.fillStyle = '#111'; x.fillRect(20, H - 24, 300, 14);
      x.fillStyle = '#166534'; x.fillRect(20 + 300 * .82, H - 24, 300 * .16, 14);
      x.fillStyle = p.rpm > .98 ? '#ef4444' : '#f8fafc'; x.fillRect(20, H - 24, 300 * Math.min(1, p.rpm), 14);
      RC.text(x, 'GEAR ' + (p.g + 1), 335, H - 12); RC.text(x, Math.round(p.v * 3.6) + ' km/h', 430, H - 12);
      if (phase === 'race' || (phase === 'done' && p.done)) RC.text(x, RC.fmt(p.done || et), W - 20, H - 12, 14, '#fde047', 'right');
      if (msg) RC.text(x, msg, W / 2, 76, 14, '#fde047', 'center');
      RC.text(x, 'YOU', 14, 232, 11, '#fca5a5'); RC.text(x, 'RIVAL', 14, 142, 11, '#93c5fd');
    }
    reset();
  } },

/* ===== PIT CREW ===== */
{ id: 'pitcrew', title: 'Pit Crew', emoji: '🔧', cat: 'racing', colors: ['#facc15', '#1f2937'],
  help: 'Space to brake into the box, then hit the arrow keys shown on each tyre as fast as you can, then Space to release. Under 8 seconds is quick.',
  run(stage, api) {
    const W = 600, H = 320, BOX = 300; const { c, x } = api.canvas(W, H);
    const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'], GLYPH = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
    const TYRE = [[-22, -16], [22, -16], [-22, 16], [22, 16]];
    let phase, cx, v, t, seq, ti, pen, flash, err, total, stopErr;
    function reset() { phase = 'wait'; cx = W + 60; v = 0; t = 0; seq = []; ti = 0; pen = 0; flash = 0; err = 0; total = 0; stopErr = 0; api.overlay('<b>Pit Crew</b>Stop in the box, four tyres, go.<br><small>any key to bring the car in</small>'); }
    function begin() { phase = 'arrive'; v = 7.5; t = 0; api.overlay(null); }
    function brake() { if (phase !== 'arrive') return; phase = 'stopping'; }
    function tyre(key) {
      if (phase !== 'tyres') return;
      if (key === seq[ti]) { ti++; api.beep(700 + ti * 60, .04); if (ti >= seq.length) { phase = 'go'; } }
      else { pen += 500; err++; flash = 250; api.beep(160, .15); }
    }
    function release() {
      if (phase !== 'go') { if (phase === 'tyres') { pen += 1000; flash = 300; api.beep(120, .3); } return; }
      phase = 'leave'; v = 0; total = t + pen; const sc = Math.max(0, Math.round((12000 - total) / 10)); api.score(sc);
      api.after(900, () => api.overlay(`<b>${RC.fmt(total)}</b>stop ${stopErr.toFixed(0)}px off · ${err} wrong keys${pen ? ` · +${RC.fmt(pen)} penalty` : ''}<br>${sc} pts<br><small>any key for another stop</small>`)); phase = 'done';
    }
    api.onKey(e => {
      if (phase === 'wait') begin(); else if (phase === 'done') reset();
      else if (e.key === ' ') { brake(); release(); }
      else if (ARROWS.includes(e.key)) tyre(e.key);
      else if (e.key === 'w' || e.key === 'W') tyre('ArrowUp'); else if (e.key === 's' || e.key === 'S') tyre('ArrowDown'); else if (e.key === 'a' || e.key === 'A') tyre('ArrowLeft'); else if (e.key === 'd' || e.key === 'D') tyre('ArrowRight');
    });
    api.onTap(e => {
      if (phase === 'wait') { begin(); return; } if (phase === 'done') { reset(); return; }
      const r = stage.getBoundingClientRect(); const fx = (e.clientX - r.left) / r.width * W, fy = (e.clientY - r.top) / r.height * H;
      if (phase === 'tyres' && fy > H - 70) { const i = Math.floor((fx - (W / 2 - 120)) / 60); if (i >= 0 && i < 4) tyre(ARROWS[i]); return; }
      brake(); release();
    });
    api.onRestart(reset);
    api.loop(dt => {
      const s = dt / 16.67;
      if (flash > 0) flash -= dt;
      if (phase === 'arrive') { cx -= v * s; if (cx < 40) { phase = 'stopping'; } }
      if (phase === 'stopping') { v = Math.max(0, v - .35 * s); cx -= v * s; if (v === 0) { stopErr = Math.abs(cx - BOX); pen += Math.round(Math.min(2000, stopErr * 20)); phase = 'tyres'; seq = Array.from({ length: 4 }, () => ARROWS[rnd(4)]); ti = 0; t = 0; } }
      if (phase === 'tyres' || phase === 'go') t += dt;
      if (phase === 'leave') { v = Math.min(9, v + .3 * s); cx += v * s; }
      draw();
    });
    function draw() {
      x.fillStyle = '#374151'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#4b5563'; x.fillRect(0, 60, W, 150);
      x.fillStyle = '#fde047'; x.fillRect(BOX - 60, 70, 4, 130); x.fillRect(BOX + 60, 70, 4, 130); x.fillRect(BOX - 60, 70, 124, 4); x.fillRect(BOX - 60, 196, 124, 4);
      x.fillStyle = 'rgba(253,224,71,.2)'; x.fillRect(BOX - 6, 70, 12, 130);
      x.fillStyle = '#1f2937'; x.fillRect(0, 210, W, 110);
      RC.car(x, cx, 135, Math.PI, 90, 44, '#ef4444');
      if (phase === 'tyres' || phase === 'go') {
        TYRE.forEach(([dx, dy], i) => {
          const done = i < ti; const px = cx - dx, py = 135 + dy;
          x.fillStyle = done ? '#22c55e' : i === ti ? (flash > 0 ? '#ef4444' : '#fde047') : '#111827'; x.beginPath(); x.arc(px, py, 10, 0, 7); x.fill();
          if (!done && i === ti) RC.text(x, GLYPH[seq[i]], px, py + 6, 16, '#111', 'center');
        });
        if (phase === 'go') RC.text(x, 'GO! press Space', cx, 60 - 8, 16, '#4ade80', 'center');
        else RC.text(x, 'press ' + GLYPH[seq[ti]], cx, 60 - 8, 16, '#fde047', 'center');
      }
      if (phase === 'arrive') RC.text(x, 'Space to brake!', BOX, 50, 16, '#fde047', 'center');
      if (phase === 'tyres') { ARROWS.forEach((a, i) => { x.fillStyle = '#111827'; RC.rr(x, W / 2 - 120 + i * 60 + 4, H - 64, 52, 52, 8); RC.text(x, GLYPH[a], W / 2 - 120 + i * 60 + 30, H - 28, 24, '#fff', 'center'); }); }
      RC.text(x, (phase === 'tyres' || phase === 'go') ? RC.fmt(t + pen) : phase === 'leave' || phase === 'done' ? RC.fmt(total) : '', W - 14, 30, 18, '#fde047', 'right');
      if (pen) RC.text(x, '+' + RC.fmt(pen) + ' penalty', W - 14, 50, 12, '#fca5a5', 'right');
      if (flash > 0) { x.fillStyle = 'rgba(239,68,68,.25)'; x.fillRect(0, 0, W, H); }
    }
    reset();
  } },

/* ===== SUNSET OUTRUN / NIGHT DRIVE (pseudo-3D road engine) ===== */
{ id: 'outrun', title: 'Sunset Outrun', emoji: '🌅', cat: 'racing', colors: ['#f97316', '#7c3aed'],
  help: '← → steer, ↑ gas, ↓ brake. Reach every checkpoint before the clock hits zero. Grass is slow, traffic hurts.',
  run(stage, api) { RC.road3d(stage, api, { title: 'Sunset Outrun', intro: 'any key to start · beat the clock', length: 1200, traffic: 14, time: 40, cpEvery: 2200, cpBonus: 20, sky: ['#7c3aed', '#f97316', '#fde68a'], sun: '#fff7ae', hillsCol: '#6d28d9', grass: ['#16a34a', '#15803d'], rumble: ['#fff', '#ef4444'], road: ['#6b7280', '#64748b'], lane: '#fff', tree: ['#14532d', '#166534'] }); } },
{ id: 'night', title: 'Night Drive', emoji: '🌙', cat: 'racing', colors: ['#0f172a', '#facc15'],
  help: '← → steer, ↑ gas, ↓ brake. Heavy traffic, fog, and only your headlights to see by. Three crashes and you\'re out.',
  run(stage, api) { RC.road3d(stage, api, { title: 'Night Drive', intro: 'any key to start · follow the tail-lights', length: 1400, traffic: 26, lives: 3, sky: ['#020617', '#0f172a', '#1e293b'], stars: true, hillsCol: '#0b1120', grass: ['#052e16', '#03240f'], rumble: ['#9ca3af', '#7f1d1d'], road: ['#1f2937', '#111827'], lane: '#e5e7eb', fog: '5,8,20', night: true, tree: ['#052e16', '#022c22'] }); } },

/* ===== TUNNEL RACER ===== */
{ id: 'tunnel', title: 'Tunnel Racer', emoji: '🕳️', cat: 'racing', colors: ['#0f172a', '#22d3ee'],
  help: '← → to slide around the tunnel wall. Steer into the gaps – it only gets faster.',
  run(stage, api) {
    const W = 480, H = 360, CX = W / 2, CY = H / 2 - 20, R = 190; const { c, x } = api.canvas(W, H);
    const k = RC.keys(api, stage);
    let th, rings, obs, z, speed, dist, alive, started, spawnZ, flash;
    function reset() { th = 0; z = 0; speed = 3; dist = 0; alive = true; started = false; obs = []; spawnZ = 40; flash = 0; api.score(0); api.overlay('<b>Tunnel Racer</b><small>any key to start</small>'); }
    function begin() { if (!alive) reset(); else if (!started) { started = true; api.overlay(null); } }
    api.onKey(begin); api.onTap(begin); api.onRestart(reset);
    const rad = d => R * 6 / (d + 6);  /* screen radius for depth d (0 = at the player) */
    api.loop(dt => {
      const s = dt / 16.67;
      if (started && alive) {
        th += (k.r - k.l) * .07 * s;
        z += speed * s * .1; dist += speed * s * .5; speed = 3 + dist / 900;
        while (spawnZ < z + 60) {
          const gap = Math.max(.9, 2.2 - dist / 2500), n = 1 + (dist > 800 ? rnd(2) : 0);
          const g0 = Math.random() * Math.PI * 2;
          obs.push({ z: spawnZ, a: g0 + gap / 2, span: Math.PI * 2 - gap, col: ['#f43f5e', '#a855f7', '#f59e0b'][rnd(3)] });
          spawnZ += 14 + rnd(12) - Math.min(6, dist / 1000);
        }
        for (const o of obs) {
          const d = o.z - z;
          if (!o.hit && d < .6 && d > -.6) { let rel = RC.ang(th - o.a); if (rel < 0) rel += Math.PI * 2; if (rel < o.span) { alive = false; flash = 1; api.beep(100, .5); api.overlay(`<b>Wall!</b>${Math.floor(dist)} m<br><small>any key to retry</small>`); } else if (d < 0) { o.hit = true; } }
        }
        obs = obs.filter(o => o.z - z > -3);
        api.score(Math.floor(dist));
      }
      draw();
    });
    function draw() {
      x.fillStyle = '#020617'; x.fillRect(0, 0, W, H);
      /* rings, far to near */
      for (let d = 60; d >= 0; d -= 2) {
        const r = rad(d), zz = z + d, band = Math.floor(zz / 4) % 2;
        x.strokeStyle = band ? `rgba(34,211,238,${.15 + .5 * (1 - d / 60)})` : `rgba(99,102,241,${.1 + .35 * (1 - d / 60)})`; x.lineWidth = band ? 2 : 1;
        x.beginPath(); x.arc(CX, CY, r, 0, 7); x.stroke();
      }
      const sorted = obs.slice().sort((a, b) => (b.z - z) - (a.z - z));
      for (const o of sorted) {
        const d = o.z - z; if (d > 60 || d < -.5) continue;
        const r0 = rad(d), r1 = rad(d + 2.5);
        x.strokeStyle = o.col; x.lineWidth = Math.max(2, r0 - r1); x.globalAlpha = Math.min(1, .25 + (1 - d / 60));
        x.beginPath(); x.arc(CX, CY, (r0 + r1) / 2, o.a - th + Math.PI / 2, o.a - th + Math.PI / 2 + o.span); x.stroke(); x.globalAlpha = 1;
      }
      /* player: fixed at the bottom of the ring */
      const py = CY + R * .97;
      x.save(); x.translate(CX, py); x.fillStyle = '#22d3ee'; x.beginPath(); x.moveTo(0, -18); x.lineTo(14, 8); x.lineTo(0, 2); x.lineTo(-14, 8); x.closePath(); x.fill();
      x.fillStyle = '#fef08a'; x.fillRect(-3, -6, 6, 6); x.restore();
      x.fillStyle = `rgba(34,211,238,${.2 + Math.random() * .2})`; x.fillRect(CX - 6, py + 8, 12, 10 + speed * 2);
      RC.text(x, Math.floor(dist) + ' m', 10, 22); RC.text(x, Math.round(speed * 60) + ' km/h', W - 10, 22, 14, '#fff', 'right');
      if (flash > 0) { x.fillStyle = 'rgba(244,63,94,.35)'; x.fillRect(0, 0, W, H); flash -= .05; }
    }
    reset();
  } },

/* ===== GRAND PRIX / TURBO KART (top-down circuit engine) ===== */
{ id: 'gp', title: 'Grand Prix', emoji: '🏁', cat: 'racing', colors: ['#dc2626', '#f8fafc'],
  help: '↑ gas, ↓ brake, ← → steer. Three laps against three rivals. Stay on the tarmac – grass is slow.',
  run(stage, api) { RC.circuit(stage, api, { title: 'Grand Prix', laps: 3, width: 24, ai: 3, aiTop: 4.1, top: 4.6, points: [[80, 80], [300, 55], [520, 85], [545, 200], [470, 265], [530, 345], [380, 375], [200, 355], [75, 330], [55, 200]], grass: '#15803d', tarmac: '#4b5563' }); } },
{ id: 'kart', title: 'Turbo Kart', emoji: '🛞', cat: 'racing', colors: ['#f59e0b', '#22c55e'],
  help: '↑ gas, ← → steer. Drive over ⚡ pads for a boost, grab ? boxes for a rocket or a banana, Space to use it.',
  run(stage, api) { RC.circuit(stage, api, { title: 'Turbo Kart', laps: 3, width: 26, ai: 3, aiTop: 3.6, top: 3.9, items: true, points: [[70, 70], [250, 50], [330, 130], [470, 60], [550, 130], [520, 235], [400, 215], [330, 300], [450, 380], [250, 392], [120, 340], [58, 220]], grass: '#65a30d', tarmac: '#57534e' }); } },

/* ===== DRIFT KING ===== */
{ id: 'drift', title: 'Drift King', emoji: '💨', cat: 'racing', colors: ['#7c3aed', '#f472b6'],
  help: '↑ gas, ← → steer, hold Space to pull the handbrake. Slide sideways to score – keep the chain going, don\'t hit cones. 60 seconds.',
  run(stage, api) {
    const W = 600, H = 420; const { c, x } = api.canvas(W, H);
    const k = RC.keys(api, stage);
    let car, cones, score, chain, mult, time, alive, started, smoke, msg, msgT;
    function reset() { car = { x: 120, y: H / 2, a: 0, vx: 0, vy: 0 }; cones = []; for (let i = 0; i < 9; i++) cones.push({ x: 150 + (i % 3) * 150 + rnd(40), y: 90 + Math.floor(i / 3) * 120 + rnd(40) }); score = 0; chain = 0; mult = 1; time = 60; alive = true; started = false; smoke = []; msg = ''; msgT = 0; api.score(0); api.overlay('<b>Drift King</b><small>any key to start · 60s</small>'); }
    function begin() { if (!alive) reset(); else if (!started) { started = true; api.overlay(null); } }
    api.onKey(begin); api.onTap(begin); api.onRestart(reset);
    api.loop(dt => {
      const s = dt / 16.67;
      if (started && alive) {
        time -= dt / 1000; if (time <= 0) { time = 0; alive = false; api.overlay(`<b>Time!</b>${score} drift points<br><small>any key to go again</small>`); }
        const sp = Math.hypot(car.vx, car.vy);
        if (k.u || k.t) { car.vx += Math.cos(car.a) * .18 * s; car.vy += Math.sin(car.a) * .18 * s; }
        if (k.d) { car.vx *= 1 - .04 * s; car.vy *= 1 - .04 * s; }
        car.a += (k.r - k.l) * .065 * s * Math.min(1, sp / 2.5);
        /* grip: split velocity into forward / sideways */
        const fx = Math.cos(car.a), fy = Math.sin(car.a);
        let fwd = car.vx * fx + car.vy * fy, side = -car.vx * fy + car.vy * fx;
        const grip = k.sp ? .012 : .07; side *= 1 - grip * s; fwd *= 1 - .01 * s; if (k.sp) fwd *= 1 - .01 * s;
        car.vx = fwd * fx - side * fy; car.vy = fwd * fy + side * fx;
        car.x += car.vx * s; car.y += car.vy * s;
        if (car.x < 30 || car.x > W - 30) { car.vx *= -.5; car.x = clamp(car.x, 30, W - 30); chain = 0; mult = 1; }
        if (car.y < 30 || car.y > H - 30) { car.vy *= -.5; car.y = clamp(car.y, 30, H - 30); chain = 0; mult = 1; }
        const va = Math.atan2(car.vy, car.vx), slip = Math.abs(RC.ang(va - car.a));
        if (sp > 2 && slip > .35 && slip < 2.2) {
          chain += Math.round(slip * sp * s); mult = 1 + Math.floor(chain / 400);
          if (Math.random() < .5) smoke.push({ x: car.x - fx * 12, y: car.y - fy * 12, r: 4, life: 1 });
        } else if (chain > 0) { score += chain * mult; if (chain > 150) { msg = `+${chain * mult}  (x${mult})`; msgT = 1200; api.beep(700, .06); } chain = 0; mult = 1; }
        for (const cn of cones) if (!cn.hit && Math.hypot(cn.x - car.x, cn.y - car.y) < 18) { cn.hit = true; cn.vx = car.vx; cn.vy = car.vy; chain = 0; mult = 1; msg = 'CONE! chain lost'; msgT = 1000; api.beep(200, .1); api.after(3000, () => { cn.hit = false; cn.x = 100 + rnd(400); cn.y = 60 + rnd(300); }); }
        cones.forEach(cn => { if (cn.hit) { cn.x += cn.vx * s; cn.y += cn.vy * s; cn.vx *= .95; cn.vy *= .95; } });
        smoke.forEach(p => { p.life -= .025 * s; p.r += .4 * s; }); smoke = smoke.filter(p => p.life > 0);
        if (msgT > 0) msgT -= dt;
        api.score(score + chain * mult);
      }
      draw();
    });
    function draw() {
      x.fillStyle = '#3f3f46'; x.fillRect(0, 0, W, H);
      x.strokeStyle = '#52525b'; x.lineWidth = 1; for (let i = 0; i < W; i += 40) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); } for (let j = 0; j < H; j += 40) { x.beginPath(); x.moveTo(0, j); x.lineTo(W, j); x.stroke(); }
      x.strokeStyle = '#fbbf24'; x.lineWidth = 4; x.strokeRect(12, 12, W - 24, H - 24);
      smoke.forEach(p => { x.fillStyle = `rgba(226,232,240,${p.life * .5})`; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7); x.fill(); });
      cones.forEach(cn => { x.fillStyle = cn.hit ? '#9a3412' : '#f97316'; x.beginPath(); x.moveTo(cn.x, cn.y - 9); x.lineTo(cn.x + 7, cn.y + 7); x.lineTo(cn.x - 7, cn.y + 7); x.fill(); x.fillStyle = '#fff'; x.fillRect(cn.x - 3, cn.y, 6, 2); });
      RC.car(x, car.x, car.y, car.a, 34, 18, '#a855f7', { brake: k.d || k.sp });
      RC.text(x, score + ' pts', 20, 32, 16); RC.text(x, chain > 0 ? `chain ${chain} x${mult}` : '', 20, 52, 14, '#f472b6');
      RC.text(x, Math.ceil(time) + 's', W - 20, 34, 20, time < 10 ? '#f87171' : '#fff', 'right');
      if (msgT > 0) RC.text(x, msg, W / 2, 60, 18, '#fde047', 'center');
    }
    reset();
  } },

/* ===== DEMOLITION DERBY ===== */
{ id: 'derby', title: 'Demolition Derby', emoji: '💥', cat: 'racing', colors: ['#b91c1c', '#facc15'],
  help: '↑ gas, ↓ reverse, ← → steer. Ram the others with your nose – getting hit costs you. Last car running wins.',
  run(stage, api) {
    const W = 600, H = 420; const { c, x } = api.canvas(W, H);
    const k = RC.keys(api, stage);
    let cars, me, alive, started, time, kills, done, sparks;
    function reset() {
      cars = []; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; cars.push({ x: W / 2 + Math.cos(a) * 150, y: H / 2 + Math.sin(a) * 110, a: a + Math.PI, vx: 0, vy: 0, hp: 100, col: i ? RC.PALETTE[i] : '#ef4444', ai: i > 0, think: 0, rev: 0 }); }
      me = cars[0]; alive = true; started = false; time = 0; kills = 0; done = false; sparks = []; api.score(0); api.overlay('<b>Demolition Derby</b><small>any key to start</small>');
    }
    function begin() { if (done) reset(); else if (!started) { started = true; api.overlay(null); } }
    api.onKey(begin); api.onTap(begin); api.onRestart(reset);
    function drive(cr, gas, brake, steer, s) {
      const sp = Math.hypot(cr.vx, cr.vy);
      if (gas) { cr.vx += Math.cos(cr.a) * .16 * s; cr.vy += Math.sin(cr.a) * .16 * s; }
      if (brake) { cr.vx -= Math.cos(cr.a) * .1 * s; cr.vy -= Math.sin(cr.a) * .1 * s; }
      const fwdSign = (cr.vx * Math.cos(cr.a) + cr.vy * Math.sin(cr.a)) < 0 ? -1 : 1;
      cr.a += steer * .06 * s * Math.min(1, sp / 2) * fwdSign;
      const fx = Math.cos(cr.a), fy = Math.sin(cr.a); let fwd = cr.vx * fx + cr.vy * fy, side = -cr.vx * fy + cr.vy * fx;
      side *= 1 - .12 * s; fwd *= 1 - .015 * s; if (Math.abs(fwd) > 4.5) fwd *= .98;
      cr.vx = fwd * fx - side * fy; cr.vy = fwd * fy + side * fx;
      cr.x += cr.vx * s; cr.y += cr.vy * s;
      if (cr.x < 30) { cr.x = 30; cr.vx = Math.abs(cr.vx) * .4; } if (cr.x > W - 30) { cr.x = W - 30; cr.vx = -Math.abs(cr.vx) * .4; }
      if (cr.y < 30) { cr.y = 30; cr.vy = Math.abs(cr.vy) * .4; } if (cr.y > H - 30) { cr.y = H - 30; cr.vy = -Math.abs(cr.vy) * .4; }
    }
    api.loop(dt => {
      const s = dt / 16.67;
      if (started && !done) {
        time += dt / 1000;
        cars.forEach(cr => {
          if (cr.hp <= 0) { cr.vx *= .9; cr.vy *= .9; cr.x += cr.vx * s; cr.y += cr.vy * s; return; }
          if (!cr.ai) drive(cr, k.u || k.t, k.d, k.r - k.l, s);
          else {
            cr.think -= dt;
            if (cr.think <= 0) { cr.think = 400 + rnd(600); const live = cars.filter(o => o !== cr && o.hp > 0); cr.target = live.length ? live[Math.random() < .6 && me.hp > 0 ? 0 : rnd(live.length)] : null; cr.rev = Math.random() < .15 ? 700 : 0; }
            if (cr.target) {
              const want = Math.atan2(cr.target.y - cr.y, cr.target.x - cr.x), d = RC.ang(want - cr.a);
              if (cr.rev > 0) { cr.rev -= dt; drive(cr, false, true, -Math.sign(d), s); }
              else drive(cr, Math.abs(d) < 1.2, false, clamp(d * 2, -1, 1), s);
            }
          }
        });
        /* collisions */
        for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
          const a = cars[i], b = cars[j]; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d > 26 || d === 0) continue;
          const nx = dx / d, ny = dy / d, ov = 26 - d; a.x -= nx * ov / 2; a.y -= ny * ov / 2; b.x += nx * ov / 2; b.y += ny * ov / 2;
          const rvx = a.vx - b.vx, rvy = a.vy - b.vy, rel = rvx * nx + rvy * ny; if (rel <= 0) continue;
          a.vx -= rel * nx * .9; a.vy -= rel * ny * .9; b.vx += rel * nx * .9; b.vy += rel * ny * .9;
          const aNose = Math.cos(a.a) * nx + Math.sin(a.a) * ny, bNose = -(Math.cos(b.a) * nx + Math.sin(b.a) * ny);
          const dmgA = rel * (aNose > .6 ? 1.5 : 5), dmgB = rel * (bNose > .6 ? 1.5 : 5);
          const kill = (v, killer) => { if (v.hp > 0 && v.hp - 0 <= 0) {} };
          if (a.hp > 0 && b.hp > 0) { a.hp -= dmgA; b.hp -= dmgB; if (a.hp <= 0 && b === me) kills++; if (b.hp <= 0 && a === me) kills++; if (a.hp <= 0 || b.hp <= 0) api.beep(150, .3); }
          if (rel > 1.5) { api.beep(300 + rnd(200), .04); for (let q = 0; q < 6; q++) sparks.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, vx: (Math.random() - .5) * 6, vy: (Math.random() - .5) * 6, life: 1 }); }
        }
        sparks.forEach(p => { p.x += p.vx * s; p.y += p.vy * s; p.life -= .06 * s; }); sparks = sparks.filter(p => p.life > 0);
        const others = cars.filter(cr => cr.ai && cr.hp > 0).length;
        const sc = kills * 100 + Math.floor(time) * 5;
        if (me.hp <= 0) { done = true; api.score(sc); api.overlay(`<b>Wrecked</b>${kills} wrecks · survived ${Math.floor(time)}s<br>${sc} pts<br><small>any key to retry</small>`); }
        else if (others === 0) { done = true; api.score(sc + 500); api.overlay(`<b>🏆 Last one standing!</b>${kills} wrecks in ${Math.floor(time)}s<br>${sc + 500} pts<br><small>any key to play again</small>`); }
        api.score(sc);
      }
      draw();
    });
    function draw() {
      x.fillStyle = '#92400e'; x.fillRect(0, 0, W, H); x.fillStyle = '#a16207'; for (let i = 0; i < 30; i++) x.fillRect((i * 173) % W, (i * 97) % H, 30, 4);
      x.strokeStyle = '#374151'; x.lineWidth = 10; x.strokeRect(12, 12, W - 24, H - 24); x.strokeStyle = '#fde047'; x.lineWidth = 2; x.strokeRect(12, 12, W - 24, H - 24);
      cars.forEach(cr => { RC.car(x, cr.x, cr.y, cr.a, 34, 18, cr.col, { wreck: cr.hp <= 0 }); if (cr.hp > 0) { x.fillStyle = '#111'; x.fillRect(cr.x - 16, cr.y - 22, 32, 5); x.fillStyle = cr === me ? '#4ade80' : '#f87171'; x.fillRect(cr.x - 16, cr.y - 22, 32 * Math.max(0, cr.hp) / 100, 5); } else { x.fillStyle = 'rgba(30,30,30,.6)'; x.beginPath(); x.arc(cr.x + Math.sin(performance.now() / 300) * 3, cr.y - 14, 8, 0, 7); x.fill(); } });
      sparks.forEach(p => { x.fillStyle = `rgba(253,224,71,${p.life})`; x.fillRect(p.x, p.y, 3, 3); });
      RC.text(x, `${kills} wrecks`, 24, 36, 16); RC.text(x, `${cars.filter(cr => cr.hp > 0).length} running`, W - 24, 36, 16, '#fff', 'right');
      RC.text(x, 'YOU ▲', me.x, me.y - 28, 11, '#4ade80', 'center');
    }
    reset();
  } },

/* ===== POLICE PURSUIT ===== */
{ id: 'pursuit', title: 'Police Pursuit', emoji: '🚓', cat: 'racing', colors: ['#1d4ed8', '#ef4444'],
  help: '↑ gas, ← → steer, ↓ brake. Cops keep coming. Lead them into the rocks to wreck them, and don\'t get rammed.',
  run(stage, api) {
    const W = 600, H = 420, CELL = 220; const { c, x } = api.canvas(W, H);
    const k = RC.keys(api, stage);
    let me, cops, hp, time, wrecks, alive, started, spawn, cam, msg, msgT;
    const hash = (i, j) => { let h = (i * 374761393 + j * 668265263) ^ (i * j * 1274126177); h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; };
    function rocks(i, j) { const r = hash(i, j); if (Math.abs(i) < 2 && Math.abs(j) < 2) return null; if (r < .4) return null; const r2 = hash(j, i); return { x: i * CELL + 40 + r2 * (CELL - 80), y: j * CELL + 40 + hash(i + 7, j - 3) * (CELL - 80), r: 22 + r2 * 22, kind: r > .8 ? 1 : 0 }; }
    function reset() { me = { x: 0, y: 0, a: 0, vx: 0, vy: 0 }; cops = []; hp = 100; time = 0; wrecks = 0; alive = true; started = false; spawn = 1500; cam = { x: 0, y: 0 }; msg = ''; msgT = 0; api.score(0); api.overlay('<b>Police Pursuit</b><small>any key to start</small>'); }
    function begin() { if (!alive) reset(); else if (!started) { started = true; api.overlay(null); } }
    api.onKey(begin); api.onTap(begin); api.onRestart(reset);
    function drive(cr, gas, brake, steer, top, s) {
      const sp = Math.hypot(cr.vx, cr.vy);
      if (gas && sp < top) { cr.vx += Math.cos(cr.a) * .16 * s; cr.vy += Math.sin(cr.a) * .16 * s; }
      if (brake) { cr.vx *= 1 - .05 * s; cr.vy *= 1 - .05 * s; }
      cr.a += steer * .06 * s * Math.min(1, sp / 2.5);
      const fx = Math.cos(cr.a), fy = Math.sin(cr.a); let fwd = cr.vx * fx + cr.vy * fy, side = -cr.vx * fy + cr.vy * fx;
      side *= 1 - .1 * s; fwd *= 1 - .012 * s; cr.vx = fwd * fx - side * fy; cr.vy = fwd * fy + side * fx;
      cr.x += cr.vx * s; cr.y += cr.vy * s;
    }
    function nearRocks(px, py) { const out = []; const ci = Math.floor(px / CELL), cj = Math.floor(py / CELL); for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) { const r = rocks(i, j); if (r) out.push(r); } return out; }
    api.loop(dt => {
      const s = dt / 16.67;
      if (started && alive) {
        time += dt / 1000; spawn -= dt;
        drive(me, k.u || k.t, k.d, k.r - k.l, 6.5, s);
        for (const r of nearRocks(me.x, me.y)) { const d = Math.hypot(r.x - me.x, r.y - me.y); if (d < r.r + 12) { const nx = (me.x - r.x) / d, ny = (me.y - r.y) / d; me.x = r.x + nx * (r.r + 12); me.y = r.y + ny * (r.r + 12); const sp = Math.hypot(me.vx, me.vy); me.vx = nx * sp * .4; me.vy = ny * sp * .4; if (sp > 2) { hp -= 12; api.beep(150, .15); msg = 'OUCH'; msgT = 600; } } }
        if (spawn <= 0 && cops.filter(cp => !cp.dead).length < 3 + Math.floor(time / 30)) { spawn = 4000; const a = Math.random() * Math.PI * 2; cops.push({ x: me.x + Math.cos(a) * 420, y: me.y + Math.sin(a) * 420, a: a + Math.PI, vx: 0, vy: 0, dead: 0, skill: .8 + Math.random() * .4 }); }
        cops.forEach(cp => {
          if (cp.dead) { cp.dead -= dt; return; }
          const want = Math.atan2(me.y - cp.y, me.x - cp.x), d = RC.ang(want - cp.a);
          drive(cp, Math.abs(d) < 1.5, false, clamp(d * 2.5, -1, 1), 5.6 * cp.skill, s);
          for (const r of nearRocks(cp.x, cp.y)) if (Math.hypot(r.x - cp.x, r.y - cp.y) < r.r + 10) { cp.dead = 2500; wrecks++; api.beep(400, .1); msg = 'COP WRECKED +100'; msgT = 900; cp.vx = cp.vy = 0; }
          if (!cp.dead) { const dd = Math.hypot(cp.x - me.x, cp.y - me.y); if (dd < 26) { const nx = (me.x - cp.x) / dd, ny = (me.y - cp.y) / dd; const rel = (cp.vx - me.vx) * nx + (cp.vy - me.vy) * ny; me.vx += nx * 3; me.vy += ny * 3; cp.vx -= nx * 2; cp.vy -= ny * 2; if (rel > 1) { hp -= 6 + rel * 3; api.beep(120, .2); msg = 'RAMMED'; msgT = 600; } } }
        });
        cops = cops.filter(cp => !(cp.dead && cp.dead <= 0));
        if (hp <= 0) { hp = 0; alive = false; const sc = Math.floor(time) * 10 + wrecks * 100; api.score(sc); api.overlay(`<b>Busted</b>${Math.floor(time)}s · ${wrecks} cops wrecked<br>${sc} pts<br><small>any key to retry</small>`); }
        api.score(Math.floor(time) * 10 + wrecks * 100);
        if (msgT > 0) msgT -= dt;
      }
      cam.x += (me.x - cam.x) * .1; cam.y += (me.y - cam.y) * .1;
      draw();
    });
    function draw() {
      x.fillStyle = '#b45309'; x.fillRect(0, 0, W, H);
      const ox = W / 2 - cam.x, oy = H / 2 - cam.y;
      x.fillStyle = '#d97706'; for (let i = Math.floor((cam.x - W / 2) / 60) * 60; i < cam.x + W / 2; i += 60) for (let j = Math.floor((cam.y - H / 2) / 60) * 60; j < cam.y + H / 2; j += 60) if (((i / 60 + j / 60) % 3 + 3) % 3 === 0) x.fillRect(i + ox, j + oy, 6, 6);
      const ci = Math.floor(cam.x / CELL), cj = Math.floor(cam.y / CELL);
      for (let i = ci - 2; i <= ci + 2; i++) for (let j = cj - 2; j <= cj + 2; j++) { const r = rocks(i, j); if (!r) continue; const sx = r.x + ox, sy = r.y + oy; if (r.kind) { x.fillStyle = '#14532d'; x.beginPath(); x.arc(sx, sy, r.r, 0, 7); x.fill(); x.fillStyle = '#166534'; x.beginPath(); x.arc(sx - r.r * .3, sy - r.r * .3, r.r * .5, 0, 7); x.fill(); } else { x.fillStyle = '#57534e'; x.beginPath(); x.arc(sx, sy, r.r, 0, 7); x.fill(); x.fillStyle = '#78716c'; x.beginPath(); x.arc(sx - r.r * .25, sy - r.r * .25, r.r * .55, 0, 7); x.fill(); } }
      cops.forEach(cp => RC.car(x, cp.x + ox, cp.y + oy, cp.a, 34, 18, '#f8fafc', { siren: !cp.dead, wreck: !!cp.dead }));
      RC.car(x, me.x + ox, me.y + oy, me.a, 34, 18, '#ef4444', { brake: k.d });
      x.fillStyle = '#111'; x.fillRect(20, 20, 160, 14); x.fillStyle = hp > 30 ? '#4ade80' : '#f87171'; x.fillRect(20, 20, 1.6 * hp, 14);
      RC.text(x, Math.floor(time) + 's · ' + wrecks + ' wrecked', W - 20, 32, 16, '#fff', 'right');
      if (msgT > 0) RC.text(x, msg, W / 2, 70, 18, '#fde047', 'center');
    }
    reset();
  } },

/* ===== SLOT CARS ===== */
{ id: 'slot', title: 'Slot Cars', emoji: '🎚️', cat: 'racing', colors: ['#0f766e', '#fb923c'],
  help: 'One button: hold Space / ↑ / touch to go. Too fast in a bend and you fly off the track. Most laps in 60 seconds wins.',
  run(stage, api) {
    const W = 600, H = 400; const { c, x } = api.canvas(W, H);
    const k = RC.keys(api, stage);
    const path = RC.spline([[90, 200], [190, 70], [300, 200], [420, 330], [520, 200], [420, 70], [300, 200], [190, 330]], 16);
    const N = path.length, LIMIT = .34;
    const lanePt = (i, off) => { const p = path[((i % N) + N) % N]; return { x: p.x - Math.sin(p.a) * off, y: p.y + Math.cos(p.a) * off, a: p.a }; };
    let me, ai, time, alive, started;
    function mk(off, col) { return { i: 0, f: 0, v: 0, off, col, laps: 0, fly: 0, fx: 0, fy: 0, fa: 0 }; }
    function reset() { me = mk(-9, '#fb923c'); ai = mk(9, '#38bdf8'); time = 60; alive = true; started = false; api.score(0); api.overlay('<b>Slot Cars</b><small>hold Space to go · 60s</small>'); }
    function begin() { if (!alive) reset(); else if (!started) { started = true; api.overlay(null); } }
    api.onKey(begin); api.onTap(begin); api.onRestart(reset);
    function step(cr, gas, s) {
      if (cr.fly > 0) { cr.fly -= 16.67 * s; cr.fx += Math.cos(cr.fa) * 3 * s; cr.fy += Math.sin(cr.fa) * 3 * s; cr.spin += .3 * s; if (cr.fly <= 0) cr.v = 0; return; }
      if (gas) cr.v = Math.min(7, cr.v + .14 * s); else cr.v *= Math.pow(.94, s);
      let kk = 0; for (let j = 0; j < 30; j += 3) kk = Math.max(kk, path[((cr.i + j) % N + N) % N].k);
      if (cr.v * cr.v * kk > LIMIT) { const p = lanePt(cr.i, cr.off); cr.fly = 1300; cr.fx = p.x; cr.fy = p.y; cr.fa = p.a + (path[cr.i].k > 0 ? 0 : 0); cr.spin = 0; api.beep(200, .2); return; }
      cr.f += cr.v * s; while (cr.f >= path[cr.i].len) { cr.f -= path[cr.i].len; cr.i++; if (cr.i >= N) { cr.i = 0; cr.laps++; if (cr === me) api.beep(900, .08); } }
    }
    api.loop(dt => {
      const s = dt / 16.67;
      if (started && alive) {
        time -= dt / 1000;
        step(me, k.sp || k.u || k.t, s);
        let ahead = 0; for (let j = 0; j < 60; j += 3) ahead = Math.max(ahead, path[(ai.i + j) % N].k);
        step(ai, ai.v * ai.v * ahead < LIMIT * .8, s);
        api.score(me.laps * 100 + Math.floor(me.i / N * 100));
        if (time <= 0) { time = 0; alive = false; const win = me.laps + me.i / N > ai.laps + ai.i / N; api.overlay(`<b>${win ? '🏆 You win!' : 'Second place'}</b>${me.laps} laps vs ${ai.laps}<br><small>any key to race again</small>`); }
      }
      draw();
    });
    function draw() {
      x.fillStyle = '#134e4a'; x.fillRect(0, 0, W, H);
      x.lineCap = 'round'; x.lineJoin = 'round';
      x.strokeStyle = '#1f2937'; x.lineWidth = 46; x.beginPath(); path.forEach((p, i) => i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y)); x.closePath(); x.stroke();
      for (const off of [-9, 9]) { x.strokeStyle = '#0f172a'; x.lineWidth = 3; x.beginPath(); for (let i = 0; i <= N; i++) { const p = lanePt(i, off); i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y); } x.stroke(); }
      const st = path[0]; x.fillStyle = '#fff'; x.save(); x.translate(st.x, st.y); x.rotate(st.a); for (let i = 0; i < 6; i++) x.fillRect(-4, -23 + i * 8, 4, 4); for (let i = 0; i < 6; i++) x.fillRect(0, -19 + i * 8, 4, 4); x.restore();
      for (const cr of [ai, me]) {
        if (cr.fly > 0) { RC.car(x, cr.fx, cr.fy, cr.fa + cr.spin, 22, 12, cr.col); continue; }
        const p = lanePt(cr.i, cr.off), q = lanePt(cr.i + 1, cr.off), f = cr.f / path[cr.i].len;
        RC.car(x, RC.lerp(p.x, q.x, f), RC.lerp(p.y, q.y, f), p.a, 22, 12, cr.col);
      }
      RC.text(x, `YOU ${me.laps} laps`, 16, 28, 16, '#fb923c'); RC.text(x, `RIVAL ${ai.laps} laps`, 16, 48, 14, '#38bdf8');
      RC.text(x, Math.ceil(time) + 's', W - 16, 30, 20, time < 10 ? '#f87171' : '#fff', 'right');
      x.fillStyle = '#111'; x.fillRect(W - 116, 42, 100, 8); x.fillStyle = me.fly > 0 ? '#f87171' : '#4ade80'; x.fillRect(W - 116, 42, 100 * me.v / 7, 8);
    }
    reset();
  } },

/* ===== HILL CLIMB / MONSTER JAM (side-view terrain engine) ===== */
{ id: 'hill', title: 'Hill Climb', emoji: '⛰️', cat: 'racing', colors: ['#84cc16', '#3b82f6'],
  help: '↑ gas, ↓ brake/reverse. In the air, ↑ tips the nose up and ↓ down – land on your wheels. Grab fuel cans or you\'ll stall.',
  run(stage, api) { RC.hills(stage, api, { title: 'Hill Climb', fuel: true, mode: 'hill', car: '#ef4444', sky: ['#7dd3fc', '#e0f2fe'], ground: '#78350f', grassTop: '#65a30d' }); } },
{ id: 'monster', title: 'Monster Jam', emoji: '🚚', cat: 'racing', colors: ['#7c2d12', '#facc15'],
  help: '↑ gas, ↓ brake. Hit the ramps, crush the cars for points, flip in the air for bonus – but land on your wheels. 60 seconds.',
  run(stage, api) { RC.hills(stage, api, { title: 'Monster Jam', mode: 'monster', timer: 60, car: '#7c3aed', big: true, sky: ['#1e1b4b', '#4c1d95'], ground: '#57534e', grassTop: '#a8a29e' }); } },

/* ===== WHEELIE RIDER ===== */
{ id: 'wheelie', title: 'Wheelie Rider', emoji: '🏍️', cat: 'racing', colors: ['#0ea5e9', '#fbbf24'],
  help: 'Hold ↑ / Space / touch to lift the front wheel, let go to drop it. Keep the wheelie balanced over the rocks – loop it and you crash.',
  run(stage, api) {
    const W = 600, H = 300, G = 236, BX = 150; const { c, x } = api.canvas(W, H);
    const k = RC.keys(api, stage);
    let a, w, dist, speed, rocks, alive, started, wheelieM, best, spawn, msg, msgT;
    function reset() { a = 0; w = 0; dist = 0; speed = 5; rocks = []; alive = true; started = false; wheelieM = 0; best = 0; spawn = 600; msg = ''; msgT = 0; api.score(0); api.overlay('<b>Wheelie Rider</b><small>hold ↑ to lift · any key to start</small>'); }
    function begin() { if (!alive) reset(); else if (!started) { started = true; api.overlay(null); } }
    api.onKey(begin); api.onTap(begin); api.onRestart(reset);
    api.loop(dt => {
      const s = dt / 16.67;
      if (started && alive) {
        const lift = k.u || k.sp || k.t;
        speed = 5 + dist / 1500; dist += speed * s * .12; spawn -= speed * s;
        w += (lift ? .0055 : -.0035) * s + (a - .78) * .0075 * s * (a > .05 ? 1 : 0); w *= Math.pow(.985, s);
        a += w * s; if (a < 0) { a = 0; w = 0; }
        if (a > 1.5) { alive = false; api.beep(100, .5); api.overlay(`<b>Looped out!</b>${Math.floor(dist)} m · best wheelie ${Math.floor(best)} m<br><small>any key to retry</small>`); }
        if (a > .15) { wheelieM += speed * s * .12; best = Math.max(best, wheelieM); } else if (wheelieM > 0) { if (wheelieM > 20) { msg = `${Math.floor(wheelieM)} m wheelie!`; msgT = 1200; } wheelieM = 0; }
        if (spawn <= 0) { spawn = 320 + rnd(400); rocks.push({ x: W + 30, w: 16 + rnd(14), h: 10 + rnd(8) }); }
        rocks.forEach(r => r.x -= speed * s); rocks = rocks.filter(r => r.x > -60);
        for (const r of rocks) if (!r.hit && Math.abs(r.x - (BX + 34 * Math.cos(a))) < r.w / 2 + 6) { r.hit = true; if (a < .3) { alive = false; api.beep(100, .5); api.overlay(`<b>Hit a rock</b>${Math.floor(dist)} m · best wheelie ${Math.floor(best)} m<br><small>any key to retry</small>`); } else { api.beep(800, .05); } }
        if (msgT > 0) msgT -= dt;
        api.score(Math.floor(dist + best * 2));
      }
      draw();
    });
    function draw() {
      x.fillStyle = '#bae6fd'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#7dd3fc'; for (let i = 0; i < 5; i++) { const cx = ((i * 160 - dist * 2) % (W + 200) + W + 200) % (W + 200) - 100; x.beginPath(); x.arc(cx, 50 + i * 14, 22, 0, 7); x.arc(cx + 24, 44 + i * 14, 26, 0, 7); x.fill(); }
      x.fillStyle = '#78350f'; x.fillRect(0, G + 12, W, H - G); x.fillStyle = '#65a30d'; x.fillRect(0, G + 8, W, 8);
      x.fillStyle = '#a3e635'; for (let i = 0; i < 16; i++) x.fillRect(((i * 40 - dist * 8) % W + W) % W, G + 8, 12, 3);
      rocks.forEach(r => { x.fillStyle = r.hit ? '#a8a29e' : '#57534e'; RC.rr(x, r.x - r.w / 2, G + 10 - r.h, r.w, r.h, 4); });
      /* bike: rear wheel fixed at BX, body rotates by -a around it */
      x.save(); x.translate(BX, G); x.rotate(-a);
      x.fillStyle = '#0ea5e9'; RC.rr(x, -6, -18, 46, 12, 4); x.fillStyle = '#fbbf24'; x.fillRect(8, -24, 14, 8);
      x.strokeStyle = '#111'; x.lineWidth = 3; x.beginPath(); x.moveTo(28, -10); x.lineTo(34, 2); x.moveTo(12, -18); x.lineTo(20, -32); x.stroke();
      x.fillStyle = '#111'; x.beginPath(); x.arc(34, 2, 10, 0, 7); x.fill(); x.fillStyle = '#444'; x.beginPath(); x.arc(34, 2, 5, 0, 7); x.fill();
      x.fillStyle = '#f97316'; x.beginPath(); x.arc(22, -36, 6, 0, 7); x.fill();
      x.restore();
      x.fillStyle = '#111'; x.beginPath(); x.arc(BX, G + 2, 11, 0, 7); x.fill(); x.fillStyle = '#444'; x.beginPath(); x.arc(BX, G + 2, 5, 0, 7); x.fill();
      RC.text(x, Math.floor(dist) + ' m', 12, 24, 14, '#0c4a6e'); RC.text(x, 'best wheelie ' + Math.floor(best) + ' m', W - 12, 24, 14, '#0c4a6e', 'right');
      if (wheelieM > 3) RC.text(x, Math.floor(wheelieM) + ' m', BX, G - 70, 18, '#f97316', 'center');
      x.fillStyle = '#111'; x.fillRect(12, 34, 120, 8); x.fillStyle = a > 1.1 ? '#ef4444' : a > .5 ? '#4ade80' : '#fbbf24'; x.fillRect(12, 34, 120 * Math.min(1, a / 1.5), 8);
      if (msgT > 0) RC.text(x, msg, W / 2, 80, 18, '#c2410c', 'center');
    }
    reset();
  } },

/* ===== STUNT JUMP ===== */
{ id: 'stunt', title: 'Stunt Jump', emoji: '🚌', cat: 'racing', colors: ['#f59e0b', '#ef4444'],
  help: 'Hold ↑ / Space / touch to build speed up the ramp. In the air ← → tilt the car. Clear the buses and land flat – each jump adds a bus.',
  run(stage, api) {
    const W = 600, H = 340, G = 280, RAMP0 = 210, RAMP1 = 310, RH = 70; const { c, x } = api.canvas(W, H);
    const k = RC.keys(api, stage);
    let car, buses, phase, msg, msgT, best, flips, sc;
    const rampY = px => px < RAMP0 ? G : px > RAMP1 ? G - RH : G - (px - RAMP0) / (RAMP1 - RAMP0) * RH;
    function reset() { buses = 1; best = 0; sc = 0; newRun(); api.overlay('<b>Stunt Jump</b><small>any key to start</small>'); phase = 'wait'; }
    function newRun() { car = { x: 30, y: G, vx: 0, vy: 0, a: 0, w: 0, spin: 0 }; phase = 'run'; flips = 0; }
    const busEnd = () => RAMP1 + 30 + buses * 42;
    api.onKey(() => { if (phase === 'wait') { phase = 'run'; api.overlay(null); } else if (phase === 'crash' || phase === 'land') { newRun(); api.overlay(null); } });
    api.onTap(() => { if (phase === 'wait') { phase = 'run'; api.overlay(null); } else if (phase === 'crash' || phase === 'land') { newRun(); api.overlay(null); } });
    api.onRestart(reset);
    api.loop(dt => {
      const s = dt / 16.67;
      if (msgT > 0) msgT -= dt;
      if (phase === 'run') {
        if (k.u || k.sp || k.t) car.vx = Math.min(13, car.vx + .22 * s); else car.vx = Math.max(0, car.vx - .08 * s);
        car.x += car.vx * s; car.y = rampY(car.x); car.a = car.x > RAMP0 && car.x < RAMP1 ? -Math.atan2(RH, RAMP1 - RAMP0) : 0;
        if (car.x >= RAMP1) { phase = 'air'; const th = Math.atan2(RH, RAMP1 - RAMP0); car.vy = -car.vx * Math.sin(th); car.vx = car.vx * Math.cos(th); car.a = -th; car.w = 0; }
      } else if (phase === 'air') {
        car.vy += .32 * s; car.x += car.vx * s; car.y += car.vy * s;
        car.w += (k.l ? -.012 : k.r ? .012 : 0) * s; car.w *= Math.pow(.99, s); car.a += car.w * s; car.spin += car.w * s;
        flips = Math.floor(Math.abs(car.spin) / (Math.PI * 2));
        const be = busEnd();
        if (car.x > RAMP1 + 30 && car.x < be && car.y > G - 44) crash('Into the buses!');
        else if (car.y >= G) {
          car.y = G; const ok = Math.abs(RC.ang(car.a)) < .55;
          if (!ok) crash('Landed on the roof!');
          else if (car.x < be) crash('Short!');
          else if (car.x > be + 150) crash('Overshot the landing zone!');
          else { phase = 'land'; const pts = buses * 100 + flips * 150; sc += pts; best = Math.max(best, buses); api.score(sc); api.beep(900, .12); buses++; msg = `+${pts}${flips ? ` (${flips} flip${flips > 1 ? 's' : ''}!)` : ''}`; msgT = 1500; api.overlay(`<b>Cleared ${buses - 1} bus${buses > 2 ? 'es' : ''}!</b>${flips ? flips + ' flip bonus · ' : ''}${sc} pts<br><small>any key for ${buses} buses</small>`); }
        }
      }
      draw();
    });
    function crash(why) { phase = 'crash'; api.beep(100, .5); api.score(sc); api.overlay(`<b>${why}</b>${sc} pts · best ${best} bus${best === 1 ? '' : 'es'}<br><small>any key to retry (score resets)</small>`); sc = 0; buses = 1; }
    function draw() {
      x.fillStyle = '#fed7aa'; x.fillRect(0, 0, W, H); x.fillStyle = '#fdba74'; x.beginPath(); x.arc(520, 70, 30, 0, 7); x.fill();
      x.fillStyle = '#78716c'; x.fillRect(0, G, W, H - G); x.fillStyle = '#a8a29e'; x.fillRect(0, G, W, 4);
      x.fillStyle = '#b45309'; x.beginPath(); x.moveTo(RAMP0, G); x.lineTo(RAMP1, G - RH); x.lineTo(RAMP1, G); x.fill();
      x.fillStyle = '#fde047'; x.fillRect(RAMP1 - 6, G - RH, 6, RH);
      const be = busEnd(); for (let i = 0; i < buses; i++) { const bx = RAMP1 + 30 + i * 42; x.fillStyle = '#facc15'; RC.rr(x, bx + 2, G - 40, 38, 40, 4); x.fillStyle = '#7dd3fc'; for (let j = 0; j < 3; j++) x.fillRect(bx + 6 + j * 11, G - 34, 8, 10); x.fillStyle = '#111'; x.fillRect(bx + 6, G - 4, 8, 4); x.fillRect(bx + 28, G - 4, 8, 4); }
      x.fillStyle = 'rgba(74,222,128,.35)'; x.fillRect(be, G - 6, 150, 6);
      x.save(); x.translate(car.x, car.y - 12); x.rotate(car.a); RC.rr.call(null, x, -22, -8, 44, 16, 4); x.restore();
      x.save(); x.translate(car.x, car.y - 12); x.rotate(car.a); x.fillStyle = '#ef4444'; RC.rr(x, -22, -8, 44, 16, 4); x.fillStyle = 'rgba(0,0,0,.4)'; RC.rr(x, -8, -16, 20, 9, 3); x.fillStyle = '#111'; x.beginPath(); x.arc(-13, 9, 6, 0, 7); x.arc(13, 9, 6, 0, 7); x.fill(); x.restore();
      x.fillStyle = '#111'; x.fillRect(12, 14, 150, 10); x.fillStyle = car.vx > 11 ? '#ef4444' : '#4ade80'; x.fillRect(12, 14, 150 * car.vx / 13, 10);
      RC.text(x, 'speed', 170, 23, 12, '#7c2d12'); RC.text(x, `${buses} bus${buses > 1 ? 'es' : ''} · ${sc} pts`, W - 12, 24, 14, '#7c2d12', 'right');
      if (phase === 'air' && flips) RC.text(x, flips + ' FLIP', car.x, car.y - 40, 16, '#dc2626', 'center');
      if (msgT > 0) RC.text(x, msg, W / 2, 70, 18, '#dc2626', 'center');
    }
    reset();
  } },

/* ===== RALLY STAGE ===== */
{ id: 'rally', title: 'Rally Stage', emoji: '🌲', cat: 'racing', colors: ['#365314', '#f97316'],
  help: '← → steer (it slides on gravel!), ↑ gas, ↓ brake. Listen to the co-driver: “◀ 4” means a tight left is coming. Trees hurt. 5 km stage.',
  run(stage, api) {
    const W = 400, H = 520, PY = H - 100, TW = 80, STAGE = 5000; const { c, x } = api.canvas(W, H);
    const k = RC.keys(api, stage);
    let cx, notes, trees, d, px, vx, speed, dmg, alive, started, time, done, msg, msgT;
    function build() {
      cx = []; notes = []; trees = []; let X = W / 2, dir = 0, i = 0;
      while (i < STAGE + H) {
        const straight = Math.random() < .35, len = straight ? 150 + rnd(250) : 120 + rnd(200), sev = straight ? 0 : 1 + rnd(5), sign = Math.random() < .5 ? -1 : 1;
        if (!straight) notes.push({ at: i, sev, sign });
        for (let j = 0; j < len; j++, i++) { const t = j / len; const curve = straight ? 0 : sign * sev * .0016 * Math.sin(t * Math.PI); dir += curve; dir *= .995; X += dir; if (X < 100) { X = 100; dir = Math.abs(dir) * .3; } if (X > W - 100) { X = W - 100; dir = -Math.abs(dir) * .3; } cx.push(X); }
      }
      for (let j = 0; j < STAGE + H; j += 24 + rnd(30)) { const side = Math.random() < .5 ? -1 : 1; trees.push({ d: j, x: cx[Math.min(cx.length - 1, j)] + side * (TW + 18 + rnd(40)), s: 10 + rnd(8) }); }
    }
    function reset() { build(); d = 0; px = W / 2; vx = 0; speed = 0; dmg = 0; alive = true; started = false; time = 0; done = false; msg = ''; msgT = 0; api.score(0); api.overlay('<b>Rally Stage</b><small>any key to start · 5 km</small>'); }
    function begin() { if (!alive || done) reset(); else if (!started) { started = true; api.overlay(null); } }
    api.onKey(begin); api.onTap(begin); api.onRestart(reset);
    const center = dd => cx[clamp(Math.floor(dd), 0, cx.length - 1)];
    api.loop(dt => {
      const s = dt / 16.67;
      if (started && alive && !done) {
        time += dt;
        if (k.u || k.t) speed = Math.min(9, speed + .1 * s); else if (k.d) speed = Math.max(0, speed - .25 * s); else speed = Math.max(0, speed - .04 * s);
        vx += (k.r - k.l) * .45 * s * Math.min(1, speed / 3); vx *= Math.pow(.9, s); px += vx * s;
        const off = px - center(d);
        if (Math.abs(off) > TW) { speed *= Math.pow(.96, s); dmg += .08 * s; if (Math.random() < .2) msg = 'off the road!', msgT = 300; }
        if (px < 20 || px > W - 20) { px = clamp(px, 20, W - 20); vx = 0; }
        d += speed * s;
        for (const t of trees) if (!t.hit && Math.abs(t.d - d) < 14 && Math.abs(t.x - px) < t.s + 10) { t.hit = true; dmg += 30; speed *= .3; vx = -Math.sign(t.x - px) * 4; api.beep(120, .3); msg = 'TREE!'; msgT = 800; }
        if (dmg >= 100) { alive = false; api.beep(90, .6); api.overlay(`<b>Car destroyed</b>${(d / 1000).toFixed(2)} km<br><small>any key to retry</small>`); }
        if (d >= STAGE) { done = true; const sc = Math.round(5000 + Math.max(0, 60000 - time) / 20); api.score(sc); api.beep(900, .2); api.overlay(`<b>🏁 Stage complete</b>${RC.fmt(time)} · ${sc} pts<br><small>any key to run it again</small>`); }
        if (msgT > 0) msgT -= dt;
        api.score(Math.floor(d));
      }
      draw();
    });
    function draw() {
      x.fillStyle = '#365314'; x.fillRect(0, 0, W, H);
      /* road: one strip per 8px row, far rows at the top */
      for (let y = 0; y < H; y += 8) { const dd = d + (PY - y); const cxx = center(dd); x.fillStyle = Math.floor(dd / 40) % 2 ? '#a16207' : '#92400e'; x.fillRect(cxx - TW, y, TW * 2, 9); x.fillStyle = '#fef3c7'; x.fillRect(cxx - TW - 3, y, 3, 9); x.fillRect(cxx + TW, y, 3, 9); }
      for (const t of trees) { const y = PY - (t.d - d); if (y < -30 || y > H + 30) continue; x.fillStyle = t.hit ? '#3f6212' : '#14532d'; x.beginPath(); x.arc(t.x, y, t.s, 0, 7); x.fill(); x.fillStyle = '#166534'; x.beginPath(); x.arc(t.x - 3, y - 3, t.s * .5, 0, 7); x.fill(); }
      if (Math.abs(px - center(d)) > TW && speed > 1) { x.fillStyle = 'rgba(217,119,6,.4)'; x.beginPath(); x.arc(px + (Math.random() - .5) * 20, PY + 30, 10, 0, 7); x.fill(); }
      RC.car(x, px, PY, -Math.PI / 2 + vx * .06, 40, 22, '#f97316', { brake: k.d });
      const next = notes.find(n => n.at > d - 40 && n.at < d + 700);
      x.fillStyle = 'rgba(0,0,0,.55)'; RC.rr(x, W / 2 - 120, 10, 240, 44, 8);
      if (next) { const dist = Math.max(0, Math.round((next.at - d) / 10) * 10); RC.text(x, `${next.sign < 0 ? '◀' : '▶'} ${next.sev}${next.sev >= 5 ? ' hairpin' : next.sev >= 3 ? ' tight' : ''}`, W / 2, 30, 18, next.sev >= 4 ? '#f87171' : '#fde047', 'center'); RC.text(x, dist ? `in ${dist} m` : 'NOW', W / 2, 48, 12, '#fff', 'center'); }
      else RC.text(x, 'flat out', W / 2, 38, 16, '#4ade80', 'center');
      RC.text(x, (d / 1000).toFixed(2) + ' km', 12, H - 14, 14); RC.text(x, RC.fmt(time), W - 12, H - 14, 14, '#fff', 'right');
      x.fillStyle = '#111'; x.fillRect(12, 12, 100, 8); x.fillStyle = dmg < 60 ? '#4ade80' : '#f87171'; x.fillRect(12, 12, Math.max(0, 100 - dmg), 8);
      if (msgT > 0) RC.text(x, msg, W / 2, 90, 18, '#fde047', 'center');
    }
    reset();
  } },

/* ===== PARKING PRO ===== */
{ id: 'parking', title: 'Parking Pro', emoji: '🅿️', cat: 'racing', colors: ['#2563eb', '#f8fafc'],
  help: '↑ forward, ↓ reverse, ← → steer. Stop fully inside the green bay. Bumping cars or cones costs a life. Bays get tighter every level.',
  run(stage, api) {
    const W = 600, H = 420, CL = 40, CW = 20; const { c, x } = api.canvas(W, H);
    const k = RC.keys(api, stage);
    let car, bay, cars, cones, level, lives, time, score, alive, started, still, msg, msgT;
    function layout() {
      cars = []; cones = [];
      const kind = level % 3;
      if (kind === 0) { /* row of bays along the top, one free */
        const free = 1 + rnd(5), gap = Math.max(CW + 6, 34 - level); for (let i = 0; i < 7; i++) { const bx = 60 + i * 74; if (i === free) bay = { x: bx, y: 40, w: gap + 8, h: CL + 12, a: -Math.PI / 2 }; else cars.push({ x: bx, y: 40, w: CW + 2, h: CL + 2 }); }
        car = { x: 90, y: 300, a: 0, v: 0, st: 0 }; for (let i = 0; i < 2 + Math.min(4, level); i++) cones.push({ x: 150 + rnd(340), y: 170 + rnd(120) });
      } else if (kind === 1) { /* parallel parking on the right */
        const gapH = Math.max(CL + 10, 90 - level * 3); cars.push({ x: W - 50, y: 80, w: CW + 2, h: CL + 2 }); cars.push({ x: W - 50, y: 80 + (CL + 2) / 2 + gapH + (CL + 2) / 2, w: CW + 2, h: CL + 2 });
        bay = { x: W - 50, y: 80 + (CL + 2) / 2 + gapH / 2, w: CW + 12, h: gapH, a: -Math.PI / 2 }; car = { x: W - 120, y: 60, a: Math.PI / 2, v: 0, st: 0 }; for (let i = 0; i < 3; i++) cones.push({ x: 60 + rnd(300), y: 80 + rnd(280) });
      } else { /* reverse into a cone box in the middle */
        bay = { x: W / 2, y: 100, w: Math.max(CW + 8, 40 - level), h: CL + 14, a: -Math.PI / 2 };
        for (let i = -1; i <= 1; i += 2) for (let j = 0; j < 3; j++) cones.push({ x: bay.x + i * (bay.w / 2 + 6), y: bay.y - bay.h / 2 + j * bay.h / 2 });
        car = { x: W / 2, y: 320, a: -Math.PI / 2 + .2, v: 0, st: 0 }; for (let i = 0; i < 4; i++) cones.push({ x: 80 + rnd(440), y: 200 + rnd(60) });
      }
      cones = cones.filter(cn => Math.hypot(cn.x - car.x, cn.y - car.y) > 60);
      time = 45; still = 0;
    }
    function reset() { level = 0; lives = 3; score = 0; alive = true; started = false; msg = ''; msgT = 0; layout(); api.score(0); api.overlay('<b>Parking Pro</b><small>any key to start</small>'); }
    function begin() { if (!alive) reset(); else if (!started) { started = true; api.overlay(null); } }
    api.onKey(begin); api.onTap(begin); api.onRestart(reset);
    const corners = () => { const cs = []; for (const [dx, dy] of [[-CL / 2, -CW / 2], [CL / 2, -CW / 2], [CL / 2, CW / 2], [-CL / 2, CW / 2], [0, -CW / 2], [0, CW / 2]]) cs.push({ x: car.x + dx * Math.cos(car.a) - dy * Math.sin(car.a), y: car.y + dx * Math.sin(car.a) + dy * Math.cos(car.a) }); return cs; };
    const inRect = (p, r, pad = 0) => Math.abs(p.x - r.x) < r.w / 2 + pad && Math.abs(p.y - r.y) < r.h / 2 + pad;
    function bump(why) { lives--; car.v = -car.v * .6; msg = why; msgT = 900; api.beep(150, .2); if (lives <= 0) end('Out of lives'); }
    function end(t) { alive = false; api.score(score); api.overlay(`<b>${t}</b>level ${level + 1} · ${score} pts<br><small>any key to retry</small>`); }
    api.loop(dt => {
      const s = dt / 16.67;
      if (started && alive) {
        time -= dt / 1000; if (time <= 0) { end('Time up!'); }
        if (k.u || k.t) car.v = Math.min(2.2, car.v + .08 * s); else if (k.d) car.v = Math.max(-1.6, car.v - .08 * s); else car.v *= Math.pow(.9, s);
        car.st += ((k.r - k.l) * .55 - car.st) * .2 * s;
        car.a += car.v / 26 * Math.tan(car.st) * s; car.x += Math.cos(car.a) * car.v * s; car.y += Math.sin(car.a) * car.v * s;
        const cs = corners(); let hit = null;
        if (cs.some(p => p.x < 8 || p.x > W - 8 || p.y < 8 || p.y > H - 8)) hit = 'hit the wall';
        for (const o of cars) if (cs.some(p => inRect(p, o))) hit = 'hit a car';
        for (const cn of cones) if (cs.some(p => Math.hypot(p.x - cn.x, p.y - cn.y) < 7)) hit = 'hit a cone';
        if (hit && Math.abs(car.v) > .05) { bump(hit); car.x += Math.cos(car.a) * car.v * 3; car.y += Math.sin(car.a) * car.v * 3; }
        else if (hit) { car.x -= Math.cos(car.a) * .5; }
        const inBay = cs.every(p => inRect(p, bay, 1));
        if (inBay && Math.abs(car.v) < .05) { still += dt; if (still > 800) { const pts = 100 + Math.round(time) * 4 + level * 20; score += pts; api.score(score); api.beep(900, .12); msg = `PARKED! +${pts}`; msgT = 1500; level++; layout(); } } else still = 0;
        if (msgT > 0) msgT -= dt;
      }
      draw();
    });
    function draw() {
      x.fillStyle = '#4b5563'; x.fillRect(0, 0, W, H);
      x.strokeStyle = '#6b7280'; x.lineWidth = 6; x.strokeRect(3, 3, W - 6, H - 6);
      x.fillStyle = still > 0 ? 'rgba(74,222,128,.45)' : 'rgba(74,222,128,.2)'; x.fillRect(bay.x - bay.w / 2, bay.y - bay.h / 2, bay.w, bay.h);
      x.strokeStyle = '#4ade80'; x.lineWidth = 2; x.setLineDash([6, 4]); x.strokeRect(bay.x - bay.w / 2, bay.y - bay.h / 2, bay.w, bay.h); x.setLineDash([]);
      RC.text(x, 'P', bay.x, bay.y + 6, 18, '#bbf7d0', 'center');
      cars.forEach((o, i) => RC.car(x, o.x, o.y, -Math.PI / 2, CL, CW, RC.PALETTE[(i + 3) % 9]));
      cones.forEach(cn => { x.fillStyle = '#f97316'; x.beginPath(); x.moveTo(cn.x, cn.y - 7); x.lineTo(cn.x + 6, cn.y + 6); x.lineTo(cn.x - 6, cn.y + 6); x.fill(); });
      RC.car(x, car.x, car.y, car.a, CL, CW, '#2563eb', { brake: k.d });
      if (still > 0) { x.fillStyle = '#4ade80'; x.fillRect(bay.x - 30, bay.y + bay.h / 2 + 6, 60 * Math.min(1, still / 800), 5); }
      RC.text(x, `level ${level + 1}`, 14, 26, 16); RC.text(x, '❤'.repeat(lives), 14, 48, 16, '#f87171');
      RC.text(x, Math.ceil(time) + 's', W - 14, 28, 20, time < 10 ? '#f87171' : '#fff', 'right'); RC.text(x, score + ' pts', W - 14, 48, 14, '#fff', 'right');
      if (msgT > 0) RC.text(x, msg, W / 2, H - 20, 18, '#fde047', 'center');
    }
    reset();
  } },

/* ===== TAXI DASH ===== */
{ id: 'taxi', title: 'Taxi Dash', emoji: '🚕', cat: 'racing', colors: ['#facc15', '#111827'],
  help: '↑ gas, ↓ brake/reverse, ← → steer. Stop next to the 🙋 to pick up, follow the arrow, stop at the 🏁 to drop off. Faster trips pay more. 90 seconds.',
  run(stage, api) {
    const W = 600, H = 420, BLK = 120, ST = 60, COLS = 6, ROWS = 5, WW = COLS * (BLK + ST) + ST, WH = ROWS * (BLK + ST) + ST; const { c, x } = api.canvas(W, H);
    const k = RC.keys(api, stage);
    let car, cam, fare, time, alive, started, pax, dest, trip, tripT, msg, msgT, tips;
    const blocks = []; for (let i = 0; i < COLS; i++) for (let j = 0; j < ROWS; j++) blocks.push({ x: ST + i * (BLK + ST), y: ST + j * (BLK + ST), col: ['#475569', '#334155', '#1e293b', '#6b7280'][(i * 3 + j) % 4], h: 20 + ((i * 7 + j * 5) % 5) * 12 });
    function streetPoint() { if (Math.random() < .5) { const j = rnd(ROWS + 1); return { x: 40 + rnd(WW - 80), y: j * (BLK + ST) + ST / 2 }; } const i = rnd(COLS + 1); return { x: i * (BLK + ST) + ST / 2, y: 40 + rnd(WH - 80) }; }
    function newPax() { do { pax = streetPoint(); } while (Math.hypot(pax.x - car.x, pax.y - car.y) < 150); dest = null; }
    function reset() { car = { x: ST / 2, y: ST / 2, a: 0, v: 0, st: 0 }; cam = { x: car.x, y: car.y }; fare = 0; time = 90; alive = true; started = false; trip = 0; tips = 0; msg = ''; msgT = 0; newPax(); api.score(0); api.overlay('<b>Taxi Dash</b><small>any key to start · 90s shift</small>'); }
    function begin() { if (!alive) reset(); else if (!started) { started = true; api.overlay(null); } }
    api.onKey(begin); api.onTap(begin); api.onRestart(reset);
    api.loop(dt => {
      const s = dt / 16.67;
      if (started && alive) {
        time -= dt / 1000; if (time <= 0) { time = 0; alive = false; api.score(fare); api.overlay(`<b>Shift over</b>$${fare} earned · ${trip} trips<br><small>any key for another shift</small>`); }
        if (k.u || k.t) car.v = Math.min(5, car.v + .12 * s); else if (k.d) car.v = Math.max(-2, car.v - .15 * s); else car.v *= Math.pow(.96, s);
        car.st += ((k.r - k.l) * .5 - car.st) * .25 * s;
        car.a += car.v / 22 * Math.tan(car.st) * s; car.x += Math.cos(car.a) * car.v * s; car.y += Math.sin(car.a) * car.v * s;
        for (const b of blocks) { const nx = clamp(car.x, b.x, b.x + BLK), ny = clamp(car.y, b.y, b.y + BLK); const dx = car.x - nx, dy = car.y - ny, d = Math.hypot(dx, dy); if (d < 12) { if (d === 0) { car.x -= Math.cos(car.a) * 14; } else { car.x = nx + dx / d * 12; car.y = ny + dy / d * 12; } if (Math.abs(car.v) > 1.5) api.beep(150, .08); car.v *= -.3; } }
        car.x = clamp(car.x, 12, WW - 12); car.y = clamp(car.y, 12, WH - 12);
        const target = dest || pax;
        if (Math.hypot(target.x - car.x, target.y - car.y) < 26 && Math.abs(car.v) < .6) {
          if (!dest) { do { dest = streetPoint(); } while (Math.hypot(dest.x - pax.x, dest.y - pax.y) < 250); tripT = 0; api.beep(700, .08); msg = 'Picked up – follow the arrow'; msgT = 1500; }
          else { const dist = Math.hypot(dest.x - pax.x, dest.y - pax.y), base = Math.round(dist / 10), tip = Math.max(0, Math.round((dist / 3 - tripT / 1000 * 4))); fare += base + tip; trip++; tips += tip; api.score(fare); api.beep(1000, .12); msg = `$${base}${tip ? ` + $${tip} tip!` : ''}`; msgT = 1800; time += 5; newPax(); }
        }
        if (dest) tripT += dt;
        if (msgT > 0) msgT -= dt;
      }
      cam.x += (car.x - cam.x) * .12; cam.y += (car.y - cam.y) * .12;
      cam.x = clamp(cam.x, W / 2, WW - W / 2); cam.y = clamp(cam.y, H / 2, WH - H / 2);
      draw();
    });
    function draw() {
      const ox = W / 2 - cam.x, oy = H / 2 - cam.y;
      x.fillStyle = '#374151'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#fbbf24'; for (let j = 0; j <= ROWS; j++) for (let i = 0; i < WW; i += 30) x.fillRect(i + ox, j * (BLK + ST) + ST / 2 - 1 + oy, 16, 2);
      for (let i = 0; i <= COLS; i++) for (let j = 0; j < WH; j += 30) x.fillRect(i * (BLK + ST) + ST / 2 - 1 + ox, j + oy, 2, 16);
      for (const b of blocks) { const bx = b.x + ox, by = b.y + oy; if (bx > W || by > H || bx + BLK < 0 || by + BLK < 0) continue; x.fillStyle = '#94a3b8'; x.fillRect(bx - 6, by - 6, BLK + 12, BLK + 12); x.fillStyle = b.col; x.fillRect(bx, by, BLK, BLK); x.fillStyle = 'rgba(253,224,71,.5)'; for (let i = 10; i < BLK - 10; i += 20) for (let j = 10; j < BLK - 10; j += 20) if ((i + j) % 40 === 0) x.fillRect(bx + i, by + j, 6, 6); }
      const target = dest || pax;
      RC.text(x, dest ? '🏁' : '🙋', target.x + ox, target.y + oy + 8, 22, '#fff', 'center');
      x.strokeStyle = dest ? '#4ade80' : '#fde047'; x.lineWidth = 2; x.beginPath(); x.arc(target.x + ox, target.y + oy, 22 + Math.sin(performance.now() / 200) * 3, 0, 7); x.stroke();
      RC.car(x, car.x + ox, car.y + oy, car.a, 34, 18, '#facc15', { brake: k.d });
      if (dest) { x.fillStyle = '#fff'; x.fillRect(car.x + ox - 4, car.y + oy - 3, 8, 6); }
      /* direction arrow */
      const ang = Math.atan2(target.y - car.y, target.x - car.x); x.save(); x.translate(car.x + ox, car.y + oy); x.rotate(ang); x.fillStyle = dest ? '#4ade80' : '#fde047'; x.beginPath(); x.moveTo(44, 0); x.lineTo(30, -8); x.lineTo(30, 8); x.fill(); x.restore();
      RC.text(x, `$${fare}`, 14, 28, 20, '#fde047'); RC.text(x, `${trip} trips`, 14, 48, 13);
      RC.text(x, Math.ceil(time) + 's', W - 14, 28, 20, time < 15 ? '#f87171' : '#fff', 'right');
      if (dest) RC.text(x, 'trip ' + RC.fmt(tripT), W - 14, 48, 13, '#fff', 'right');
      if (msgT > 0) RC.text(x, msg, W / 2, H - 20, 16, '#fde047', 'center');
    }
    reset();
  } },

);

/* pseudo-3D road engine (Sunset Outrun, Night Drive) */
RC.road3d = function (stage, api, o) {
  const W = 480, H = 360, SEG = 200, DRAW = 70, CAMH = 1000, CAMD = .84, ROADW = 1000, MAX = 12000;
  const { c, x } = api.canvas(W, H); const k = RC.keys(api, stage);
  let segs, pos, px, speed, cars, alive, started, dist, time, score, flash, lives, cpNext, msg, msgT, sky;
  const L = () => segs.length;
  function build() {
    segs = []; const add = (n, curve) => { for (let i = 0; i < n; i++) segs.push({ i: segs.length, curve, y: 0, sp: [] }); };
    add(40, 0); while (segs.length < o.length) { if (Math.random() < .3) add(20 + rnd(30), 0); else add(25 + rnd(45), (Math.random() < .5 ? -1 : 1) * (1 + rnd(4))); }
    const N = segs.length;
    segs.forEach((s, i) => { s.y = Math.sin(i * Math.PI * 2 * 5 / N) * 500 + Math.sin(i * Math.PI * 2 * 23 / N) * 120; if (i % 5 === 0) s.sp.push({ off: -1.5 - Math.random() * 1.5, kind: rnd(3) }); if (i % 7 === 3) s.sp.push({ off: 1.5 + Math.random() * 1.5, kind: rnd(3) }); });
  }
  function reset() {
    build(); pos = 0; px = 0; speed = 0; alive = true; started = false; dist = 0; time = o.time || 0; score = 0; flash = 0; lives = o.lives || 0; cpNext = o.cpEvery || 0; msg = ''; msgT = 0; sky = 0; cars = [];
    const total = L() * SEG; for (let i = 0; i < o.traffic; i++) cars.push({ z: 4000 + i * (total - 4000) / o.traffic, off: (rnd(3) - 1) * .5, v: MAX * (.22 + Math.random() * .3), col: RC.PALETTE[rnd(9)] });
    api.score(0); api.overlay(`<b>${o.title}</b><small>${o.intro}</small>`);
  }
  const pr = (wx, wy, wz, cx, cy, cz) => { const sc = CAMD / (wz - cz); return { x: W / 2 + sc * (wx - cx) * W / 2, y: H / 2 - sc * (wy - cy) * H / 2, w: sc * ROADW * W / 2, s: sc }; };
  function begin() { if (!alive) { reset(); return; } if (!started) { started = true; api.overlay(null); } }
  api.onKey(begin); api.onTap(begin); api.onRestart(reset);
  function over(t) { alive = false; api.overlay(`<b>${t}</b>${Math.floor(dist)} m · ${score + Math.floor(dist)} pts<br><small>any key to retry</small>`); }
  api.loop(dt => {
    const s = dt / 1000;
    if (started && alive) {
      const total = L() * SEG, base = segs[Math.floor(pos / SEG) % L()], frac = speed / MAX;
      px += (k.r - k.l) * 2.2 * s * Math.max(.35, frac);
      px -= base.curve * frac * frac * .5 * s;
      sky -= base.curve * frac * 40 * s;
      if (k.u || k.t) speed += MAX / 4 * s; else if (k.d) speed -= MAX / 1.5 * s; else speed -= MAX / 6 * s;
      if (Math.abs(px) > 1 && speed > MAX * .35) speed -= MAX * .9 * s;
      speed = clamp(speed, 0, MAX); px = clamp(px, -1.9, 1.9);
      pos += speed * s; while (pos >= total) pos -= total;
      dist += speed * s / 100;
      cars.forEach(cr => { cr.z += cr.v * s; if (cr.z >= total) cr.z -= total; });
      const pz = pos + CAMH * CAMD;
      for (const cr of cars) {
        let dz = cr.z - pz; if (dz > total / 2) dz -= total; if (dz < -total / 2) dz += total;
        if (Math.abs(dz) < 200 && Math.abs(cr.off - px) < .4 && flash <= 0) {
          flash = 1000; api.beep(110, .4); speed *= .2; cr.z += 800;
          if (o.lives) { lives--; msg = lives ? `CRASH – ${lives} left` : ''; msgT = 1500; if (lives <= 0) over('Wrecked'); }
          else { msg = 'CRASH'; msgT = 1000; }
        }
      }
      if (flash > 0) flash -= dt;
      if (o.time) {
        time -= s;
        if (dist >= cpNext) { cpNext += o.cpEvery; time += o.cpBonus; score += 500; msg = `CHECKPOINT  +${o.cpBonus}s`; msgT = 1500; api.beep(880, .1); }
        if (time <= 0) { time = 0; over('Time up!'); }
      }
      if (msgT > 0) msgT -= dt;
      api.score(score + Math.floor(dist));
    }
    draw();
  });
  const poly = (x1, y1, x2, x3, y2, x4, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y1); x.lineTo(x4, y2); x.lineTo(x3, y2); x.closePath(); x.fill(); };
  function tree(sx, sy, sc, kind, n) {
    const h = sc * 900, w = sc * 500; if (h < 2) return;
    if (o.night) { x.fillStyle = '#334155'; x.fillRect(sx - w * .05, sy - h, w * .1, h); x.fillStyle = '#fde68a'; x.beginPath(); x.arc(sx, sy - h, Math.max(1.5, w * .12), 0, 7); x.fill(); x.fillStyle = 'rgba(253,230,138,.12)'; x.beginPath(); x.arc(sx, sy - h * .5, h * .55, 0, 7); x.fill(); return; }
    x.fillStyle = '#78350f'; x.fillRect(sx - w * .06, sy - h * .45, w * .12, h * .45);
    x.fillStyle = o.tree[kind % 2];
    if (kind === 0) { x.beginPath(); x.moveTo(sx, sy - h); x.lineTo(sx + w / 2, sy - h * .35); x.lineTo(sx - w / 2, sy - h * .35); x.fill(); }
    else { x.beginPath(); x.arc(sx, sy - h * .68, w * .45, 0, 7); x.fill(); }
  }
  function carSprite(sx, sy, w, col, n) {
    if (w < 3) return; const h = w * .5;
    x.fillStyle = '#111'; x.fillRect(sx - w * .5, sy - h * .25, w * .2, h * .3); x.fillRect(sx + w * .3, sy - h * .25, w * .2, h * .3);
    x.fillStyle = col; RC.rr(x, sx - w * .45, sy - h * .8, w * .9, h * .75, w * .06);
    x.fillStyle = 'rgba(0,0,0,.4)'; RC.rr(x, sx - w * .3, sy - h * 1.1, w * .6, h * .4, w * .05);
    x.fillStyle = o.night ? '#ff2d2d' : '#b91c1c'; x.fillRect(sx - w * .42, sy - h * .62, w * .16, h * .16); x.fillRect(sx + w * .26, sy - h * .62, w * .16, h * .16);
    if (o.night) { x.fillStyle = 'rgba(255,45,45,.25)'; x.beginPath(); x.arc(sx, sy - h * .55, w * .5, 0, 7); x.fill(); }
  }
  function draw() {
    const g = x.createLinearGradient(0, 0, 0, H / 2); o.sky.forEach((cc, i) => g.addColorStop(i / (o.sky.length - 1), cc)); x.fillStyle = g; x.fillRect(0, 0, W, H);
    if (o.sun) { x.fillStyle = o.sun; x.beginPath(); x.arc(W / 2 + (sky % W) / 8, H * .4, 34, 0, 7); x.fill(); }
    if (o.stars) { x.fillStyle = '#fff'; for (let i = 0; i < 50; i++) x.fillRect((i * 97 + sky / 20 + 5000) % W, (i * 41) % (H / 2.5), 2, 2); x.fillStyle = '#fef3c7'; x.beginPath(); x.arc(W * .8, 60, 18, 0, 7); x.fill(); }
    x.fillStyle = o.hillsCol; x.beginPath(); x.moveTo(0, H / 2 + 2); for (let i = 0; i <= W; i += 8) x.lineTo(i, H / 2 - 16 - 34 * Math.abs(Math.sin((i + sky) / 110)) - 12 * Math.abs(Math.sin((i + sky) / 37))); x.lineTo(W, H / 2 + 2); x.fill();
    const base = Math.floor(pos / SEG), bseg = segs[base % L()], pct = (pos % SEG) / SEG, total = L() * SEG;
    const camY = CAMH + RC.lerp(bseg.y, segs[(base + 1) % L()].y, pct), camX = px * ROADW;
    let xo = 0, dx = -bseg.curve * pct; const list = [];
    for (let n = 0; n < DRAW; n++) {
      const idx = base + n, seg = segs[idx % L()], nxt = segs[(idx + 1) % L()], loop = idx >= L() ? total : 0;
      const z1 = seg.i * SEG + loop, z2 = z1 + SEG;
      if (z1 - pos > 0) list.push({ seg, n, p1: pr(-xo, seg.y, z1, camX, camY, pos), p2: pr(-xo - dx, nxt.y, z2, camX, camY, pos) });
      xo += dx; dx += seg.curve;
    }
    const bySeg = {}; cars.forEach(cr => { const i = Math.floor(cr.z / SEG) % L(); (bySeg[i] = bySeg[i] || []).push(cr); });
    for (let i = list.length - 1; i >= 0; i--) {
      const { seg, p1, p2, n } = list[i];
      if (p1.y <= p2.y) continue;
      const alt = Math.floor(seg.i / 3) % 2, fogA = o.fog ? Math.min(.95, (n / DRAW) ** 1.4) : 0;
      x.fillStyle = alt ? o.grass[0] : o.grass[1]; x.fillRect(0, p2.y, W, p1.y - p2.y + 1);
      poly(p1.x - p1.w * 1.12, p1.y, p1.x + p1.w * 1.12, p2.x - p2.w * 1.12, p2.y, p2.x + p2.w * 1.12, alt ? o.rumble[0] : o.rumble[1]);
      poly(p1.x - p1.w, p1.y, p1.x + p1.w, p2.x - p2.w, p2.y, p2.x + p2.w, alt ? o.road[0] : o.road[1]);
      if (alt) poly(p1.x - p1.w * .02, p1.y, p1.x + p1.w * .02, p2.x - p2.w * .02, p2.y, p2.x + p2.w * .02, o.lane);
      seg.sp.forEach(sp => tree(p1.x + p1.w * sp.off, p1.y, p1.s * W / 2, sp.kind, n));
      (bySeg[seg.i] || []).forEach(cr => { const f = (cr.z % SEG) / SEG; carSprite(RC.lerp(p1.x, p2.x, f) + RC.lerp(p1.w, p2.w, f) * cr.off, RC.lerp(p1.y, p2.y, f), RC.lerp(p1.s, p2.s, f) * W / 2 * 560, cr.col, n); });
      if (fogA > 0) { x.fillStyle = `rgba(${o.fog},${fogA})`; x.fillRect(0, p2.y, W, p1.y - p2.y + 1); }
    }
    /* player car (rear view) */
    const steer = (k.r - k.l), shake = Math.abs(px) > 1 && speed > 2000 ? (Math.random() - .5) * 4 : 0;
    const cxp = W / 2 + steer * 6, cyp = H - 26 + shake;
    x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.ellipse(cxp, cyp + 4, 52, 8, 0, 0, 7); x.fill();
    x.fillStyle = '#111'; x.fillRect(cxp - 48, cyp - 12, 16, 18); x.fillRect(cxp + 32, cyp - 12, 16, 18);
    x.fillStyle = flash > 0 && Math.floor(flash / 80) % 2 ? '#fff' : '#ef4444'; RC.rr(x, cxp - 44, cyp - 34, 88, 34, 6);
    x.fillStyle = 'rgba(0,0,0,.45)'; RC.rr(x, cxp - 30 + steer * 4, cyp - 52, 60, 20, 5);
    x.fillStyle = o.night ? '#ff3b3b' : '#b91c1c'; x.fillRect(cxp - 40, cyp - 28, 14, 7); x.fillRect(cxp + 26, cyp - 28, 14, 7);
    if (o.night) {
      const hl = x.createRadialGradient(W / 2, H * .95, 40, W / 2, H * .6, W * .62); hl.addColorStop(0, 'rgba(0,0,0,0)'); hl.addColorStop(.45, 'rgba(0,0,0,.08)'); hl.addColorStop(1, 'rgba(0,0,0,.82)'); x.fillStyle = hl; x.fillRect(0, 0, W, H);
      x.strokeStyle = 'rgba(148,163,184,.35)'; x.lineWidth = 1; x.beginPath(); for (let i = 0; i < 40; i++) { const rx = Math.random() * W, ry = Math.random() * H; x.moveTo(rx, ry); x.lineTo(rx - 2, ry + 12); } x.stroke();
    }
    RC.text(x, Math.round(speed / MAX * 300) + ' km/h', 10, 22); RC.text(x, Math.floor(dist) + ' m', 10, 40, 12, '#e2e8f0');
    if (o.time) RC.text(x, Math.ceil(time) + 's', W - 10, 26, 22, time < 8 ? '#f87171' : '#fde047', 'right');
    if (o.lives) RC.text(x, '❤'.repeat(Math.max(0, lives)), W - 10, 26, 18, '#f87171', 'right');
    if (msgT > 0) RC.text(x, msg, W / 2, 70, 18, '#fde047', 'center');
    if (!started && alive) RC.text(x, o.title, W / 2, H / 2, 10, 'rgba(0,0,0,0)', 'center');
  }
  reset();
};


/* top-down circuit engine (Grand Prix, Turbo Kart) */
RC.circuit = function (stage, api, o) {
  const W = 600, H = 420; const { c, x } = api.canvas(W, H); const k = RC.keys(api, stage);
  const path = RC.spline(o.points, 12), N = path.length, TW = o.width;
  const at = (i, off = 0) => { const p = path[((i % N) + N) % N]; return { x: p.x - Math.sin(p.a) * off, y: p.y + Math.cos(p.a) * off, a: p.a }; };
  let cars, me, phase, t, count, msg, msgT, pads, boxes, bananas, item, particles;
  function mk(i, off, col, ai) { const p = at(-4 - i * 5, off); return { x: p.x, y: p.y, a: p.a, v: 0, idx: ((-4 - i * 5) % N + N) % N, lap: 0, col, ai, boost: 0, spin: 0, skill: .9 + Math.random() * .12, prog: 0, done: 0 }; }
  function reset() {
    cars = []; const offs = [-TW * .45, TW * .45];
    for (let i = 0; i <= o.ai; i++) cars.push(mk(i, offs[i % 2], i ? RC.PALETTE[i] : '#ef4444', i > 0));
    me = cars[0]; phase = 'wait'; t = 0; count = 3; msg = ''; msgT = 0; item = null; bananas = []; particles = [];
    pads = []; boxes = [];
    if (o.items) { for (let i = 0; i < 4; i++) pads.push({ i: Math.floor(N * (i + .5) / 4), off: (i % 2 ? 1 : -1) * TW * .4 }); for (let i = 0; i < 3; i++) boxes.push({ i: Math.floor(N * (i + .2) / 3), off: 0, up: 0 }); }
    api.score(0); api.overlay(`<b>${o.title}</b>${o.laps} laps · ${o.ai} rivals<br><small>any key to line up</small>`);
  }
  function begin() { if (phase === 'wait') { phase = 'count'; t = 0; api.overlay(null); } else if (phase === 'done') reset(); }
  api.onKey(e => { begin(); if (e.key === ' ' && phase === 'race') useItem(); }); api.onTap(begin); api.onRestart(reset);
  function useItem() {
    if (!item) return;
    if (item === 'rocket') { me.boost = 1800; api.beep(900, .12); }
    else { const p = { x: me.x - Math.cos(me.a) * 22, y: me.y - Math.sin(me.a) * 22 }; bananas.push(p); api.beep(500, .06); }
    item = null;
  }
  function drive(cr, gas, brake, steer, s) {
    const top = (cr.ai ? o.aiTop * cr.skill : o.top) * (cr.boost > 0 ? 1.45 : 1);
    if (cr.spin > 0) { cr.spin -= 16.67 * s; cr.a += .35 * s; cr.v *= Math.pow(.9, s); }
    else {
      if (gas) cr.v += (cr.boost > 0 ? .2 : .11) * s; if (brake) cr.v -= .18 * s; if (!gas && !brake) cr.v *= Math.pow(.985, s);
      cr.v = clamp(cr.v, -1.5, top);
      cr.a += steer * .062 * s * clamp(cr.v / 2.2, -1, 1);
    }
    const n = RC.nearest(path, cr.x, cr.y, cr.idx);
    if (n.d > TW) { cr.v *= Math.pow(.955, s); if (Math.random() < .3 && Math.abs(cr.v) > 1) particles.push({ x: cr.x, y: cr.y, life: 1, col: o.grass }); }
    cr.x += Math.cos(cr.a) * cr.v * s; cr.y += Math.sin(cr.a) * cr.v * s;
    if (cr.boost > 0) { cr.boost -= 16.67 * s; if (Math.random() < .6) particles.push({ x: cr.x - Math.cos(cr.a) * 10, y: cr.y - Math.sin(cr.a) * 10, life: 1, col: '#60a5fa' }); }
    const prev = cr.idx; cr.idx = n.i;
    if (prev > N * .85 && cr.idx < N * .15) { cr.lap++; if (cr === me) { api.beep(880, .1); if (cr.lap < o.laps) { msg = cr.lap === o.laps - 1 ? 'FINAL LAP' : `LAP ${cr.lap + 1}`; msgT = 1200; } } }
    if (prev < N * .15 && cr.idx > N * .85) cr.lap--;
    cr.prog = cr.lap * N + cr.idx;
    for (const p of pads) { const q = at(p.i, p.off); if (Math.hypot(q.x - cr.x, q.y - cr.y) < 14 && cr.boost <= 0) { cr.boost = 900; if (cr === me) api.beep(1000, .08); } }
    for (const b of boxes) { if (b.up > 0) continue; const q = at(b.i, b.off); if (Math.hypot(q.x - cr.x, q.y - cr.y) < 14) { b.up = 5000; if (cr === me && !item) { item = Math.random() < .5 ? 'rocket' : 'banana'; api.beep(700, .08); } else if (cr.ai && Math.random() < .5) cr.boost = 900; } }
    for (const bn of bananas) if (!bn.hit && Math.hypot(bn.x - cr.x, bn.y - cr.y) < 12 && cr.spin <= 0) { bn.hit = true; cr.spin = 900; api.beep(250, .15); }
  }
  api.loop(dt => {
    const s = dt / 16.67;
    if (phase === 'count') { t += dt; const cnt = 3 - Math.floor(t / 800); if (cnt !== count) { count = cnt; api.beep(cnt > 0 ? 500 : 900, .12); } if (t >= 2400) { phase = 'race'; t = 0; } }
    if (phase === 'race') {
      t += dt; if (msgT > 0) msgT -= dt;
      boxes.forEach(b => { if (b.up > 0) b.up -= dt; }); bananas = bananas.filter(b => !b.hit);
      cars.forEach(cr => {
        if (cr.done) { drive(cr, false, false, 0, s); return; }
        if (!cr.ai) drive(cr, k.u || k.t, k.d, k.r - k.l, s);
        else {
          const look = at(cr.idx + 9), want = Math.atan2(look.y - cr.y, look.x - cr.x), d = RC.ang(want - cr.a);
          let kk = 0; for (let j = 4; j < 26; j += 3) kk = Math.max(kk, path[(cr.idx + j) % N].k);
          const tgt = o.aiTop * cr.skill * (1 - Math.min(.55, kk * 9));
          drive(cr, cr.v < tgt, cr.v > tgt + .6, clamp(d * 3, -1, 1), s);
        }
        if (cr.lap >= o.laps && !cr.done) { cr.done = t; cr.v = Math.min(cr.v, 2); }
      });
      for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i], b = cars[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d < 15 && d > 0) { const ov = (15 - d) / 2; a.x -= dx / d * ov; a.y -= dy / d * ov; b.x += dx / d * ov; b.y += dy / d * ov; a.v *= .95; b.v *= .95; }
      }
      particles.forEach(p => p.life -= .05 * s); particles = particles.filter(p => p.life > 0);
      if (me.done) {
        const pos = cars.filter(cr => cr !== me && cr.done && cr.done < me.done).length + 1;
        const sc = (cars.length - pos) * 400 + Math.max(0, Math.round(2000 - me.done / 100)); api.score(sc); phase = 'done';
        api.overlay(`<b>${['🥇 Winner!', '🥈 2nd place', '🥉 3rd place', '4th place'][pos - 1]}</b>${RC.fmt(me.done)} · ${sc} pts<br><small>any key to race again</small>`);
      }
    }
    draw();
  });
  function draw() {
    x.fillStyle = o.grass; x.fillRect(0, 0, W, H);
    x.lineCap = 'round'; x.lineJoin = 'round';
    x.strokeStyle = '#fff'; x.lineWidth = TW * 2 + 8; x.beginPath(); path.forEach((p, i) => i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y)); x.closePath(); x.stroke();
    x.strokeStyle = '#dc2626'; x.setLineDash([12, 12]); x.stroke(); x.setLineDash([]);
    x.strokeStyle = o.tarmac; x.lineWidth = TW * 2; x.stroke();
    const st = path[0]; x.save(); x.translate(st.x, st.y); x.rotate(st.a); for (let i = 0; i < Math.floor(TW / 4); i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#fff' : '#111'; x.fillRect(-4 + j * 4, -TW + i * 8, 4, 8); } x.restore();
    pads.forEach(p => { const q = at(p.i, p.off); x.save(); x.translate(q.x, q.y); x.rotate(q.a); x.fillStyle = '#facc15'; x.beginPath(); x.moveTo(-8, -7); x.lineTo(2, -7); x.lineTo(10, 0); x.lineTo(2, 7); x.lineTo(-8, 7); x.lineTo(0, 0); x.fill(); x.restore(); });
    boxes.forEach(b => { if (b.up > 0) return; const q = at(b.i, b.off); x.save(); x.translate(q.x, q.y); x.rotate(performance.now() / 600); x.fillStyle = '#38bdf8'; x.fillRect(-8, -8, 16, 16); x.restore(); RC.text(x, '?', q.x, q.y + 5, 13, '#fff', 'center'); });
    bananas.forEach(b => RC.text(x, '🍌', b.x, b.y + 6, 16, '#fff', 'center'));
    particles.forEach(p => { x.fillStyle = p.col; x.globalAlpha = p.life * .7; x.fillRect(p.x - 2, p.y - 2, 4, 4); x.globalAlpha = 1; });
    cars.slice().reverse().forEach(cr => RC.car(x, cr.x, cr.y, cr.a, 20, 11, cr.col, { brake: cr === me && k.d }));
    const order = cars.slice().sort((a, b) => b.prog - a.prog), pos = order.indexOf(me) + 1;
    RC.text(x, `LAP ${Math.min(o.laps, me.lap + 1)}/${o.laps}`, 14, 24, 16); RC.text(x, ['1st', '2nd', '3rd', '4th'][pos - 1], 14, 46, 18, pos === 1 ? '#fde047' : '#fff');
    if (phase === 'race' || phase === 'done') RC.text(x, RC.fmt(me.done || t), W - 14, 24, 14, '#fff', 'right');
    if (o.items) RC.text(x, item ? (item === 'rocket' ? '🚀 Space' : '🍌 Space') : '', W - 14, 46, 16, '#fff', 'right');
    if (phase === 'count') RC.text(x, count > 0 ? String(count) : 'GO!', W / 2, H / 2 + 20, 56, count > 0 ? '#fde047' : '#4ade80', 'center');
    if (msgT > 0) RC.text(x, msg, W / 2, 60, 20, '#fde047', 'center');
  }
  reset();
};


/* side-view terrain engine (Hill Climb, Monster Jam). Two wheels as particles joined by a rigid axle. ROT is the in-air spin rate in rad/s. */
RC.hills = function (stage, api, o) {
  const W = 520, H = 340, STEP = 20, big = !!o.big, G = big ? 950 : 1500, R = big ? 17 : 11, WB = big ? 72 : 56, BH = big ? 20 : 14, LIFT = big ? 8 : 0;
  const TOP = big ? 480 : 380, ACC = big ? 900 : 720, ROT = big ? 9.5 : 6.5, BASE = 250;
  const { c, x } = api.canvas(W, H); const k = RC.keys(api, stage);
  const monster = o.mode === 'monster';
  let hs, cans, cars, A, B, spinA, spinB, cam, dist, fuel, time, score, crushed, flips, rotAcc, airT, alive, started, done, msg, msgT, puffs, inv, best;
  const ground = wx => {
    const i = Math.max(0, Math.min(hs.length - 2, Math.floor(wx / STEP))), f = clamp(wx / STEP - i, 0, 1);
    let y = hs[i] + (hs[i + 1] - hs[i]) * f;
    if (cars) for (const cr of cars) if (wx >= cr.x && wx <= cr.x + cr.w) y -= cr.crushed ? 5 : cr.h;
    return y;
  };
  function build() {
    hs = [];
    const N = monster ? 1700 : 1600;
    for (let i = 0; i < N; i++) {
      let y;
      if (monster) y = BASE + Math.sin(i / 9) * 6 + Math.sin(i / 2.7) * 3;
      else { const amp = Math.min(115, 6 + i * .13), s = Math.max(3.2, 8 - i * .004); y = BASE + amp * (Math.sin(i / s) * .7 + Math.sin(i / (s * 2.9) + 2) * .5 + Math.sin(i / 1.9 + 1) * .12); }
      if (i < 14 || i > N - 20) y = BASE;
      hs.push(y);
    }
    if (monster) { /* ramps: 5-point rise then a cliff */
      for (let i = 30; i < N - 40; i += 28 + rnd(20)) { const h = 70 + rnd(45); for (let j = 0; j < 7; j++) hs[i + j] -= h * j / 6; }
    }
    cans = []; cars = [];
    if (o.fuel) for (let px = 900; px < (N - 30) * STEP; px += 1000 + rnd(600)) cans.push({ x: px, got: 0 });
    if (monster) for (let px = 500; px < (N - 30) * STEP; px += 300 + rnd(320)) { const i = Math.floor(px / STEP); if (hs[i] < BASE - 8 || hs[i + 3] < BASE - 8) continue; cars.push({ x: px, w: 44, h: 16, crushed: 0, col: RC.PALETTE[rnd(9)] }); }
  }
  function place(px) { const gy = ground(px) - R; A = { x: px - WB / 2, y: gy, vx: 0, vy: 0, g: 0 }; B = { x: px + WB / 2, y: gy, vx: 0, vy: 0, g: 0 }; rotAcc = 0; airT = 0; }
  function reset() {
    build(); place(120); spinA = spinB = 0; cam = { x: 0, y: BASE - H * .6 }; dist = 0; fuel = 100; time = o.timer || 0; score = 0; crushed = 0; flips = 0; alive = true; started = false; done = false; msg = ''; msgT = 0; puffs = []; inv = 0;
    api.score(0); api.overlay(`<b>${o.title}</b><small>${monster ? 'any key to start · 60 seconds of mayhem' : 'any key to start · how far can you get?'}</small>`);
  }
  function begin() { if (!alive || done) { reset(); return; } if (!started) { started = true; api.overlay(null); } }
  api.onKey(begin); api.onTap(begin); api.onRestart(reset);
  function over(t, sub) { alive = false; api.overlay(`<b>${t}</b>${sub}<br><small>any key to retry</small>`); }
  function crash() {
    api.beep(90, .4);
    if (monster) { time -= 3; msg = 'WIPEOUT  −3s'; msgT = 1500; place((A.x + B.x) / 2); inv = 800; return; }
    over('Crashed!', `${Math.floor(dist)} m`);
  }
  function contact(w, h, drive) {
    const gy = ground(w.x); w.g = 0;
    if (w.y + R * .1 < gy - R) return;
    const sl = (ground(w.x + 3) - ground(w.x - 3)) / 6, len = Math.hypot(1, sl), tx = 1 / len, ty = sl / len, nx = ty, ny = -tx;
    w.y = gy - R; w.g = 1;
    let vt = w.vx * tx + w.vy * ty, vn = w.vx * nx + w.vy * ny;
    if (vn < 0) vn = 0;
    if (started && alive && !done) {
      if ((k.u || k.t) && (!o.fuel || fuel > 0)) vt += ACC * drive * h;
      else if (k.d) vt -= ACC * .8 * h;
    }
    vt *= 1 - .5 * h; vt = clamp(vt, -170, TOP);
    w.vx = tx * vt + nx * vn; w.vy = ty * vt + ny * vn;
    return vt;
  }
  function physics(h) {
    for (const w of [A, B]) { w.vy += G * h; w.x += w.vx * h; w.y += w.vy * h; }
    const inAir = !A.g && !B.g;
    if (inAir && started && alive) { /* controlled spin: hold to rotate, release to stop */
      const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1, px = dy / d, py = -dx / d;
      const w = ((B.vx - A.vx) * px + (B.vy - A.vy) * py) / WB, wt = ROT * (k.u || k.t ? -1 : k.d ? 1 : 0), dw = (wt - w) * Math.min(1, h * 12), im = dw * WB / 2;
      B.vx += px * im; B.vy += py * im; A.vx -= px * im; A.vy -= py * im;
    }
    let vA = 0, vB = 0;
    for (let it = 0; it < 2; it++) {
      vA = contact(A, h, 1); vB = contact(B, h, .55);
      let dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1; const ux = dx / d, uy = dy / d, diff = (d - WB) / 2;
      A.x += ux * diff; A.y += uy * diff; B.x -= ux * diff; B.y -= uy * diff;
      const rel = (B.vx - A.vx) * ux + (B.vy - A.vy) * uy; A.vx += ux * rel / 2; A.vy += uy * rel / 2; B.vx -= ux * rel / 2; B.vy -= uy * rel / 2;
    }
    spinA += (vA || (A.vx)) / R * h; spinB += (vB || B.vx) / R * h;
    /* flips */
    const ang = Math.atan2(B.y - A.y, B.x - A.x);
    if (!A.g && !B.g) { airT += h; if (physics.last != null) rotAcc += RC.ang(ang - physics.last); }
    else { if (monster && Math.abs(rotAcc) > 5.5) { flips++; score += 500; msg = 'FLIP!  +500'; msgT = 1200; api.beep(1100, .12); } else if (monster && airT > .9) { score += 100; msg = 'BIG AIR  +100'; msgT = 900; } rotAcc = 0; airT = 0; }
    physics.last = ang;
    /* roof check */
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, upx = Math.sin(ang), upy = -Math.cos(ang), hh = R + BH + LIFT + 4;
    const hx = mx + upx * hh, hy = my + upy * hh;
    if (inv <= 0 && started && alive && !done && hy > ground(hx)) crash();
  }
  api.loop(dt => {
    if (started && alive && !done) {
      const n = Math.ceil(dt / 8), h = dt / 1000 / n;
      for (let i = 0; i < n; i++) physics(h);
      const mx = (A.x + B.x) / 2;
      dist = Math.max(dist, (mx - 120) / 10);
      if (o.fuel) {
        if (k.u || k.t) fuel -= 13 * dt / 1000;
        for (const cn of cans) if (!cn.got && Math.abs(cn.x - mx) < 28 && Math.abs(ground(cn.x) - 14 - (A.y + B.y) / 2) < 40) { cn.got = 1; fuel = Math.min(100, fuel + 40); api.beep(900, .1); msg = 'FUEL  +40'; msgT = 1000; }
        if (fuel <= 0) { fuel = 0; if (Math.hypot(A.vx, A.vy) < 6 && A.g) over('Out of fuel!', `${Math.floor(dist)} m`); }
        api.score(Math.floor(dist));
      }
      if (monster) {
        for (const cr of cars) if (!cr.crushed && ((A.g && A.x > cr.x - 6 && A.x < cr.x + cr.w + 6) || (B.g && B.x > cr.x - 6 && B.x < cr.x + cr.w + 6))) { cr.crushed = 1; crushed++; score += 100; api.beep(200, .12); msg = 'CRUSHED  +100'; msgT = 800; for (let i = 0; i < 8; i++) puffs.push({ x: cr.x + cr.w / 2, y: ground(cr.x) - 10, vx: (Math.random() - .5) * 200, vy: -80 - Math.random() * 120, t: 700, col: cr.col }); }
        time -= dt / 1000; api.score(score);
        if (time <= 0) { time = 0; done = true; api.overlay(`<b>Time up!</b>${score} pts · ${crushed} crushed · ${flips} flips<br><small>any key to play again</small>`); }
      }
      if (mx > (hs.length - 22) * STEP) { done = true; api.overlay(`<b>🏁 You made it!</b>${monster ? `${score} pts · ${crushed} crushed · ${flips} flips` : Math.floor(dist) + ' m'}<br><small>any key to play again</small>`); }
      if ((k.u || k.t) && (A.g || B.g) && (!o.fuel || fuel > 0) && Math.random() < .35) { const ang = Math.atan2(B.y - A.y, B.x - A.x); puffs.push({ x: A.x - Math.cos(ang) * 8, y: A.y - 4, vx: -60 + (Math.random() - .5) * 40, vy: -30 - Math.random() * 40, t: 500, col: 'rgba(120,120,120,.6)' }); }
      if (inv > 0) inv -= dt; if (msgT > 0) msgT -= dt;
    }
    puffs.forEach(p => { p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000; p.vy += 300 * dt / 1000; p.t -= dt; }); puffs = puffs.filter(p => p.t > 0);
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    cam.x += (mx - W * .38 - cam.x) * .15; cam.y += (my - H * .58 - cam.y) * .08;
    draw();
  });
  function draw() {
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, o.sky[0]); g.addColorStop(1, o.sky[1]); x.fillStyle = g; x.fillRect(0, 0, W, H);
    /* clouds + far hills (parallax) */
    x.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 6; i++) { const cx = ((i * 173 - cam.x * .15) % (W + 120) + W + 120) % (W + 120) - 60, cy = 40 + (i * 37) % 70; x.beginPath(); x.ellipse(cx, cy, 34, 12, 0, 0, 7); x.ellipse(cx + 18, cy - 8, 22, 12, 0, 0, 7); x.fill(); }
    x.fillStyle = o.hillsCol || 'rgba(0,0,0,.18)'; x.beginPath(); x.moveTo(0, H); for (let i = 0; i <= W; i += 8) { const wx = i + cam.x * .35; x.lineTo(i, BASE - cam.y * .35 - 60 - 50 * Math.abs(Math.sin(wx / 260)) - 18 * Math.abs(Math.sin(wx / 90))); } x.lineTo(W, H); x.fill();
    /* terrain */
    const x0 = Math.floor(cam.x / 4) * 4 - 4;
    x.beginPath(); x.moveTo(-4, H + 20); for (let wx = x0; wx <= cam.x + W + 8; wx += 4) x.lineTo(wx - cam.x, ground(wx) - cam.y); x.lineTo(W + 8, H + 20); x.closePath();
    x.fillStyle = o.ground; x.fill(); x.strokeStyle = o.grassTop; x.lineWidth = 7; x.lineJoin = 'round'; x.stroke();
    /* cars (monster) */
    for (const cr of cars) { const sx = cr.x - cam.x; if (sx > W + 50 || sx < -60) continue; const i = Math.floor(cr.x / STEP), gy = hs[i] - cam.y, ch = cr.crushed ? 5 : cr.h; x.fillStyle = cr.col; RC.rr(x, sx, gy - ch, cr.w, ch, 3); if (!cr.crushed) { x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(sx + 10, gy - ch + 2, 22, 6); x.fillStyle = '#111'; x.fillRect(sx + 6, gy - 3, 8, 4); x.fillRect(sx + 30, gy - 3, 8, 4); } }
    /* fuel cans */
    for (const cn of cans) { if (cn.got) continue; const sx = cn.x - cam.x; if (sx > W + 20 || sx < -20) continue; const gy = ground(cn.x) - cam.y; x.fillStyle = '#dc2626'; RC.rr(x, sx - 7, gy - 17, 14, 15, 2); x.fillStyle = '#7f1d1d'; x.fillRect(sx - 4, gy - 20, 8, 4); x.fillStyle = '#fff'; x.fillRect(sx - 4, gy - 11, 8, 4); }
    puffs.forEach(p => { x.fillStyle = p.col; x.beginPath(); x.arc(p.x - cam.x, p.y - cam.y, 3 + (1 - p.t / 700) * 4, 0, 7); x.fill(); });
    /* vehicle */
    const ang = Math.atan2(B.y - A.y, B.x - A.x), mx = (A.x + B.x) / 2 - cam.x, my = (A.y + B.y) / 2 - cam.y;
    const wheel = (w, sp) => { const sx = w.x - cam.x, sy = w.y - cam.y; x.fillStyle = '#1c1917'; x.beginPath(); x.arc(sx, sy, R, 0, 7); x.fill(); x.fillStyle = '#78716c'; x.beginPath(); x.arc(sx, sy, R * .55, 0, 7); x.fill(); x.strokeStyle = '#d6d3d1'; x.lineWidth = 2; x.beginPath(); for (let i = 0; i < 4; i++) { const a = sp + i * Math.PI / 2; x.moveTo(sx, sy); x.lineTo(sx + Math.cos(a) * R * .5, sy + Math.sin(a) * R * .5); } x.stroke(); };
    x.save(); x.translate(mx, my); x.rotate(ang);
    const blink = inv > 0 && Math.floor(inv / 80) % 2;
    if (big) { x.fillStyle = '#292524'; x.fillRect(-WB / 2, -R - 2, WB, 4); x.fillRect(-WB / 2 - 4, -R - 8, 8, 8); x.fillRect(WB / 2 - 4, -R - 8, 8, 8); }
    x.fillStyle = blink ? '#fff' : o.car; RC.rr(x, -WB / 2 - 8, -R - LIFT - BH, WB + 16, BH, 4);
    x.fillStyle = 'rgba(0,0,0,.35)'; RC.rr(x, -WB * .25, -R - LIFT - BH - 12, WB * .42, 13, 3);
    x.fillStyle = '#fde68a'; x.beginPath(); x.arc(-WB * .04, -R - LIFT - BH - 5, 4.5, 0, 7); x.fill();
    x.fillStyle = '#fef08a'; x.fillRect(WB / 2 + 5, -R - LIFT - BH + 3, 3, 4);
    x.restore();
    wheel(A, spinA); wheel(B, spinB);
    /* HUD */
    if (o.fuel) {
      RC.text(x, Math.floor(dist) + ' m', 12, 26, 20);
      x.fillStyle = 'rgba(0,0,0,.45)'; RC.rr(x, W - 132, 12, 120, 16, 4); x.fillStyle = fuel < 25 && Math.floor(performance.now() / 300) % 2 ? '#fff' : fuel < 25 ? '#ef4444' : '#22c55e'; RC.rr(x, W - 130, 14, 116 * fuel / 100, 12, 3);
      RC.text(x, '⛽', W - 152, 26, 14);
    }
    if (monster) {
      RC.text(x, score + ' pts', 12, 26, 20, '#fde047'); RC.text(x, `${crushed} crushed · ${flips} flips`, 12, 44, 12, '#e2e8f0');
      RC.text(x, Math.ceil(time) + 's', W - 12, 28, 22, time < 10 ? '#f87171' : '#fff', 'right');
    }
    if (msgT > 0) RC.text(x, msg, W / 2, 70, 18, '#fde047', 'center');
  }
  reset();
};
