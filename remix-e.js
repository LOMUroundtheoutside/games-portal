/* ===================== REMIX BATCH E: NIGHT SHIFT =====================
   Four "survive until 6 AM" games on one shared engine. Original settings and
   mascots; the originals only inspired the shape of the game. Everything is
   drawn from primitives, no assets. */
(() => {

const W = 600, H = 420, TOP = 34, BOT = H - 58;
const HOUR = 36;                     /* seconds per in-game hour → 3.6 min a night */
const NIGHTS = 5;

/* ---------- persistence ---------- */
const loadBest = id => { try { return clamp(+localStorage.getItem('gp-remix-' + id) || 1, 1, NIGHTS); } catch { return 1; } };
const saveBest = (id, n) => { try { if (n > loadBest(id)) localStorage.setItem('gp-remix-' + id, String(n)); } catch {} };

/* ---------- drawing helpers ---------- */
const rr = (x, a, b, w, h, r, col) => { x.fillStyle = col; RC.rr(x, a, b, w, h, r); };
const txt = (x, s, px, py, size, col, align) => RC.text(x, s, px, py, size, col, align);
function mascotFace(x, cx, cy, s, m, glow) {
  /* s = head radius. Shapes: 'bear' round ears, 'bunny' tall ears, 'bird' beak, 'fox' pointy ears + hook, 'puppet' mask */
  x.fillStyle = m.col;
  if (m.shape === 'bunny') { rr(x, cx - s * .8, cy - s * 2.1, s * .5, s * 1.4, s * .25, m.col); rr(x, cx + s * .3, cy - s * 2.1, s * .5, s * 1.4, s * .25, m.col); }
  if (m.shape === 'bear') { x.beginPath(); x.arc(cx - s * .75, cy - s * .8, s * .35, 0, 7); x.arc(cx + s * .75, cy - s * .8, s * .35, 0, 7); x.fill(); }
  if (m.shape === 'fox') { x.beginPath(); x.moveTo(cx - s * .9, cy - s * .4); x.lineTo(cx - s * .7, cy - s * 1.6); x.lineTo(cx - s * .1, cy - s * .8); x.moveTo(cx + s * .9, cy - s * .4); x.lineTo(cx + s * .7, cy - s * 1.6); x.lineTo(cx + s * .1, cy - s * .8); x.fill(); }
  x.fillStyle = m.shape === 'puppet' ? '#f5f5f4' : m.col; x.beginPath(); x.arc(cx, cy, s, 0, 7); x.fill();
  if (m.shape === 'bird') { x.fillStyle = '#fbbf24'; x.beginPath(); x.moveTo(cx - s * .35, cy + s * .1); x.lineTo(cx + s * .35, cy + s * .1); x.lineTo(cx, cy + s * .7); x.fill(); }
  if (m.shape === 'puppet') { x.fillStyle = '#7c3aed'; x.beginPath(); x.ellipse(cx - s * .38, cy + s * .25, s * .12, s * .45, 0, 0, 7); x.ellipse(cx + s * .38, cy + s * .25, s * .12, s * .45, 0, 0, 7); x.fill(); }
  /* eyes */
  x.fillStyle = glow ? '#fff' : '#111'; x.beginPath(); x.arc(cx - s * .38, cy - s * .15, s * .2, 0, 7); x.arc(cx + s * .38, cy - s * .15, s * .2, 0, 7); x.fill();
  x.fillStyle = glow ? '#111' : (m.eye || '#f5f5f4'); x.beginPath(); x.arc(cx - s * .38, cy - s * .15, s * .08, 0, 7); x.arc(cx + s * .38, cy - s * .15, s * .08, 0, 7); x.fill();
  /* grin */
  x.strokeStyle = '#111'; x.lineWidth = Math.max(1, s * .08); x.beginPath(); x.arc(cx, cy + s * .25, s * .5, .15 * Math.PI, .85 * Math.PI); x.stroke();
  x.fillStyle = '#f5f5f4'; for (let i = -2; i <= 2; i++) x.fillRect(cx + i * s * .18 - s * .06, cy + s * .55, s * .12, s * .16);
}
function mascotBody(x, cx, cy, s, m, glow) { rr(x, cx - s * .9, cy + s * .9, s * 1.8, s * 2.2, s * .4, m.col); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(cx - s * .4, cy + s * 1.2, s * .8, s * 1.4); mascotFace(x, cx, cy, s, m, glow); }

/* ---------- the engine ---------- */
function night(stage, api, cfg) {
  const { c, x } = api.canvas(W, H);
  const G = cfg.game;
  let S; /* whole mutable state */
  const best = () => loadBest(G.id);

  function reset(nightNo) {
    const n = clamp(nightNo || best(), 1, NIGHTS);
    S = {
      night: n, t: 0, phase: 'start', power: 100, cams: false, cam: cfg.rooms[0].id,
      doors: {}, lights: {}, vents: {}, mask: false, maskT: 0, flash: false, flashT: 0, torch: 100, coffee: 1, coffeeT: 0,
      box: 100, wind: false, systems: { cams: 1, audio: 1, vent: 1 }, reboot: null, lure: null, lureT: 0, phantomT: 0, phantomFlash: 0, sealed: null, sealT: 0,
      bed: 0, plushies: 0, breath: { left: 0, right: 0 }, holdL: false, holdR: false,
      msg: '', msgT: 0, scare: null, scareT: 0, camsT: 0, bang: 0, hover: null, flicker: 0, hours: 0,
      mascots: cfg.mascots.map(m => ({ ...m, pos: 0, wait: 0, timer: 0, stage: 0, stunned: 0, seen: 0 })),
    };
    api.score((n - 1) * 6);
    api.overlay(`<b>${G.title}</b>Night ${n} of ${NIGHTS}<br><small>${cfg.intro}<br>any key / tap to clock in</small>`);
    draw();
  }
  const say = (s, t = 2.2) => { S.msg = s; S.msgT = t; };
  const rate = m => (m.rate[S.night - 1] || m.rate[m.rate.length - 1]);
  const roomOf = m => m.path[Math.min(m.pos, m.path.length - 1)];
  const mascotsIn = room => S.mascots.filter(m => roomOf(m) === room && m.stage >= 0);
  const atDoor = m => m.pos >= m.path.length - 1;

  /* ---------- buttons ---------- */
  function buttons() {
    const b = [];
    if (S.phase !== 'play') return b;
    const add = (id, label, on, hot) => b.push({ id, label, on, hot });
    if (S.cams && !cfg.f.noCams) { add('cams', '⬇ Office', true, 'C'); if (cfg.f.musicBox && S.cam === cfg.boxRoom) add('wind', S.wind ? 'Winding…' : 'Wind box', S.wind, 'W'); if (cfg.f.lure && S.systems.audio) add('lure', 'Play audio', S.lure === S.cam, 'L'); }
    else {
      if (!cfg.f.noCams) add('cams', '⬆ Cameras', false, 'C');
      if (cfg.f.doors) for (const d of cfg.f.doors) { add('door' + d, (cfg.f.holdDoors ? 'Hold ' : S.doors[d] ? 'Open ' : 'Close ') + (d === 'L' ? 'left' : 'right'), !!S.doors[d], d === 'L' ? 'A' : 'D'); }
      if (cfg.f.lights) for (const d of cfg.f.lights) add('light' + d, 'Light ' + (d === 'L' ? 'left' : 'right'), !!S.lights[d], d === 'L' ? 'Q' : 'E');
      if (cfg.f.flashlight) add('flash', 'Flashlight', S.flash, 'F');
      if (cfg.f.coffee) add('coffee', S.coffee ? 'Coffee ☕' : 'No coffee', false, 'K');
      if (cfg.f.mask) add('mask', S.mask ? 'Take off mask' : 'Wear mask', S.mask, 'M');
      if (cfg.f.ventLights) for (const v of cfg.f.ventLights) add('vlight' + v, 'Vent light ' + v, !!S.lights['v' + v], v === 'L' ? 'Q' : 'E');
      if (cfg.f.seal) for (const v of cfg.f.seal) add('seal' + v, S.sealed === v ? 'Sealed ' + v : 'Seal vent ' + v, S.sealed === v, v === 'L' ? 'Q' : 'E');
      if (cfg.f.systems) add('reboot', S.reboot ? 'Rebooting…' : 'Reboot systems', !!S.reboot, 'R');
      if (cfg.f.bed) add('bed', 'Check bed', false, 'B');
    }
    return b;
  }
  function btnRects() { const list = buttons(); const n = list.length, gap = 6, bw = Math.min(118, (W - 20 - gap * (n - 1)) / Math.max(1, n)); const total = n * bw + (n - 1) * gap; return list.map((b, i) => ({ ...b, x: (W - total) / 2 + i * (bw + gap), y: BOT + 10, w: bw, h: 38 })); }
  function roomRects() { return S.cams ? cfg.rooms.map(r => ({ id: r.id, x: 380 + r.x * 200 - 9, y: TOP + 12 + r.y * 190 - 9, w: 18, h: 18 })) : []; }

  function press(id) {
    if (S.phase !== 'play') return;
    if (!buttons().some(b => b.id === id)) return;
    if (id === 'cams') { if (cfg.f.systems && !S.systems.cams) { say('Cameras offline – reboot'); return; } S.cams = !S.cams; S.camsT = 0; api.beep(S.cams ? 300 : 220, .04); if (S.cams && S.mask) S.mask = false; return; }
    if (id.startsWith('door')) { const d = id[4]; S.doors[d] = !S.doors[d]; api.beep(S.doors[d] ? 140 : 180, .08); return; }
    if (id.startsWith('light')) { const d = id[5]; S.lights[d] = !S.lights[d]; return; }
    if (id.startsWith('vlight')) { const d = id[6]; S.lights['v' + d] = !S.lights['v' + d]; return; }
    if (id.startsWith('seal')) { const v = id[4]; if (S.sealed === v) S.sealed = null; else { S.sealed = v; S.sealT = 0; } api.beep(200, .06); return; }
    if (id === 'flash') { if (cfg.f.torchBar ? S.torch <= 0 : S.power <= 0) { say('No charge left'); return; } S.flash = !S.flash; return; }
    if (id === 'coffee') { if (!S.coffee) { say('You only had one cup'); return; } S.coffee = 0; S.coffeeT = 30; say('☕ Time flies for 30 s'); api.beep(700, .1); return; }
    if (id === 'mask') { S.mask = !S.mask; S.maskT = 0; if (S.mask) S.cams = false; api.beep(260, .05); return; }
    if (id === 'wind') { S.wind = !S.wind; return; }
    if (id === 'lure') { S.lure = S.lure === S.cam ? null : S.cam; S.lureT = 0; if (S.lure) { say('🔊 Audio playing in ' + roomName(S.cam)); api.beep(520, .12); } return; }
    if (id === 'reboot') { if (!S.reboot) { S.reboot = 6; say('Rebooting all systems…'); } return; }
    if (id === 'bed') { S.bed = 0; if (S.plushies) { say('Shooed ' + S.plushies + ' from under the bed'); S.plushies = 0; api.beep(600, .08); } else say('Nothing under the bed… yet'); return; }
  }
  const roomName = id => (cfg.rooms.find(r => r.id === id) || { name: id }).name;

  /* ---------- input ---------- */
  const keys = { A: 'doorL', D: 'doorR', ArrowLeft: 'doorL', ArrowRight: 'doorR', Q: 'lightL', E: 'lightR', C: 'cams', F: 'flash', K: 'coffee', M: 'mask', W: 'wind', L: 'lure', R: 'reboot', B: 'bed', ' ': 'cams' };
  function begin() { if (S.phase === 'start') { S.phase = 'play'; api.overlay(null); return true; } if (S.phase === 'dead') { reset(S.night); return true; } if (S.phase === 'won') { reset(Math.min(NIGHTS, S.night + 1)); return true; } return false; }
  api.onKey(e => {
    if (begin()) return;
    const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    if (/^[1-9]$/.test(k) && S.cams) { const r = cfg.rooms[+k - 1]; if (r) S.cam = r.id; return; }
    const id = keys[k]; if (!id) return; e.preventDefault();
    if (cfg.f.ventLights && id.startsWith('light')) return press('vlight' + id[5]);
    if (cfg.f.seal && id.startsWith('light')) return press('seal' + id[4 + 1]);
    if (cfg.f.holdDoors && id.startsWith('door')) { if (id[4] === 'L') S.holdL = true; else S.holdR = true; return; }
    press(id);
  });
  api.onKeyUp(e => { const k = e.key.length === 1 ? e.key.toUpperCase() : e.key; if (cfg.f.holdDoors) { if (k === 'A' || k === 'ArrowLeft') S.holdL = false; if (k === 'D' || k === 'ArrowRight') S.holdR = false; } });
  const pt = e => { const r = stage.getBoundingClientRect(); const cw = c.clientWidth || r.width || W, ch = c.clientHeight || r.height || H; const ox = (r.width - cw) / 2, oy = (r.height - ch) / 2; return { x: (e.clientX - r.left - ox) * W / cw, y: (e.clientY - r.top - oy) * H / ch }; };
  const hit = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  api.onMove(e => { const p = pt(e); S.hover = null; for (const b of btnRects()) if (hit(p, b)) S.hover = b.id; });
  api.onTap(e => {
    if (begin()) return; const p = pt(e);
    for (const b of btnRects()) if (hit(p, b)) { if (cfg.f.holdDoors && b.id.startsWith('door')) { if (b.id[4] === 'L') S.holdL = true; else S.holdR = true; return; } press(b.id); return; }
    for (const r of roomRects()) if (hit(p, r)) { S.cam = r.id; api.beep(340, .03); return; }
    if (!S.cams && cfg.f.bed && p.y > 250 && p.x > 200 && p.x < 400) press('bed');
  });
  api.on(window, 'pointerup', () => { S.holdL = S.holdR = false; });
  api.onRestart(() => reset(S ? S.night : 1));

  /* ---------- simulation ---------- */
  function caught(m) { S.phase = 'dead'; S.scare = m; S.scareT = 0; api.beep(90, .6); api.after(1500, () => { if (S.phase === 'dead') api.overlay(`<b>${m.name} got you</b>${S.hours} AM · Night ${S.night}<br><small>any key / tap to try the night again</small>`); }); }
  function win() { S.phase = 'won'; saveBest(G.id, Math.min(NIGHTS, S.night + 1)); api.score((S.night - 1) * 6 + 6); api.beep(880, .15); api.after(150, () => api.beep(1100, .2)); api.overlay(S.night >= NIGHTS ? `<b>6 AM – You did it!</b>All ${NIGHTS} nights survived<br><small>any key to play night ${NIGHTS} again</small>` : `<b>6 AM</b>Night ${S.night} survived<br><small>any key / tap for night ${S.night + 1}</small>`); }

  function tick(dt) {
    const s = dt / 1000; S.t += s * (S.coffeeT > 0 ? 2 : 1); if (S.coffeeT > 0) S.coffeeT -= s;
    S.hours = Math.floor(S.t / HOUR); api.score((S.night - 1) * 6 + S.hours);
    if (S.hours >= 6) return win();
    if (S.msgT > 0) S.msgT -= s;
    S.flicker = Math.random(); S.camsT += s; if (S.bang > 0) S.bang -= s;
    const nightF = 1 + (S.night - 1) * .28;

    /* power */
    if (cfg.f.power) {
      let drain = 100 / 250;
      if (S.cams) drain += .22; for (const d in S.doors) if (S.doors[d]) drain += .26; for (const d in S.lights) if (S.lights[d]) drain += .14; if (S.flash) drain += .45;
      S.power = Math.max(0, S.power - drain * s * (1 + (S.night - 1) * .08));
      if (S.power <= 0) { S.doors = {}; S.lights = {}; S.flash = false; S.cams = false; }
    }
    if (cfg.f.torchBar) { if (S.flash) { S.torch = Math.max(0, S.torch - 9 * s); if (S.torch <= 0) S.flash = false; } else S.torch = Math.min(100, S.torch + 3 * s); }
    if (cfg.f.mask && S.mask) S.maskT += s;

    /* music box */
    if (cfg.f.musicBox) {
      const winding = S.wind && S.cams && S.cam === cfg.boxRoom;
      if (!winding) S.wind = false;
      S.box = clamp(S.box + (winding ? 18 : -(2.2 + S.night * .6)) * s, 0, 100);
      const puppet = S.mascots.find(m => m.puppet);
      if (puppet) { if (S.box <= 0 && puppet.stage === 0) { puppet.stage = 1; say('♪ The box stopped…', 3); api.beep(150, .3); } if (puppet.stage === 1) { puppet.timer += s; if (puppet.timer > 14 - S.night) caught(puppet); } }
    }

    /* systems & phantoms */
    if (cfg.f.systems) {
      if (S.reboot) { S.reboot -= s; if (S.reboot <= 0) { S.reboot = null; S.systems = { cams: 1, audio: 1, vent: 1 }; say('Systems online'); api.beep(500, .08); } }
      else if (Math.random() < .012 * nightF * s * 10) { const k = ['cams', 'audio', 'vent'][rnd(3)]; if (S.systems[k]) { S.systems[k] = 0; say('⚠ ' + k.toUpperCase() + ' error'); api.beep(130, .15); if (k === 'cams') S.cams = false; if (k === 'audio') S.lure = null; if (k === 'vent') S.sealed = null; } }
      if (!S.systems.vent) S.sealed = null;
      S.phantomT += s;
      if (S.cams && S.phantomT > 22 - S.night * 2 && Math.random() < .03) { S.phantomT = 0; S.phantomFlash = 1.2; const k = ['cams', 'audio', 'vent'][rnd(3)]; S.systems[k] = 0; S.cams = false; say('👻 A phantom! ' + k.toUpperCase() + ' crashed', 3); api.beep(110, .4); }
      if (S.phantomFlash > 0) S.phantomFlash -= s;
      if (S.lure) { S.lureT += s; if (S.lureT > 9) S.lure = null; }
      if (S.sealed) { S.sealT += s; if (S.sealT > 18) { S.sealed = null; say('Seal timed out'); } }
    }

    /* bed / plushies */
    if (cfg.f.bed) { S.bed += s; if (S.bed > 26 - S.night * 2) { S.bed = 0; S.plushies++; say('…something crawled under the bed', 2.5); api.beep(200, .08); if (S.plushies >= 3) { caught({ name: 'The Nursery Trio', col: '#a78bfa', shape: 'bear' }); return; } } }

    /* mascots */
    for (const m of S.mascots) {
      if (m.puppet || m.stage < 0) continue;
      if (m.stunned > 0) { m.stunned -= s; continue; }
      m.timer += s;
      const interval = Math.max(2.2, (m.every || 5) - (S.night - 1) * .5);
      /* audio lure: the main threat drifts toward the lured room */
      if (cfg.f.lure && S.lure && m.main && m.timer > 2) { m.timer = 0; const i = m.path.indexOf(S.lure); if (i >= 0 && i < m.pos) { m.pos = Math.max(0, m.pos - 1); continue; } }
      if (m.runner) { /* charges when its room is not checked */
        const watched = S.cams && S.cam === m.path[0];
        if (watched) m.seen = 0; else m.seen += s;
        if (m.seen > (9 - S.night) && m.stage < 3 && m.timer > interval) { m.timer = 0; m.stage++; if (m.stage === 3) say('You hear running…', 2); }
        if (m.stage >= 3) { m.wait += s; if (m.wait > 2.5) { m.wait = 0; m.stage = 0; m.seen = 0; if (S.doors[m.side]) { S.bang = 1; S.power = Math.max(0, S.power - 7); api.beep(120, .25); say(m.name + ' bangs on the door!'); } else caught(m); } }
        continue;
      }
      if (!atDoor(m)) {
        if (m.timer > interval && Math.random() < rate(m) * (S.cams && S.cam === roomOf(m) ? .55 : 1)) { m.timer = 0; m.pos++; if (atDoor(m)) { m.wait = 0; if (cfg.f.breathing) api.beep(80, .3); } }
      } else {
        m.wait += s;
        const blocked = cfg.blocked(m, S);
        if (blocked === 'caught') { caught(m); return; }
        if (blocked === 'stun') { m.pos = 0; m.wait = 0; m.stunned = 4; say(m.name + ' backed off'); api.beep(420, .06); continue; }
        if (blocked && m.wait > 1.2) { m.pos = Math.max(0, m.pos - (2 + rnd(2))); m.wait = 0; m.timer = -3; api.beep(260, .05); continue; }
        const patience = Math.max(2.5, (m.patience || 7) - (S.night - 1) * .8);
        if (!blocked && m.wait > patience) { caught(m); return; }
      }
    }
    if (cfg.f.power && S.power <= 0) { S.dark = (S.dark || 0) + s; if (S.dark > 9 + rnd(4)) caught(S.mascots[0]); }
    if (cfg.f.breathing) { for (const side of ['left', 'right']) { const m = S.mascots.find(q => q.side === (side === 'left' ? 'L' : 'R') && atDoor(q)); S.breath[side] = m ? Math.min(1, S.breath[side] + s) : Math.max(0, S.breath[side] - s * 2); } if ((S.breath.left > .3 || S.breath.right > .3) && Math.floor(S.t * 2) !== Math.floor((S.t - s) * 2)) api.beep(70, .12); }
  }

  /* ---------- drawing ---------- */
  function draw() {
    x.fillStyle = '#050505'; x.fillRect(0, 0, W, H);
    if (!S) return;
    if (S.cams) drawCams(); else cfg.drawOffice(x, S, helpers);
    drawHud();
    if (S.scare) drawScare();
  }
  const helpers = { rr, txt, mascotBody, mascotFace, mascotsIn, atDoor, roomOf };
  function drawHud() {
    rr(x, 0, 0, W, TOP, 0, '#0a0a0a');
    const clock = S.hours === 0 ? '12 AM' : S.hours + ' AM';
    txt(x, clock, 12, 24, 18, '#e5e7eb'); txt(x, 'Night ' + S.night, 110, 24, 14, '#9ca3af');
    if (cfg.f.power) { const p = Math.round(S.power); txt(x, 'Power ' + p + '%', W - 12, 23, 14, p < 20 ? '#ef4444' : '#e5e7eb', 'right'); rr(x, W - 210, 12, 80, 10, 3, '#222'); rr(x, W - 210, 12, 80 * S.power / 100, 10, 3, p < 20 ? '#ef4444' : p < 50 ? '#f59e0b' : '#22c55e'); }
    if (cfg.f.torchBar) { txt(x, 'Torch', W - 100, 23, 12, '#9ca3af', 'right'); rr(x, W - 92, 12, 80, 10, 3, '#222'); rr(x, W - 92, 12, 80 * S.torch / 100, 10, 3, '#facc15'); }
    if (cfg.f.musicBox) { const bx = cfg.f.torchBar ? W - 232 : W - 92; txt(x, 'Music box', bx - 8, 23, 12, S.box < 25 ? '#ef4444' : '#9ca3af', 'right'); rr(x, bx, 12, 80, 10, 3, '#222'); rr(x, bx, 12, 80 * S.box / 100, 10, 3, S.box < 25 ? '#ef4444' : '#a78bfa'); }
    if (cfg.f.systems) { let px = 240; for (const k of ['cams', 'audio', 'vent']) { rr(x, px, 10, 62, 14, 4, S.systems[k] ? '#14532d' : '#7f1d1d'); txt(x, k.toUpperCase(), px + 31, 21, 10, '#fff', 'center'); px += 68; } }
    if (S.coffeeT > 0) txt(x, '☕ x2', 200, 24, 13, '#fbbf24');
    /* buttons */
    rr(x, 0, BOT, W, H - BOT, 0, '#0a0a0a');
    for (const b of btnRects()) { rr(x, b.x, b.y, b.w, b.h, 8, b.on ? '#b91c1c' : S.hover === b.id ? '#334155' : '#1f2937'); txt(x, b.label, b.x + b.w / 2, b.y + 20, 11, '#f9fafb', 'center'); txt(x, b.hot, b.x + b.w / 2, b.y + 33, 9, '#9ca3af', 'center'); }
    if (S.msgT > 0) { rr(x, W / 2 - 150, BOT - 34, 300, 26, 6, 'rgba(0,0,0,.75)'); txt(x, S.msg, W / 2, BOT - 16, 12, '#fde68a', 'center'); }
    if (S.phantomFlash > 0) { x.fillStyle = `rgba(255,255,255,${S.phantomFlash * .6})`; x.fillRect(0, 0, W, H); }
  }
  function drawCams() {
    /* room view */
    rr(x, 0, TOP, 370, BOT - TOP, 0, '#0f1115');
    const noise = S.flicker; x.fillStyle = `rgba(255,255,255,${.02 + noise * .04})`; for (let i = 0; i < 12; i++) x.fillRect(rnd(370), TOP + rnd(BOT - TOP), 60 + rnd(120), 1);
    const r = cfg.rooms.find(q => q.id === S.cam);
    txt(x, 'CAM ' + (cfg.rooms.indexOf(r) + 1) + ' · ' + r.name, 12, TOP + 22, 13, '#a3e635');
    x.fillStyle = '#1c1f26'; x.fillRect(0, BOT - 70, 370, 70); /* floor */
    (r.props || []).forEach(([px, py, w, h, col]) => rr(x, px, py, w, h, 4, col));
    const here = mascotsIn(S.cam).filter(m => !m.runner || m.stage < 3);
    here.forEach((m, i) => mascotBody(x, 90 + i * 100, TOP + 150, 22, m, true));
    if (cfg.f.musicBox && S.cam === cfg.boxRoom) { rr(x, 250, BOT - 130, 60, 60, 8, '#4c1d95'); txt(x, '♪', 280, BOT - 90, 26, S.box > 0 ? '#c4b5fd' : '#ef4444', 'center'); }
    if (cfg.f.lure && S.lure === S.cam) txt(x, '🔊', 330, TOP + 60, 22, '#fff', 'center');
    if (S.mascots.some(m => m.runner && m.path[0] === S.cam)) { const m = S.mascots.find(q => q.runner); if (m.stage < 3) txt(x, ['…still', 'peeking', 'leaning out', ''][m.stage], 12, BOT - 80, 11, '#f87171'); }
    /* map */
    rr(x, 372, TOP, W - 372, BOT - TOP, 0, '#0a0c10');
    txt(x, 'MAP', 380, TOP + 18, 11, '#6b7280');
    cfg.rooms.forEach((q, i) => { const px = 380 + q.x * 200, py = TOP + 12 + q.y * 190; const sel = q.id === S.cam; rr(x, px - 9, py - 9, 18, 18, 4, sel ? '#a3e635' : mascotsIn(q.id).length ? '#7f1d1d' : '#374151'); txt(x, String(i + 1), px, py + 4, 10, sel ? '#000' : '#e5e7eb', 'center'); });
    const o = cfg.officePos; rr(x, 380 + o[0] * 200 - 12, TOP + 12 + o[1] * 190 - 8, 24, 16, 3, '#1d4ed8'); txt(x, 'YOU', 380 + o[0] * 200, TOP + 12 + o[1] * 190 + 4, 8, '#fff', 'center');
    txt(x, 'keys 1-' + cfg.rooms.length + ' switch cams', 380, BOT - 8, 9, '#6b7280');
  }
  function drawScare() {
    S.scareT += 1 / 60; const m = S.scare; const sh = () => (Math.random() - .5) * 18;
    x.fillStyle = S.scareT % .2 < .1 ? '#000' : '#1a0000'; x.fillRect(0, 0, W, H);
    mascotBody(x, W / 2 + sh(), H / 2 - 40 + sh(), 70, m, true);
    txt(x, m.name.toUpperCase(), W / 2, H - 70, 26, '#fff', 'center');
  }

  api.loop(dt => { if (S.phase === 'play') tick(dt); draw(); });
  reset();
}

/* ---------- office drawers shared bits ---------- */
function officeFrame(x, S, h, opts) {
  /* walls, desk, doorways left/right */
  x.fillStyle = opts.wall || '#1a1d24'; x.fillRect(0, TOP, W, BOT - TOP);
  x.fillStyle = opts.floor || '#111318'; x.fillRect(0, BOT - 90, W, 90);
  x.fillStyle = 'rgba(255,255,255,.04)'; for (let i = 0; i < 6; i++) x.fillRect(0, TOP + 40 + i * 50, W, 1);
  if (opts.desk !== false) { rr(x, 170, BOT - 120, 260, 70, 8, opts.deskCol || '#3f2d1d'); rr(x, 250, BOT - 160, 60, 42, 4, '#0f172a'); rr(x, 255, BOT - 155, 50, 30, 2, S.cams ? '#0ea5e9' : '#1e293b'); rr(x, 380, BOT - 135, 22, 16, 3, '#e11d48'); }
}
function doorway(x, S, h, side, m, opts) {
  const dx = side === 'L' ? 20 : W - 130, lit = !!S.lights[side] || (opts.always && S.flash), open = !S.doors[side];
  rr(x, dx, TOP + 30, 110, BOT - TOP - 60, 4, lit ? '#3b3f4a' : '#0b0c10');
  if (m && lit && open) h.mascotBody(x, dx + 55, TOP + 130, 26, m, true);
  if (m && !lit && open) { x.fillStyle = '#fff'; x.beginPath(); x.arc(dx + 45, TOP + 120, 3, 0, 7); x.arc(dx + 65, TOP + 120, 3, 0, 7); x.fill(); }
  if (!open) { rr(x, dx, TOP + 30, 110, BOT - TOP - 60, 4, '#4b5563'); for (let i = 0; i < 6; i++) rr(x, dx + 4, TOP + 36 + i * 50, 102, 4, 2, '#374151'); }
  if (S.bang > 0 && !open && side === (opts.bangSide || 'L')) { x.fillStyle = 'rgba(255,255,255,.4)'; x.fillRect(dx, TOP + 30, 110, BOT - TOP - 60); }
  txt(x, side === 'L' ? 'LEFT' : 'RIGHT', dx + 55, TOP + 22, 10, '#6b7280', 'center');
}

/* ===================== GAME 1: NIGHT SHIFT ARCADE ===================== */
const arcade = {
  intro: 'Watch the cameras, shut the doors, save power. The mascots walk after midnight.',
  officePos: [.5, .95],
  rooms: [
    { id: 'stage', name: 'Main stage', x: .5, y: .1, props: [[60, 200, 250, 90, '#3b1d5e']] },
    { id: 'floor', name: 'Arcade floor', x: .3, y: .35, props: [[40, 150, 40, 120, '#1d4ed8'], [110, 150, 40, 120, '#b91c1c'], [180, 150, 40, 120, '#15803d']] },
    { id: 'prize', name: 'Prize counter', x: .75, y: .35, props: [[80, 220, 200, 60, '#7c2d12']] },
    { id: 'cove', name: 'Ball pit cove', x: .1, y: .55, props: [[40, 220, 280, 70, '#0e7490']] },
    { id: 'hallL', name: 'Left hall', x: .28, y: .75 }, { id: 'hallR', name: 'Right hall', x: .72, y: .75 },
  ],
  mascots: [
    { name: 'Bongo', col: '#7c3aed', shape: 'bear', path: ['stage', 'floor', 'hallL', 'doorL'], side: 'L', rate: [.25, .4, .5, .6, .7], every: 6, patience: 8 },
    { name: 'Clover', col: '#16a34a', shape: 'bunny', path: ['stage', 'prize', 'hallR', 'doorR'], side: 'R', rate: [.2, .35, .5, .6, .75], every: 5.5, patience: 7 },
    { name: 'Pip', col: '#f59e0b', shape: 'bird', eye: '#000', path: ['stage', 'floor', 'prize', 'hallR', 'doorR'], side: 'R', rate: [0, .3, .45, .55, .7], every: 5, patience: 6 },
    { name: 'Dash', col: '#dc2626', shape: 'fox', runner: true, side: 'L', path: ['cove'], rate: [0, .5, .6, .7, .8] },
  ],
  f: { power: 1, doors: ['L', 'R'], lights: ['L', 'R'], flashlight: 1, coffee: 1 },
  blocked(m, S) { if (S.doors[m.side]) return true; if (S.flash && S.lights[m.side]) return 'stun'; return false; },
  drawOffice(x, S, h) {
    officeFrame(x, S, h, { wall: '#161a26' });
    const L = S.mascots.find(m => m.side === 'L' && !m.runner && h.atDoor(m)), R = S.mascots.find(m => m.side === 'R' && !m.runner && h.atDoor(m));
    doorway(x, S, h, 'L', L, { bangSide: 'L' }); doorway(x, S, h, 'R', R, {});
    if (S.flash) { x.fillStyle = 'rgba(253,224,71,.08)'; x.fillRect(0, TOP, W, BOT - TOP); }
    txt(x, S.power > 0 ? 'Posters: BONGO & FRIENDS · GRAND RE-OPENING' : 'The lights are out.', W / 2, TOP + 60, 11, S.power > 0 ? '#6b7280' : '#ef4444', 'center');
    if (S.power <= 0 && Math.floor(S.t * 3) % 2) mascotFace(x, 70, TOP + 120, 24, S.mascots[0], true);
  },
  game: { id: 'remix:arcade-nightshift', title: 'Night Shift: Arcade', emoji: '🕹️', cat: 'remix', colors: ['#1e1b4b', '#7c3aed'],
    help: "Inspired by Five Nights at Freddy's. What's different: a flashlight that eats power but sends a mascot at a lit doorway running, and one cup of coffee per night that makes the clock run double for 30 seconds. Controls: C cameras (1-6 to switch), A/D doors, Q/E lights, F flashlight, K coffee, or click the buttons." },
};

/* ===================== GAME 2: TOY SHOP LOCK-IN ===================== */
const toyshop = {
  intro: 'No doors here. Wear the mask when something is in the room, keep the music box wound, light the vents.',
  officePos: [.5, .95],
  rooms: [
    { id: 'show', name: 'Show room', x: .5, y: .1, props: [[80, 190, 220, 90, '#9d174d']] },
    { id: 'aisle', name: 'Toy aisles', x: .25, y: .35, props: [[30, 140, 50, 130, '#f59e0b'], [110, 140, 50, 130, '#3b82f6'], [190, 140, 50, 130, '#22c55e']] },
    { id: 'gift', name: 'Gift wrap', x: .75, y: .35, props: [[60, 200, 260, 70, '#4c1d95']] },
    { id: 'ventL', name: 'Left vent', x: .2, y: .7 }, { id: 'ventR', name: 'Right vent', x: .8, y: .7 },
    { id: 'hall', name: 'Front hall', x: .5, y: .6 },
  ],
  boxRoom: 'gift',
  mascots: [
    { name: 'Tinsel', col: '#ec4899', shape: 'bunny', path: ['show', 'aisle', 'ventL', 'doorL'], side: 'L', rate: [.3, .45, .55, .65, .75], every: 5.5, patience: 6 },
    { name: 'Button', col: '#3b82f6', shape: 'bear', path: ['show', 'gift', 'ventR', 'doorR'], side: 'R', rate: [.25, .4, .55, .65, .75], every: 5.5, patience: 6 },
    { name: 'Rattle', col: '#eab308', shape: 'bird', eye: '#000', path: ['show', 'aisle', 'hall', 'doorF'], side: 'F', rate: [.2, .4, .5, .6, .7], every: 5, patience: 5 },
    { name: 'Stringer', col: '#111', shape: 'puppet', puppet: true, path: ['gift'], rate: [1] },
  ],
  f: { torchBar: 1, mask: 1, musicBox: 1, ventLights: ['L', 'R'], flashlight: 1 },
  blocked(m, S) { if (m.side === 'F') return S.flash ? 'stun' : S.mask && S.maskT > .8; return S.mask && S.maskT > .8; },
  drawOffice(x, S, h) {
    officeFrame(x, S, h, { wall: '#1f1a2e', deskCol: '#7c2d12' });
    /* vents low on each side */
    for (const side of ['L', 'R']) { const vx = side === 'L' ? 30 : W - 110, lit = S.lights['v' + side]; rr(x, vx, BOT - 150, 80, 50, 6, lit ? '#3b3f4a' : '#0b0c10'); for (let i = 0; i < 4; i++) rr(x, vx + 6, BOT - 144 + i * 11, 68, 4, 2, lit ? '#6b7280' : '#1f2937'); const m = S.mascots.find(q => q.side === side && h.atDoor(q)); if (m && lit) mascotFace(x, vx + 40, BOT - 125, 14, m, true); txt(x, side === 'L' ? 'LEFT VENT' : 'RIGHT VENT', vx + 40, BOT - 158, 9, '#6b7280', 'center'); }
    /* front hall */
    rr(x, 240, TOP + 30, 120, 150, 4, S.flash ? '#3b3f4a' : '#0b0c10'); txt(x, 'FRONT HALL', 300, TOP + 22, 10, '#6b7280', 'center');
    const F = S.mascots.find(q => q.side === 'F'); if (F && S.flash && h.roomOf(F) === 'hall') h.mascotBody(x, 300, TOP + 90, 18, F, true); if (F && h.atDoor(F)) { if (S.flash) h.mascotBody(x, 300, TOP + 110, 26, F, true); else { x.fillStyle = '#fff'; x.beginPath(); x.arc(290, TOP + 100, 3, 0, 7); x.arc(310, TOP + 100, 3, 0, 7); x.fill(); } }
    if (S.mask) { x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, TOP, W, BOT - TOP); x.fillStyle = '#7c3aed'; x.beginPath(); x.ellipse(W / 2, H / 2, 300, 140, 0, 0, 7); x.fill(); x.fillStyle = '#000'; x.beginPath(); x.ellipse(W / 2 - 110, H / 2 - 20, 70, 50, 0, 0, 7); x.ellipse(W / 2 + 110, H / 2 - 20, 70, 50, 0, 0, 7); x.fill(); txt(x, 'mask on', W / 2, H / 2 + 80, 12, '#c4b5fd', 'center'); }
  },
  game: { id: 'remix:toyshop-lockin', title: 'Toy Shop Lock-In', emoji: '🧸', cat: 'remix', colors: ['#3b0764', '#ec4899'],
    help: "Inspired by Five Nights at Freddy's 2. What's different: there are no doors at all – a mask hides you, a music box on the gift-wrap camera must be kept wound or Stringer wakes, and vent lights plus a torch with its own battery reveal what is crawling in. Controls: C cameras, M mask, Q/E vent lights, F torch, W wind (on cam 3), or click." },
};

/* ===================== GAME 3: LIGHTHOUSE WATCH ===================== */
const lighthouse = {
  intro: 'One real threat, many phantoms. Lure the Keeper away with audio, seal vents, reboot what breaks.',
  officePos: [.5, .95],
  rooms: [
    { id: 'lamp', name: 'Lamp room', x: .5, y: .08, props: [[130, 160, 110, 110, '#fbbf24']] },
    { id: 'stair', name: 'Spiral stair', x: .5, y: .3, props: [[60, 150, 250, 20, '#475569'], [90, 190, 250, 20, '#475569'], [60, 230, 250, 20, '#475569']] },
    { id: 'store', name: 'Store room', x: .2, y: .45, props: [[40, 200, 60, 80, '#78350f'], [120, 200, 60, 80, '#78350f']] },
    { id: 'quarters', name: 'Keeper quarters', x: .8, y: .45, props: [[60, 220, 200, 60, '#1e3a8a']] },
    { id: 'ventL', name: 'Left duct', x: .2, y: .7 }, { id: 'ventR', name: 'Right duct', x: .8, y: .7 },
  ],
  mascots: [
    { name: 'The Keeper', col: '#365314', shape: 'bear', eye: '#a3e635', main: true, path: ['lamp', 'stair', 'store', 'ventL', 'doorL'], side: 'L', rate: [.35, .45, .55, .65, .75], every: 5, patience: 6 },
  ],
  f: { systems: 1, lure: 1, seal: ['L', 'R'] },
  blocked(m, S) { return S.sealed === m.side; },
  drawOffice(x, S, h) {
    officeFrame(x, S, h, { wall: '#10201c', floor: '#0a1412', deskCol: '#1f2937' });
    for (const side of ['L', 'R']) { const vx = side === 'L' ? 30 : W - 110; const sealed = S.sealed === side; rr(x, vx, BOT - 170, 80, 70, 6, sealed ? '#334155' : '#0b0c10'); for (let i = 0; i < 5; i++) rr(x, vx + 6, BOT - 164 + i * 13, 68, 5, 2, sealed ? '#64748b' : '#1f2937'); if (sealed) { x.strokeStyle = '#f87171'; x.lineWidth = 3; x.beginPath(); x.moveTo(vx, BOT - 170); x.lineTo(vx + 80, BOT - 100); x.moveTo(vx + 80, BOT - 170); x.lineTo(vx, BOT - 100); x.stroke(); } const m = S.mascots.find(q => q.side === side && h.atDoor(q)); if (m && !sealed) mascotFace(x, vx + 40, BOT - 135, 16, m, true); txt(x, side === 'L' ? 'LEFT DUCT' : 'RIGHT DUCT', vx + 40, BOT - 178, 9, '#6b7280', 'center'); }
    /* window with the beam */
    rr(x, 230, TOP + 30, 140, 110, 8, '#0b1220'); const beam = (S.t * 40) % 280 - 140; x.fillStyle = 'rgba(253,224,71,.25)'; x.beginPath(); x.moveTo(300, TOP + 30); x.lineTo(300 + beam - 30, TOP + 140); x.lineTo(300 + beam + 30, TOP + 140); x.fill();
    txt(x, S.reboot ? 'REBOOT ' + Math.ceil(S.reboot) + 's' : 'Maintenance panel: ' + Object.values(S.systems).filter(v => !v).length + ' fault(s)', W / 2, TOP + 165, 11, S.reboot ? '#38bdf8' : '#6b7280', 'center');
    if (S.lure) txt(x, '🔊 lure → ' + S.lure, W / 2, TOP + 185, 11, '#a3e635', 'center');
  },
  game: { id: 'remix:lighthouse-watch', title: 'Lighthouse Watch', emoji: '🗼', cat: 'remix', colors: ['#052e16', '#a3e635'],
    help: "Inspired by Five Nights at Freddy's 3. What's different: only the Keeper can end your night while phantoms just crash your systems, you can play an audio lure in any room to drag him back, and vent seals time out so you must keep choosing a side. Controls: C cameras, L audio lure (on cams), Q/E seal left/right duct, R reboot, or click." },
};

/* ===================== GAME 4: NURSERY NIGHT ===================== */
const nursery = {
  intro: 'Listen at the doors. If you hear breathing, hold the door – never flash. Check under the bed.',
  officePos: [.5, .95],
  rooms: [
    { id: 'landing', name: 'Landing', x: .5, y: .1 }, { id: 'hallL', name: 'Left hall', x: .2, y: .45 }, { id: 'hallR', name: 'Right hall', x: .8, y: .45 }, { id: 'closet', name: 'Closet', x: .5, y: .55 },
  ],
  mascots: [
    { name: 'Marrow', col: '#7f1d1d', shape: 'bear', eye: '#fca5a5', path: ['landing', 'hallL', 'doorL'], side: 'L', rate: [.3, .45, .55, .65, .75], every: 5, patience: 5 },
    { name: 'Hollow', col: '#312e81', shape: 'bunny', eye: '#c7d2fe', path: ['landing', 'hallR', 'doorR'], side: 'R', rate: [.25, .4, .55, .65, .75], every: 5.5, patience: 5 },
  ],
  f: { doors: ['L', 'R'], holdDoors: 1, flashlight: 1, breathing: 1, bed: 1, noCams: 1 },
  blocked(m, S) {
    const held = m.side === 'L' ? S.holdL : S.holdR;
    if (S.flash) return 'caught';              /* flashing a breather = instant trouble */
    return held;
  },
  drawOffice(x, S, h) {
    S.doors = { L: S.holdL, R: S.holdR };
    officeFrame(x, S, h, { wall: '#1a1424', floor: '#120e1a', desk: false });
    /* bed */
    rr(x, 210, BOT - 130, 180, 90, 10, '#4c1d95'); rr(x, 220, BOT - 145, 60, 30, 6, '#e9d5ff'); rr(x, 215, BOT - 100, 170, 55, 8, '#6d28d9');
    if (S.plushies) for (let i = 0; i < S.plushies; i++) mascotFace(x, 240 + i * 45, BOT - 30, 10, { col: '#a78bfa', shape: 'bear' }, true);
    txt(x, 'bed (B) · checked ' + Math.floor(S.bed) + 's ago', 300, BOT - 8, 9, S.bed > 18 ? '#f87171' : '#6b7280', 'center');
    for (const side of ['L', 'R']) {
      const m = S.mascots.find(q => q.side === side);
      doorway(x, S, h, side, h.atDoor(m) && S.flash ? m : null, { always: 1 });
      const b = S.breath[side === 'L' ? 'left' : 'right']; const dx = side === 'L' ? 75 : W - 75;
      if (b > 0) { x.strokeStyle = `rgba(248,113,113,${b})`; x.lineWidth = 2; x.beginPath(); for (let i = 0; i < 60; i++) { const px = dx - 30 + i, py = BOT - 200 + Math.sin(i * .5 + S.t * 12) * 10 * b; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); txt(x, 'breathing', dx, BOT - 215, 9, '#f87171', 'center'); }
      if (S.flash && h.atDoor(m)) { x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(side === 'L' ? 20 : W - 130, TOP + 30, 110, BOT - TOP - 60); }
    }
    if (S.flash) { x.fillStyle = 'rgba(253,224,71,.07)'; x.fillRect(0, TOP, W, BOT - TOP); }
    txt(x, 'Hold A / D (or hold the door buttons) to keep a door shut', W / 2, TOP + 24, 10, '#6b7280', 'center');
  },
  game: { id: 'remix:nursery-night', title: 'Nursery Night', emoji: '🛏️', cat: 'remix', colors: ['#2e1065', '#f87171'],
    help: "Inspired by Five Nights at Freddy's 4. What's different: a drawn sound-wave shows which door is breathing and flashing a breather is what gets you caught, plus a plush colony under the bed that you must clear every twenty seconds or so. Controls: hold A/D to hold doors, F flashlight (only when it's quiet), B check bed. No cameras." },
};

const cfgs = [arcade, toyshop, lighthouse, nursery];
for (const cfg of cfgs) {
  const g = cfg.game;
  g.run = (stage, api) => night(stage, api, cfg);
}
GAMES.push(...cfgs.map(c => c.game));

})();
