/* ---------- site config ----------
   Written by the admin panel (admin.html). This file is what every visitor of the
   live site loads, so a change only reaches other people once this file is saved
   here and pushed to GitHub. The admin panel can also keep a copy in your own
   browser (Apply here) which wins over this file on your machine only. */
window.SITE_CONFIG = {
  version: 1,

  /* Name, tab icon and the big line on the home page */
  site: {
    name: 'Games Portal',
    icon: '🎮',
    tagline: 'Play anything, anywhere.',
  },

  /* A banner across the top of the portal. Empty text = no banner.
     level: 'info' (purple), 'good' (green) or 'warn' (red) */
  announcement: { text: '', level: 'info' },

  /* What a brand-new visitor starts with. They can still change it in Settings. */
  defaults: {
    theme: 'midnight',
    panicUrl: 'https://teams.microsoft.com',
    panicKey: '`',
    sound: true,
  },

  /* Whole sections of the portal, on or off */
  features: { chat: true, web: true, customLinks: true },

  /* Game ids that are hidden from the grid, search, favourites and recent */
  hidden: [],

  /* Game ids pinned to the front of every list */
  featured: [],

  /* id -> { title, emoji, cat } - rename, re-emoji or re-file any game */
  overrides: {},

  /* Links you add for everybody (Settings -> My links is per-browser instead) */
  links: [],

  /* Passcode for admin.html. This is a speed bump, not security: anyone can read
     this file on the live site. Change it in the panel. Default: 150812 */
  admin: { scheme: 'simple', hash: 's4t2gx-307d6n' },
};
