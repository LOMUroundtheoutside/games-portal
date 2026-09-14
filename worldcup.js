/* ===== WORLD CUP 2026 — pick a nation and play the whole tournament =====
   The real 48 teams in their real groups (draw of 5 Dec 2025 plus the March 2026 play-off winners), the real
   round-of-32 slot rules, group tables, a bracket view, a playable 6-a-side top-down match engine with AI, and
   penalty shoot-outs for drawn knockout games. Other matches are simulated from team ratings. Progress is saved
   in localStorage so a tournament can be carried on later. */
(function () {
  // code, name, flag, attack, defence, home kit, away kit
  const T = {};
  const GROUPS = {
    A: [['MEX', 'Mexico', '🇲🇽', 78, 76, '#0b6b3a', '#ffffff'], ['RSA', 'South Africa', '🇿🇦', 66, 66, '#f5c400', '#0a7a3f'], ['KOR', 'South Korea', '🇰🇷', 77, 74, '#d7192d', '#ffffff'], ['CZE', 'Czechia', '🇨🇿', 74, 73, '#d7141a', '#ffffff']],
    B: [['CAN', 'Canada', '🇨🇦', 74, 72, '#d80621', '#ffffff'], ['BIH', 'Bosnia & Herzegovina', '🇧🇦', 72, 72, '#002395', '#f5c400'], ['QAT', 'Qatar', '🇶🇦', 66, 64, '#8a1538', '#ffffff'], ['SUI', 'Switzerland', '🇨🇭', 80, 80, '#d52b1e', '#ffffff']],
    C: [['BRA', 'Brazil', '🇧🇷', 89, 85, '#ffdc00', '#0033a0'], ['MAR', 'Morocco', '🇲🇦', 83, 84, '#c1272d', '#006233'], ['HAI', 'Haiti', '🇭🇹', 60, 58, '#00209f', '#d21034'], ['SCO', 'Scotland', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 74, 74, '#0b1f5e', '#ffffff']],
    D: [['USA', 'United States', '🇺🇸', 78, 77, '#ffffff', '#0a3161'], ['PAR', 'Paraguay', '🇵🇾', 74, 76, '#d52b1e', '#0038a8'], ['AUS', 'Australia', '🇦🇺', 74, 73, '#f5c400', '#0a5b2f'], ['TUR', 'Türkiye', '🇹🇷', 79, 76, '#e30a17', '#ffffff']],
    E: [['GER', 'Germany', '🇩🇪', 87, 84, '#ffffff', '#111111'], ['CUW', 'Curaçao', '🇨🇼', 60, 60, '#002b7f', '#f9e814'], ['CIV', 'Ivory Coast', '🇨🇮', 76, 74, '#f77f00', '#009e60'], ['ECU', 'Ecuador', '🇪🇨', 78, 78, '#ffd100', '#003ca0']],
    F: [['NED', 'Netherlands', '🇳🇱', 87, 86, '#ff7f00', '#ffffff'], ['JPN', 'Japan', '🇯🇵', 81, 79, '#1a2a6c', '#ffffff'], ['SWE', 'Sweden', '🇸🇪', 76, 75, '#ffd400', '#005baa'], ['TUN', 'Tunisia', '🇹🇳', 71, 71, '#e70013', '#ffffff']],
    G: [['BEL', 'Belgium', '🇧🇪', 84, 81, '#e30613', '#111111'], ['EGY', 'Egypt', '🇪🇬', 74, 73, '#c8102e', '#ffffff'], ['IRN', 'Iran', '🇮🇷', 75, 74, '#ffffff', '#239f40'], ['NZL', 'New Zealand', '🇳🇿', 64, 64, '#111111', '#ffffff']],
    H: [['ESP', 'Spain', '🇪🇸', 93, 90, '#c60b1e', '#ffc400'], ['CPV', 'Cape Verde', '🇨🇻', 66, 66, '#003893', '#ffffff'], ['KSA', 'Saudi Arabia', '🇸🇦', 69, 68, '#006c35', '#ffffff'], ['URU', 'Uruguay', '🇺🇾', 82, 83, '#7bb7e0', '#111111']],
    I: [['FRA', 'France', '🇫🇷', 91, 89, '#0d1b57', '#ffffff'], ['SEN', 'Senegal', '🇸🇳', 79, 78, '#ffffff', '#00853f'], ['IRQ', 'Iraq', '🇮🇶', 66, 66, '#007a3d', '#ffffff'], ['NOR', 'Norway', '🇳🇴', 81, 76, '#ba0c2f', '#ffffff']],
    J: [['ARG', 'Argentina', '🇦🇷', 91, 88, '#75aadb', '#1c2b5a'], ['ALG', 'Algeria', '🇩🇿', 74, 73, '#ffffff', '#006233'], ['AUT', 'Austria', '🇦🇹', 78, 77, '#ed2939', '#ffffff'], ['JOR', 'Jordan', '🇯🇴', 67, 66, '#ffffff', '#ce1126']],
    K: [['POR', 'Portugal', '🇵🇹', 88, 85, '#da291c', '#006600'], ['COD', 'DR Congo', '🇨🇩', 70, 68, '#007fff', '#f7d618'], ['UZB', 'Uzbekistan', '🇺🇿', 68, 68, '#ffffff', '#1eb53a'], ['COL', 'Colombia', '🇨🇴', 82, 81, '#fcd116', '#003893']],
    L: [['ENG', 'England', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 90, 88, '#ffffff', '#c8102e'], ['CRO', 'Croatia', '🇭🇷', 83, 81, '#e0162b', '#ffffff'], ['GHA', 'Ghana', '🇬🇭', 72, 72, '#ffffff', '#ce1126'], ['PAN', 'Panama', '🇵🇦', 68, 68, '#d21034', '#005293']],
  };
  const GL = Object.keys(GROUPS);
  for (const g of GL) GROUPS[g] = GROUPS[g].map(([code, name, flag, att, def, kit, kit2]) => (T[code] = { code, name, flag, att, def, kit, kit2, group: g }));
  const rating = t => (t.att + t.def) / 2;
  const stars = t => { const r = rating(t); return r >= 88 ? 5 : r >= 80 ? 4 : r >= 74 ? 3 : r >= 67 ? 2 : 1; };

  // FIFA's round-of-32 slots: [home, away] where '1A' = winner of A, '2A' = runner-up, '3:ABCDF' = a third-placed team from those groups
  const R32 = [
    [73, '2A', '2B'], [74, '1E', '3:ABCDF'], [75, '1F', '2C'], [76, '1C', '2F'], [77, '1I', '3:CDFGH'], [78, '2E', '2I'], [79, '1A', '3:CEFHI'], [80, '1L', '3:EHIJK'],
    [81, '1D', '3:BEFIJ'], [82, '1G', '3:AEHIJ'], [83, '2K', '2L'], [84, '1H', '2J'], [85, '1B', '3:EFGIJ'], [86, '1J', '2H'], [87, '1K', '3:DEIJL'], [88, '2D', '2G'],
  ];
  const R16 = [[89, 74, 77], [90, 73, 75], [91, 76, 78], [92, 79, 80], [93, 83, 84], [94, 81, 82], [95, 86, 88], [96, 85, 87]];
  const QF = [[97, 89, 90], [98, 93, 94], [99, 91, 92], [100, 95, 96]];
  const SF = [[101, 97, 98], [102, 99, 100]];
  const STAGES = ['group', 'r32', 'r16', 'qf', 'sf', 'final', 'done'];
  const STAGE_NAME = { group: 'Group stage', r32: 'Round of 32', r16: 'Round of 16', qf: 'Quarter-final', sf: 'Semi-final', third: 'Third-place play-off', final: 'The Final', done: 'Tournament over' };
  const BONUS = { r32: 10, r16: 25, qf: 50, sf: 100, final: 200, champion: 400 };
  const SAVE = 'gp-wc26';
  const rnd = n => Math.floor(Math.random() * n), clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- simulation of matches the player is not in ---------- */
  function poisson(l) { let k = 0, p = Math.exp(-l), s = p, u = Math.random(); while (u > s && k < 8) { k++; p *= l / k; s += p; } return k; }
  function simScore(a, b) {
    const xa = 1.35 * Math.pow(a.att / b.def, 2.2), xb = 1.35 * Math.pow(b.att / a.def, 2.2);
    return [poisson(xa), poisson(xb)];
  }
  function simPens(a, b) { const pa = rating(a) / (rating(a) + rating(b)); let sa = 0, sb = 0; for (let i = 0; i < 5 || sa === sb; i++) { if (Math.random() < .72 + (pa - .5)) sa++; if (Math.random() < .72 - (pa - .5)) sb++; if (i > 12) { sa++; break; } } return [sa, sb]; }

  /* ---------- tournament state ---------- */
  let S = null;   // { team, stage, md, group: {A: [[t1,t2,ga,gb], ...]}, ko: {73: {home, away, score, pens, winner}}, points, out, log }
  const groupFixtures = g => { const t = GROUPS[g].map(x => x.code); return [[t[0], t[1]], [t[2], t[3]], [t[0], t[2]], [t[1], t[3]], [t[0], t[3]], [t[1], t[2]]]; };
  function newTournament(code) {
    S = { team: code, stage: 'group', md: 0, group: {}, ko: {}, points: 0, out: null, log: [], champion: null };
    for (const g of GL) S.group[g] = groupFixtures(g).map(([a, b]) => ({ a, b, s: null }));
    save();
  }
  function save() { try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch {} }
  function load() { S = null; try { const s = JSON.parse(localStorage.getItem(SAVE)); if (s && s.team && T[s.team] && s.stage) S = s; } catch {} }

  function table(g) {
    const rows = {}; for (const t of GROUPS[g]) rows[t.code] = { code: t.code, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
    for (const f of S.group[g]) { if (!f.s) continue; const [x, y] = f.s, A = rows[f.a], B = rows[f.b]; A.p++; B.p++; A.gf += x; A.ga += y; B.gf += y; B.ga += x;
      if (x > y) { A.w++; B.l++; A.pts += 3; } else if (x < y) { B.w++; A.l++; B.pts += 3; } else { A.d++; B.d++; A.pts++; B.pts++; } }
    return Object.values(rows).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || rating(T[b.code]) - rating(T[a.code]));
  }
  // thirds: best 8 by the same criteria, then place them in the 8 slots respecting each slot's allowed groups
  function buildR32() {
    const pos = {}; const thirds = [];
    for (const g of GL) { const t = table(g); pos['1' + g] = t[0].code; pos['2' + g] = t[1].code; thirds.push({ ...t[2], g }); }
    thirds.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || rating(T[b.code]) - rating(T[a.code]));
    const q = thirds.slice(0, 8);
    const slots = R32.filter(m => m[2].startsWith('3:')).map(m => ({ n: m[0], ok: m[2].slice(2) }));
    const assign = {}; const used = new Set();
    const rec = i => { if (i === slots.length) return true; for (const t of q) { if (used.has(t.code) || !slots[i].ok.includes(t.g)) continue; used.add(t.code); assign[slots[i].n] = t.code; if (rec(i + 1)) return true; used.delete(t.code); } return false; };
    if (!rec(0)) { let i = 0; for (const s of slots) assign[s.n] = q[i++].code; }   // never happens with FIFA's table, but never leave a slot empty
    for (const [n, h, a] of R32) S.ko[n] = { home: pos[h] || null, away: a.startsWith('3:') ? assign[n] : pos[a], s: null, pens: null, winner: null };
  }
  const roundMatches = stage => stage === 'r32' ? R32.map(m => m[0]) : stage === 'r16' ? R16.map(m => m[0]) : stage === 'qf' ? QF.map(m => m[0]) : stage === 'sf' ? SF.map(m => m[0]) : stage === 'final' ? [103, 104] : [];
  function seedRound(stage) {
    const src = stage === 'r16' ? R16 : stage === 'qf' ? QF : stage === 'sf' ? SF : null;
    if (src) for (const [n, x, y] of src) S.ko[n] = { home: S.ko[x].winner, away: S.ko[y].winner, s: null, pens: null, winner: null };
    if (stage === 'final') {
      const l = m => S.ko[m].winner === S.ko[m].home ? S.ko[m].away : S.ko[m].home;
      S.ko[103] = { home: l(101), away: l(102), s: null, pens: null, winner: null, third: true };
      S.ko[104] = { home: S.ko[101].winner, away: S.ko[102].winner, s: null, pens: null, winner: null, final: true };
    }
  }
  const myFixture = () => {
    if (S.stage === 'group') { const g = T[S.team].group; const f = S.group[g].filter(x => x.a === S.team || x.b === S.team)[S.md]; return f ? { a: f.a, b: f.b, ref: f } : null; }
    for (const n of roundMatches(S.stage)) { const m = S.ko[n]; if (!m.s && (m.home === S.team || m.away === S.team)) return { a: m.home, b: m.away, ref: m, n }; }
    return null;
  };
  // settle everything else in the current round with simulated results, then move the tournament on
  function finishRound() {
    if (S.stage === 'group') {
      for (const g of GL) { const f = S.group[g][S.md * 2], f2 = S.group[g][S.md * 2 + 1]; for (const x of [f, f2]) if (!x.s) x.s = simScore(T[x.a], T[x.b]); }
      S.md++;
      if (S.md === 3) {
        buildR32(); S.stage = 'r32';
        const t = table(T[S.team].group), pos = t.findIndex(r => r.code === S.team);
        const inR32 = Object.values(S.ko).some(m => m.home === S.team || m.away === S.team);
        if (inR32) { S.points += BONUS.r32; S.log.push(`Through to the round of 32 (${['1st', '2nd', '3rd'][pos]} in Group ${T[S.team].group})`); }
        else { S.out = 'group'; S.log.push(`Out in the group stage (${['1st', '2nd', '3rd', '4th'][pos]} in Group ${T[S.team].group})`); }
      }
    } else {
      for (const n of roundMatches(S.stage)) { const m = S.ko[n]; if (m.s) continue; m.s = simScore(T[m.home], T[m.away]); if (m.s[0] === m.s[1]) m.pens = simPens(T[m.home], T[m.away]); m.winner = koWinner(m); }
      const i = STAGES.indexOf(S.stage), next = STAGES[i + 1];
      if (S.stage === 'final') { S.champion = S.ko[104].winner; S.stage = 'done'; if (S.champion === S.team) { S.points += BONUS.champion; S.log.push('WORLD CHAMPIONS! 🏆'); } }
      else { S.stage = next; seedRound(next); const still = Object.keys(S.ko).some(n => roundMatches(next).includes(+n) && (S.ko[n].home === S.team || S.ko[n].away === S.team) && !S.ko[n].third);
        if (still && !S.out) { S.points += BONUS[next] || 0; S.log.push(`Into the ${STAGE_NAME[next].toLowerCase()}`); } }
    }
    save();
  }
  const koWinner = m => m.s[0] > m.s[1] ? m.home : m.s[1] > m.s[0] ? m.away : (m.pens[0] > m.pens[1] ? m.home : m.away);
  function recordMine(fx, score, pens) {
    const me = fx.a === S.team ? 0 : 1, gf = score[me], ga = score[1 - me];
    S.points += gf * 2 + (gf > ga ? 5 : gf === ga ? 1 : 0);
    if (S.stage === 'group') { fx.ref.s = score; S.log.push(`Group: ${T[fx.a].name} ${score[0]}–${score[1]} ${T[fx.b].name}`); }
    else { fx.ref.s = score; fx.ref.pens = pens; fx.ref.winner = koWinner(fx.ref); const won = fx.ref.winner === S.team;
      S.log.push(`${STAGE_NAME[fx.ref.third ? 'third' : S.stage]}: ${T[fx.a].name} ${score[0]}–${score[1]} ${T[fx.b].name}${pens ? ` (${pens[0]}–${pens[1]} pens)` : ''}`);
      if (!won && !fx.ref.third && !S.out) { S.out = S.stage; S.log.push(`Knocked out in the ${STAGE_NAME[S.stage].toLowerCase()}`); } }
    finishRound();
  }

  /* ---------- the game ---------- */
  GAMES.push({
    id: 'worldcup', title: 'World Cup 2026', emoji: '🏆', cat: 'action', colors: ['#14532d', '#facc15'],
    help: 'Pick one of the 48 real nations and play the whole 2026 World Cup: 12 groups, round of 32, then knockouts to the final. In matches: arrows / WASD move, Space shoots (aim with ↑↓), X or Shift passes, C switches player. Drawn knockout games go to penalties.',
    run(stage, api) {
      const root = api.dom('wc');
      const css = document.createElement('style'); root.appendChild(css);
      css.textContent = `
        .wc { width: 100%; max-width: 960px; min-height: 560px; color: #f3f4f6; font-family: system-ui, sans-serif; background: radial-gradient(circle at 30% 0, #14532d, #052e16 70%); align-items: stretch; box-sizing: border-box; padding: 14px 18px; }
        .wc h2 { margin: 0 0 4px; font-size: 1.5rem; } .wc h3 { margin: 14px 0 6px; font-size: 1rem; color: #bbf7d0; }
        .wc .muted { color: #a7f3d0; opacity: .8; font-size: .85rem; }
        .wc .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px 10px; }
        .wc .grp { background: rgba(0,0,0,.25); border-radius: 10px; padding: 8px 10px; }
        .wc .grp b { display: block; color: #fde047; margin-bottom: 4px; }
        .wc .pick { display: flex; align-items: center; gap: 6px; width: 100%; text-align: left; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); color: #fff; border-radius: 8px; padding: 5px 8px; margin: 3px 0; cursor: pointer; font-size: .85rem; }
        .wc .pick:hover { background: rgba(255,255,255,.18); } .wc .pick .st { margin-left: auto; color: #fde047; font-size: .7rem; letter-spacing: -1px; }
        .wc .btn { background: #facc15; color: #1f2937; border: 0; border-radius: 10px; padding: 10px 18px; font-weight: 800; font-size: 1rem; cursor: pointer; }
        .wc .btn.sec { background: rgba(255,255,255,.14); color: #fff; } .wc .btn:hover { filter: brightness(1.1); }
        .wc .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .wc .tabs { display: flex; gap: 6px; margin: 10px 0; } .wc .tab { background: rgba(255,255,255,.1); border: 0; color: #fff; padding: 6px 12px; border-radius: 999px; cursor: pointer; } .wc .tab.on { background: #facc15; color: #1f2937; font-weight: 700; }
        .wc table { border-collapse: collapse; width: 100%; font-size: .8rem; } .wc td, .wc th { padding: 2px 5px; text-align: right; } .wc td:first-child, .wc th:first-child { text-align: left; }
        .wc tr.me td { color: #fde047; font-weight: 700; } .wc tr.q td:first-child::before { content: '▸ '; color: #4ade80; }
        .wc .next { background: rgba(0,0,0,.3); border-radius: 14px; padding: 18px; text-align: center; }
        .wc .vs { display: flex; justify-content: center; align-items: center; gap: 24px; font-size: 1.2rem; font-weight: 800; margin: 8px 0 14px; } .wc .vs .fl { font-size: 2.6rem; display: block; }
        .wc .bracket { display: flex; gap: 12px; overflow: auto; max-height: 470px; padding-bottom: 8px; } .wc .col { display: flex; flex-direction: column; justify-content: space-around; gap: 4px; min-width: 140px; }
        .wc .m { background: rgba(0,0,0,.35); border-radius: 8px; font-size: .72rem; overflow: hidden; flex-shrink: 0; } .wc .m div { display: flex; gap: 5px; padding: 2px 7px; } .wc .m div span:last-child { margin-left: auto; font-weight: 700; }
        .wc .m .w { background: rgba(74,222,128,.18); } .wc .m .me { color: #fde047; font-weight: 700; } .wc .m .hd { font-size: .65rem; color: #a7f3d0; padding: 2px 7px 0; }
        .wc .log { font-size: .85rem; line-height: 1.6; } .wc .fix { display: grid; grid-template-columns: 1fr auto 1fr; gap: 6px; font-size: .8rem; align-items: center; padding: 2px 0; } .wc .fix span:first-child { text-align: right; }
        .wc kbd { background: rgba(255,255,255,.15); border-radius: 5px; padding: 0 6px; font-family: ui-monospace, monospace; }
        @media (max-width: 800px) { .wc .grid { grid-template-columns: repeat(2, 1fr); } }
      `;
      const ui = document.createElement('div'); root.appendChild(ui);
      let tab = 'next', match = null;
      const flag = c => T[c] ? T[c].flag : '·', name = c => T[c] ? T[c].name : 'TBD';
      const html = (s, ...v) => s.reduce((o, p, i) => o + p + (v[i] ?? ''), '');

      function selectScreen() {
        let h = html`<h2>🏆 FIFA World Cup 2026</h2><div class="muted">United States · Canada · Mexico — the real 48 nations in their real groups. Pick yours.</div>`;
        if (S) h += html`<div class="row" style="margin:10px 0"><button class="btn" data-act="continue">▶ Continue as ${flag(S.team)} ${name(S.team)} (${STAGE_NAME[S.stage]})</button><span class="muted">or start again with a new team below</span></div>`;
        h += '<div class="grid" style="margin-top:10px">';
        for (const g of GL) { h += `<div class="grp"><b>Group ${g}</b>`; for (const t of GROUPS[g]) h += `<button class="pick" data-team="${t.code}"><span>${t.flag}</span><span>${t.name}</span><span class="st">${'★'.repeat(stars(t))}</span></button>`; h += '</div>'; }
        ui.innerHTML = h + '</div>';
      }
      function hubScreen() {
        const me = T[S.team], fx = myFixture();
        let h = html`<div class="row"><h2 style="margin:0">${me.flag} ${me.name}</h2><span class="muted">${STAGE_NAME[S.stage]}${S.stage === 'group' ? ` · matchday ${Math.min(3, S.md + 1)} of 3` : ''}</span><span style="margin-left:auto;font-weight:800;color:#fde047">${S.points} pts</span></div>`;
        h += `<div class="tabs">${['next', 'groups', 'bracket', 'results'].map(t => `<button class="tab ${tab === t ? 'on' : ''}" data-tab="${t}">${{ next: 'Next match', groups: 'Groups', bracket: 'Bracket', results: 'My tournament' }[t]}</button>`).join('')}</div>`;
        if (tab === 'next') {
          if (S.stage === 'done') {
            const c = T[S.champion];
            h += html`<div class="next"><h2>${S.champion === S.team ? '🏆 WORLD CHAMPIONS!' : 'Tournament over'}</h2><div class="vs"><span><span class="fl">${c.flag}</span>${c.name}</span></div><div class="muted">${S.champion === S.team ? 'You did it — the whole world watched you lift it.' : `${c.name} lifted the trophy. ${S.out ? 'Your run ended in the ' + STAGE_NAME[S.out].toLowerCase() + '.' : ''}`}</div><div class="row" style="justify-content:center;margin-top:14px"><button class="btn" data-act="new">Start a new tournament</button></div></div>`;
          } else if (fx) {
            const opp = fx.a === S.team ? fx.b : fx.a, o = T[opp];
            h += html`<div class="next"><div class="muted">${fx.ref.third ? STAGE_NAME.third : S.stage === 'group' ? `Group ${me.group} · matchday ${S.md + 1}` : STAGE_NAME[S.stage]}</div>
              <div class="vs"><span><span class="fl">${T[fx.a].flag}</span>${T[fx.a].name}</span><span class="muted">v</span><span><span class="fl">${T[fx.b].flag}</span>${T[fx.b].name}</span></div>
              <div class="muted">${o.name}: attack ${o.att} · defence ${o.def} · ${'★'.repeat(stars(o))}${S.stage !== 'group' ? ' · a draw goes to penalties' : ''}</div>
              <div class="row" style="justify-content:center;margin-top:14px"><button class="btn" data-act="play">⚽ Kick off</button><button class="btn sec" data-act="sim">Simulate this match</button></div>
              <div class="muted" style="margin-top:10px"><kbd>↑↓←→</kbd> move · <kbd>Space</kbd> shoot (aim with ↑↓) · <kbd>X</kbd>/<kbd>Shift</kbd> pass · <kbd>C</kbd> switch player</div></div>`;
          } else {
            h += html`<div class="next"><h3 style="margin-top:0">${S.out ? `You went out in the ${STAGE_NAME[S.out].toLowerCase()}` : 'No match this round'}</h3><div class="muted">The rest of the ${STAGE_NAME[S.stage].toLowerCase()} is played without you.</div><div class="row" style="justify-content:center;margin-top:14px"><button class="btn" data-act="simround">Play the ${STAGE_NAME[S.stage].toLowerCase()} ▶</button><button class="btn sec" data-act="simall">Simulate to the final</button></div></div>`;
          }
          if (S.stage === 'group') h += groupTable(me.group, true);
        }
        if (tab === 'groups') { h += '<div class="grid">'; for (const g of GL) h += groupTable(g, false); h += '</div>'; }
        if (tab === 'bracket') h += bracket();
        if (tab === 'results') { h += '<h3>Your tournament</h3><div class="log">' + (S.log.length ? S.log.map(l => '• ' + l).join('<br>') : 'Nothing yet — kick off your first match!') + '</div>'; h += `<div class="row" style="margin-top:14px"><button class="btn sec" data-act="new">Start a new tournament</button></div>`; }
        ui.innerHTML = h;
      }
      function groupTable(g, big) {
        const t = table(g), played = S.group[g].some(f => f.s);
        let h = `<div class="grp"><b>Group ${g}</b><table><tr><th></th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr>`;
        t.forEach((r, i) => { h += `<tr class="${r.code === S.team ? 'me' : ''} ${played && S.md === 3 && i < 2 ? 'q' : ''}"><td>${flag(r.code)} ${big ? name(r.code) : r.code}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td><td><b>${r.pts}</b></td></tr>`; });
        h += '</table>';
        if (big) { h += '<h3>Fixtures</h3>'; for (const f of S.group[g]) h += `<div class="fix"><span>${name(f.a)} ${flag(f.a)}</span><b>${f.s ? f.s[0] + ' – ' + f.s[1] : 'v'}</b><span>${flag(f.b)} ${name(f.b)}</span></div>`; }
        return h + '</div>';
      }
      function bracket() {
        if (S.stage === 'group') return `<div class="muted">The bracket fills in after the group stage: 12 group winners, 12 runners-up and the 8 best third-placed teams.</div>` + slotList();
        const box = n => { const m = S.ko[n] || {}; const side = (c, s, w) => `<div class="${w ? 'w' : ''} ${c === S.team ? 'me' : ''}"><span>${flag(c)}</span><span>${c ? name(c) : 'TBD'}</span><span>${s ?? ''}</span></div>`;
          return `<div class="m"><div class="hd">${m.final ? 'FINAL' : m.third ? '3rd place' : 'M' + n}${m.pens ? ` · pens ${m.pens[0]}–${m.pens[1]}` : ''}</div>${side(m.home, m.s && m.s[0], m.winner && m.winner === m.home)}${side(m.away, m.s && m.s[1], m.winner && m.winner === m.away)}</div>`; };
        const col = (title, ns) => `<div class="col"><div class="hd muted">${title}</div>${ns.map(box).join('')}</div>`;
        const order32 = [74, 77, 73, 75, 76, 78, 79, 80, 83, 84, 81, 82, 86, 88, 85, 87];
        return `<div class="bracket">${col('Round of 32', order32)}${col('Round of 16', [89, 90, 91, 92, 93, 94, 95, 96])}${col('Quarter-finals', [97, 98, 99, 100])}${col('Semi-finals', [101, 102])}${col('Final', [104, 103])}</div>`;
      }
      const slotList = () => `<div class="grid" style="margin-top:10px">${R32.map(([n, h, a]) => `<div class="m"><div class="hd">Match ${n}</div><div><span>${h.replace(/^1/, 'Winner ').replace(/^2/, 'Runner-up ')}</span></div><div><span>${a.startsWith('3:') ? '3rd from ' + a.slice(2).split('').join('/') : a.replace(/^1/, 'Winner ').replace(/^2/, 'Runner-up ')}</span></div></div>`).join('')}</div>`;

      function render() { if (!S) selectScreen(); else hubScreen(); api.score(S ? S.points : 0); }
      ui.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b || match) return;
        if (b.dataset.team) { newTournament(b.dataset.team); tab = 'next'; render(); return; }
        if (b.dataset.tab) { tab = b.dataset.tab; render(); return; }
        const act = b.dataset.act;
        if (act === 'continue') { tab = 'next'; render(); }
        if (act === 'new') { if (confirm('Start a brand new tournament? Your current one will be lost.')) { S = null; try { localStorage.removeItem(SAVE); } catch {} render(); } }
        if (act === 'play') { const fx = myFixture(); if (fx) startMatch(fx); }
        if (act === 'sim') { const fx = myFixture(); if (fx) { const s = simScore(T[fx.a], T[fx.b]); const pens = S.stage !== 'group' && s[0] === s[1] ? simPens(T[fx.a], T[fx.b]) : null; recordMine(fx, s, pens); render(); } }
        if (act === 'simround') { finishRound(); render(); }
        if (act === 'simall') { let n = 0; while (S.stage !== 'done' && n++ < 10) finishRound(); render(); }
      });
      load(); render();
      api.onRestart(() => { if (match) { match.abort(); match = null; } root.hidden = false; render(); });

      /* ---------- match engine: 6-a-side, top-down, whole pitch on screen ---------- */
      function startMatch(fx) {
        root.hidden = true;
        const home = T[fx.a], away = T[fx.b], meHome = fx.a === S.team;
        const ko = S.stage !== 'group';
        match = playMatch(stage, api, home, away, meHome, ko, (score, pens) => { match = null; root.hidden = false; recordMine(fx, score, pens); tab = 'next'; render(); });
      }
      function playMatch(stage, api, home, away, meHome, ko, onEnd) {
        const W = 900, H = 560, PX = 50, PY = 58, PW = 800, PH = 440, CY = PY + PH / 2, GW = 110, GD = 22;
        const { c, x } = api.canvas(W, H, Math.min(2, window.devicePixelRatio || 1));
        const HALF = 80;   // seconds of real time per half
        const kitFor = (t, other) => (t.kit === other.kit || (isLight(t.kit) && isLight(other.kit))) ? t.kit2 : t.kit;
        function isLight(hex) { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * .3 + ((n >> 8) & 255) * .59 + (n & 255) * .11) > 180; }
        const teams = [{ t: home, dir: 1 }, { t: away, dir: -1 }];   // team 0 attacks right
        teams[0].kit = kitFor(home, away); teams[1].kit = kitFor(away, teams[0].kit === home.kit ? home : { kit: teams[0].kit });
        if (teams[0].kit === teams[1].kit) teams[1].kit = away.kit2 === teams[0].kit ? away.kit : away.kit2;
        const my = meHome ? 0 : 1;
        const FORM = [[.03, .5], [.2, .27], [.2, .73], [.45, .3], [.45, .7], [.66, .5]];
        const players = [];
        for (let ti = 0; ti < 2; ti++) for (let i = 0; i < 6; i++) players.push({ team: ti, i, gk: i === 0, x: 0, y: 0, vx: 0, vy: 0, fx: 1, fy: 0, cool: 0, think: Math.random() * .3, num: [1, 4, 5, 8, 7, 9][i], spd: (i === 0 ? 150 : 150 + (rating(teams[ti].t) - 60) * 1.4) });
        const ball = { x: 0, y: 0, vx: 0, vy: 0, z: 0, vz: 0, owner: -1 };
        const k = { l: 0, r: 0, u: 0, d: 0 };
        let auto = false, ctrl = my * 6 + 5, t = 0, half = 1, score = [0, 0], msg = '', msgT = 0, pause = 0, over = false, pens = null, shoot = null, done = false, aborted = false;
        const homeSpot = p => { const f = FORM[p.i], d = teams[p.team].dir; return [d === 1 ? PX + f[0] * PW : PX + PW - f[0] * PW, PY + f[1] * PH]; };
        function kickoff(ti) {
          for (const p of players) { const [hx, hy] = homeSpot(p); p.x = hx; p.y = hy; p.vx = p.vy = 0; p.cool = 0; }
          ball.x = PX + PW / 2; ball.y = CY; ball.vx = ball.vy = ball.z = ball.vz = 0; ball.owner = -1;
          const st = players[ti * 6 + 5]; st.x = ball.x - teams[ti].dir * 16; st.y = CY; ball.owner = st.team * 6 + st.i; ball.x = st.x + teams[ti].dir * 12;
          if (st.team === my) ctrl = st.team * 6 + st.i;
        }
        kickoff(0);
        const say = (m, s = 1.6) => { msg = m; msgT = s; };
        say(`${home.flag} ${home.name}  v  ${away.name} ${away.flag}`, 2);
        pause = 1.2;

        // input
        const map = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd' };
        api.onKey(e => {
          if (shoot) { shoot.key(e); return; }
          const m = map[e.key]; if (m) { e.preventDefault(); k[m] = 1; return; }
          if (e.key === ' ') { e.preventDefault(); action('shoot'); }
          if (e.key === 'x' || e.key === 'X' || e.key === 'Shift') { e.preventDefault(); action('pass'); }
          if (e.key === 'c' || e.key === 'C') switchPlayer();
        });
        api.onKeyUp(e => { const m = map[e.key]; if (m) k[m] = 0; });
        api.on(window, 'blur', () => { for (const q in k) k[q] = 0; });
        // touch: left half is a joystick, right half taps shoot, right-bottom passes
        let tp = null; api.on(stage, 'pointerdown', e => { const r = stage.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height; if (shoot) { shoot.tap(fx, fy); return; } if (fx < .5) tp = { x: e.clientX, y: e.clientY }; else action(fy > .6 ? 'pass' : 'shoot'); });
        api.on(stage, 'pointermove', e => { if (!tp) return; const dx = e.clientX - tp.x, dy = e.clientY - tp.y; k.l = dx < -12 ? 1 : 0; k.r = dx > 12 ? 1 : 0; k.u = dy < -12 ? 1 : 0; k.d = dy > 12 ? 1 : 0; });
        api.on(window, 'pointerup', () => { tp = null; k.l = k.r = k.u = k.d = 0; });

        const owner = () => ball.owner >= 0 ? players[ball.owner] : null;
        const goalX = ti => teams[ti].dir === 1 ? PX + PW : PX;
        const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
        function kick(p, dx, dy, speed, lift = 0) { const l = Math.hypot(dx, dy) || 1; ball.vx = dx / l * speed; ball.vy = dy / l * speed; ball.vz = lift; ball.owner = -1; p.cool = .35; ball.x = p.x + dx / l * 14; ball.y = p.y + dy / l * 14; }
        function shootAt(p, acc) {
          const gx = goalX(p.team), spread = (1 - acc) * 190; const ty = CY + (Math.random() - .5) * 2 * spread + (p.aim || 0);
          kick(p, gx - p.x, ty - p.y, 560 + acc * 120, 40 + Math.random() * 80);
        }
        function passTo(p, q) { const lead = .25; kick(p, q.x + q.vx * lead - p.x, q.y + q.vy * lead - p.y, 380 + dist(p, q) * .6); }
        function bestPass(p, prefDir) {
          let best = null, bs = -1e9;
          for (const q of players) { if (q.team !== p.team || q === p || q.gk) continue; const d = dist(p, q); if (d < 30) continue;
            const ahead = (q.x - p.x) * teams[p.team].dir, dirScore = prefDir ? ((q.x - p.x) * prefDir[0] + (q.y - p.y) * prefDir[1]) / d : 0;
            let s = ahead * .6 + dirScore * 120 - Math.abs(d - 220) * .3;
            for (const o of players) if (o.team !== p.team) { const dd = distToSeg(o, p, q); if (dd < 24) s -= 200; }
            if (s > bs) { bs = s; best = q; } }
          return best;
        }
        function distToSeg(o, a, b) { const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1; const u = clamp(((o.x - a.x) * dx + (o.y - a.y) * dy) / l2, 0, 1); return Math.hypot(o.x - a.x - u * dx, o.y - a.y - u * dy); }
        function action(kind) {
          if (over || pause > 0) return; const p = players[ctrl]; if (ball.owner !== ctrl) { p.burst = .35; return; }
          const acc = .55 + teams[p.team].t.att / 250;
          if (kind === 'shoot') { p.aim = (k.u ? -45 : 0) + (k.d ? 45 : 0); shootAt(p, acc); api.beep(220, .06); }
          else { const dir = (k.l || k.r || k.u || k.d) ? [k.r - k.l, k.d - k.u] : null; const q = bestPass(p, dir); if (q) passTo(p, q); else kick(p, teams[p.team].dir, 0, 380); api.beep(330, .04); }
        }
        function switchPlayer() { let best = null, bd = 1e9; for (const p of players) { if (p.team !== my || p.gk || p.team * 6 + p.i === ctrl) continue; const d = dist(p, ball); if (d < bd) { bd = d; best = p; } } if (best) ctrl = best.team * 6 + best.i; }
        function autoSwitch() { const o = owner(); if (o && o.team === my && !o.gk) { ctrl = o.team * 6 + o.i; return; } let best = null, bd = 1e9; for (const p of players) { if (p.team !== my || p.gk) continue; const d = dist(p, ball); if (d < bd) { bd = d; best = p; } } if (best) ctrl = best.team * 6 + best.i; }

        // AI for one outfield player
        function ai(p, dt) {
          p.think -= dt; if (p.think > 0) return; p.think = .18 + Math.random() * .12;
          const team = teams[p.team], o = owner(), have = o && o.team === p.team, theirs = o && o.team !== p.team;
          const gx = goalX(p.team), toGoal = Math.hypot(gx - p.x, CY - p.y);
          if (o === p) {
            const nearOpp = players.filter(q => q.team !== p.team && !q.gk).reduce((m, q) => Math.min(m, dist(p, q)), 1e9);
            const acc = .45 + team.t.att / 220;
            if (toGoal < 150 + team.t.att * .6 && Math.abs(p.y - CY) < 130 && Math.random() < .35 + acc * .3) { p.aim = 0; shootAt(p, acc); return; }
            if (nearOpp < 48 && Math.random() < .75) { const q = bestPass(p); if (q) { passTo(p, q); return; } }
            if (Math.random() < .08) { const q = bestPass(p); if (q && (q.x - p.x) * team.dir > 60) { passTo(p, q); return; } }
            // dribble: toward goal, sidestep the nearest opponent
            let dx = gx - p.x, dy = (CY - p.y) * .3; const opp = players.filter(q => q.team !== p.team).sort((a, b) => dist(p, a) - dist(p, b))[0];
            if (opp && dist(p, opp) < 70) { dy += (p.y - opp.y) * 3; }
            const l = Math.hypot(dx, dy) || 1; p.tx = p.x + dx / l * 80; p.ty = clamp(p.y + dy / l * 80, PY + 15, PY + PH - 15); return;
          }
          const [hx, hy] = homeSpot(p);
          const shift = have ? team.dir * 90 : theirs ? -team.dir * 60 : 0;
          const bx = (ball.x - (PX + PW / 2)) * .35, by = (ball.y - CY) * .3;
          p.tx = hx + shift + bx; p.ty = hy + by;
          if (!have) {   // the two closest chase / cover the ball
            const mates = players.filter(q => q.team === p.team && !q.gk).sort((a, b) => dist(a, ball) - dist(b, ball));
            if (mates[0] === p) { p.tx = ball.x + ball.vx * .15; p.ty = ball.y + ball.vy * .15; }
            else if (mates[1] === p) { const ogx = goalX(1 - p.team === 0 ? 0 : 1); const own = teams[p.team].dir === 1 ? PX : PX + PW; p.tx = (ball.x + own) / 2; p.ty = (ball.y + CY) / 2; void ogx; }
          } else if (o && dist(p, o) < 60) { p.tx = p.x + (p.x - o.x) * 2; p.ty = p.y + (p.y - o.y) * 2; }   // spread out from the carrier
        }
        function gk(p, dt) {
          const own = teams[p.team].dir === 1 ? PX + 14 : PX + PW - 14;
          p.tx = own; p.ty = clamp(ball.y, CY - GW / 2 - 10, CY + GW / 2 + 10);
          const near = dist(p, ball) < 34, towardUs = (ball.vx * teams[p.team].dir) < 0, loose = ball.owner < 0;
          if (loose && near && p.cool <= 0 && (towardUs || Math.hypot(ball.vx, ball.vy) < 200)) {
            const shotSpeed = Math.hypot(ball.vx, ball.vy), saveP = .5 + teams[p.team].t.def / 200 - shotSpeed / 3000;
            if (Math.random() < saveP || shotSpeed < 150) { ball.owner = p.team * 6 + p.i; ball.vx = ball.vy = ball.vz = 0; p.hold = .8; say('SAVE!', .8); api.beep(180, .06); }
            else p.cool = .5;
          }
          if (ball.owner === p.team * 6 + p.i) { p.hold -= dt; if (p.hold <= 0) { const q = bestPass(p) || players[p.team * 6 + 5]; kick(p, q.x - p.x, q.y - p.y, 460, 60); } }
        }
        function movePlayer(p, dt) {
          let dx = 0, dy = 0, spd = p.spd;
          if (p.team * 6 + p.i === ctrl && !shoot && !auto) { dx = k.r - k.l; dy = k.d - k.u; if (p.burst > 0) { spd *= 1.5; p.burst -= dt; } }
          else { if (p.tx == null) { const [hx, hy] = homeSpot(p); p.tx = hx; p.ty = hy; } dx = p.tx - p.x; dy = p.ty - p.y; const l = Math.hypot(dx, dy); if (l < 4) { dx = dy = 0; } else { dx /= l; dy /= l; } if (p.gk) spd = 240; }
          if (ball.owner === p.team * 6 + p.i && !p.gk) spd *= .88;
          const l = Math.hypot(dx, dy) || 1; if (l > 1) { dx /= l; dy /= l; }
          p.vx = dx * spd; p.vy = dy * spd; p.x = clamp(p.x + p.vx * dt, PX - 10, PX + PW + 10); p.y = clamp(p.y + p.vy * dt, PY - 10, PY + PH + 10);
          if (dx || dy) { p.fx = dx; p.fy = dy; }
          if (p.cool > 0) p.cool -= dt;
        }
        function physics(dt) {
          for (const p of players) { if (p.gk) gk(p, dt); else if (auto || p.team * 6 + p.i !== ctrl) ai(p, dt); movePlayer(p, dt); }
          const o = owner();
          if (o) { ball.x = o.x + o.fx * 13; ball.y = o.y + o.fy * 13; ball.vx = o.vx; ball.vy = o.vy; ball.z = 0; }
          else {
            ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z = Math.max(0, ball.z + ball.vz * dt); if (ball.z > 0) ball.vz -= 400 * dt; else ball.vz = 0;
            const f = Math.pow(ball.z > 0 ? .8 : .42, dt); ball.vx *= f; ball.vy *= f;
            if (Math.hypot(ball.vx, ball.vy) < 5) ball.vx = ball.vy = 0;
            // goals, then walls
            const inGoalY = Math.abs(ball.y - CY) < GW / 2 && ball.z < 40;
            if (ball.x < PX && inGoalY) { goal(1); return; } if (ball.x > PX + PW && inGoalY) { goal(0); return; }
            if (ball.x < PX + 6) { ball.x = PX + 6; ball.vx = Math.abs(ball.vx) * .5; } if (ball.x > PX + PW - 6) { ball.x = PX + PW - 6; ball.vx = -Math.abs(ball.vx) * .5; }
            if (ball.y < PY + 6) { ball.y = PY + 6; ball.vy = Math.abs(ball.vy) * .5; } if (ball.y > PY + PH - 6) { ball.y = PY + PH - 6; ball.vy = -Math.abs(ball.vy) * .5; }
          }
          // possession: pick up a loose ball; tackle a carrier
          for (const p of players) {
            if (p.gk) continue; const id = p.team * 6 + p.i, d = dist(p, ball);
            if (ball.owner < 0) { if (d < 15 && p.cool <= 0 && ball.z < 30) { ball.owner = id; if (p.team === my) ctrl = id; } }
            else if (o && o.team !== p.team && !o.gk && d < 20 && p.cool <= 0) {
              const pt = (teams[p.team].t.def / (teams[p.team].t.def + teams[o.team].t.att)) * 2.6 * dt;
              if (Math.random() < pt) { ball.owner = id; o.cool = .7; p.cool = .1; if (p.team === my) ctrl = id; else if (o.team === my) autoSwitch(); }
            }
          }
          if (ball.owner < 0 && ctrlLost()) autoSwitch();
        }
        const ctrlLost = () => { const p = players[ctrl]; return dist(p, ball) > 120 && players.some(q => q.team === my && !q.gk && dist(q, ball) < dist(p, ball) - 60); };
        function goal(ti) {
          score[ti]++; const t = teams[ti].t; say(`⚽ GOAL! ${t.flag} ${t.name}`, 2.2); pause = 2.2; api.beep(660, .1); api.after(120, () => api.beep(880, .15));
          burst = 1; kickoff(1 - ti);
        }
        let burst = 0;

        // clock and flow
        function tick(dt) {
          if (msgT > 0) msgT -= dt; if (burst > 0) burst -= dt;
          if (shoot) { shoot.tick(dt); return; }
          if (pause > 0) { pause -= dt; if (pause <= 0 && over) finish(); return; }
          if (over) return;
          t += dt;
          if (half === 1 && t >= HALF) { half = 2; say('HALF TIME', 2); pause = 2; kickoff(1); return; }
          if (half === 2 && t >= HALF * 2) { over = true; pause = 1.8; say(score[0] === score[1] && ko ? 'FULL TIME — PENALTIES!' : 'FULL TIME', 1.8); return; }
          const sub = Math.min(dt, 1 / 60); for (let s = 0; s < dt; s += sub) physics(Math.min(sub, dt - s));
        }
        function finish() {
          if (ko && score[0] === score[1] && !pens) { shoot = shootout(); return; }
          if (!done) { done = true; api.after(400, () => { c.remove(); if (!aborted) onEnd(score, pens); }); }
        }

        /* ---------- penalty shoot-out: pick a corner, then dive as the keeper ---------- */
        function shootout() {
          const seq = [], mine = my; let round = 0, turn = 0, tally = [0, 0], zone = 4, phase = 'aim', ph = 0, result = null, kicker = 0, kZone = 0, gZone = 0, msg2 = 'Pick a corner (arrows), Space to shoot';
          const zones = [[-1, 1], [0, 1], [1, 1], [-1, 0], [0, 0], [1, 0]];   // [column, high]
          const need = () => { const left = [5 - Math.min(5, seq.filter(s => s.team === 0).length), 5 - Math.min(5, seq.filter(s => s.team === 1).length)]; if (round < 5) { if (tally[0] > tally[1] + left[1] || tally[1] > tally[0] + left[0]) return true; return false; } return seq.length % 2 === 0 && tally[0] !== tally[1]; };
          const step = () => { kicker = turn; const isMe = kicker === mine; phase = 'aim'; ph = 0; msg2 = isMe ? 'Pick a corner with the arrows, then Space' : 'Pick where to dive with the arrows, then Space'; };
          const resolve = () => {
            const kt = teams[kicker].t, gt = teams[1 - kicker].t;
            const isMe = kicker === mine;
            if (isMe) { kZone = zone; const g = Math.random() < .5 + gt.def / 400 ? kZone : rnd(6); gZone = g; }
            else { kZone = Math.random() < .12 - kt.att / 1000 ? -1 : rnd(6); gZone = zone; }
            const miss = kZone === -1, saved = !miss && (gZone === kZone || (zones[gZone][0] === zones[kZone][0] && Math.random() < .35));
            const scored = !miss && !saved; if (scored) tally[kicker]++; seq.push({ team: kicker, ok: scored });
            result = miss ? 'MISSED!' : saved ? 'SAVED!' : 'GOAL!'; api.beep(scored ? 660 : 160, .12);
            phase = 'show'; ph = 0;
          };
          const fin = () => { pens = tally.slice(); over = true; shoot = null; done = false; finish(); };
          return {
            key(e) { if (phase !== 'aim') return; const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] }[e.key]; if (m) { e.preventDefault(); const col = clamp(zones[zone][0] + m[0], -1, 1), hi = clamp(zones[zone][1] - m[1], 0, 1); zone = zones.findIndex(z => z[0] === col && z[1] === hi); } if (e.key === ' ') { e.preventDefault(); resolve(); } },
            tap(fx, fy) { if (phase !== 'aim') return; const col = fx < .38 ? -1 : fx > .62 ? 1 : 0, hi = fy < .45 ? 1 : 0; zone = zones.findIndex(z => z[0] === col && z[1] === hi); resolve(); },
            tick(dt) { if (phase === 'start') { ph += dt; if (ph > 1.2) step(); } else if (phase === 'show') { ph += dt; if (ph > 1.4) { turn = 1 - turn; if (turn === 0) round++; if (need()) { phase = 'end'; ph = 0; } else step(); } } else if (phase === 'end') { ph += dt; if (ph > 1.6) fin(); } },
            draw() {
              x.fillStyle = '#0f5132'; x.fillRect(0, 0, W, H);
              // goal seen from the spot
              const gx0 = 190, gy0 = 110, gw = 520, gh = 190; x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(gx0, gy0, gw, gh);
              x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 1; for (let i = 0; i <= 26; i++) { x.beginPath(); x.moveTo(gx0 + i * gw / 26, gy0); x.lineTo(gx0 + i * gw / 26, gy0 + gh); x.stroke(); } for (let i = 0; i <= 9; i++) { x.beginPath(); x.moveTo(gx0, gy0 + i * gh / 9); x.lineTo(gx0 + gw, gy0 + i * gh / 9); x.stroke(); }
              x.strokeStyle = '#fff'; x.lineWidth = 8; x.strokeRect(gx0, gy0, gw, gh);
              x.fillStyle = '#4ade80'; x.fillRect(0, gy0 + gh, W, 3);
              const zc = z => [gx0 + gw / 2 + zones[z][0] * gw * .33, gy0 + gh * (zones[z][1] ? .28 : .74)];
              // keeper
              const kp = phase === 'show' || phase === 'end' ? zc(gZone) : [gx0 + gw / 2, gy0 + gh * .6];
              const gkKit = teams[1 - kicker].kit; x.fillStyle = '#facc15'; x.beginPath(); x.ellipse(kp[0], kp[1], phase === 'show' ? 46 : 18, phase === 'show' ? 28 : 40, phase === 'show' ? (zones[gZone][0] * .5) : 0, 0, Math.PI * 2); x.fill(); void gkKit;
              x.fillStyle = '#fde68a'; x.beginPath(); x.arc(kp[0], kp[1] - (phase === 'show' ? 18 : 44), 10, 0, Math.PI * 2); x.fill();
              // target
              if (phase === 'aim') { const z = zc(zone); x.strokeStyle = kicker === mine ? '#fde047' : '#60a5fa'; x.lineWidth = 4; x.beginPath(); x.arc(z[0], z[1], 26, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.moveTo(z[0] - 12, z[1]); x.lineTo(z[0] + 12, z[1]); x.moveTo(z[0], z[1] - 12); x.lineTo(z[0], z[1] + 12); x.stroke(); }
              // ball
              let bp = [W / 2, 470]; if (phase === 'show' || phase === 'end') { bp = kZone < 0 ? [gx0 + gw / 2 + 330, gy0 - 40] : zc(kZone); }
              x.fillStyle = '#fff'; x.beginPath(); x.arc(bp[0], bp[1], phase === 'aim' ? 16 : 10, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#111'; x.lineWidth = 2; x.stroke();
              // tallies
              x.font = '900 22px system-ui'; x.textAlign = 'center'; x.fillStyle = '#fff'; x.fillText(`PENALTIES  ·  ${teams[0].t.flag} ${tally[0]} – ${tally[1]} ${teams[1].t.flag}`, W / 2, 46);
              for (let ti = 0; ti < 2; ti++) { const s = seq.filter(q => q.team === ti); x.font = '20px system-ui'; let str = ''; for (let i = 0; i < Math.max(5, s.length); i++) str += s[i] ? (s[i].ok ? '🟢' : '🔴') : '⚪'; x.fillText(str, ti === 0 ? 200 : 700, 84); }
              x.font = '700 18px system-ui'; x.fillStyle = '#fde047';
              x.fillText(phase === 'show' ? `${teams[kicker].t.name}: ${result}` : phase === 'end' ? `${tally[0] > tally[1] ? teams[0].t.name : teams[1].t.name} win on penalties!` : `${teams[kicker].t.flag} ${teams[kicker].t.name} to take  —  ${msg2}`, W / 2, 530);
              x.textAlign = 'left';
            },
          };
        }
        shoot = null;

        /* ---------- drawing ---------- */
        const pitchG = (() => { const g = x.createLinearGradient(0, PY, 0, PY + PH); g.addColorStop(0, '#2f9e44'); g.addColorStop(1, '#2b8a3e'); return g; })();
        function drawPitch() {
          x.fillStyle = '#1b5e20'; x.fillRect(0, 0, W, H);
          x.fillStyle = pitchG; x.fillRect(PX, PY, PW, PH);
          for (let i = 0; i < 10; i += 2) { x.fillStyle = 'rgba(255,255,255,.05)'; x.fillRect(PX + i * PW / 10, PY, PW / 10, PH); }
          x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 2; x.strokeRect(PX, PY, PW, PH);
          x.beginPath(); x.moveTo(PX + PW / 2, PY); x.lineTo(PX + PW / 2, PY + PH); x.stroke(); x.beginPath(); x.arc(PX + PW / 2, CY, 60, 0, Math.PI * 2); x.stroke();
          for (const gx of [PX, PX + PW]) { const d = gx === PX ? 1 : -1; x.strokeRect(Math.min(gx, gx + d * 120), CY - 130, 120, 260); x.strokeRect(Math.min(gx, gx + d * 44), CY - 75, 44, 150); x.beginPath(); x.arc(gx + d * 80, CY, 3, 0, Math.PI * 2); x.stroke();
            x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(Math.min(gx, gx - d * GD), CY - GW / 2, GD, GW); x.strokeStyle = '#fff'; x.lineWidth = 3; x.strokeRect(Math.min(gx, gx - d * GD), CY - GW / 2, GD, GW); x.lineWidth = 2; x.strokeStyle = 'rgba(255,255,255,.85)'; }
        }
        function drawPlayer(p) {
          const kit = teams[p.team].kit, isCtrl = p.team * 6 + p.i === ctrl && !shoot;
          x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); x.ellipse(p.x + 3, p.y + 6, 11, 6, 0, 0, Math.PI * 2); x.fill();
          if (isCtrl) { x.strokeStyle = '#fde047'; x.lineWidth = 3; x.beginPath(); x.arc(p.x, p.y, 16, 0, Math.PI * 2); x.stroke(); }
          x.fillStyle = p.gk ? (isLight(kit) ? '#111827' : '#facc15') : kit; x.beginPath(); x.arc(p.x, p.y, 11, 0, Math.PI * 2); x.fill();
          x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 1.5; x.stroke();
          x.fillStyle = isLight(p.gk ? '#facc15' : kit) && !(p.gk && !isLight(kit)) ? '#111' : '#fff'; x.font = '700 10px system-ui'; x.textAlign = 'center'; x.fillText(p.num, p.x, p.y + 3.5);
          if (isCtrl) { x.fillStyle = '#fde047'; x.beginPath(); x.moveTo(p.x, p.y - 26); x.lineTo(p.x - 6, p.y - 34); x.lineTo(p.x + 6, p.y - 34); x.closePath(); x.fill(); }
        }
        function drawHud() {
          const min = Math.min(90, Math.floor((half === 1 ? t / HALF * 45 : 45 + (t - HALF) / HALF * 45)));
          x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(W / 2 - 200, 8, 400, 40);
          x.font = '900 22px system-ui'; x.textAlign = 'center'; x.fillStyle = '#fff';
          x.fillText(`${home.flag} ${home.code}  ${score[0]} – ${score[1]}  ${away.code} ${away.flag}`, W / 2, 36);
          x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(W / 2 + 210, 8, 70, 40); x.fillStyle = '#fde047'; x.font = '800 20px system-ui'; x.fillText(`${min}'`, W / 2 + 245, 36);
          x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(W / 2 - 280, 8, 70, 40); x.fillStyle = '#a7f3d0'; x.font = '700 13px system-ui'; x.fillText(half === 1 ? '1st half' : '2nd half', W / 2 - 245, 33);
          x.font = '700 12px system-ui'; x.fillStyle = 'rgba(255,255,255,.8)'; x.fillText(`You: ${teams[my].t.flag} ${teams[my].t.name} (attacking ${teams[my].dir === 1 ? '→' : '←'})`, W / 2, H - 14);
          if (msgT > 0) { x.font = '900 34px system-ui'; x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,.6)'; x.fillStyle = '#fde047'; x.strokeText(msg, W / 2, CY - 40); x.fillText(msg, W / 2, CY - 40); }
          x.textAlign = 'left';
        }
        function draw() {
          if (shoot) { shoot.draw(); return; }
          drawPitch();
          const sorted = players.slice().sort((a, b) => a.y - b.y); for (const p of sorted) drawPlayer(p);
          x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.ellipse(ball.x + 2, ball.y + 4 + ball.z * .3, 6 + ball.z * .05, 3.5, 0, 0, Math.PI * 2); x.fill();
          x.fillStyle = '#fff'; x.beginPath(); x.arc(ball.x, ball.y - ball.z * .5, 6 + ball.z * .03, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#111'; x.lineWidth = 1.5; x.stroke();
          drawHud();
        }
        api.loop(dt => { const s = Math.min(dt, 50) / 1000; tick(s); draw(); });
        c._wc = () => ({ score, t, half, over, ball, players, ctrl, pens, tick, k, shoot: () => shoot, setAuto: v => { auto = v; }, forcePens: () => { score[0] = score[1] = 1; over = true; pause = .01; } });
        return { abort() { aborted = true; c.remove(); } };
      }
      stage._wc = () => ({ S, T, GROUPS, myFixture, finishRound, recordMine, buildR32, table, newTournament, simScore });
    }
  });
})();
