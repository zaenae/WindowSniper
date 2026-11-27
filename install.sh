#!/usr/bin/env bash
set -uo pipefail

REPO="zaenae/WindowSniper"
DEST="${WINDOWSNIPER_HOME:-$HOME/WindowSniper}"
SOURCE="${WINDOWSNIPER_SOURCE:-https://github.com/$REPO/archive/refs/heads/main.tar.gz}"
LOG="$(mktemp -t windowsniper-install.XXXXXX)"

if [ -t 1 ]; then
  RED=$'\033[38;5;203m'; GRN=$'\033[38;5;114m'; YLW=$'\033[38;5;221m'; DIM=$'\033[2m'; BLD=$'\033[1m'; RST=$'\033[0m'
else
  RED= GRN= YLW= DIM= BLD= RST=
fi

logo() {
  printf '\n'
  printf '  %s╭─┼─╮%s  %s█   █ ▀█▀ █▄  █ █▀▀▀▄ ▄▀▀▀▄ █   █%s   %s▄▀▀▀▀ █▄  █ ▀█▀ █▀▀▀▄ █▀▀▀▀ █▀▀▀▄%s\n' "$RED" "$RST" "$BLD" "$RST" "$RED" "$RST"
  printf '  %s┼ ● ┼%s  %s█▄▀▄█  █  █ ▀▄█ █   █ █   █ █▄▀▄█%s    %s▀▀▀▄ █ ▀▄█  █  █▀▀▀  █▀▀▀  █▀▀█%s\n' "$RED" "$RST" "$BLD" "$RST" "$RED" "$RST"
  printf '  %s╰─┼─╯%s  %s▀   ▀ ▀▀▀ ▀   ▀ ▀▀▀▀   ▀▀▀  ▀   ▀%s   %s▀▀▀▀  ▀   ▀ ▀▀▀ ▀     ▀▀▀▀▀ ▀   ▀%s\n' "$RED" "$RST" "$BLD" "$RST" "$RED" "$RST"
  printf '\n         %sShoot a window. It closes.%s   %sgithub.com/%s%s\n\n' "$BLD" "$RST" "$DIM" "$REPO" "$RST"
}

ok()   { printf '  %s✓%s %s\n' "$GRN" "$RST" "$1"; }
NOTED=
note() { [ -z "$NOTED" ] && printf '\n'; NOTED=1; printf '  %s!%s %s\n' "$YLW" "$RST" "$1"; }
fail() {
  printf '\n  %s✗ %s%s\n' "$RED" "$1" "$RST"
  if [ -s "$LOG" ]; then
    printf '\n%s' "$DIM"
    tail -n 60 "$LOG" | tr '\r' '\n' | sed 's/\x1b\[[0-9;]*m//g' | grep -vE '^[[:space:]]*$|█|▀|▄|╭|╰|┼|%$' | tail -n 6 | sed 's/^/    /'
    printf '%s\n' "$RST"
  fi
  printf '\n  Full log: %s\n\n' "$LOG"
  exit 1
}

spin() {
  local msg=$1; shift
  "$@" >>"$LOG" 2>&1 &
  local pid=$! i=0
  local frames=(⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏)
  if [ -t 1 ]; then
    while kill -0 "$pid" 2>/dev/null; do
      printf '\r  %s%s%s %s' "$RED" "${frames[i++ % 10]}" "$RST" "$msg"
      sleep 0.1
    done
    printf '\r\033[K'
  fi
  wait "$pid"
}

linux_tools_missing() {
  { command -v xprop >/dev/null && command -v xwininfo >/dev/null && { command -v wmctrl >/dev/null || command -v xdotool >/dev/null; }; } && return 1
  return 0
}

linux_install_cmd() {
  if command -v apt-get >/dev/null; then echo "apt-get install -y x11-utils wmctrl xdotool"
  elif command -v dnf >/dev/null; then echo "dnf install -y xprop xwininfo wmctrl xdotool"
  elif command -v pacman >/dev/null; then echo "pacman -S --noconfirm --needed xorg-xprop xorg-xwininfo wmctrl xdotool"
  elif command -v zypper >/dev/null; then echo "zypper --non-interactive install xprop xwininfo wmctrl xdotool"
  fi
}

download() {
  local tmp; tmp=$(mktemp -d)
  if [ -f "$SOURCE" ]; then cp "$SOURCE" "$tmp/src.tar.gz"; else curl -fsSL "$SOURCE" -o "$tmp/src.tar.gz"; fi || return 1
  tar -xzf "$tmp/src.tar.gz" -C "$tmp" || return 1
  local top; top=$(find "$tmp" -mindepth 1 -maxdepth 1 -type d | head -n 1)
  [ -n "$top" ] || return 1
  mkdir -p "$DEST" && cp -R "$top/." "$DEST/" && chmod +x "$DEST/WindowSniper.command"
  rm -rf "$tmp"
}

