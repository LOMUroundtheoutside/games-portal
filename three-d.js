/* ---------- 3D games: real WebGL scenes built on three.js (lib/three.min.js, r134) ----------
   Every game here is a proper 3D scene with a perspective camera, lights and meshes,
   not a 2D canvas faking depth. Shared helpers live in T3; each game pushes a normal
   portal game object (id / title / help / run) with cat: '3d'. */
(function () {
'use strict';

const R = n => Math.floor(Math.random() * n);
const rand = (a, b) => a + Math.random() * (b - a);
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapA = d => Math.atan2(Math.sin(d), Math.cos(d));

const T3 = {
  ready(api) {
    if (typeof THREE !== 'undefined') return true;
    api.overlay('<b>3D library missing</b>lib/three.min.js did not load.<br><small>Reload the page and try again</small>');
    return false;
  },
  /* renderer + scene + camera sized to the player stage; resizes with fullscreen; disposes on stop */
  view(api, stage, o = {}) {
    const W = Math.max(320, stage.clientWidth || 900), H = Math.max(300, stage.clientHeight || 520);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(W, H);
    const cv = renderer.domElement;
    cv.style.imageRendering = 'auto'; cv.style.display = 'block'; cv.style.touchAction = 'none';
    stage.appendChild(cv);
    const scene = new THREE.Scene();
    const sky = o.sky == null ? 0x87b8e8 : o.sky;
    scene.background = new THREE.Color(sky);
    if (o.fog) scene.fog = new THREE.Fog(sky, o.fog[0], o.fog[1]);
    const camera = new THREE.PerspectiveCamera(o.fov || 60, W / H, .1, o.far || 600);
    const resize = () => { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    api.on(window, 'resize', resize);
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(resize); ro.observe(stage); }
    const stop = api.stop;
    api.stop = () => { if (ro) ro.disconnect(); renderer.dispose(); stop(); };
    const hud = document.createElement('div'); hud.className = 'hud3d'; stage.appendChild(hud);
    return {
      renderer, scene, camera, hud, canvas: cv,
      render() { renderer.render(scene, camera); },
      light(k = 1) {
        const hemi = new THREE.HemisphereLight(0xffffff, 0x334155, .75 * k);
        const sun = new THREE.DirectionalLight(0xffffff, .9 * k); sun.position.set(30, 60, 20);
        scene.add(hemi, sun); return sun;
      },
      ndc(e) { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / (r.width || 1)) * 2 - 1, y: -((e.clientY - r.top) / (r.height || 1)) * 2 + 1 }; },
    };
  },
  keys(api) {
    const k = {};
    const name = e => e.key.length === 1 ? e.key.toLowerCase() : e.key;
    api.onKey(e => { k[name(e)] = true; if (/^Arrow|^ $/.test(e.key)) e.preventDefault(); });
    api.onKeyUp(e => { k[name(e)] = false; });
    api.on(window, 'blur', () => { for (const x in k) k[x] = false; });
    return k;
  },
  mesh(geo, color, extra) { return new THREE.Mesh(geo, new THREE.MeshLambertMaterial(Object.assign({ color }, extra || {}))); },
  box(w, h, d, color, extra) { return T3.mesh(new THREE.BoxGeometry(w, h, d), color, extra); },
  hsl(h, s, l) { return new THREE.Color().setHSL(((h % 1) + 1) % 1, s, l); },
  fmt(ms) { const s = Math.max(0, ms) / 1000; return (s / 60 | 0) + ':' + (s % 60).toFixed(2).padStart(5, '0'); },
  isRestart: e => e.key === ' ' || e.key === 'Enter',
};

