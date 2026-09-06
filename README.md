# Games Portal

A self-contained games site: 66 games built in plain JavaScript (13 arcade,
puzzle, action and classic games, 20 car racing games, 26 remixes of popular
web games and 7 real 3D games), a panic button, a tab disguise, favourites,
high scores and your own game links. No build step, no other sites needed;
the only library is a local copy of three.js for the 3D games.

## Run it

Just open `index.html` in a browser. Everything (settings, favourites, best
scores, custom links) is saved in that browser's localStorage.

To put it online for free: push this folder to a GitHub repo, then in the repo
settings enable **Pages** from the main branch. It will be live at
`https://<your-user>.github.io/<repo>/`.

## Panic button

* Click **PANIC** in the top bar, or press the hotkey (default is the backtick
  `` ` `` key, top-left of the keyboard). Pressing **Escape twice** quickly also
  works.
* Default destination is Microsoft Teams. Change it in ⚙️ Settings: pick a
  preset (Teams, Google Classroom, Docs, Outlook, Khan Academy, Wikipedia,
  Google) or type any URL.
* "Replace this tab" mode swaps the page out so the Back button will not return
  to the games. "Open new tab" keeps the portal but closes the game and switches
  the tab title/icon to the disguise.

## Web games

The 🌐 Web games category lists 32 games from watchdocumentaries.com (Slope,
Moto X3M, Geometry Dash, Cookie Clicker, Minecraft, FNAF…). That site sends an
`X-Frame-Options: SAMEORIGIN` header on every page **and** on the game folders,
so browsers refuse to show them inside our game window. The 26 that have a
remix open that remix inside the portal (the ↗ button in the player bar still
reaches the original); the six without one open in their own tab. The portal
tracks plays, favourites and recent for all of them.
The list lives in `weblinks.js` – nothing is copied from their site.

## Remixes

The 🎨 Remixes category holds 26 games of our own that are *inspired by* the
web games above (Cookie Clicker, Slope, Geometry Dash, OvO, Moto X3M, Rocket
League, FNAF…) so they can run inside the portal. Each has its own name, its
own code and drawn graphics, and two or three deliberate twists; the text under
the game says what it is inspired by, what is different, and the controls.
Game ideas can't be owned, only code, art and names can – nothing is copied.
They live in `remix-a.js` … `remix-e.js` (each file is one batch wrapped in an
IIFE). Among Us, Fortzone, Crazy Cattle 3D and Granny were left out: online
multiplayer or a full 3D world doesn't fit a 2D canvas. Minecraft's stand-in is
Block Builder in the 3D category.

## 3D games

The 🧊 3D category holds seven games that are true 3D: WebGL scenes rendered
with three.js (`lib/three.min.js`, release 134, MIT licence), with a perspective
camera, lights and meshes rather than a flat canvas faking depth. They live in
`three-d.js`, share a small `T3` helper (renderer sized to the player window,
resize/fullscreen handling, key state, HUD) and are otherwise ordinary portal
games. Slope Ball, Stack Tower, Asteroid Blaster, Maze Escape, Kart Circuit
(three laps against two rival karts), Block Builder (a Minecraft-style sandbox
whose island is saved in the browser) and Tunnel Rush. They need a browser with
WebGL, which is every current desktop and phone browser.

`node tools/smoke.js three-d.js` runs them headlessly: it loads the real
three.js but swaps in a fake WebGL renderer, so the game logic, scene graph and
raycasting are exercised without a GPU.

Every game window also has a PANIC button in its bar, and the panic hotkey
works while a game is open.

`node tools/smoke.js remix-a.js` runs a headless smoke test over one file: every
game is started in a stubbed DOM, mashed with keys and taps, restarted mid-run
and stopped, and any thrown error is reported.

For links you add yourself (Settings → My links) there is an "Open in a new
tab" tick box, and the ↗ button in the player bar opens any embedded link in a
new tab if the frame stays blank.

## Chat

Click 💬 in the top bar. Rooms:

* **🌍 Everyone** – the community room. New visitors land here; anyone can join.
* **Public rooms** – open your own room, press **Make public** and give it a
  name. It is listed for everybody for 7 days (or until you make it private).
* **Private rooms** – **New private** makes a room with a code. **Invite link**
  copies a link that opens the site straight into your room. Friends can also
  type the code in the "Private room code" box.

Each room shows how many people are in it right now. The last 30 messages of a
room are kept on the relay so late joiners see what was said; your browser
keeps the last 150 per room.

There is no server of our own: messages travel through a public MQTT relay over
a websocket (HiveMQ, falling back to EMQX). Anyone who knows a room code can read
that room, so keep it to game chat and never post personal details.

## Live vs dev

The live site is `https://lomuroundtheoutside.github.io/games-portal/`. When the
page is opened from anywhere else (your own computer, a local server) it shows
a **DEV** tag next to the name and a 🛠️ tab icon, so you can tell the two tabs
apart. Tab disguise still wins over both when it is switched on.

## Tab disguise

Settings → Tab disguise changes the browser tab's title and icon to look like
Teams, Classroom, Docs, Drive, Wikipedia or Khan Academy. Custom title/icon URL
also allowed.

## Files

| File | What it is |
|------|------------|
| `index.html` | Page layout: top bar, sidebar, game grid, player window, settings dialog |
| `style.css` | All styling; five colour themes live at the top in `:root` / `[data-theme]` |
| `games.js` | The mini engine (`makeApi`) plus the 13 original games as objects in the `GAMES` array |
| `racing.js` | The 20 racing games. Shared helpers live in `RC` (held-key tracker, car sprite, spline track) and three engines: `RC.road3d` (pseudo-3D road), `RC.circuit` (top-down track with AI rivals) and `RC.hills` (side-view terrain physics) |
| `remix-a.js` … `remix-e.js` | The 26 remixes: A idle/platform/rhythm, B pseudo-3D runners, C driving, D sports (1P or 2P), E night-shift survival |
| `tools/smoke.js` | Headless smoke test for a game file (see Remixes) |
| `app.js` | Catalogue, search/sort, favourites, player, panic button, settings, storage, live/dev tab icon |
| `weblinks.js` | Games on other sites that open in a new tab (they block embedding) |
| `chat.js` | The chat drawer: room codes, invite links, the MQTT relay connection, message log |

## Adding a game

Add an object to `GAMES` in `games.js`:

```js
{ id: 'mygame', title: 'My Game', emoji: '🎯', cat: 'arcade', colors: ['#111', '#999'],
  help: 'What the keys do.',
  run(stage, api) {
    const { c, x } = api.canvas(400, 300);   // or api.dom('classname') for HTML games
    api.onKey(e => { ... });                // keyboard, auto-removed when the game closes
    api.loop(dt => { ... });                // called every frame, dt in ms
    api.score(n);                           // reports a score; the best is saved
    api.overlay('<b>Game over</b>');        // message over the game; api.overlay(null) hides it
    api.onRestart(reset);                   // hooked to the ↻ button and the R key
  } }
```

Categories: `arcade`, `puzzle`, `action`, `classic`, `racing`. Racing games go in
`racing.js` inside its `GAMES.push(...)` call and can reuse the `RC` helpers. Web games from other sites
can be added without code via Settings → My links; they open in an iframe.
