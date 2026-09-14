/* ===== WHEELIE KING — side-view dirt bike wheelie game =====
   One game, its own little engine: procedural dirt track with kickers and whoops, wheelie physics with a real
   balance point (past it you loop out), airtime with backflips, a combo multiplier for riding the sweet spot,
   parallax scenery, particles, a rider who leans with the input, and an engine note that follows the revs. */
(function () {
  const W = 960, H = 540, PX_M = 40;                 // 40 px = 1 m
  const TAU = Math.PI * 2, R2D = 180 / Math.PI;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const hash = n => { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const wrapAng = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

  /* ---------- track ---------- */
  // rolling base + a feature every SEG px: tabletop kicker, double, or a set of whoops
  const SEG = 1900;
  function feature(x) {
    const i = Math.floor(x / SEG), r = hash(i * 3 + 1), r2 = hash(i * 3 + 2), r3 = hash(i * 3 + 3);
    if (i < 1) return 0;                                    // a calm start
    const start = i * SEG + 500 + r * 700, u = x - start, kind = i < 3 ? 0 : Math.floor(r2 * 3);
    if (u < 0) return 0;
    const amp = 70 + r3 * 60;
    if (kind === 0) {                                      // tabletop: a kicker steepening to the lip, flat 140, drop 110
      if (u < 170) return amp * (1 - Math.cos(u / 170 * Math.PI / 2));
      if (u < 310) return amp;
      if (u < 420) return amp * (1 - smooth((u - 310) / 110));
      return 0;
    }
    if (kind === 1) {                                      // double: two rounded bumps
      if (u < 520) { const t = u / 260; return amp * .8 * Math.max(0, Math.sin(t * Math.PI)) * (t < 1 ? 1 : .85); }
      return 0;
    }
    if (u < 90 * 7) return 24 * Math.max(0, Math.sin(u / 90 * Math.PI));   // whoops
    return 0;
  }
  const ground = x => 60 * Math.sin(x / 470) + 32 * Math.sin(x / 191 + 1.7) + 9 * Math.sin(x / 63 + .5) + 4 * Math.sin(x / 23) * clamp((x - 2500) / 6000, 0, 1) + feature(x);
  const slopeAt = x => Math.atan2(ground(x + 3) - ground(x - 3), 6);

  /* ---------- sound ---------- */
  function makeEngine() {
    let ctx, g, osc1, osc2, flt, on = false;
    const wantSound = () => (typeof S === 'undefined' || S.sound);
    return {
      start() {
        if (on || !wantSound()) return;
        try {
          ctx = new (window.AudioContext || window.webkitAudioContext)();
          g = ctx.createGain(); g.gain.value = 0;
          flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 600; flt.Q.value = 2;
          osc1 = ctx.createOscillator(); osc1.type = 'sawtooth';
          osc2 = ctx.createOscillator(); osc2.type = 'square';
          osc1.connect(flt); osc2.connect(flt); flt.connect(g).connect(ctx.destination);
          osc1.start(); osc2.start(); on = true;
        } catch { on = false; }
      },
      set(rpm, vol) {
        if (!on) return;
        const f = 38 + rpm * 120 + Math.sin(ctx.currentTime * 31) * rpm * 3;
        osc1.frequency.setTargetAtTime(f, ctx.currentTime, .03);
        osc2.frequency.setTargetAtTime(f / 2, ctx.currentTime, .03);
        flt.frequency.setTargetAtTime(280 + rpm * 1900, ctx.currentTime, .05);
        g.gain.setTargetAtTime(wantSound() ? vol : 0, ctx.currentTime, .05);
      },
      stop() { if (!on) return; try { g.gain.value = 0; osc1.stop(); osc2.stop(); ctx.close(); } catch {} on = false; },
    };
  }

  GAMES.push({
    id: 'wheelieking', title: 'Wheelie King', emoji: '🏍️', cat: 'racing', colors: ['#7c2d12', '#f59e0b'],
    help: 'Hold ↑ (or W / Space) for throttle. ← leans back to lift the front, → leans forward to drop it, ↓ brakes. Ride the sweet spot on the balance gauge for a bigger combo, hit the kickers for backflips, and don\'t loop out!',
    run(stage, api) {
      const { c, x } = api.canvas(W, H, Math.min(2, window.devicePixelRatio || 1));
      const eng = makeEngine();
      const stop = api.stop; api.stop = () => { eng.stop(); stop(); };

      /* ---------- input ---------- */
      const k = { up: 0, down: 0, left: 0, right: 0 };
      const map = { ArrowUp: 'up', w: 'up', W: 'up', ' ': 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
      let alive = true, started = false;
      const begin = () => { eng.start(); if (!alive) reset(); if (!started) { started = true; api.overlay(null); } return true; };
      api.onKey(e => { const m = map[e.key]; if (!m) return; e.preventDefault(); if (!begin()) return; k[m] = 1; });
      api.onKeyUp(e => { const m = map[e.key]; if (m) k[m] = 0; });
      // touch: right half throttle, left half throttle + lean back, bottom-left corner brake
      const touch = e => { const r = stage.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height; k.up = 1; k.left = fx < .5 && fy < .75 ? 1 : 0; k.down = fx < .5 && fy >= .75 ? 1 : 0; if (k.down) k.up = 0; };
      api.on(stage, 'pointerdown', e => { if (!begin()) return; touch(e); });
      api.on(stage, 'pointermove', e => { if (e.buttons && started) touch(e); });
      api.on(window, 'pointerup', () => { k.up = k.left = k.down = 0; });
      api.on(window, 'blur', () => { for (const q in k) k[q] = 0; });

      /* ---------- state ---------- */
      const VMAX = 26 * PX_M;                     // ~94 km/h
      const G = 720, SC = 1.2, WB = 80 * SC, WR = 21 * SC;   // gravity px/s², bike drawing scale, wheelbase, wheel radius
      const BAL = 1.0;                            // balance point, rad from level (~57°)
      let b, cam, parts = [], pops = [], shake, t, stats, wheelie, combo, rpm, dust, sweetT, best = 0;
      function reset() {
        b = { x: 200, y: ground(200), v: 0, th: 0, w: 0, air: false, airT: 0, vy: 0, phi: 0, rot: 0, wheelRot: 0, susp: 0, suspV: 0, lean: 0 };
        cam = { x: b.x - W * .35, y: b.y, z: 1 };
        parts = []; pops = []; shake = 0; t = 0; rpm = 0; dust = 0; sweetT = 0;
        stats = { score: 0, dist: 0, longest: 0, flips: 0, crash: '' };
        wheelie = { on: false, dist: 0, peak: 0 }; combo = 1;
        alive = true; started = false; for (const q in k) k[q] = 0;
        api.score(0);
        api.overlay('<div><b>🏍️ Wheelie King</b>Hold <kbd>↑</kbd> for throttle · <kbd>←</kbd> lifts the front · <kbd>→</kbd> drops it · <kbd>↓</kbd> brake<br><small>Keep the needle in the green for a bigger combo · lean back off a kicker to flip · any key to ride</small></div>');
      }
      api.onRestart(reset);
      reset();

      const pop = (text, col = '#fff', size = 22, dy = 0) => pops.push({ text, col, size, x: b.x, y: b.y + 70 + dy, t: 0 });
      const puff = (n, x0, y0, spread, col, vx0 = 0, vy0 = 0, life = .6, r = 3) => { for (let i = 0; i < n; i++) parts.push({ x: x0 + (Math.random() - .5) * spread, y: y0 + Math.random() * 4, vx: vx0 + (Math.random() - .5) * 90, vy: vy0 + Math.random() * 70, life, max: life, r: r + Math.random() * r, col }); };
      const endWheelie = () => {
        if (!wheelie.on) return; wheelie.on = false;
        const m = wheelie.dist;
        if (m >= 3) {
          const bonus = Math.round(m * 12 * combo); stats.score += bonus;
          pop(`WHEELIE ${m.toFixed(0)} m  +${bonus}`, '#fde68a', 24);
          if (m > stats.longest) { stats.longest = m; if (m > 15) pop('LONGEST YET!', '#4ade80', 18, 28); }
          api.beep(660, .06); api.after(80, () => api.beep(990, .08));
        }
        combo = 1; sweetT = 0;
      };
      const crash = why => {
        alive = false; endWheelie(); stats.crash = why; shake = 18;
        puff(40, b.x, b.y, 60, '#a16207', b.v * .3, 120, 1.1, 4); api.beep(70, .5);
        best = Math.max(best, stats.score); api.score(Math.round(stats.score));
        api.after(700, () => alive || api.overlay(`<div><b>${why}</b>Score <b style="font-size:1.4rem">${Math.round(stats.score)}</b><br><small>Longest wheelie ${stats.longest.toFixed(0)} m · ${stats.flips} backflip${stats.flips === 1 ? '' : 's'} · ${(stats.dist).toFixed(0)} m ridden</small></small><br><small>Any key to ride again</small></div>`));
      };

      /* ---------- physics ---------- */
      function step(dt) {
        t += dt;
        const thr = alive && started ? k.up : 0, brake = alive ? k.down : 0, lean = alive ? k.left - k.right : 0;
        b.lean = lerp(b.lean, lean, 1 - Math.pow(.001, dt));
        if (alive) physics(dt, thr, brake, lean);
        stats.dist = Math.max(stats.dist, (b.x - 200) / PX_M);
        // suspension bob, rpm, particles, popups, camera
        b.suspV += -b.susp * 260 * dt - b.suspV * 7 * dt; b.susp += b.suspV * dt;
        rpm = lerp(rpm, clamp(.12 + b.v / VMAX * .55 + thr * .35 + (b.air && thr ? .2 : 0), 0, 1), 1 - Math.pow(.02, dt));
        eng.set(rpm, alive ? .07 : .03);
        if (alive && !b.air && dust > .05 && Math.random() < dust * 2) puff(1, b.x, b.y, 8, Math.random() < .5 ? '#c2410c' : '#a16207', -b.v * .25, 30, .7, 2.5);
        if (thr && Math.random() < .3) parts.push({ x: b.x + 12, y: b.y + 28, vx: -b.v * .3 - 40, vy: 40, life: .5, max: .5, r: 3, col: 'rgba(200,200,200,.5)' });
        for (const p of parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 80 * dt; p.vx *= 1 - 2 * dt; }
        parts = parts.filter(p => p.life > 0);
        for (const p of pops) p.t += dt; pops = pops.filter(p => p.t < 1.5);
        shake = Math.max(0, shake - 40 * dt);
        const look = W * .35 - b.v / VMAX * 120;
        cam.x = lerp(cam.x, b.x - look, 1 - Math.pow(.002, dt)); cam.y = lerp(cam.y, b.y + (b.air ? (b.y - ground(b.x)) * .3 : 0), 1 - Math.pow(.01, dt));
      }
      function physics(dt, thr, brake, lean) {
        const sl = slopeAt(b.x);
        if (!b.air) {
          // longitudinal: throttle, brake, drag, rolling, gravity along the slope
          let a = thr * 300 * (1 - .55 * clamp(b.th / BAL, 0, 1)) - brake * 520 * Math.sign(b.v) - .0008 * b.v * Math.abs(b.v) - 30 * Math.sign(b.v) - G * Math.sin(sl) * .55;
          b.v = clamp(b.v + a * dt, 0, VMAX);
          // pitch: throttle torque (weaker at speed), lean, brake, gravity around the balance point, damping
          const phi = b.th + sl;                                             // absolute bike angle
          // throttle lifts (less at speed, less as the front rises); lean moves your weight, shifting the balance
          // point and adding a little torque; the rear brake slams the front down; gravity tips you toward/over BAL
          const tq = thr * 3.3 * Math.max(.15, 1 - b.v / VMAX) * clamp(1 - b.th / BAL * .9, .1, 1) * (b.v > 20 || b.th > 0 ? 1 : .35)
                   + (lean > 0 ? 1.4 : 2.3) * lean - brake * 5 - 2.4 * Math.sin(BAL - lean * .3 - phi);
          b.w += tq * dt; b.w *= 1 - 1.4 * dt;
          const prevTh = b.th; b.th += b.w * dt;
          if (b.th <= 0) {
            if (prevTh > .12 && b.w < -2.2) { shake = Math.max(shake, 4); puff(10, b.x + WB, b.y, 20, '#b45309', b.v * .2, 40); api.beep(90, .08); b.suspV -= 60; }
            b.th = 0; b.w = Math.max(0, b.w * -.15); endWheelie();
          }
          if (b.th > 1.5) { crash('Looped out!'); return; }
          // wheelie scoring
          if (b.th > .14) {
            if (!wheelie.on) { wheelie.on = true; wheelie.dist = 0; wheelie.peak = 0; }
            const m = b.v * dt / PX_M; wheelie.dist += m; wheelie.peak = Math.max(wheelie.peak, b.th);
            const sweet = Math.abs(phi - BAL) < .17;
            if (sweet) { sweetT += dt; const nc = Math.min(9, 1 + Math.floor(sweetT / 1.4)); if (nc > combo) { combo = nc; pop(`x${combo} SWEET`, '#4ade80', 20, -10); api.beep(520 + combo * 60, .05); } }
            stats.score += m * 10 * combo * (sweet ? 1.5 : 1);
          } else if (wheelie.on) endWheelie();
          // move along the ground; take off where the track curves down faster than gravity can follow
          const nx = b.x + b.v * Math.cos(sl) * dt, gy = ground(nx), dsl = wrapAng(slopeAt(nx) - sl);
          if (dsl < 0 && -b.v * dsl / dt > G * Math.cos(sl) * 1.25 && b.v > 150) {
            b.air = true; b.airT = 0; b.vy = b.v * Math.sin(sl); b.phi = phi; b.rot = 0; b.flipped = false; b.x = nx; b.y = gy;
            if (lean > 0 && sl > .25) { b.w += 5; pop('POP!', '#fff', 16, 30); }     // pull up off a lip for a flip
            puff(6, b.x, b.y, 16, '#a16207', 0, 30);
          }
          else { b.suspV += (gy - b.y - b.v * Math.sin(sl) * dt) * 4; b.x = nx; b.y = gy; }
          b.wheelRot += b.v * dt / WR;
          dust = thr * b.v / VMAX + (brake ? .5 : 0);
        } else {
          // airborne: gravity, lean spins the bike, count flips
          b.vy -= G * dt; b.x += b.v * dt; b.y += b.vy * dt;
          // lean spins the bike; with no input it settles gently toward the slope it's about to land on
          b.airT += dt; b.w += lean * 7 * dt; b.w *= 1 - .2 * dt;
          if (!lean) { const want = slopeAt(b.x + b.v * .35) + .25; b.w += clamp(wrapAng(want - b.phi), -1, 1) * 8 * dt - b.w * 4 * dt; }
          b.phi += b.w * dt; b.rot += b.w * dt;
          if (b.rot > TAU * .85) { b.rot -= TAU; b.flipped = true; stats.flips++; const bonus = 400 * combo; stats.score += bonus; pop(`BACKFLIP! +${bonus}`, '#f472b6', 26); api.beep(880, .08); api.after(90, () => api.beep(1320, .1)); }
          b.wheelRot += b.v * dt / WR * (thr ? 1.6 : .7);
          const gy = ground(b.x);
          if (b.y <= gy && b.airT > .06) {
            b.y = gy; b.air = false;
            const rel = wrapAng(b.phi - slopeAt(b.x));
            const hard = Math.min(1, -b.vy / 900);
            if (rel < -.55) { crash('Nose-dived!'); return; }
            if (rel > 1.35) { crash('Landed on your back!'); return; }
            if (b.flipped) { b.th = clamp(rel, 0, .5); b.w = 0; if (b.th < .15) b.th = 0; pop('STOMPED IT', '#4ade80', 18, 20); }
            else if (rel > .15) { b.th = rel; b.w = clamp(b.w * .4, -1.5, 1.5); if (!wheelie.on) { wheelie.on = true; wheelie.dist = 0; } if (b.airT > .45) pop('WHEELIE LANDING', '#fde68a', 18, 20); }
            else { b.th = 0; b.w = 0; }
            b.v *= 1 - .25 * hard; b.suspV -= 90 * hard; shake = Math.max(shake, 10 * hard);
            puff(6 + hard * 30, b.x, b.y, 30, '#a16207', b.v * .3, 60 + hard * 80, .8, 3);
            if (b.airT > .3) api.beep(110, .1);
          }
          dust = 0;
        }
      }

      /* ---------- drawing ---------- */
      const sx = wx => wx - cam.x, sy = wy => H * .66 - (wy - cam.y);
      const skyG = x.createLinearGradient(0, 0, 0, H); skyG.addColorStop(0, '#f97316'); skyG.addColorStop(.45, '#fbbf24'); skyG.addColorStop(1, '#fde68a');
      function hillsLayer(par, base, amp, col, seed) {
        x.fillStyle = col; x.beginPath(); x.moveTo(-10, H + 10);
        for (let s = -10; s <= W + 10; s += 8) { const wx = (s + cam.x * par); const y = base - (amp * Math.sin(wx / 210 + seed) + amp * .5 * Math.sin(wx / 87 + seed * 2) + amp * .25 * Math.sin(wx / 31 + seed * 3)) - (cam.y - 0) * par * .3; x.lineTo(s, y); }
        x.lineTo(W + 10, H + 10); x.closePath(); x.fill();
      }
      function trees(par, base, col, seed) {
        x.fillStyle = col; const w0 = Math.floor(cam.x * par / 60) - 1;
        for (let i = w0; i < w0 + W / 60 + 3; i++) { const h = hash(i + seed); if (h < .45) continue; const s = i * 60 + h * 40 - cam.x * par, y = base - (cam.y) * par * .3 + Math.sin(i * .7) * 14, sz = 26 + h * 30;
          x.beginPath(); x.moveTo(s, y - sz); x.lineTo(s + sz * .38, y); x.lineTo(s - sz * .38, y); x.closePath(); x.fill(); }
      }
      function drawWheel(px, py, rot) {
        x.save(); x.translate(px, py); x.rotate(rot);
        x.fillStyle = '#111827'; x.beginPath(); x.arc(0, 0, 21, 0, TAU); x.fill();
        x.strokeStyle = '#374151'; x.lineWidth = 3; x.setLineDash([3, 4]); x.beginPath(); x.arc(0, 0, 19, 0, TAU); x.stroke(); x.setLineDash([]);
        x.fillStyle = '#d1d5db'; x.beginPath(); x.arc(0, 0, 14, 0, TAU); x.fill();
        x.strokeStyle = '#6b7280'; x.lineWidth = 1.5; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * 13, Math.sin(a) * 13); x.stroke(); }
        x.fillStyle = '#9ca3af'; x.beginPath(); x.arc(0, 0, 4, 0, TAU); x.fill();
        x.restore();
      }
      function drawBike() {
        // rear axle at origin, x forward, y up (we flip the canvas y); angle is the absolute bike angle
        const angle = b.air ? b.phi : (b.th > .02 ? b.th + slopeAt(b.x) : Math.atan2(ground(b.x + WB) - b.y, WB));
        const fx = b.x + Math.cos(angle) * WB, fy = b.y + Math.sin(angle) * WB;
        // shadow
        const gyb = ground(b.x), gyf = ground(fx), hgt = b.y - gyb;
        x.fillStyle = `rgba(0,0,0,${clamp(.35 - hgt / 600, .06, .35)})`;
        x.beginPath(); x.ellipse(sx(b.x + WB / 2), sy((gyb + gyf) / 2) + 18, 60 + hgt * .1, 8, Math.atan2(-(gyf - gyb), WB), 0, TAU); x.fill();
        x.save(); x.translate(sx(b.x), sy(b.y) + WR); x.scale(SC, -SC); x.rotate(angle);
        const lw = (w, col) => { x.lineWidth = w; x.strokeStyle = col; x.lineCap = 'round'; x.lineJoin = 'round'; };
        const susp = b.susp;
        drawWheel(0, 0, -b.wheelRot); drawWheel(80, 0, -b.wheelRot);
        // swingarm + rear shock
        lw(6, '#4b5563'); x.beginPath(); x.moveTo(0, 0); x.lineTo(30, 16 + susp); x.stroke();
        lw(3, '#facc15'); x.beginPath(); x.moveTo(20, 10 + susp); x.lineTo(34, 36 + susp); x.stroke();
        // frame + engine
        x.fillStyle = '#374151'; x.beginPath(); x.moveTo(30, 16 + susp); x.lineTo(36, 40 + susp); x.lineTo(66, 44 + susp); x.lineTo(70, 30 + susp); x.lineTo(52, 12 + susp); x.closePath(); x.fill();
        x.fillStyle = '#1f2937'; x.beginPath(); x.roundRect ? x.roundRect(36, 14 + susp, 24, 18, 4) : x.rect(36, 14 + susp, 24, 18); x.fill();
        x.fillStyle = '#9ca3af'; x.fillRect(40, 18 + susp, 14, 3); x.fillRect(40, 24 + susp, 14, 3);
        // exhaust
        lw(5, '#9ca3af'); x.beginPath(); x.moveTo(58, 22 + susp); x.quadraticCurveTo(70, 8 + susp, 44, 6 + susp); x.lineTo(6, 24 + susp); x.stroke();
        lw(8, '#d1d5db'); x.beginPath(); x.moveTo(24, 16 + susp); x.lineTo(4, 26 + susp); x.stroke();
        // forks + bars
        lw(5, '#e5e7eb'); x.beginPath(); x.moveTo(80, 0); x.lineTo(72, 48 + susp); x.stroke();
        lw(4, '#111827'); x.beginPath(); x.moveTo(72, 48 + susp); x.lineTo(62, 62 + susp); x.stroke();
        // fenders, tank, seat, number plate
        x.fillStyle = '#ea580c';
        x.beginPath(); x.arc(80, 0, 26, .25, 2.3); x.arc(80, 0, 31, 2.3, .25, true); x.closePath(); x.fill();   // front fender (y is up here)
        x.beginPath(); x.moveTo(8, 34 + susp); x.lineTo(24, 40 + susp); x.lineTo(56, 44 + susp); x.lineTo(50, 38 + susp); x.lineTo(20, 32 + susp); x.closePath(); x.fill();
        x.fillStyle = '#c2410c'; x.beginPath(); x.moveTo(50, 40 + susp); x.lineTo(74, 46 + susp); x.lineTo(78, 36 + susp); x.lineTo(66, 28 + susp); x.closePath(); x.fill();
        x.fillStyle = '#f8fafc'; x.beginPath(); x.moveTo(34, 18 + susp); x.lineTo(30, 34 + susp); x.lineTo(46, 36 + susp); x.lineTo(46, 20 + susp); x.closePath(); x.fill();
        x.fillStyle = '#111827'; x.font = 'bold 11px system-ui'; x.save(); x.scale(1, -1); x.fillText('7', 35, -23 - susp); x.restore();
        x.fillStyle = '#111827'; x.beginPath(); x.moveTo(20, 44 + susp); x.lineTo(60, 48 + susp); x.lineTo(60, 43 + susp); x.lineTo(22, 40 + susp); x.closePath(); x.fill();
        // rider: hip, shoulders, head, arms to the bars, legs to the pegs; leans with input and with the wheelie
        const back = clamp(b.lean * 10 + b.th * 8 - (b.air ? 4 : 0), -12, 18);
        const hip = [30 - back * .5, 48 + susp], sh = [58 - back * 1.1, 70 + susp - Math.abs(back) * .2], head = [sh[0] + 7 - back * .2, sh[1] + 12];
        lw(9, '#1d4ed8'); x.beginPath(); x.moveTo(hip[0], hip[1]); x.lineTo(sh[0], sh[1]); x.stroke();     // torso, crouched over the tank
        lw(7, '#1e3a8a'); x.beginPath(); x.moveTo(hip[0], hip[1]); x.lineTo(50, 26 + susp); x.lineTo(40, 12 + susp); x.stroke();   // leg
        lw(6, '#1d4ed8'); x.beginPath(); x.moveTo(sh[0], sh[1] - 2); x.lineTo(62, 62 + susp); x.stroke(); // arm to the bars
        x.fillStyle = '#f8fafc'; x.beginPath(); x.arc(head[0], head[1], 10, 0, TAU); x.fill();
        x.fillStyle = '#0f172a'; x.beginPath(); x.arc(head[0] + 4, head[1] - 1, 6, -.9, .9); x.fill();      // visor
        x.fillStyle = '#ef4444'; x.beginPath(); x.arc(head[0] - 3, head[1] + 6, 6, Math.PI, 0); x.fill();  // helmet stripe on top
        x.fillStyle = '#111827'; x.beginPath(); x.arc(40, 12 + susp, 4, 0, TAU); x.fill();                 // boot
        x.restore();
      }
      function draw() {
        x.save();
        if (shake > 0) x.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
        x.fillStyle = skyG; x.fillRect(-20, -20, W + 40, H + 40);
        // sun + haze
        const sunX = 720 - cam.x * .02, sunY = 110; const sg = x.createRadialGradient(sunX, sunY, 10, sunX, sunY, 160); sg.addColorStop(0, 'rgba(255,241,200,.95)'); sg.addColorStop(.15, 'rgba(255,220,120,.6)'); sg.addColorStop(1, 'rgba(255,200,100,0)');
        x.fillStyle = sg; x.fillRect(sunX - 160, sunY - 160, 320, 320);
        // clouds
        x.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 6; i++) { const h = hash(i + 9), cx = ((i * 260 + h * 200 - cam.x * .06 - t * 6) % (W + 300) + W + 300) % (W + 300) - 150, cy = 60 + h * 110; x.beginPath(); x.ellipse(cx, cy, 60 + h * 40, 14 + h * 8, 0, 0, TAU); x.ellipse(cx + 30, cy - 8, 36, 16, 0, 0, TAU); x.fill(); }
        hillsLayer(.12, 330, 60, '#d97706', 1); hillsLayer(.24, 360, 48, '#b45309', 5); hillsLayer(.42, 385, 34, '#92400e', 9);
        trees(.42, 388, '#78350f', 3); trees(.65, 412, '#5b2a0b', 11);
        // terrain
        const tg = x.createLinearGradient(0, 0, 0, H); tg.addColorStop(0, '#9a3412'); tg.addColorStop(.6, '#7c2d12'); tg.addColorStop(1, '#431407');
        x.fillStyle = tg; x.beginPath(); x.moveTo(-10, H + 10);
        for (let s = -10; s <= W + 10; s += 6) x.lineTo(s, sy(ground(s + cam.x)));
        x.lineTo(W + 10, H + 10); x.closePath(); x.fill();
        // surface stripes: light crust, a darker rut a little below
        x.lineWidth = 5; x.strokeStyle = '#c2410c'; x.beginPath(); for (let s = -10; s <= W + 10; s += 6) x.lineTo(s, sy(ground(s + cam.x)) + 2); x.stroke();
        x.lineWidth = 2; x.strokeStyle = 'rgba(0,0,0,.25)'; x.beginPath(); for (let s = -10; s <= W + 10; s += 6) x.lineTo(s, sy(ground(s + cam.x)) + 14); x.stroke();
        // stones + tufts
        const s0 = Math.floor(cam.x / 40) - 1;
        for (let i = s0; i < s0 + W / 40 + 2; i++) { const h = hash(i * 7 + 2); const wx = i * 40 + h * 30, y = sy(ground(wx)); if (h < .35) { x.fillStyle = '#57534e'; x.beginPath(); x.ellipse(sx(wx), y + 3 + h * 10, 3 + h * 6, 2 + h * 3, 0, 0, TAU); x.fill(); }
          else if (h > .8) { x.strokeStyle = '#4d7c0f'; x.lineWidth = 2; x.beginPath(); for (let j = -2; j <= 2; j++) { x.moveTo(sx(wx), y + 1); x.lineTo(sx(wx) + j * 3, y - 6 - Math.abs(j)); } x.stroke(); } }
        // particles behind the bike, then bike, then the dust in front
        for (const p of parts) { x.globalAlpha = clamp(p.life / p.max, 0, 1) * .8; x.fillStyle = p.col; x.beginPath(); x.arc(sx(p.x), sy(p.y), p.r * (1.6 - p.life / p.max), 0, TAU); x.fill(); }
        x.globalAlpha = 1;
        drawBike();
        // speed lines
        if (b.v > VMAX * .7) { x.strokeStyle = `rgba(255,255,255,${(b.v / VMAX - .7) * 1.2})`; x.lineWidth = 2; for (let i = 0; i < 8; i++) { const y = (hash(i + Math.floor(t * 10)) * H), l = 40 + hash(i) * 80; x.beginPath(); x.moveTo(hash(i * 3) * W, y); x.lineTo(hash(i * 3) * W - l, y); x.stroke(); } }
        // popups
        for (const p of pops) { const a = p.t < 1.1 ? 1 : 1 - (p.t - 1.1) / .4; x.globalAlpha = a; x.font = `900 ${p.size}px system-ui, sans-serif`; x.textAlign = 'center'; x.lineWidth = 4; x.strokeStyle = 'rgba(0,0,0,.6)'; x.fillStyle = p.col; const px = sx(p.x), py = sy(p.y) - p.t * 40; x.strokeText(p.text, px, py); x.fillText(p.text, px, py); }
        x.globalAlpha = 1; x.textAlign = 'left';
        x.restore();
        drawHud();
      }
      function drawHud() {
        // score / distance top-left
        x.font = '900 30px system-ui, sans-serif'; x.fillStyle = '#fff'; x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 5; x.textAlign = 'left';
        const sc = Math.round(stats.score).toLocaleString(); x.strokeText(sc, 18, 40); x.fillText(sc, 18, 40);
        x.font = '600 14px system-ui, sans-serif'; x.lineWidth = 3;
        const l2 = `${stats.dist.toFixed(0)} m   ·   longest wheelie ${stats.longest.toFixed(0)} m   ·   ${stats.flips} flip${stats.flips === 1 ? '' : 's'}`; x.strokeText(l2, 18, 62); x.fillText(l2, 18, 62);
        // combo badge
        if (combo > 1) { x.font = '900 22px system-ui, sans-serif'; x.fillStyle = '#4ade80'; x.lineWidth = 4; const s = `x${combo} COMBO`; x.strokeText(s, 18, 92); x.fillText(s, 18, 92); }
        // wheelie length live
        if (wheelie.on && wheelie.dist > 1) { x.font = '900 18px system-ui, sans-serif'; x.fillStyle = '#fde68a'; x.lineWidth = 4; const s = `${wheelie.dist.toFixed(0)} m wheelie`; x.strokeText(s, 18, combo > 1 ? 116 : 92); x.fillText(s, 18, combo > 1 ? 116 : 92); }
        // speed, top-right
        x.textAlign = 'right'; x.font = '900 28px system-ui, sans-serif'; x.fillStyle = '#fff'; x.lineWidth = 5;
        const kmh = `${Math.round(b.v / PX_M * 3.6)}`; x.strokeText(kmh, W - 52, 40); x.fillText(kmh, W - 52, 40);
        x.font = '600 12px system-ui, sans-serif'; x.lineWidth = 3; x.strokeText('km/h', W - 18, 40); x.fillText('km/h', W - 18, 40);
        // rev bar
        x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(W - 168, 50, 150, 8); x.fillStyle = rpm > .85 ? '#ef4444' : '#f59e0b'; x.fillRect(W - 168, 50, 150 * rpm, 8);
        // balance gauge, bottom-right: 0° at the bottom, 90° at the top; green sweet zone; red loop-out zone
        const gx = W - 92, gy = H - 28, R = 56;
        const gang = a => Math.PI + a / 1.5 * Math.PI;  // 0 → left, balance ≈ top, 1.5 → right
        const seg = (a0, a1, col, w) => { x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'butt'; x.beginPath(); x.arc(gx, gy, R, gang(a0), gang(a1)); x.stroke(); };
        seg(0, 1.5, 'rgba(0,0,0,.45)', 12); seg(BAL - .17, BAL + .17, '#22c55e', 12); seg(1.28, 1.5, '#ef4444', 12);
        const phi = b.air ? wrapAng(b.phi - slopeAt(b.x)) : b.th + slopeAt(b.x);
        const na = gang(clamp(phi, -.2, 1.55)); x.strokeStyle = '#fff'; x.lineWidth = 4; x.lineCap = 'round'; x.beginPath(); x.moveTo(gx + Math.cos(na) * (R - 14), gy + Math.sin(na) * (R - 14)); x.lineTo(gx + Math.cos(na) * (R + 12), gy + Math.sin(na) * (R + 12)); x.stroke();
        x.font = '700 11px system-ui, sans-serif'; x.fillStyle = 'rgba(255,255,255,.85)'; x.textAlign = 'center'; x.fillText(b.air ? 'AIR' : `${Math.round(Math.max(0, phi) * R2D)}°`, gx, gy - 12); x.fillText('BALANCE', gx, gy + 2);
        x.textAlign = 'left';
      }

      api.loop(dt => { const s = Math.min(dt, 34) / 1000; if (started) { step(s / 2); if (alive) step(s / 2); } draw(); });
      c._dbg = () => ({ b, stats, combo, wheelie, t, k, tick: dt => { if (started) step(dt); }, start: () => begin() });
    }
  });
})();