GAMES.push(

/* ===== SLOPE BALL 3D ===== */
{ id: '3d:slope', title: 'Slope Ball 3D', emoji: '🟢', cat: '3d', colors: ['#22c55e', '#0ea5e9'],
  help: 'A real 3D rolling ball in the spirit of Slope. Steer round the red blocks and stay on the road: it only gets faster. Controls: ← → or A/D to steer (or hold the left/right half of the screen), Space / tap to restart.',
  run(stage, api) {
    if (!T3.ready(api)) return;
    const v = T3.view(api, stage, { sky: 0x070b1a, fog: [30, 150], fov: 72 });
    v.light(1.1);
    const K = T3.keys(api);
    const ROAD = 14, SEG = 12, NSEG = 16;
    const floorGeo = new THREE.BoxGeometry(ROAD, 1, SEG), obGeo = new THREE.BoxGeometry(2.2, 2.2, 2.2);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const obMat = new THREE.MeshLambertMaterial({ color: 0xef4444, emissive: 0x7f1d1d });
    const edgeGeo = new THREE.BoxGeometry(.35, .12, SEG), edgeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const segs = [];
    for (let i = 0; i < NSEG; i++) {
      const g = new THREE.Group();
      const f = new THREE.Mesh(floorGeo, floorMat); f.position.y = -.5; g.add(f);
      const l = new THREE.Mesh(edgeGeo, edgeMat); l.position.set(-ROAD / 2, .06, 0); g.add(l);
      const r = new THREE.Mesh(edgeGeo, edgeMat); r.position.set(ROAD / 2, .06, 0); g.add(r);
      g.userData.obs = []; v.scene.add(g); segs.push(g);
    }
    const ball = T3.mesh(new THREE.SphereGeometry(.8, 24, 18), 0x22c55e, { emissive: 0x064e3b });
    v.scene.add(ball);
    let x, z, vx, speed, dist, alive, vy, hold = 0;
    function fill(g, idx) {
      g.userData.obs.forEach(o => g.remove(o)); g.userData.obs = [];
      if (idx < 4) return;
      const n = Math.min(4, 1 + Math.floor(idx / 12));
      for (let i = 0; i < n; i++) {
        const o = new THREE.Mesh(obGeo, obMat);
        o.position.set(rand(-1, 1) * (ROAD - 3) / 2, 1.1, rand(-1, 1) * (SEG - 3) / 2);
        g.add(o); g.userData.obs.push(o);
      }
    }
    function reset() {
      x = 0; z = 0; vx = 0; vy = 0; speed = 16; dist = 0; alive = true;
      segs.forEach((g, i) => { g.position.z = -i * SEG; g.userData.idx = i; fill(g, i); });
      ball.position.set(0, .8, 0); api.overlay(null); api.score(0);
    }
    function crash(msg) {
      alive = false; api.beep(110, .35);
      api.overlay(`<b>${msg}</b>${Math.floor(dist / 5)} points<br><small>Space / tap to restart</small>`);
    }
    api.onKey(e => { if (!alive && T3.isRestart(e)) reset(); });
    api.on(stage, 'pointerdown', e => { if (alive) hold = v.ndc(e).x < 0 ? -1 : 1; else reset(); });
    api.onMove(e => { if (hold) hold = v.ndc(e).x < 0 ? -1 : 1; });
    api.on(window, 'pointerup', () => { hold = 0; });
    api.onRestart(reset);
    api.loop(dtms => {
      const dt = dtms / 1000;
      if (alive) {
        const steer = ((K.ArrowLeft || K.a) ? -1 : 0) + ((K.ArrowRight || K.d) ? 1 : 0) || hold;
        vx += (steer * 16 - vx) * Math.min(1, dt * 8);
        x += vx * dt; z -= speed * dt; dist += speed * dt; speed = Math.min(48, speed + dt * .9);
        ball.position.set(x, .8, z); ball.rotation.x -= speed * dt / .8;
        if (Math.abs(x) > ROAD / 2) crash('Off the edge');
        for (const g of segs) for (const o of g.userData.obs) {
          if (Math.abs(g.position.z + o.position.z - z) < 1.9 && Math.abs(o.position.x - x) < 1.9) { crash('Crashed'); break; }
        }
        for (const g of segs) if (g.position.z > z + SEG * 1.5) { g.position.z -= NSEG * SEG; g.userData.idx += NSEG; fill(g, g.userData.idx); }
        api.score(Math.floor(dist / 5));
      } else if (Math.abs(x) > ROAD / 2 && ball.position.y > -30) { vy -= 30 * dt; ball.position.y += vy * dt; ball.position.z -= speed * .3 * dt; }
      v.camera.position.set(x * .6, 5.5, z + 10); v.camera.lookAt(x, 1, z - 8);
      v.hud.textContent = `${Math.floor(dist / 5)} pts · ${Math.round(speed * 3)} km/h`;
      v.render();
    });
    reset();
  } },

/* ===== STACK TOWER 3D ===== */
{ id: '3d:stack', title: 'Stack Tower 3D', emoji: '🏗️', cat: '3d', colors: ['#f472b6', '#8b5cf6'],
  help: 'Build the tallest tower you can. Each block slides across; drop it on the one below and the overhang is sliced off, so the blocks shrink with every miss. Land it dead centre for a perfect and it keeps its size. Controls: Space, click or tap to drop.',
  run(stage, api) {
    if (!T3.ready(api)) return;
    const v = T3.view(api, stage, { sky: 0xfdf2f8, fov: 40, far: 300 });
    v.light();
    const SIZE0 = 6, H = 1;
    let blocks, cur, axis, dir, speed, n, alive, camY, debris, streak;
    const tower = new THREE.Group(); v.scene.add(tower);
    const color = i => T3.hsl(.85 + i * .035, .65, .6);
    function reset() {
      while (tower.children.length) tower.remove(tower.children[0]);
      blocks = []; debris = []; n = 0; alive = true; speed = 7; camY = 0; streak = 0;
      const base = T3.box(SIZE0, H, SIZE0, color(0)); base.position.set(0, -H / 2, 0);
      base.userData = { x: 0, z: 0, w: SIZE0, d: SIZE0 }; tower.add(base); blocks.push(base);
      spawn(); api.overlay(null); api.score(0);
    }
    function spawn() {
      const prev = blocks[blocks.length - 1].userData;
      axis = blocks.length % 2 ? 'x' : 'z'; dir = 1;
      cur = T3.box(prev.w, H, prev.d, color(blocks.length));
      cur.userData = { x: prev.x, z: prev.z, w: prev.w, d: prev.d };
      cur.position.set(prev.x, blocks.length * H - H / 2, prev.z);
      cur.position[axis] -= 10;
      tower.add(cur);
    }
    function fall(m, sx, sz) { debris.push({ m, vy: 0, sx, sz, t: 0 }); }
    function drop() {
      if (!alive || !cur) return;
      const prev = blocks[blocks.length - 1].userData, u = cur.userData;
      const q = prev[axis], size = axis === 'x' ? prev.w : prev.d;
      let delta = cur.position[axis] - q;
      if (Math.abs(delta) < .3) { delta = 0; streak++; api.beep(600 + streak * 60, .08); } else streak = 0;
      const overlap = size - Math.abs(delta);
      if (overlap <= 0) {
        alive = false; fall(cur, Math.sign(delta) * (axis === 'x'), Math.sign(delta) * (axis === 'z')); cur = null; api.beep(110, .4);
        api.overlay(`<b>Tower fell</b>${n} blocks high<br><small>Space / tap to restart</small>`); return;
      }
      if (delta !== 0) {
        const cut = Math.abs(delta);
        const piece = T3.box(axis === 'x' ? cut : u.w, H, axis === 'z' ? cut : u.d, cur.material.color);
        piece.position.copy(cur.position);
        piece.position[axis] = q + Math.sign(delta) * (size / 2 + cut / 2);
        tower.add(piece); fall(piece, axis === 'x' ? Math.sign(delta) : 0, axis === 'z' ? Math.sign(delta) : 0);
        api.beep(380, .05);
      }
      if (axis === 'x') { u.w = overlap; u.x = q + delta / 2; } else { u.d = overlap; u.z = q + delta / 2; }
      cur.geometry.dispose(); cur.geometry = new THREE.BoxGeometry(u.w, H, u.d);
      cur.position.x = u.x; cur.position.z = u.z;
      blocks.push(cur); n++; api.score(n);
      speed = Math.min(16, 7 + n * .25);
      spawn();
    }
    api.onKey(e => { if (T3.isRestart(e)) { e.preventDefault(); alive ? drop() : reset(); } });
    api.onTap(() => alive ? drop() : reset());
    api.onRestart(reset);
    api.loop(dtms => {
      const dt = dtms / 1000;
      if (alive && cur) {
        cur.position[axis] += dir * speed * dt;
        const c = blocks[blocks.length - 1].userData[axis];
        if (cur.position[axis] > c + 10) dir = -1; else if (cur.position[axis] < c - 10) dir = 1;
      }
      for (const d of debris) {
        d.vy -= 30 * dt; d.m.position.y += d.vy * dt; d.m.position.x += d.sx * 4 * dt; d.m.position.z += d.sz * 4 * dt;
        d.m.rotation.x += d.sz * 3 * dt; d.m.rotation.z -= d.sx * 3 * dt; d.t += dt;
        if (d.t > 2.5) { tower.remove(d.m); d.m.geometry.dispose(); }
      }
      debris = debris.filter(d => d.t <= 2.5);
      const top = blocks[blocks.length - 1].userData;
      camY += (blocks.length * H - camY) * Math.min(1, dt * 4);
      v.camera.position.set(top.x + 16, camY + 14, top.z + 16); v.camera.lookAt(top.x, camY, top.z);
      v.hud.textContent = `${n} blocks${streak > 1 ? ` · ×${streak} perfect!` : ''}`;
      v.render();
    });
    reset();
  } },

/* ===== ASTEROID BLASTER 3D ===== */
{ id: '3d:blaster', title: 'Asteroid Blaster 3D', emoji: '☄️', cat: '3d', colors: ['#f97316', '#1e1b4b'],
  help: 'You are the gunner. Asteroids tumble straight at you out of deep space: aim and blast them before they hit. Small ones score more. Three hits on the ship and it is over. Controls: move the mouse to aim (arrow keys nudge it), click or Space to fire.',
  run(stage, api) {
    if (!T3.ready(api)) return;
    const v = T3.view(api, stage, { sky: 0x02030a, fov: 70, far: 500 });
    v.light(.9);
    const K = T3.keys(api);
    const sp = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) { const th = rand(0, Math.PI * 2), ph = rand(-1, 1), r = rand(150, 400); sp[i * 3] = r * Math.cos(th) * Math.sqrt(1 - ph * ph); sp[i * 3 + 1] = r * ph; sp[i * 3 + 2] = -Math.abs(r * Math.sin(th)) - 20; }
    const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    v.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.4 })));
    const cross = new THREE.Mesh(new THREE.RingGeometry(.35, .5, 24), new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: .9 })); v.scene.add(cross);
    const gun = T3.box(.36, .3, 2.2, 0x94a3b8, { emissive: 0x1e293b }); gun.position.set(0, -2.4, -6.5); v.scene.add(gun);
    const rockGeo = new THREE.IcosahedronGeometry(1, 0);
    const rockMat = new THREE.MeshPhongMaterial({ color: 0xa89f8f, emissive: 0x2a2520, flatShading: true, shininess: 10 });
    const boltGeo = new THREE.BoxGeometry(.14, .14, 2.6), boltMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const bitGeo = new THREE.TetrahedronGeometry(.35), bitMat = new THREE.MeshBasicMaterial({ color: 0xfb923c });
    const FWD = new THREE.Vector3(0, 0, 1);
    let rocks, bolts, bits, score, lives, alive, t, spawnT, cool, shake, aimN = { x: 0, y: .1 };
    const aim = new THREE.Vector3();
    function reset() {
      [rocks || [], bolts || [], bits || []].forEach(a => a.forEach(o => v.scene.remove(o.m)));
      rocks = []; bolts = []; bits = []; score = 0; lives = 3; alive = true; t = 0; spawnT = 0; cool = 0; shake = 0;
      api.overlay(null); api.score(0);
    }
    function aimDir() { aim.set(clampN(aimN.x, -1, 1), clampN(aimN.y, -1, 1), .5).unproject(v.camera).sub(v.camera.position).normalize(); return aim; }
    function fire() {
      if (!alive || cool > 0) return; cool = .16;
      const d = aimDir().clone();
      const m = new THREE.Mesh(boltGeo, boltMat); m.position.set(0, -2.2, -6.5); m.quaternion.setFromUnitVectors(FWD, d);
      v.scene.add(m); bolts.push({ m, vel: d.multiplyScalar(140), life: 2.5 }); api.beep(880, .04);
    }
    function spawn() {
      const m = new THREE.Mesh(rockGeo, rockMat); const r = rand(1, 3);
      m.scale.setScalar(r); m.position.set(rand(-45, 45), rand(-28, 28), -240);
      const target = new THREE.Vector3(rand(-3, 3), rand(-3, 3), 0);
      const vel = target.sub(m.position).normalize().multiplyScalar(rand(26, 40) + t * .5);
      v.scene.add(m); rocks.push({ m, vel, r, spin: new THREE.Vector3(rand(-2, 2), rand(-2, 2), rand(-2, 2)) });
    }
    function explode(p, r) {
      for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(bitGeo, bitMat); m.position.copy(p); m.scale.setScalar(r * .6); v.scene.add(m); bits.push({ m, vel: new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(8, 22)), life: .8 }); }
    }
    api.onMove(e => { aimN = v.ndc(e); });
    api.on(stage, 'pointerdown', e => { if (e.button && e.button !== 0) return; if (alive) { aimN = v.ndc(e); fire(); } else reset(); });
    api.onKey(e => { if (T3.isRestart(e)) { e.preventDefault(); alive ? fire() : reset(); } });
    api.onRestart(reset);
    api.loop(dtms => {
      const dt = dtms / 1000; t += dt; cool -= dt;
      if (K.ArrowLeft) aimN.x -= dt * 1.2; if (K.ArrowRight) aimN.x += dt * 1.2; if (K.ArrowUp) aimN.y += dt * 1.2; if (K.ArrowDown) aimN.y -= dt * 1.2;
      if (K[' '] && alive) fire();
      shake = Math.max(0, shake - dt * 1.5);
      v.camera.position.set(rand(-1, 1) * shake, rand(-1, 1) * shake, 0); v.camera.lookAt(0, 0, -100);
      if (alive) {
        spawnT -= dt; if (spawnT <= 0) { spawn(); spawnT = Math.max(.45, 1.5 - t * .02); }
        for (const b of bolts) { b.m.position.addScaledVector(b.vel, dt); b.life -= dt; }
        for (const rk of rocks) {
          rk.m.position.addScaledVector(rk.vel, dt); rk.m.rotation.x += rk.spin.x * dt; rk.m.rotation.y += rk.spin.y * dt;
          for (const b of bolts) if (b.life > 0 && b.m.position.distanceTo(rk.m.position) < rk.r + .5) {
            b.life = 0; rk.dead = true; explode(rk.m.position, rk.r); score += Math.round(30 / rk.r) * 5; api.score(score); api.beep(200 + rk.r * 80, .12); break;
          }
          if (!rk.dead && rk.m.position.z > 0) {
            rk.dead = true;
            if (rk.m.position.length() < 5) { lives--; shake = 1.2; api.beep(90, .4); if (lives <= 0) { alive = false; api.overlay(`<b>Ship destroyed</b>Score ${score}<br><small>Space / tap to restart</small>`); } }
          }
        }
        rocks = rocks.filter(rk => { if (rk.dead) v.scene.remove(rk.m); return !rk.dead; });
        bolts = bolts.filter(b => { if (b.life <= 0) v.scene.remove(b.m); return b.life > 0; });
      }
      for (const b of bits) { b.m.position.addScaledVector(b.vel, dt); b.life -= dt; b.m.scale.multiplyScalar(.96); }
      bits = bits.filter(b => { if (b.life <= 0) v.scene.remove(b.m); return b.life > 0; });
      cross.position.copy(aimDir()).multiplyScalar(14).add(v.camera.position); cross.lookAt(v.camera.position);
      gun.quaternion.setFromUnitVectors(FWD, aim.clone().negate());
      v.hud.textContent = `Score ${score}   ${'♥'.repeat(Math.max(0, lives))}${'♡'.repeat(3 - Math.max(0, lives))}   wave ${1 + (t / 20 | 0)}`;
      v.render();
    });
    reset();
  } },

