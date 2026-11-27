#!/bin/bash
cd "$(dirname "$0")" || exit 1

if [ "$(uname -s)" = "Darwin" ]; then
  mac=$(sw_vers -productVersion 2>/dev/null || echo 99)
  major=${mac%%.*}; rest=${mac#*.}; minor=${rest%%.*}
  if [ "$major" -eq 10 ] && [ "${minor:-0}" -lt 15 ]; then
    echo "WindowSniper needs macOS 10.15 Catalina or newer. This Mac has $mac."
    exit 1
  fi
fi

NODE_VERSION=20.18.1
node_ok() {
  command -v npm >/dev/null 2>&1 || return 1
  local v; v=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null) || return 1
  [ "${v:-0}" -ge 18 ]
}

if ! node_ok; then
  for p in /opt/homebrew/bin /usr/local/bin "$HOME/.volta/bin"; do
    [ -x "$p/npm" ] && export PATH="$p:$PATH"
  done
  [ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
fi

if ! node_ok; then
  export PATH="$PWD/.node/bin:$PATH"
  if ! node_ok || [ "$(node -v 2>/dev/null)" != "v$NODE_VERSION" ]; then
    case "$(uname -s)-$(uname -m)" in
      Darwin-arm64)  PLAT=darwin-arm64 ;;
      Darwin-x86_64) PLAT=darwin-x64 ;;
      Linux-x86_64)  PLAT=linux-x64 ;;
      Linux-aarch64) PLAT=linux-arm64 ;;
      *) echo "Please install Node.js from https://nodejs.org and run me again."; exit 1 ;;
    esac
    echo "Downloading a private copy of Node.js just for WindowSniper (~45 MB, one time)..."
    rm -rf .node && mkdir -p .node
    if ! curl -fL --progress-bar "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-$PLAT.tar.gz" \
         | tar -xz -C .node --strip-components=1; then
      rm -rf .node
      echo "Download failed - check your internet connection."
      exit 1
    fi
    node_ok || { echo "Node.js won't run on this computer."; exit 1; }
  fi
fi

if [ ! -d node_modules/electron/dist ] || ! cmp -s package.json node_modules/.windowsniper-package.json; then
  echo "Installing WindowSniper (about a minute the first time)..."
  if ! npm install --no-fund --no-audit; then
    echo "Install failed (see above)."
    exit 1
  fi
  cp package.json node_modules/.windowsniper-package.json
fi
node tools/setup.js || exit 1

if [ "$(uname -s)" = "Linux" ]; then
  missing=""
  command -v xprop >/dev/null 2>&1 || missing="$missing x11-utils"
  command -v xwininfo >/dev/null 2>&1 || case "$missing" in *x11-utils*) ;; *) missing="$missing x11-utils" ;; esac
  command -v wmctrl >/dev/null 2>&1 || command -v xdotool >/dev/null 2>&1 || missing="$missing wmctrl"
  if [ -n "$missing" ]; then
    echo "WindowSniper needs a few X11 tools to close windows. Install them with:"
    echo "  sudo apt install$missing        (Debian/Ubuntu)"
    echo "  sudo dnf install xorg-x11-utils wmctrl   (Fedora)"
    echo "(WindowSniper will still start, but shots won't close anything until they're installed.)"
  fi
  if [ "${XDG_SESSION_TYPE:-}" = "wayland" ]; then
    echo "Note: you're on Wayland. WindowSniper can only close X11/XWayland windows there;"
    echo "log in with an 'X11' / 'Xorg' session for it to work on every window."
  fi
fi

HERE="$(pwd)"
for rc in "$HOME/.zshrc" "$HOME/.bashrc"; do
  if [ "$rc" = "$HOME/.zshrc" ] || [ -f "$rc" ]; then
    if ! grep -q "alias windowsniper=" "$rc" 2>/dev/null; then
      printf '\n# WindowSniper\nalias windowsniper="bash \\"%s/WindowSniper.command\\""\n' "$HERE" >> "$rc"
      ADDED=1
    fi
  fi
done
[ -n "$ADDED" ] && echo "Added the 'windowsniper' command. Next time, open a new Terminal window and just type: windowsniper"

[ "${WINDOWSNIPER_NO_START:-}" = "1" ] && exit 0
node bin/windowsniper.js "$@"
