/* ---------- tiny game engine ---------- */
const rnd = n => Math.floor(Math.random() * n);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function makeApi(stage, hooks) {
  const cleanups = [];
  const api = {
    canvas(w, h) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h; stage.appendChild(c);
      return { c, x: c.getContext('2d') };
    },
    dom(cls) {
      const d = document.createElement('div');
      d.className = 'dom-game ' + (cls || '');
      stage.appendChild(d); return d;
    },
    el(tag, cls, parent) {
      const e = document.createElement(tag); if (cls) e.className = cls;
      (parent || stage).appendChild(e); return e;
    },
    onKey(fn)   { const h = e => { if (e.target.tagName === 'INPUT') return; fn(e); }; window.addEventListener('keydown', h); cleanups.push(() => window.removeEventListener('keydown', h)); },
    onKeyUp(fn) { const h = e => fn(e); window.addEventListener('keyup', h); cleanups.push(() => window.removeEventListener('keyup', h)); },
    onTap(fn)   { const h = e => { if (e.button && e.button !== 0) return; fn(e); }; stage.addEventListener('pointerdown', h); cleanups.push(() => stage.removeEventListener('pointerdown', h)); },
    onMove(fn)  { stage.addEventListener('pointermove', fn); cleanups.push(() => stage.removeEventListener('pointermove', fn)); },
    on(target, ev, fn) { target.addEventListener(ev, fn); cleanups.push(() => target.removeEventListener(ev, fn)); },
    loop(fn) {
      let last = performance.now(), raf;
      const step = t => { const dt = Math.min(50, t - last); last = t; fn(dt); raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
      cleanups.push(() => cancelAnimationFrame(raf));
    },
    every(ms, fn) { const id = setInterval(fn, ms); cleanups.push(() => clearInterval(id)); return id; },
    after(ms, fn) { const id = setTimeout(fn, ms); cleanups.push(() => clearTimeout(id)); return id; },
    overlay(html) {
      let o = stage.querySelector('.overlay');
      if (!html) { if (o) o.remove(); return; }
      if (!o) { o = document.createElement('div'); o.className = 'overlay'; stage.appendChild(o); }
      o.innerHTML = html;
    },
    score: n => hooks.score(n),
    beep: (f, d) => hooks.beep(f, d),
    onRestart(fn) { api._restart = fn; },
    _restart: null,
    stop() { cleanups.forEach(f => f()); cleanups.length = 0; stage.innerHTML = ''; },
  };
  return api;
}

/* ---------- games ---------- */
const GAMES = [

/* ===== SNAKE ===== */
{ id: 'snake', title: 'Snake', emoji: '🐍', cat: 'classic', colors: ['#16a34a', '#a3e635'],
  help: 'Arrow keys or WASD to steer. Eat the apples, don\'t bite yourself.',
  run(stage, api) {
    const N = 20, S = 20; const { c, x } = api.canvas(N * S, N * S);
    let snake, dir, next, food, score, alive, t, speed;
    function reset() {
      snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
      dir = { x: 1, y: 0 }; next = dir; score = 0; alive = true; t = 0; speed = 120;
      place(); api.score(0); api.overlay(null); draw();
    }
    function place() { do { food = { x: rnd(N), y: rnd(N) }; } while (snake.some(s => s.x === food.x && s.y === food.y)); }
    const map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
    api.onKey(e => {
      const m = map[e.key];
      if (m) { e.preventDefault(); if (m[0] !== -dir.x || m[1] !== -dir.y) next = { x: m[0], y: m[1] }; }
      if (!alive && (e.key === ' ' || e.key === 'Enter')) reset();
    });
    api.onTap(() => { if (!alive) reset(); });
    api.onRestart(reset);
    api.loop(dt => {
      if (!alive) return;
      t += dt; if (t < speed) return; t = 0;
      dir = next;
      const h = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      if (h.x < 0 || h.y < 0 || h.x >= N || h.y >= N || snake.some(s => s.x === h.x && s.y === h.y)) {
        alive = false; api.beep(120, .3);
        api.overlay(`<b>Game over</b>Score ${score}<br><small>Space / tap to restart</small>`); return;
      }
      snake.unshift(h);
      if (h.x === food.x && h.y === food.y) { score += 10; api.score(score); api.beep(650, .05); speed = Math.max(55, speed - 2); place(); }
      else snake.pop();
      draw();
    });
    function draw() {
      x.fillStyle = '#0b1f12'; x.fillRect(0, 0, N * S, N * S);
      x.fillStyle = '#10301c';
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if ((i + j) % 2) x.fillRect(i * S, j * S, S, S);
      x.fillStyle = '#ef4444'; x.beginPath(); x.arc(food.x * S + S / 2, food.y * S + S / 2, S / 2 - 3, 0, 7); x.fill();
      snake.forEach((s, i) => { x.fillStyle = i ? '#4ade80' : '#bbf7d0'; x.fillRect(s.x * S + 1, s.y * S + 1, S - 2, S - 2); });
      x.fillStyle = '#fff'; x.font = 'bold 14px monospace'; x.fillText('Score ' + score, 8, 18);
    }
    reset();
  } },

/* ===== 2048 ===== */
{ id: '2048', title: '2048', emoji: '🔢', cat: 'puzzle', colors: ['#f59563', '#edc22e'],
  help: 'Arrow keys / WASD or swipe to slide tiles. Join numbers to reach 2048.',
  run(stage, api) {
    const root = api.dom('g2048');
    const hud = api.el('div', 'hud', root);
    const board = api.el('div', 'board', root); board.style.gridTemplateColumns = 'repeat(4, 90px)';
    let g, score;
    function reset() { g = Array.from({ length: 4 }, () => [0, 0, 0, 0]); score = 0; add(); add(); api.overlay(null); api.score(0); render(); }
    function add() { const e = []; g.forEach((r, y) => r.forEach((v, x) => { if (!v) e.push([x, y]); })); if (!e.length) return; const [x, y] = e[rnd(e.length)]; g[y][x] = Math.random() < .9 ? 2 : 4; }
    function slide(row) { const a = row.filter(v => v); for (let i = 0; i < a.length - 1; i++) if (a[i] === a[i + 1]) { a[i] *= 2; score += a[i]; a.splice(i + 1, 1); } while (a.length < 4) a.push(0); return a; }
    function move(dir) {
      const before = JSON.stringify(g);
      for (let i = 0; i < 4; i++) {
        let line = (dir === 'left' || dir === 'right') ? g[i].slice() : g.map(r => r[i]);
        if (dir === 'right' || dir === 'down') line.reverse();
        line = slide(line);
        if (dir === 'right' || dir === 'down') line.reverse();
        if (dir === 'left' || dir === 'right') g[i] = line; else line.forEach((v, y) => g[y][i] = v);
      }
      if (JSON.stringify(g) !== before) {
        add(); api.beep(420, .03); api.score(score); render();
        if (g.flat().includes(2048)) api.overlay(`<b>🎉 2048!</b>Score ${score}<br><small>Keep going or press R</small>`);
        if (!canMove()) api.overlay(`<b>Game over</b>Score ${score}<br><small>Press R to restart</small>`);
      }
    }
    function canMove() { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const v = g[y][x]; if (!v || (x < 3 && g[y][x + 1] === v) || (y < 3 && g[y + 1][x] === v)) return true; } return false; }
    function render() { board.innerHTML = ''; g.flat().forEach(v => { const t = api.el('div', 'tile' + (v ? ' v' + v : ''), board); t.textContent = v || ''; }); hud.textContent = 'Score ' + score; }
    const keys = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
    api.onKey(e => { if (keys[e.key]) { e.preventDefault(); move(keys[e.key]); } });
    let sx, sy;
    api.onTap(e => { sx = e.clientX; sy = e.clientY; });
    stage.addEventListener('pointerup', e => { if (sx == null) return; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.hypot(dx, dy) > 30) move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); sx = null; });
    api.onRestart(reset);
    reset();
  } },

