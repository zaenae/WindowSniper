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

**Mac / Linux**: paste this into Terminal. Nothing else needed.

```bash
curl -fsSL https://raw.githubusercontent.com/zaenae/WindowSniper/main/install.sh | bash
```

**Windows**: [**download the installer**](https://github.com/zaenae/WindowSniper/releases/latest/download/WindowSniper-win-x64.exe) and run it.

<p align="center">
  <img src="docs/installer.png" alt="Installing WindowSniper with one command" width="620">
</p>

<details>
<summary><b>Other ways to install</b></summary>

- **Mac app:** [Apple chip (M1–M4)](https://github.com/zaenae/WindowSniper/releases/latest/download/WindowSniper-mac-arm64.dmg) · [Intel](https://github.com/zaenae/WindowSniper/releases/latest/download/WindowSniper-mac-x64.dmg)
- **Linux app:** [AppImage](https://github.com/zaenae/WindowSniper/releases/latest/download/WindowSniper-linux-x86_64.AppImage)
- **Already have Node.js?** `npm install -g github:zaenae/WindowSniper`, then run `windowsniper`
</details>

## Play

| | |
|---|---|
| **Ctrl+Alt+G** (Mac: **⌘⌥G**) | Pull out the gun |
| **Click** | Shoot |
| **Esc** | Put it away |

3 shots kill a window. Shoot the title bar for a headshot.

<details>
<summary><b>Mac app from Releases says it's "damaged"?</b></summary>

It isn't, it's just not signed by Apple. Drag it into Applications, then run this once in Terminal:

```bash
xattr -cr /Applications/WindowSniper.app
```

Pick the Apple chip version for M1–M4 Macs, Intel for older ones.
</details>

<details>
<summary><b>Shots don't close anything?</b></summary>

- **Mac:** allow it in System Settings → Privacy & Security → Accessibility.
- **Linux:** needs X11 and `sudo apt install x11-utils wmctrl xdotool`.
- **Windows:** if SmartScreen complains, click More info → Run anyway.
</details>

<details>
<summary><b>More</b></summary>

- **Start at login / Quit:** right-click the crosshair in your menu bar or tray.
- **Uninstall:** delete `~/WindowSniper` (Mac/Linux one-liner), uninstall it from Settings → Apps (Windows), drag the app to the Trash (Mac app), or `npm uninstall -g windowsniper` (npm).
- **Tweak it:** gun feel at the top of `gun.html`, health and hotkey at the top of `main.js`.
</details>

---

<sub>Fan-made joke inspired by GTA. Not affiliated with Rockstar Games or Take-Two. MIT license.</sub>
