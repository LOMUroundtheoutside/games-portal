/* ===================== REMIX BATCH D: SPORTS =====================
   Four original sports games inspired by popular web games. Every game plays
   1 player vs the computer or 2 players on one keyboard.
   P1: WASD + Space (action) + left Shift (special)
   P2: arrows + Enter (action) + right Shift / "/" (special)               */
(() => {

/* ---------- shared: two-player key tracker ---------- */
function K2(api, stage) {
  const mk = () => ({ l: 0, r: 0, u: 0, d: 0, a: 0, b: 0, aP: 0, bP: 0, uP: 0 });
  const p1 = mk(), p2 = mk();
  const st = { p1, p2, any: null, lastTap: 0 };
  const map = { a: [p1, 'l'], A: [p1, 'l'], d: [p1, 'r'], D: [p1, 'r'], w: [p1, 'u'], W: [p1, 'u'], s: [p1, 'd'], S: [p1, 'd'], ' ': [p1, 'a'], e: [p1, 'b'], E: [p1, 'b'],
    ArrowLeft: [p2, 'l'], ArrowRight: [p2, 'r'], ArrowUp: [p2, 'u'], ArrowDown: [p2, 'd'], Enter: [p2, 'a'], '/': [p2, 'b'] };
  const press = (p, k) => { if (!p[k]) p[k + 'P'] = 1; p[k] = 1; };
  api.onKey(e => {
    if (st.any) st.any(e.key);
    let m = map[e.key];
    if (e.key === 'Shift') m = [e.location === 2 ? p2 : p1, 'b'];
    if (m) { e.preventDefault(); press(m[0], m[1]); }
  });
  api.onKeyUp(e => { let m = map[e.key]; if (e.key === 'Shift') { p1.b = p2.b = 0; return; } if (m) m[0][m[1]] = 0; });
  const touch = e => { const r = stage.getBoundingClientRect(); const fx = (e.clientX - r.left) / r.width; p1.l = fx < .4 ? 1 : 0; p1.r = fx > .6 ? 1 : 0; if (fx >= .4 && fx <= .6) press(p1, 'u'); };
  api.on(stage, 'pointerdown', e => { const now = performance.now(); if (now - st.lastTap < 300) press(p1, 'a'); st.lastTap = now; if (st.any) st.any('tap'); touch(e); });
  api.on(stage, 'pointermove', e => { if (e.buttons) touch(e); });
  api.on(window, 'pointerup', () => { p1.l = p1.r = p1.u = 0; });
  api.on(window, 'blur', () => { for (const p of [p1, p2]) for (const q in p) p[q] = 0; });
  st.clearPulses = () => { for (const p of [p1, p2]) p.aP = p.bP = p.uP = 0; };
  return st;
}
const T = (x, s, px, py, size, col, align) => RC.text(x, s, px, py, size, col, align);
const fmtT = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const menuHtml = (title, sub) => `<b>${title}</b>Press <b style="font-size:1.1rem;display:inline">1</b> vs computer · <b style="font-size:1.1rem;display:inline">2</b> two players<br><small>${sub}</small>`;

/* big-headed side-view player */
function drawBig(x, p, col, skin, face) {
  const hw = p.w / 2, headR = p.w * .62;
  x.save(); x.translate(p.x, p.y);
  x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(0, p.gy - p.y + 2, hw + 4, 4, 0, 0, 7); x.fill();
  const leg = Math.sin(p.anim) * (Math.abs(p.vx) > 20 ? 6 : 0);
  x.fillStyle = '#1f2937'; x.fillRect(-hw + 2 + leg, -6, 6, 10); x.fillRect(hw - 8 - leg, -6, 6, 10);
  x.fillStyle = col; RC.rr(x, -hw, -p.h + headR, p.w, p.h - headR + 2, 5);
  x.fillStyle = skin; x.beginPath(); x.arc(0, -p.h + 2, headR, 0, 7); x.fill();
  x.fillStyle = '#111'; x.beginPath(); x.arc(p.dir * headR * .35, -p.h - 2, 2.5, 0, 7); x.fill();
  if (face) { x.strokeStyle = '#111'; x.lineWidth = 1.5; x.beginPath(); x.arc(p.dir * headR * .25, -p.h + 6, 4, 0, Math.PI); x.stroke(); }
  x.restore();
}
function physSide(p, k, dt, o) {
  const acc = o.acc || 2600, top = (o.top || 250) * (p.slow > 0 ? .4 : 1);
  const ax = (k.r - k.l) * acc;
  if (ax) { p.vx += ax * dt; p.dir = ax > 0 ? 1 : -1; } else p.vx -= p.vx * Math.min(1, 10 * dt);
  p.vx = clamp(p.vx, -top, top);
  if (k.uP && p.onG) { p.vy = -(o.jump || 640); p.onG = false; }
  p.vy += (o.g || 1900) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
  if (p.y >= p.gy) { p.y = p.gy; p.vy = 0; p.onG = true; }
  p.x = clamp(p.x, o.minX, o.maxX); p.anim += Math.abs(p.vx) * dt * .08;
  if (p.slow > 0) p.slow -= dt;
}
function mkP(x, gy, dir, w = 22, h = 44) { return { x, y: gy, gy, vx: 0, vy: 0, w, h, dir, onG: true, anim: 0, slow: 0, cd: 0 }; }
function collideCircle(b, cx, cy, r, bounce = .8) {
  const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy) || 1, min = b.r + r;
  if (d < min) { const nx = dx / d, ny = dy / d; b.x = cx + nx * min; b.y = cy + ny * min; const dot = b.vx * nx + b.vy * ny; if (dot < 0) { b.vx -= (1 + bounce) * dot * nx; b.vy -= (1 + bounce) * dot * ny; } return true; }
  return false;
}

GAMES.push(

/* ===== ROCKET PITCH (inspired by Rocket League) ===== */
{ id: 'remix:rocket-pitch', title: 'Rocket Pitch', emoji: '🚀', cat: 'remix', colors: ['#1e3a8a', '#f97316'],
  help: 'Inspired by Rocket League. What\'s different: it\'s top-down, a jump (Space) punts the ball extra hard, and boost only comes from the pad grid on the pitch. Controls: P1 WASD + Space jump + Shift boost, P2 arrows + Enter + right Shift. Press 1 or 2 to pick a mode.',
  run(stage, api) {
    const W = 600, H = 400, PX = 20, PY = 40, PW = 560, PH = 320, GY1 = 150, GY2 = 250; const { c, x } = api.canvas(W, H);
    const K = K2(api, stage);
    let cars, ball, score, time, phase, mode, pads, pause, msg, msgT, parts, wait = 0;
    const mkCar = (px, dir, col, ai) => ({ x: px, y: PY + PH / 2, a: dir > 0 ? 0 : Math.PI, v: 0, boost: 40, air: 0, col, ai, dir });
    function reset() {
      cars = [mkCar(PX + 120, 1, '#3b82f6', false), mkCar(PX + PW - 120, -1, '#f97316', true)];
      ball = { x: W / 2, y: PY + PH / 2, vx: 0, vy: 0, r: 11 }; score = [0, 0]; time = 90; phase = 'menu'; pause = 0; msg = ''; msgT = 0; parts = [];
      pads = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) pads.push({ x: PX + PW * (i + .5) / 3 + (j ? 90 : -90), y: PY + PH * (j ? .78 : .22), t: 0 });
      api.score(0); api.overlay(menuHtml('Rocket Pitch', 'drive into the ball · pads refill boost'));
    }
    function kickoff() { wait = 1.5; cars[0].x = PX + 120; cars[0].y = PY + PH / 2; cars[0].a = 0; cars[0].v = 0; cars[1].x = PX + PW - 120; cars[1].y = PY + PH / 2; cars[1].a = Math.PI; cars[1].v = 0; ball.x = W / 2; ball.y = PY + PH / 2; ball.vx = ball.vy = 0; }
    function start(m) { mode = m; cars[1].ai = m === 1; phase = 'play'; wait = 1; api.overlay(null); }
    K.any = key => { if (phase === 'menu') start(key === '2' ? 2 : 1); else if (phase === 'over') reset(); };
    api.onRestart(reset);
    function boom(px, py, col, n = 10) { for (let i = 0; i < n; i++) parts.push({ x: px, y: py, vx: (Math.random() - .5) * 300, vy: (Math.random() - .5) * 300, t: .5, col }); }
    function ai(car, dt) {
      const goalX = PX, tx = ball.x + (ball.x > car.x ? -30 : 30), ty = ball.y; // attack toward left goal
      const behind = ball.x < car.x; let ax = behind ? tx : ball.x + 60, ay = behind ? ty : ball.y + (ball.y > PY + PH / 2 ? -50 : 50);
      if (behind && Math.abs(ball.y - car.y) < 40) { ax = goalX; ay = (GY1 + GY2) / 2; ax = ball.x - 10; ay = ball.y + (ball.y - (GY1 + GY2) / 2) * .3; }
      ay += Math.sin(performance.now() / 700) * 55; // the computer wobbles its line so it can't push straight in
      const want = Math.atan2(ay - car.y, ax - car.x), da = RC.ang(want - car.a);
      const k = { l: da < -.08 ? 1 : 0, r: da > .08 ? 1 : 0, u: Math.abs(da) < 1.6 ? 1 : 0, d: Math.abs(da) >= 1.6 ? 1 : 0, b: Math.abs(da) < .25 && Math.hypot(ax - car.x, ay - car.y) > 90 ? 1 : 0, aP: 0 };
      if (Math.hypot(ball.x - car.x, ball.y - car.y) < 40 && behind && Math.random() < .04) k.aP = 1;
      if (car.boost < 20 && Math.random() < .02) { const pad = pads.find(p => p.t <= 0); if (pad) { const w2 = Math.atan2(pad.y - car.y, pad.x - car.x), d2 = RC.ang(w2 - car.a); k.l = d2 < -.08 ? 1 : 0; k.r = d2 > .08 ? 1 : 0; } }
      return k;
    }
    function stepCar(car, k, dt) {
      const acc = 520, steer = 3.4;
      if (k.u) car.v += acc * dt; else if (k.d) car.v -= acc * .7 * dt; else car.v -= car.v * Math.min(1, 2.5 * dt);
      if (k.b && car.boost > 0) { car.v += 900 * dt; car.boost = Math.max(0, car.boost - 40 * dt); if (Math.random() < .5) parts.push({ x: car.x - Math.cos(car.a) * 14, y: car.y - Math.sin(car.a) * 14, vx: -Math.cos(car.a) * 120, vy: -Math.sin(car.a) * 120, t: .3, col: '#fbbf24' }); }
      car.v = clamp(car.v, -160, car.ai ? (k.b ? 300 : 215) : (k.b ? 420 : 300));
      car.a += (k.r - k.l) * steer * dt * clamp(car.v / 120, -1, 1);
      if (k.aP && car.air <= 0) { car.air = .45; api.beep(500, .05); }
      if (car.air > 0) car.air -= dt;
      car.x += Math.cos(car.a) * car.v * dt; car.y += Math.sin(car.a) * car.v * dt;
      if (car.x < PX + 12) { car.x = PX + 12; car.v *= -.3; } if (car.x > PX + PW - 12) { car.x = PX + PW - 12; car.v *= -.3; }
      if (car.y < PY + 12) { car.y = PY + 12; car.v *= -.3; } if (car.y > PY + PH - 12) { car.y = PY + PH - 12; car.v *= -.3; }
      for (const p of pads) { if (p.t > 0) p.t -= dt; else if (Math.hypot(p.x - car.x, p.y - car.y) < 16) { p.t = 6; car.boost = Math.min(100, car.boost + 45); api.beep(880, .05); boom(p.x, p.y, '#facc15', 6); } }
      // ball
      const dx = ball.x - car.x, dy = ball.y - car.y, d = Math.hypot(dx, dy) || 1;
      if (d < ball.r + 16) {
        const nx = dx / d, ny = dy / d, punt = car.air > 0 ? 2.2 : 1;
        ball.x = car.x + nx * (ball.r + 16); ball.y = car.y + ny * (ball.r + 16);
        const cvx = Math.cos(car.a) * car.v, cvy = Math.sin(car.a) * car.v;
        ball.vx = cvx * .9 + nx * Math.abs(car.v) * .6 * punt + nx * 60; ball.vy = cvy * .9 + ny * Math.abs(car.v) * .6 * punt + ny * 60;
        api.beep(punt > 1 ? 300 : 220, .05); if (punt > 1) boom(ball.x, ball.y, '#fff', 8);
      }
    }
    api.loop(dtms => {
      const dt = Math.min(.033, dtms / 1000);
      if (phase === 'play') {
        if (pause > 0) { pause -= dt; if (pause <= 0) kickoff(); }
        else {
          time -= dt;
          if (wait > 0) wait -= dt;
          cars.forEach((car, i) => stepCar(car, car.ai ? (wait > 0 ? { l: 0, r: 0, u: 0, d: 0, b: 0, aP: 0 } : ai(car, dt)) : (i ? K.p2 : K.p1), dt));
          // car-car
          const [A, B] = cars; const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1;
          if (d < 30) { const nx = dx / d, ny = dy / d, ov = (30 - d) / 2; A.x -= nx * ov; A.y -= ny * ov; B.x += nx * ov; B.y += ny * ov; A.v *= .6; B.v *= .6; }
          ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.vx -= ball.vx * Math.min(1, .7 * dt); ball.vy -= ball.vy * Math.min(1, .7 * dt);
          const inMouth = ball.y > GY1 && ball.y < GY2;
          if (ball.y < PY + ball.r) { ball.y = PY + ball.r; ball.vy = Math.abs(ball.vy) * .8; } if (ball.y > PY + PH - ball.r) { ball.y = PY + PH - ball.r; ball.vy = -Math.abs(ball.vy) * .8; }
          if (!inMouth) { if (ball.x < PX + ball.r) { ball.x = PX + ball.r; ball.vx = Math.abs(ball.vx) * .8; } if (ball.x > PX + PW - ball.r) { ball.x = PX + PW - ball.r; ball.vx = -Math.abs(ball.vx) * .8; } }
          else { if (ball.x < PX - 14) goal(1); else if (ball.x > PX + PW + 14) goal(0); }
          if (time <= 0) { if (score[0] !== score[1]) end(); else { msg = 'OVERTIME · next goal wins'; msgT = 2; time = 0; } }
        }
      }
      parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt; }); parts = parts.filter(p => p.t > 0);
      if (msgT > 0) msgT -= dt;
      K.clearPulses(); draw();
    });
    function goal(who) { score[who]++; api.score(score[0]); api.beep(who ? 200 : 1000, .3); boom(ball.x, ball.y, who ? '#f97316' : '#3b82f6', 24); msg = (who ? (mode === 2 ? 'Player 2' : 'Computer') : 'Player 1') + ' scores!'; msgT = 1.5; pause = 1.6; if (time <= 0) end(); }
    function end() { phase = 'over'; const w = score[0] > score[1] ? 'Player 1 wins!' : score[0] < score[1] ? (mode === 2 ? 'Player 2 wins!' : 'Computer wins') : 'Draw'; api.overlay(`<b>${w}</b>${score[0]} – ${score[1]}<br><small>any key / tap to play again</small>`); }
    function draw() {
      x.fillStyle = '#0f172a'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#166534'; x.fillRect(PX, PY, PW, PH);
      x.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 7; i++) if (i % 2) x.fillRect(PX + i * PW / 7, PY, PW / 7, PH);
      x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 2; x.strokeRect(PX, PY, PW, PH); x.beginPath(); x.moveTo(W / 2, PY); x.lineTo(W / 2, PY + PH); x.stroke(); x.beginPath(); x.arc(W / 2, PY + PH / 2, 50, 0, 7); x.stroke();
      x.fillStyle = '#0f172a'; x.fillRect(PX - 18, GY1, 18, GY2 - GY1); x.fillRect(PX + PW, GY1, 18, GY2 - GY1);
      x.strokeStyle = '#94a3b8'; x.lineWidth = 1; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(PX - 18, GY1 + i * 20); x.lineTo(PX, GY1 + i * 20); x.stroke(); x.beginPath(); x.moveTo(PX + PW, GY1 + i * 20); x.lineTo(PX + PW + 18, GY1 + i * 20); x.stroke(); }
      x.strokeStyle = '#3b82f6'; x.lineWidth = 3; x.strokeRect(PX - 18, GY1, 18, GY2 - GY1); x.strokeStyle = '#f97316'; x.strokeRect(PX + PW, GY1, 18, GY2 - GY1);
      pads.forEach(p => { x.save(); x.translate(p.x, p.y); x.rotate(Math.PI / 6); x.fillStyle = p.t > 0 ? 'rgba(250,204,21,.15)' : '#facc15'; x.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; x.lineTo(Math.cos(a) * 11, Math.sin(a) * 11); } x.closePath(); x.fill(); x.restore(); });
      x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.ellipse(ball.x + 3, ball.y + 4, ball.r, ball.r * .8, 0, 0, 7); x.fill();
      x.fillStyle = '#f8fafc'; x.beginPath(); x.arc(ball.x, ball.y, ball.r, 0, 7); x.fill(); x.strokeStyle = '#94a3b8'; x.lineWidth = 1.5; x.beginPath(); x.arc(ball.x, ball.y, ball.r - 3, 0, 7); x.stroke();
      cars.forEach(car => { const sc = car.air > 0 ? 1 + Math.sin(car.air / .45 * Math.PI) * .35 : 1; x.save(); x.translate(car.x, car.y); x.scale(sc, sc); x.translate(-car.x, -car.y); if (car.air > 0) { x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.ellipse(car.x, car.y + 8, 18, 10, 0, 0, 7); x.fill(); } RC.car(x, car.x, car.y, car.a, 30, 17, car.col); x.restore(); });
      parts.forEach(p => { x.globalAlpha = Math.max(0, p.t * 2); x.fillStyle = p.col; x.fillRect(p.x - 2, p.y - 2, 4, 4); }); x.globalAlpha = 1;
      x.fillStyle = 'rgba(0,0,0,.55)'; RC.rr(x, W / 2 - 70, 4, 140, 30, 8);
      T(x, `${score[0]}   ${fmtT(time)}   ${score[1]}`, W / 2, 26, 18, '#fff', 'center');
      cars.forEach((car, i) => { const bx = i ? W - 130 : 20; x.fillStyle = '#1e293b'; x.fillRect(bx, 12, 110, 10); x.fillStyle = car.col; x.fillRect(bx, 12, 110 * car.boost / 100, 10); T(x, 'BOOST', bx, 34, 10, '#94a3b8'); });
      if (msgT > 0) { x.fillStyle = 'rgba(0,0,0,.5)'; RC.rr(x, W / 2 - 150, H / 2 - 24, 300, 48, 10); T(x, msg, W / 2, H / 2 + 8, 22, '#fff', 'center'); }
    }
    reset();
  } },