/* ===== FLAPPY ===== */
{ id: 'flappy', title: 'Flappy Bird', emoji: '🐤', cat: 'arcade', colors: ['#0ea5e9', '#facc15'],
  help: 'Space, ↑ or tap to flap. Get through the pipes.',
  run(stage, api) {
    const W = 400, H = 520; const { c, x } = api.canvas(W, H);
    let bird, vy, pipes, score, alive, started, t, wing;
    function reset() { bird = H / 2; vy = 0; pipes = []; score = 0; alive = true; started = false; t = 1200; wing = 0; api.overlay('<b>Flappy Bird</b>Space / tap to flap'); api.score(0); }
    function flap() { if (!alive) { reset(); return; } started = true; api.overlay(null); vy = -6.5; wing = 6; api.beep(700, .04); }
    api.onKey(e => { if (e.code === 'Space' || e.key === 'ArrowUp') { e.preventDefault(); flap(); } });
    api.onTap(flap); api.onRestart(reset);
    function die() { if (!alive) return; alive = false; api.beep(150, .3); api.overlay(`<b>Ouch!</b>Score ${score}<br><small>Space / tap to retry</small>`); }
    api.loop(dt => {
      const s = dt / 16.67;
      if (started && alive) {
        vy += 0.35 * s; bird += vy * s; t += dt; wing = Math.max(0, wing - s);
        if (t > 1500) { t = 0; const gap = 150; pipes.push({ x: W, top: 60 + rnd(H - gap - 160), gap, passed: false }); }
        pipes.forEach(p => p.x -= 2.6 * s); pipes = pipes.filter(p => p.x > -60);
        const bx = 80, br = 13;
        if (bird + br > H - 40 || bird - br < 0) die();
        pipes.forEach(p => {
          if (bx + br > p.x && bx - br < p.x + 56 && (bird - br < p.top || bird + br > p.top + p.gap)) die();
          if (!p.passed && p.x + 56 < bx) { p.passed = true; score++; api.score(score); api.beep(900, .05); }
        });
      }
      draw();
    });
    function draw() {
      const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#38bdf8'); gr.addColorStop(1, '#bae6fd');
      x.fillStyle = gr; x.fillRect(0, 0, W, H);
      pipes.forEach(p => {
        x.fillStyle = '#22c55e'; x.fillRect(p.x, 0, 56, p.top); x.fillRect(p.x, p.top + p.gap, 56, H);
        x.fillStyle = '#15803d'; x.fillRect(p.x - 4, p.top - 22, 64, 22); x.fillRect(p.x - 4, p.top + p.gap, 64, 22);
      });
      x.fillStyle = '#ca8a04'; x.fillRect(0, H - 40, W, 40); x.fillStyle = '#4ade80'; x.fillRect(0, H - 40, W, 8);
      x.save(); x.translate(80, bird); x.rotate(clamp(vy / 10, -.5, .8));
      x.fillStyle = '#facc15'; x.beginPath(); x.arc(0, 0, 13, 0, 7); x.fill();
      x.fillStyle = '#f59e0b'; x.beginPath(); x.ellipse(-4, wing ? -2 : 4, 7, 4, 0, 0, 7); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.arc(5, -4, 4, 0, 7); x.fill(); x.fillStyle = '#000'; x.beginPath(); x.arc(6, -4, 2, 0, 7); x.fill();
      x.fillStyle = '#f97316'; x.beginPath(); x.moveTo(9, 1); x.lineTo(18, 4); x.lineTo(9, 7); x.fill();
      x.restore();
      x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 4; x.font = 'bold 36px sans-serif'; x.textAlign = 'center';
      x.strokeText(score, W / 2, 60); x.fillText(score, W / 2, 60); x.textAlign = 'left';
    }
    reset();
  } },

