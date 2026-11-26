'use strict';
const { app } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ID = 'io.github.zaenae.windowsniper';

function launchCommand() {
  if (process.platform === 'linux' && process.env.APPIMAGE) return [process.env.APPIMAGE];
  return app.isPackaged ? [process.execPath] : [process.execPath, app.getAppPath()];
}

const macFile = () => path.join(os.homedir(), 'Library', 'LaunchAgents', `${ID}.plist`);
const linuxFile = () => path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'autostart', 'windowsniper.desktop');

const xml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const execArg = s => `"${s.replace(/[\\"`$]/g, m => '\\' + m)}"`;

function isEnabled() {
  try {
    if (process.platform === 'darwin') return fs.existsSync(macFile());
    if (process.platform === 'linux') return fs.existsSync(linuxFile());
    if (process.platform === 'win32') {
      const [exe, ...args] = launchCommand();
      return app.getLoginItemSettings({ path: exe, args }).openAtLogin;
    }
  } catch {  }
  return false;
}

function setEnabled(on) {
  const cmd = launchCommand();
  if (process.platform === 'darwin') {
    const file = macFile();
    if (!on) { fs.rmSync(file, { force: true }); return; }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${ID}</string>
  <key>ProgramArguments</key>
  <array>
${cmd.map(a => `    <string>${xml(a)}</string>`).join('\n')}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>ProcessType</key>
  <string>Interactive</string>
</dict>
</plist>
`);
    return;
  }
  if (process.platform === 'linux') {
    const file = linuxFile();
    if (!on) { fs.rmSync(file, { force: true }); return; }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `[Desktop Entry]
Type=Application
Name=WindowSniper
Comment=Shoot a window. It closes.
Exec=${cmd.map(execArg).join(' ')}
${app.isPackaged ? '' : `Icon=${path.join(app.getAppPath(), 'icon', 'icon.png')}\n`}Terminal=false
X-GNOME-Autostart-enabled=true
`);
    return;
  }
  if (process.platform === 'win32') {
    const [exe, ...args] = cmd;
    app.setLoginItemSettings({ openAtLogin: on, path: exe, args });
  }
}

module.exports = { isEnabled, setEnabled, launchCommand };
