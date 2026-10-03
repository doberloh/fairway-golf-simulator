# Fairway

A golf simulator that runs in your browser: procedural courses, real ball
flight, and your launch monitor driving it. Free.

Extract the whole ZIP into a normal folder first — running anything from
inside the ZIP will not work.

## 1. Start the server

**run_fairway_server** is the program in this folder. It serves the game to
this computer and to phones and tablets on your Wi-Fi, and it receives shots
from your launch monitor. There is nothing to install.

- **Windows:** double-click **run_fairway_server.exe**. The first time,
  Windows may say *Windows protected your PC*: choose **More info**, then
  **Run anyway**. Windows then asks whether it may use the network — allow it
  on **private** networks so a phone can reach it.
- **Mac:** Control-click **run_fairway_server**, choose **Open**, then
  **Open** again. If macOS still refuses, open **System Settings → Privacy &
  Security**, scroll down and choose **Open Anyway**. Download the Apple
  Silicon or the Intel version to match your Mac (Apple menu → About This Mac).
- **Linux:** in a terminal in this folder, run `./run_fairway_server`.

A window opens and stays open while Fairway runs. It prints two links: one for
this computer and one for a phone or tablet. **Keep the window open while you
play; close it to stop.**

These programs are not signed by a paid developer certificate, which is why
Windows and macOS warn about them the first time. They are built from the
open source in this release; nothing else is installed or changed.

## 2. Open the game

- **On this computer:** open **http://127.0.0.1:1922** in Chrome, Edge,
  Firefox or Safari.
- **On a phone or tablet** on the same Wi-Fi: open the second link the window
  printed, something like `http://192.168.1.50:1922`. To keep it like an app,
  add it to the home screen — **iPhone and iPad:** Safari's Share button, then
  **Add to Home Screen**; **Android:** Chrome's menu, then **Install app** or
  **Add to Home screen**. It opens full screen from there, and works whenever
  the server is running on the computer.

Every device plays its own round. A phone or tablet does its own graphics, so
start with nine holes on a smaller device.

## 3. Connect your launch monitor

Fairway listens for shots in the **GSPro Open Connect** format, so it works
with the connector software that already drives GSPro. The quickest route is
**rēlā**, a free connector for Windows that talks to many launch monitors:
[docs.rela.golf](https://docs.rela.golf/).

1. **Install your launch monitor's own software, then rēlā**, on the computer
   running Fairway (rēlā's installation guide walks through it).
2. **Connect your launch monitor in rēlā:** turn the monitor on, pick it under
   **Device** and click **Search**.
3. **Set rēlā's Simulator to GSPro.**
4. **Point it at Fairway:** in rēlā's **Settings**, set the simulator's
   address to **127.0.0.1** and its port to **1921** — Fairway's port. (GSPro
   itself uses 921; see *Ports* below if your connector cannot change it.)
5. **Get playing:** in Fairway, choose **Launch monitor** on the main menu,
   **Connect bridge**, and tick **Arm monitor for live shots**. Hit a ball.

The game's shot panel says **Ready** in green when a ball is on the mat,
**Finding ball** while the monitor looks for one, and **No monitor** when the
server is running but no device is talking to it.

**Other connectors and other computers.** Any connector that sends the GSPro
Open Connect (v1) format works the same way: point it at the computer running
Fairway, TCP port 1921. rēlā is Windows only; on a Mac or Linux, use a
connector your launch monitor supports there. Fairway has not yet been tested
against every physical launch monitor.

## Playing without a launch monitor

Double-click **Fairway.html**. It is the whole game in one file and needs no
server, no network and no account. Mouse, keyboard, touch and game
controllers all work — but the launch monitor is what Fairway is built
around. **PLAYING.md** has every control and setting.

## When something does not work

| What happens | What to try |
| --- | --- |
| The server says *Could not start Fairway* | Something else is using its ports — another copy of Fairway, or GSPro. Close it and start again. |
| A phone cannot open the link | Same Wi-Fi as the computer (not a guest network); allow the server on private networks in the firewall; use the `192.168…` link, never `127.0.0.1` (on a phone that means the phone). |
| rēlā connects but no shots arrive | In Fairway: **Connect bridge**, then **Arm monitor for live shots**. A shot is refused while a ball is in the air or a panel needs an answer. |
| rēlā will not connect | Check the port is **1921** and the server's window is open. |
| The game is blank or very slow | Use a current browser with hardware acceleration on; try nine holes and the Low quality setting. |

**Ports.** The server uses TCP **1921** for the launch monitor and **1922**
for the browser. To use others — say, 921 for a connector that cannot be
changed — start it from a terminal with `FAIRWAY_TCP_PORT` (and
`FAIRWAY_HTTP_PORT`) set. Command Prompt: `set FAIRWAY_TCP_PORT=921` then
`run_fairway_server.exe`. macOS or Linux:
`FAIRWAY_TCP_PORT=921 ./run_fairway_server` (ports under 1024 may need
permission there).

**Seeing what a connector sends.** Set `FAIRWAY_LOG=debug` the same way and
the window prints every message in and out, with each shot decoded into mph
and rpm — where wrong units and swapped spin fields show up.

**Safety.** The server has no password: anything on your home network that
can reach this computer could drive the simulator. That is fine at home; do
not run it on a network you do not trust.

## What is in this folder

| File | What it is |
| --- | --- |
| **run_fairway_server** | The server: serves the game and receives your launch monitor's shots. |
| **Fairway.html** | The game. Opens on its own for play without a launch monitor. |
| **PLAYING.md** | Every control, mode and setting. |
| **LICENSE**, **THIRD_PARTY_NOTICES.txt**, **ATTRIBUTION.md** | The licences and credits. |
| **server-source/fairway-bridge.mjs** | The server program as plain JavaScript: run it with Node.js 20 or newer (`node server-source/fairway-bridge.mjs`) if you prefer, and the source the program was built from. |

**This is a beta.** It plays and it is enjoyable to play, but it has not been
verified against every launch monitor or every device, and a weak graphics
card may struggle even on the Low setting.

## Licence

Fairway's own code and documentation are MIT licensed — see **LICENSE**. You
may share it, modify it and distribute it, provided the licence and the
third-party notices travel with it.

**THIRD_PARTY_NOTICES.txt** carries the notices for the components Fairway is
built on, including those for the Bun runtime inside run_fairway_server (and
how to rebuild that program yourself). **ATTRIBUTION.md** credits the imported
artwork, all of it CC0. The game's own notices are also inside Fairway.html,
under **Help → Open source & credits**.

GSPro, rēlā, Garmin, Rapsodo and PiTrac are named only to describe what
Fairway can talk to. All trade marks belong to their owners, and no
affiliation, endorsement or certification is claimed or implied.