main() {
  logo

  local os arch name hotkey
  os=$(uname -s); arch=$(uname -m)
  case "$os" in
    Darwin) name="macOS"; hotkey="⌘⌥G" ;;
    Linux)  name="Linux"; hotkey="Ctrl+Alt+G" ;;
    *) fail "This installer is for macOS and Linux. On Windows, use install.ps1." ;;
  esac
  case "$arch" in arm64|aarch64) name="$name (ARM)" ;; *) name="$name ($arch)" ;; esac
  if [ "$os" = "Darwin" ]; then
    local mac major rest minor
    mac=$(sw_vers -productVersion 2>/dev/null || echo 99)
    major=${mac%%.*}; rest=${mac#*.}; minor=${rest%%.*}
    if [ "$major" -eq 10 ] && [ "${minor:-0}" -lt 15 ]; then
      fail "WindowSniper needs macOS 10.15 Catalina or newer. This Mac has $mac."
    fi
    name="macOS $mac ($arch)"
  fi
  command -v curl >/dev/null || [ -f "$SOURCE" ] || fail "curl is needed to download WindowSniper."
  ok "Found $name"

  spin "Downloading WindowSniper" download || fail "Couldn't download WindowSniper. Check your internet connection."
  local shown="$DEST"; case "$DEST" in "$HOME"/*) shown="~${DEST#"$HOME"}" ;; esac
  ok "Downloaded to $shown"

  spin "Installing (about a minute the first time)" env WINDOWSNIPER_NO_START=1 bash "$DEST/WindowSniper.command" </dev/null \
    || fail "Installation failed."
  ok "Installed"
  if grep -qs "alias windowsniper=" "$HOME/.zshrc" "$HOME/.bashrc"; then ok "Added the ${BLD}windowsniper${RST} command"; fi

  local desktop="${XDG_CURRENT_DESKTOP:-}:${XDG_SESSION_DESKTOP:-}" wayland_ok=
  if [ "${XDG_SESSION_TYPE:-}" = "wayland" ]; then
    case "$(printf '%s' "$desktop" | tr '[:upper:]' '[:lower:]')" in
      *gnome*|*ubuntu*|*kde*|*plasma*) wayland_ok=1 ;;
    esac
  fi

  if [ "$os" = "Linux" ] && [ -z "$wayland_ok" ] && linux_tools_missing; then
    local cmd; cmd=$(linux_install_cmd)
    if [ -z "$cmd" ]; then
      note "Install xprop, xwininfo and wmctrl with your package manager so shots can close windows."
    else
      printf '\n  WindowSniper needs a few small tools to close windows.\n'
      local run="$cmd" allowed=1
      if [ "$(id -u)" != "0" ]; then
        printf '  Enter your password to install them.\n\n'
        if sudo -v </dev/tty 2>/dev/null; then run="sudo -n $cmd"; else allowed=; fi
      fi
      printf '\n'
      if [ -n "$allowed" ] && spin "Installing tools" $run </dev/null; then
        ok "Installed the tools"
      else
        note "Shots won't close windows until you run: ${BLD}sudo $cmd${RST}"
      fi
    fi
  fi

  spin "Starting WindowSniper" bash "$DEST/WindowSniper.command" </dev/null || fail "WindowSniper didn't start."
  ok "WindowSniper is running"

  if [ "$os" = "Darwin" ]; then
    note "When asked, click ${BLD}Open Settings${RST} and turn on ${BLD}Electron${RST}. That lets shots close windows."
  elif [ -n "$wayland_ok" ] && printf '%s' "$desktop" | grep -qiE 'gnome|ubuntu' \
       && ! dbus-send --session --print-reply --dest=org.gnome.Shell /io/github/zaenae/WindowSniper io.github.zaenae.WindowSniper.Ping >/dev/null 2>&1; then
    note "Log out and back in once to finish setup. After that, shots close any window."
  elif [ "${XDG_SESSION_TYPE:-}" = "wayland" ] && [ -z "$wayland_ok" ]; then
    note "On this Wayland desktop only X11 apps can be shot. GNOME, KDE or an X11 session work fully."
  fi
  printf '\n  Press %s%s%s to draw the gun. Click to shoot, %sEsc%s to put it away.\n' "$BLD" "$hotkey" "$RST" "$BLD" "$RST"
  printf '  Next time, open a new terminal and type %swindowsniper%s.\n\n' "$BLD" "$RST"
  rm -f "$LOG"
}

main "$@"