/* ===== HOOP HEROES (inspired by Basketball Stars) ===== */
{ id: 'remix:hoop-heroes', title: 'Hoop Heroes', emoji: '🏀', cat: 'remix', colors: ['#7c2d12', '#fdba74'],
  help: 'Inspired by Basketball Stars. What\'s different: a glowing hot zone on the floor moves every 20 seconds and shots from it score 3, and holding Shift charges a power shot that can\'t be blocked. Controls: P1 WASD + Space (shoot / steal) + Shift, P2 arrows + Enter + right Shift. Press 1 or 2 to pick a mode.',
  run(stage, api) {
    const W = 600, H = 400, G = 340; const { c, x } = api.canvas(W, H);
    const K = K2(api, stage);
    const HOOPS = [{ x: 46, y: 186, dir: 1 }, { x: W - 46, y: 186, dir: -1 }]; // hoop[0] on left is attacked by P2, hoop[1] by P1
    let ps, ball, score, time, phase, mode, zone, zoneT, charge, power, msg, msgT, parts, shotClock;
    function reset() {
      ps = [mkP(200, G, 1), mkP(400, G, -1)]; ps[0].col = '#3b82f6'; ps[1].col = '#ef4444'; ps[0].hoop = HOOPS[1]; ps[1].hoop = HOOPS[0];
      ball = { x: W / 2, y: G - 60, vx: 0, vy: 0, r: 9, holder: null, shooter: null, fromZone: false, powered: false, free: 0 };
      score = [0, 0]; time = 60; phase = 'menu'; zone = { x: 380, w: 90 }; zoneT = 20; charge = [-1, -1]; power = [0, 0]; msg = ''; msgT = 0; parts = []; shotClock = 0;
      api.score(0); api.overlay(menuHtml('Hoop Heroes', 'hold Space then release on the green part of the meter'));
    }
    function start(m) { mode = m; ps[1].ai = m === 1; phase = 'play'; api.overlay(null); }
    K.any = key => { if (phase === 'menu') start(key === '2' ? 2 : 1); else if (phase === 'over') reset(); };
    api.onRestart(reset);
    function moveZone() { zone.x = 80 + rnd(W - 250); }
    function shoot(i, acc, powered) {
      const p = ps[i], h = p.hoop, TT = .95, g = 1500;
      let vx = (h.x - p.x) / TT, vy = (h.y - 4 - (p.y - p.h)) / TT - .5 * g * TT;
      const err = (1 - acc) * 220 * (Math.random() < .5 ? -1 : 1);
      vx += err * .6; vy += err * .4;
      if (powered) { vx *= 1.25; vy *= 1.05; }
      ball.holder = null; ball.shooter = p; ball.x = p.x + p.dir * 14; ball.y = p.y - p.h - 6; ball.vx = vx; ball.vy = vy; ball.fromZone = p.x > zone.x && p.x < zone.x + zone.w; ball.powered = powered; ball.free = .15;
      api.beep(powered ? 700 : 520, .06); p.cd = .4;
    }
    function ai(i, dt) {
      const p = ps[i], o = ps[1 - i], k = { l: 0, r: 0, u: 0, d: 0, a: 0, b: 0, aP: 0, bP: 0, uP: 0 };
      if (ball.holder === p) {
        const dist = Math.abs(p.hoop.x - p.x), inZone = p.x > zone.x + 10 && p.x < zone.x + zone.w - 10;
        const want = inZone || dist < 190 ? p.x : p.hoop.x - p.hoop.dir * 170;
        if (want > p.x + 6) k.r = 1; else if (want < p.x - 6) k.l = 1;
        if ((inZone || dist < 190) && Math.abs(o.x - p.x) > 40 && charge[i] < 0) k.aP = 1;
        if (charge[i] >= 0 && charge[i] > .45 + Math.random() * .15) { p.release = true; }
      } else if (ball.holder) { const want = ball.holder.x; if (want > p.x + 8) k.r = 1; else if (want < p.x - 8) k.l = 1; if (Math.abs(want - p.x) < 36 && Math.random() < .03) k.aP = 1; if (ball.holder.x > zone.x && Math.random() < .01) k.uP = 1; }
      else { if (ball.x > p.x + 8) k.r = 1; else if (ball.x < p.x - 8) k.l = 1; if (ball.y < G - 80 && Math.abs(ball.x - p.x) < 40 && Math.random() < .05) k.uP = 1; }
      if (ball.shooter === o && ball.y < G - 40 && Math.abs(ball.x - p.x) < 50 && Math.random() < .08) k.uP = 1;
      return k;
    }
    api.loop(dtms => {
      const dt = Math.min(.033, dtms / 1000);
      if (phase === 'play') {
        time -= dt; zoneT -= dt; if (zoneT <= 0) { zoneT = 20; moveZone(); msg = 'Hot zone moved!'; msgT = 1.2; api.beep(660, .08); }
        ps.forEach((p, i) => {
          const k = p.ai ? ai(i, dt) : (i ? K.p2 : K.p1);
          physSide(p, k, dt, { minX: 20, maxX: W - 20, top: 260, jump: 600 });
          if (p.cd > 0) p.cd -= dt;
          if (ball.holder === p) {
            if (k.b) power[i] = Math.min(1, power[i] + dt / .6); else if (charge[i] < 0) power[i] = Math.max(0, power[i] - dt);
            if (k.aP && charge[i] < 0) charge[i] = 0;
            else if (charge[i] >= 0) { charge[i] += dt / .9; const held = p.ai ? !p.release : k.a; if (!held || charge[i] > 1.2) { const t = Math.min(1, charge[i]) % 1; const acc = 1 - Math.min(1, Math.abs(t - .55) / .35); shoot(i, acc, power[i] >= 1); charge[i] = -1; power[i] = 0; p.release = false; } }
          } else {
            charge[i] = -1;
            if (!ball.holder && ball.free <= 0 && Math.hypot(ball.x - p.x, ball.y - (p.y - p.h / 2)) < p.h * .7 + ball.r) { ball.holder = p; ball.shooter = null; api.beep(400, .03); }
            if (ball.holder && ball.holder !== p && k.aP && p.cd <= 0 && Math.abs(ball.holder.x - p.x) < 40 && Math.abs(ball.holder.y - p.y) < 30) { p.cd = .8; if (Math.random() < .4) { ball.holder.slow = .5; ball.holder = p; msg = 'Steal!'; msgT = .8; api.beep(300, .1); } }
          }
        });
        if (ball.holder) { const p = ball.holder; ball.x = p.x + p.dir * 16; ball.y = p.y - p.h * .55; ball.vx = ball.vy = 0; }
        else {
          if (ball.free > 0) ball.free -= dt;
          ball.vy += 1500 * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt;
          if (ball.y > G - ball.r) { ball.y = G - ball.r; ball.vy = -Math.abs(ball.vy) * .6; ball.vx *= .85; if (Math.abs(ball.vy) < 40) { ball.vy = 0; } ball.shooter = null; }
          if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx) * .7; } if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx) * .7; }
          if (ball.y < ball.r) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }
          HOOPS.forEach((h, hi) => {
            // backboard
            const bbx = h.x - h.dir * 22; if (Math.abs(ball.x - bbx) < ball.r && ball.y > h.y - 60 && ball.y < h.y + 10) { ball.x = bbx + h.dir * ball.r; ball.vx = Math.abs(ball.vx) * .6 * h.dir; }
            // rim ends
            collideCircle(ball, h.x - 16, h.y, 2, .5); collideCircle(ball, h.x + 16, h.y, 2, .5);
            // score
            if (ball.vy > 0 && ball.py < h.y && ball.y >= h.y && Math.abs(ball.x - h.x) < 13) {
              const who = hi === 1 ? 0 : 1, pts = ball.fromZone ? 3 : 2; score[who] += pts; api.score(score[0]); api.beep(1000, .2); for (let i = 0; i < 16; i++) parts.push({ x: h.x, y: h.y, vx: (Math.random() - .5) * 260, vy: -Math.random() * 200, t: .6, col: ball.fromZone ? '#facc15' : '#fff' });
              msg = (who ? (mode === 2 ? 'Player 2' : 'Computer') : 'Player 1') + ` +${pts}`; msgT = 1; ball.fromZone = false;
            }
            // block
            if (!ball.powered && ball.shooter) ps.forEach(p => { if (p !== ball.shooter && !p.onG && Math.hypot(ball.x - p.x, ball.y - (p.y - p.h)) < p.w + ball.r) { ball.vx = -ball.vx * .5; ball.vy = Math.abs(ball.vy) * .3 + 100; ball.shooter = null; msg = 'Blocked!'; msgT = .8; api.beep(250, .1); } });
          });
          ball.py = ball.y;
        }
        if (time <= 0) { phase = 'over'; const w = score[0] > score[1] ? 'Player 1 wins!' : score[0] < score[1] ? (mode === 2 ? 'Player 2 wins!' : 'Computer wins') : 'Tie game'; api.overlay(`<b>${w}</b>${score[0]} – ${score[1]}<br><small>any key / tap to play again</small>`); }
      }
      parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt; p.t -= dt; }); parts = parts.filter(p => p.t > 0);
      if (msgT > 0) msgT -= dt;
      K.clearPulses(); draw();
    });
    function draw() {
      x.fillStyle = '#1c1917'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#292524'; for (let i = 0; i < 12; i++) x.fillRect(i * 50, 0, 25, G);
      x.fillStyle = '#b45309'; x.fillRect(0, G, W, H - G); x.fillStyle = '#92400e'; for (let i = 0; i < W; i += 40) x.fillRect(i, G, 20, H - G);
      const gl = .5 + Math.sin(performance.now() / 200) * .2; x.fillStyle = `rgba(250,204,21,${gl * .5})`; x.fillRect(zone.x, G - 4, zone.w, 8); x.fillStyle = 'rgba(250,204,21,.12)'; x.fillRect(zone.x, G - 120, zone.w, 120); T(x, '3PT', zone.x + zone.w / 2, G - 100, 12, '#facc15', 'center');
      HOOPS.forEach(h => { x.fillStyle = '#e5e7eb'; x.fillRect(h.x - h.dir * 24, h.y - 60, 4, 70); x.fillStyle = '#9ca3af'; x.fillRect(h.x - h.dir * 24 - (h.dir > 0 ? 0 : 0), h.y - 60, h.dir > 0 ? -18 : 18, 4); x.strokeStyle = '#f97316'; x.lineWidth = 3; x.beginPath(); x.moveTo(h.x - 16, h.y); x.lineTo(h.x + 16, h.y); x.stroke(); x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 1; for (let i = -14; i <= 14; i += 7) { x.beginPath(); x.moveTo(h.x + i, h.y); x.lineTo(h.x + i * .5, h.y + 22); x.stroke(); } });
      ps.forEach((p, i) => { drawBig(x, p, p.col, '#fcd9b6', true); if (charge[i] >= 0) { const t = Math.min(1, charge[i]) % 1; x.fillStyle = '#111'; x.fillRect(p.x - 25, p.y - p.h - 34, 50, 8); x.fillStyle = '#22c55e'; x.fillRect(p.x - 25 + 50 * .2, p.y - p.h - 34, 50 * .7 * .5, 8); x.fillStyle = '#fff'; x.fillRect(p.x - 25 + 50 * t - 1, p.y - p.h - 36, 3, 12); } if (power[i] > 0) { x.fillStyle = '#7c3aed'; x.fillRect(p.x - 25, p.y - p.h - 24, 50 * power[i], 4); } });
      x.fillStyle = '#f97316'; x.beginPath(); x.arc(ball.x, ball.y, ball.r, 0, 7); x.fill(); x.strokeStyle = '#7c2d12'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(ball.x - ball.r, ball.y); x.lineTo(ball.x + ball.r, ball.y); x.moveTo(ball.x, ball.y - ball.r); x.lineTo(ball.x, ball.y + ball.r); x.stroke();
      if (ball.powered && !ball.holder) { x.fillStyle = 'rgba(124,58,237,.5)'; x.beginPath(); x.arc(ball.x, ball.y, ball.r + 5, 0, 7); x.fill(); }
      parts.forEach(p => { x.globalAlpha = Math.max(0, p.t * 1.6); x.fillStyle = p.col; x.fillRect(p.x - 2, p.y - 2, 4, 4); }); x.globalAlpha = 1;
      x.fillStyle = 'rgba(0,0,0,.55)'; RC.rr(x, W / 2 - 80, 4, 160, 30, 8); T(x, `${score[0]}   ${fmtT(time)}   ${score[1]}`, W / 2, 26, 18, '#fff', 'center');
      T(x, 'P1', 14, 22, 12, '#3b82f6'); T(x, mode === 2 ? 'P2' : 'CPU', W - 14, 22, 12, '#ef4444', 'right');
      if (msgT > 0) T(x, msg, W / 2, 70, 20, '#facc15', 'center');
    }
    reset();
  } },

