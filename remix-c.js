/* ===================== REMIX BATCH C: driving =====================
   Six original driving games inspired by popular web games. Own code, own
   art, own names; each `help` says what the inspiration was and what's new.
   Everything lives inside this IIFE so nothing leaks into global scope.   */
(() => {
const T = RC.text, rr = RC.rr, lerp = RC.lerp, PAL = RC.PALETTE;
const sec = dt => dt / 1000;
const pad2 = n => (n < 10 ? '0' : '') + n;
const fmtT = ms => { ms = Math.max(0, ms); const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60, h = Math.floor(ms / 10) % 100; return `${m}:${pad2(s)}.${pad2(h)}`; };

/* ---------------------------------------------------------------------
   SIDE-VIEW STUNT ENGINE — hand-made levels, two wheels joined by an axle
   (Flip Trail Moto, Wobble Wagon)
   Level terrain is a list of pieces: [type, length, param]
     flat / hill(amp) / up(height) / down(height) / gap / seesaw / bridge / spikes / bump(h)
   --------------------------------------------------------------------- */
function sideRig(stage, api, o) {
  const W = 560, H = 360, STEP = 10, BASE = 240, DEEP = 3000;
  const bike = !!o.bike, R = bike ? 11 : 12, WB = bike ? 50 : 62, G = 1500, TOP = bike ? 420 : 330, ACC = bike ? 780 : 640, ROT = bike ? 7 : 5;
  const { c, x } = api.canvas(W, H); const k = RC.keys(api, stage);
  let hs, seesaws, bridges, gaps, spikes, cps, finishX, A, B, spinA, spinB, cam, lvl, time, score, alive, started, done, msg, msgT, puffs, rotAcc, airT, flips, cpIdx, respawnT, slow, charge, lastAng, levelTime;
  const L = () => o.levels[lvl];

  function build() {
    hs = []; seesaws = []; bridges = []; gaps = []; spikes = []; cps = [];
    let y = BASE, xw = 0;
    const push = v => { hs.push(v); xw += STEP; };
    for (let i = 0; i < 20; i++) push(BASE);
    for (const [type, len, p] of L().terrain) {
      const n = Math.max(1, Math.round(len / STEP)), x0 = xw, y0 = y;
      if (type === 'flat') for (let i = 0; i < n; i++) push(y);
      else if (type === 'hill') for (let i = 0; i < n; i++) push(y - Math.sin(i / n * Math.PI) * (p || 60));
      else if (type === 'bump') for (let i = 0; i < n; i++) push(y - Math.sin(i / n * Math.PI) * (p || 25));
      else if (type === 'up') { for (let i = 0; i < n; i++) push(y - (p || 60) * (1 - Math.cos(i / n * Math.PI)) / 2); y -= (p || 60); }
      else if (type === 'down') { for (let i = 0; i < n; i++) push(y + (p || 60) * (1 - Math.cos(i / n * Math.PI)) / 2); y += (p || 60); }
      else if (type === 'gap') { gaps.push({ x0, x1: x0 + n * STEP }); for (let i = 0; i < n; i++) push(y); }
      else if (type === 'seesaw') { seesaws.push({ x0, x1: x0 + n * STEP, cx: x0 + n * STEP / 2, y, ang: 0, w: 0 }); for (let i = 0; i < n; i++) push(y); }
      else if (type === 'bridge') { const planks = []; for (let i = 0; i < n; i++) { planks.push({ x0: x0 + i * STEP, t: 0, broken: false }); push(y); } bridges.push({ x0, x1: x0 + n * STEP, planks }); }
      else if (type === 'spikes') { spikes.push({ x0, x1: x0 + n * STEP, y }); for (let i = 0; i < n; i++) push(y); }
      else if (type === 'cp') { cps.push(xw); }
      else for (let i = 0; i < n; i++) push(y);
      void y0;
    }
    finishX = xw; for (let i = 0; i < 40; i++) push(y);
    if (!cps.length) cps.push(120);
  }
  const inRange = (wx, r) => wx >= r.x0 && wx <= r.x1;
  function ground(wx) {
    for (const g of gaps) if (inRange(wx, g)) return DEEP;
    for (const b of bridges) if (inRange(wx, b)) { const p = b.planks[Math.min(b.planks.length - 1, Math.floor((wx - b.x0) / STEP))]; if (p.broken) return DEEP; }
    for (const s of seesaws) if (inRange(wx, s)) return s.y - 6 + Math.tan(s.ang) * (wx - s.cx);
    const i = clamp(Math.floor(wx / STEP), 0, hs.length - 2), f = clamp(wx / STEP - i, 0, 1);
    return hs[i] + (hs[i + 1] - hs[i]) * f;
  }
  function place(px) { const gy = ground(px) - R; A = { x: px - WB / 2, y: gy, vx: 0, vy: 0, g: 0 }; B = { x: px + WB / 2, y: gy, vx: 0, vy: 0, g: 0 }; rotAcc = 0; airT = 0; lastAng = null; }
  function loadLevel(i) {
    lvl = i; build(); cpIdx = 0; place(cps[0]); spinA = spinB = 0; cam = { x: 0, y: BASE - H * .6 }; levelTime = 0; flips = 0; alive = true; done = false; msg = ''; msgT = 0; puffs = []; respawnT = 0; slow = false; charge = 100;
    seesaws.forEach(s => { s.ang = 0; s.w = 0; }); bridges.forEach(b => b.planks.forEach(p => { p.t = 0; p.broken = false; }));
    started = false;
    api.overlay(`<b>${o.title}</b>Level ${i + 1} of ${o.levels.length} · ${L().name}<br><small>any key to ride</small>`);
  }
  function reset() { score = 0; time = 0; api.score(0); loadLevel(0); }
  function begin() { if (done && lvl >= o.levels.length - 1) { reset(); return; } if (done) { loadLevel(lvl + 1); return; } if (!started) { started = true; api.overlay(null); } }
  api.onKey(begin); api.onTap(begin); api.onRestart(reset);
  function crash(why) {
    if (!alive) return; alive = false; api.beep(90, .4); respawnT = 900; msg = why + '  +3s'; msgT = 1200; levelTime += 3000;
    for (let i = 0; i < 12; i++) puffs.push({ x: (A.x + B.x) / 2, y: (A.y + B.y) / 2, vx: (Math.random() - .5) * 260, vy: -60 - Math.random() * 200, t: 700, col: i % 2 ? '#f97316' : '#e5e7eb' });
  }
  function contact(w, h, drive) {
    const gy = ground(w.x); w.g = 0;
    if (gy >= DEEP) return 0;
    if (w.y + R * .1 < gy - R) return 0;
    const sl = (ground(w.x + 3) - ground(w.x - 3)) / 6, len = Math.hypot(1, sl), tx = 1 / len, ty = sl / len, nx = ty, ny = -tx;
    w.y = gy - R; w.g = 1;
    let vt = w.vx * tx + w.vy * ty, vn = w.vx * nx + w.vy * ny; if (vn < 0) vn = 0;
    if (started && alive && !done) { if (k.u || k.t) vt += ACC * drive * h; else if (k.d) vt -= ACC * .8 * h; }
    vt *= 1 - .5 * h; vt = clamp(vt, -170, TOP);
    w.vx = tx * vt + nx * vn; w.vy = ty * vt + ny * vn;
    for (const s of seesaws) if (inRange(w.x, s)) s.w += (w.x - s.cx) * .00045 * h * 60;
    for (const b of bridges) if (inRange(w.x, b)) { const p = b.planks[Math.min(b.planks.length - 1, Math.floor((w.x - b.x0) / STEP))]; p.t += h; if (p.t > .45) { p.broken = true; if (Math.random() < .5) puffs.push({ x: w.x, y: gy, vx: (Math.random() - .5) * 80, vy: 40, t: 500, col: '#a16207' }); } }
    for (const s of spikes) if (inRange(w.x, s) && w.y > s.y - R - 4) crash('SPIKED');
    return vt;
  }
  function physics(h) {
    for (const w of [A, B]) { w.vy += G * h; w.x += w.vx * h; w.y += w.vy * h; }
    const inAir = !A.g && !B.g;
    if (inAir && started && alive) {
      const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1, px = dy / d, py = -dx / d;
      const w = ((B.vx - A.vx) * px + (B.vy - A.vy) * py) / WB, wt = ROT * (k.u || k.t ? -1 : k.d ? 1 : 0), dw = (wt - w) * Math.min(1, h * 12), im = dw * WB / 2;
      B.vx += px * im; B.vy += py * im; A.vx -= px * im; A.vy -= py * im;
    }
    let vA = 0, vB = 0;
    for (let it = 0; it < 2; it++) {
      vA = contact(A, h, 1); vB = contact(B, h, bike ? .5 : .9);
      const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, diff = (d - WB) / 2;
      A.x += ux * diff; A.y += uy * diff; B.x -= ux * diff; B.y -= uy * diff;
      const rel = (B.vx - A.vx) * ux + (B.vy - A.vy) * uy; A.vx += ux * rel / 2; A.vy += uy * rel / 2; B.vx -= ux * rel / 2; B.vy -= uy * rel / 2;
    }
    spinA += (vA || A.vx) / R * h; spinB += (vB || B.vx) / R * h;
    seesaws.forEach(s => { s.w -= s.ang * 2.2 * h; s.w *= Math.pow(.6, h); s.ang = clamp(s.ang + s.w * h * 8, -.45, .45); });
    const ang = Math.atan2(B.y - A.y, B.x - A.x);
    if (!A.g && !B.g) { airT += h; if (lastAng != null) rotAcc += RC.ang(ang - lastAng); }
    else {
      if (o.flips && Math.abs(rotAcc) > 5.5) { const n = Math.floor(Math.abs(rotAcc) / 6.2) || 1; flips += n; levelTime -= 1000 * n; score += 150 * n; msg = `${n > 1 ? n + 'x ' : ''}FLIP!  −${n}s`; msgT = 1200; api.beep(1100, .12); }
      else if (o.flips && airT > .8) { score += 50; msg = 'BIG AIR  +50'; msgT = 800; }
      rotAcc = 0; airT = 0;
    }
    lastAng = ang;
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, upx = Math.sin(ang), upy = -Math.cos(ang), hh = R + (bike ? 26 : 22);
    const hx = mx + upx * hh, hy = my + upy * hh;
    if (started && alive && !done && ground(hx) < DEEP && hy > ground(hx)) crash(bike ? 'WIPEOUT' : 'FLIPPED');
    if (started && alive && !done && my > BASE + 900) crash('FELL');
  }
  api.loop(dt0 => {
    let dt = dt0;
    if (o.slowmo) { slow = (k.sh || k.sp) && charge > 0 && started && alive && !done; if (slow) { charge -= 28 * sec(dt0); dt *= .35; } else charge = Math.min(100, charge + 12 * sec(dt0)); }
    if (started && !done) {
      if (alive) {
        const n = Math.ceil(dt / 8), h = dt / 1000 / n;
        for (let i = 0; i < n; i++) physics(h);
        levelTime += dt;
        const mx = (A.x + B.x) / 2;
        while (cpIdx + 1 < cps.length && mx > cps[cpIdx + 1]) { cpIdx++; msg = 'CHECKPOINT'; msgT = 900; api.beep(880, .08); }
        if (mx > finishX) {
          done = true; const bonus = Math.max(0, 60000 - levelTime); score += 1000 + Math.floor(bonus / 100); time += levelTime; api.score(score);
          const last = lvl >= o.levels.length - 1;
          api.overlay(`<b>${last ? '🏆 All levels done!' : '🏁 Level clear!'}</b>${fmtT(levelTime)}${o.flips ? ` · ${flips} flips` : ''} · ${score} pts<br><small>${last ? 'any key to start over' : 'any key for the next level'}</small>`);
        }
        if ((k.u || k.t) && (A.g || B.g) && Math.random() < .35) { const ang = Math.atan2(B.y - A.y, B.x - A.x); puffs.push({ x: A.x - Math.cos(ang) * 8, y: A.y - 4, vx: -60 + (Math.random() - .5) * 40, vy: -30 - Math.random() * 40, t: 500, col: 'rgba(120,120,120,.6)' }); }
      } else { respawnT -= dt0; if (respawnT <= 0) { alive = true; place(cps[cpIdx]); seesaws.forEach(s => { s.ang = 0; s.w = 0; }); bridges.forEach(b => b.planks.forEach(p => { p.t = 0; p.broken = false; })); } }
      if (msgT > 0) msgT -= dt0;
    }
    puffs.forEach(p => { p.x += p.vx * sec(dt); p.y += p.vy * sec(dt); p.vy += 300 * sec(dt); p.t -= dt; }); puffs = puffs.filter(p => p.t > 0);
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    cam.x += (mx - W * .38 - cam.x) * .15; cam.y += (my - H * .58 - cam.y) * .08;
    draw();
  });
  function draw() {
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, o.sky[0]); g.addColorStop(1, o.sky[1]); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = o.far; x.beginPath(); x.moveTo(0, H); for (let i = 0; i <= W; i += 8) { const wx = i + cam.x * .3; x.lineTo(i, BASE - cam.y * .3 - 70 - 55 * Math.abs(Math.sin(wx / 240)) - 20 * Math.abs(Math.sin(wx / 70))); } x.lineTo(W, H); x.fill();
    /* terrain (skip gaps and broken planks) */
    let pen = false; x.beginPath();
    for (let wx = Math.floor(cam.x / 4) * 4 - 4; wx <= cam.x + W + 8; wx += 4) {
      const gy = ground(wx);
      if (gy >= DEEP) { if (pen) { x.lineTo(wx - 4 - cam.x, H + 20); x.closePath(); pen = false; } continue; }
      if (!pen) { x.moveTo(wx - cam.x, H + 20); pen = true; }
      x.lineTo(wx - cam.x, gy - cam.y);
    }
    if (pen) { x.lineTo(W + 8, H + 20); x.closePath(); }
    x.fillStyle = o.ground; x.fill(); x.strokeStyle = o.top; x.lineWidth = 6; x.lineJoin = 'round'; x.stroke();
    /* seesaw pivots, bridges, spikes, flags */
    for (const s of seesaws) { const sx = s.cx - cam.x, sy = s.y - cam.y; x.fillStyle = '#57534e'; x.beginPath(); x.moveTo(sx - 12, sy + 26); x.lineTo(sx + 12, sy + 26); x.lineTo(sx, sy - 4); x.fill(); x.save(); x.translate(sx, sy - 6); x.rotate(s.ang); x.fillStyle = '#a16207'; x.fillRect(-(s.x1 - s.x0) / 2, -3, s.x1 - s.x0, 7); x.restore(); }
    for (const b of bridges) for (const p of b.planks) { if (p.broken) continue; const sx = p.x0 - cam.x, sy = ground(p.x0 + 1) - cam.y; x.fillStyle = p.t > .25 ? '#dc2626' : '#b45309'; x.fillRect(sx + 1, sy - 3, STEP - 2, 8); }
    for (const s of spikes) { x.fillStyle = '#e5e7eb'; for (let wx = s.x0; wx < s.x1; wx += 12) { const sx = wx - cam.x, sy = s.y - cam.y; x.beginPath(); x.moveTo(sx, sy + 2); x.lineTo(sx + 12, sy + 2); x.lineTo(sx + 6, sy - 14); x.fill(); } }
    cps.forEach((cx, i) => { const sx = cx - cam.x, sy = ground(cx) - cam.y; x.fillStyle = '#e5e7eb'; x.fillRect(sx - 1, sy - 46, 3, 46); x.fillStyle = i <= cpIdx ? '#22c55e' : '#f59e0b'; x.beginPath(); x.moveTo(sx + 2, sy - 46); x.lineTo(sx + 26, sy - 38); x.lineTo(sx + 2, sy - 30); x.fill(); });
    { const sx = finishX - cam.x, sy = ground(finishX) - cam.y; x.fillStyle = '#e5e7eb'; x.fillRect(sx - 2, sy - 70, 4, 70); for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#fff'; x.fillRect(sx + 2 + i * 6, sy - 70 + j * 6, 6, 6); } }
    puffs.forEach(p => { x.fillStyle = p.col; x.beginPath(); x.arc(p.x - cam.x, p.y - cam.y, 3 + (1 - p.t / 700) * 4, 0, 7); x.fill(); });
    /* vehicle */
    const ang = Math.atan2(B.y - A.y, B.x - A.x), mx = (A.x + B.x) / 2 - cam.x, my = (A.y + B.y) / 2 - cam.y;
    const wheel = (w, sp) => { const sx = w.x - cam.x, sy = w.y - cam.y; x.fillStyle = '#1c1917'; x.beginPath(); x.arc(sx, sy, R, 0, 7); x.fill(); x.fillStyle = '#a8a29e'; x.beginPath(); x.arc(sx, sy, R * .5, 0, 7); x.fill(); x.strokeStyle = '#e7e5e4'; x.lineWidth = 2; x.beginPath(); for (let i = 0; i < 3; i++) { const a = sp + i * Math.PI * 2 / 3; x.moveTo(sx, sy); x.lineTo(sx + Math.cos(a) * R * .5, sy + Math.sin(a) * R * .5); } x.stroke(); };
    if (alive) {
      x.save(); x.translate(mx, my); x.rotate(ang);
      if (bike) {
        x.strokeStyle = o.car; x.lineWidth = 4; x.lineCap = 'round'; x.beginPath(); x.moveTo(-WB / 2, 0); x.lineTo(-8, -18); x.lineTo(14, -18); x.lineTo(WB / 2, 0); x.moveTo(-8, -18); x.lineTo(2, -6); x.lineTo(WB / 2, 0); x.stroke();
        x.fillStyle = '#1f2937'; rr(x, -12, -24, 26, 8, 3);
        x.fillStyle = '#fbbf24'; x.beginPath(); x.arc(4, -36, 7, 0, 7); x.fill();
        x.strokeStyle = '#fbbf24'; x.lineWidth = 4; x.beginPath(); x.moveTo(2, -30); x.lineTo(-6, -18); x.moveTo(2, -28); x.lineTo(18, -22); x.stroke();
      } else {
        x.fillStyle = o.car; rr(x, -WB / 2 - 6, -R - 18, WB + 12, 18, 5);
        x.fillStyle = 'rgba(0,0,0,.35)'; rr(x, -WB * .2, -R - 32, WB * .5, 15, 3);
        x.fillStyle = '#fde68a'; x.beginPath(); x.arc(WB * .05, -R - 24, 4.5, 0, 7); x.fill();
        x.fillStyle = '#fef08a'; x.fillRect(WB / 2 + 3, -R - 14, 3, 5);
      }
      x.restore();
      wheel(A, spinA); wheel(B, spinB);
    }
    /* HUD */
    T(x, `LEVEL ${lvl + 1}/${o.levels.length}`, 12, 24, 15, '#fff'); T(x, fmtT(levelTime), 12, 44, 14, '#fde047');
    T(x, score + ' pts', W - 12, 24, 16, '#fff', 'right');
    if (o.flips) T(x, `${flips} flips`, W - 12, 44, 13, '#e2e8f0', 'right');
    if (o.slowmo) { x.fillStyle = 'rgba(0,0,0,.45)'; rr(x, W / 2 - 60, 12, 120, 14, 4); x.fillStyle = slow ? '#a78bfa' : '#38bdf8'; rr(x, W / 2 - 58, 14, 116 * charge / 100, 10, 3); T(x, 'SLOW-MO (shift)', W / 2, 40, 10, '#e2e8f0', 'center'); }
    if (msgT > 0) T(x, msg, W / 2, 80, 20, '#fde047', 'center');
    if (slow) { x.fillStyle = 'rgba(167,139,250,.12)'; x.fillRect(0, 0, W, H); }
  }
  reset();
}

/* ---------------------------------------------------------------------
   TOP-DOWN CAR PHYSICS — velocity vector split into forward / sideways
   --------------------------------------------------------------------- */
function stepCar(cr, gas, brake, steer, hand, h, P) {
  const fx = Math.cos(cr.a), fy = Math.sin(cr.a), lx = -fy, ly = fx;
  let vf = cr.vx * fx + cr.vy * fy, vl = cr.vx * lx + cr.vy * ly;
  if (gas) vf += P.acc * h; if (brake) vf -= P.brake * h;
  vf *= Math.pow(P.drag, h); vf = clamp(vf, -P.top * .4, P.top);
  const grip = hand ? P.grip * .25 : P.grip;
  vl *= Math.pow(1 - grip, h * 60);
  if (hand) vf *= Math.pow(.985, h * 60);
  cr.a += steer * P.turn * h * clamp(vf / 120, -1, 1) * (hand ? 1.35 : 1);
  cr.vx = fx * vf + lx * vl; cr.vy = fy * vf + ly * vl;
  cr.x += cr.vx * h; cr.y += cr.vy * h;
  cr.vf = vf; cr.vl = vl; cr.drift = Math.abs(Math.atan2(vl, Math.max(40, Math.abs(vf)))) * 180 / Math.PI;
}

/* ---------------------------------------------------------------------
   SLIDE SYNDICATE — drift arena (inspired by Drift Hunters)
   --------------------------------------------------------------------- */
function driftArena(stage, api) {
  const W = 600, H = 400, ROUND = 90; const { c, x } = api.canvas(W, H); const k = RC.keys(api, stage);
  const P = { acc: 190, brake: 220, top: 300, drag: .55, grip: .12, turn: 3.2 };
  const zones = [{ x: 60, y: 60, w: 200, h: 120 }, { x: 340, y: 220, w: 200, h: 120 }];
  const pit = { x: W / 2 - 40, y: H - 46, w: 80, h: 36 };
  const blocks = [{ x: 270, y: 90, w: 60, h: 60 }, { x: 120, y: 260, w: 90, h: 40 }, { x: 420, y: 60, w: 40, h: 90 }];
  let me, time, score, combo, comboT, wear, bald, marks, msg, msgT, started, over, smoke, pitT;
  function reset() { me = { x: W / 2, y: H / 2, a: -Math.PI / 2, vx: 0, vy: 0, vf: 0, vl: 0, drift: 0 }; time = ROUND; score = 0; combo = 1; comboT = 0; wear = 0; bald = false; marks = []; msg = ''; msgT = 0; started = false; over = false; smoke = []; pitT = 0; api.score(0); api.overlay('<b>Slide Syndicate</b>90 seconds · drift for points<br><small>any key to start</small>'); }
  function begin() { if (over) { reset(); return; } if (!started) { started = true; api.overlay(null); } }
  api.onKey(begin); api.onTap(begin); api.onRestart(reset);
  const hitRect = (r, px, py, m = 10) => px > r.x - m && px < r.x + r.w + m && py > r.y - m && py < r.y + r.h + m;
  function bounce(r) {
    const cx = clamp(me.x, r.x, r.x + r.w), cy = clamp(me.y, r.y, r.y + r.h), dx = me.x - cx, dy = me.y - cy, d = Math.hypot(dx, dy) || 1;
    me.x = cx + dx / d * 12; me.y = cy + dy / d * 12; const dot = me.vx * dx / d + me.vy * dy / d; if (dot < 0) { me.vx -= 1.6 * dot * dx / d; me.vy -= 1.6 * dot * dy / d; }
    me.vx *= .6; me.vy *= .6; combo = 1; comboT = 0; wear = Math.min(100, wear + 6); api.beep(150, .15); msg = 'WALL – combo lost'; msgT = 800;
  }
  api.loop(dt => {
    const h = sec(dt);
    if (started && !over) {
      const Pk = bald ? { ...P, grip: .03, turn: 2.2 } : P;
      stepCar(me, k.u || k.t, k.d, k.r - k.l, k.sp || k.sh, h, Pk);
      if (me.x < 14) { me.x = 14; me.vx = Math.abs(me.vx) * .5; bounce({ x: -30, y: -30, w: 30, h: H + 60 }); }
      if (me.x > W - 14) { me.x = W - 14; bounce({ x: W, y: -30, w: 30, h: H + 60 }); }
      if (me.y < 14) { me.y = 14; bounce({ x: -30, y: -30, w: W + 60, h: 30 }); }
      if (me.y > H - 14) { me.y = H - 14; bounce({ x: -30, y: H, w: W + 60, h: 30 }); }
      for (const b of blocks) if (hitRect(b, me.x, me.y)) bounce(b);
      const speed = Math.hypot(me.vx, me.vy), drifting = me.drift > 14 && speed > 70;
      if (drifting) {
        comboT += dt; combo = 1 + Math.floor(comboT / 2000);
        const inZone = zones.some(z => hitRect(z, me.x, me.y, 0));
        score += me.drift * speed * h * .012 * combo * (inZone ? 2 : 1);
        wear = Math.min(100, wear + me.drift * h * .18);
        if (!bald && wear >= 100) { bald = true; msg = 'TYRES GONE – find the pit'; msgT = 1600; api.beep(200, .3); }
        marks.push({ x: me.x, y: me.y, a: me.a }); if (marks.length > 900) marks.shift();
        if (Math.random() < .5) smoke.push({ x: me.x - Math.cos(me.a) * 10, y: me.y - Math.sin(me.a) * 10, t: 600, r: 3 });
      } else { if (comboT > 0) comboT = Math.max(0, comboT - dt * 1.5); if (comboT === 0) combo = 1; }
      if (hitRect(pit, me.x, me.y, 0) && speed < 40) { pitT += dt; if (pitT > 800) { wear = 0; bald = false; pitT = 0; msg = 'FRESH TYRES'; msgT = 900; api.beep(900, .1); } } else pitT = 0;
      time -= h; if (msgT > 0) msgT -= dt;
      api.score(Math.floor(score));
      if (time <= 0) { time = 0; over = true; api.overlay(`<b>Time up!</b>${Math.floor(score)} pts<br><small>any key to go again</small>`); }
    }
    smoke.forEach(s => { s.t -= dt; s.r += 8 * h; }); smoke = smoke.filter(s => s.t > 0);
    draw();
  });
  function draw() {
    x.fillStyle = '#374151'; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(255,255,255,.06)'; x.lineWidth = 1; for (let i = 0; i < W; i += 40) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); } for (let j = 0; j < H; j += 40) { x.beginPath(); x.moveTo(0, j); x.lineTo(W, j); x.stroke(); }
    zones.forEach(z => { x.fillStyle = 'rgba(250,204,21,.13)'; x.fillRect(z.x, z.y, z.w, z.h); x.strokeStyle = '#facc15'; x.setLineDash([8, 6]); x.lineWidth = 2; x.strokeRect(z.x, z.y, z.w, z.h); x.setLineDash([]); T(x, '2× ZONE', z.x + z.w / 2, z.y + z.h / 2 + 5, 14, 'rgba(250,204,21,.7)', 'center'); });
    x.fillStyle = '#1e293b'; x.fillRect(pit.x, pit.y, pit.w, pit.h); x.strokeStyle = '#38bdf8'; x.lineWidth = 2; x.strokeRect(pit.x, pit.y, pit.w, pit.h); T(x, 'PIT', pit.x + pit.w / 2, pit.y + 23, 13, '#38bdf8', 'center');
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 3; marks.forEach(m => { x.beginPath(); x.moveTo(m.x - Math.sin(m.a) * 5, m.y + Math.cos(m.a) * 5); x.lineTo(m.x - Math.sin(m.a) * 5 - Math.cos(m.a) * 2, m.y + Math.cos(m.a) * 5 - Math.sin(m.a) * 2); x.moveTo(m.x + Math.sin(m.a) * 5, m.y - Math.cos(m.a) * 5); x.lineTo(m.x + Math.sin(m.a) * 5 - Math.cos(m.a) * 2, m.y - Math.cos(m.a) * 5 - Math.sin(m.a) * 2); x.stroke(); });
    blocks.forEach(b => { x.fillStyle = '#ef4444'; rr(x, b.x, b.y, b.w, b.h, 4); x.fillStyle = '#fff'; for (let i = 0; i < b.w; i += 16) x.fillRect(b.x + i, b.y + b.h - 6, 8, 6); });
    smoke.forEach(s => { x.fillStyle = `rgba(226,232,240,${s.t / 600 * .35})`; x.beginPath(); x.arc(s.x, s.y, s.r, 0, 7); x.fill(); });
    RC.car(x, me.x, me.y, me.a, 26, 14, bald ? '#9ca3af' : '#f43f5e', { brake: k.d });
    T(x, Math.ceil(time) + 's', W / 2, 26, 22, time < 10 ? '#f87171' : '#fff', 'center');
    T(x, Math.floor(score) + ' pts', 12, 24, 18, '#fde047'); if (combo > 1) T(x, `×${combo} combo`, 12, 44, 14, '#fb923c');
    x.fillStyle = 'rgba(0,0,0,.45)'; rr(x, W - 132, 12, 120, 14, 4); x.fillStyle = wear > 80 ? '#ef4444' : wear > 50 ? '#f59e0b' : '#22c55e'; rr(x, W - 130, 14, 116 * wear / 100, 10, 3); T(x, 'TYRE WEAR', W - 12, 40, 10, '#e2e8f0', 'right');
    if (Math.floor(me.drift) > 14) T(x, Math.floor(me.drift) + '°', me.x, me.y - 22, 12, '#fff', 'center');
    if (msgT > 0) T(x, msg, W / 2, 70, 18, '#fde047', 'center');
  }
  reset();
}

/* ---------------------------------------------------------------------
   LOW POLY LAPS — time trial with checkpoints, a ghost, boost pads and a
   speed tunnel (inspired by PolyTrack)
   --------------------------------------------------------------------- */
function polyLaps(stage, api) {
  const W = 600, H = 400; const { c, x } = api.canvas(W, H); const k = RC.keys(api, stage);
  const pts = [[80, 90], [220, 60], [380, 70], [520, 120], [540, 250], [470, 340], [330, 320], [250, 250], [160, 300], [70, 240]];
  const path = RC.spline(pts, 12), N = path.length, TW = 30;
  const P = { acc: 240, brake: 260, top: 340, drag: .5, grip: .35, turn: 3.6 };
  const cpN = 4, cpIdxs = Array.from({ length: cpN }, (_, i) => Math.floor(N * i / cpN));
  const tunnel = { i0: Math.floor(N * .55), i1: Math.floor(N * .68) };
  const pads = [Math.floor(N * .2), Math.floor(N * .42), Math.floor(N * .86)].map(i => ({ i, off: (i % 2 ? 1 : -1) * 10 }));
  const at = (i, off = 0) => { const p = path[((i % N) + N) % N]; return { x: p.x - Math.sin(p.a) * off, y: p.y + Math.cos(p.a) * off, a: p.a }; };
  let me, idx, cp, lapT, best, ghost, rec, ghostF, laps, boost, started, msg, msgT, inTun, particles;
  function reset() { const s = at(0); me = { x: s.x, y: s.y, a: s.a, vx: 0, vy: 0, vf: 0, vl: 0, drift: 0 }; idx = 0; cp = 0; lapT = 0; best = 0; ghost = null; rec = []; ghostF = 0; laps = 0; boost = 0; started = false; msg = ''; msgT = 0; inTun = false; particles = []; api.score(0); api.overlay('<b>Low Poly Laps</b>Hit every checkpoint · beat your ghost<br><small>any key to start</small>'); }
  function begin() { if (!started) { started = true; api.overlay(null); } }
  api.onKey(begin); api.onTap(begin); api.onRestart(reset);
  api.loop(dt => {
    const h = sec(dt);
    if (started) {
      const n = RC.nearest(path, me.x, me.y, idx); idx = n.i;
      inTun = idx >= tunnel.i0 && idx <= tunnel.i1;
      if (inTun) { const tgt = at(idx + 3); const want = Math.atan2(tgt.y - me.y, tgt.x - me.x); me.a += RC.ang(want - me.a) * Math.min(1, h * 10); const v = Math.max(Math.hypot(me.vx, me.vy), 380); me.vx = Math.cos(me.a) * v; me.vy = Math.sin(me.a) * v; me.x += me.vx * h; me.y += me.vy * h; me.drift = 0; if (Math.random() < .7) particles.push({ x: me.x, y: me.y, t: 400, col: '#a78bfa' }); }
      else {
        const off = n.d > TW; const Pk = off ? { ...P, top: 120, drag: .08 } : (boost > 0 ? { ...P, top: 420, acc: 420 } : P);
        stepCar(me, k.u || k.t, k.d, k.r - k.l, k.sp || k.sh, h, Pk);
        if (off && Math.random() < .4) particles.push({ x: me.x, y: me.y, t: 300, col: '#65a30d' });
      }
      me.x = clamp(me.x, 4, W - 4); me.y = clamp(me.y, 4, H - 4);
      for (const p of pads) { const q = at(p.i, p.off); if (Math.hypot(q.x - me.x, q.y - me.y) < 14 && boost <= 0) { boost = 1100; api.beep(1000, .08); } }
      if (boost > 0) { boost -= dt; if (Math.random() < .6) particles.push({ x: me.x - Math.cos(me.a) * 10, y: me.y - Math.sin(me.a) * 10, t: 350, col: '#60a5fa' }); }
      lapT += dt; rec.push({ x: me.x, y: me.y, a: me.a });
      const nextCp = (cp + 1) % cpN;
      if (Math.abs(idx - cpIdxs[nextCp]) < 6 || (nextCp === 0 && idx < 6 && cp === cpN - 1)) {
        if (nextCp === 0) {
          laps++; if (!best || lapT < best) { best = lapT; ghost = rec; msg = laps > 1 ? 'NEW BEST LAP!' : 'LAP 1 DONE'; api.score(Math.max(1, Math.floor(100000 / (best / 100)))); } else msg = 'LAP ' + fmtT(lapT);
          msgT = 1400; api.beep(880, .12); lapT = 0; rec = []; ghostF = 0;
        } else { msg = 'CHECKPOINT'; msgT = 600; api.beep(700, .06); }
        cp = nextCp;
      }
      if (ghost) ghostF++;
      if (msgT > 0) msgT -= dt;
    }
    particles.forEach(p => p.t -= dt); particles = particles.filter(p => p.t > 0);
    draw();
  });
  function draw() {
    x.fillStyle = '#86efac'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#4ade80'; for (let i = 0; i < 14; i++) { x.beginPath(); x.moveTo((i * 131) % W, (i * 71) % H); x.lineTo((i * 131) % W + 60, (i * 71) % H + 20); x.lineTo((i * 131) % W + 20, (i * 71) % H + 50); x.fill(); }
    x.lineCap = 'round'; x.lineJoin = 'round';
    x.strokeStyle = '#a3a3a3'; x.lineWidth = TW * 2 + 8; x.beginPath(); path.forEach((p, i) => i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y)); x.closePath(); x.stroke();
    x.strokeStyle = '#525252'; x.lineWidth = TW * 2; x.stroke();
    x.strokeStyle = '#7c3aed'; x.lineWidth = TW * 2; x.beginPath(); for (let i = tunnel.i0; i <= tunnel.i1; i++) { const p = path[i % N]; i === tunnel.i0 ? x.moveTo(p.x, p.y) : x.lineTo(p.x, p.y); } x.stroke();
    x.strokeStyle = '#c4b5fd'; x.lineWidth = 3; for (let i = tunnel.i0; i <= tunnel.i1; i += 4) { const p = at(i, -TW), q = at(i, TW); x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(q.x, q.y); x.stroke(); }
    cpIdxs.forEach((ci, i) => { if (i === 0) return; const p = at(ci, -TW), q = at(ci, TW); x.strokeStyle = i === (cp + 1) % cpN ? '#facc15' : 'rgba(255,255,255,.35)'; x.lineWidth = 4; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(q.x, q.y); x.stroke(); });
    { const st = path[0]; x.save(); x.translate(st.x, st.y); x.rotate(st.a); for (let i = 0; i < Math.floor(TW / 4); i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#fff' : '#111'; x.fillRect(-4 + j * 4, -TW + i * 8, 4, 8); } x.restore(); }
    pads.forEach(p => { const q = at(p.i, p.off); x.save(); x.translate(q.x, q.y); x.rotate(q.a); x.fillStyle = '#facc15'; x.beginPath(); x.moveTo(-8, -7); x.lineTo(2, -7); x.lineTo(10, 0); x.lineTo(2, 7); x.lineTo(-8, 7); x.lineTo(0, 0); x.fill(); x.restore(); });
    particles.forEach(p => { x.fillStyle = p.col; x.globalAlpha = p.t / 400; x.fillRect(p.x - 2, p.y - 2, 4, 4); x.globalAlpha = 1; });
    if (ghost && ghost[ghostF]) { const g = ghost[ghostF]; x.globalAlpha = .45; RC.car(x, g.x, g.y, g.a, 20, 11, '#e2e8f0'); x.globalAlpha = 1; }
    RC.car(x, me.x, me.y, me.a, 20, 11, boost > 0 ? '#60a5fa' : '#f43f5e', { brake: k.d });
    T(x, fmtT(lapT), 12, 24, 18, '#fff'); T(x, best ? 'best ' + fmtT(best) : 'no lap yet', 12, 44, 12, '#fde047');
    T(x, `lap ${laps + 1}`, W - 12, 24, 16, '#fff', 'right'); T(x, `cp ${cp}/${cpN}`, W - 12, 44, 12, '#e2e8f0', 'right');
    if (inTun) T(x, 'SPEED TUNNEL', W / 2, 70, 18, '#c4b5fd', 'center'); else if (msgT > 0) T(x, msg, W / 2, 70, 18, '#fde047', 'center');
  }
  reset();
}

/* ---------------------------------------------------------------------
   PSEUDO-3D LANE ENGINE — Two-Way Trouble, Gridlock Getaway
   z is distance ahead in road units; lanes are -1..1 across the road.
   --------------------------------------------------------------------- */
function lanes3d(stage, api, o) {
  const W = 480, H = 360, HZ = 118, K = 42, ZMAX = 520, MAX = 125, LANES = o.lanes, ONC = o.oncoming || 0;
  const { c, x } = api.canvas(W, H); const k = RC.keys(api, stage);
  const laneU = l => (l + .5) / LANES * 2 - 1;
  const sc = z => K / (z + K), sy = z => HZ + (H - HZ) * sc(z), rw = z => W * .46 * sc(z);
  let cars, items, px, speed, dist, score, alive, started, lives, fuel, night, curve, curveT, spawnT, flash, msg, msgT, combo, comboT, chase, chaseT, slowT, escaped;
  const curveX = z => curve * Math.pow(z / ZMAX, 2) * 210;
  const lx = (u, z) => W / 2 + (u - px) * rw(z) + curveX(z);
  function reset() { cars = []; items = []; px = laneU(LANES - 1); speed = 0; dist = 0; score = 0; alive = true; started = false; lives = o.lives || 0; fuel = 100; night = false; curve = 0; curveT = 0; spawnT = 0; flash = 0; msg = ''; msgT = 0; combo = 0; comboT = 0; chase = false; chaseT = 0; slowT = 0; escaped = 0; api.score(0); api.overlay(`<b>${o.title}</b><small>${o.intro}</small>`); }
  function begin() { if (!alive) { reset(); return; } if (!started) { started = true; api.overlay(null); } }
  api.onKey(begin); api.onTap(begin); api.onRestart(reset);
  function over(t) { alive = false; api.beep(100, .5); api.overlay(`<b>${t}</b>${Math.floor(dist)} m · ${score + Math.floor(dist)} pts<br><small>any key to retry</small>`); }
  function spawn() {
    const l = rnd(LANES), onc = l < ONC;
    if (cars.some(cr => Math.abs(cr.lane - l) < .6 && cr.z > ZMAX - 90)) return;
    cars.push({ lane: l, tgt: l, z: ZMAX, v: onc ? -(55 + Math.random() * 35) : 30 + Math.random() * 40, col: PAL[rnd(9)], onc, passed: false, tT: 1500 + rnd(3000) });
  }
  function hit(cr) {
    flash = 900; speed *= .3; cr.z += 30; px += px > cr.lane ? .3 : -.3;
    if (o.police) {
      if (chase) { over('BUSTED!'); return; }
      chase = true; chaseT = 15000; slowT = 0; msg = 'POLICE! Keep above 60 for 15 s'; msgT = 2000; api.beep(500, .3);
    } else {
      lives--; api.beep(110, .4); msg = lives > 0 ? `CRASH – ${lives} left` : ''; msgT = 1300; combo = 0;
      if (lives <= 0) over('Wrecked');
    }
  }
  api.loop(dt => {
    const s = sec(dt);
    if (started && alive) {
      const frac = speed / MAX;
      px += (k.r - k.l) * 1.5 * s * Math.max(.4, frac); px = clamp(px, -1.05, 1.05);
      if (k.u || k.t) speed += MAX / 2.5 * s; else if (k.d) speed -= MAX / 1.2 * s; else speed -= MAX / 5 * s;
      speed = clamp(speed, 0, MAX);
      curveT -= dt; if (curveT <= 0) { curveT = 3000 + rnd(4000); curve = (Math.random() - .5) * 2 * (Math.random() < .3 ? 0 : 1); }
      px -= curve * frac * frac * .25 * s;
      dist += speed * s * .7;
      spawnT -= dt; if (spawnT <= 0) { spawnT = (o.dense ? 420 : 700) + rnd(o.dense ? 300 : 500); spawn(); if (o.fuel && Math.random() < .25) items.push({ lane: rnd(LANES), z: ZMAX }); }
      for (const cr of cars) {
        cr.z += (cr.v - speed) * s;
        if (o.laneChange && !cr.onc) { cr.tT -= dt; if (cr.tT <= 0) { cr.tT = 2500 + rnd(4000); const nl = clamp(cr.lane + (Math.random() < .5 ? -1 : 1), ONC, LANES - 1); if (!cars.some(q => q !== cr && Math.round(q.lane) === nl && Math.abs(q.z - cr.z) < 60)) cr.tgt = nl; } cr.lane += clamp(cr.tgt - cr.lane, -1, 1) * 1.1 * s; }
        if (!cr.onc) for (const q of cars) if (q !== cr && !q.onc && Math.abs(q.lane - cr.lane) < .6 && q.z > cr.z && q.z - cr.z < 28) cr.v = Math.min(cr.v, q.v);
        const dl = Math.abs(laneU(cr.lane) - px);
        if (!cr.passed && cr.z < 0) {
          cr.passed = true;
          if (dl > .5 && dl < 1.0 && speed > MAX * .4) { const pts = 25 * (1 + combo); score += pts; combo++; comboT = 3000; msg = `CLOSE CALL  +${pts}`; msgT = 800; api.beep(900, .06); }
          if (o.oncomingBonus && !cr.onc && px < laneU(ONC - 1) + .3 && speed > MAX * .5) { score += 100; msg = 'WRONG-SIDE OVERTAKE  +100'; msgT = 1000; api.beep(1100, .08); }
        }
        if (flash <= 0 && Math.abs(cr.z) < 14 && dl < .5) hit(cr);
      }
      cars = cars.filter(cr => cr.z > -60 && cr.z < ZMAX + 5);
      for (const it of items) { it.z -= speed * s; if (!it.got && Math.abs(it.z) < 12 && Math.abs(laneU(it.lane) - px) < .4) { it.got = true; fuel = Math.min(100, fuel + 35); msg = 'FUEL  +35'; msgT = 900; api.beep(950, .08); } }
      items = items.filter(it => !it.got && it.z > -20);
      if (o.fuel) { fuel -= (3.5 + frac * 5) * s; if (fuel <= 0) { fuel = 0; over('Out of fuel!'); } }
      if (o.nightAt && !night && dist > o.nightAt) { night = true; msg = 'NIGHT FALLS'; msgT = 1500; }
      if (chase) { chaseT -= dt; if (speed < MAX * .48) { slowT += dt; if (slowT > 2000) over('BUSTED!'); } else slowT = Math.max(0, slowT - dt); if (chaseT <= 0) { chase = false; escaped++; score += 500; msg = 'ESCAPED  +500'; msgT = 1500; api.beep(1200, .15); } }
      if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
      if (flash > 0) flash -= dt; if (msgT > 0) msgT -= dt;
      api.score(score + Math.floor(dist));
    }
    draw();
  });
  function sprite(cr) {
    const z = Math.max(0, cr.z), scl = sc(z), w = 92 * scl, h = w * .55, cx = lx(laneU(cr.lane), z), cy = sy(z);
    if (w < 3) return;
    x.fillStyle = '#111'; x.fillRect(cx - w * .48, cy - h * .3, w * .18, h * .32); x.fillRect(cx + w * .3, cy - h * .3, w * .18, h * .32);
    x.fillStyle = cr.police ? '#1e293b' : cr.col; rr(x, cx - w * .45, cy - h * .85, w * .9, h * .8, w * .07);
    x.fillStyle = 'rgba(0,0,0,.4)'; rr(x, cx - w * .3, cy - h * 1.15, w * .6, h * .4, w * .05);
    if (cr.onc) { x.fillStyle = night ? '#fef9c3' : '#fde68a'; x.fillRect(cx - w * .4, cy - h * .6, w * .16, h * .16); x.fillRect(cx + w * .24, cy - h * .6, w * .16, h * .16); if (night) { x.fillStyle = 'rgba(254,249,195,.18)'; x.beginPath(); x.arc(cx, cy - h * .5, w * .6, 0, 7); x.fill(); } }
    else { x.fillStyle = night ? '#ff3b3b' : '#b91c1c'; x.fillRect(cx - w * .4, cy - h * .6, w * .16, h * .16); x.fillRect(cx + w * .24, cy - h * .6, w * .16, h * .16); }
    if (cr.police) { x.fillStyle = Math.floor(performance.now() / 120) % 2 ? '#3b82f6' : '#ef4444'; x.fillRect(cx - w * .2, cy - h * 1.25, w * .4, h * .14); }
  }
  function draw() {
    const g = x.createLinearGradient(0, 0, 0, HZ); const skyC = night ? ['#020617', '#1e1b4b'] : o.sky; skyC.forEach((cc, i) => g.addColorStop(i / (skyC.length - 1), cc)); x.fillStyle = g; x.fillRect(0, 0, W, HZ + 2);
    if (night) { x.fillStyle = '#fff'; for (let i = 0; i < 40; i++) x.fillRect((i * 97 + 30) % W, (i * 43) % (HZ - 20), 2, 2); }
    x.fillStyle = night ? '#0f172a' : o.hills; x.beginPath(); x.moveTo(0, HZ + 2); for (let i = 0; i <= W; i += 8) x.lineTo(i, HZ - 10 - 30 * Math.abs(Math.sin((i - curve * 60) / 120)) - 10 * Math.abs(Math.sin(i / 41))); x.lineTo(W, HZ + 2); x.fill();
    x.fillStyle = night ? '#052e16' : o.grass; x.fillRect(0, HZ, W, H - HZ);
    /* road strips far → near */
    const STEPZ = 8;
    for (let z = ZMAX; z >= 0; z -= STEPZ) {
      const z2 = Math.max(0, z - STEPZ), y1 = sy(z), y2 = sy(z2) + 1, band = Math.floor((z + dist * 1.4) / 18) % 2;
      const xl1 = lx(-1, z) - 10 * sc(z), xr1 = lx(1, z) + 10 * sc(z), xl2 = lx(-1, z2) - 10 * sc(z2), xr2 = lx(1, z2) + 10 * sc(z2);
      x.fillStyle = band ? (night ? '#1f2937' : '#4b5563') : (night ? '#111827' : '#374151'); x.beginPath(); x.moveTo(xl1, y1); x.lineTo(xr1, y1); x.lineTo(xr2, y2); x.lineTo(xl2, y2); x.fill();
      x.fillStyle = band ? '#fff' : '#ef4444'; x.fillRect(xl1 - 4 * sc(z) - 2, y1, 4 * sc(z) + 2, y2 - y1 + 1); x.fillRect(xr1, y1, 4 * sc(z) + 2, y2 - y1 + 1);
      for (let l = 1; l < LANES; l++) { const u = laneU(l) - 1 / LANES; const isMid = l === ONC && ONC > 0; if (isMid || band) { x.fillStyle = isMid ? '#facc15' : 'rgba(255,255,255,.7)'; const wl = Math.max(1, (isMid ? 5 : 3) * sc(z)); x.fillRect(lx(u, z) - wl / 2, y1, wl, y2 - y1 + 1); } }
    }
    for (const it of items) { const z = Math.max(0, it.z), scl = sc(z), w = 26 * scl, cx = lx(laneU(it.lane), z), cy = sy(z); if (w < 2) continue; x.fillStyle = '#dc2626'; rr(x, cx - w / 2, cy - w * 1.1, w, w, w * .15); x.fillStyle = '#fff'; x.fillRect(cx - w * .3, cy - w * .75, w * .6, w * .28); }
    cars.slice().sort((a, b) => b.z - a.z).forEach(sprite);
    if (chase) sprite({ lane: clamp((px + 1) / 2 * LANES - .5 + Math.sin(performance.now() / 400) * 1.1, 0, LANES - 1), z: 6, police: true, onc: true, v: 0 });
    /* player */
    const steer = k.r - k.l, cxp = W / 2 + steer * 6, cyp = H - 24;
    x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.ellipse(cxp, cyp + 4, 50, 8, 0, 0, 7); x.fill();
    x.fillStyle = '#111'; x.fillRect(cxp - 46, cyp - 12, 16, 18); x.fillRect(cxp + 30, cyp - 12, 16, 18);
    x.fillStyle = flash > 0 && Math.floor(flash / 80) % 2 ? '#fff' : o.car; rr(x, cxp - 42, cyp - 34, 84, 34, 6);
    x.fillStyle = 'rgba(0,0,0,.45)'; rr(x, cxp - 28 + steer * 4, cyp - 52, 56, 20, 5);
    x.fillStyle = k.d ? '#ff3b3b' : '#b91c1c'; x.fillRect(cxp - 38, cyp - 28, 14, 7); x.fillRect(cxp + 24, cyp - 28, 14, 7);
    if (night) { const hl = x.createRadialGradient(W / 2, H * .95, 40, W / 2, H * .55, W * .6); hl.addColorStop(0, 'rgba(0,0,0,0)'); hl.addColorStop(.5, 'rgba(0,0,0,.1)'); hl.addColorStop(1, 'rgba(0,0,0,.8)'); x.fillStyle = hl; x.fillRect(0, 0, W, H); }
    if (chase) { x.fillStyle = Math.floor(performance.now() / 250) % 2 ? 'rgba(59,130,246,.12)' : 'rgba(239,68,68,.12)'; x.fillRect(0, 0, W, H); }
    /* HUD */
    T(x, Math.round(speed / MAX * 200) + ' km/h', 10, 22, 16, speed < MAX * .48 && chase ? '#f87171' : '#fff'); T(x, Math.floor(dist) + ' m', 10, 40, 12, '#e2e8f0');
    if (o.lives) T(x, '❤'.repeat(Math.max(0, lives)), W - 10, 26, 18, '#f87171', 'right');
    if (o.fuel) { x.fillStyle = 'rgba(0,0,0,.45)'; rr(x, W - 132, 34, 120, 12, 4); x.fillStyle = fuel < 25 && Math.floor(performance.now() / 300) % 2 ? '#fff' : fuel < 25 ? '#ef4444' : '#22c55e'; rr(x, W - 130, 36, 116 * fuel / 100, 8, 3); T(x, '⛽', W - 150, 45, 12); }
    if (o.combo && combo > 0) T(x, `×${combo + 1} close calls`, W - 10, 26, 15, '#fb923c', 'right');
    if (o.police) T(x, chase ? `🚔 ${Math.ceil(chaseT / 1000)}s` : (escaped ? `escaped ×${escaped}` : ''), W - 10, 46, 14, chase ? '#93c5fd' : '#e2e8f0', 'right');
    if (msgT > 0) T(x, msg, W / 2, 74, 17, '#fde047', 'center');
  }
  reset();
}

/* ===================== the six games ===================== */
const MOTO_LEVELS = [
  { name: 'Warm-up', terrain: [['flat', 300], ['bump', 120, 25], ['flat', 200], ['hill', 220, 60], ['cp'], ['flat', 200], ['up', 150, 50], ['down', 150, 50], ['flat', 200], ['hill', 260, 90], ['flat', 300]] },
  { name: 'Gap Jump', terrain: [['flat', 250], ['up', 120, 40], ['gap', 90], ['flat', 150], ['cp'], ['hill', 200, 70], ['flat', 100], ['up', 140, 60], ['gap', 120], ['down', 100, 40], ['flat', 250]] },
  { name: 'Spike Alley', terrain: [['flat', 200], ['spikes', 60], ['flat', 150], ['up', 100, 40], ['spikes', 80], ['down', 100, 40], ['cp'], ['flat', 100], ['hill', 240, 100], ['spikes', 70], ['flat', 250]] },
  { name: 'Rollercoaster', terrain: [['flat', 150], ['up', 200, 120], ['down', 150, 90], ['up', 120, 60], ['down', 200, 140], ['cp'], ['hill', 200, 80], ['hill', 160, 60], ['up', 180, 100], ['gap', 100], ['down', 200, 120], ['flat', 250]] },
  { name: 'Big Air', terrain: [['flat', 250], ['up', 160, 110], ['gap', 160], ['down', 120, 60], ['cp'], ['flat', 100], ['up', 200, 140], ['gap', 200], ['down', 150, 80], ['spikes', 60], ['flat', 250]] },
  { name: 'Bridge Run', terrain: [['flat', 200], ['bridge', 150], ['gap', 60], ['flat', 80], ['bridge', 200], ['cp'], ['up', 120, 50], ['gap', 110], ['bridge', 120], ['spikes', 50], ['flat', 250]] },
  { name: 'The Gauntlet', terrain: [['flat', 150], ['up', 140, 80], ['gap', 130], ['spikes', 50], ['down', 100, 50], ['cp'], ['hill', 200, 90], ['bridge', 180], ['gap', 90], ['up', 160, 120], ['gap', 180], ['down', 200, 130], ['cp'], ['spikes', 80], ['hill', 180, 70], ['flat', 250]] },
];
const WAGON_LEVELS = [
  { name: 'Seesaw School', terrain: [['flat', 200], ['seesaw', 220], ['flat', 150], ['hill', 180, 40], ['flat', 200]] },
  { name: 'Plank Walk', terrain: [['flat', 200], ['bridge', 160], ['flat', 100], ['bridge', 200], ['flat', 200]] },
  { name: 'Mind the Gap', terrain: [['flat', 200], ['up', 100, 30], ['gap', 70], ['flat', 120], ['gap', 90], ['down', 80, 30], ['flat', 200]] },
  { name: 'Tilt & Drop', terrain: [['flat', 150], ['seesaw', 200], ['gap', 60], ['seesaw', 200], ['flat', 200]] },
  { name: 'Bumpy Bridge', terrain: [['flat', 150], ['bump', 80, 30], ['bridge', 220], ['bump', 80, 30], ['cp'], ['hill', 200, 70], ['bridge', 150], ['flat', 200]] },
  { name: 'Steep Stuff', terrain: [['flat', 150], ['up', 120, 90], ['down', 90, 80], ['up', 100, 70], ['seesaw', 200], ['down', 120, 100], ['flat', 200]] },
  { name: 'Long Jump', terrain: [['flat', 250], ['up', 120, 60], ['gap', 150], ['down', 100, 40], ['cp'], ['bridge', 150], ['gap', 100], ['flat', 220]] },
  { name: 'Wobble Finale', terrain: [['flat', 150], ['seesaw', 180], ['bridge', 150], ['gap', 80], ['cp'], ['up', 130, 90], ['gap', 120], ['seesaw', 220], ['spikes', 50], ['down', 100, 60], ['flat', 220]] },
];

GAMES.push(
{ id: 'remix:fliptrail', title: 'Flip Trail Moto', emoji: '🏍️', cat: 'remix', colors: ['#7c2d12', '#fb923c'],
  help: 'Inspired by Moto X3M. What\'s different: every backflip knocks a second off your level time, and crashing sends you back to the last checkpoint flag instead of the start. Controls: ↑/W throttle, ↓/S brake, lean in the air with ↑/↓; tap to ride.',
  run(stage, api) { sideRig(stage, api, { title: 'Flip Trail Moto', bike: true, flips: true, levels: MOTO_LEVELS, sky: ['#fb923c', '#fde68a'], far: 'rgba(124,45,18,.35)', ground: '#78350f', top: '#fbbf24', car: '#dc2626' }); } },

{ id: 'remix:wobblewagon', title: 'Wobble Wagon', emoji: '🛺', cat: 'remix', colors: ['#0f766e', '#5eead4'],
  help: 'Inspired by Drive Mad. What\'s different: hold Shift for slow-motion from a limited charge that refills when you let go, and every course has seesaws and planks that snap if you dawdle. Controls: ↑/W forward, ↓/S reverse, ↑/↓ tilt in the air, Shift slow-mo; tap to drive.',
  run(stage, api) { sideRig(stage, api, { title: 'Wobble Wagon', bike: false, slowmo: true, levels: WAGON_LEVELS, sky: ['#0f766e', '#99f6e4'], far: 'rgba(15,118,110,.35)', ground: '#134e4a', top: '#2dd4bf', car: '#f59e0b' }); } },

{ id: 'remix:slidesyndicate', title: 'Slide Syndicate', emoji: '🚗', cat: 'remix', colors: ['#1f2937', '#f43f5e'],
  help: 'Inspired by Drift Hunters. What\'s different: yellow zones pay double, and a tyre-wear bar fills as you slide until you\'re bald and have to stop in the pit box for fresh rubber. Controls: ↑/W gas, ↓/S brake, ←/→ steer, Space handbrake; touch left/right to steer.',
  run(stage, api) { driftArena(stage, api); } },

{ id: 'remix:lowpolylaps', title: 'Low Poly Laps', emoji: '🏁', cat: 'remix', colors: ['#14532d', '#a3e635'],
  help: 'Inspired by PolyTrack. What\'s different: a ghost car replays your best lap so you race yourself, yellow boost pads add a burst, and the purple speed tunnel takes over the wheel like a loop-de-loop. Controls: ↑/W gas, ↓/S brake, ←/→ steer, Space handbrake; touch left/right to steer.',
  run(stage, api) { polyLaps(stage, api); } },

{ id: 'remix:twowaytrouble', title: 'Two-Way Trouble', emoji: '🛣️', cat: 'remix', colors: ['#1e293b', '#fbbf24'],
  help: 'Inspired by Highway Traffic. What\'s different: a fuel gauge that only fills from red cans on the road, night falls after 1000 m so you drive by headlights, and swerving onto the oncoming side to overtake pays a bonus. Controls: ←/→ steer, ↑ accelerate, ↓ brake; touch left/right to steer.',
  run(stage, api) { lanes3d(stage, api, { title: 'Two-Way Trouble', intro: 'left lanes are oncoming · grab fuel cans · any key to start', lanes: 4, oncoming: 2, fuel: true, nightAt: 1000, lives: 3, oncomingBonus: true, combo: true, sky: ['#38bdf8', '#e0f2fe'], hills: '#65a30d', grass: '#4d7c0f', car: '#ef4444' }); } },

{ id: 'remix:gridlock', title: 'Gridlock Getaway', emoji: '🚔', cat: 'remix', colors: ['#111827', '#60a5fa'],
  help: 'Inspired by Traffic Jam 3D. What\'s different: cars change lanes on you, near misses chain into a close-call combo, and hitting someone starts a 15-second police chase where slowing down means getting busted. Controls: ←/→ steer, ↑ accelerate, ↓ brake; touch left/right to steer.',
  run(stage, api) { lanes3d(stage, api, { title: 'Gridlock Getaway', intro: 'five lanes · cars switch lanes · any key to start', lanes: 5, oncoming: 0, laneChange: true, police: true, combo: true, dense: true, sky: ['#f97316', '#fde68a'], hills: '#7c2d12', grass: '#57534e', car: '#3b82f6' }); } },
);
})();
