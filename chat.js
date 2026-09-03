/* ---------- chat ----------
   Talk to other players. There is no server of our own: messages go through a
   public MQTT relay over a websocket. Rooms:
     · EVERYONE – the community room, always listed, anyone can join
     · public rooms – anyone can list one; they show up for everybody
     · private rooms – a code you share with an invite link
   Anyone who knows a room code can read it, so keep it to game chat.

   Relay topics (all under games-portal/):
     chat/<room>                 live messages
     recent/<room>               retained: the last 30 messages, so late joiners get history
     rooms/<code>                retained: a public room listing (empty payload = unlisted)
     presence/<room>/<client>    retained heartbeat; cleared by the relay when you drop     */

const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
const EVERYONE = 'EVERYONE', T = 'games-portal/';
const CH = (() => { try { return { name: '', room: EVERYONE, logs: {}, ...JSON.parse(localStorage.getItem('gpchat') || '{}') }; } catch { return { name: '', room: EVERYONE, logs: {} }; } })();
const chatSave = () => localStorage.setItem('gpchat', JSON.stringify(CH));
const roomCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
const cleanRoom = r => (r || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12);

/* an invite link looks like  …/?room=ABC123  – opening it saves the room */
{ const p = new URLSearchParams(location.search).get('room'); if (p) { CH.room = cleanRoom(p) || EVERYONE; chatSave(); history.replaceState(null, '', location.href.split('?')[0]); } }
if (!CH.room) { CH.room = EVERYONE; chatSave(); }

const myId = Math.random().toString(36).slice(2, 10);
const chatTopic = () => T + 'chat/' + CH.room, recentTopic = () => T + 'recent/' + CH.room, presenceTopic = () => T + 'presence/' + CH.room + '/' + myId;
let client = null, brokerIdx = 0, unread = 0, lastSend = 0, heartbeat = 0;
const seen = new Set();
const rooms = {};      /* code -> { code, title, t }  public listings */
const online = {};     /* room -> { clientId -> lastSeen } */
const ROOM_TTL = 7 * 864e5, PRESENCE_TTL = 75e3, HEARTBEAT = 25e3;

const chatEl = $('#chat'), logEl = $('#chat-log'), statusEl = $('#chat-status'), badgeEl = $('#chat-badge');
const fmtTime = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const isPublic = code => code === EVERYONE || !!rooms[code];
const roomTitle = code => code === EVERYONE ? 'Everyone' : rooms[code] ? rooms[code].title : code;
const countOnline = code => { const now = Date.now(), o = online[code] || {}; return Object.values(o).filter(t => now - t < PRESENCE_TTL).length; };

function setStatus(cls, text) { statusEl.className = 'chat-status ' + cls; statusEl.textContent = text; }
function refreshStatus() { if (client && client.connected) setStatus('on', `online · ${countOnline(CH.room)} here`); }

/* ----- connection ----- */
function chatConnect() {
  if (client) { const old = client; client = null; try { old.publish(T + 'presence/' + old._room + '/' + myId, '', { retain: true }); old.end(); } catch {} }
  clearInterval(heartbeat);
  if (typeof mqtt === 'undefined') { setStatus('off', 'chat blocked on this network'); return; }
  setStatus('', 'connecting…');
  const c = mqtt.connect(BROKERS[brokerIdx % BROKERS.length], {
    clientId: 'gp-' + myId + '-' + Date.now().toString(36), keepalive: 30, reconnectPeriod: 0, connectTimeout: 8000, clean: true,
    will: { topic: presenceTopic(), payload: '', retain: true, qos: 0 },
  });
  c._room = CH.room; client = c;
  c.on('connect', () => {
    c.subscribe([chatTopic(), recentTopic(), T + 'rooms/+', T + 'presence/+/+'], { qos: 0 });
    pulse(); heartbeat = setInterval(pulse, HEARTBEAT);
    setStatus('on', 'online'); publish({ sys: 'joined' });
  });
  c.on('message', onMessage);
  const lost = () => { if (client !== c) return; clearInterval(heartbeat); setStatus('off', 'offline – retrying'); brokerIdx++; setTimeout(() => { if (client === c) chatConnect(); }, brokerIdx < BROKERS.length ? 300 : 4000); };
  c.on('close', lost); c.on('offline', lost); c.on('error', () => {});
}
function pulse() { if (client && client.connected) client.publish(presenceTopic(), JSON.stringify({ t: Date.now() }), { retain: true, qos: 0 }); }
setInterval(() => { refreshStatus(); renderRooms(); }, 10000);