/* ===== TETRIS ===== */
{ id: 'tetris', title: 'Blocks', emoji: '🟪', cat: 'classic', colors: ['#a855f7', '#22d3ee'],
  help: '← → move · ↑ rotate · ↓ soft drop · Space hard drop.',
  run(stage, api) {
    const COLS = 10, ROWS = 20, S = 24, SIDE = 130; const { c, x } = api.canvas(COLS * S + SIDE, ROWS * S);
    const SHAPES = { I: [[1, 1, 1, 1]], O: [[1, 1], [1, 1]], T: [[0, 1, 0], [1, 1, 1]], S: [[0, 1, 1], [1, 1, 0]], Z: [[1, 1, 0], [0, 1, 1]], J: [[1, 0, 0], [1, 1, 1]], L: [[0, 0, 1], [1, 1, 1]] };
    const COLORS = { I: '#22d3ee', O: '#facc15', T: '#a855f7', S: '#4ade80', Z: '#f87171', J: '#60a5fa', L: '#fb923c' };
    let grid, cur, nxt, score, lines, level, over, acc, drop;
    const rand = () => { const k = Object.keys(SHAPES), t = k[rnd(k.length)]; return { t, m: SHAPES[t].map(r => r.slice()), x: 3, y: 0 }; };
    function reset() { grid = Array.from({ length: ROWS }, () => Array(COLS).fill('')); score = 0; lines = 0; level = 1; over = false; acc = 0; drop = 800; cur = rand(); nxt = rand(); api.overlay(null); api.score(0); }
    function hits(p, dx = 0, dy = 0, m = p.m) {
      return m.some((r, y) => r.some((v, i) => { if (!v) return false; const nx = p.x + i + dx, ny = p.y + y + dy; return nx < 0 || nx >= COLS || ny >= ROWS || (ny >= 0 && grid[ny][nx]); }));
    }
    function rotate() { const m = cur.m[0].map((_, i) => cur.m.map(r => r[i]).reverse()); for (const k of [0, -1, 1, -2, 2]) if (!hits(cur, k, 0, m)) { cur.m = m; cur.x += k; return; } }
    function lock() {
      cur.m.forEach((r, y) => r.forEach((v, i) => { if (v && cur.y + y >= 0) grid[cur.y + y][cur.x + i] = cur.t; }));
      let n = 0; grid = grid.filter(r => { if (r.every(v => v)) { n++; return false; } return true; });
      while (grid.length < ROWS) grid.unshift(Array(COLS).fill(''));
      if (n) { lines += n; score += [0, 100, 300, 500, 800][n] * level; level = 1 + Math.floor(lines / 10); drop = Math.max(90, 800 - (level - 1) * 70); api.beep(500 + n * 100, .08); api.score(score); }
      cur = nxt; nxt = rand();
      if (hits(cur)) { over = true; api.beep(120, .4); api.overlay(`<b>Game over</b>Score ${score}<br><small>Press R to restart</small>`); }
    }
    function step() { if (!hits(cur, 0, 1)) cur.y++; else lock(); }
    api.onKey(e => {
      if (over) return; const k = e.key;
      if (['ArrowLeft', 'a'].includes(k)) { if (!hits(cur, -1, 0)) cur.x--; }
      else if (['ArrowRight', 'd'].includes(k)) { if (!hits(cur, 1, 0)) cur.x++; }
      else if (['ArrowDown', 's'].includes(k)) { step(); score++; }
      else if (['ArrowUp', 'w'].includes(k)) rotate();
      else if (k === ' ') { while (!hits(cur, 0, 1)) { cur.y++; score += 2; } lock(); }
      else return;
      e.preventDefault(); api.score(score);
    });
    api.onRestart(reset);
    api.loop(dt => { if (!over) { acc += dt; if (acc > drop) { acc = 0; step(); } } draw(); });
    function cell(cx, cy, col, alpha = 1) { x.globalAlpha = alpha; x.fillStyle = col; x.fillRect(cx * S + 1, cy * S + 1, S - 2, S - 2); x.globalAlpha = 1; }
    function draw() {
      x.fillStyle = '#0b0d14'; x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = '#151827'; for (let i = 0; i < COLS; i++) for (let j = 0; j < ROWS; j++) x.fillRect(i * S + 1, j * S + 1, S - 2, S - 2);
      grid.forEach((r, y) => r.forEach((v, i) => v && cell(i, y, COLORS[v])));
      let gy = 0; while (!hits(cur, 0, gy + 1)) gy++;
      cur.m.forEach((r, y) => r.forEach((v, i) => { if (v) { cell(cur.x + i, cur.y + y + gy, COLORS[cur.t], .25); cell(cur.x + i, cur.y + y, COLORS[cur.t]); } }));
      x.fillStyle = '#1e2230'; x.fillRect(COLS * S, 0, SIDE, c.height);
      x.fillStyle = '#fff'; x.font = 'bold 14px monospace';
      x.fillText('NEXT', COLS * S + 16, 24);
      nxt.m.forEach((r, y) => r.forEach((v, i) => v && cell(COLS + 0.7 + i, 1.5 + y, COLORS[nxt.t])));
      x.fillStyle = '#fff';
      x.fillText('SCORE', COLS * S + 16, 140); x.fillText(String(score), COLS * S + 16, 160);
      x.fillText('LINES', COLS * S + 16, 200); x.fillText(String(lines), COLS * S + 16, 220);
      x.fillText('LEVEL', COLS * S + 16, 260); x.fillText(String(level), COLS * S + 16, 280);
    }
    reset();
  } },