/* ===== MAZE ESCAPE 3D ===== */
{ id: '3d:maze', title: 'Maze Escape 3D', emoji: '🧱', cat: '3d', colors: ['#84cc16', '#365314'],
  help: 'A first-person maze. You start in one corner; the tall green beacon marks the way out and it shows above the walls, so keep steering towards it. Every escape brings a bigger maze and the faster you are the more points you bank. Controls: W/S or ↑/↓ to walk, A/D or ←/→ to turn, drag the mouse to look around.',
  run(stage, api) {
    if (!T3.ready(api)) return;
    const v = T3.view(api, stage, { sky: 0x9fc5e8, fog: [8, 45], fov: 75, far: 120 });
    v.light(1);
    const K = T3.keys(api);
    const wallGeo = new THREE.BoxGeometry(1, 2.2, 1);
    const bc = document.createElement('canvas'); bc.width = bc.height = 64; const bx = bc.getContext('2d');
    bx.fillStyle = '#d6d3d1'; bx.fillRect(0, 0, 64, 64); bx.fillStyle = '#c2410c';
    for (let row = 0; row < 4; row++) for (let col = -1; col < 3; col++) bx.fillRect(col * 32 + (row % 2) * 16 + 2, row * 16 + 2, 28, 12);
    const brick = new THREE.CanvasTexture(bc); brick.wrapS = brick.wrapT = THREE.RepeatWrapping; brick.repeat.set(1, 2.2);
    const wallMats = [new THREE.MeshLambertMaterial({ map: brick }), new THREE.MeshLambertMaterial({ map: brick, color: 0xd9c4b0 })];
    const world = new THREE.Group(); v.scene.add(world);
    let N, cells, px, pz, ang, level, t0, score, won, exit, endT;
    function gen(n) {
      const g = Array.from({ length: n }, () => Array(n).fill(1));
      const stack = [[1, 1]]; g[1][1] = 0;
      while (stack.length) {
        const [cx, cz] = stack[stack.length - 1];
        const opts = [[2, 0], [-2, 0], [0, 2], [0, -2]].filter(([dx, dz]) => { const nx = cx + dx, nz = cz + dz; return nx > 0 && nz > 0 && nx < n - 1 && nz < n - 1 && g[nz][nx] === 1; });
        if (!opts.length) { stack.pop(); continue; }
        const [dx, dz] = opts[R(opts.length)];
        g[cz + dz / 2][cx + dx / 2] = 0; g[cz + dz][cx + dx] = 0; stack.push([cx + dx, cz + dz]);
      }
      return g;
    }
    function build(n) {
      while (world.children.length) world.remove(world.children[0]);
      N = n; cells = gen(n);
      const floor = T3.mesh(new THREE.PlaneGeometry(n, n), 0x6b7280); floor.rotation.x = -Math.PI / 2; floor.position.set(n / 2, 0, n / 2); world.add(floor);
      for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) if (cells[z][x]) { const w = new THREE.Mesh(wallGeo, wallMats[(x * 7 + z * 3) % 2]); w.position.set(x + .5, 1.1, z + .5); world.add(w); }
      exit = { x: n - 1.5, z: n - 1.5 };
      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, 14, 12), new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: .85 })); beacon.position.set(exit.x, 7, exit.z); world.add(beacon);
      const pad = T3.mesh(new THREE.CylinderGeometry(.45, .45, .1, 16), 0x22c55e, { emissive: 0x166534 }); pad.position.set(exit.x, .05, exit.z); world.add(pad);
      px = 1.5; pz = 1.5; ang = cells[1][2] === 0 ? Math.PI / 2 : Math.PI;
      t0 = performance.now(); won = false;
    }
    function free(x, z) {
      const r = .28;
      for (const [ox, oz] of [[r, r], [-r, r], [r, -r], [-r, -r]]) { const cx = Math.floor(x + ox), cz = Math.floor(z + oz); if (cx < 0 || cz < 0 || cx >= N || cz >= N || cells[cz][cx]) return false; }
      return true;
    }
    function next() { level++; build(Math.min(31, 9 + level * 2)); api.overlay(null); }
    let drag = null;
    api.on(stage, 'pointerdown', e => { if (won) { next(); return; } drag = e.clientX; });
    api.on(window, 'pointerup', () => { drag = null; });
    api.onMove(e => { if (drag != null && !won) { ang += (e.clientX - drag) * .005; drag = e.clientX; } });
    api.onKey(e => { if (won && T3.isRestart(e)) next(); });
    api.onRestart(() => { level = 0; score = 0; api.score(0); next(); });
    api.loop(dtms => {
      const dt = dtms / 1000;
      if (!won) {
        const turn = ((K.a || K.ArrowLeft) ? -1 : 0) + ((K.d || K.ArrowRight) ? 1 : 0);
        const move = ((K.w || K.ArrowUp) ? 1 : 0) + ((K.s || K.ArrowDown) ? -1 : 0);
        ang += turn * 2.4 * dt;
        const fx = Math.sin(ang), fz = -Math.cos(ang), s = 3.4 * move * dt;
        if (free(px + fx * s, pz)) px += fx * s;
        if (free(px, pz + fz * s)) pz += fz * s;
        if (Math.hypot(px - exit.x, pz - exit.z) < .5) {
          won = true; endT = performance.now(); const secs = (endT - t0) / 1000;
          const gained = 100 + Math.max(0, Math.round(200 - secs * 2)); score += gained; api.score(score); api.beep(880, .2);
          api.overlay(`<b>Escaped!</b>Level ${level} in ${secs.toFixed(1)}s · +${gained}<br><small>Space / tap for a bigger maze</small>`);
        }
      }
      v.camera.position.set(px, 1, pz); v.camera.lookAt(px + Math.sin(ang), 1, pz - Math.cos(ang));
      const secs = ((won ? endT : performance.now()) - t0) / 1000;
      v.hud.textContent = `Level ${level} · ${N - 2}×${N - 2} maze\n${secs.toFixed(1)}s · score ${score}`;
      v.render();
    });
    level = 0; score = 0; next();
  } },

