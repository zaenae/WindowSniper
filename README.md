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

```bash
npm install -g github:zaenae/WindowSniper
windowsniper
```

Needs [Node.js](https://nodejs.org) 18 or newer. Works on Mac (10.15+), Windows and Linux.

No Node? Grab the app from [**Releases**](https://github.com/zaenae/WindowSniper/releases).

<p align="center">
  <img src="docs/installer.png" alt="Installing and starting WindowSniper" width="620">
</p>

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

Pick `mac-arm64` for M1–M4 Macs, `mac-x64` for older Intel ones.
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
- **Uninstall:** `npm uninstall -g windowsniper`, or drag the app to the Trash.
- **Tweak it:** gun feel at the top of `gun.html`, health and hotkey at the top of `main.js`.
</details>

---

<sub>Fan-made joke inspired by GTA. Not affiliated with Rockstar Games or Take-Two. MIT license.</sub>