/* ===== BREAKOUT ===== */
{ id: 'breakout', title: 'Breakout', emoji: '🧱', cat: 'arcade', colors: ['#f43f5e', '#f97316'],
  help: 'Mouse or ← → to move. Click / Space to launch. Clear all the bricks!',
  run(stage, api) {
    const W = 480, H = 400; const { c, x } = api.canvas(W, H);
    let paddle, ball, bricks, score, lives, running, over, speed, keys = {};
    function reset() { paddle = { x: W / 2 - 40, w: 80 }; score = 0; lives = 3; over = false; speed = 5; makeBricks(); serve(); api.score(0); api.overlay('<b>Breakout</b>Move with mouse or ← →<br><small>Click or Space to launch</small>'); }
    function makeBricks() { bricks = []; const cols = 8, rows = 5, bw = W / cols, cs = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa']; for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) bricks.push({ x: i * bw + 3, y: 40 + r * 22, w: bw - 6, h: 18, c: cs[r], alive: true }); }
    function serve() { ball = { x: W / 2, y: H - 30, vx: 0, vy: 0, r: 6 }; running = false; }
    function launch() { if (over) { reset(); return; } if (running) return; running = true; const a = (Math.random() * .6 - .3) - Math.PI / 2; ball.vx = Math.cos(a) * speed; ball.vy = Math.sin(a) * speed; api.overlay(null); }
    api.onKey(e => { keys[e.key] = true; if (e.code === 'Space') { e.preventDefault(); launch(); } });
    api.onKeyUp(e => { keys[e.key] = false; });
    api.onMove(e => { const r = c.getBoundingClientRect(); paddle.x = clamp((e.clientX - r.left) * (W / r.width) - paddle.w / 2, 0, W - paddle.w); });
    api.onTap(launch); api.onRestart(reset);
    api.loop(dt => {
      const s = dt / 16.67;
      if (keys.ArrowLeft || keys.a) paddle.x = clamp(paddle.x - 7 * s, 0, W - paddle.w);
      if (keys.ArrowRight || keys.d) paddle.x = clamp(paddle.x + 7 * s, 0, W - paddle.w);
      if (running) {
        ball.x += ball.vx * s; ball.y += ball.vy * s;
        if (ball.x < ball.r) { ball.x = ball.r; ball.vx *= -1; api.beep(300, .02); }
        if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx *= -1; api.beep(300, .02); }
        if (ball.y < ball.r) { ball.y = ball.r; ball.vy *= -1; api.beep(300, .02); }
        if (ball.vy > 0 && ball.y + ball.r >= H - 22 && ball.y - ball.r <= H - 12 && ball.x > paddle.x - 4 && ball.x < paddle.x + paddle.w + 4) {
          const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
          const a = hit * 1.1 - Math.PI / 2; ball.vx = Math.cos(a) * speed; ball.vy = Math.sin(a) * speed; ball.y = H - 22 - ball.r; api.beep(420, .03);
        }
        if (ball.y > H + 10) {
          lives--; api.beep(150, .3); serve();
          if (lives <= 0) { over = true; api.overlay(`<b>Game over</b>Score ${score}<br><small>Click to restart</small>`); }
          else api.overlay(`<b>${lives} ${lives === 1 ? 'life' : 'lives'} left</b><small>Click or Space</small>`);
        }
        for (const b of bricks) {
          if (!b.alive) continue;
          if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w && ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
            b.alive = false; score += 10; api.score(score); api.beep(600, .03);
            const ox = Math.min(ball.x + ball.r - b.x, b.x + b.w - (ball.x - ball.r)), oy = Math.min(ball.y + ball.r - b.y, b.y + b.h - (ball.y - ball.r));
            if (ox < oy) ball.vx *= -1; else ball.vy *= -1; break;
          }
        }
        if (bricks.every(b => !b.alive)) { speed += .7; makeBricks(); serve(); api.overlay('<b>Level cleared! 🎉</b><small>Click or Space for the next one</small>'); }
      } else ball.x = paddle.x + paddle.w / 2;
      draw();
    });
    function draw() {
      x.fillStyle = '#0f1117'; x.fillRect(0, 0, W, H);
      bricks.forEach(b => { if (b.alive) { x.fillStyle = b.c; x.fillRect(b.x, b.y, b.w, b.h); } });
      x.fillStyle = '#e2e8f0'; x.fillRect(paddle.x, H - 20, paddle.w, 8);
      x.fillStyle = '#fff'; x.beginPath(); x.arc(ball.x, ball.y, ball.r, 0, 7); x.fill();
      x.font = 'bold 14px monospace'; x.fillText('Score ' + score, 8, 20); x.fillText('❤'.repeat(Math.max(0, lives)), W - 60, 20);
    }
    reset();
  } },

