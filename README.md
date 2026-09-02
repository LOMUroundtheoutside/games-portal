# Games Portal

A self-contained games site: 13 games built in plain JavaScript, a panic button,
a tab disguise, favourites, high scores and your own game links. No build step,
no dependencies, no other sites needed.

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

## Tab disguise

Settings → Tab disguise changes the browser tab's title and icon to look like
Teams, Classroom, Docs, Drive, Wikipedia or Khan Academy. Custom title/icon URL
also allowed.

## Files

| File | What it is |
|------|------------|
| `index.html` | Page layout: top bar, sidebar, game grid, player window, settings dialog |
| `style.css` | All styling; five colour themes live at the top in `:root` / `[data-theme]` |
| `games.js` | The mini engine (`makeApi`) plus every game as an object in the `GAMES` array |
| `app.js` | Catalogue, search/sort, favourites, player, panic button, settings, storage |

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

Categories: `arcade`, `puzzle`, `action`, `classic`. Web games from other sites
can be added without code via Settings → My links; they open in an iframe.
