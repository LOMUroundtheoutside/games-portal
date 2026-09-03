/* ===================== REMIX BATCH B =====================
   Six pseudo-3D "runner down a track" games on one shared engine (TR).
   All original code and art; each game is an homage with its own twists,
   explained in its help text. Pushed onto GAMES like every other game. */
(() => {

const F = 250, W = 560, H = 400, HOR = 112, CH = 1.5, PD = 2.2, DRAW = 26;
/* cell types */
const FL = 0, GAP = 1, BLK = 2, GEM = 3, RMP = 4, PAD = 5, SLO = 6, TREE = 7, SNOW = 8, GIFT = 9, SHLD = 10, NITRO = 11, DJ = 12;
const seeded = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); const r = clamp(((n >> 16) & 255) * f, 0, 255), g = clamp(((n >> 8) & 255) * f, 0, 255), b = clamp((n & 255) * f, 0, 255); return `rgb(${r | 0},${g | 0},${b | 0})`; };

/* ---------- shared engine ---------- */
function runner(stage, api, o) {
  const { c, x } = api.canvas(W, H); const k = RC.keys(api, stage);
  const L = o.lanes, LW = o.laneW, T = o.theme, tunnel = !!o.tunnel, R = 1.35;
  const laneCX = l => (l - (L - 1) / 2) * LW;
  let rows, seed, rng, pz, px, speed, air, jumpT, meter, boostT, slowT, dist, score, alive, started, msg, msgT, shield, dj, tricks, spin, yeti, slowHold, cars, lap, elims, wave, deathT;
  const fmt = n => String(Math.floor(n));
  function reset() {
    rows = []; seed = rnd(1e9); rng = seeded(seed);
    pz = 0; px = 0; speed = o.speed0; air = 0; jumpT = 0; meter = 1; boostT = 0; slowT = 0; dist = 0; score = 0; alive = true; started = false; msg = ''; msgT = 0; shield = 0; dj = 0; tricks = 0; spin = 0; yeti = o.yeti ? 1 : 0; slowHold = 0; lap = 0; elims = 0; wave = 1; deathT = 0;
    cars = [];
    if (o.race) spawnCars(4);
    if (tunnel) px = 0;
    api.score(0); api.overlay(`<b>${o.title}</b><small>${o.intro}</small>`);
  }
  function spawnCars(n) { for (let i = 0; i < n; i++) cars.push({ z: pz + 1 + i * 1.2, px: laneCX(rnd(L)), lane: 0, speed: o.speed0, col: RC.PALETTE[(i + 1) % 9], alive: true, hit: 0, skill: .82 + (i % 4) * .1 + Math.min(.15, (wave - 1) * .04), name: ['Ace', 'Bolt', 'Cruz', 'Dash', 'Echo', 'Flint', 'Gale', 'Hex'][i % 8] }); }
  function row(i) {
    if (i < 0) return { cells: new Array(L).fill(FL), mover: null };
    while (rows.length <= i) rows.push(o.gen(rows.length, rng, L));
    return rows[i];
  }
  function laneOf(v) { if (tunnel) return ((Math.round(v) % L) + L) % L; return Math.round(v / LW + (L - 1) / 2); }
  function begin() { if (!alive) { if (deathT > 350) reset(); return false; } if (!started) { started = true; api.overlay(null); } return true; }
  function jump() {
    if (!o.jump) return;
    if (air <= 0) { air = o.jumpLen / Math.max(4, speed); jumpT = air; api.beep(520, .05); }
    else if (dj > 0) { dj--; air = o.jumpLen / Math.max(4, speed); jumpT = air; api.beep(760, .06); flash('DOUBLE JUMP'); }
  }
  api.onKey(e => { if (!begin()) return; if ([' ', 'ArrowUp', 'w', 'W'].includes(e.key) && o.jump) jump(); });
  api.onTap(e => { if (!begin()) return; if (o.jump) { const r = stage.getBoundingClientRect(); const fy = (e.clientY - r.top) / r.height; if (fy < .55) jump(); } });
  api.onRestart(reset);
  function flash(t) { msg = t; msgT = 900; }
  function die(t) { if (!alive) return; alive = false; deathT = 0; api.beep(110, .4); api.overlay(`<b>${t}</b>${fmt(dist)} m · ${fmt(score + dist)} pts<br><small>any key / tap to retry</small>`); }
  function collect(r, l, t) { r.cells[l] = FL; return t; }

  api.loop(dt => {
    const s = Math.min(.05, dt / 1000);
    if (!alive) deathT += dt;
    if (started && alive) {
      /* --- speed --- */
      let target = Math.min(o.speedMax, o.speed0 + dist * o.accel);
      let mult = 1;
      if (boostT > 0) { boostT -= s; mult *= 1.5; }
      if (slowT > 0) { slowT -= s; mult *= .5; }
      if (o.meter) {
        if (k.d && meter > 0) { mult *= .6; meter -= s * .8; }
        else if ((k.u || k.sh) && meter > 0 && !o.jump) { mult *= 1.35; meter -= s * .6; }
        else meter = Math.min(1, meter + s * .22);
        meter = Math.max(0, meter);
      }
      if (o.snow && k.d) mult *= .55;
      target *= mult;
      speed += (target - speed) * (target > speed ? 1.2 : 3) * s;
      /* --- steering --- */
      const steer = (k.r - k.l) * o.steer * s * (air > 0 && !tunnel ? .6 : 1);
      px += steer;
      if (tunnel) px = ((px % L) + L) % L; else px = clamp(px, -LW * (L - 1) / 2 - LW * .2, LW * (L - 1) / 2 + LW * .2);
      if (o.snow && air > 0 && (k.l || k.r)) { spin += s * 6; if (spin >= Math.PI * 2) { spin -= Math.PI * 2; tricks++; score += 150; flash('SPIN +150'); api.beep(880, .05); } }
      /* --- move --- */
      pz += speed * s; dist = pz * o.metre;
      if (air > 0) air -= s;
      /* --- cell under player --- */
      const ri = Math.floor(pz), r = row(ri), l = laneOf(tunnel ? px : px);
      const onTrack = tunnel || (l >= 0 && l < L && Math.abs(px) <= LW * (L - 1) / 2 + LW * .5);
      if (!onTrack) die('Off the edge!');
      else {
        const t = r.cells[l];
        if (t === GAP && air <= 0) die(tunnel ? 'Fell through!' : 'Fell off!');
        else if ((t === BLK || t === TREE || t === SNOW) && air <= 0) {
          if (shield > 0) { shield = 0; collect(r, l, t); flash('SHIELD USED'); api.beep(300, .1); }
          else if (o.race) { speed *= .35; collect(r, l, t); flash('OUCH'); api.beep(160, .15); }
          else die(t === BLK ? 'Smashed!' : 'Crashed!');
        }
        else if (t === GEM) { collect(r, l, t); slowT = 2; score += 50; flash('SLOW TIME'); api.beep(1100, .08); }
        else if (t === RMP && air <= 0) { air = .9; jumpT = .9; api.beep(600, .06); if (o.snow) flash('AIR!'); }
        else if (t === PAD) { boostT = Math.max(boostT, 1.2); if (!msgT) flash('BOOST'); }
        else if (t === SLO) { if (speed > o.speed0 * .5) speed -= speed * 2 * s; }
        else if (t === GIFT) { collect(r, l, t); score += 100; flash('GIFT +100'); api.beep(1000, .06); }
        else if (t === SHLD) { collect(r, l, t); shield = 1; flash('SHIELD'); api.beep(700, .08); }
        else if (t === NITRO) { collect(r, l, t); boostT = 2; flash('NITRO!'); api.beep(900, .1); }
        else if (t === DJ) { collect(r, l, t); dj = Math.min(3, dj + 1); flash('DOUBLE JUMP +1'); api.beep(1200, .08); }
        if (r.mover && air <= 0 && Math.abs(px - r.mover.x) < LW * .55 && Math.abs(pz - ri - .5) < .5) { if (shield > 0) { shield = 0; r.mover = null; flash('SHIELD USED'); } else die('Squashed!'); }
      }
      /* --- movers --- */
      for (let i = ri - 1; i < ri + DRAW; i++) { const rr = row(i); if (rr.mover) { rr.mover.x += rr.mover.dir * rr.mover.v * s; const lim = LW * (L - 1) / 2; if (rr.mover.x > lim) { rr.mover.x = lim; rr.mover.dir = -1; } if (rr.mover.x < -lim) { rr.mover.x = -lim; rr.mover.dir = 1; } } }
      /* --- yeti (snow) --- */
      if (o.yeti) {
        const slowNow = speed < Math.min(o.speedMax, o.speed0 + dist * o.accel) * .72;
        yeti += (slowNow ? -.16 : .12) * s; yeti = clamp(yeti, 0, 1);
        if (yeti <= 0) die('The yeti got you!');
      }
      /* --- race --- */
      if (o.race) {
        for (const cr of cars) {
          if (!cr.alive) continue;
          const base = Math.min(o.speedMax, o.speed0 + dist * o.accel) * cr.skill * (1 + Math.sin(pz * .3 + cr.z) * .06);
          if (cr.hit > 0) cr.hit -= s;
          cr.speed += ((cr.hit > 0 ? base * .45 : base) - cr.speed) * 2 * s;
          cr.z += cr.speed * s;
          const ci = Math.floor(cr.z), look = row(ci + 2), cl = laneOf(cr.px);
          if (look.cells[cl] === BLK || look.cells[cl] === GAP) { const opts = []; for (let q = 0; q < L; q++) if (look.cells[q] !== BLK && look.cells[q] !== GAP && row(ci + 3).cells[q] !== BLK) opts.push(q); if (opts.length) cr.lane = opts.reduce((a, b) => Math.abs(b - cl) < Math.abs(a - cl) ? b : a); }
          else cr.lane = cl;
          cr.px += (laneCX(cr.lane) - cr.px) * 3 * s;
          const here = row(ci).cells[laneOf(cr.px)];
          if ((here === BLK || here === GAP) && cr.hit <= 0) { cr.hit = 1; row(ci).cells[laneOf(cr.px)] = FL; }
          if (Math.abs(cr.z - pz) < .7 && Math.abs(cr.px - px) < LW * .8) { const push = cr.px > px ? -1 : 1; px += push * 1.5 * s; speed *= .995; }
        }
        const nextLap = (lap + 1) * o.lapLen;
        if (dist >= nextLap) {
          lap++;
          const field = cars.filter(cc => cc.alive).map(cc => ({ z: cc.z, cr: cc })).concat([{ z: pz, cr: null }]).sort((a, b) => a.z - b.z);
          const last = field[0];
          if (last.cr === null) die('Eliminated – you were last!');
          else { last.cr.alive = false; elims++; score += 100; flash(last.cr.name.toUpperCase() + ' ELIMINATED'); api.beep(240, .2); }
          if (alive && !cars.some(cc => cc.alive)) { score += 500; wave++; flash('WAVE ' + wave + ' – NEW RIVALS'); cars = []; spawnCars(4 + Math.min(3, wave)); }
        }
      }
      if (msgT > 0) msgT -= dt;
      api.score(Math.floor(score + dist));
    }
    draw();
  });

  /* ---------- drawing ---------- */
  const proj = (lx, d, h = 0) => ({ x: W / 2 + F * lx / d, y: HOR + F * (CH - h) / d, s: F / d });
  function draw() {
    const camZ = pz - PD;
    if (tunnel) return drawTunnel(camZ);
    /* sky */
    const g = x.createLinearGradient(0, 0, 0, HOR); g.addColorStop(0, T.sky[0]); g.addColorStop(1, T.sky[1]); x.fillStyle = g; x.fillRect(0, 0, W, HOR);
    x.fillStyle = T.void; x.fillRect(0, HOR, W, H - HOR);
    if (T.stars) { x.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 40; i++) x.fillRect((i * 97 + Math.floor(pz * 3)) % W, (i * 53) % HOR, 2, 2); }
    if (o.snow) { x.fillStyle = '#fff'; for (let i = 0; i < 50; i++) x.fillRect((i * 131 + pz * 20) % W, (i * 71 + pz * 60 + i * i) % H, 2, 2); }
    const nearI = Math.floor(camZ + .5), farI = Math.floor(camZ) + DRAW;
    const deferred = [];
    for (let i = farI; i >= nearI; i--) {
      const d1 = Math.max(.55, i - camZ), d2 = Math.max(.56, i + 1 - camZ); if (d2 <= .56) continue;
      const r = row(i), fog = clamp(1 - (i - camZ) / DRAW, .15, 1);
      for (let l = 0; l < L; l++) {
        const t = r.cells[l]; if (t === GAP) continue;
        const x0 = laneCX(l) - LW / 2, x1 = laneCX(l) + LW / 2;
        const a = proj(x0, d2), b = proj(x1, d2), cc = proj(x1, d1), dd = proj(x0, d1);
        let col = (i + l) % 2 ? T.floor[0] : T.floor[1];
        if (t === PAD) col = T.pad; if (t === SLO) col = T.slow; if (t === RMP) col = T.ramp;
        x.fillStyle = shade(col, .35 + fog * .65);
        x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.lineTo(cc.x, cc.y); x.lineTo(dd.x, dd.y); x.closePath(); x.fill();
        if (t === PAD) { x.fillStyle = 'rgba(255,255,255,.7)'; const m = proj(laneCX(l), (d1 + d2) / 2); x.beginPath(); x.moveTo(m.x, m.y - m.s * .18); x.lineTo(m.x - m.s * .18, m.y + m.s * .05); x.lineTo(m.x + m.s * .18, m.y + m.s * .05); x.fill(); }
        if (t === BLK || t === TREE || t === SNOW || t === GEM || t === GIFT || t === SHLD || t === NITRO || t === DJ) deferred.push({ t, l, d1, d2, fog });
      }
      /* edge rails */
      if (T.edge) { x.strokeStyle = shade(T.edge, .3 + fog * .7); x.lineWidth = 2; for (const ex of [-LW * L / 2, LW * L / 2]) { const p = proj(ex, d1), q = proj(ex, d2); x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(q.x, q.y); x.stroke(); } }
      if (r.mover) deferred.push({ t: 'mover', mx: r.mover.x, d1, d2, fog });
      /* race cars in this row */
      if (o.race) for (const cr of cars) if (cr.alive && Math.floor(cr.z) === i) deferred.push({ t: 'car', cr, d: Math.max(.6, cr.z - camZ), fog });
      /* draw deferred sprites for this row now (far to near order preserved) */
      for (const q of deferred) drawSprite(q); deferred.length = 0;
    }
    drawPlayer();
    hud();
  }
  function box(lx, d1, d2, hgt, wid, col, fog) {
    const f = .3 + fog * .7;
    const b0 = proj(lx - wid / 2, d1), b1 = proj(lx + wid / 2, d1), t0 = proj(lx - wid / 2, d1, hgt), t1 = proj(lx + wid / 2, d1, hgt);
    const tb0 = proj(lx - wid / 2, d2, hgt), tb1 = proj(lx + wid / 2, d2, hgt);
    x.fillStyle = shade(col, f * .75); x.beginPath(); x.moveTo(t0.x, t0.y); x.lineTo(t1.x, t1.y); x.lineTo(tb1.x, tb1.y); x.lineTo(tb0.x, tb0.y); x.closePath(); x.fill();
    x.fillStyle = shade(col, f); x.fillRect(b0.x, t0.y, b1.x - b0.x, b0.y - t0.y);
  }
  function drawSprite(q) {
    if (q.t === 'mover') { box(q.mx, q.d1, q.d2, .5, LW * .9, T.mover, q.fog); return; }
    if (q.t === 'car') { const p = proj(q.cr.px, q.d), s = p.s; x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.ellipse(p.x, p.y, s * .42, s * .1, 0, 0, 7); x.fill(); x.fillStyle = q.cr.col; RC.rr(x, p.x - s * .38, p.y - s * .32, s * .76, s * .32, s * .06); x.fillStyle = '#111'; x.fillRect(p.x - s * .3, p.y - s * .5, s * .6, s * .2); x.fillStyle = '#ff5555'; x.fillRect(p.x - s * .34, p.y - s * .22, s * .1, s * .06); x.fillRect(p.x + s * .24, p.y - s * .22, s * .1, s * .06); return; }
    const lx = laneCX(q.l), dm = (q.d1 + q.d2) / 2, p = proj(lx, dm), s = p.s, f = .3 + q.fog * .7;
    if (q.t === BLK) { box(lx, q.d1, q.d2, .6, LW * .8, T.block, q.fog); return; }
    if (q.t === TREE) { x.fillStyle = shade('#7c4a1e', f); x.fillRect(p.x - s * .05, p.y - s * .3, s * .1, s * .3); x.fillStyle = shade('#166534', f); for (let i = 0; i < 3; i++) { const yy = p.y - s * (.25 + i * .22), ww = s * (.3 - i * .06); x.beginPath(); x.moveTo(p.x, yy - s * .3); x.lineTo(p.x - ww, yy); x.lineTo(p.x + ww, yy); x.fill(); } x.fillStyle = 'rgba(255,255,255,.8)'; x.fillRect(p.x - s * .12, p.y - s * .72, s * .24, s * .05); return; }
    if (q.t === SNOW) { x.fillStyle = shade('#f8fafc', f); for (const [yy, rr] of [[.16, .18], [.42, .14], [.62, .1]]) { x.beginPath(); x.arc(p.x, p.y - s * yy, s * rr, 0, 7); x.fill(); } x.fillStyle = '#f97316'; x.fillRect(p.x, p.y - s * .63, s * .12, s * .04); x.fillStyle = '#111'; x.fillRect(p.x - s * .05, p.y - s * .67, s * .03, s * .03); x.fillRect(p.x + s * .02, p.y - s * .67, s * .03, s * .03); return; }
    if (q.t === GEM || q.t === DJ) { const col = q.t === GEM ? T.gem : '#fbbf24'; x.fillStyle = shade(col, f); const h = s * .32, w = s * .2, yy = p.y - s * .3 + Math.sin(pz * 4 + q.l) * s * .04; x.beginPath(); x.moveTo(p.x, yy - h); x.lineTo(p.x + w, yy); x.lineTo(p.x, yy + h); x.lineTo(p.x - w, yy); x.fill(); x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.moveTo(p.x, yy - h); x.lineTo(p.x + w * .5, yy - h * .4); x.lineTo(p.x - w * .3, yy - h * .3); x.fill(); return; }
    if (q.t === GIFT) { x.fillStyle = shade('#dc2626', f); x.fillRect(p.x - s * .18, p.y - s * .36, s * .36, s * .36); x.fillStyle = shade('#fde047', f); x.fillRect(p.x - s * .03, p.y - s * .36, s * .06, s * .36); x.fillRect(p.x - s * .18, p.y - s * .21, s * .36, s * .06); return; }
    if (q.t === SHLD) { x.fillStyle = shade('#38bdf8', f); x.beginPath(); x.arc(p.x, p.y - s * .28, s * .2, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(p.x, p.y - s * .28, s * .1, 0, 7); x.fill(); return; }
    if (q.t === NITRO) { x.fillStyle = shade('#f97316', f); RC.rr(x, p.x - s * .12, p.y - s * .45, s * .24, s * .45, s * .06); x.fillStyle = '#fff'; x.font = `bold ${Math.max(6, s * .18) | 0}px monospace`; x.textAlign = 'center'; x.fillText('N', p.x, p.y - s * .16); x.textAlign = 'left'; return; }
  }
  function drawPlayer() {
    const hgt = air > 0 ? Math.sin(Math.PI * (1 - air / Math.max(.01, jumpT))) * (o.jump ? .9 : 1.1) : 0;
    const g = proj(px, PD), p = proj(px, PD, hgt), s = g.s;
    x.fillStyle = 'rgba(0,0,0,.4)'; x.beginPath(); x.ellipse(g.x, g.y - 2, s * .28 * (1 - hgt * .3), s * .07, 0, 0, 7); x.fill();
    if (o.snow) {
      x.save(); x.translate(p.x, p.y - s * .12); if (air > 0) x.rotate(spin);
      x.fillStyle = '#7c2d12'; RC.rr(x, -s * .3, -s * .04, s * .6, s * .09, s * .03); x.fillStyle = '#c2410c'; x.fillRect(-s * .3, -s * .12, s * .08, s * .1); x.fillRect(s * .22, -s * .12, s * .08, s * .1);
      x.fillStyle = T.ball; x.beginPath(); x.arc(0, -s * .28, s * .12, 0, 7); x.fill(); x.fillStyle = '#fde68a'; x.beginPath(); x.arc(0, -s * .44, s * .08, 0, 7); x.fill();
      x.restore(); return;
    }
    if (o.race) {
      x.fillStyle = T.ball; RC.rr(x, p.x - s * .4, p.y - s * .34, s * .8, s * .34, s * .07); x.fillStyle = '#0f172a'; x.fillRect(p.x - s * .3, p.y - s * .52, s * .6, s * .2);
      x.fillStyle = k.d ? '#ff2222' : '#991b1b'; x.fillRect(p.x - s * .36, p.y - s * .24, s * .12, s * .07); x.fillRect(p.x + s * .24, p.y - s * .24, s * .12, s * .07);
      if (boostT > 0) { x.fillStyle = '#fbbf24'; x.beginPath(); x.moveTo(p.x - s * .1, p.y); x.lineTo(p.x + s * .1, p.y); x.lineTo(p.x, p.y + s * (.15 + Math.random() * .15)); x.fill(); }
      if (shield > 0) { x.strokeStyle = 'rgba(56,189,248,.8)'; x.lineWidth = 3; x.beginPath(); x.ellipse(p.x, p.y - s * .2, s * .5, s * .38, 0, 0, 7); x.stroke(); }
      return;
    }
    const rr = s * .26;
    x.fillStyle = T.ball; x.beginPath(); x.arc(p.x, p.y - rr, rr, 0, 7); x.fill();
    x.save(); x.beginPath(); x.arc(p.x, p.y - rr, rr, 0, 7); x.clip();
    x.fillStyle = 'rgba(0,0,0,.35)'; const ph = (pz * 2.2) % 2; for (let i = -1; i < 3; i++) x.fillRect(p.x - rr, p.y - rr * 2 + (i + ph) * rr, rr * 2, rr * .3);
    x.restore();
    x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.arc(p.x - rr * .35, p.y - rr * 1.4, rr * .25, 0, 7); x.fill();
    if (slowT > 0) { x.strokeStyle = 'rgba(167,243,208,.8)'; x.lineWidth = 2; x.beginPath(); x.arc(p.x, p.y - rr, rr + 5 + Math.sin(pz * 10) * 2, 0, 7); x.stroke(); }
  }
  function drawTunnel(camZ) {
    x.fillStyle = T.void; x.fillRect(0, 0, W, H);
    const CX = W / 2, CY = H / 2;
    const pt = (a, d) => ({ x: CX + F * R * Math.cos(a) / d, y: CY + F * R * Math.sin(a) / d });
    const nearI = Math.floor(camZ + .5), farI = Math.floor(camZ) + DRAW;
    for (let i = farI; i >= nearI; i--) {
      const d1 = Math.max(.5, i - camZ), d2 = Math.max(.51, i + 1 - camZ);
      const r = row(i), fog = clamp(1 - (i - camZ) / DRAW, .1, 1);
      for (let l = 0; l < L; l++) {
        const t = r.cells[l]; const a0 = (l - .5 - px) * Math.PI * 2 / L + Math.PI / 2, a1 = a0 + Math.PI * 2 / L;
        if (t === GAP) continue;
        const A = pt(a0, d2), B = pt(a1, d2), C = pt(a1, d1), D = pt(a0, d1);
        const lit = .55 + .45 * Math.sin((a0 + a1) / 2);
        x.fillStyle = shade((i + l) % 2 ? T.floor[0] : T.floor[1], (.25 + fog * .75) * lit);
        x.beginPath(); x.moveTo(A.x, A.y); x.lineTo(B.x, B.y); x.lineTo(C.x, C.y); x.lineTo(D.x, D.y); x.closePath(); x.fill();
        x.strokeStyle = shade(T.edge, fog * .8); x.lineWidth = 1; x.stroke();
        if (t === DJ) { const m = pt((a0 + a1) / 2, (d1 + d2) / 2), s = F / ((d1 + d2) / 2) * .25; const inward = Math.atan2(CY - m.y, CX - m.x); const gx = m.x + Math.cos(inward) * s * .5, gy = m.y + Math.sin(inward) * s * .5; x.fillStyle = shade('#fbbf24', .3 + fog * .7); x.beginPath(); x.moveTo(gx, gy - s * .3); x.lineTo(gx + s * .2, gy); x.lineTo(gx, gy + s * .3); x.lineTo(gx - s * .2, gy); x.fill(); }
      }
    }
    /* runner at the bottom */
    const hgt = air > 0 ? Math.sin(Math.PI * (1 - air / Math.max(.01, jumpT))) * .55 : 0;
    const base = pt(Math.PI / 2, PD), s = F / PD;
    const py = base.y - hgt * s * R * .5;
    x.fillStyle = 'rgba(0,0,0,.4)'; x.beginPath(); x.ellipse(base.x, base.y - 2, s * .18, s * .05, 0, 0, 7); x.fill();
    x.fillStyle = T.ball; RC.rr(x, base.x - s * .09, py - s * .42, s * .18, s * .3, s * .05);
    x.fillStyle = '#fde68a'; x.beginPath(); x.arc(base.x, py - s * .5, s * .08, 0, 7); x.fill();
    const legT = air > 0 ? 0 : Math.sin(pz * 12) * s * .06;
    x.fillStyle = T.ball; x.fillRect(base.x - s * .08, py - s * .14, s * .06, s * .14 + legT); x.fillRect(base.x + s * .02, py - s * .14, s * .06, s * .14 - legT);
    hud();
  }
  function hud() {
    RC.text(x, fmt(dist) + ' m', 12, 24, 16);
    RC.text(x, fmt(score + dist) + ' pts', W - 12, 24, 14, '#fde68a', 'right');
    if (o.meter) { x.fillStyle = 'rgba(255,255,255,.2)'; x.fillRect(12, 34, 120, 8); x.fillStyle = meter > .3 ? T.gem : '#f87171'; x.fillRect(12, 34, 120 * meter, 8); RC.text(x, '↑ boost · ↓ brake', 12, 56, 10, 'rgba(255,255,255,.6)'); }
    if (o.yeti) { x.fillStyle = 'rgba(255,255,255,.2)'; x.fillRect(12, 34, 120, 8); x.fillStyle = yeti > .4 ? '#93c5fd' : '#f87171'; x.fillRect(12, 34, 120 * yeti, 8); RC.text(x, yeti < .4 ? 'YETI CLOSE – GO FASTER!' : 'yeti gap', 12, 56, 10, yeti < .4 ? '#f87171' : 'rgba(255,255,255,.6)'); if (tricks) RC.text(x, 'spins ' + tricks, W - 12, 44, 12, '#fff', 'right');
      if (yeti < .7) { const sz = (1 - yeti) * 140; x.fillStyle = 'rgba(226,232,240,.9)'; x.beginPath(); x.arc(70, H + 30 - sz * .6, sz * .5, 0, 7); x.fill(); x.fillStyle = '#111'; x.beginPath(); x.arc(58, H + 10 - sz * .6, sz * .06, 0, 7); x.arc(82, H + 10 - sz * .6, sz * .06, 0, 7); x.fill(); x.fillStyle = '#7f1d1d'; x.fillRect(56, H + 22 - sz * .6, 28, sz * .08); } }
    if (dj > 0) RC.text(x, '⇈ ×' + dj, W - 12, 44, 12, '#fbbf24', 'right');
    if (o.race) { const aliveN = cars.filter(cc => cc.alive).length; const rank = 1 + cars.filter(cc => cc.alive && cc.z > pz).length; RC.text(x, `P${rank}/${aliveN + 1} · next cut in ${fmt(Math.max(0, (lap + 1) * o.lapLen - dist))} m`, 12, 44, 12, rank === aliveN + 1 ? '#f87171' : '#a7f3d0'); if (shield) RC.text(x, 'SHIELD', W - 12, 44, 12, '#38bdf8', 'right'); }
    if (slowT > 0) RC.text(x, 'SLOW-MO', W / 2, 44, 12, '#a7f3d0', 'center');
    if (boostT > 0 && !o.race) RC.text(x, 'BOOST', W / 2, 44, 12, '#fbbf24', 'center');
    if (msgT > 0 && msg) RC.text(x, msg, W / 2, H / 2 - 40, 22, '#fff', 'center');
    if (o.speedLines && speed > o.speedMax * .7) { x.strokeStyle = 'rgba(255,255,255,.15)'; x.lineWidth = 1; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + pz; x.beginPath(); x.moveTo(W / 2 + Math.cos(a) * 200, H / 2 + Math.sin(a) * 150); x.lineTo(W / 2 + Math.cos(a) * 400, H / 2 + Math.sin(a) * 300); x.stroke(); } }
  }
  reset();
}

