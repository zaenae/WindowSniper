const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const modules = path.join(__dirname, '..', 'node_modules');
const electron = path.join(modules, 'electron');
const dist = path.join(electron, 'dist');
const run = (dir, args) => spawnSync(process.execPath, args, { cwd: dir, stdio: 'inherit' }).status === 0;
const sh = (cmd, args, show) => spawnSync(cmd, args, { stdio: show ? 'inherit' : 'ignore' }).status === 0;
const fail = msg => { console.error(msg); process.exit(1); };

function setupMac() {
  const version = require(path.join(electron, 'package.json')).version;
  const app = path.join(dist, 'Electron.app');
  const bin = path.join(app, 'Contents', 'MacOS', 'Electron');
  const stamp = path.join(dist, '.windowsniper-checked');
  const stampOk = () => { try { return fs.readFileSync(stamp, 'utf8') === version; } catch { return false; } };
  if (fs.existsSync(bin) && stampOk()) return;

  const verified = () => fs.existsSync(bin) && sh('codesign', ['--verify', '--deep', '--strict', app]);
  if (!verified()) {
    const arm = spawnSync('sysctl', ['-n', 'hw.optional.arm64'], { encoding: 'utf8' }).stdout.trim() === '1';
    const arch = arm ? 'arm64' : 'x64';
    const zip = path.join(os.tmpdir(), `windowsniper-electron-${version}-${arch}.zip`);
    console.log('Downloading Electron (~100 MB, one time)...');
    fs.rmSync(dist, { recursive: true, force: true });
    fs.mkdirSync(dist, { recursive: true });
    const url = `https://github.com/electron/electron/releases/download/v${version}/electron-v${version}-darwin-${arch}.zip`;
    if (!sh('curl', ['-fL', '--progress-bar', '-o', zip, url], true)) fail('Electron download failed. Check your internet connection and try again.');
    const unpacked = sh('ditto', ['-x', '-k', zip, dist], true);
    fs.rmSync(zip, { force: true });
    if (!unpacked || !fs.existsSync(bin)) fail('Electron could not be unpacked. Try again.');
    fs.writeFileSync(path.join(electron, 'path.txt'), 'Electron.app/Contents/MacOS/Electron');
  }
  sh('xattr', ['-cr', app]);
  if (!verified()) sh('codesign', ['--force', '--deep', '--sign', '-', app]);
  if (!sh('codesign', ['--verify', '--deep', app])) fail('macOS refused to open Electron. Run the install command again.');
  fs.writeFileSync(stamp, version);
}

if (process.platform === 'darwin') {
  setupMac();
} else if (!fs.existsSync(path.join(electron, 'path.txt')) || !fs.existsSync(dist)) {
  console.log('Downloading Electron...');
  run(electron, ['install.js']);
  if (!fs.existsSync(path.join(electron, 'path.txt'))) fail('Electron could not be downloaded. Check your internet connection and try again.');
}

const koffi = path.join(modules, 'koffi');
try { require(koffi); } catch { run(koffi, ['src/cnoke/cnoke.js', '-P', '.', '-D', 'src/koffi', '--prebuild']); }
