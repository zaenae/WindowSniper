'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { Bus } = require('./dbus');

const UUID = 'windowsniper@zaenae.github.io';
const GNOME_PATH = '/io/github/zaenae/WindowSniper';
const GNOME_IFACE = 'io.github.zaenae.WindowSniper';
const NAME = 'io.github.zaenae.WindowSniper';
const OBJECT = '/io/github/zaenae/WindowSniper';

let desktop = null;
let ready = false;
let bus = null;
let handlers = {};
let log = () => {};
const pending = new Map();

function run(cmd, args, timeout = 3000) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout }, (err, stdout) => (err ? reject(err) : resolve(String(stdout))));
  });
}

const shell = (method, signature, args) => bus.call('org.gnome.Shell', GNOME_PATH, GNOME_IFACE, method, signature, args);
const kwin = (method, signature, args) => bus.call('org.kde.KWin', '/Scripting', 'org.kde.kwin.Scripting', method, signature, args);

function detect() {
  if (process.platform !== 'linux') return null;
  if (process.env.XDG_SESSION_TYPE !== 'wayland' && !process.env.WAYLAND_DISPLAY) return null;
  const de = `${process.env.XDG_CURRENT_DESKTOP || ''}:${process.env.XDG_SESSION_DESKTOP || ''}`.toLowerCase();
  if (/gnome|ubuntu|unity|pop/.test(de)) return 'gnome';
  if (/kde|plasma/.test(de)) return 'kde';
  return 'other';
}

function copyDir(src, dest) {
  let changed = false;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) { changed = copyDir(from, to) || changed; continue; }
    const data = fs.readFileSync(from);
    let same = false;
    try { same = fs.readFileSync(to).equals(data); } catch {  }
    if (!same) { fs.writeFileSync(to, data); changed = true; }
  }
  return changed;
}

const gsettingsList = out => (out.match(/'[^']*'/g) || []).map(s => s.slice(1, -1));

async function enableGnomeExtension() {
  const dataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  copyDir(path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'linux', 'gnome', UUID), path.join(dataHome, 'gnome-shell', 'extensions', UUID));
  try {
    const enabled = gsettingsList(await run('gsettings', ['get', 'org.gnome.shell', 'enabled-extensions']));
    if (!enabled.includes(UUID)) {
      const list = [...enabled, UUID].map(s => `'${s}'`).join(', ');
      await run('gsettings', ['set', 'org.gnome.shell', 'enabled-extensions', `[${list}]`]);
    }
    const disabled = gsettingsList(await run('gsettings', ['get', 'org.gnome.shell', 'disabled-extensions']));
    if (disabled.includes(UUID)) {
      const list = disabled.filter(s => s !== UUID).map(s => `'${s}'`).join(', ');
      await run('gsettings', ['set', 'org.gnome.shell', 'disabled-extensions', `[${list}]`]);
    }
    if ((await run('gsettings', ['get', 'org.gnome.shell', 'disable-user-extensions'])).trim() === 'true') {
      await run('gsettings', ['set', 'org.gnome.shell', 'disable-user-extensions', 'false']);
    }
  } catch (err) { log('gsettings failed:', err.message); }
  try { await run('gnome-extensions', ['enable', UUID]); } catch {  }
}

const gnomePing = () => shell('Ping').then(() => true, () => false);

async function startGnome() {
  if (await gnomePing()) return 'ready';
  await enableGnomeExtension();
  for (let i = 0; i < 4; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (await gnomePing()) return 'ready';
  }
  return 'relogin';
}

const kwinScript = body => `(function () {
  function report(text) {
    callDBus('${NAME}', '${OBJECT}', '${NAME}', 'Report', text);
  }
  function windows() {
    if (workspace.stackingOrder) return workspace.stackingOrder;
    return workspace.windowList ? workspace.windowList() : workspace.clientList();
  }
  function onCurrentDesktop(w) {
    if (w.onAllDesktops) return true;
    var cur = workspace.currentDesktop;
    if (w.desktops) {
      for (var i = 0; i < w.desktops.length; i++) {
        if (w.desktops[i] === cur || (cur && w.desktops[i].id === cur.id)) return true;
      }
      return false;
    }
    return w.desktop === cur || w.desktop === -1;
  }
  ${body}
})();`;