/* ===== BIG HEAD KICKOFF (inspired by Football Legends) ===== */
{ id: 'remix:bighead-kickoff', title: 'Big Head Kickoff', emoji: '⚽', cat: 'remix', colors: ['#14532d', '#86efac'],
  help: 'Inspired by Football Legends. What\'s different: a star drops every 20 seconds with a random power (ice ball, giant ball or mega-kick), and a draw goes to golden goal. Controls: P1 WASD + Space kick + Shift slide tackle, P2 arrows + Enter + right Shift. Press 1 or 2 to pick a mode.',
  run(stage, api) {
    const W = 600, H = 400, G = 340, GW = 34, GH = 110; const { c, x } = api.canvas(W, H);
    const K = K2(api, stage);
    let ps, ball, score, time, phase, mode, star, starT, powerName, powerT, mega, msg, msgT, parts, golden, pause, wait = 0;
    function reset() {
      ps = [mkP(150, G, 1, 24, 46), mkP(450, G, -1, 24, 46)]; ps[0].col = '#2563eb'; ps[1].col = '#dc2626';
      ball = { x: W / 2, y: G - 40, vx: 0, vy: 0, r: 12 }; score = [0, 0]; time = 90; phase = 'menu'; star = null; starT = 20; powerName = ''; powerT = 0; mega = null; msg = ''; msgT = 0; parts = []; golden = false; pause = 0;
      api.score(0); api.overlay(menuHtml('Big Head Kickoff', 'grab the falling stars for powers'));
    }
    function start(m) { mode = m; ps[1].ai = m === 1; phase = 'play'; wait = 1; api.overlay(null); }
    K.any = key => { if (phase === 'menu') start(key === '2' ? 2 : 1); else if (phase === 'over') reset(); };
    api.onRestart(reset);
    function kickoff() { wait = 1; ps[0].x = 150; ps[1].x = 450; ps.forEach(p => { p.y = p.gy; p.vx = p.vy = 0; p.slide = 0; }); ball.x = W / 2; ball.y = G - 40; ball.vx = ball.vy = 0; }
    function ai(i) {
      const p = ps[i], k = { l: 0, r: 0, u: 0, d: 0, a: 0, b: 0, aP: 0, bP: 0, uP: 0 }, goalX = 0;
      const behind = ball.x < p.x, want = star && Math.abs(star.x - p.x) < 150 && star.y > 200 ? star.x : (behind ? ball.x + 18 : ball.x + 40);
      if (want > p.x + 6) k.r = 1; else if (want < p.x - 6) k.l = 1;
      const d = Math.hypot(ball.x - p.x, ball.y - (p.y - 20));
      if (d < 44 && behind && Math.random() < .14) k.aP = 1;
      if (ball.y < G - 60 && Math.abs(ball.x - p.x) < 50 && p.onG && Math.random() < .08) k.uP = 1;
      if (Math.abs(ps[0].x - p.x) < 50 && Math.abs(ball.x - ps[0].x) < 30 && Math.random() < .02) k.bP = 1;
      return k;
    }
    function kick(p) {
      const d = Math.hypot(ball.x - p.x, ball.y - (p.y - 20));
      if (d > 46 + ball.r) return;
      const pw = (mega === p ? 2 : 1) * (powerName === 'ICE' ? 1.3 : 1);
      ball.vx = p.dir * 430 * pw + p.vx * .5; ball.vy = -(p.ks ? 160 : 330) * (mega === p ? 1.3 : 1);
      api.beep(mega === p ? 240 : 380, .06); for (let i = 0; i < 6; i++) parts.push({ x: ball.x, y: ball.y, vx: (Math.random() - .5) * 200, vy: -Math.random() * 150, t: .4, col: mega === p ? '#f43f5e' : '#fff' });
    }
    api.loop(dtms => {
      const dt = Math.min(.033, dtms / 1000);
      if (phase === 'play') {
        if (pause > 0) { pause -= dt; if (pause <= 0) kickoff(); }
        else {
          if (!golden) time -= dt; if (wait > 0) wait -= dt;
          starT -= dt; if (starT <= 0 && !star) { starT = 20; star = { x: 80 + rnd(W - 160), y: -20, vy: 0 }; }
          if (star) { star.vy += 300 * dt; star.y += star.vy * dt; if (star.y > G - 10) { star.y = G - 10; star.vy = 0; } }
          if (powerT > 0) { powerT -= dt; if (powerT <= 0) { powerName = ''; mega = null; ball.r = 12; } }
          ps.forEach((p, i) => {
            const k = p.ai ? (wait > 0 ? { l: 0, r: 0, u: 0, d: 0, a: 0, b: 0, aP: 0, bP: 0, uP: 0 } : ai(i)) : (i ? K.p2 : K.p1);
            if (p.slide > 0) { p.slide -= dt; p.x += p.dir * 380 * dt; p.x = clamp(p.x, 20, W - 20); const o = ps[1 - i]; if (Math.abs(o.x - p.x) < 24 && o.onG && !o.hit) { o.slow = .7; o.hit = true; api.beep(150, .1); } if (Math.hypot(ball.x - p.x, ball.y - p.y + 10) < 30) { ball.vx = p.dir * 300; ball.vy = -200; } }
            else { physSide(p, k, dt, { minX: 20, maxX: W - 20, top: p.ai ? 225 : 270, jump: 640 }); if (k.bP && p.onG && p.cd <= 0) { p.slide = .35; p.cd = 1; ps[1 - i].hit = false; } }
            if (p.cd > 0) p.cd -= dt;
            p.ks = k.d; if (k.aP) kick(p);
            if (star && Math.abs(star.x - p.x) < 24 && star.y > p.y - p.h - 10) {
              const r = rnd(3); powerName = ['ICE', 'GIANT', 'MEGA'][r]; powerT = 8; mega = r === 2 ? p : null; ball.r = r === 1 ? 26 : 12; star = null;
              msg = (r === 0 ? '❄ Ice ball!' : r === 1 ? '🎈 Giant ball!' : (i ? 'P2' : 'P1') + ' 💥 mega-kick!'); msgT = 1.5; api.beep(900, .12);
            }
            // body bounce with ball
            collideCircle(ball, p.x, p.y - p.h + 2, p.w * .62, .7) && (ball.vx += p.vx * .4);
            collideCircle(ball, p.x, p.y - p.h * .4, p.w * .55, .5);
          });
          const fr = powerName === 'ICE' ? .02 : .5, rest = powerName === 'ICE' ? .92 : .6;
          ball.vy += 1300 * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt;
          if (ball.y > G - ball.r) { ball.y = G - ball.r; ball.vy = -Math.abs(ball.vy) * rest; ball.vx -= ball.vx * Math.min(1, fr * 6 * dt + .02); if (Math.abs(ball.vy) < 30) ball.vy = 0; }
          ball.vx -= ball.vx * Math.min(1, fr * dt);
          if (ball.y < ball.r) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }
          const bar = G - GH;
          [0, 1].forEach(side => { const gx = side ? W - GW : GW; const inG = ball.y > bar; // crossbar
            if (!inG && Math.abs(ball.y - bar) < ball.r && (side ? ball.x > W - GW - 4 : ball.x < GW + 4)) { ball.vy = ball.vy < 0 ? Math.abs(ball.vy) * .5 : ball.vy; ball.y = bar - ball.r; }
            if (side ? ball.x > W - ball.r : ball.x < ball.r) { if (inG) goal(side ? 0 : 1); else { ball.x = side ? W - ball.r : ball.r; ball.vx = -ball.vx * .7; } }
          });
          if (ball.x < 0 && ball.y <= bar) { ball.x = ball.r; ball.vx = Math.abs(ball.vx) * .7; } if (ball.x > W && ball.y <= bar) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx) * .7; }
          if (time <= 0 && !golden) { if (score[0] !== score[1]) end(); else { golden = true; msg = '⭐ GOLDEN GOAL'; msgT = 2.5; api.beep(700, .2); } }
        }
      }
      parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt; p.t -= dt; }); parts = parts.filter(p => p.t > 0);
      if (msgT > 0) msgT -= dt;
      K.clearPulses(); draw();
    });
    function goal(who) { if (pause > 0) return; score[who]++; api.score(score[0]); api.beep(who ? 200 : 1000, .3); for (let i = 0; i < 24; i++) parts.push({ x: ball.x, y: ball.y, vx: (Math.random() - .5) * 400, vy: -Math.random() * 300, t: .8, col: who ? '#dc2626' : '#2563eb' }); msg = 'GOAL! ' + (who ? (mode === 2 ? 'Player 2' : 'Computer') : 'Player 1'); msgT = 1.5; pause = 1.8; if (golden || time <= 0) { pause = 0; end(); } }
    function end() { phase = 'over'; const w = score[0] > score[1] ? 'Player 1 wins!' : (mode === 2 ? 'Player 2 wins!' : 'Computer wins'); api.overlay(`<b>${w}</b>${score[0]} – ${score[1]}<br><small>any key / tap to play again</small>`); }
    function draw() {
      const sky = x.createLinearGradient(0, 0, 0, G); sky.addColorStop(0, '#0c4a6e'); sky.addColorStop(1, '#38bdf8'); x.fillStyle = sky; x.fillRect(0, 0, W, G);
      x.fillStyle = '#334155'; for (let i = 0; i < 10; i++) x.fillRect(i * 60, 200 + (i % 3) * 12, 60, G - 200); x.fillStyle = 'rgba(255,255,255,.25)'; for (let i = 0; i < 40; i++) x.fillRect(8 + i * 15, 220 + (i % 5) * 20, 5, 5);
      x.fillStyle = '#15803d'; x.fillRect(0, G, W, H - G); x.fillStyle = '#166534'; for (let i = 0; i < W; i += 60) x.fillRect(i, G, 30, H - G);
      x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 2; x.beginPath(); x.moveTo(W / 2, G); x.lineTo(W / 2, H); x.stroke();
      [0, 1].forEach(side => { const gx = side ? W - GW : 0; x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 1; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(gx, G - GH + i * GH / 6); x.lineTo(gx + GW, G - GH + i * GH / 6); x.stroke(); x.beginPath(); x.moveTo(gx + i * GW / 6, G - GH); x.lineTo(gx + i * GW / 6, G); x.stroke(); } x.fillStyle = '#f8fafc'; x.fillRect(side ? W - GW - 3 : GW, G - GH, 3, GH); x.fillRect(gx, G - GH - 3, GW, 3); });
      if (star) { x.save(); x.translate(star.x, star.y); x.rotate(performance.now() / 300); x.fillStyle = '#facc15'; x.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 6 : 14, a = i * Math.PI / 5; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill(); x.restore(); }
      ps.forEach(p => { if (p.slide > 0) { x.save(); x.translate(p.x, p.y); x.rotate(p.dir * 1.2); x.translate(-p.x, -p.y); drawBig(x, p, p.col, '#fcd9b6', true); x.restore(); } else drawBig(x, p, p.col, '#fcd9b6', true); if (mega === p) { x.fillStyle = 'rgba(244,63,94,.6)'; x.beginPath(); x.arc(p.x, p.y - p.h, p.w * .62 + 5, 0, 7); x.fill(); } });
      x.fillStyle = powerName === 'ICE' ? '#bae6fd' : '#f8fafc'; x.beginPath(); x.arc(ball.x, ball.y, ball.r, 0, 7); x.fill(); x.fillStyle = '#111'; for (let i = 0; i < 5; i++) { const a = i * 1.26 + ball.x / 30; x.beginPath(); x.arc(ball.x + Math.cos(a) * ball.r * .5, ball.y + Math.sin(a) * ball.r * .5, ball.r * .22, 0, 7); x.fill(); }
      parts.forEach(p => { x.globalAlpha = Math.max(0, p.t * 1.5); x.fillStyle = p.col; x.fillRect(p.x - 2, p.y - 2, 4, 4); }); x.globalAlpha = 1;
      x.fillStyle = 'rgba(0,0,0,.55)'; RC.rr(x, W / 2 - 80, 4, 160, 30, 8); T(x, `${score[0]}   ${golden ? 'GOLDEN' : fmtT(time)}   ${score[1]}`, W / 2, 26, 18, '#fff', 'center');
      if (powerT > 0) { x.fillStyle = '#facc15'; x.fillRect(W / 2 - 60, 38, 120 * powerT / 8, 4); T(x, powerName, W / 2, 54, 11, '#facc15', 'center'); }
      if (msgT > 0) T(x, msg, W / 2, 100, 24, '#fff', 'center');
    }
    reset();
  } },

