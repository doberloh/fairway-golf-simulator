#!/bin/sh
# Fairway's launch-monitor bridge, for macOS. Double-click to start it.
# It needs Node.js 20 or newer, installed once from https://nodejs.org
# It serves this computer and a phone on the same Wi-Fi at once, and prints a
# link for each. If macOS asks whether node may accept incoming connections,
# allow it for a phone; refuse, and this computer still plays.
# The first time, macOS may refuse to open it: Control-click it, choose Open.
cd "$(dirname "$0")" || exit 1
# A double-clicked script does not read your shell profile, so add the places
# the Node.js installer and Homebrew put `node`.
PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"
if ! command -v node >/dev/null 2>&1; then
  echo "Fairway's launch-monitor bridge needs Node.js, which is not installed."
  echo 'Install the LTS version from https://nodejs.org, then double-click this again.'
  printf 'Press Return to close. '; read -r _
  exit 1
fi
export FAIRWAY_HTTP_HOST=all
node fairway-bridge.mjs
