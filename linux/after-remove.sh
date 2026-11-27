#!/bin/bash

if [ "$1" = remove ] || [ "$1" = purge ] || [ "$1" = 0 ]; then
    if type update-alternatives >/dev/null 2>&1; then
        update-alternatives --remove windowsniper /opt/WindowSniper/windowsniper || true
    fi
    rm -f /usr/bin/windowsniper
    if [ -f /etc/apparmor.d/windowsniper ]; then
        command -v apparmor_parser >/dev/null 2>&1 && apparmor_parser --remove /etc/apparmor.d/windowsniper || true
        rm -f /etc/apparmor.d/windowsniper
    fi
fi
