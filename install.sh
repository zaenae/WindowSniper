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
  if [ -s "$LOG" ]; then printf '\n%s' "$DIM"; tail -n 15 "$LOG" | sed 's/^/    /'; printf '%s\n' "$RST"; fi
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
  command -v curl >/dev/null || [ -f "$SOURCE" ] || fail "curl is needed to download WindowSniper."
  ok "Found $name"

  spin "Downloading WindowSniper" download || fail "Couldn't download WindowSniper. Check your internet connection."
  local shown="$DEST"; case "$DEST" in "$HOME"/*) shown="~${DEST#"$HOME"}" ;; esac
  ok "Downloaded to $shown"

  spin "Installing (about a minute the first time)" env WINDOWSNIPER_NO_START=1 bash "$DEST/WindowSniper.command" </dev/null \
    || fail "Installation failed."
  ok "Installed"
  if grep -qs "alias windowsniper=" "$HOME/.zshrc" "$HOME/.bashrc"; then ok "Added the ${BLD}windowsniper${RST} command"; fi

  spin "Starting WindowSniper" bash "$DEST/WindowSniper.command" </dev/null || fail "WindowSniper didn't start."
  ok "WindowSniper is running"

  if [ "$os" = "Darwin" ]; then
    note "The first time you shoot, macOS asks for Accessibility access: allow ${BLD}Electron${RST}."
  else
    local missing=""
    command -v xprop >/dev/null && command -v xwininfo >/dev/null || missing="x11-utils"
    command -v wmctrl >/dev/null || command -v xdotool >/dev/null || missing="$missing wmctrl"
    [ -n "$missing" ] && note "To close windows, also run: ${BLD}sudo apt install ${missing# }${RST}"
    [ "${XDG_SESSION_TYPE:-}" = "wayland" ] && note "You're on Wayland: only X11 apps can be shot. An Xorg session works best."
  fi
  printf '\n  Press %s%s%s to draw the gun. Click to shoot, %sEsc%s to put it away.\n' "$BLD" "$hotkey" "$RST" "$BLD" "$RST"
  printf '  Next time, open a new terminal and type %swindowsniper%s.\n\n' "$BLD" "$RST"
  rm -f "$LOG"
}

main "$@"
