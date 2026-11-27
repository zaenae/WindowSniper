'use strict';
const { execFile } = require('child_process');

const MIN_SIZE = 40;

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 5000, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(String(stdout));
    });
  });
}

const isOwn = (own, pid, win) => own.pids.has(pid) || own.windows.has(Number(win));

const contains = (b, p) =>
  p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height;

const WM_CLOSE = 0x0010;
const GW_HWNDNEXT = 2;
const GWL_EXSTYLE = -20;
const WS_EX_TRANSPARENT = 0x20;
const WS_EX_TOOLWINDOW = 0x80;
const DWMWA_CLOAKED = 14;

const WIN_BLOCKERS = new Set([
  'Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd',
  'NotifyIconOverflowWindow', 'Windows.UI.Core.CoreWindow',
]);

let w32 = null;
function win32Api() {
  if (w32 !== null) return w32;
  w32 = false;
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');
    koffi.struct('OW_RECT', { left: 'int32_t', top: 'int32_t', right: 'int32_t', bottom: 'int32_t' });
    let dwm = null;
    try { dwm = koffi.load('dwmapi.dll'); } catch {  }
    w32 = {
      GetTopWindow: user32.func('uintptr_t __stdcall GetTopWindow(uintptr_t hWnd)'),
      GetWindow: user32.func('uintptr_t __stdcall GetWindow(uintptr_t hWnd, uint32_t uCmd)'),
      IsWindowVisible: user32.func('int __stdcall IsWindowVisible(uintptr_t hWnd)'),
      IsIconic: user32.func('int __stdcall IsIconic(uintptr_t hWnd)'),
      GetWindowRect: user32.func('int __stdcall GetWindowRect(uintptr_t hWnd, _Out_ OW_RECT *lpRect)'),
      GetWindowThreadProcessId: user32.func('uint32_t __stdcall GetWindowThreadProcessId(uintptr_t hWnd, void *pid)'),
      GetClassNameW: user32.func('int __stdcall GetClassNameW(uintptr_t hWnd, void *buf, int max)'),
      GetWindowTextW: user32.func('int __stdcall GetWindowTextW(uintptr_t hWnd, void *buf, int max)'),
      GetWindowLongW: user32.func('int32_t __stdcall GetWindowLongW(uintptr_t hWnd, int nIndex)'),
      PostMessageW: user32.func('int __stdcall PostMessageW(uintptr_t hWnd, uint32_t msg, uintptr_t wParam, intptr_t lParam)'),
      DwmGetWindowAttribute: dwm
        ? dwm.func('int32_t __stdcall DwmGetWindowAttribute(uintptr_t hwnd, uint32_t attr, void *value, uint32_t size)')
        : null,
    };
  } catch (e) {
    console.warn('windowsniper: koffi/user32 unavailable –', e.message);
  }
  return w32;
}

function winString(fn, h) {
  const buf = Buffer.alloc(1024);
  const len = fn(h, buf, 512);
  return len > 0 ? buf.toString('utf16le', 0, len * 2) : '';
}

function* win32Windows(api) {
  let h = api.GetTopWindow(0);
  for (let i = 0; h && i < 5000; i++, h = api.GetWindow(h, GW_HWNDNEXT)) {
    if (!api.IsWindowVisible(h) || api.IsIconic(h)) continue;
    if (api.DwmGetWindowAttribute) {
      const cloaked = Buffer.alloc(4);
      if (api.DwmGetWindowAttribute(h, DWMWA_CLOAKED, cloaked, 4) === 0 && cloaked.readUInt32LE(0)) continue;
    }
    const r = {};
    if (!api.GetWindowRect(h, r)) continue;
    const bounds = { x: r.left, y: r.top, width: r.right - r.left, height: r.bottom - r.top };
    if (bounds.width < MIN_SIZE || bounds.height < MIN_SIZE) continue;
    const pid = Buffer.alloc(4);
    api.GetWindowThreadProcessId(h, pid);
    yield { h: Number(h), pid: pid.readUInt32LE(0), bounds, exStyle: api.GetWindowLongW(h, GWL_EXSTYLE) };
  }
}

function findWin32(pt, own) {
  const api = win32Api();
  if (!api) return null;
  for (const w of win32Windows(api)) {
    if (!contains(w.bounds, pt)) continue;
    if (isOwn(own, w.pid, w.h)) continue;
    if (w.exStyle & WS_EX_TRANSPARENT) continue;
    if (WIN_BLOCKERS.has(winString(api.GetClassNameW, w.h))) return null;
    if (w.exStyle & WS_EX_TOOLWINDOW) continue;
    const title = winString(api.GetWindowTextW, w.h);
    if (!title) continue;
    return { handle: w.h, pid: w.pid, name: title, bounds: w.bounds };
  }
  return null;
}

