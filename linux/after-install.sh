#!/bin/bash

if type update-alternatives >/dev/null 2>&1; then
    if [ -L /usr/bin/windowsniper ] && [ -e /usr/bin/windowsniper ] && [ "$(readlink /usr/bin/windowsniper)" != /etc/alternatives/windowsniper ]; then
        rm -f /usr/bin/windowsniper
    fi
    update-alternatives --install /usr/bin/windowsniper windowsniper /opt/WindowSniper/windowsniper 100 || ln -sf /opt/WindowSniper/windowsniper /usr/bin/windowsniper
else
    ln -sf /opt/WindowSniper/windowsniper /usr/bin/windowsniper
fi

chmod 4755 /opt/WindowSniper/chrome-sandbox || true

if [ -f /etc/apparmor.d/abi/4.0 ] && command -v apparmor_parser >/dev/null 2>&1; then
    cat > /etc/apparmor.d/windowsniper <<'PROFILE'
abi <abi/4.0>,
include <tunables/global>

profile windowsniper /opt/WindowSniper/windowsniper flags=(unconfined) {
  userns,
  include if exists <local/windowsniper>
}
PROFILE
    apparmor_parser --replace --write-cache --skip-read-cache /etc/apparmor.d/windowsniper || true
fi

if command -v update-mime-database >/dev/null 2>&1; then
    update-mime-database /usr/share/mime || true
fi

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database /usr/share/applications || true
fi
