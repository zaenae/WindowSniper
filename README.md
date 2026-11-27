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

One line, nothing else needed. Run it again any time to update.

Next time, start it with `windowsniper` in a new terminal (Mac/Linux) or from the Start menu (Windows).

<p align="center">
  <img src="docs/installer.png" alt="Installing WindowSniper with one command" width="620">
</p>

## Play

| | |
|---|---|
| **Ctrl+Alt+G** (Mac: **⌘⌥G**) | Pull out the gun |
| **Click** | Shoot |
| **Esc** or **right-click** | Put it away |

3 shots kill a window. Shoot its title bar instead and 2 headshots quit the whole app. Leave a window alone for 20 seconds and it heals.

<details>
<summary><b>Shots don't close anything?</b></summary>

- **Mac:** turn on **Electron** in System Settings → Privacy & Security → Accessibility (on older Macs: System Preferences → Security & Privacy → Privacy → Accessibility). Then quit WindowSniper and start it again.
- **Linux:** needs an X11 session (not Wayland) and `sudo apt install x11-utils wmctrl xdotool`.
- **Still nothing?** The log is `windowsniper.log` in the WindowSniper folder.
</details>

<details>
<summary><b>More</b></summary>

- **Start at login / Quit:** right-click the crosshair in your menu bar or tray.
- **Uninstall:** untick Start at login, quit, then delete `~/WindowSniper` and the `windowsniper` line in `~/.zshrc` or `~/.bashrc` (Mac/Linux), or `%LOCALAPPDATA%\WindowSniper` and the Start menu shortcut (Windows).
- **Tweak it:** gun feel at the top of `gun.html`, health and hotkey at the top of `main.js`.
</details>

---

<sub>Fan-made joke inspired by GTA. Not affiliated with Rockstar Games or Take-Two. MIT license.</sub>
