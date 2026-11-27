import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const PATH = '/io/github/zaenae/WindowSniper';
const APP = 'io.github.zaenae.WindowSniper';

function tellApp(method) {
  Gio.DBus.session.call(APP, PATH, APP, method, null, null, Gio.DBusCallFlags.NO_AUTO_START, -1, null, null);
}
const IFACE = `<node>
  <interface name="io.github.zaenae.WindowSniper">
    <method name="Ping"><arg type="s" direction="out"/></method>
    <method name="WindowAt">
      <arg type="i" direction="in" name="x"/>
      <arg type="i" direction="in" name="y"/>
      <arg type="au" direction="in" name="skip"/>
      <arg type="s" direction="out"/>
    </method>
    <method name="Close">
      <arg type="t" direction="in" name="id"/>
      <arg type="b" direction="out"/>
    </method>
    <method name="SetDrawn">
      <arg type="b" direction="in" name="drawn"/>
    </method>
  </interface>
</node>`;

const SHOOTABLE = new Set([
  Meta.WindowType.NORMAL,
  Meta.WindowType.DIALOG,
  Meta.WindowType.MODAL_DIALOG,
  Meta.WindowType.UTILITY,
  Meta.WindowType.TOOLBAR,
  Meta.WindowType.MENU,
  Meta.WindowType.SPLASHSCREEN,
]);

export default class WindowSniperExtension extends Extension {
  enable() {
    this._settings = this.getSettings();
    this._holsterBound = false;
    this._dbus = Gio.DBusExportedObject.wrapJSObject(IFACE, this);
    this._dbus.export(Gio.DBus.session, PATH);
    Main.wm.addKeybinding('draw', this._settings, Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
      Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW, () => tellApp('Toggle'));
  }

  disable() {
    Main.wm.removeKeybinding('draw');
    this.SetDrawn(false);
    this._dbus?.unexport();
    this._dbus = null;
    this._settings = null;
  }

  Ping() {
    return this.metadata['version-name'] ?? '1';
  }

  _windows() {
    return global.get_window_actors().map(a => a.meta_window).filter(Boolean).reverse();
  }

  WindowAt(x, y, skip) {
    const skipped = new Set(skip);
    const workspace = global.workspace_manager.get_active_workspace();
    for (const w of this._windows()) {
      if (w.minimized || !w.showing_on_its_workspace() || !w.located_on_workspace(workspace)) continue;
      const r = w.get_frame_rect();
      if (x < r.x || y < r.y || x >= r.x + r.width || y >= r.y + r.height) continue;
      if (skipped.has(w.get_pid())) continue;
      const type = w.get_window_type();
      const title = w.get_title() || '';
      if (type === Meta.WindowType.DESKTOP || type === Meta.WindowType.DOCK) return '';
      if (w.customJS_ding || /^@!\d|^Desktop Icons/.test(title)) return '';
      if (!SHOOTABLE.has(type)) continue;
      return encodeURIComponent(JSON.stringify({
        id: w.get_id(), pid: w.get_pid(), name: title || 'window',
        x: r.x, y: r.y, width: r.width, height: r.height,
      }));
    }
    return '';
  }

  Close(id) {
    const w = this._windows().find(win => win.get_id() === id);
    if (!w) return false;
    w.delete(global.get_current_time());
    return true;
  }

  SetDrawn(drawn) {
    if (drawn && !this._holsterBound) {
      Main.wm.addKeybinding('holster', this._settings, Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
        Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW, () => tellApp('Holster'));
      this._holsterBound = true;
    } else if (!drawn && this._holsterBound) {
      Main.wm.removeKeybinding('holster');
      this._holsterBound = false;
    }
  }
}
