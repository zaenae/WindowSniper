```
  ╭─┼─╮  █   █ ▀█▀ █▄  █ █▀▀▀▄ ▄▀▀▀▄ █   █   ▄▀▀▀▀ █▄  █ ▀█▀ █▀▀▀▄ █▀▀▀▀ █▀▀▀▄
  ┼ ● ┼  █▄▀▄█  █  █ ▀▄█ █   █ █   █ █▄▀▄█    ▀▀▀▄ █ ▀▄█  █  █▀▀▀  █▀▀▀  █▀▀█
  ╰─┼─╯  ▀   ▀ ▀▀▀ ▀   ▀ ▀▀▀▀   ▀▀▀  ▀   ▀   ▀▀▀▀  ▀   ▀ ▀▀▀ ▀     ▀▀▀▀▀ ▀   ▀

         Shoot a window. It closes.
```

Got a window you're sick of? Press a key, a pistol comes up from the bottom of your screen, and you shoot it. Three hits and it's gone.

It's meant to feel like GTA: wanted stars, cash for every kill, casings flying out of the gun, and a big red **KILLED** when a window goes down.

![WindowSniper killing a browser window](docs/screenshot.jpg)

## Install

On a Mac or Linux, paste this into Terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/zaenae/WindowSniper/main/install.sh | bash
```

On Windows, paste this into PowerShell:

```powershell
irm https://raw.githubusercontent.com/zaenae/WindowSniper/main/install.ps1 | iex
```

You don't need anything installed first. It downloads WindowSniper, sets it up and starts it. Run the same line again later to update.

<img src="docs/installer.png" alt="The installer running in a terminal" width="640">

## How to play

- **Ctrl+Alt+G** (**⌘⌥G** on a Mac) pulls the gun out. Press it again, or **Esc**, to put it away.
- **Click** to shoot whatever window is under the crosshair.
- **Three body shots** kill a window. Shoot its **title bar** for a headshot: two of those and the whole app quits.
- Stop shooting a window for 20 seconds and it heals.
- Shooting the desktop, the Dock or the taskbar does nothing.

A kill closes the window the same way its X button does, so apps still ask before throwing away unsaved work.

Next time, type `windowsniper` in a new terminal (Mac/Linux) or open WindowSniper from the Start menu (Windows). It keeps running in the background after you close the terminal. To have it start on its own, right-click the crosshair icon in your menu bar or tray and tick **Start at login**. To quit, right-click it and choose **Quit WindowSniper**.

## Good to know

**Mac:** the first time you shoot, macOS asks whether WindowSniper can control your computer. Allow it in System Settings → Privacy & Security → Accessibility (it shows up as **Electron**). Until then, shots won't close anything.

**Linux:** you need an X11 session and a few small tools. The installer tells you if any are missing:

```bash
sudo apt install x11-utils wmctrl xdotool
```

**Windows:** nothing extra.

If something isn't working, the log is `windowsniper.log` in the WindowSniper folder.

## Uninstall

Turn off **Start at login** if you switched it on, quit WindowSniper, then:

- **Mac/Linux:** delete the `~/WindowSniper` folder and the `windowsniper` line in `~/.zshrc` or `~/.bashrc`.
- **Windows:** delete `%LOCALAPPDATA%\WindowSniper` and the WindowSniper shortcut in the Start menu.

## For tinkerers

- Run it straight from a clone with `bash WindowSniper.command` (Mac/Linux) or `WindowSniper.cmd` (Windows).
- The feel of the gun (recoil, sway, magazine size, volume) is set at the top of `gun.html`. Health, damage and the hotkey are at the top of `main.js`.
- Everything is drawn in code, including the gun, the hand, the textures and the sounds. `gun-model.js` builds the pistol, and `hand-sdf.js` sculpts the hand.
- `npm install` then `npm run dist` builds a regular app for your system. Pushing a tag like `v0.1.0` makes GitHub build the Mac, Windows and Linux apps and put them on the Releases page.

## Not affiliated with Rockstar

WindowSniper is a fan-made joke inspired by the GTA games. It isn't made, endorsed or approved by Rockstar Games or Take-Two Interactive, and it doesn't use any of their art, fonts, sounds or code. Grand Theft Auto and GTA are their trademarks.

## License

MIT. See [LICENSE](LICENSE).