/* ===== KART CIRCUIT 3D ===== */
{ id: '3d:kart', title: 'Kart Circuit 3D', emoji: '🏁', cat: '3d', colors: ['#ef4444', '#facc15'],
  help: 'A three-lap race round a proper 3D circuit against two rival karts. Brake for the bends and stay on the tarmac: the grass is slow. Finish first for the big points, and quicker races score more. Controls: W/↑ accelerate, S/↓ brake and reverse, A/D or ←/→ steer, Space / tap to restart.',
  run(stage, api) {
    if (!T3.ready(api)) return;
    const v = T3.view(api, stage, { sky: 0x93c5fd, fog: [90, 280], fov: 65, far: 420 });
    v.light(1.1);
    const K = T3.keys(api);
    const pts = [[0, -45], [40, -55], [70, -25], [55, 15], [25, 30], [5, 65], [-40, 55], [-70, 10], [-45, -30]].map(([x, z]) => new THREE.Vector3(x, 0, z));
    const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', .5);
    const M = 360, W = 11, L = curve.getLength();
    const P = [], T = [], NR = [];
    for (let i = 0; i < M; i++) { const t = i / M; P.push(curve.getPointAt(t)); const tg = curve.getTangentAt(t).normalize(); T.push(tg); NR.push(new THREE.Vector3(-tg.z, 0, tg.x)); }
    const ground = T3.mesh(new THREE.PlaneGeometry(700, 700), 0x4d7c0f); ground.rotation.x = -Math.PI / 2; ground.position.y = -.05; v.scene.add(ground);
    function ribbon(a, b, y, colorAt) {
      const pos = new Float32Array(M * 2 * 3), col = new Float32Array(M * 2 * 3), idx = [];
      for (let i = 0; i < M; i++) {
        const c = colorAt(i);
        [a, b].forEach((off, k) => { const j = (i * 2 + k) * 3; pos[j] = P[i].x + NR[i].x * off; pos[j + 1] = y; pos[j + 2] = P[i].z + NR[i].z * off; col[j] = c.r; col[j + 1] = c.g; col[j + 2] = c.b; });
        const n = (i + 1) % M; idx.push(i * 2, n * 2, i * 2 + 1, i * 2 + 1, n * 2, n * 2 + 1);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
      v.scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    }
    const asphalt = new THREE.Color(0x374151), red = new THREE.Color(0xdc2626), white = new THREE.Color(0xf8fafc);
    ribbon(-W / 2, W / 2, 0, () => asphalt);
    ribbon(W / 2, W / 2 + 1.2, .02, i => (i % 8 < 4 ? red : white));
    ribbon(-W / 2 - 1.2, -W / 2, .02, i => (i % 8 < 4 ? red : white));
    const start = T3.box(W, .04, 1.2, 0xffffff); start.position.copy(P[0]); start.position.y = .03; start.rotation.y = Math.atan2(T[0].x, T[0].z); v.scene.add(start);
    [-1, 1].forEach(s => { const pole = T3.box(.3, 6, .3, 0x1f2937); pole.position.copy(P[0]).addScaledVector(NR[0], s * (W / 2 + 1.5)); pole.position.y = 3; v.scene.add(pole); });
    const bar = T3.box(W + 3.3, .6, .4, 0xfacc15); bar.position.copy(P[0]); bar.position.y = 6; bar.rotation.y = Math.atan2(T[0].x, T[0].z); v.scene.add(bar);
    const trunkGeo = new THREE.CylinderGeometry(.3, .4, 2, 6), leafGeo = new THREE.ConeGeometry(2, 5, 7);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x78350f }), leafMat = new THREE.MeshLambertMaterial({ color: 0x166534 });
    for (let i = 0; i < 90; i++) {
      const x = rand(-130, 130), z = rand(-110, 120);
      let ok = true; for (let j = 0; j < M; j += 4) if (Math.hypot(P[j].x - x, P[j].z - z) < W / 2 + 4) { ok = false; break; }
      if (!ok) continue;
      const tr = new THREE.Mesh(trunkGeo, trunkMat); tr.position.set(x, 1, z); const lf = new THREE.Mesh(leafGeo, leafMat); lf.position.set(x, 4.5, z); v.scene.add(tr, lf);
    }
    const wheelGeo = new THREE.CylinderGeometry(.42, .42, .4, 12), wheelMat = new THREE.MeshLambertMaterial({ color: 0x111827 });
    function kart(color) {
      const g = new THREE.Group();
      const body = T3.box(1.8, .6, 3.2, color); body.position.y = .6; g.add(body);
      const cab = T3.box(1.2, .55, 1.2, 0x1f2937); cab.position.set(0, 1.15, -.2); g.add(cab);
      const nose = T3.box(1.2, .3, .8, color); nose.position.set(0, .45, 1.9); g.add(nose);
      g.userData.wheels = [];
      [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => { const w = new THREE.Mesh(wheelGeo, wheelMat); w.rotation.z = Math.PI / 2; w.position.set(sx * 1.05, .42, sz * 1.1); g.add(w); g.userData.wheels.push(w); });
      v.scene.add(g); return g;
    }
    const ang0 = Math.atan2(T[0].x, T[0].z);
    const me = { g: kart(0xef4444), x: 0, z: 0, ang: ang0, v: 0, idx: 0, lap: 0, half: false, done: false, finish: 0 };
    const ais = [{ g: kart(0x2563eb), sp: 25.5, off: 2.6, d: -6, done: false, finish: 0 }, { g: kart(0x16a34a), sp: 23.5, off: -.2, d: -12, done: false, finish: 0 }];
    let t, started, over, finished;
    function reset() {
      t = -3; started = false; over = false; finished = 0;
      me.x = P[0].x - NR[0].x * 2.8; me.z = P[0].z - NR[0].z * 2.8; me.ang = ang0; me.v = 0; me.idx = 0; me.lap = 0; me.half = false; me.done = false;
      ais.forEach((a, i) => { a.d = -6 - i * 6; a.done = false; });
      v.camera.position.set(me.x - Math.sin(ang0) * 9, 4.5, me.z - Math.cos(ang0) * 9);
      api.overlay(null); api.score(0);
    }
    function nearest(x, z, from) {
      let best = from, bd = Infinity;
      for (let k = -14; k <= 14; k++) { const j = (from + k + M) % M; const d = (P[j].x - x) ** 2 + (P[j].z - z) ** 2; if (d < bd) { bd = d; best = j; } }
      return best;
    }
    function placeAi(a) {
      const u = ((a.d / L) % 1 + 1) % 1; const p = curve.getPointAt(u), tg = curve.getTangentAt(u);
      const off = a.off + Math.sin(a.d * .05) * 1.2;
      a.g.position.set(p.x - tg.z * off, 0, p.z + tg.x * off); a.g.rotation.y = Math.atan2(tg.x, tg.z);
    }
    api.onKey(e => { if (over && T3.isRestart(e)) reset(); });
    api.onTap(() => { if (over) reset(); });
    api.onRestart(reset);
    api.loop(dtms => {
      const dt = dtms / 1000; const pt = t; t += dt;
      if (!started && t >= 0) { started = true; api.beep(880, .25); }
      else if (!started && Math.floor(pt) !== Math.floor(t)) api.beep(440, .12);
      if (started && !over) {
        const acc = (K.w || K.ArrowUp) ? 1 : (K.s || K.ArrowDown) ? -1 : 0;
        const steer = ((K.a || K.ArrowLeft) ? -1 : 0) + ((K.d || K.ArrowRight) ? 1 : 0);
        me.idx = nearest(me.x, me.z, me.idx);
        const lateral = Math.abs((me.x - P[me.idx].x) * NR[me.idx].x + (me.z - P[me.idx].z) * NR[me.idx].z);
        const onTrack = lateral < W / 2 + .4, maxV = onTrack ? 34 : 13;
        if (acc > 0) me.v += 18 * dt; else if (acc < 0) me.v -= (me.v > 0 ? 30 : 10) * dt; else me.v -= Math.sign(me.v) * Math.min(Math.abs(me.v), 6 * dt);
        me.v -= Math.abs(steer) * 4 * dt * Math.max(0, me.v / 34);
        me.v = Math.max(-8, Math.min(me.v, Math.max(maxV, me.v - 28 * dt)));
        me.ang -= steer * 2.3 * dt * clampN(me.v / 12, -1, 1);
        const fx = Math.sin(me.ang), fz = Math.cos(me.ang);
        me.x += fx * me.v * dt; me.z += fz * me.v * dt;
        const nidx = nearest(me.x, me.z, me.idx);
        if (nidx > M * .4 && nidx < M * .6) me.half = true;
        if (me.idx > M * .8 && nidx < M * .2 && me.half) { me.lap++; me.half = false; api.beep(660, .15); if (me.lap >= 3) { me.done = true; me.finish = t; } }
        me.idx = nidx;
        me.g.position.set(me.x, 0, me.z); me.g.rotation.y = me.ang; me.g.userData.wheels.forEach(w => { w.rotation.x += me.v * dt / .42; });
        ais.forEach(a => { if (!a.done) { a.d += a.sp * (1 + Math.sin(a.d * .02) * .06) * dt; if (a.d >= 3 * L) { a.done = true; a.finish = t; finished++; } } placeAi(a); });
        if (me.done) {
          over = true; const pos = 1 + ais.filter(a => a.done).length;
          const pts = [300, 150, 50][pos - 1] + Math.max(0, 200 - Math.floor(me.finish)); api.score(pts); api.beep(pos === 1 ? 1200 : 500, .3);
          api.overlay(`<b>${['🥇 You win!', '🥈 2nd place', '🥉 3rd place'][pos - 1]}</b>Race time ${T3.fmt(me.finish * 1000)} · ${pts} points<br><small>Space / tap to race again</small>`);
        }
      } else if (!started) { me.g.position.set(me.x, 0, me.z); me.g.rotation.y = me.ang; ais.forEach(placeAi); }
      const fx = Math.sin(me.ang), fz = Math.cos(me.ang);
      const camT = new THREE.Vector3(me.x - fx * 9, 4.5, me.z - fz * 9);
      v.camera.position.lerp(camT, Math.min(1, dt * 5)); v.camera.lookAt(me.x + fx * 6, 1, me.z + fz * 6);
      const myProg = me.lap * M + me.idx, place = 1 + ais.filter(a => (a.d / L) * M > myProg).length;
      if (!started) v.hud.innerHTML = `<span class="big">${t < -2 ? 3 : t < -1 ? 2 : 1}</span>`;
      else v.hud.textContent = `Lap ${Math.min(me.lap + 1, 3)}/3 · P${place}\n${Math.round(Math.abs(me.v) * 4)} km/h · ${T3.fmt(t * 1000)}`;
      v.render();
    });
    reset();
  } },

