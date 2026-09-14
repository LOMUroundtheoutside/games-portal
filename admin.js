/* ---------- admin panel ----------
   Edits site-config.js: the file every visitor of the live site loads. Nothing
   here talks to a server, because the portal does not have one. Two ways out:
     Apply here  -> keeps a copy in this browser only (localStorage 'gp-site')
     Download    -> site-config.js to commit and push, which is what everyone gets
*/

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const TITLES = { arcade: 'Arcade', puzzle: 'Puzzle', action: 'Action', classic: 'Classic', racing: 'Racing', '3d': '3D games', remix: 'Remixes', web: 'Web games', custom: 'My links' };

function toast(msg, ms = 2000) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.id); toast.id = setTimeout(() => t.hidden = true, ms);
}

/* Not a real password hash: the file it lives in is public on the live site.
   It only stops someone wandering in and clicking things. */
function simpleHash(s) {
  const str = 'gp:' + s;
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  let h2 = 0x1b873593;
  for (let i = str.length - 1; i >= 0; i--) { h2 ^= str.charCodeAt(i); h2 = Math.imul(h2, 0x85ebca6b) >>> 0; }
  return h.toString(36) + '-' + h2.toString(36);
}

const DEFAULT_CFG = () => ({
  version: 1,
  site: { name: 'Games Portal', icon: '🎮', tagline: 'Play anything, anywhere.' },
  announcement: { text: '', level: 'info' },
  defaults: { theme: 'midnight', panicUrl: 'https://teams.microsoft.com', panicKey: '`', sound: true },
  features: { chat: true, web: true, customLinks: true },
  hidden: [], featured: [], overrides: {}, links: [],
  admin: { scheme: 'simple', hash: '' },
});

function mergeCfg(...srcs) {
  const d = DEFAULT_CFG();
  for (const c of srcs) {
    if (!c || typeof c !== 'object') continue;
    for (const k of ['hidden', 'featured']) if (Array.isArray(c[k])) d[k] = c[k].slice();
    if (Array.isArray(c.links)) d.links = c.links.map(x => ({ ...x }));
    for (const k of ['site', 'announcement', 'defaults', 'features', 'admin']) if (c[k] && typeof c[k] === 'object') d[k] = { ...d[k], ...c[k] };
    if (c.overrides && typeof c.overrides === 'object') d.overrides = JSON.parse(JSON.stringify(c.overrides));
    if (c.version) d.version = c.version;
  }
  return d;
}

/* what is on disk, what this browser is previewing, and the copy being edited */
const FILE_CFG = mergeCfg(window.SITE_CONFIG);
let LOCAL_CFG = null;
try { LOCAL_CFG = JSON.parse(localStorage.getItem('gp-site') || 'null'); } catch {}
let W = mergeCfg(window.SITE_CONFIG, LOCAL_CFG);
let dirty = false;

/* the visitor's own play counts, for the Stats tab */
let PLAYER = { plays: {}, best: {}, favorites: [] };
try { PLAYER = { ...PLAYER, ...JSON.parse(localStorage.getItem('gp') || '{}') }; } catch {}

/* every game the portal knows about */
function catalogue() {
  const links = W.links.map((c, i) => ({ id: 'site:' + i, title: c.name, emoji: c.emoji || '🔗', cat: 'custom', colors: c.colors || ['#334155', '#64748b'], site: true }));
  return [...GAMES, ...WEB_GAMES, ...links];
}
const orig = id => catalogue().find(g => g.id === id);

function markDirty() {
  dirty = JSON.stringify(W) !== JSON.stringify(FILE_CFG);
  $('#unsaved').hidden = !dirty;
  renderPreview();
  renderCount();
}