async function kwinRun(body) {
  const nonce = Math.random().toString(36).slice(2, 10);
  const file = path.join(os.tmpdir(), `windowsniper-kwin-${nonce}.js`);
  const name = `windowsniper-${nonce}`;
  fs.writeFileSync(file, kwinScript(body.replace(/\{NONCE\}/g, nonce)));
  const result = new Promise(resolve => {
    const timer = setTimeout(() => { pending.delete(nonce); resolve(null); }, 2000);
    pending.set(nonce, value => { clearTimeout(timer); pending.delete(nonce); resolve(value); });
  });
  try {
    await kwin('loadScript', 'ss', [file, name]);
    await kwin('start');
    return await result;
  } finally {
    kwin('unloadScript', 's', [name]).catch(() => {});
    fs.rm(file, { force: true }, () => {});
  }
}

async function startKde() {
  try {
    await kwin('unloadScript', 's', ['windowsniper']).catch(() => {});
    const file = path.join(os.tmpdir(), 'windowsniper-kwin-shortcut.js');
    fs.writeFileSync(file, kwinScript(`registerShortcut('WindowSniper Draw', 'WindowSniper: draw or holster the gun', 'Ctrl+Alt+G', function () {
    callDBus('${NAME}', '${OBJECT}', '${NAME}', 'Toggle');
  });`));
    await kwin('loadScript', 'ss', [file, 'windowsniper']);
    await kwin('start');
  } catch (err) {
    log('kwin shortcut failed:', err.message);
    return 'unsupported';
  }
  const probe = await kwinRun(`report('{NONCE}:ok');`);
  return probe === 'ok' ? 'ready' : 'unsupported';
}

async function start(opts) {
  handlers = opts;
  log = opts.log || log;
  desktop = detect();
  if (!desktop) return null;
  let status = 'unsupported';
  try {
    bus = new Bus();
    await bus.connect();
    await bus.own(NAME);
    bus.handle(NAME, 'Toggle', () => handlers.toggle?.());
    bus.handle(NAME, 'Holster', () => handlers.holster?.());
    bus.handle(NAME, 'Report', text => {
      const sep = String(text).indexOf(':');
      pending.get(String(text).slice(0, sep))?.(String(text).slice(sep + 1));
    });
    if (desktop === 'gnome') status = await startGnome();
    else if (desktop === 'kde') status = await startKde();
  } catch (err) { log('wayland setup failed:', err.message); }
  ready = status === 'ready';
  log('wayland', { desktop, status });
  return status;
}

function stop() {
  if (desktop === 'kde' && ready) kwin('unloadScript', 's', ['windowsniper']).catch(() => {});
  setTimeout(() => bus?.close(), 100);
}

const isReady = () => ready;

function parseTarget(encoded) {
  if (!encoded || encoded === 'none') return null;
  const w = JSON.parse(decodeURIComponent(encoded));
  return { handle: w.id, pid: w.pid, name: w.name, bounds: { x: w.x, y: w.y, width: w.width, height: w.height } };
}

async function findWindowAt(pt, own) {
  const x = Math.round(pt.x), y = Math.round(pt.y);
  const pids = [...own.pids].filter(p => p > 0);
  if (desktop === 'gnome') {
    const [out] = await shell('WindowAt', 'iiau', [x, y, pids]);
    return parseTarget(out);
  }
  return parseTarget(await kwinRun(`
    var X = ${x}, Y = ${y}, SKIP = ${JSON.stringify(pids)}, list = windows(), out = 'none';
    for (var i = list.length - 1; i >= 0; i--) {
      var w = list[i];
      if (!w || w.minimized || w.hidden || w.deleted || !onCurrentDesktop(w)) continue;
      var g = w.frameGeometry;
      if (X < g.x || Y < g.y || X >= g.x + g.width || Y >= g.y + g.height) continue;
      if (SKIP.indexOf(w.pid) >= 0) continue;
      if (w.desktopWindow || w.dock) break;
      if (!(w.normalWindow || w.dialog || w.utility)) continue;
      out = encodeURIComponent(JSON.stringify({ id: String(w.internalId), pid: w.pid, name: w.caption || 'window', x: g.x, y: g.y, width: g.width, height: g.height }));
      break;
    }
    report('{NONCE}:' + out);`));
}

async function close(target) {
  if (desktop === 'gnome') {
    await shell('Close', 't', [target.handle]);
    return;
  }
  await kwinRun(`
    var list = windows();
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].internalId) === ${JSON.stringify(String(target.handle))}) { list[i].closeWindow(); break; }
    }
    report('{NONCE}:done');`);
}

function setDrawn(drawn) {
  if (desktop === 'gnome' && ready) {
    shell('SetDrawn', 'b', [drawn]).catch(() => {});
  }
}

module.exports = { detect, start, stop, isReady, findWindowAt, close, setDrawn };