function closeWin32(target, quitApp) {
  const api = win32Api();
  if (!api) return;
  if (!quitApp) {
    api.PostMessageW(target.handle, WM_CLOSE, 0, 0);
    return;
  }

  for (const w of win32Windows(api)) {
    if (w.pid !== target.pid || (w.exStyle & WS_EX_TOOLWINDOW)) continue;
    api.PostMessageW(w.h, WM_CLOSE, 0, 0);
  }
}

const MAC_SYSTEM_UI = ['Dock', 'Window Server', 'SystemUIServer', 'Control Center', 'Notification Center'];
const MAC_FIND = `
ObjC.import('CoreGraphics');
function run(argv) {
  const px = Number(argv[0]), py = Number(argv[1]);
  const own = String(argv[2]).split(',').map(Number);
  const systemUI = ${JSON.stringify(MAC_SYSTEM_UI)};
  const list = ObjC.deepUnwrap(ObjC.castRefToObject($.CGWindowListCopyWindowInfo(1 | 16, 0))) || [];
  const seen = {};
  for (const w of list) {
    const b = w.kCGWindowBounds;
    if (!b || b.Width < ${MIN_SIZE} || b.Height < ${MIN_SIZE}) continue;
    const before = seen[w.kCGWindowOwnerPID] || 0;
    if (w.kCGWindowLayer === 0) seen[w.kCGWindowOwnerPID] = before + 1;
    if (px < b.X || px >= b.X + b.Width || py < b.Y || py >= b.Y + b.Height) continue;
    if (own.indexOf(w.kCGWindowOwnerPID) !== -1) continue;
    if (w.kCGWindowAlpha !== undefined && w.kCGWindowAlpha < 0.05) continue;
    if (systemUI.indexOf(w.kCGWindowOwnerName) !== -1) return '';
    if (w.kCGWindowLayer !== 0) continue;
    return JSON.stringify({ pid: w.kCGWindowOwnerPID, name: w.kCGWindowOwnerName || 'window', index: before,
      x: b.X, y: b.Y, width: b.Width, height: b.Height });
  }
  return '';
}`;

async function findMac(pt, own) {
  const out = (await run('osascript', [
    '-l', 'JavaScript', '-e', MAC_FIND,
    String(Math.round(pt.x)), String(Math.round(pt.y)), [...own.pids].join(','),
  ])).trim();
  if (!out) return null;
  const w = JSON.parse(out);
  return { handle: null, pid: w.pid, name: w.name, index: w.index, bounds: { x: w.x, y: w.y, width: w.width, height: w.height } };
}

const MAC_CLOSE = `
ObjC.import('AppKit');
ObjC.import('ApplicationServices');
function run(argv) {
  var pid = Number(argv[0]), quit = argv[1] === 'quit', index = Number(argv[2]) || 0;
  if (quit) {
    var ra = $.NSRunningApplication.runningApplicationWithProcessIdentifier(pid);
    if (ra && !ra.isNil()) { ra.terminate; return 'quit'; }
  }
  if (!$.AXIsProcessTrusted()) throw new Error('Accessibility permission not granted');
  var app = $.AXUIElementCreateApplication(pid);
  $.AXUIElementSetMessagingTimeout(app, 1.5);
  function get(el, name) {
    var r = Ref();
    var err = $.AXUIElementCopyAttributeValue(el, $(name), r);
    if (err !== 0) throw new Error('AX ' + name + ' error ' + err);
    return r[0];
  }
  var wins = ObjC.castRefToObject(get(app, 'AXWindows'));
  var n = wins.count;
  var pick = index < n ? index : (n === 1 ? 0 : -1);
  if (pick < 0) throw new Error('no matching window found (app has ' + n + ')');
  var btn = get(wins.objectAtIndex(pick), 'AXCloseButton');
  var err = $.AXUIElementPerformAction(btn, $('AXPress'));
  if (err !== 0) throw new Error('AXPress error ' + err);
  return 'closed';
}`;

async function closeMacScript(target, quitApp) {
  const out = await run('osascript', ['-l', 'JavaScript', '-e', MAC_CLOSE, String(target.pid), quitApp ? 'quit' : 'close', String(target.index || 0)]);
  return out.trim();
}