/* ===== BLOCK BUILDER 3D ===== */
{ id: '3d:builder', title: 'Block Builder 3D', emoji: '🧊', cat: '3d', colors: ['#65a30d', '#78350f'],
  help: 'A creative sandbox in the spirit of Minecraft: a floating island of blocks to build on. Your build is saved in this browser, so come back and carry on. Controls: click a block face to place, right-click (or Shift+click) to remove, drag to orbit, scroll to zoom, WASD to pan, keys 1–8 pick the block type.',
  run(stage, api) {
    if (!T3.ready(api)) return;
    const v = T3.view(api, stage, { sky: 0xbae6fd, fov: 55, far: 300 });
    v.light(1);
    const MATS = [['Grass', 0x4ade80], ['Dirt', 0x92400e], ['Stone', 0x9ca3af], ['Wood', 0xd97706], ['Leaves', 0x16a34a], ['Brick', 0xb91c1c], ['Glass', 0x7dd3fc, { transparent: true, opacity: .45 }], ['Gold', 0xfbbf24, { emissive: 0x78350f }]];
    const mats = MATS.map(([, c, extra]) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, extra || {})));
    const geo = new THREE.BoxGeometry(1, 1, 1), SZ = 16, SAVE = 'gp3d:builder';
    const key = (x, y, z) => x + ',' + y + ',' + z;
    const blocks = new Map(), group = new THREE.Group(); v.scene.add(group);
    let sel = 0, placed = 0;
    function add(x, y, z, m) { if (blocks.has(key(x, y, z))) return; const mesh = new THREE.Mesh(geo, mats[m] || mats[0]); mesh.position.set(x + .5, y + .5, z + .5); mesh.userData = { x, y, z, m }; group.add(mesh); blocks.set(key(x, y, z), mesh); }
    function del(mesh) { group.remove(mesh); blocks.delete(key(mesh.userData.x, mesh.userData.y, mesh.userData.z)); }
    function island() { for (let x = 0; x < SZ; x++) for (let z = 0; z < SZ; z++) { add(x, 0, z, 1); add(x, 1, z, 0); } }
    function load() { try { const d = JSON.parse(localStorage.getItem(SAVE) || 'null'); if (!d || !d.length) return false; d.forEach(([x, y, z, m]) => add(x, y, z, m)); placed = d.filter(b => b[1] > 1).length; return true; } catch { return false; } }
    function save() { try { localStorage.setItem(SAVE, JSON.stringify([...blocks.values()].map(b => [b.userData.x, b.userData.y, b.userData.z, b.userData.m]))); } catch {} }
    if (!load()) island();
    api.score(placed);
    const ghost = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: .7 })); ghost.visible = false; v.scene.add(ghost);
    let yaw = .8, pitch = .55, dist = 26; const target = new THREE.Vector3(SZ / 2, 3, SZ / 2);
    const ray = new THREE.Raycaster();
    function pick(e) { ray.setFromCamera(v.ndc(e), v.camera); return ray.intersectObjects(group.children)[0] || null; }
    function cell(h) { const n = h.face.normal, u = h.object.userData; return { x: u.x + Math.round(n.x), y: u.y + Math.round(n.y), z: u.z + Math.round(n.z) }; }
    const bar = document.createElement('div'); bar.className = 'hotbar3d'; stage.appendChild(bar);
    function hotbar() {
      bar.innerHTML = MATS.map(([nm, c], i) => `<button class="${i === sel ? 'on' : ''}" data-i="${i}" title="${nm} (${i + 1})"><i style="background:#${c.toString(16).padStart(6, '0')}"></i>${i + 1}</button>`).join('') + '<button data-i="clear" title="Clear the island">🗑</button>';
    }
    hotbar();
    api.on(bar, 'pointerdown', e => {
      e.stopPropagation(); const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.i === 'clear') { if (confirm('Clear the whole island and start again?')) { [...blocks.values()].forEach(del); island(); placed = 0; save(); } return; }
      sel = +b.dataset.i; hotbar();
    });
    let down = null, moved = false;
    api.on(stage, 'contextmenu', e => e.preventDefault());
    api.on(stage, 'pointerdown', e => { down = { x: e.clientX, y: e.clientY, b: e.button, shift: e.shiftKey }; moved = false; });
    api.onMove(e => {
      if (down && e.buttons) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        if (moved) { yaw -= dx * .006; pitch = clampN(pitch + dy * .006, .05, 1.5); down.x = e.clientX; down.y = e.clientY; }
      } else { const h = pick(e); if (h) { const c = cell(h); ghost.position.set(c.x + .5, c.y + .5, c.z + .5); ghost.visible = true; } else ghost.visible = false; }
    });
    api.on(window, 'pointerup', e => {
      if (!down) return; const d = down; down = null; if (moved) return;
      const h = pick(e); if (!h) return;
      if (d.b === 2 || d.shift) { if (h.object.userData.y > 0) { del(h.object); api.beep(200, .05); save(); } return; }
      const c = cell(h);
      if (c.y < 0 || c.y > 40 || c.x < -8 || c.x > SZ + 7 || c.z < -8 || c.z > SZ + 7) return;
      add(c.x, c.y, c.z, sel); placed++; api.score(placed); api.beep(500 + sel * 40, .04); save();
    });
    api.on(stage, 'wheel', e => { e.preventDefault(); dist = clampN(dist + e.deltaY * .02, 6, 80); });
    const K = T3.keys(api);
    api.onKey(e => { const i = +e.key - 1; if (i >= 0 && i < MATS.length) { sel = i; hotbar(); } });
    api.onRestart(() => { yaw = .8; pitch = .55; dist = 26; target.set(SZ / 2, 3, SZ / 2); });
    api.loop(dtms => {
      const dt = dtms / 1000;
      if (K.ArrowLeft) yaw += dt * 1.5; if (K.ArrowRight) yaw -= dt * 1.5; if (K.ArrowUp) pitch = clampN(pitch + dt, .05, 1.5); if (K.ArrowDown) pitch = clampN(pitch - dt, .05, 1.5);
      const mv = ((K.w ? 1 : 0) - (K.s ? 1 : 0)), st = ((K.d ? 1 : 0) - (K.a ? 1 : 0));
      if (mv || st) { target.x += (-Math.sin(yaw) * mv + Math.cos(yaw) * st) * 12 * dt; target.z += (-Math.cos(yaw) * mv - Math.sin(yaw) * st) * 12 * dt; }
      v.camera.position.set(target.x + dist * Math.cos(pitch) * Math.sin(yaw), target.y + dist * Math.sin(pitch), target.z + dist * Math.cos(pitch) * Math.cos(yaw));
      v.camera.lookAt(target);
      v.hud.textContent = `${MATS[sel][0]} · ${blocks.size} blocks · ${placed} placed`;
      v.render();
    });
  } },

