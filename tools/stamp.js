#!/usr/bin/env node
/* Cache-busting: rewrites every local <script src> and <link href> in index.html and
   admin.html to carry ?v=<8 chars of the file's sha1>. GitHub Pages sends
   cache-control: max-age=600, so without this a visitor keeps running a stale game file
   for up to ten minutes after a push. Run before committing (the pre-commit hook does):
     node tools/stamp.js            */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
let changed = 0;
for (const page of ['index.html', 'admin.html']) {
  const p = path.join(ROOT, page), before = fs.readFileSync(p, 'utf8');
  const after = before.replace(/(<(?:script src|link rel="stylesheet" href)=")([^"?:]+)(?:\?v=[0-9a-f]+)?(")/g, (m, pre, file, post) => {
    const f = path.join(ROOT, file);
    if (!fs.existsSync(f)) return m;
    const v = crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 8);
    return `${pre}${file}?v=${v}${post}`;
  });
  if (after !== before) { fs.writeFileSync(p, after); changed++; console.log('stamped ' + page); }
}
if (!changed) console.log('nothing to stamp');