let ax = null;
function macAx() {
  if (ax) return ax;
  const koffi = require('koffi');
  const cf = koffi.load('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation');
  const as = koffi.load('/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices');
  koffi.struct('AG_Pair', { a: 'double', b: 'double' });
  const api = {
    CFStringCreateWithCString: cf.func('void *CFStringCreateWithCString(void *alloc, const char *str, uint32_t enc)'),
    CFStringGetCString: cf.func('bool CFStringGetCString(void *str, void *buf, intptr_t size, uint32_t enc)'),
    CFArrayGetCount: cf.func('intptr_t CFArrayGetCount(void *arr)'),
    CFArrayGetValueAtIndex: cf.func('void *CFArrayGetValueAtIndex(void *arr, intptr_t i)'),
    CFRelease: cf.func('void CFRelease(void *ref)'),
    AXIsProcessTrusted: as.func('bool AXIsProcessTrusted()'),
    AXUIElementCreateApplication: as.func('void *AXUIElementCreateApplication(int pid)'),
    AXUIElementSetMessagingTimeout: as.func('int32_t AXUIElementSetMessagingTimeout(void *el, float seconds)'),
    AXUIElementCopyAttributeValue: as.func('int32_t AXUIElementCopyAttributeValue(void *el, void *attr, _Out_ void **value)'),
    AXUIElementPerformAction: as.func('int32_t AXUIElementPerformAction(void *el, void *action)'),
    AXValueGetPair: as.func('bool AXValueGetValue(void *value, int type, _Out_ AG_Pair *out)'),
  };
  const UTF8 = 0x08000100;
  const strs = {};
  api.str = s => (strs[s] ||= api.CFStringCreateWithCString(null, s, UTF8));
  api.toJs = ref => {
    const buf = Buffer.alloc(1024);
    return ref && api.CFStringGetCString(ref, buf, buf.length, UTF8) ? buf.toString('utf8', 0, buf.indexOf(0)) : '';
  };
  ax = api;
  return ax;
}

const AX_ERRORS = { '-25211': 'Accessibility permission not granted', '-25204': 'app did not respond', '-25205': 'attribute unsupported' };

function axGet(api, el, attr) {
  const out = [null];
  const err = api.AXUIElementCopyAttributeValue(el, api.str(attr), out);
  if (err !== 0) throw new Error(`AX ${attr}: ${AX_ERRORS[err] || 'error ' + err}`);
  return out[0];
}

function axPair(api, el, attr, type) {
  const v = axGet(api, el, attr);
  try {
    const p = {};
    if (!api.AXValueGetPair(v, type, p)) throw new Error(`AX ${attr}: unreadable`);
    return [p.a, p.b];
  } finally { api.CFRelease(v); }
}

function axPress(api, el, attr) {
  const btn = axGet(api, el, attr);
  try {
    const err = api.AXUIElementPerformAction(btn, api.str('AXPress'));
    if (err !== 0) throw new Error(`AXPress: ${AX_ERRORS[err] || 'error ' + err}`);
  } finally { api.CFRelease(btn); }
}

function axChildren(api, el) {
  const arr = axGet(api, el, 'AXChildren');
  const n = api.CFArrayGetCount(arr);
  return { arr, items: Array.from({ length: Number(n) }, (_, i) => api.CFArrayGetValueAtIndex(arr, i)) };
}

function axQuitViaMenu(api, appEl) {
  const bar = axGet(api, appEl, 'AXMenuBar');
  const top = axChildren(api, bar);
  try {
    if (top.items.length < 2) throw new Error('no app menu');
    const menus = axChildren(api, top.items[1]);
    try {
      const entries = axChildren(api, menus.items[0]);
      try {
        const titled = [];
        for (const el of entries.items) {
          try { const t = axGet(api, el, 'AXTitle'); const title = api.toJs(t); api.CFRelease(t); if (title) titled.push({ el, title }); }
          catch {  }
        }
        const quit = titled.find(it => /^quit\b/i.test(it.title)) || titled[titled.length - 1];
        if (!quit) throw new Error('no Quit item');
        const err = api.AXUIElementPerformAction(quit.el, api.str('AXPress'));
        if (err !== 0) throw new Error(`Quit: ${AX_ERRORS[err] || 'error ' + err}`);
      } finally { api.CFRelease(entries.arr); }
    } finally { api.CFRelease(menus.arr); }
  } finally { api.CFRelease(top.arr); api.CFRelease(bar); }
}