/* ===== PONG ===== */
{ id: 'pong', title: 'Pong', emoji: '🏓', cat: 'classic', colors: ['#334155', '#94a3b8'],
  help: 'Mouse or ↑ ↓ / W S to move. First to 7 wins.',
  run(stage, api) {
    const W = 520, H = 340, P = 70; const { c, x } = api.canvas(W, H);
    let p1, p2, ball, s1, s2, over, keys = {};
    function reset() { p1 = p2 = H / 2 - P / 2; s1 = s2 = 0; over = false; serve(1); api.score(0); api.overlay('<b>Pong</b>First to 7<br><small>Mouse or ↑ ↓</small>'); api.after(1500, () => api.overlay(null)); }
    function serve(d) { ball = { x: W / 2, y: H / 2, vx: d * 4, vy: (Math.random() * 2 - 1) * 3 }; }
    api.onKey(e => { keys[e.key] = true; if (over && (e.code === 'Space' || e.key === 'Enter')) reset(); if (['ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault(); });
    api.onKeyUp(e => { keys[e.key] = false; });
    api.onMove(e => { const r = c.getBoundingClientRect(); p1 = clamp((e.clientY - r.top) * (H / r.height) - P / 2, 0, H - P); });
    api.onTap(() => { if (over) reset(); }); api.onRestart(reset);
    api.loop(dt => {
      const s = dt / 16.67;
      if (!over) {
        if (keys.ArrowUp || keys.w) p1 -= 6 * s; if (keys.ArrowDown || keys.s) p1 += 6 * s; p1 = clamp(p1, 0, H - P);
        const target = ball.vx > 0 ? ball.y - P / 2 : H / 2 - P / 2; p2 += Math.sign(target - p2) * Math.min(Math.abs(target - p2), 4.3 * s); p2 = clamp(p2, 0, H - P);
        ball.x += ball.vx * s; ball.y += ball.vy * s;
        if (ball.y < 6) { ball.y = 6; ball.vy *= -1; } if (ball.y > H - 6) { ball.y = H - 6; ball.vy *= -1; }
        if (ball.vx < 0 && ball.x < 24 && ball.x > 8 && ball.y > p1 - 6 && ball.y < p1 + P + 6) { ball.vx = Math.abs(ball.vx) * 1.06; ball.vy = ((ball.y - (p1 + P / 2)) / (P / 2)) * 5; api.beep(500, .03); }
        if (ball.vx > 0 && ball.x > W - 24 && ball.x < W - 8 && ball.y > p2 - 6 && ball.y < p2 + P + 6) { ball.vx = -Math.abs(ball.vx) * 1.06; ball.vy = ((ball.y - (p2 + P / 2)) / (P / 2)) * 5; api.beep(400, .03); }
        if (ball.x < -10) { s2++; api.beep(150, .2); serve(1); }
        if (ball.x > W + 10) { s1++; api.score(s1); api.beep(800, .1); serve(-1); }
        if (s1 >= 7 || s2 >= 7) { over = true; api.overlay(`<b>${s1 > s2 ? 'You win! 🏆' : 'Computer wins 🤖'}</b>${s1} – ${s2}<br><small>Click / Space to play again</small>`); }
      }
      x.fillStyle = '#0f172a'; x.fillRect(0, 0, W, H);
      x.strokeStyle = '#334155'; x.setLineDash([8, 8]); x.beginPath(); x.moveTo(W / 2, 0); x.lineTo(W / 2, H); x.stroke(); x.setLineDash([]);
      x.fillStyle = '#e2e8f0'; x.fillRect(12, p1, 10, P); x.fillRect(W - 22, p2, 10, P);
      x.beginPath(); x.arc(ball.x, ball.y, 6, 0, 7); x.fill();
      x.font = 'bold 32px monospace'; x.textAlign = 'center'; x.fillText(s1, W / 2 - 50, 44); x.fillText(s2, W / 2 + 50, 44); x.textAlign = 'left';
    });
    reset();
  } },

/* ===== MINESWEEPER ===== */
{ id: 'mines', title: 'Minesweeper', emoji: '💣', cat: 'puzzle', colors: ['#475569', '#f87171'],
  help: 'Click to reveal, right-click to flag. Numbers tell you how many mines touch that square.',
  run(stage, api) {
    const N = 12, M = 20; const root = api.dom('mine');
    const hud = api.el('div', 'hud', root); const board = api.el('div', 'board', root);
    board.style.gridTemplateColumns = `repeat(${N}, 32px)`; board.style.gap = '3px';
    let cells, first, over, opened, flags, time, timer;
    function reset() {
      cells = Array.from({ length: N * N }, () => ({ mine: false, open: false, flag: false, n: 0 }));
      first = true; over = false; opened = 0; flags = 0; time = 0; clearInterval(timer); api.overlay(null); render();
    }
    const nb = i => { const r = [], x = i % N, y = (i / N) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < N && ny < N) r.push(ny * N + nx); } return r; };
    function place(safe) { const avoid = new Set([safe, ...nb(safe)]); let m = 0; while (m < M) { const i = rnd(N * N); if (avoid.has(i) || cells[i].mine) continue; cells[i].mine = true; m++; } cells.forEach((c, i) => c.n = nb(i).filter(j => cells[j].mine).length); }
    function open(i) {
      const c = cells[i]; if (c.open || c.flag || over) return;
      if (first) { first = false; place(i); timer = api.every(1000, () => { time++; render(); }); }
      c.open = true; opened++;
      if (c.mine) { over = true; clearInterval(timer); cells.forEach(k => { if (k.mine) k.open = true; }); api.beep(100, .5); render(); api.overlay('<b>💥 Boom!</b><small>Press R to try again</small>'); return; }
      if (!c.n) nb(i).forEach(open);
      if (opened === N * N - M) { over = true; clearInterval(timer); api.beep(900, .2); api.score(Math.max(100, 1000 - time)); render(); api.overlay(`<b>🎉 Cleared in ${time}s</b><small>Press R for a new board</small>`); }
    }
    function render() {
      hud.textContent = `💣 ${M - flags}   ⏱ ${time}s`;
      board.innerHTML = '';
      cells.forEach((c, i) => {
        const t = api.el('div', 'tile' + (c.open ? ' open n' + c.n : ''), board);
        t.textContent = c.open ? (c.mine ? '💣' : (c.n || '')) : (c.flag ? '🚩' : '');
        t.onclick = () => { open(i); if (!over) { api.beep(500, .02); render(); } };
        t.oncontextmenu = e => { e.preventDefault(); if (c.open || over) return; c.flag = !c.flag; flags += c.flag ? 1 : -1; render(); };
      });
    }
    api.onRestart(reset); reset();
  } },

/* ===== MEMORY ===== */
{ id: 'memory', title: 'Memory Match', emoji: '🃏', cat: 'puzzle', colors: ['#8b5cf6', '#ec4899'],
  help: 'Flip two cards at a time and find all the pairs in as few moves as you can.',
  run(stage, api) {
    const root = api.dom('memory'); const hud = api.el('div', 'hud', root); const board = api.el('div', 'board', root);
    board.style.gridTemplateColumns = 'repeat(4, 80px)';
    const EMOJI = ['🍎', '🚀', '🐶', '🎸', '🌈', '🍕', '⚽', '🦄'];
    let deck, flipped, moves, done, lock;
    function reset() { deck = [...EMOJI, ...EMOJI].sort(() => Math.random() - .5).map(e => ({ e, up: false, done: false })); flipped = []; moves = 0; done = 0; lock = false; api.overlay(null); render(); }
    function flip(i) {
      const c = deck[i]; if (lock || c.up || c.done) return;
      c.up = true; flipped.push(i); api.beep(500, .03); render();
      if (flipped.length === 2) {
        moves++; lock = true; const [a, b] = flipped.map(j => deck[j]);
        api.after(a.e === b.e ? 300 : 800, () => {
          if (a.e === b.e) { a.done = b.done = true; done++; api.beep(800, .08); } else { a.up = b.up = false; }
          flipped = []; lock = false; render();
          if (done === 8) { const sc = Math.max(0, 100 - (moves - 8) * 5); api.score(sc); api.overlay(`<b>🎉 All pairs!</b>${moves} moves · score ${sc}<br><small>Press R to play again</small>`); }
        });
      }
    }
    function render() { hud.textContent = `Moves ${moves}   Pairs ${done}/8`; board.innerHTML = ''; deck.forEach((c, i) => { const t = api.el('div', 'tile' + (c.up ? ' flip' : '') + (c.done ? ' done' : ''), board); t.textContent = c.up || c.done ? c.e : '?'; t.onclick = () => flip(i); }); }
    api.onRestart(reset); reset();
  } },

/* ===== TIC TAC TOE ===== */
{ id: 'ttt', title: 'Tic-Tac-Toe', emoji: '❌', cat: 'classic', colors: ['#0ea5e9', '#6366f1'],
  help: 'You are X. Beat the unbeatable computer… if you can. Score counts your wins.',
  run(stage, api) {
    const root = api.dom('ttt'); const hud = api.el('div', 'hud', root); const board = api.el('div', 'board', root);
    board.style.gridTemplateColumns = 'repeat(3, 100px)';
    const L = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    let b, over, wins = 0, losses = 0, draws = 0;
    const winner = g => { for (const [a, b2, c] of L) if (g[a] && g[a] === g[b2] && g[a] === g[c]) return g[a]; return g.includes('') ? null : 'draw'; };
    function minimax(g, p) { const w = winner(g); if (w === 'O') return 1; if (w === 'X') return -1; if (w === 'draw') return 0; let best = p === 'O' ? -2 : 2; for (let i = 0; i < 9; i++) if (!g[i]) { g[i] = p; const v = minimax(g, p === 'O' ? 'X' : 'O'); g[i] = ''; best = p === 'O' ? Math.max(best, v) : Math.min(best, v); } return best; }
    function ai() { let best = -2, mv = -1; for (let i = 0; i < 9; i++) if (!b[i]) { b[i] = 'O'; const v = minimax(b, 'X'); b[i] = ''; if (v > best) { best = v; mv = i; } } if (mv >= 0) b[mv] = 'O'; }
    function reset() { b = Array(9).fill(''); over = false; api.overlay(null); if (Math.random() < .5) ai(); render(); }
    function play(i) {
      if (over || b[i]) return; b[i] = 'X'; api.beep(600, .04);
      if (!end()) { ai(); end(); } render();
    }
    function end() {
      const w = winner(b); if (!w) return false; over = true;
      if (w === 'X') { wins++; api.score(wins); api.beep(900, .2); } else if (w === 'O') { losses++; api.beep(150, .3); } else draws++;
      api.overlay(`<b>${w === 'X' ? 'You win! 🏆' : w === 'O' ? 'Computer wins 🤖' : 'Draw 🤝'}</b><small>Click to play again</small>`);
      api.after(1200, () => { if (over) reset(); }); return true;
    }
    function render() { hud.textContent = `You ${wins} · Draws ${draws} · CPU ${losses}`; board.innerHTML = ''; b.forEach((v, i) => { const t = api.el('div', 'tile', board); t.textContent = v; t.style.color = v === 'X' ? '#38bdf8' : '#f472b6'; t.onclick = () => play(i); }); }
    api.onRestart(reset); reset();
  } },

/* ===== SPACE SHOOTER ===== */
{ id: 'invaders', title: 'Space Blasters', emoji: '👾', cat: 'action', colors: ['#111827', '#7c3aed'],
  help: '← → or A D to move, Space to shoot. Survive the waves!',
  run(stage, api) {
    const W = 480, H = 520; const { c, x } = api.canvas(W, H);
    let ship, bullets, enemies, eb, score, lives, over, wave, dir, cool, keys = {}, stars, flash;
    function reset() { ship = W / 2; bullets = []; eb = []; score = 0; lives = 3; over = false; wave = 1; cool = 0; flash = 0; stars = Array.from({ length: 60 }, () => ({ x: rnd(W), y: rnd(H), s: Math.random() * 1.5 + .3 })); spawn(); api.score(0); api.overlay('<b>Space Blasters</b>← → move · Space shoot<br><small>Press Space to start</small>'); }
    function spawn() { enemies = []; dir = 1; const rows = 2 + Math.min(wave, 3); for (let r = 0; r < rows; r++) for (let i = 0; i < 8; i++) enemies.push({ x: 60 + i * 46, y: 60 + r * 40, hp: 1, kind: r % 3 }); }
    function shoot() { if (over) { reset(); return; } api.overlay(null); if (cool > 0) return; cool = 260; bullets.push({ x: ship, y: H - 50 }); api.beep(880, .04); }
    api.onKey(e => { keys[e.key] = true; if (e.code === 'Space') { e.preventDefault(); shoot(); } });
    api.onKeyUp(e => { keys[e.key] = false; });
    api.onMove(e => { const r = c.getBoundingClientRect(); ship = clamp((e.clientX - r.left) * (W / r.width), 20, W - 20); });
    api.onTap(shoot); api.onRestart(reset);
    function die() { lives--; flash = 12; api.beep(120, .3); eb = []; if (lives <= 0) { over = true; api.overlay(`<b>Game over</b>Score ${score} · wave ${wave}<br><small>Space / tap to retry</small>`); } }
    api.loop(dt => {
      const s = dt / 16.67;
      if (!over && !stage.querySelector('.overlay')) {
        cool -= dt; if (flash > 0) flash -= s;
        if (keys.ArrowLeft || keys.a) ship = clamp(ship - 6 * s, 20, W - 20);
        if (keys.ArrowRight || keys.d) ship = clamp(ship + 6 * s, 20, W - 20);
        bullets.forEach(b => b.y -= 9 * s); bullets = bullets.filter(b => b.y > -10);
        const sp = (0.8 + wave * .25) * s; let edge = false;
        enemies.forEach(e => { e.x += sp * dir; if (e.x < 20 || e.x > W - 20) edge = true; });
        if (edge) { dir *= -1; enemies.forEach(e => { e.y += 14; e.x += sp * dir; }); }
        if (Math.random() < 0.012 * s * (1 + wave * .2) && enemies.length) { const e = enemies[rnd(enemies.length)]; eb.push({ x: e.x, y: e.y + 10 }); }
        eb.forEach(b => b.y += 4.5 * s); eb = eb.filter(b => b.y < H + 10);
        bullets.forEach(b => { const e = enemies.find(e => Math.abs(e.x - b.x) < 18 && Math.abs(e.y - b.y) < 14); if (e) { b.y = -99; enemies.splice(enemies.indexOf(e), 1); score += 10 * (e.kind + 1); api.score(score); api.beep(300 + e.kind * 100, .05); } });
        if (eb.some(b => Math.abs(b.x - ship) < 16 && b.y > H - 56 && b.y < H - 30)) die();
        if (enemies.some(e => e.y > H - 70)) { enemies = []; die(); if (!over) spawn(); }
        if (!enemies.length && !over) { wave++; score += 50; api.score(score); spawn(); api.beep(1000, .15); }
        stars.forEach(st => { st.y += st.s * s; if (st.y > H) { st.y = 0; st.x = rnd(W); } });
      }
      draw();
    });
    function draw() {
      x.fillStyle = flash > 0 ? '#3b0a0a' : '#050814'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#fff'; stars.forEach(st => x.fillRect(st.x, st.y, st.s, st.s));
      enemies.forEach(e => { x.fillStyle = ['#a78bfa', '#f472b6', '#34d399'][e.kind]; x.beginPath(); x.moveTo(e.x, e.y - 12); x.lineTo(e.x + 16, e.y + 8); x.lineTo(e.x - 16, e.y + 8); x.closePath(); x.fill(); x.fillStyle = '#fff'; x.fillRect(e.x - 6, e.y - 2, 4, 4); x.fillRect(e.x + 2, e.y - 2, 4, 4); });
      x.fillStyle = '#facc15'; bullets.forEach(b => x.fillRect(b.x - 2, b.y - 8, 4, 12));
      x.fillStyle = '#f87171'; eb.forEach(b => x.fillRect(b.x - 2, b.y - 6, 4, 10));
      x.fillStyle = '#22d3ee'; x.beginPath(); x.moveTo(ship, H - 60); x.lineTo(ship + 18, H - 30); x.lineTo(ship - 18, H - 30); x.closePath(); x.fill();
      x.fillStyle = '#fff'; x.font = 'bold 14px monospace'; x.fillText('Score ' + score, 8, 20); x.fillText('Wave ' + wave, W / 2 - 30, 20); x.fillText('❤'.repeat(Math.max(0, lives)), W - 60, 20);
    }
    reset();
  } },

/* ===== WHACK-A-MOLE ===== */
{ id: 'mole', title: 'Whack-a-Mole', emoji: '🐹', cat: 'arcade', colors: ['#78350f', '#f59e0b'],
  help: 'Click the moles as fast as you can. 30 seconds on the clock!',
  run(stage, api) {
    const root = api.dom('mole'); const hud = api.el('div', 'hud', root); const board = api.el('div', 'board', root);
    board.style.gridTemplateColumns = 'repeat(3, 100px)'; board.style.gap = '14px';
    let score, time, active, running, tiles, speed, ticker, popper;
    function reset() {
      score = 0; time = 30; active = -1; running = false; speed = 900; clearInterval(ticker); clearTimeout(popper);
      board.innerHTML = ''; tiles = Array.from({ length: 9 }, (_, i) => { const t = api.el('div', 'tile', board); t.textContent = '🕳️'; t.onclick = () => hit(i); return t; });
      render(); api.overlay('<b>Whack-a-Mole</b>Click to start!');
    }
    function start() { if (running) return; running = true; api.overlay(null); ticker = api.every(1000, () => { time--; render(); if (time <= 0) end(); }); pop(); }
    function pop() { if (!running) return; if (active >= 0) tiles[active].textContent = '🕳️'; let n; do { n = rnd(9); } while (n === active); active = n; tiles[n].textContent = Math.random() < .15 ? '💣' : '🐹'; popper = api.after(speed, pop); }
    function hit(i) {
      if (!running) { start(); return; } if (i !== active) return;
      if (tiles[i].textContent === '💣') { score = Math.max(0, score - 5); api.beep(120, .2); } else { score++; api.beep(700, .04); speed = Math.max(400, speed - 12); }
      tiles[i].textContent = '💥'; active = -1; api.score(score); render(); clearTimeout(popper); popper = api.after(250, pop);
    }
    function end() { running = false; clearInterval(ticker); clearTimeout(popper); api.overlay(`<b>Time's up!</b>You whacked ${score}<br><small>Press R to play again</small>`); }
    function render() { hud.textContent = `Score ${score}   ⏱ ${time}s`; }
    api.onTap(() => { if (!running && time === 30) start(); });
    api.onRestart(reset); reset();
  } },

/* ===== SIMON ===== */
{ id: 'simon', title: 'Simon Says', emoji: '🎵', cat: 'puzzle', colors: ['#dc2626', '#2563eb'],
  help: 'Watch the pattern, then repeat it. Each round adds one more step.',
  run(stage, api) {
    const root = api.dom('simon'); const hud = api.el('div', 'hud', root); const board = api.el('div', 'board', root);
    board.style.gridTemplateColumns = 'repeat(2, 120px)'; board.style.gap = '12px';
    const COLS = ['#ef4444', '#22c55e', '#3b82f6', '#eab308'], FREQ = [330, 392, 494, 587];
    let seq, pos, playing, round, tiles, started;
    function reset() { seq = []; pos = 0; round = 0; playing = false; started = false; board.innerHTML = ''; tiles = COLS.map((c, i) => { const t = api.el('div', 'tile', board); t.style.background = c; t.onclick = () => press(i); return t; }); render(); api.overlay('<b>Simon Says</b><small>Click to start</small>'); }
    function lit(i, ms) { tiles[i].classList.add('lit'); api.beep(FREQ[i], ms / 1000); api.after(ms, () => tiles[i].classList.remove('lit')); }
    function next() { seq.push(rnd(4)); round++; pos = 0; playing = true; render(); seq.forEach((v, k) => api.after(600 + k * 650, () => lit(v, 420))); api.after(600 + seq.length * 650, () => playing = false); }
    function press(i) {
      if (!started) { started = true; api.overlay(null); next(); return; }
      if (playing) return; lit(i, 250);
      if (seq[pos] !== i) { api.beep(100, .5); api.overlay(`<b>Wrong! 😵</b>You reached round ${round}<br><small>Press R to try again</small>`); playing = true; return; }
      pos++; if (pos === seq.length) { api.score(round); api.after(500, next); }
    }
    function render() { hud.textContent = `Round ${round}`; }
    api.onTap(() => { if (!started) { started = true; api.overlay(null); next(); } });
    api.onRestart(reset); reset();
  } },

/* ===== DINO RUN ===== */
{ id: 'dino', title: 'Dino Run', emoji: '🦖', cat: 'arcade', colors: ['#525252', '#d4d4d4'],
  help: 'Space / ↑ / tap to jump, ↓ to duck. How far can you run?',
  run(stage, api) {
    const W = 600, H = 240, G = H - 40; const { c, x } = api.canvas(W, H);
    let y, vy, obs, dist, alive, started, speed, duck, t, legs;
    function reset() { y = G; vy = 0; obs = []; dist = 0; alive = true; started = false; speed = 6; duck = false; t = 0; legs = 0; api.score(0); api.overlay('<b>Dino Run</b><small>Space / tap to start</small>'); draw(); }
    function jump() { if (!alive) { reset(); return; } if (!started) { started = true; api.overlay(null); } if (y >= G) { vy = -11; api.beep(500, .05); } }
    api.onKey(e => { if (e.code === 'Space' || e.key === 'ArrowUp') { e.preventDefault(); jump(); } if (e.key === 'ArrowDown') { e.preventDefault(); duck = true; } });
    api.onKeyUp(e => { if (e.key === 'ArrowDown') duck = false; });
    api.onTap(jump); api.onRestart(reset);
    api.loop(dt => {
      const s = dt / 16.67;
      if (started && alive) {
        vy += .6 * s; y += vy * s; if (y > G) { y = G; vy = 0; }
        t += dt; legs += s; dist += speed * s * .1; speed = 6 + dist / 150;
        if (t > 900 + rnd(800)) { t = 0; const fly = Math.random() < .25 && dist > 40; obs.push({ x: W + 20, w: fly ? 34 : 16 + rnd(20), h: fly ? 20 : 26 + rnd(24), fly }); }
        obs.forEach(o => o.x -= speed * s); obs = obs.filter(o => o.x > -50);
        const dh = duck && y >= G ? 24 : 44, dw = 28, dx = 60, dy = y - dh;
        for (const o of obs) { const oy = o.fly ? G - 60 : G - o.h; if (dx + dw > o.x + 4 && dx < o.x + o.w - 4 && y > oy + 4 && dy < oy + o.h - 4) { alive = false; api.beep(120, .4); api.overlay(`<b>Game over</b>${Math.floor(dist)} m<br><small>Space / tap to retry</small>`); } }
        api.score(Math.floor(dist));
      }
      draw();
    });
    function draw() {
      x.fillStyle = '#f5f5f4'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#a3a3a3'; x.fillRect(0, G, W, 2); for (let i = 0; i < 12; i++) x.fillRect((i * 60 - (dist * 10) % 60), G + 8, 20, 2);
      x.fillStyle = '#404040';
      const dh = duck && y >= G ? 24 : 44;
      x.fillRect(60, y - dh, 28, dh); x.fillRect(74, y - dh - 6, 22, 16); x.fillStyle = '#fff'; x.fillRect(88, y - dh - 2, 4, 4); x.fillStyle = '#404040';
      if (y >= G) { const l = Math.floor(legs / 6) % 2; x.fillRect(62 + l * 14, y - 8, 8, 8); } else { x.fillRect(62, y - 8, 8, 8); x.fillRect(76, y - 8, 8, 8); }
      obs.forEach(o => { x.fillStyle = o.fly ? '#525252' : '#15803d'; const oy = o.fly ? G - 60 : G - o.h; x.fillRect(o.x, oy, o.w, o.h); if (!o.fly) { x.fillRect(o.x - 6, oy + 10, 6, 12); x.fillRect(o.x + o.w, oy + 6, 6, 12); } });
      x.fillStyle = '#525252'; x.font = 'bold 14px monospace'; x.textAlign = 'right'; x.fillText(Math.floor(dist) + ' m', W - 12, 22); x.textAlign = 'left';
    }
    reset();
  } },
];
