```
  ╭─┼─╮  █   █ ▀█▀ █▄  █ █▀▀▀▄ ▄▀▀▀▄ █   █   ▄▀▀▀▀ █▄  █ ▀█▀ █▀▀▀▄ █▀▀▀▀ █▀▀▀▄
  ┼ ● ┼  █▄▀▄█  █  █ ▀▄█ █   █ █   █ █▄▀▄█    ▀▀▀▄ █ ▀▄█  █  █▀▀▀  █▀▀▀  █▀▀█
  ╰─┼─╯  ▀   ▀ ▀▀▀ ▀   ▀ ▀▀▀▀   ▀▀▀  ▀   ▀   ▀▀▀▀  ▀   ▀ ▀▀▀ ▀     ▀▀▀▀▀ ▀   ▀

         Shoot a window. It closes.
```

<p align="center">
  <img src="docs/screenshot.jpg" alt="WindowSniper killing a browser window" width="820">
</p>

<p align="center"><b>A GTA-style pistol for your desktop.</b> Mac, Windows, Linux. Free.</p>

## Install

**Mac / Linux** (Terminal) · macOS 10.15+ or Linux with X11
```bash
curl -fsSL https://raw.githubusercontent.com/zaenae/WindowSniper/main/install.sh | bash
```

**Windows** (PowerShell) · Windows 10+
```powershell
irm https://raw.githubusercontent.com/zaenae/WindowSniper/main/install.ps1 | iex
```

One line installs everything, Node.js included. Run it again any time to update.

On Mac, click **Open Settings** when asked and turn on **Electron** (the engine WindowSniper runs on). On Linux, enter your password if asked. Windows needs nothing.

Next time, start it with `windowsniper` in a new terminal (Mac/Linux) or from the Start menu (Windows).

<p align="center">
  <img src="docs/installer.png" alt="Installing WindowSniper with one command" width="620">
</p>

## Play

WindowSniper waits quietly in the background. Press the shortcut anytime, in any app, and the gun pops up.

| | |
|---|---|
| **Ctrl+Alt+G** (Mac: **⌘⌥G**) | Pull out the gun |
| **Click** | Shoot |
| **Esc** or **right-click** | Put it away |

3 shots kill a window. Shoot its title bar instead and 2 headshots quit the whole app. Leave a window alone for 20 seconds and it heals.

<details>
<summary><b>More</b></summary>

- **Start at login / Quit:** right-click the crosshair in your menu bar or tray.
- **Shots don't close anything?** On Mac, check that **Electron** is on in System Settings → Privacy & Security → Accessibility. Still stuck? Look at `windowsniper.log` in the WindowSniper folder.
- **Tweak it:** gun feel at the top of `gun.html`, health and hotkey at the top of `main.js`.

**Uninstall**

Mac
```bash
pkill -f "$HOME/WindowSniper"; launchctl remove io.github.zaenae.windowsniper 2>/dev/null; rm -rf ~/WindowSniper ~/Library/LaunchAgents/io.github.zaenae.windowsniper.plist ~/Library/Application\ Support/windowsniper ~/Library/Caches/electron; sed -i '' '/# WindowSniper/d;/alias windowsniper=/d' ~/.zshrc ~/.bashrc 2>/dev/null; tccutil reset Accessibility com.github.Electron
```

Linux
```bash
pkill -f "$HOME/WindowSniper"; rm -rf ~/WindowSniper ~/.config/autostart/windowsniper.desktop ~/.config/windowsniper ~/.cache/electron; sed -i '/# WindowSniper/d;/alias windowsniper=/d' ~/.zshrc ~/.bashrc 2>/dev/null
```

Windows
```powershell
Get-Process electron -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*WindowSniper*' } | Stop-Process -Force; $k = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'; (Get-ItemProperty $k).PSObject.Properties | Where-Object { "$($_.Value)" -like '*WindowSniper*' } | ForEach-Object { Remove-ItemProperty $k $_.Name }; Remove-Item "$env:LOCALAPPDATA\WindowSniper", "$env:APPDATA\windowsniper", "$([Environment]::GetFolderPath('Programs'))\WindowSniper.lnk" -Recurse -Force -ErrorAction SilentlyContinue
```
</details>

---

<sub>Fan-made joke inspired by GTA. Not affiliated with Rockstar Games or Take-Two. MIT license.</sub>
