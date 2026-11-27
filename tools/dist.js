const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const file = path.join(__dirname, '..', 'package.json');
const original = fs.readFileSync(file, 'utf8');
const pkg = JSON.parse(original);
pkg.devDependencies = { ...(pkg.devDependencies || {}), electron: pkg.dependencies.electron };
delete pkg.dependencies.electron;
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');

let status = 1;
try {
  status = spawnSync('npx', ['--yes', 'electron-builder@25.1.8', ...process.argv.slice(2)], { stdio: 'inherit', shell: process.platform === 'win32' }).status;
} finally {
  fs.writeFileSync(file, original);
}
process.exit(status ?? 1);
