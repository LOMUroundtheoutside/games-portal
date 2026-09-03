/* ---------- chat ----------
   Talk to friends who have the same room code. There is no server of our own:
   messages go through a public MQTT relay over a websocket, so anyone who knows
   the room code can read them. Keep it to game chat.                          */

const BROKERS = ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt'];
const CH = (() => { try { return { name: '', room: '', logs: {}, ...JSON.parse(localStorage.getItem('gpchat') || '{}') }; } catch { return { name: '', room: '', logs: {} }; } })();
const chatSave = () => localStorage.setItem('gpchat', JSON.stringify(CH));
const roomCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
const cleanRoom = r => (r || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12);

/* an invite link looks like  …/index.html?room=ABC123  – joining it saves the room */
{ const p = new URLSearchParams(location.search).get('room'); if (p) { CH.room = cleanRoom(p); chatSave(); history.replaceState(null, '', location.href.split('?')[0]); } }
if (!CH.room) { CH.room = roomCode(); chatSave(); }

const myId = Math.random().toString(36).slice(2, 10);
const topic = () => 'games-portal/chat/' + CH.room;
let client = null, brokerIdx = 0, unread = 0;
const seen = new Set();

const chatEl = $('#chat'), logEl = $('#chat-log'), statusEl = $('#chat-status'), badgeEl = $('#chat-badge');
const fmtTime = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function setStatus(cls, text) { statusEl.className = 'chat-status ' + cls; statusEl.textContent = text; }

function chatConnect() {
  if (client) { const old = client; client = null; try { old.end(true); } catch {} }
  if (typeof mqtt === 'undefined') { setStatus('off', 'chat blocked on this network'); return; }
  setStatus('', 'connecting…');
  const c = mqtt.connect(BROKERS[brokerIdx % BROKERS.length], { clientId: 'gp-' + myId + '-' + Date.now().toString(36), keepalive: 30, reconnectPeriod: 0, connectTimeout: 8000, clean: true });
  client = c;
  c.on('connect', () => { c.subscribe(topic(), { qos: 0 }); setStatus('on', 'online · room ' + CH.room); publish({ sys: 'joined' }); });
  c.on('message', (t, buf) => { if (t !== topic()) return; try { addMsg(JSON.parse(buf.toString()), true); } catch {} });
  const lost = () => { if (client !== c) return; setStatus('off', 'offline – retrying'); brokerIdx++; setTimeout(() => { if (client === c) chatConnect(); }, 4000); };
  c.on('close', lost); c.on('offline', lost); c.on('error', () => {});
}

function publish(m) {
  if (!client || !client.connected) return null;
  const msg = { id: myId + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), from: myId, name: CH.name.trim() || 'Guest', t: Date.now(), ...m };
  client.publish(topic(), JSON.stringify(msg), { qos: 0 });
  return msg;
}

function addMsg(m, remote) {
  if (!m || !m.id || seen.has(m.id)) return;
  seen.add(m.id);
  const mine = m.from === myId;
  if (m.sys) { if (mine) return; renderMsg(m); return; }
  const log = CH.logs[CH.room] = (CH.logs[CH.room] || []).concat([{ id: m.id, from: m.from, name: m.name, text: String(m.text).slice(0, 300), t: m.t }]).slice(-150);
  chatSave(); renderMsg(log[log.length - 1]);
  if (remote && !mine) {
    if (chatEl.hidden) { unread++; badgeEl.textContent = unread > 9 ? '9+' : unread; badgeEl.hidden = false; }
    if (S.sound) beep(880, .06);
  }
}

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
  if (!log.length) { const d = document.createElement('div'); d.className = 'msg sys empty'; d.textContent = 'No messages yet. Send your friend the invite link.'; logEl.appendChild(d); }
  log.forEach(m => { seen.add(m.id); renderMsg(m); });
  logEl.scrollTop = logEl.scrollHeight;
}

function openChat(open) {
  chatEl.hidden = !open; $('#btn-chat').classList.toggle('active', open);
  if (open) { unread = 0; badgeEl.hidden = true; logEl.scrollTop = logEl.scrollHeight; (CH.name ? $('#chat-input') : $('#chat-name')).focus(); }
}

$('#btn-chat').onclick = () => openChat(chatEl.hidden);
$('#chat-close').onclick = () => openChat(false);
$('#chat-room').value = CH.room; $('#chat-name').value = CH.name;
$('#chat-name').oninput = e => { CH.name = e.target.value.slice(0, 16); chatSave(); };
$('#chat-room').onchange = e => { const r = cleanRoom(e.target.value) || roomCode(); e.target.value = r; if (r === CH.room) return; CH.room = r; chatSave(); seen.clear(); renderLog(); chatConnect(); toast('Switched to room ' + r); };
$('#chat-new-room').onclick = () => { $('#chat-room').value = roomCode(); $('#chat-room').onchange({ target: $('#chat-room') }); };
$('#chat-link').onclick = async () => {
  const link = location.href.split(/[?#]/)[0] + '?room=' + CH.room;
  try { await navigator.clipboard.writeText(link); toast('Invite link copied – send it to your friend'); }
  catch { prompt('Copy this link and send it to your friend:', link); }
};
$('#chat-form').onsubmit = e => {
  e.preventDefault();
  const inp = $('#chat-input'), text = inp.value.trim(); if (!text) return;
  if (!CH.name.trim()) { toast('Type your name first'); $('#chat-name').focus(); return; }
  const m = publish({ text });
  if (!m) { toast('Not connected yet – try again in a moment'); return; }
  addMsg(m, false); inp.value = '';
};
/* keys typed in the chat must not trigger the panic hotkey or the search shortcut */
chatEl.addEventListener('keydown', e => { if (e.key === 'Escape') { openChat(false); return; } e.stopPropagation(); });

renderLog();
chatConnect();