function onMessage(topic, buf) {
  const parts = topic.slice(T.length).split('/'), kind = parts[0], text = buf.toString();
  let data = null; if (text) { try { data = JSON.parse(text); } catch { return; } }
  if (kind === 'chat' && parts[1] === CH.room) addMsg(data, true);
  else if (kind === 'recent' && parts[1] === CH.room && Array.isArray(data)) { let added = 0; data.forEach(m => { if (addMsg(m, true, true)) added++; }); if (added) renderLog(); }
  else if (kind === 'rooms') { const code = cleanRoom(parts[1]); if (!code) return; if (data && data.title && Date.now() - data.t < ROOM_TTL) rooms[code] = { code, title: String(data.title).slice(0, 24), t: data.t }; else delete rooms[code]; renderRooms(); }
  else if (kind === 'presence') { const [, room, id] = parts; online[room] = online[room] || {}; if (data && data.t) online[room][id] = data.t; else delete online[room][id]; if (room === CH.room) refreshStatus(); renderRooms(); }
}

function publish(m, topic = chatTopic(), retain = false) {
  if (!client || !client.connected) return null;
  const msg = { id: myId + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), from: myId, name: CH.name.trim() || 'Guest', t: Date.now(), ...m };
  client.publish(topic, JSON.stringify(msg), { qos: 0, retain });
  return msg;
}

/* ----- messages ----- */
function addMsg(m, remote, quiet) {
  if (!m || !m.id || seen.has(m.id) || (!m.sys && typeof m.text !== 'string')) return false;
  seen.add(m.id);
  const mine = m.from === myId;
  if (m.sys) { if (!mine && !quiet) renderMsg({ ...m, name: String(m.name).slice(0, 16) }); return false; }
  const entry = { id: m.id, from: m.from, name: String(m.name || 'Guest').slice(0, 16), text: m.text.slice(0, 300), t: +m.t || Date.now() };
  CH.logs[CH.room] = (CH.logs[CH.room] || []).concat([entry]).sort((a, b) => a.t - b.t).slice(-150);
  chatSave();
  if (!quiet) renderMsg(entry);
  if (remote && !mine && !quiet) {
    if (chatEl.hidden) { unread++; badgeEl.textContent = unread > 9 ? '9+' : unread; badgeEl.hidden = false; }
    if (S.sound) beep(880, .06);
  }
  return true;
}
/* the sender leaves the last 30 messages on the relay so people who join later see them */
function shareRecent() { if (client && client.connected) client.publish(recentTopic(), JSON.stringify((CH.logs[CH.room] || []).slice(-30)), { qos: 0, retain: true }); }

function renderMsg(m) {
  const empty = logEl.querySelector('.empty'); if (empty) empty.remove();
  const stuck = logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 30;
  const d = document.createElement('div');
  if (m.sys) { d.className = 'msg sys'; d.textContent = `${m.name} ${m.sys}`; }
  else {
    d.className = 'msg' + (m.from === myId ? ' me' : '');
    const who = document.createElement('span'); who.className = 'who'; who.textContent = `${m.name} · ${fmtTime(m.t)}`;
    const txt = document.createElement('span'); txt.textContent = m.text;
    d.append(who, txt);
  }
  logEl.appendChild(d);
  if (stuck || m.from === myId) logEl.scrollTop = logEl.scrollHeight;
}
function renderLog() {
  logEl.innerHTML = '';
  const log = CH.logs[CH.room] || [];
  if (!log.length) { const d = document.createElement('div'); d.className = 'msg sys empty'; d.textContent = CH.room === EVERYONE ? 'Say hi to everyone playing right now.' : 'No messages yet. Send your friend the invite link.'; logEl.appendChild(d); }
  log.forEach(m => { seen.add(m.id); renderMsg(m); });
  logEl.scrollTop = logEl.scrollHeight;
}