/* ---------- row generators ---------- */
const empty = L => ({ cells: new Array(L).fill(FL), mover: null });
function slopeGen(opts) {
  return (i, rng, L) => {
    const r = empty(L);
    if (i < 10) return r;
    const diff = Math.min(1, i / 400);
    if (opts.split && i % 90 > 60 && i % 90 < 82) { r.cells[Math.floor(L / 2)] = GAP; if (i % 90 > 66 && i % 90 < 76) r.cells[Math.floor(L / 2) + (i % 2 ? 1 : -1)] = GAP; return r; }
    if (rng() < .22 + diff * .25) { const n = 1 + (rng() < diff * .6 ? 1 : 0); for (let j = 0; j < n; j++) r.cells[Math.floor(rng() * L)] = rng() < (opts.gapBias || .45) ? GAP : BLK; }
    if (i % 45 < 5 && opts.zones) { const t = (Math.floor(i / 45) % 3 === 0) ? PAD : SLO; for (let l = 0; l < L; l++) if (r.cells[l] === FL) r.cells[l] = t; }
    if (opts.gems && rng() < .06) { const l = Math.floor(rng() * L); if (r.cells[l] === FL) r.cells[l] = GEM; }
    if (opts.movers && i % 25 === 12) { for (let l = 0; l < L; l++) r.cells[l] = FL; r.mover = { x: (rng() - .5) * (L - 1) * opts.laneW, dir: rng() < .5 ? -1 : 1, v: 1.2 + diff * 1.5 }; }
    if (r.cells.every(t => t === GAP || t === BLK)) r.cells[Math.floor(rng() * L)] = FL;
    return r;
  };
}
function tunnelGen(i, rng, L) {
  const r = empty(L); if (i < 8) return r;
  const diff = Math.min(1, i / 300);
  const cyc = i % 7;
  if (cyc === 0 || (cyc === 1 && rng() < diff)) { const n = 2 + Math.floor(rng() * (2 + diff * 3)); const start = Math.floor(rng() * L); for (let j = 0; j < n; j++) r.cells[(start + j) % L] = GAP; }
  if (rng() < .05) { const l = Math.floor(rng() * L); if (r.cells[l] === FL) r.cells[l] = DJ; }
  return r;
}
function snowGen(i, rng, L) {
  const r = empty(L); if (i < 10) return r;
  const diff = Math.min(1, i / 350);
  if (rng() < .28 + diff * .3) { const n = 1 + (rng() < diff * .7 ? 1 : 0); for (let j = 0; j < n; j++) r.cells[Math.floor(rng() * L)] = rng() < .65 ? TREE : SNOW; }
  if (i % 60 === 30) { for (let l = 0; l < L; l++) if (r.cells[l] === FL && rng() < .6) r.cells[l] = RMP; }
  if (rng() < .08) { const l = Math.floor(rng() * L); if (r.cells[l] === FL) r.cells[l] = GIFT; }
  if (i % 40 > 34 && rng() < .5) { const l = Math.floor(rng() * L); if (r.cells[l] === FL) r.cells[l] = SLO; }
  if (r.cells.every(t => t === TREE || t === SNOW)) r.cells[Math.floor(rng() * L)] = FL;
  return r;
}
function raceGen(i, rng, L) {
  const r = empty(L); if (i < 12) return r;
  const diff = Math.min(1, i / 500);
  if (rng() < .3 + diff * .2) r.cells[Math.floor(rng() * L)] = BLK;
  if (rng() < .05) { const l = Math.floor(rng() * L); if (r.cells[l] === FL) r.cells[l] = rng() < .5 ? SHLD : NITRO; }
  if (i % 50 < 3) { for (let l = 0; l < L; l++) if (r.cells[l] === FL && l === Math.floor(i / 50) % L) r.cells[l] = PAD; }
  if (r.cells.filter(t => t === BLK).length >= L - 1) r.cells[Math.floor(rng() * L)] = FL;
  return r;
}