/* ===== TINY CUP (inspired by A Small World Cup) ===== */
{ id: 'remix:tiny-cup', title: 'Tiny Cup', emoji: '🏆', cat: 'remix', colors: ['#166534', '#fde047'],
  help: 'Inspired by A Small World Cup. What\'s different: hold up or down while kicking to curl the ball, and you play a 4-round knockout ladder where each computer team is smarter than the last. Controls: P1 WASD + Space kick, P2 arrows + Enter (2-player is a one-off final). Press 1 or 2 to pick a mode.',
  run(stage, api) {
    const W = 600, H = 400, G = 350, GW = 30, GH = 80; const { c, x } = api.canvas(W, H);
    const K = K2(api, stage);
    const ROUNDS = ['Round of 16', 'Quarter-final', 'Semi-final', 'Final'];
    const TEAMS = [['#ef4444', 'Red Rovers'], ['#f97316', 'Orange Owls'], ['#a855f7', 'Purple Pumas'], ['#eab308', 'Gold Gulls']];
    let blobs, ball, score, time, phase, mode, round, total, msg, msgT, parts, pause, golden, wins, wait = 0;
    const mkB = (px, team, dir, col, you) => ({ x: px, y: G - 14, vx: 0, vy: 0, r: 14, team, dir, col, you, onG: true, wob: Math.random() * 6, kickT: 0, cd: 0 });
    function setup() {
      const oc = mode === 2 ? '#ef4444' : TEAMS[round][0];
      blobs = [mkB(140, 0, 1, '#3b82f6', true), mkB(60, 0, 1, '#60a5fa', false), mkB(460, 1, -1, oc, mode === 2), mkB(540, 1, -1, oc, false)];
      ball = { x: W / 2, y: G - 60, vx: 0, vy: 0, r: 9, curl: 0, curlT: 0 }; wait = 1.2; score = [0, 0]; time = mode === 2 ? 60 : 45; golden = false; pause = 0;
    }
    function reset() { phase = 'menu'; round = 0; total = 0; wins = 0; mode = 1; msg = ''; msgT = 0; parts = []; setup(); api.score(0); api.overlay(menuHtml('Tiny Cup', 'win 4 rounds to lift the cup · hold ↑/↓ while kicking to curl')); }
    function start(m) { mode = m; setup(); phase = 'play'; api.overlay(null); msg = mode === 2 ? 'Friendly final' : ROUNDS[round] + ' vs ' + TEAMS[round][1]; msgT = 2; }
    K.any = key => { if (phase === 'menu') start(key === '2' ? 2 : 1); else if (phase === 'over') reset(); else if (phase === 'next') { round++; setup(); phase = 'play'; api.overlay(null); msg = ROUNDS[round] + ' vs ' + TEAMS[round][1]; msgT = 2; } };
    api.onRestart(reset);
    function kickoff() { wait = 1.2; blobs[0].x = 140; blobs[1].x = 60; blobs[2].x = 460; blobs[3].x = 540; blobs.forEach(b => { b.y = G - b.r; b.vx = b.vy = 0; }); ball.x = W / 2; ball.y = G - 60; ball.vx = ball.vy = 0; ball.curl = 0; }
    function kick(b, k) {
      if (b.cd > 0) return; const d = Math.hypot(ball.x - b.x, ball.y - b.y); if (d > b.r + ball.r + 12) return;
      b.cd = .35; b.kickT = .2; const dirx = b.dir;
      ball.vx = dirx * (b.you ? 470 : 300 + 120 * (mode === 2 ? .6 : [.45, .6, .75, .92][round])) + b.vx * .3; ball.vy = -260;
      ball.curl = k.u ? -520 : k.d ? 420 : 0; ball.curlT = 1.1;
      api.beep(k.u || k.d ? 560 : 400, .06); for (let i = 0; i < 5; i++) parts.push({ x: ball.x, y: ball.y, vx: (Math.random() - .5) * 200, vy: -Math.random() * 120, t: .4, col: '#fff' });
    }
    function ai(b, i) {
      const skill = mode === 2 ? .6 : [.45, .6, .75, .92][round];
      const k = { l: 0, r: 0, u: 0, d: 0, a: 0, b: 0, aP: 0, bP: 0, uP: 0 };
      const ownGoalX = b.team ? W : 0, striker = b.team ? i === 2 : i === 0;
      let want;
      if (striker || Math.abs(ball.x - ownGoalX) < 200) { want = ball.x + (b.team ? 16 : -16); } else want = ownGoalX + (b.team ? -70 : 70) + (ball.x - W / 2) * .2;
      if (Math.random() < skill * .9) { if (want > b.x + 5) k.r = 1; else if (want < b.x - 5) k.l = 1; }
      const behind = b.team ? ball.x < b.x : ball.x > b.x;
      if (behind && Math.hypot(ball.x - b.x, ball.y - b.y) < 34 && Math.random() < .25 + skill * .5) { k.aP = 1; if (Math.random() < skill) k.u = Math.random() < .5 ? 1 : 0; }
      if (ball.y < G - 50 && Math.abs(ball.x - b.x) < 30 && b.onG && Math.random() < skill * .1) k.uP = 1;
      return k;
    }
    function stepBlob(b, k, dt) {
      const acc = 1900, top = 230;
      const ax = (k.r - k.l) * acc; if (ax) { b.vx += ax * dt; b.dir = ax > 0 ? 1 : -1; } else b.vx -= b.vx * Math.min(1, 8 * dt);
      b.vx = clamp(b.vx, -top, top);
      if (k.uP && b.onG) { b.vy = -420; b.onG = false; }
      b.vy += 1500 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y > G - b.r) { b.y = G - b.r; b.vy = 0; b.onG = true; }
      b.x = clamp(b.x, 12, W - 12); b.wob += dt * (2 + Math.abs(b.vx) / 40);
      if (b.cd > 0) b.cd -= dt; if (b.kickT > 0) b.kickT -= dt;
      if (k.aP) kick(b, k);
      collideCircle(ball, b.x, b.y, b.r, .75);
    }
    api.loop(dtms => {
      const dt = Math.min(.033, dtms / 1000);
      if (phase === 'play') {
        if (pause > 0) { pause -= dt; if (pause <= 0) kickoff(); }
        else {
          if (!golden) time -= dt;
          if (wait > 0) wait -= dt;
          blobs.forEach((b, i) => stepBlob(b, b.you ? (b.team ? K.p2 : K.p1) : (wait > 0 ? { l: 0, r: 0, u: 0, d: 0, aP: 0, uP: 0 } : ai(b, i)), dt));
          for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) { const a = blobs[i], b = blobs[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1; if (d < a.r + b.r) { const ov = (a.r + b.r - d) / 2, nx = dx / d, ny = dy / d; a.x -= nx * ov; b.x += nx * ov; a.vx -= nx * 60; b.vx += nx * 60; } }
          if (ball.curlT > 0) { ball.curlT -= dt; ball.vy += ball.curl * dt; }
          ball.vy += 1100 * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.vx -= ball.vx * Math.min(1, .4 * dt);
          if (ball.y > G - ball.r) { ball.y = G - ball.r; ball.vy = -Math.abs(ball.vy) * .55; ball.vx *= .9; if (Math.abs(ball.vy) < 30) ball.vy = 0; ball.curlT = 0; }
          if (ball.y < ball.r) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }
          const bar = G - GH;
          if (ball.x < ball.r) { if (ball.y > bar) goal(1); else { ball.x = ball.r; ball.vx = Math.abs(ball.vx) * .7; } }
          if (ball.x > W - ball.r) { if (ball.y > bar) goal(0); else { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx) * .7; } }
          if (ball.y < bar + ball.r && ball.y > bar - ball.r && (ball.x < GW || ball.x > W - GW) && ball.vy < 0) { ball.vy = Math.abs(ball.vy) * .5; }
          if (time <= 0 && !golden) { if (score[0] !== score[1]) end(); else { golden = true; msg = '⭐ GOLDEN GOAL'; msgT = 2; api.beep(700, .2); } }
        }
      }
      parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; p.t -= dt; }); parts = parts.filter(p => p.t > 0);
      if (msgT > 0) msgT -= dt;
      K.clearPulses(); draw();
    });
    function goal(who) { if (pause > 0) return; score[who]++; if (!who) { total++; api.score(total); } api.beep(who ? 200 : 1000, .3); for (let i = 0; i < 20; i++) parts.push({ x: ball.x, y: ball.y, vx: (Math.random() - .5) * 400, vy: -Math.random() * 300, t: .8, col: who ? blobs[2].col : '#3b82f6' }); msg = who ? (mode === 2 ? 'Player 2 scores' : TEAMS[round][1] + ' score') : 'GOAL!'; msgT = 1.4; pause = 1.6; if (golden || time <= 0) { pause = 0; end(); } }
    function end() {
      if (mode === 2) { phase = 'over'; api.overlay(`<b>${score[0] > score[1] ? 'Player 1 wins!' : 'Player 2 wins!'}</b>${score[0]} – ${score[1]}<br><small>any key / tap to play again</small>`); return; }
      if (score[0] > score[1]) { wins++; if (round === 3) { phase = 'over'; api.overlay(`<b>🏆 Champions!</b>You won the Tiny Cup · ${total} goals<br><small>any key / tap to play again</small>`); } else { phase = 'next'; api.overlay(`<b>Through!</b>${score[0]} – ${score[1]} · next: ${ROUNDS[round + 1]}<br><small>any key / tap to continue</small>`); } }
      else { phase = 'over'; api.overlay(`<b>Knocked out</b>${score[0]} – ${score[1]} in the ${ROUNDS[round]} · ${total} goals<br><small>any key / tap to try again</small>`); }
    }
    function drawBlob(b) {
      x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(b.x, G + 2, b.r, 4, 0, 0, 7); x.fill();
      x.strokeStyle = b.col; x.lineWidth = 3; const legA = Math.sin(b.wob) * (Math.abs(b.vx) > 20 ? 8 : 2);
      x.beginPath(); x.moveTo(b.x - 5, b.y + b.r - 4); x.lineTo(b.x - 6 - legA, b.y + b.r + 6); x.moveTo(b.x + 5, b.y + b.r - 4); x.lineTo(b.x + 6 + legA, b.y + b.r + 6); x.stroke();
      const kickA = b.kickT > 0 ? b.dir * 10 : 0; x.beginPath(); x.moveTo(b.x + b.dir * b.r * .8, b.y); x.lineTo(b.x + b.dir * (b.r + 8) + kickA, b.y + 4 - Math.abs(kickA)); x.stroke();
      const sq = 1 + Math.sin(b.wob * 2) * .06; x.fillStyle = b.col; x.beginPath(); x.ellipse(b.x, b.y, b.r * sq, b.r / sq, 0, 0, 7); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.arc(b.x + b.dir * 5, b.y - 4, 4, 0, 7); x.fill(); x.fillStyle = '#111'; x.beginPath(); x.arc(b.x + b.dir * 6, b.y - 4, 2, 0, 7); x.fill();
      if (b.you) { x.fillStyle = '#fff'; x.beginPath(); x.moveTo(b.x, b.y - b.r - 14); x.lineTo(b.x - 5, b.y - b.r - 22); x.lineTo(b.x + 5, b.y - b.r - 22); x.closePath(); x.fill(); }
    }
    function draw() {
      x.fillStyle = '#7dd3fc'; x.fillRect(0, 0, W, G); x.fillStyle = '#fff'; [[80, 60, 30], [300, 40, 40], [480, 90, 25]].forEach(([cx, cy, r]) => { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.arc(cx + r, cy + 5, r * .8, 0, 7); x.arc(cx - r, cy + 6, r * .7, 0, 7); x.fill(); });
      x.fillStyle = '#a3a3a3'; x.fillRect(0, G - 150, W, 60); x.fillStyle = '#737373'; for (let i = 0; i < 24; i++) x.fillRect(i * 25 + 5, G - 140, 15, 10); x.fillStyle = '#525252'; x.fillRect(0, G - 90, W, 8);
      x.fillStyle = '#22c55e'; x.fillRect(0, G - 82, W, H - G + 82); x.fillStyle = '#16a34a'; for (let i = 0; i < W; i += 50) x.fillRect(i, G - 82, 25, H - G + 82);
      x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 2; x.beginPath(); x.moveTo(W / 2, G - 82); x.lineTo(W / 2, H); x.stroke();
      [0, 1].forEach(side => { const gx = side ? W - GW : 0; x.strokeStyle = 'rgba(255,255,255,.4)'; x.lineWidth = 1; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(gx, G - GH + i * GH / 5); x.lineTo(gx + GW, G - GH + i * GH / 5); x.stroke(); x.beginPath(); x.moveTo(gx + i * GW / 5, G - GH); x.lineTo(gx + i * GW / 5, G); x.stroke(); } x.fillStyle = '#f8fafc'; x.fillRect(side ? W - GW - 3 : GW, G - GH, 3, GH); x.fillRect(gx, G - GH - 3, GW, 3); });
      blobs.forEach(drawBlob);
      if (ball.curlT > 0) { x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 2; x.beginPath(); x.arc(ball.x, ball.y, ball.r + 4, 0, Math.PI * 1.3); x.stroke(); }
      x.fillStyle = '#f8fafc'; x.beginPath(); x.arc(ball.x, ball.y, ball.r, 0, 7); x.fill(); x.fillStyle = '#111'; for (let i = 0; i < 4; i++) { const a = i * 1.57 + ball.x / 20; x.beginPath(); x.arc(ball.x + Math.cos(a) * ball.r * .5, ball.y + Math.sin(a) * ball.r * .5, 2, 0, 7); x.fill(); }
      parts.forEach(p => { x.globalAlpha = Math.max(0, p.t * 1.5); x.fillStyle = p.col; x.fillRect(p.x - 2, p.y - 2, 4, 4); }); x.globalAlpha = 1;
      x.fillStyle = 'rgba(0,0,0,.55)'; RC.rr(x, W / 2 - 90, 4, 180, 30, 8); T(x, `${score[0]}   ${golden ? 'GOLDEN' : fmtT(time)}   ${score[1]}`, W / 2, 26, 18, '#fff', 'center');
      T(x, mode === 2 ? 'Friendly' : ROUNDS[round], W / 2, 50, 11, '#fff', 'center');
      T(x, 'YOU', 14, 22, 12, '#3b82f6'); T(x, mode === 2 ? 'P2' : TEAMS[round][1], W - 14, 22, 12, blobs[2].col, 'right');
      if (msgT > 0) T(x, msg, W / 2, 110, 22, '#fff', 'center');
    }
    reset();
  } }

);
})();