/* ===== TUNNEL RUSH 3D ===== */
{ id: '3d:tunnel', title: 'Tunnel Rush 3D', emoji: '🌀', cat: '3d', colors: ['#a855f7', '#0f172a'],
  help: 'Hurtle down a neon tunnel that never ends. Bars jut out from the walls and some rings leave only a gap: spin round the inside of the tube to slip past. The whole tunnel turns with you. Controls: A/D or ←/→ to spin (or hold the left/right half of the screen), Space / tap to restart.',
  run(stage, api) {
    if (!T3.ready(api)) return;
    const v = T3.view(api, stage, { sky: 0x05030f, fog: [50, 190], fov: 82, far: 260 });
    v.scene.add(new THREE.AmbientLight(0xffffff, .55));
    const pl = new THREE.PointLight(0xc084fc, 1.6, 70); pl.position.set(0, 0, -8); v.scene.add(pl);
    const K = T3.keys(api);
    const RAD = 6, LEN = 260;
    const tc = document.createElement('canvas'); tc.width = 64; tc.height = 256; const g2 = tc.getContext('2d');
    g2.fillStyle = '#1e1038'; g2.fillRect(0, 0, 64, 256); g2.fillStyle = '#a855f7'; g2.fillRect(0, 0, 64, 10); g2.fillStyle = '#312e81'; g2.fillRect(0, 128, 64, 4);
    g2.fillStyle = '#2a1a4a'; g2.fillRect(31, 0, 2, 256);
    const tex = new THREE.CanvasTexture(tc); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(16, 40);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(RAD, RAD, LEN, 40, 1, true), new THREE.MeshLambertMaterial({ map: tex, side: THREE.BackSide }));
    tube.rotation.x = Math.PI / 2; tube.position.z = -LEN / 2 + 12; v.scene.add(tube);
    const ship = new THREE.Group();
    const cone = T3.mesh(new THREE.ConeGeometry(.45, 1.3, 8), 0x67e8f9, { emissive: 0x0e7490 }); cone.rotation.x = -Math.PI / 2; ship.add(cone);
    const glow = new THREE.PointLight(0x67e8f9, 1.2, 12); ship.add(glow); v.scene.add(ship);
    const barMat = new THREE.MeshLambertMaterial({ color: 0xf43f5e, emissive: 0x881337 }), ringMat = new THREE.MeshLambertMaterial({ color: 0xfacc15, emissive: 0x713f12 });
    let a, roll, speed, dist, alive, obs, nextZ, hold = 0;
    function reset() {
      (obs || []).forEach(o => v.scene.remove(o.m)); obs = [];
      a = -Math.PI / 2; roll = a; speed = 26; dist = 0; alive = true; nextZ = -90;
      api.overlay(null); api.score(0);
    }
    function spawn(z) {
      const ring = Math.random() < .4;
      const arc = ring ? Math.PI * 2 - rand(1.1, 1.6) : rand(.8, 1.7), c = rand(0, Math.PI * 2);
      const m = new THREE.Mesh(new THREE.TorusGeometry(RAD - .5, .55, 8, ring ? 40 : 14, arc), ring ? ringMat : barMat);
      m.rotation.z = c - arc / 2; m.position.z = z; v.scene.add(m);
      obs.push({ m, c, arc, z });
    }
    api.onKey(e => { if (!alive && T3.isRestart(e)) reset(); });
    api.on(stage, 'pointerdown', e => { if (alive) hold = v.ndc(e).x < 0 ? -1 : 1; else reset(); });
    api.onMove(e => { if (hold) hold = v.ndc(e).x < 0 ? -1 : 1; });
    api.on(window, 'pointerup', () => { hold = 0; });
    api.onRestart(reset);
    api.loop(dtms => {
      const dt = dtms / 1000;
      if (alive) {
        const turn = ((K.ArrowLeft || K.a) ? -1 : 0) + ((K.ArrowRight || K.d) ? 1 : 0) || hold;
        a -= turn * 3.2 * dt;
        dist += speed * dt; speed = Math.min(72, speed + dt * 1.1);
        tex.offset.y -= speed * dt * .012;
        for (const o of obs) { o.z += speed * dt; o.m.position.z = o.z; }
        while (nextZ > -LEN + 20) { spawn(nextZ); nextZ -= rand(16, 26) - Math.min(8, speed * .08); }
        nextZ += speed * dt;
        obs = obs.filter(o => { if (o.z > 4) { v.scene.remove(o.m); o.m.geometry.dispose(); return false; } return true; });
        for (const o of obs) if (o.z > -9.4 && o.z < -6.6) {
          const d = Math.abs(wrapA(a - o.c));
          if (d < o.arc / 2 + .12) { alive = false; api.beep(100, .4); api.overlay(`<b>Smashed</b>${Math.floor(dist / 5)} points<br><small>Space / tap to restart</small>`); break; }
        }
        api.score(Math.floor(dist / 5));
      }
      ship.position.set(Math.cos(a) * (RAD - .85), Math.sin(a) * (RAD - .85), -8); ship.rotation.z = a + Math.PI / 2;
      roll += wrapA(a - roll) * Math.min(1, dt * 7);
      v.camera.up.set(-Math.cos(roll), -Math.sin(roll), 0); v.camera.position.set(0, 0, 0); v.camera.lookAt(0, 0, -1);
      v.hud.textContent = `${Math.floor(dist / 5)} pts · ${Math.round(speed * 4)} km/h`;
      v.render();
    });
    reset();
  } }

);
})();
