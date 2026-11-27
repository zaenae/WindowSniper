const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen, globalShortcut, systemPreferences, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { findWindowAt, closeTarget, canClose } = require('./targets');
const autostart = require('./autostart');
const wayland = require('./wayland');

const LOG_FILE = app.isPackaged ? path.join(app.getPath('userData'), 'windowsniper.log') : path.join(__dirname, 'windowsniper.log');
function log(...args) {
  const line = `${new Date().toISOString()} ${args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}\n`;
  try {
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 256 * 1024) fs.writeFileSync(LOG_FILE, '');
    fs.appendFileSync(LOG_FILE, line);
  } catch {  }
  console.log(line.trimEnd());
}
process.on('uncaughtException', err => log('uncaught:', err.stack || String(err)));

const health = new Map();
const windowKey = t => [t.pid, t.handle ?? '', ...['x', 'y', 'width', 'height'].map(k => Math.round(t.bounds[k]))].join(':');

const AX_HELP = 'macOS blocked it. Open System Settings → Privacy & Security → Accessibility, '
  + `turn ON “${app.isPackaged ? app.getName() : 'Electron'}”, then shoot again.`;
let lastAxPrompt = 0;
function ensureAccessibility() {
  if (canClose()) return true;
  if (Date.now() - lastAxPrompt > 20000) {
    lastAxPrompt = Date.now();
    systemPreferences.isTrustedAccessibilityClient(true);
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
  }
  return false;
}

const AX_PANE = 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility';
const WELCOMED = () => path.join(app.getPath('userData'), '.welcomed');
const has = cmd => require('child_process').spawnSync('sh', ['-c', `command -v ${cmd}`]).status === 0;

function message(opts) {
  app.focus({ steal: true });
  return dialog.showMessageBox({ type: 'info', buttons: ['OK'], ...opts });
}

async function askForAccess() {
  const { response } = await message({
    message: 'One quick step',
    detail: 'WindowSniper needs Accessibility access to close windows.\n\nClick Open Settings, then turn on \u201cElectron\u201d.',
    buttons: ['Open Settings', 'Later'],
    defaultId: 0,
    cancelId: 1,
  });
  if (response !== 0) return false;
  systemPreferences.isTrustedAccessibilityClient(true);
  setTimeout(() => shell.openExternal(AX_PANE), 400);
  const started = Date.now();
  while (!canClose()) {
    if (Date.now() - started > 10 * 60 * 1000) return false;
    await new Promise(r => setTimeout(r, 1500));
  }
  log('accessibility allowed');
  return true;
}

async function linuxCheck(waylandStatus) {
  if (waylandStatus === 'ready') return;
  const missing = [];
  if (!has('xprop') || !has('xwininfo')) missing.push('x11-utils');
  if (!has('wmctrl') && !has('xdotool')) missing.push('wmctrl');
  if (missing.length) {
    const cmd = `sudo apt install ${missing.join(' ')}`;
    const { response } = await message({
      message: 'Almost ready',
      detail: `WindowSniper needs a few X11 tools to close windows. Run this in a terminal:\n\n${cmd}\n\n(Fedora: sudo dnf install xorg-x11-utils wmctrl)`,
      buttons: ['Copy command', 'OK'],
      defaultId: 0,
    });
    if (response === 0) require('electron').clipboard.writeText(cmd);
  }
  if (waylandStatus === 'unsupported') {
    await message({
      message: 'You\u2019re on Wayland',
      detail: 'On this desktop WindowSniper can only close X11 apps. GNOME and KDE Plasma work fully, or pick an \u201cX11\u201d session on the login screen.',
    });
  }
}

