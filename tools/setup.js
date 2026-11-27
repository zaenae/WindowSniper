const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const modules = path.join(__dirname, '..', 'node_modules');
const electron = path.join(modules, 'electron');
const dist = path.join(electron, 'dist');
const platform = process.platform;
const version = require(path.join(electron, 'package.json')).version;
const exe = { darwin: 'Electron.app/Contents/MacOS/Electron', win32: 'electron.exe', linux: 'electron' }[platform];
const binary = path.join(dist, exe);
const macApp = path.join(dist, 'Electron.app');
const stamp = path.join(dist, '.windowsniper');

const sh = (cmd, args, show) => spawnSync(cmd, args, { stdio: show ? 'inherit' : 'ignore' }).status === 0;
const read = file => { try { return fs.readFileSync(file, 'utf8').trim(); } catch { return ''; } };
const fail = msg => { console.error(msg); process.exit(1); };

function arch() {
  if (platform === 'darwin') return spawnSync('sysctl', ['-n', 'hw.optional.arm64'], { encoding: 'utf8' }).stdout?.trim() === '1' ? 'arm64' : 'x64';
  if (platform === 'win32') return /ARM64/i.test(process.env.PROCESSOR_ARCHITEW6432 || process.env.PROCESSOR_ARCHITECTURE || '') ? 'arm64' : 'x64';
  return os.arch() === 'arm64' ? 'arm64' : 'x64';
}

function macVerified() {
  return sh('codesign', ['--verify', '--deep', '--strict', macApp]);
}

function complete() {
  if (!fs.existsSync(binary)) return false;
  if (platform === 'darwin') {
    sh('xattr', ['-cr', macApp]);
    return fs.existsSync(path.join(macApp, 'Contents', 'Frameworks', 'Electron Framework.framework')) && macVerified();
  }
  return fs.statSync(binary).size > 20e6 && fs.existsSync(path.join(dist, 'icudtl.dat'));
}

const PY_UNZIP = [
  'import sys, zipfile, os',
  'z = zipfile.ZipFile(sys.argv[1])',
  'for i in z.infolist():',
  '    p = z.extract(i, sys.argv[2])',
  '    m = i.external_attr >> 16',
  '    if m: os.chmod(p, m & 0o7777)',
].join('\n');

function unzip(zip) {
  if (platform === 'darwin') return sh('ditto', ['-x', '-k', zip, dist], true);
  if (platform === 'win32') return sh('tar.exe', ['-xf', zip, '-C', dist], true);
  return sh('unzip', ['-q', '-o', zip, '-d', dist]) || sh('bsdtar', ['-xf', zip, '-C', dist]) || sh('python3', ['-c', PY_UNZIP, zip, dist], true);
}

function download() {
  const a = arch();
  const name = `electron-v${version}-${platform}-${a}.zip`;
  const zip = path.join(os.tmpdir(), `windowsniper-${name}`);
  console.log('Downloading Electron (~100 MB, one time)...');
  const curl = platform === 'win32' ? 'curl.exe' : 'curl';
  const url = `https://github.com/electron/electron/releases/download/v${version}/${name}`;
  if (!sh(curl, ['-fL', '--retry', '3', '--progress-bar', '-o', zip, url], true)) fail('Electron download failed. Check your internet connection and try again.');
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });
  const ok = unzip(zip);
  fs.rmSync(zip, { force: true });
  if (!ok || !fs.existsSync(binary)) fail('Electron could not be unpacked. Run the install command again.');
}

if (!(fs.existsSync(binary) && read(stamp) === version && read(path.join(electron, 'path.txt')) === exe)) {
  if (!complete()) download();
  if (platform === 'darwin') {
    sh('xattr', ['-cr', macApp]);
    if (!macVerified()) sh('codesign', ['--force', '--deep', '--sign', '-', macApp]);
    if (!sh('codesign', ['--verify', '--deep', macApp])) fail('macOS refused to open Electron. Run the install command again.');
  }
  fs.writeFileSync(path.join(electron, 'path.txt'), exe);
  fs.writeFileSync(stamp, version);
}

const koffi = path.join(modules, 'koffi');
try { require(koffi); } catch { spawnSync(process.execPath, ['src/cnoke/cnoke.js', '-P', '.', '-D', 'src/koffi', '--prebuild'], { cwd: koffi, stdio: 'inherit' }); }