/* ---------- lock ---------- */
{ const sub = document.querySelector('.lock-box .hint'); if (sub) sub.textContent = W.site.name || 'Games Portal'; }
function unlock() { $('#lock').hidden = true; $('#panel').hidden = false; boot(); }
if (!W.admin.hash) {
  unlock();
} else if (sessionStorage.getItem('gp-admin-ok') === W.admin.hash) {
  unlock();
} else {
  $('#lock-form').onsubmit = e => {
    e.preventDefault();
    const code = $('#lock-code').value;
    if (simpleHash(code) === W.admin.hash) { sessionStorage.setItem('gp-admin-ok', W.admin.hash); unlock(); }
    else { const m = $('#lock-msg'); m.textContent = 'Wrong passcode'; m.hidden = false; $('#lock-code').value = ''; $('#lock-code').focus(); }
  };
}

/* ---------- tabs ---------- */
$$('.chip[data-tab]').forEach(b => b.onclick = () => {
  $$('.chip[data-tab]').forEach(x => x.classList.toggle('active', x === b));
  $$('.tab').forEach(t => t.hidden = t.dataset.tab !== b.dataset.tab);
  if (b.dataset.tab === 'stats') renderStats();
  if (b.dataset.tab === 'hacks') renderHacks();
  if (b.dataset.tab === 'publish') renderPreview();
});

/* ---------- games tab ---------- */
let gQuery = '', gCat = '', gState = '';

function rowsForTable() {
  let list = catalogue();
  if (gCat) list = list.filter(g => (W.overrides[g.id]?.cat || g.cat) === gCat);
  if (gQuery) list = list.filter(g => (W.overrides[g.id]?.title || g.title).toLowerCase().includes(gQuery) || g.id.toLowerCase().includes(gQuery));
  if (gState === 'visible') list = list.filter(g => !W.hidden.includes(g.id));
  if (gState === 'hidden') list = list.filter(g => W.hidden.includes(g.id));
  if (gState === 'pinned') list = list.filter(g => W.featured.includes(g.id));
  if (gState === 'renamed') list = list.filter(g => W.overrides[g.id]);
  return list;
}

function renderGames() {
  const body = $('#g-body'), list = rowsForTable();
  body.innerHTML = '';
  $('#g-empty').hidden = list.length > 0;
  list.forEach(g => {
    const o = W.overrides[g.id] || {};
    const off = W.hidden.includes(g.id), pinned = W.featured.includes(g.id);
    const tr = document.createElement('tr');
    if (off) tr.className = 'off';
    tr.innerHTML = `
      <td class="c-on"><button class="sw ${off ? '' : 'on'}" title="${off ? 'Hidden' : 'Visible'}"></button></td>
      <td class="c-art"><div class="g-art" style="background:linear-gradient(135deg,${esc(g.colors[0])},${esc(g.colors[1])})">${g.emoji}</div></td>
      <td><input class="cell-in name ${o.title ? 'changed' : ''}" value="${esc(o.title || g.title)}" placeholder="${esc(g.title)}"><span class="g-id">${esc(g.id)}</span></td>
      <td class="c-emoji"><input class="cell-in emoji ${o.emoji ? 'changed' : ''}" maxlength="4" value="${esc(o.emoji || g.emoji)}"></td>
      <td class="c-cat"><select class="cell-sel cat"></select></td>
      <td class="c-num">${PLAYER.plays[g.id] || 0}</td>
      <td class="c-num">${PLAYER.best[g.id] || '–'}</td>
      <td class="c-pin"><button class="pinbtn ${pinned ? 'on' : ''}" title="${pinned ? 'Pinned to the front' : 'Pin to the front'}">📌</button></td>`;

    const sel = tr.querySelector('.cat');
    Object.keys(TITLES).forEach(c => { const op = document.createElement('option'); op.value = c; op.textContent = TITLES[c]; sel.appendChild(op); });
    sel.value = o.cat || g.cat;
    if (o.cat) sel.classList.add('changed');

    tr.querySelector('.sw').onclick = () => { toggleHidden(g.id); renderGames(); };
    tr.querySelector('.pinbtn').onclick = () => { togglePin(g.id); renderGames(); };
    tr.querySelector('.name').onchange = e => setOverride(g, 'title', e.target.value.trim());
    tr.querySelector('.emoji').onchange = e => setOverride(g, 'emoji', e.target.value.trim());
    sel.onchange = e => { setOverride(g, 'cat', e.target.value); renderGames(); };
    body.appendChild(tr);
  });
  renderCount();
}

