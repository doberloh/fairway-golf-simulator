# Fairway

A golf simulator that runs in your browser, offline, from a single file.

## Start playing

Double-click **Fairway.html**.

That is the whole procedure. There is no installer, no account and no network
connection involved — the one file contains the renderer, the physics, the
controls and every asset. If double-clicking opens a text editor instead, use
the file's **Open with** menu and choose a browser.

You need a reasonably current browser with WebGL 2 and hardware acceleration
switched on: Chrome, Edge, Firefox or Safari. Extract the whole folder
somewhere normal first and open the file from there — opening it from inside
the ZIP will not work.

**INSTALLATION.md** in this folder has the rest: which devices are supported
and which are merely untested, how to serve it over your local network to a
phone or tablet, how to connect a launch monitor, and what to do when a
browser refuses to cooperate.

## Playing with a launch monitor

The **Launch monitor** folder holds the bridge that carries shots from your
monitor's connector software into the game. It needs **Node.js** (version 20
or newer), installed once from [nodejs.org](https://nodejs.org) -- the LTS
download.

1. Double-click **Start bridge** in the Launch monitor folder: `Start
   bridge.cmd` on Windows, `Start bridge.command` on a Mac. On a Mac the first
   time, macOS may refuse to open it: Control-click it and choose **Open**. A
   window opens and stays open while the bridge runs.
2. Open **Fairway.html**, choose **Launch monitor** on the main menu, then
   **Connect bridge**, and tick **Arm monitor for live shots**.
3. Point your monitor's Open Connect connector at **this computer, TCP port
   1921**, and hit.

**To play on a phone or tablet**, use **Start bridge for a phone** instead. It
prints an address such as `http://192.168.1.50:1922` -- open that on the phone,
on the same Wi-Fi, then Launch monitor and Connect bridge as above. Windows may
ask whether Node.js may use the network: allow it on **private** networks.
The bridge has no password, so only do this on a network you trust.

Close the bridge's window to stop it. **INSTALLATION.md** covers connectors,
ports and what to do when one will not talk.

## What you are getting

Every course is generated from a seed — nine or eighteen holes routed through
one continuous landscape with its own terrain, water, weather, planting and
light. You can shape one in the course studio, save it, and share it as a
short code. Ball flight is integrated from real launch numbers and a launch
monitor can drive it through the bridge in the Launch monitor folder.

**This is an experimental preview.** It plays and it is enjoyable to play, but
it has not been verified against physical launch-monitor hardware, it has not
been tested on every device, and a weak graphics card may struggle even at the
lowest quality setting.

## Licence

Fairway's own code and documentation are MIT licensed — see **LICENSE**. You
may share it, modify it and distribute it, provided the licence and the
third-party notices travel with it.

**THIRD_PARTY_NOTICES.txt** carries the notices for the components Fairway is
built on. **ATTRIBUTION.md** credits the imported artwork, all of it CC0, and
records what was taken from each source. The same notices are embedded inside
Fairway.html under **Help → Open source & credits**, so a copy of that one
file carries its own licences with it.

GSPro, Garmin, Rapsodo and PiTrac are named only to describe what Fairway can
talk to. All trade marks belong to their owners, and no affiliation,
endorsement or certification is claimed or implied.