const base = { lanes: 5, laneW: .8, speed0: 6, accel: .012, speedMax: 17, steer: 3.2, metre: 2.5, jump: false, meter: false, speedLines: true };

GAMES.push(

/* ===== NEON DESCENT (Slope) ===== */
{ id: 'remix:neon-descent', title: 'Neon Descent', emoji: '🟢', cat: 'remix', colors: ['#052e16', '#22c55e'],
  help: 'Inspired by Slope. What\'s different: a boost/brake meter you have to ration, and speed zones on the track (green pads throw you forward, purple strips drag). Controls: ← → or A/D to steer, ↑/Shift to boost, ↓ to brake; drag left/right on touch.',
  run(stage, api) { runner(stage, api, { ...base, meter: true, title: 'Neon Descent', intro: '← → steer · ↑ boost · ↓ brake · any key to roll',
    theme: { sky: ['#020617', '#052e16'], void: '#020617', floor: ['#14532d', '#166534'], edge: '#4ade80', ball: '#a3e635', block: '#ef4444', gem: '#a7f3d0', pad: '#22c55e', slow: '#6d28d9', ramp: '#86efac', mover: '#f97316' },
    gen: slopeGen({ zones: true, gapBias: .5 }) }); } },

/* ===== MAGMA RUN (Slope 2) ===== */
{ id: 'remix:magma-run', title: 'Magma Run', emoji: '🌋', cat: 'remix', colors: ['#431407', '#f97316'],
  help: 'Inspired by Slope 2. What\'s different: sliding lava crushers that patrol across the track, and the path splits in two with a chasm down the middle every so often. Controls: ← → or A/D to steer, ↑ boost, ↓ brake; drag left/right on touch.',
  run(stage, api) { runner(stage, api, { ...base, meter: true, speed0: 6.5, title: 'Magma Run', intro: '← → steer · dodge the sliding crushers · any key to roll',
    theme: { sky: ['#1c0a00', '#7c2d12'], void: '#1c0a00', floor: ['#44403c', '#57534e'], edge: '#fb923c', ball: '#fdba74', block: '#dc2626', gem: '#fde68a', pad: '#f59e0b', slow: '#7f1d1d', ramp: '#fed7aa', mover: '#f97316' },
    gen: slopeGen({ movers: true, split: true, laneW: .8, gapBias: .4 }) }); } },

/* ===== GLITCH FALL (Slope 3) ===== */
{ id: 'remix:glitch-fall', title: 'Glitch Fall', emoji: '💎', cat: 'remix', colors: ['#1e1b4b', '#a78bfa'],
  help: 'Inspired by Slope 3. What\'s different: a night-time glitch world where diamonds slow time for two seconds so you can thread the gaps, plus it gets faster the further you fall. Controls: ← → or A/D to steer, ↑ boost, ↓ brake; drag left/right on touch.',
  run(stage, api) { runner(stage, api, { ...base, meter: true, speed0: 7, accel: .016, speedMax: 20, title: 'Glitch Fall', intro: '← → steer · grab diamonds to slow time · any key to fall',
    theme: { sky: ['#020617', '#1e1b4b'], void: '#020617', stars: true, floor: ['#312e81', '#3730a3'], edge: '#c084fc', ball: '#e879f9', block: '#f43f5e', gem: '#a5f3fc', pad: '#8b5cf6', slow: '#1e1b4b', ramp: '#c4b5fd', mover: '#f97316' },
    gen: slopeGen({ gems: true, zones: true, gapBias: .55 }) }); } },

/* ===== GRAVITY TUBE (Run 3) ===== */
{ id: 'remix:gravity-tube', title: 'Gravity Tube', emoji: '🌀', cat: 'remix', colors: ['#0c4a6e', '#38bdf8'],
  help: 'Inspired by Run 3. What\'s different: the whole tube rotates as you steer so gravity sticks you to whichever wall you run on, and gold gems bank double jumps for the wide holes. Controls: ← → or A/D to run round the tube, Space/↑ to jump; tap the top of the screen to jump, drag left/right to steer.',
  run(stage, api) { runner(stage, api, { ...base, tunnel: true, lanes: 10, jump: true, jumpLen: 2.6, speed0: 5.5, accel: .01, speedMax: 13, steer: 3, metre: 3, title: 'Gravity Tube', intro: '← → run around the tube · Space to jump the holes · any key to start',
    theme: { void: '#020617', floor: ['#0e7490', '#155e75'], edge: '#67e8f9', ball: '#f8fafc', gem: '#fbbf24' },
    gen: tunnelGen }); } },

/* ===== POWDER PEAK (Snow Rider 3D) ===== */
{ id: 'remix:powder-peak', title: 'Powder Peak', emoji: '🛷', cat: 'remix', colors: ['#0369a1', '#e0f2fe'],
  help: 'Inspired by Snow Rider 3D. What\'s different: ramps launch you into the air where steering spins the sledge for trick points, and a yeti chases you the moment you slow down. Controls: ← → or A/D to steer (spin in the air), ↓ to slow; drag left/right on touch.',
  run(stage, api) { runner(stage, api, { ...base, snow: true, yeti: true, speed0: 6, accel: .01, speedMax: 15, steer: 3.4, title: 'Powder Peak', intro: '← → steer · hit ramps and spin for points · don\'t let the yeti catch up',
    theme: { sky: ['#0c4a6e', '#bae6fd'], void: '#0c4a6e', floor: ['#f1f5f9', '#e2e8f0'], edge: '#7dd3fc', ball: '#ef4444', block: '#166534', gem: '#fff', pad: '#bae6fd', slow: '#cbd5e1', ramp: '#93c5fd', mover: '#f97316' },
    gen: snowGen }); } },

/* ===== LAST ONE STANDING (Survival Race) ===== */
{ id: 'remix:last-one-standing', title: 'Last One Standing', emoji: '🏁', cat: 'remix', colors: ['#7f1d1d', '#f97316'],
  help: 'Inspired by Survival Race. What\'s different: every 300 m whoever is at the back is eliminated (you included), and shield and nitro pickups on the track can save your race. Beat all the rivals and a bigger wave shows up. Controls: ← → or A/D to steer, ↓ to brake; drag left/right on touch.',
  run(stage, api) { runner(stage, api, { ...base, race: true, lapLen: 300, lanes: 4, laneW: .95, speed0: 7, accel: .008, speedMax: 16, steer: 3, title: 'Last One Standing', intro: '← → steer · don\'t be last at each cut · grab shields and nitro',
    theme: { sky: ['#1c1917', '#7f1d1d'], void: '#1c1917', floor: ['#3f3f46', '#52525b'], edge: '#fbbf24', ball: '#ef4444', block: '#a16207', gem: '#fde68a', pad: '#f59e0b', slow: '#44403c', ramp: '#fed7aa', mover: '#f97316' },
    gen: raceGen }); } }

);
})();
