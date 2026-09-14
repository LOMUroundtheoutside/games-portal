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
/* ---------- site config ----------
   site-config.js is the copy everybody gets; the admin panel can also leave a
   preview in this browser's localStorage, which wins here only. */
function mergeCfg(...srcs) {
  const d = {
    version: 1,
    site: { name: 'Games Portal', icon: '\u{1F3AE}', tagline: 'Play anything, anywhere.' },
    announcement: { text: '', level: 'info' },
    defaults: {}, features: { chat: true, web: true, customLinks: true },
    hidden: [], featured: [], overrides: {}, links: [],
    admin: { scheme: 'simple', hash: '' },
  };
  for (const c of srcs) {
    if (!c || typeof c !== 'object') continue;
    for (const k of ['hidden', 'featured']) if (Array.isArray(c[k])) d[k] = c[k].slice();
    if (Array.isArray(c.links)) d.links = c.links.slice();
    for (const k of ['site', 'announcement', 'defaults', 'features', 'admin']) if (c[k] && typeof c[k] === 'object') d[k] = { ...d[k], ...c[k] };
    if (c.overrides && typeof c.overrides === 'object') d.overrides = { ...d.overrides, ...c.overrides };
    if (c.version) d.version = c.version;
  }
  return d;
}
const CFG_FILE = window.SITE_CONFIG || null;
let CFG_LOCAL = null;
try { CFG_LOCAL = JSON.parse(localStorage.getItem('gp-site') || 'null'); } catch {}
const CFG = mergeCfg(CFG_FILE, CFG_LOCAL);
/* a brand-new visitor starts from the site's defaults */
for (const k of ['theme', 'panicUrl', 'panicKey', 'panicMode', 'sound']) if (CFG.defaults[k] !== undefined) DEFAULTS[k] = CFG.defaults[k];
const SITE_ICON = IS_LIVE ? emojiIcon(CFG.site.icon || '🎮') : emojiIcon('🛠️');

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

const linkGame = (id, c) => ({ id, title: c.name, emoji: c.emoji || '🔗', cat: 'custom',
  colors: c.colors || ['#334155', '#64748b'], url: c.url, newtab: !!c.newtab,
  help: c.newtab ? 'Opens ' + c.url + ' in a new tab.' : 'Opens ' + c.url + ' inside this page. If it stays blank, use ↗ to open it in a new tab.' });

/* a game as the admin panel has it: renamed, re-emojied or moved to another category */
function dressed(g) {
  const o = CFG.overrides[g.id];
  if (!o) return g;
  const out = { ...g };
  if (o.title) out.title = o.title;
  if (o.emoji) out.emoji = o.emoji;
  if (o.cat) out.cat = o.cat;
  return out;
}

/* every game there is, admin panel included. Hidden ones are still in here so a
   favourite or a remix link never breaks; visible() is what drops them. */
function allGames() {
  const siteLinks = CFG.links.map((c, i) => linkGame('site:' + i, c));
  const custom = CFG.features.customLinks ? S.custom.map((c, i) => linkGame('custom:' + i, c)) : [];
  const web = CFG.features.web ? WEB_GAMES : [];
  return [...GAMES, ...web, ...siteLinks, ...custom].map(dressed);
}
const isHidden = id => CFG.hidden.includes(id);
function findGame(id) { return allGames().find(g => g.id === id); }

function visible() {
  let list = allGames().filter(g => !isHidden(g.id));
  if (cat === 'favorites') list = list.filter(g => S.favorites.includes(g.id));
  else if (cat === 'recent') list = S.recent.map(findGame).filter(g => g && !isHidden(g.id));
  else if (cat !== 'all') list = list.filter(g => g.cat === cat);
  if (query) list = list.filter(g => g.title.toLowerCase().includes(query) || g.cat.includes(query));
  if (cat !== 'recent') {
    if (sort === 'name') list.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'plays') list.sort((a, b) => (S.plays[b.id] || 0) - (S.plays[a.id] || 0));
    else if (sort === 'new') list.reverse();
    /* games the admin panel pinned come first, in the order they were pinned */
    if (CFG.featured.length) {
      const rank = g => { const i = CFG.featured.indexOf(g.id); return i < 0 ? Infinity : i; };
      list.sort((a, b) => rank(a) - rank(b));
    }
  }
  return list;
}

const TITLES = { all: 'All games', favorites: 'Favourites', recent: 'Recently played', arcade: 'Arcade', puzzle: 'Puzzle', action: 'Action', classic: 'Classic', racing: 'Racing', '3d': '3D games', remix: 'Remixes', web: 'Web games', custom: 'My links' };

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
      ${CFG.featured.includes(g.id) ? '<span class="badge pin">📌</span>' : ''}
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
  const shown = allGames().filter(g => !isHidden(g.id)).length;
  $('#stat-count').textContent = `${shown} games` + (CFG.hidden.length ? ` · ${CFG.hidden.length} hidden` : '');
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
  const name = CFG.site.name || 'Games Portal';
  document.title = S.cloakTitle || (IS_LIVE ? name : name + ' · DEV');
  $('#favicon').href = S.cloakIcon || SITE_ICON;
  $('#dev-tag').hidden = IS_LIVE; $('.brand-icon').textContent = IS_LIVE ? (CFG.site.icon || '🎮') : '🛠️';
  $('.brand-name').textContent = name;
}

/* things the admin panel controls that are not games */
function applySiteChrome() {
  const h1 = document.querySelector('.hero h1'); if (h1 && CFG.site.tagline) h1.textContent = CFG.site.tagline;
  const bar = $('#announce');
  if (bar) {
    const text = (CFG.announcement.text || '').trim();
    bar.hidden = !text; bar.textContent = text;
    bar.className = 'announce ' + (CFG.announcement.level || 'info');
  }
  $('#btn-chat').hidden = !CFG.features.chat;
  const chip = c => document.querySelector(`.chip[data-cat="${c}"]`);
  if (chip('web')) chip('web').hidden = !CFG.features.web;
  if (chip('custom')) chip('custom').hidden = !CFG.features.customLinks;
  const myLinks = $('#my-links-section'); if (myLinks) myLinks.hidden = !CFG.features.customLinks;
  /* categories with nothing left in them after hiding */
  [...document.querySelectorAll('.chip[data-cat]')].forEach(b => {
    const c = b.dataset.cat;
    if (['all', 'favorites', 'recent', 'custom', 'web'].includes(c)) return;
    b.hidden = !allGames().some(g => g.cat === c && !isHidden(g.id));
  });
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
function commit() { save(); applyCloak(); applyTheme(); applyPanicUi(); applySiteChrome(); render(); }

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
/* the admin panel lives on its own page so the portal stays light */
const adminLink = document.getElementById('open-admin');
if (adminLink) adminLink.onclick = e => { e.preventDefault(); window.open('admin.html', '_blank', 'noopener'); };

/* ---------- nav & search ---------- */
$$('.chip[data-cat]').forEach(b => b.onclick = () => { cat = b.dataset.cat; $$('.chip').forEach(x => x.classList.toggle('active', x === b)); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
$('[data-nav="home"]').onclick = e => { e.preventDefault(); $('.chip[data-cat="all"]').click(); $('#search').value = ''; query = ''; render(); };
$('#search').oninput = e => { query = e.target.value.trim().toLowerCase(); render(); };
$('#sort').onchange = e => { sort = e.target.value; render(); };

/* ---------- boot ---------- */
applyCloak(); applyTheme(); applyPanicUi(); applySiteChrome(); render();