function setOverride(g, key, value) {
  const o = { ...(W.overrides[g.id] || {}) };
  if (!value || value === g[key]) delete o[key]; else o[key] = value;
  if (Object.keys(o).length) W.overrides[g.id] = o; else delete W.overrides[g.id];
  markDirty();
}
function toggleHidden(id) {
  const i = W.hidden.indexOf(id);
  if (i >= 0) W.hidden.splice(i, 1); else { W.hidden.push(id); const f = W.featured.indexOf(id); if (f >= 0) W.featured.splice(f, 1); }
  markDirty();
}
function togglePin(id) {
  const i = W.featured.indexOf(id);
  if (i >= 0) W.featured.splice(i, 1);
  else { W.featured.push(id); const h = W.hidden.indexOf(id); if (h >= 0) W.hidden.splice(h, 1); }
  markDirty();
}

function renderCount() {
  const all = catalogue();
  $('#admin-count').textContent = `${all.length - W.hidden.length} of ${all.length} showing · ${W.featured.length} pinned · ${Object.keys(W.overrides).length} changed`;
}

$('#g-search').oninput = e => { gQuery = e.target.value.trim().toLowerCase(); renderGames(); };
$('#g-cat').onchange = e => { gCat = e.target.value; renderGames(); };
$('#g-state').onchange = e => { gState = e.target.value; renderGames(); };
$('#g-show-all').onclick = () => { W.hidden = []; markDirty(); renderGames(); toast('Everything is visible again'); };
$('#g-hide-shown').onclick = () => {
  const ids = rowsForTable().map(g => g.id);
  if (!ids.length) return toast('Nothing listed to hide');
  if (!confirm(`Hide these ${ids.length} games from the portal?`)) return;
  ids.forEach(id => { if (!W.hidden.includes(id)) W.hidden.push(id); });
  W.featured = W.featured.filter(id => !W.hidden.includes(id));
  markDirty(); renderGames(); toast(`Hid ${ids.length} games`);
};
$('#g-clear').onclick = () => {
  if (!confirm('Undo every hide, pin and rename?')) return;
  W.hidden = []; W.featured = []; W.overrides = {};
  markDirty(); renderGames(); toast('Back to the original list');
};

/* ---------- site tab ---------- */
function fillSite() {
  $('#s-name').value = W.site.name || '';
  $('#s-icon').value = W.site.icon || '';
  $('#s-tagline').value = W.site.tagline || '';
  $('#s-announce').value = W.announcement.text || '';
  $('#s-announce-level').value = W.announcement.level || 'info';
  $('#s-theme').value = W.defaults.theme || 'midnight';
  $('#s-panic-url').value = W.defaults.panicUrl || '';
  $('#s-panic-key').value = keyLabel(W.defaults.panicKey || '`');
  $('#s-sound').checked = W.defaults.sound !== false;
  $('#f-chat').checked = W.features.chat !== false;
  $('#f-web').checked = W.features.web !== false;
  $('#f-custom').checked = W.features.customLinks !== false;
}
const keyLabel = k => ({ ' ': 'Space', '`': '`', Escape: 'Esc' })[k] || (k.length === 1 ? k.toUpperCase() : k);

