/* ---------- state ---------- */
const DEFAULTS = {
  panicUrl: 'https://teams.microsoft.com',
  panicKey: '`',
  panicMode: 'replace',
  panicDblEsc: true,
  cloakTitle: '',
  cloakIcon: '',
  theme: 'midnight',
  sound: true,
  favorites: [],
  recent: [],
  plays: {},
  best: {},
  custom: [],
};
const PANIC_PRESETS = [
  ['Microsoft Teams', 'https://teams.microsoft.com'],
  ['Google Classroom', 'https://classroom.google.com'],
  ['Google Docs', 'https://docs.google.com'],
  ['Outlook', 'https://outlook.office.com'],
  ['Khan Academy', 'https://www.khanacademy.org'],
  ['Wikipedia', 'https://en.wikipedia.org'],
  ['Google', 'https://www.google.com'],
];
const CLOAK_PRESETS = [
  ['None', '', ''],
  ['Microsoft Teams', 'Microsoft Teams', 'https://teams.microsoft.com/favicon.ico'],
  ['Google Classroom', 'Classes', 'https://ssl.gstatic.com/classroom/favicon.png'],
  ['Google Docs', 'Untitled document - Google Docs', 'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico'],
  ['Google Drive', 'My Drive - Google Drive', 'https://ssl.gstatic.com/images/branding/product/2x/drive_2020q4_32dp.png'],
  ['Wikipedia', 'Wikipedia', 'https://en.wikipedia.org/static/favicon/wikipedia.ico'],
  ['Khan Academy', 'Dashboard | Khan Academy', 'https://cdn.kastatic.org/images/favicon.ico'],
];
const DEFAULT_ICON = document.getElementById('favicon').href;
/* live site (github.io) vs the copy on your own computer: different tab icon and title so you can tell them apart */
const IS_LIVE = /\.github\.io$/i.test(location.hostname);
const emojiIcon = e => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${e}</text></svg>`);
const SITE_ICON = IS_LIVE ? DEFAULT_ICON : emojiIcon('🛠️');

let S = load();
function load() { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('gp') || '{}') }; } catch { return { ...DEFAULTS }; } }
function save() { localStorage.setItem('gp', JSON.stringify(S)); }

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ---------- sound ---------- */
let actx;
function beep(freq = 440, dur = .05) {
  if (!S.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.value = .05; g.gain.exponentialRampToValueAtTime(.0001, actx.currentTime + dur);
    o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + dur);
  } catch {}
}

function toast(msg, ms = 1800) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.id); toast.id = setTimeout(() => t.hidden = true, ms);
}

/* ---------- catalogue ---------- */
let cat = 'all', query = '', sort = 'name';

function allGames() {
  const custom = S.custom.map((c, i) => ({ id: 'custom:' + i, title: c.name, emoji: '🔗', cat: 'custom', colors: ['#334155', '#64748b'], url: c.url, newtab: !!c.newtab, help: c.newtab ? 'Opens ' + c.url + ' in a new tab.' : 'Opens ' + c.url + ' inside this page. If it stays blank, use ↗ to open it in a new tab.' }));
  return [...GAMES, ...WEB_GAMES, ...custom];
}
function findGame(id) { return allGames().find(g => g.id === id); }

function visible() {
  let list = allGames();
  if (cat === 'favorites') list = list.filter(g => S.favorites.includes(g.id));
  else if (cat === 'recent') list = S.recent.map(findGame).filter(Boolean);
  else if (cat !== 'all') list = list.filter(g => g.cat === cat);
  if (query) list = list.filter(g => g.title.toLowerCase().includes(query) || g.cat.includes(query));
  if (cat !== 'recent') {
    if (sort === 'name') list.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'plays') list.sort((a, b) => (S.plays[b.id] || 0) - (S.plays[a.id] || 0));
    else if (sort === 'new') list.reverse();
  }
  return list;
}

const TITLES = { all: 'All games', favorites: 'Favourites', recent: 'Recently played', arcade: 'Arcade', puzzle: 'Puzzle', action: 'Action', classic: 'Classic', racing: 'Racing', remix: 'Remixes', web: 'Web games', custom: 'My links' };

function render() {
  const grid = $('#grid'), list = visible();
  grid.innerHTML = '';
  $('#section-title').textContent = (query ? `Results for “${query}”` : TITLES[cat]);
  $('#empty').hidden = list.length > 0;
  $('#empty-text').textContent = cat === 'favorites' ? 'Star a game to keep it here.' : cat === 'recent' ? 'Play something and it will show up here.' : cat === 'custom' ? 'Add your own links in ⚙️ Settings.' : 'No games match that search.';
  list.forEach(g => {
    const fav = S.favorites.includes(g.id);
    const card = document.createElement('div'); card.className = 'card';
    card.style.setProperty('--c1', g.colors[0]); card.style.setProperty('--c2', g.colors[1]);
    card.innerHTML = `
      <div class="card-art">${g.emoji}</div>
      ${S.best[g.id] ? `<span class="badge">🏆 ${S.best[g.id]}</span>` : ''}
      <button class="card-fav ${fav ? 'on' : ''}" title="Favourite">${fav ? '★' : '☆'}</button>
      <div class="card-body">
        <div class="card-title">${esc(g.title)}</div>
        <div class="card-meta"><span>${g.remix ? 'remix inside' : g.newtab ? 'new tab ↗' : TITLES[g.cat] || g.cat}</span><span>${S.plays[g.id] ? S.plays[g.id] + ' plays' : 'new'}</span></div>
      </div>`;
    card.onclick = () => openGame(g.id);
    card.querySelector('.card-fav').onclick = e => { e.stopPropagation(); toggleFav(g.id); };
    grid.appendChild(card);
  });
  $('#stat-count').textContent = `${GAMES.length} built-in · ${WEB_GAMES.length} web · ${S.custom.length} links`;
}
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

function toggleFav(id) {
  const i = S.favorites.indexOf(id);
  if (i >= 0) S.favorites.splice(i, 1); else S.favorites.push(id);
  save(); render(); if (current && current.id === id) updateFavBtn();
}

/* ---------- player ---------- */
let current = null, api = null;
function openGame(id) {
  const g = findGame(id); if (!g) return;
  if (g.remix && findGame(g.remix)) { /* web game with a remix: play the remix inside the portal */
    S.plays[id] = (S.plays[id] || 0) + 1; S.recent = [id, ...S.recent.filter(r => r !== id)].slice(0, 12); save();
    openGame(g.remix); toast(`Playing our remix of ${g.title}`); return;
  }
  if (g.newtab) { /* the other site refuses to be embedded, so it gets its own tab */
    window.open(g.url, '_blank', 'noopener');
    S.plays[id] = (S.plays[id] || 0) + 1; S.recent = [id, ...S.recent.filter(r => r !== id)].slice(0, 12); save(); render();
    toast(`${g.title} opened in a new tab ↗`); return;
  }
  closeGame();
  current = g;
  const stage = $('#stage'); stage.innerHTML = '';
  $('#player-emoji').textContent = g.emoji; $('#player-name').textContent = g.title;
  $('#player-help').textContent = (g.help || '').replace(/\s(What's different:|Controls:)/g, '\n$1');
  $('#player-best').textContent = S.best[id] || 0;
  updateFavBtn();
  $('#player').hidden = false;
  S.plays[id] = (S.plays[id] || 0) + 1;
  S.recent = [id, ...S.recent.filter(r => r !== id)].slice(0, 12);
  save();
  $('#player-open').hidden = !(g.url || g.origUrl);
  if (g.url) {
    const f = document.createElement('iframe'); f.src = g.url; f.allow = 'fullscreen; autoplay; gamepad'; f.setAttribute('allowfullscreen', ''); stage.appendChild(f);
    return;
  }
  api = makeApi(stage, {
    beep,
    score(n) { if (n > (S.best[id] || 0)) { S.best[id] = n; $('#player-best').textContent = n; save(); } },
  });
  g.run(stage, api);
}
function closeGame() {
  if (api) { api.stop(); api = null; }
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  $('#stage').innerHTML = ''; $('#player').hidden = true; current = null; render();
}
function updateFavBtn() { const on = current && S.favorites.includes(current.id); const b = $('#player-fav'); b.textContent = on ? '★' : '☆'; b.classList.toggle('on', on); }

$('#player-close').onclick = closeGame;
$('#player-open').onclick = () => { const u = current && (current.url || current.origUrl); if (u) window.open(u, '_blank', 'noopener'); };
$('#player-restart').onclick = () => { if (api && api._restart) api._restart(); else if (current) openGame(current.id); };
$('#player-fav').onclick = () => current && toggleFav(current.id);
$('#player-full').onclick = () => { const f = $('.player-frame'); document.fullscreenElement ? document.exitFullscreen() : f.requestFullscreen().catch(() => toast('Fullscreen not allowed here')); };
$('#player').addEventListener('click', e => { if (e.target === $('#player')) closeGame(); });

/* ---------- panic ---------- */
function panic() {
  const url = S.panicUrl || DEFAULTS.panicUrl;
  if (S.panicMode === 'newtab') {
    closeGame(); window.open(url, '_blank'); applyCloak(); toast('Opened safe page');
  } else if (S.panicMode === 'same') location.href = url;
  else location.replace(url);
}
$('#btn-panic').onclick = panic;
$('#btn-panic-hero').onclick = panic;
$('#player-panic').onclick = panic;

let lastEsc = 0;
window.addEventListener('keydown', e => {
  const typingKey = e.target.id === 'set-panic-key';
  if (typingKey) return;
  if (e.key === S.panicKey && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); panic(); return; }
  if (e.key === 'Escape') {
    const now = Date.now();
    if (S.panicDblEsc && now - lastEsc < 400) { panic(); return; }
    lastEsc = now;
    if (!$('#settings').hidden) closeSettings();
    else if (!$('#player').hidden) closeGame();
    return;
  }
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.key === '/') { e.preventDefault(); $('#search').focus(); }
  if (!$('#player').hidden && current) {
    if (e.key === 'r' || e.key === 'R') $('#player-restart').click();
    if (e.key === 'f' || e.key === 'F') $('#player-full').click();
  }
});

/* ---------- cloak & theme ---------- */
function applyCloak() {
  document.title = S.cloakTitle || (IS_LIVE ? 'Games Portal' : 'Games Portal · DEV');
  $('#favicon').href = S.cloakIcon || SITE_ICON;
  $('#dev-tag').hidden = IS_LIVE; $('.brand-icon').textContent = IS_LIVE ? '🎮' : '🛠️';
}
function applyTheme() { document.documentElement.dataset.theme = S.theme; }
function applyPanicUi() {
  const label = keyLabel(S.panicKey);
  $('#panic-key-label').textContent = label; $('#hero-key').textContent = label;
  const preset = PANIC_PRESETS.find(p => p[1] === S.panicUrl);
  $('#hero-safe').textContent = preset ? preset[0] : (safeHost(S.panicUrl));
  $('#hero-safe-btn').textContent = preset ? preset[0] : safeHost(S.panicUrl);
}
const safeHost = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const keyLabel = k => ({ ' ': 'Space', '`': '`', Escape: 'Esc' })[k] || (k.length === 1 ? k.toUpperCase() : k);

/* ---------- settings ---------- */
function openSettings() { fillSettings(); $('#settings').hidden = false; }
function closeSettings() { $('#settings').hidden = true; }
$('#btn-settings').onclick = openSettings; $('#settings-close').onclick = closeSettings;
$('#settings').addEventListener('click', e => { if (e.target === $('#settings')) closeSettings(); });

function fillSettings() {
  const pp = $('#panic-presets'); pp.innerHTML = '';
  PANIC_PRESETS.forEach(([name, url]) => { const b = document.createElement('button'); b.className = 'preset' + (S.panicUrl === url ? ' on' : ''); b.textContent = name; b.onclick = () => { S.panicUrl = url; commit(); fillSettings(); }; pp.appendChild(b); });
  $('#set-panic-url').value = S.panicUrl;
  $('#set-panic-key').value = keyLabel(S.panicKey);
  $('#set-panic-mode').value = S.panicMode;
  $('#set-panic-dblesc').checked = S.panicDblEsc;
  const cp = $('#cloak-presets'); cp.innerHTML = '';
  CLOAK_PRESETS.forEach(([name, title, icon]) => { const b = document.createElement('button'); b.className = 'preset' + (S.cloakTitle === title && S.cloakIcon === icon ? ' on' : ''); b.textContent = name; b.onclick = () => { S.cloakTitle = title; S.cloakIcon = icon; commit(); fillSettings(); }; cp.appendChild(b); });
  $('#set-cloak-title').value = S.cloakTitle; $('#set-cloak-icon').value = S.cloakIcon;
  $('#set-theme').value = S.theme; $('#set-sound').checked = S.sound;
  const cl = $('#custom-list'); cl.innerHTML = '';
  S.custom.forEach((c, i) => {
    const d = document.createElement('div'); d.className = 'custom-item';
    d.innerHTML = `<span>🔗 ${esc(c.name)}</span><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(safeHost(c.url))}</a><button class="mini" title="Remove">🗑</button>`;
    d.querySelector('button').onclick = () => { S.custom.splice(i, 1); S.favorites = S.favorites.filter(f => !f.startsWith('custom:')); commit(); fillSettings(); };
    cl.appendChild(d);
  });
}
function commit() { save(); applyCloak(); applyTheme(); applyPanicUi(); render(); }

$('#set-panic-url').onchange = e => { let v = e.target.value.trim(); if (v && !/^https?:\/\//i.test(v)) v = 'https://' + v; S.panicUrl = v || DEFAULTS.panicUrl; commit(); fillSettings(); };
$('#set-panic-key').onfocus = e => { e.target.value = 'press a key…'; };
$('#set-panic-key').onblur = () => fillSettings();
$('#set-panic-key').onkeydown = e => { e.preventDefault(); if (['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) return; S.panicKey = e.key; commit(); e.target.blur(); toast('Panic key is now ' + keyLabel(e.key)); };
$('#set-panic-mode').onchange = e => { S.panicMode = e.target.value; commit(); };
$('#set-panic-dblesc').onchange = e => { S.panicDblEsc = e.target.checked; commit(); };
$('#set-cloak-title').oninput = e => { S.cloakTitle = e.target.value; commit(); };
$('#set-cloak-icon').onchange = e => { S.cloakIcon = e.target.value.trim(); commit(); fillSettings(); };
$('#set-theme').onchange = e => { S.theme = e.target.value; commit(); };
$('#set-sound').onchange = e => { S.sound = e.target.checked; commit(); };
$('#add-link').onclick = () => {
  const name = $('#add-name').value.trim(); let url = $('#add-url').value.trim();
  if (!name || !url) return toast('Need a name and a URL');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  S.custom.push({ name, url, newtab: $('#add-newtab').checked }); $('#add-name').value = ''; $('#add-url').value = ''; $('#add-newtab').checked = false; commit(); fillSettings(); toast('Added ' + name);
};
$('#export-data').onclick = () => {
  const a = document.createElement('a'); a.href = 'data:application/json,' + encodeURIComponent(JSON.stringify(S, null, 2)); a.download = 'games-portal-settings.json'; a.click();
};
$('#import-data').onclick = () => {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
  inp.onchange = () => { const f = inp.files[0]; if (!f) return; f.text().then(t => { try { S = { ...DEFAULTS, ...JSON.parse(t) }; commit(); fillSettings(); toast('Imported'); } catch { toast('That file is not valid'); } }); };
  inp.click();
};
$('#reset-data').onclick = () => { if (confirm('Reset all settings, favourites and high scores?')) { localStorage.removeItem('gp'); S = load(); commit(); fillSettings(); toast('Reset done'); } };

/* ---------- nav & search ---------- */
$$('.chip[data-cat]').forEach(b => b.onclick = () => { cat = b.dataset.cat; $$('.chip').forEach(x => x.classList.toggle('active', x === b)); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
$('[data-nav="home"]').onclick = e => { e.preventDefault(); $('.chip[data-cat="all"]').click(); $('#search').value = ''; query = ''; render(); };
$('#search').oninput = e => { query = e.target.value.trim().toLowerCase(); render(); };
$('#sort').onchange = e => { sort = e.target.value; render(); };

/* ---------- boot ---------- */
applyCloak(); applyTheme(); applyPanicUi(); render();
