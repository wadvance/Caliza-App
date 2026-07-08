const fs = require('fs');
const path = require('path');

const FILES = [
  'back-icon.png',
  'back-icon-mask.png',
  'clear-icon.png',
  'close-icon.png',
  'search-icon.png',
];

const MINIMAL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

const TARGETS = [
  path.join('node_modules', '@react-navigation', 'elements', 'lib', 'module', 'assets'),
  path.join('node_modules', '@react-navigation', 'elements', 'lib', 'commonjs', 'assets'),
];

for (const rel of TARGETS) {
  const dir = path.join(__dirname, '..', rel);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  for (const file of FILES) {
    const fp = path.join(dir, file);
    if (!fs.existsSync(fp)) {
      fs.writeFileSync(fp, MINIMAL_PNG);
    }
  }
}

console.log('Created navigation PNG assets for @react-navigation/elements');

// Also generate PWA icons
require('./generate-pwa-icons');