$('#s-name').oninput = e => { W.site.name = e.target.value; markDirty(); };
$('#s-icon').oninput = e => { W.site.icon = e.target.value; markDirty(); };
$('#s-tagline').oninput = e => { W.site.tagline = e.target.value; markDirty(); };
$('#s-announce').oninput = e => { W.announcement.text = e.target.value; markDirty(); };
$('#s-announce-level').onchange = e => { W.announcement.level = e.target.value; markDirty(); };
$('#s-theme').onchange = e => { W.defaults.theme = e.target.value; markDirty(); };
$('#s-sound').onchange = e => { W.defaults.sound = e.target.checked; markDirty(); };
$('#s-panic-url').onchange = e => { let v = e.target.value.trim(); if (v && !/^https?:\/\//i.test(v)) v = 'https://' + v; W.defaults.panicUrl = v; e.target.value = v; markDirty(); };
$('#s-panic-key').onfocus = e => { e.target.value = 'press a key…'; };
$('#s-panic-key').onblur = () => { $('#s-panic-key').value = keyLabel(W.defaults.panicKey || '`'); };
$('#s-panic-key').onkeydown = e => {
  e.preventDefault();
  if (['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) return;
  W.defaults.panicKey = e.key; markDirty(); e.target.blur(); toast('Panic key for new visitors: ' + keyLabel(e.key));
};
$('#f-chat').onchange = e => { W.features.chat = e.target.checked; markDirty(); };
$('#f-web').onchange = e => { W.features.web = e.target.checked; markDirty(); renderGames(); };
$('#f-custom').onchange = e => { W.features.customLinks = e.target.checked; markDirty(); };
$('#s-pass-set').onclick = () => {
  const v = $('#s-pass').value;
  W.admin = { scheme: 'simple', hash: v ? simpleHash(v) : '' };
  $('#s-pass').value = '';
  if (W.admin.hash) sessionStorage.setItem('gp-admin-ok', W.admin.hash);
  markDirty();
  toast(v ? 'Passcode set. It only counts once site-config.js is saved.' : 'Passcode removed');
};

/* ---------- links tab ---------- */
function fillLinks() {
  const box = $('#l-list'); box.innerHTML = '';
  if (!W.links.length) { box.innerHTML = '<p class="hint">No site-wide links yet.</p>'; return; }
  W.links.forEach((c, i) => {
    const d = document.createElement('div'); d.className = 'custom-item';
    d.innerHTML = `<span>${esc(c.emoji || '🔗')} ${esc(c.name)}${c.newtab ? ' ↗' : ''}</span><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(hostOf(c.url))}</a><button class="mini" title="Remove">🗑</button>`;
    d.querySelector('button').onclick = () => {
      W.links.splice(i, 1);
      W.hidden = W.hidden.filter(id => !id.startsWith('site:'));
      W.featured = W.featured.filter(id => !id.startsWith('site:'));
      markDirty(); fillLinks(); renderGames();
    };
    box.appendChild(d);
  });
}
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
$('#l-add').onclick = () => {
  const name = $('#l-name').value.trim(); let url = $('#l-url').value.trim();
  if (!name || !url) return toast('Needs a name and a link');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  W.links.push({ name, url, emoji: $('#l-emoji').value.trim() || '🔗', newtab: $('#l-newtab').checked });
  $('#l-name').value = ''; $('#l-url').value = ''; $('#l-emoji').value = ''; $('#l-newtab').checked = false;
  markDirty(); fillLinks(); renderGames(); toast('Added ' + name);
};

/* ---------- stats tab ---------- */
function renderStats() {
  const all = catalogue();
  const plays = Object.entries(PLAYER.plays || {});
  const total = plays.reduce((n, [, v]) => n + v, 0);
  const played = plays.filter(([, v]) => v > 0).length;
  const tiles = [
    [all.length, 'games in the portal'],
    [all.length - W.hidden.length, 'showing right now'],
    [total, 'plays on this computer'],
    [played, 'different games tried'],
    [(PLAYER.favorites || []).length, 'favourites starred'],
  ];
  $('#stat-tiles').innerHTML = tiles.map(([n, l]) => `<div class="tile"><b>${n}</b><span>${l}</span></div>`).join('');

  const name = id => { const g = orig(id); return g ? (W.overrides[id]?.title || g.title) : id; };
  const top = plays.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 10);
  $('#stat-top').innerHTML = top.length
    ? bars(top.map(([id, v]) => [name(id), v]))
    : '<p class="hint">Nothing played on this computer yet.</p>';

  const byCat = {};
  all.forEach(g => { const c = W.overrides[g.id]?.cat || g.cat; byCat[c] = (byCat[c] || 0) + 1; });
  $('#stat-cats').innerHTML = bars(Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, n]) => [TITLES[c] || c, n]));
}
function bars(rows) {
  const max = Math.max(...rows.map(r => r[1]), 1);
  return rows.map(([label, n]) =>
    `<div class="bar-row"><div class="bar"><i style="width:${Math.round(n / max * 100)}%"></i><span>${esc(label)}</span></div><div class="bar-n">${n}</div></div>`).join('');
}