function closeMac(target, quitApp) {
  let api;
  try { api = macAx(); } catch { return closeMacScript(target, quitApp); }
  if (!api.AXIsProcessTrusted()) throw new Error('Accessibility permission not granted');
  const appEl = api.AXUIElementCreateApplication(target.pid);
  try {
    api.AXUIElementSetMessagingTimeout(appEl, 1.5);
    if (quitApp) {
      try { axQuitViaMenu(api, appEl); return 'quit'; }
      catch (e) { console.warn('windowsniper: menu quit failed, closing windows instead:', e.message); }
    }
    const wins = axGet(api, appEl, 'AXWindows');
    try {
      const n = Number(api.CFArrayGetCount(wins));
      const b = target.bounds, near = (u, v) => Math.abs(u - v) <= 4;
      let closed = 0;
      for (let i = 0; i < n; i++) {
        const w = api.CFArrayGetValueAtIndex(wins, i);
        let match = quitApp;
        if (!match) {
          try {
            const [x, y] = axPair(api, w, 'AXPosition', 1);
            const [ww, hh] = axPair(api, w, 'AXSize', 2);
            match = near(x, b.x) && near(y, b.y) && near(ww, b.width) && near(hh, b.height);
          } catch { match = false; }
        }
        if (!match) continue;
        try { axPress(api, w, 'AXCloseButton'); closed++; } catch (e) { if (!quitApp) throw e; }
        if (!quitApp) break;
      }
      if (!closed && n === 1) { axPress(api, api.CFArrayGetValueAtIndex(wins, 0), 'AXCloseButton'); closed++; }
      if (!closed) throw new Error(`no matching window found (app has ${n})`);
      return 'closed';
    } finally { api.CFRelease(wins); }
  } finally { api.CFRelease(appEl); }
}

async function findLinux(pt, own) {
  const stacking = await run('xprop', ['-root', '-notype', '_NET_CLIENT_LIST_STACKING']);
  const ids = (stacking.match(/0x[0-9a-f]+/gi) || []).reverse();
  for (const id of ids) {
    let info;
    try { info = await run('xwininfo', ['-id', id]); } catch { continue; }
    if (!/Map State:\s*IsViewable/.test(info)) continue;
    const num = label => Number((info.match(new RegExp(label + ':\\s*(-?\\d+)')) || [])[1]);
    const bounds = {
      x: num('Absolute upper-left X'), y: num('Absolute upper-left Y'),
      width: num('Width'), height: num('Height'),
    };
    if (bounds.width < MIN_SIZE || bounds.height < MIN_SIZE || !contains(bounds, pt)) continue;
    let props = '';
    try {
      props = await run('xprop', ['-id', id, '-notype', '_NET_WM_PID', '_NET_WM_WINDOW_TYPE', '_NET_WM_STATE', '_NET_WM_NAME', 'WM_NAME']);
    } catch {  }
    const pid = Number((props.match(/_NET_WM_PID = (\d+)/) || [])[1] || 0);
    if (isOwn(own, pid, parseInt(id, 16))) continue;
    if (/_NET_WM_STATE_HIDDEN/.test(props)) continue;
    if (/_NET_WM_WINDOW_TYPE_(DESKTOP|DOCK)/.test(props)) return null;
    const name = (props.match(/_NET_WM_NAME = "(.*)"/) || props.match(/WM_NAME = "(.*)"/) || [])[1] || 'window';
    return { handle: id, pid, name, bounds };
  }
  return null;
}

async function closeLinux(target, quitApp) {
  if (quitApp && target.pid) {
    try { process.kill(target.pid, 'SIGTERM'); return; } catch {  }
  }
  try {
    await run('wmctrl', ['-i', '-c', target.handle]);
  } catch {
    await run('xdotool', ['windowactivate', '--sync', target.handle, 'key', '--clearmodifiers', 'alt+F4']);
  }
}

async function findWindowAt(pt, own) {
  if (process.platform === 'win32') return findWin32(pt, own);
  if (process.platform === 'darwin') return findMac(pt, own);
  if (process.platform === 'linux') return findLinux(pt, own);
  return null;
}

async function closeTarget(target, quitApp = false) {
  if (process.platform === 'win32') return closeWin32(target, quitApp);
  if (process.platform === 'darwin') return closeMac(target, quitApp);
  if (process.platform === 'linux') return closeLinux(target, quitApp);
}

function canClose() {
  if (process.platform !== 'darwin') return true;
  try { return require('electron').systemPreferences.isTrustedAccessibilityClient(false); } catch { return true; }
}

module.exports = { findWindowAt, closeTarget, canClose };
