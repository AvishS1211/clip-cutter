const fs = require('fs');
const path = require('path');

// Copy .next/static into standalone so the server can serve it
const staticSrc = path.join(__dirname, '../.next/static');
const staticDst = path.join(__dirname, '../.next/standalone/.next/static');

// Copy public into standalone
const publicSrc = path.join(__dirname, '../public');
const publicDst = path.join(__dirname, '../.next/standalone/public');

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

console.log('Copying .next/static → standalone...');
copyDir(staticSrc, staticDst);

console.log('Copying public → standalone...');
copyDir(publicSrc, publicDst);

console.log('Done. Ready for electron-builder.');
