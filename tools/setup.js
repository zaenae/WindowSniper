const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const modules = path.join(__dirname, '..', 'node_modules');
const run = (dir, args) => spawnSync(process.execPath, args, { cwd: dir, stdio: 'inherit' }).status === 0;

const electron = path.join(modules, 'electron');
const electronReady = () => fs.existsSync(path.join(electron, 'path.txt')) && fs.existsSync(path.join(electron, 'dist'));
if (!electronReady()) {
  console.log('Downloading Electron...');
  run(electron, ['install.js']);
}

const koffi = path.join(modules, 'koffi');
try { require(koffi); } catch { run(koffi, ['src/cnoke/cnoke.js', '-P', '.', '-D', 'src/koffi', '--prebuild']); }

if (!electronReady()) {
  console.error('Electron could not be downloaded. Check your internet connection and try again.');
  process.exit(1);
}