async function welcome(waylandStatus) {
  let justAllowed = false;
  if (process.platform === 'darwin' && !canClose()) {
    justAllowed = await askForAccess();
    if (!justAllowed) return;
  }
  if (waylandStatus === 'relogin') {
    const canLogOut = has('gnome-session-quit');
    const { response } = await message({
      message: 'One more step',
      detail: 'Log out and back in once to finish setting up WindowSniper. After that, shots close any window.',
      buttons: canLogOut ? ['Log Out Now', 'Later'] : ['OK'],
      defaultId: 0,
      cancelId: canLogOut ? 1 : 0,
    });
    if (canLogOut && response === 0) require('child_process').spawn('gnome-session-quit', ['--logout'], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  if (fs.existsSync(WELCOMED()) && !justAllowed) return;
  if (process.platform === 'linux') await linuxCheck(waylandStatus);
  await message({
    message: 'You\u2019re all set',
    detail: `Press ${prettyHotkey} to draw the gun. Click a window to shoot it, Esc to put it away.\n\nWindowSniper lives in your ${process.platform === 'darwin' ? 'menu bar' : 'tray'}.`,
  });
  try { fs.mkdirSync(app.getPath('userData'), { recursive: true }); fs.writeFileSync(WELCOMED(), ''); } catch {  }
}

const HOTKEY = 'CommandOrControl+Alt+G';
const CLOSE_DELAY_MS = 450;
const HEADSHOT_PX = 36;
const MAX_HP = 100;
const BODY_DAMAGE = 34;
const HEAD_DAMAGE = 50;
const HEAL_AFTER_MS = 20000;

let tray = null;
let overlay = null;
let overlayReady = false;
let spawnQueued = false;

if (!app.requestSingleInstanceLock()) app.quit();

function createOverlay() {
  overlay = new BrowserWindow({
    show: false,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    focusable: false,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    enableLargerThanScreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  if (process.platform === 'darwin') {
    overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  overlayReady = false;
  overlay.loadFile(path.join(__dirname, 'gun.html'));
  overlay.webContents.on('did-finish-load', () => {
    overlayReady = true;
    if (spawnQueued) {
      spawnQueued = false;
      overlay.webContents.send('spawn-gun');
    }
  });
  overlay.on('closed', () => { overlay = null; overlayReady = false; });
}

function isOut() {
  return !!overlay && overlay.isVisible();
}

function drawGun() {
  if (!overlay) createOverlay();

  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  overlay.setBounds(display.bounds);
  overlay.showInactive();
  if (wayland.isReady()) wayland.setDrawn(true);
  else globalShortcut.register('Escape', holsterGun);
  if (overlayReady) overlay.webContents.send('spawn-gun');
  else spawnQueued = true;
}

function holsterGun() {
  if (isOut()) overlay.webContents.send('holster-gun');
}

function toggleGun() {
  if (isOut()) holsterGun();
  else drawGun();
}

ipcMain.on('hide-overlay', () => {
  if (overlay) overlay.hide();
  if (wayland.isReady()) wayland.setDrawn(false);
  else globalShortcut.unregister('Escape');
});

function ownWindows() {
  const pids = new Set([process.pid, ...app.getAppMetrics().map(m => m.pid)]);
  const windows = new Set();
  for (const w of BrowserWindow.getAllWindows()) {
    const buf = w.getNativeWindowHandle();
    windows.add(Number(buf.length >= 8 ? buf.readBigUInt64LE(0) : buf.readUInt32LE(0)));
  }
  return { pids, windows };
}

function dipToNative(p) {
  if (process.platform === 'win32') return screen.dipToScreenPoint(p);
  if (process.platform === 'linux') {
    const s = screen.getDisplayNearestPoint(p).scaleFactor || 1;
    return { x: Math.round(p.x * s), y: Math.round(p.y * s) };
  }
  return p;
}

function nativeRectToDip(r, nearDip) {
  if (process.platform === 'win32') return screen.screenToDipRect(null, r);
  if (process.platform === 'linux') {
    const s = screen.getDisplayNearestPoint(nearDip).scaleFactor || 1;
    return { x: r.x / s, y: r.y / s, width: r.width / s, height: r.height / s };
  }
  return r;
}

ipcMain.handle('gun-shoot', async (e, { x, y }) => {
  if (!overlay) return { hit: false };
  const ob = overlay.getBounds();
  const ptDip = { x: Math.round(ob.x + x), y: Math.round(ob.y + y) };
  if (!ensureAccessibility()) {
    log(AX_HELP);
    return { hit: false };
  }
  let target;
  try {
    target = await findWindowAt(dipToNative(ptDip), ownWindows());
  } catch (err) {
    log('find failed:', err?.stack || String(err));
    return { hit: false };
  }
  log('shot', ptDip, '->', target ? { name: target.name, pid: target.pid, bounds: target.bounds } : 'miss');
  if (!target) return { hit: false };

  const b = nativeRectToDip(target.bounds, ptDip);
  const headshot = ptDip.y - b.y < HEADSHOT_PX;

  const key = windowKey(target), now = Date.now();
  let hp = health.get(key);
  if (!hp || now - hp.last > HEAL_AFTER_MS) hp = { hp: MAX_HP };
  hp.hp -= headshot ? HEAD_DAMAGE : BODY_DAMAGE;
  hp.last = now;
  const killed = hp.hp <= 0;
  if (killed) health.delete(key); else health.set(key, hp);
  for (const [k, v] of health) if (now - v.last > HEAL_AFTER_MS) health.delete(k);
  log(killed ? 'killed' : 'hit', target.name, { hp: Math.max(0, hp.hp), headshot });

  if (killed) setTimeout(async () => {
    try {
      const how = await closeTarget(target, headshot);
      log('closed', target.name, how || '');
    } catch (err) {
      log('close failed:', target.name, err?.stack || String(err));
    }
  }, CLOSE_DELAY_MS);

  return {
    hit: true,
    killed,
    headshot,
    hp: Math.max(0, hp.hp),
    maxHp: MAX_HP,
    name: target.name,
    bounds: { x: b.x - ob.x, y: b.y - ob.y, width: b.width, height: b.height },
  };
});

function trayIcon() {
  if (process.platform === 'darwin') {
    const img = nativeImage.createFromPath(path.join(__dirname, 'icon', 'trayTemplate.png'));
    img.setTemplateImage(true);
    return img;
  }
  return nativeImage.createFromPath(path.join(__dirname, 'icon', 'tray-light.png'));
}

const prettyHotkey = HOTKEY
  .replace('CommandOrControl', process.platform === 'darwin' ? '⌘' : 'Ctrl')
  .replace('Alt', process.platform === 'darwin' ? '⌥' : 'Alt')
  .replace(/\+/g, process.platform === 'darwin' ? '' : '+');

app.whenReady().then(async () => {
  if (process.platform === 'darwin' && app.dock) app.dock.hide();

  tray = new Tray(trayIcon());
  tray.setToolTip(`WindowSniper – click or ${prettyHotkey} to draw`);
  const buildMenu = () => Menu.buildFromTemplate([
    { label: `Draw / holster  (${prettyHotkey})`, click: toggleGun },
    { type: 'separator' },
    {
      label: 'Start at login', type: 'checkbox', checked: autostart.isEnabled(),
      click: item => {
        try { autostart.setEnabled(item.checked); log('start at login:', item.checked); }
        catch (err) { log('start at login failed:', err?.message || String(err)); }
        if (process.platform === 'linux') tray.setContextMenu(buildMenu());
      },
    },
    { type: 'separator' },
    { label: 'Quit WindowSniper', click: () => app.quit() },
  ]);
  if (process.platform === 'linux') {
    tray.setContextMenu(buildMenu());
  } else {
    tray.on('click', toggleGun);
    tray.on('right-click', () => tray.popUpContextMenu(buildMenu()));
  }

  log('WindowSniper started', { platform: process.platform, electron: process.versions.electron });
  createOverlay();
  const waylandStatus = await wayland.start({ toggle: toggleGun, holster: holsterGun, log });
  if (waylandStatus !== 'ready' && !globalShortcut.register(HOTKEY, toggleGun)) {
    log(`could not register ${HOTKEY} (another app owns it)`);
  }
  welcome(waylandStatus).catch(err => log('welcome failed:', err?.message || String(err)));
  if (process.argv.includes('--draw')) drawGun();
});

app.on('second-instance', toggleGun);
app.on('will-quit', () => { globalShortcut.unregisterAll(); wayland.stop(); });
app.on('window-all-closed', e => e.preventDefault());