/* ---------- publish ---------- */
function configText() {
  const j = (v, ind = 0) => JSON.stringify(v, null, 2).split('\n').join('\n' + ' '.repeat(ind));
  return `/* ---------- site config ----------
   Written by the admin panel (admin.html). This file is what every visitor of the
   live site loads, so a change only reaches other people once this file is saved
   here and pushed to GitHub. The admin panel can also keep a copy in your own
   browser (Apply here) which wins over this file on your machine only. */
window.SITE_CONFIG = {
  version: ${W.version || 1},

  /* Name, tab icon and the big line on the home page */
  site: ${j(W.site, 2)},

  /* A banner across the top of the portal. Empty text = no banner.
     level: 'info' (purple), 'good' (green) or 'warn' (red) */
  announcement: ${j(W.announcement, 2)},

  /* What a brand-new visitor starts with. They can still change it in Settings. */
  defaults: ${j(W.defaults, 2)},

  /* Whole sections of the portal, on or off */
  features: ${j(W.features, 2)},

  /* Game ids that are hidden from the grid, search, favourites and recent */
  hidden: ${j(W.hidden, 2)},

  /* Game ids pinned to the front of every list */
  featured: ${j(W.featured, 2)},

  /* id -> { title, emoji, cat } - rename, re-emoji or re-file any game */
  overrides: ${j(W.overrides, 2)},

  /* Links you add for everybody (Settings -> My links is per-browser instead) */
  links: ${j(W.links, 2)},

  /* Passcode for admin.html. This is a speed bump, not security: anyone can read
     this file on the live site. Change it in the panel. */
  admin: ${j(W.admin, 2)},
};
`;
}
/* ---------- hacks (this browser only, localStorage 'gp-hacks'; app.js reads it live) ---------- */
const HACKS_DEFAULT = { on: false, speed: 1, scoreX: 1, keys: true, crumbX: 0 };
const HACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3], HACK_SCORES = [1, 2, 5, 10, 100];
const NIGHT_GAMES = ['remix:arcade-nightshift', 'remix:toyshop-lockin', 'remix:lighthouse-watch', 'remix:nursery-night'];
function loadHacks() { try { return { ...HACKS_DEFAULT, ...JSON.parse(localStorage.getItem('gp-hacks') || '{}') }; } catch { return { ...HACKS_DEFAULT }; } }
let H = loadHacks();
function saveHacks() { try { localStorage.setItem('gp-hacks', JSON.stringify(H)); } catch {} renderHacks(); }
/* the portal's own settings (best scores live in there) */
const portalState = () => { try { return JSON.parse(localStorage.getItem('gp') || '{}'); } catch { return {}; } };
const savePortalState = s => { try { localStorage.setItem('gp', JSON.stringify(s)); } catch {} };
function renderHacks() {
  $('#h-on').checked = !!H.on; $('#h-keys').checked = !!H.keys; $('#h-crumb').checked = H.crumbX > 0;
  const pills = (box, vals, cur, fmt, set) => {
    box.innerHTML = vals.map(v => `<button class="btn ghost pill ${v === cur ? 'on' : ''}" data-v="${v}">${fmt(v)}</button>`).join('');
    [...box.querySelectorAll('.pill')].forEach(b => b.onclick = () => set(+b.dataset.v));
  };
  pills($('#h-speed'), HACK_SPEEDS, H.speed, v => v + '×', v => { H.speed = v; saveHacks(); });
  pills($('#h-score'), HACK_SCORES, H.scoreX, v => '×' + v, v => { H.scoreX = v; saveHacks(); });
  const sel = $('#h-game'), keep = sel.value;
  const best = portalState().best || {};
  sel.innerHTML = catalogue().filter(g => !g.url).sort((a, b) => a.title.localeCompare(b.title)).map(g => `<option value="${esc(g.id)}">${esc(g.emoji + ' ' + g.title)} — best ${best[g.id] || 0}</option>`).join('');
  if (keep) sel.value = keep;
}
$('#h-on').onchange = e => { H.on = e.target.checked; saveHacks(); toast(H.on ? 'Hacks on' : 'Hacks off'); };
$('#h-keys').onchange = e => { H.keys = e.target.checked; saveHacks(); };
$('#h-crumb').onchange = e => { H.crumbX = e.target.checked ? 1000000 : 0; saveHacks(); toast(H.crumbX ? 'Golden Crumb: ×1,000,000 (needs Hacks on)' : 'Golden Crumb back to ×7'); };
$('#h-best-set').onclick = () => {
  const id = $('#h-game').value, n = Math.max(0, Math.floor(+$('#h-best').value || 0));
  const s = portalState(); s.best = s.best || {}; s.best[id] = n; savePortalState(s); renderHacks(); toast('Best for ' + (orig(id) || {}).title + ' is now ' + n);
};
$('#h-best-max').onclick = () => { const s = portalState(); s.best = {}; catalogue().filter(g => !g.url).forEach(g => s.best[g.id] = 999999); savePortalState(s); renderHacks(); toast('Every best score is 999,999'); };
$('#h-best-wipe').onclick = () => { if (!confirm('Wipe every best score in this browser?')) return; const s = portalState(); s.best = {}; savePortalState(s); renderHacks(); toast('Best scores wiped'); };
$('#h-nights').onclick = () => { NIGHT_GAMES.forEach(id => localStorage.setItem('gp-remix-' + id, '5')); toast('All 5 nights unlocked in the four Night Shift games'); };
$('#h-nights-reset').onclick = () => { NIGHT_GAMES.forEach(id => localStorage.removeItem('gp-remix-' + id)); toast('Night Shift games back to night 1'); };

function renderPreview() { const p = $('#p-preview'); if (p) p.textContent = configText(); }

function download() {
  const blob = new Blob([configText()], { type: 'text/javascript' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'site-config.js';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Saved site-config.js — put it in the games portal folder and push it');
}
function applyHere() {
  localStorage.setItem('gp-site', JSON.stringify(W));
  toast('Applied in this browser. Open the portal to see it.');
}
$('#btn-download').onclick = download;
$('#p-download').onclick = download;
$('#btn-apply').onclick = applyHere;
$('#p-copy').onclick = async () => {
  try { await navigator.clipboard.writeText(configText()); toast('Copied the whole file'); }
  catch { toast('Could not copy — select the text below instead'); }
};
$('#p-clear-local').onclick = () => {
  localStorage.removeItem('gp-site');
  toast('Local preview dropped. The portal is back on site-config.js.');
};

/* ---------- boot ---------- */
function boot() {
  const cats = $('#g-cat');
  Object.keys(TITLES).forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = TITLES[c]; cats.appendChild(o); });
  fillSite(); fillLinks(); renderGames(); renderHacks(); renderPreview(); markDirty();
  if (LOCAL_CFG) toast('This browser is previewing changes that are not in site-config.js yet', 3200);
}