/* ----- rooms ----- */
function renderRooms() {
  const wrap = $('#room-chips'); wrap.innerHTML = '';
  const list = [EVERYONE, ...Object.keys(rooms).filter(c => c !== EVERYONE).sort((a, b) => countOnline(b) - countOnline(a) || rooms[b].t - rooms[a].t)];
  if (!isPublic(CH.room)) list.push(CH.room);
  list.forEach(code => {
    const b = document.createElement('button'); b.className = 'room-chip' + (code === CH.room ? ' on' : '');
    const n = countOnline(code);
    b.innerHTML = `<span class="rc-icon">${code === EVERYONE ? '🌍' : isPublic(code) ? '💬' : '🔒'}</span><span class="rc-title"></span><span class="rc-count">${n}</span>`;
    b.querySelector('.rc-title').textContent = roomTitle(code); b.title = `${roomTitle(code)} · ${n} online`;
    b.onclick = () => joinRoom(code); wrap.appendChild(b);
  });
  const pub = $('#chat-public'); pub.hidden = CH.room === EVERYONE; pub.textContent = rooms[CH.room] ? 'Make private' : 'Make public';
  $('#chat-room').value = isPublic(CH.room) ? '' : CH.room;
}
function joinRoom(code) {
  code = cleanRoom(code) || EVERYONE; if (code === CH.room) return;
  CH.room = code; chatSave(); seen.clear(); renderLog(); renderRooms(); chatConnect();
  toast('Joined ' + roomTitle(code));
}
function togglePublic() {
  if (CH.room === EVERYONE || !client || !client.connected) return;
  if (rooms[CH.room]) { client.publish(T + 'rooms/' + CH.room, '', { retain: true }); delete rooms[CH.room]; renderRooms(); toast('Room is private again'); return; }
  const title = (prompt('Name for your public room (everyone will see it):', (CH.name.trim() || 'My') + "'s room") || '').trim().slice(0, 24);
  if (!title) return;
  const listing = { code: CH.room, title, by: CH.name.trim() || 'Guest', t: Date.now() };
  client.publish(T + 'rooms/' + CH.room, JSON.stringify(listing), { retain: true }); rooms[CH.room] = listing; renderRooms(); toast('Listed as "' + title + '" – anyone can join now');
}

function openChat(open) {
  chatEl.hidden = !open; $('#btn-chat').classList.toggle('active', open);
  if (open) { unread = 0; badgeEl.hidden = true; logEl.scrollTop = logEl.scrollHeight; (CH.name ? $('#chat-input') : $('#chat-name')).focus(); }
}

/* ----- wiring ----- */
$('#btn-chat').onclick = () => openChat(chatEl.hidden);
$('#chat-close').onclick = () => openChat(false);
$('#chat-name').value = CH.name;
$('#chat-name').oninput = e => { CH.name = e.target.value.slice(0, 16); chatSave(); };
$('#room-join').onsubmit = e => { e.preventDefault(); const r = cleanRoom($('#chat-room').value); if (r) joinRoom(r); };
$('#chat-new-room').onclick = () => joinRoom(roomCode());
$('#chat-public').onclick = togglePublic;
$('#chat-link').onclick = async () => {
  const link = location.href.split(/[?#]/)[0] + '?room=' + CH.room;
  try { await navigator.clipboard.writeText(link); toast('Invite link copied – send it to a friend'); }
  catch { prompt('Copy this link and send it to a friend:', link); }
};
$('#chat-form').onsubmit = e => {
  e.preventDefault();
  const inp = $('#chat-input'), text = inp.value.trim(); if (!text) return;
  if (!CH.name.trim()) { toast('Type your name first'); $('#chat-name').focus(); return; }
  if (Date.now() - lastSend < 700) return;
  const m = publish({ text });
  if (!m) { toast('Not connected yet – try again in a moment'); return; }
  lastSend = Date.now(); addMsg(m, false); shareRecent(); inp.value = '';
};
/* keys typed in the chat must not trigger the panic hotkey or the search shortcut */
chatEl.addEventListener('keydown', e => { if (e.key === 'Escape') { openChat(false); return; } e.stopPropagation(); });
window.addEventListener('pagehide', () => { if (client && client.connected) { client.publish(presenceTopic(), '', { retain: true }); client.end(); } });

renderLog(); renderRooms();
chatConnect();
