/* ---------- web games ----------
   Games hosted on other sites. These open in a new tab: watchdocumentaries.com
   sends an X-Frame-Options: SAMEORIGIN header on every page and game folder, so
   browsers refuse to show them inside our game window. Listing them here keeps
   them in the catalogue (search, favourites, recent) without copying any files. */

const WEB_SITE = 'https://watchdocumentaries.com/';
const WEB_GAMES = [
  ['slope', 'Slope', '🟢', ['#065f46', '#10b981']],
  ['slope-2', 'Slope 2', '🟩', ['#064e3b', '#34d399']],
  ['slope-3', 'Slope 3', '🔵', ['#1e3a8a', '#38bdf8']],
  ['run-3', 'Run 3', '🌌', ['#312e81', '#818cf8']],
  ['ovo', 'OvO', '🏃', ['#3f3f46', '#e4e4e7']],
  ['geometry-dash', 'Geometry Dash', '🔷', ['#0c4a6e', '#22d3ee']],
  ['geometry-dash-subzero', 'Geometry Dash SubZero', '❄️', ['#0e7490', '#a5f3fc']],
  ['geometry-dash-hyper-wave', 'Geometry Dash Hyper Wave', '🌊', ['#5b21b6', '#c084fc']],
  ['moto-x3m', 'Moto X3M', '🏍️', ['#7c2d12', '#fb923c']],
  ['drive-mad', 'Drive Mad', '🚙', ['#9a3412', '#fbbf24']],
  ['drift-hunters', 'Drift Hunters', '🚗', ['#1f2937', '#f43f5e']],
  ['polytrack', 'PolyTrack', '🏁', ['#111827', '#a3e635']],
  ['highway-traffic', 'Highway Traffic', '🛣️', ['#1e293b', '#60a5fa']],
  ['traffic-jam-3d', 'Traffic Jam 3D', '🚦', ['#374151', '#facc15']],
  ['survival-race', 'Survival Race', '🚧', ['#7f1d1d', '#f97316']],
  ['snow-rider-3d', 'Snow Rider 3D', '🛷', ['#0369a1', '#e0f2fe']],
  ['rocket-league', 'Rocket League', '🏎️', ['#1e3a8a', '#f97316']],
  ['basketball-stars', 'Basketball Stars', '🏀', ['#7c2d12', '#fdba74']],
  ['football-legends', 'Football Legends', '🥅', ['#14532d', '#86efac']],
  ['a-small-world-cup', 'A Small World Cup', '⚽', ['#166534', '#fde047']],
  ['cookie-clicker', 'Cookie Clicker', '🍪', ['#78350f', '#fcd34d']],
  ['monkey-mart', 'Monkey Mart', '🐒', ['#713f12', '#fde68a']],
  ['minecraft', 'Minecraft', '⛏️', ['#365314', '#84cc16']],
  ['among-us', 'Among Us', '🚀', ['#7f1d1d', '#fca5a5']],
  ['fortzone-battle-royale', 'Fortzone Battle Royale', '🪂', ['#1e40af', '#a78bfa']],
  ['crazy-cattle-3d', 'Crazy Cattle 3D', '🐑', ['#3f6212', '#bef264']],
  ['five-nights-at-freddys', "Five Nights at Freddy's", '🐻', ['#27272a', '#a16207']],
  ['five-nights-at-freddys-2', "Five Nights at Freddy's 2", '🎪', ['#1c1917', '#dc2626']],
  ['five-nights-at-freddys-3', "Five Nights at Freddy's 3", '🎭', ['#14532d', '#4ade80']],
  ['five-nights-at-freddys-4', "Five Nights at Freddy's 4", '👻', ['#171717', '#7c3aed']],
  ['granny', 'Granny', '👵', ['#292524', '#78716c']],
  ['granny-2', 'Granny 2', '🏚️', ['#1c1917', '#a8a29e']],
].map(([slug, title, emoji, colors]) => ({
  id: 'web:' + slug, title, emoji, colors, cat: 'web', newtab: true,
  url: WEB_SITE + slug + '-game/',
  help: `Runs on watchdocumentaries.com in its own tab – that site does not allow embedding. Want it inside the portal? Try the 🎨 Remixes tab.`,
}));

/* Web games that have a remix of their own: clicking the card plays the remix
   inside the portal, and the ↗ button in the player bar still reaches the original. */
const WEB_REMIX = {
  'slope': 'remix:neon-descent', 'slope-2': 'remix:magma-run', 'slope-3': 'remix:glitch-fall',
  'run-3': 'remix:gravity-tube', 'ovo': 'remix:pip-dash',
  'geometry-dash': 'remix:beat-blocks', 'geometry-dash-subzero': 'remix:beat-blocks-frost', 'geometry-dash-hyper-wave': 'remix:beat-blocks-surge',
  'moto-x3m': 'remix:fliptrail', 'drive-mad': 'remix:wobblewagon', 'drift-hunters': 'remix:slidesyndicate', 'polytrack': 'remix:lowpolylaps',
  'highway-traffic': 'remix:twowaytrouble', 'traffic-jam-3d': 'remix:gridlock', 'survival-race': 'remix:last-one-standing', 'snow-rider-3d': 'remix:powder-peak',
  'rocket-league': 'remix:rocket-pitch', 'basketball-stars': 'remix:hoop-heroes', 'football-legends': 'remix:bighead-kickoff', 'a-small-world-cup': 'remix:tiny-cup',
  'cookie-clicker': 'remix:biscuit-empire', 'monkey-mart': 'remix:mango-market',
  'five-nights-at-freddys': 'remix:arcade-nightshift', 'five-nights-at-freddys-2': 'remix:toyshop-lockin',
  'five-nights-at-freddys-3': 'remix:lighthouse-watch', 'five-nights-at-freddys-4': 'remix:nursery-night',
};
WEB_GAMES.forEach(g => {
  const rid = WEB_REMIX[g.id.slice(4)]; if (!rid) return;
  const r = GAMES.find(x => x.id === rid); if (!r) return;
  g.remix = rid; g.newtab = false;
  g.help = `Plays our remix “${r.title}” inside the portal. ${r.help}`;
  r.origUrl = g.url;
});

/* Our own sites embed fine, so these play inside the portal window. */
WEB_GAMES.unshift({
  id: 'web:muted', title: 'Muted', emoji: '🔇', colors: ['#0a0c12', '#ff2e4d'], cat: 'web', newtab: false,
  url: 'https://lomuroundtheoutside.github.io/muted/',
  help: 'A music video plays with no sound. Type the artist and the title before everyone else. Ten rounds, live leaderboard, anyone on the internet can join. Built on FM.video.',
});
