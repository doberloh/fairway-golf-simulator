# Fairway installation, building and device setup

Updated September 25, 2026. These instructions describe the current source and release archives. For player controls, see [PLAYING.md](PLAYING.md). For architecture and maintenance, see PROJECT_HANDOFF.md, which is in the source archive and the repository rather than the portable one.

## Choose your setup

| What you want to do | What you need | Start here |
| --- | --- | --- |
| Play on a desktop or laptop | `Fairway-portable.zip` and a compatible browser | Portable app |
| Change the code or build your own release | `Fairway-source.zip`, Node.js and npm | Build from source |
| Play on a phone, tablet or another computer | Compatible browser and a computer serving the built app, or HTTPS static hosting | Phones, tablets and shared-network access |
| Use a launch monitor | Source package, Node.js and a device-specific Open Connect connector | Optional launch-monitor bridge |

Manual play does not require an account, commercial golf software or a launch monitor. There is one browser build for all device types; there are no separate Windows, Mac, Android or iOS binaries.

## Device support and requirements

**Compatibility is capability-based, not a certified device list.** Development and browser checks have been performed on macOS with Node 26 and the development environment’s embedded browser. The other platform routes below are intended or conditional installation paths, not claims that those devices have been physically tested. Direct file opening, physical controllers and launch-monitor hardware remain unverified.

| Device | Browser/run route | Building on that device | Status and limitations |
| --- | --- | --- | --- |
| Windows PC or Windows handheld | Current Edge, Chrome or Firefox; portable HTML or localhost server | Windows Node.js and PowerShell/Command Prompt | Intended desktop target; browser/GPU and controller checks still needed |
| Mac, Apple silicon or Intel | Current Safari, Chrome or Firefox; portable HTML or localhost server | Matching macOS Node.js and Terminal | Development host; standalone browser/file combinations still need testing |
| Linux desktop/laptop | Current Firefox or Chromium-based browser with working GPU drivers | Matching Linux Node.js and terminal | Intended desktop target; graphics support depends on distribution/drivers |
| Chromebook | Chrome; served app or locally opened built HTML where allowed | Optional Linux development environment | Conditional; school/work policy, GPU and memory can limit use |
| Android phone/tablet | Current Chrome-compatible browser opening the served app | Build on a desktop; no supported on-device build workflow | Conditional and untested; touch layout, GPU memory and performance need validation |
| iPhone/iPad | Current Safari opening the served app | Build on a desktop; no supported on-device build workflow | Conditional and untested; file previews are not the documented run route |

**Phones and tablets now have their own layout**, checked on every run of the browser smoke test at an iPad's and a phone's screen size, both ways up, including a whole hole played by touch. That test browser only emulates a phone: it proves everything fits and answers a tap, not how a particular phone's browser feels or how fast its graphics run. Those rows stay "untested" until someone plays on the real device.
| Steam Deck or similar Linux handheld | Desktop browser using the Linux route | Linux tools where available, or build elsewhere | Conditional and untested; no Steam package or verified built-in control mapping |
| Raspberry Pi/other small ARM computers | May serve the built HTML; rendering requires a capable browser/GPU | Matching supported Node.js/OS, or build elsewhere | Experimental; not a supported performance target or a verified monitor host |
| Smart TVs, consoles, VR headsets | No dedicated package or immersive mode | Build elsewhere | Not currently supported targets; use a desktop connected to a display instead |

The app requires JavaScript, modern ES2022 browser features and **WebGL 2** with hardware acceleration. It has no WebGL 1 fallback; its [Three.js renderer requires WebGL 2](https://threejs.org/docs/pages/WebGLRenderer.html). A display/projector connected to a computer needs no Fairway installation of its own.

There is no measured minimum RAM/GPU specification yet. Start with nine holes, fewer trees, houses off, and fewer waterways on smaller devices. Entire courses are generated locally; generation can temporarily pause the page. Serving from a powerful PC does **not** move rendering or physics off the receiving phone/tablet.

## Portable app: no build required

1. Extract `Fairway-portable.zip` into a normal folder. Keep the included documentation and third-party notices with it.
2. Open the extracted **Fairway.html** in a compatible desktop browser. Use the file’s **Open with** menu if double-click opens an editor or preview app. Do not open the HTML while it is still inside the ZIP.
3. Generate a course, select your players and tee, and play. The built file contains the app, graphics and physics; no Node.js installation is needed for this route.
4. If direct-file opening is blocked, the scene stays blank, or saves behave inconsistently, use the local HTTP fallback below.

When building from source, the equivalent portable file is **dist/index.html**. The **index.html at the source root is not the portable app** and must be served by Vite during development.

Once the built file is on the computer, ordinary manual play can run without internet access. File-mode storage varies between browsers, so export important rounds.

### Local HTTP fallback for the portable ZIP

If Python 3 is installed, open a terminal **inside the extracted portable folder** and run one of these commands. Python is optional and not required when using the Node preview route later.

Windows:

```powershell
py -3 -m http.server 8000 --bind 127.0.0.1
```

macOS/Linux:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/Fairway.html` in your browser. Leave the terminal running; **Ctrl+C** stops the server. If port 8000 is occupied, choose another port and use it in the URL. These commands serve the current folder only on the same computer, using [Python’s built-in HTTP server](https://docs.python.org/3/library/http.server.html).

## Build from source

### Install tools for your operating system

Install a maintained Node.js release **22.12 or newer**, with npm, from the [official Node.js download page](https://nodejs.org/en/download). Match the package to your OS and processor: for example, macOS ARM64 for Apple silicon or x64 for an Intel Mac. Development used Node 26. The pinned Vite package’s engine range is `^20.19.0 || >=22.12.0`; this guide uses the project’s 22.12+ baseline. See [Vite’s requirements](https://vite.dev/guide/).

- **Windows:** install the matching Node package, then open a new PowerShell or Command Prompt window so it sees the updated PATH.
- **macOS:** install the matching Node package, then open Terminal.
- **Linux:** use the installation method offered by Node for your architecture/distribution, then open a terminal. Check the version rather than assuming the distribution’s default package is recent enough.
- **ChromeOS:** enable the Linux development environment, move/extract the source under Linux files, and follow the Linux commands in Terminal. Availability and managed-device restrictions are described in [Google’s Linux setup guide](https://support.google.com/chromebook/answer/9145439?hl=en). Run the finished app in Chrome on ChromeOS; a browser inside the Linux environment can have different graphics limitations. If localhost forwarding fails, copy `dist/index.html` into Downloads and use the portable route or serve it from another computer.
- **Phones/tablets:** build on Windows, macOS or Linux, then serve the result using the next section. Installing Node or vendor monitor software on the phone/tablet is not part of this project’s supported workflow.

Check the tools:

```sh
node --version
npm --version
```

### Extract, install and build

Extract `Fairway-source.zip` into a writable folder. Open a terminal there, or change into the extracted directory; the folder must contain `package.json` and `package-lock.json`. If the path contains spaces, quote it. Git is not required for the ZIP route.

The following commands are the same on Windows, macOS and Linux:

```sh
npm ci
npm run build
npm run preview -- --port 4173 --strictPort
```

Open **http://127.0.0.1:4173/**. Leave preview running while using that address; stop it with **Ctrl+C**. Re-run `npm run build` after source changes before using preview. Vite preview is for local checking, not a public production server.

`npm ci` downloads the pinned dependencies and needs internet access unless already cached. The lockfile uses the public Yarn registry mirror; do not disable certificate checks if a network blocks it. Keep the lockfile and package integrity checks. After dependencies are installed, the build itself does not need external assets. Re-run `npm ci` when adopting a release with changed dependencies. Do not copy `node_modules` between operating systems or CPU architectures.

If PowerShell blocks `npm.ps1`, use **npm.cmd** in place of **npm**, or run the commands in Command Prompt. No execution-policy change is required for that workaround.

Successful output is **dist/index.html**, approximately 15.8 MB -- most of it the generated redwood forest, which ships at full detail. Copy that file to another compatible device; it can be renamed `Fairway.html`. Distribute it with the included notices and documentation. The source ZIP does not contain installed dependencies or a prebuilt `dist` folder; use the portable ZIP if you only want to play.

### Development and tests

For live source editing:

```sh
npm run dev
```

Open the URL printed by Vite, normally **http://127.0.0.1:5173/**. If the port is busy, Vite may select another. This command is loopback-only by default. Stop with **Ctrl+C**.

Run the automated suites from the source folder:

```sh
npm test
```

To play the built file in a real browser the way a player would -- menus, a
hole from tee to holed putt, a round, the range, the studio -- run the smoke
test. It needs Playwright's Chromium, which `npm ci` does not download, so the
first time:

```sh
npx playwright install chromium
npm run smoke
```

The bridge tests bind temporary local ports; restricted environments may block them. Tests do not establish hardware/device compatibility. The graphics/gameplay-only command and release checklist are in [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md). Rebuilding does not automatically refresh the two distributable ZIPs.

## Phones, tablets and shared-network access

This route serves the built app to another browser. Each browser runs its **own** course/round; this is not synchronized multiplayer or a remote control for the desktop. Up to four golfers share one app session through the game’s player settings.

### On an iPhone or iPad: host it, then add it to the home screen

**The easiest way onto an iPhone.** iOS will not run an HTML file from the
Files app, so a phone needs the game at a web address. Once it has one, it can
live on the home screen like an app.

1. **Put `dist/` on a free static host.** After `npm run build`, the `dist`
   folder holds the game (`index.html`) and, beside it, the home-screen icons
   and `manifest.webmanifest`. Upload the **whole folder**. Netlify Drop is the
   quickest: drag the folder onto its page and you get an `https://` address in
   about a minute. Cloudflare Pages and, once the repository is public, GitHub
   Pages work the same way. Anyone with the address can open it.
2. **Open that address in Safari on the phone.**
3. **Tap Share, then Add to Home Screen.** The icon it adds opens Fairway full
   screen, without Safari's address bar, with the phone's status bar kept
   visible above it. The game's menu says this too, once, the first time an
   iPhone or iPad opens it in a browser.

On Android, Chrome offers **Install app** from its menu for the same address;
Chrome's own install check reports the game as installable.

**A password-protected site works.** If you keep the site private -- Netlify's
password protection, say -- nothing the home screen needs is fetched without
your login: the icon is inside the page and the manifest asks to carry the
login. Two things to know. The home-screen app keeps **its own** login,
separate from Safari's, so the first time you open it from the home screen it
asks for the password once. And it keeps its own saved rounds, so a round
saved while playing in Safari does not appear in the home-screen app.

If the home-screen icon comes out as a screenshot of the page, delete it and
add it again; iOS remembers the first icon it took for an address. If it is
still a screenshot, clear the site's stored data in Safari's settings and add
it once more. The icon built into the page is confirmed working on an iPhone,
behind Netlify's password protection.

What it does not do yet: **it needs a connection each time it opens** -- it
does not work offline. The controls keep clear of an iPhone's notch, rounded
corners and home bar in either orientation; that is built to Apple's safe-area
measurements and not yet confirmed on a real phone. **A launch monitor
cannot connect from a phone this way**: a secure `https://` page is not allowed
to open the bridge's unencrypted connection on your network. To play with a
monitor on a phone, load the game from the bridge instead of from the hosted
copy -- see *To play from a phone or tablet on your own network* below. On a
phone without one, Fairway is touch play: an aim pad for fine adjustment, a map that opens big
and pinches to zoom, and controls sized for a thumb.

The portable file is unchanged by any of this. Opened from disk, it links no
manifest and makes no network requests.

### Serve from a desktop on the same network

On the host computer, complete the source build above. Then, from the source folder:

```sh
npm run preview -- --host 0.0.0.0 --port 4173 --strictPort
```

1. Keep the host and receiving device on the same trusted Wi-Fi/LAN. Keep the host awake and the terminal running.
2. Find the host’s local IPv4 address in its network settings. On Windows, `ipconfig` also lists it; use the address for the active Wi-Fi/Ethernet adapter.
3. On Android, iPhone, iPad, Chromebook or the other computer, open `http://HOST_IP:4173/`, replacing `HOST_IP` with that address. For example, if the host is `192.168.1.50`, use `http://192.168.1.50:4173/`. **127.0.0.1 on a phone means the phone, not your PC.**
4. If prompted, allow the host application’s access only on your trusted/private network. Guest Wi-Fi isolation or an organizational policy may prevent devices from reaching each other. No router port forwarding is needed.
5. Use landscape orientation on touch devices. Use on-screen aim, shot and free-flight controls; every panel can be dragged by its grip and resized from its corner at any time, and *Reset panel layout* in the tools tray puts them back. A mouse/keyboard remains useful on tablets. Fullscreen availability depends on the browser.

This binds the static preview to all host interfaces. Stop it when finished; do not expose Vite preview to the public internet. The receiving device still needs enough GPU/memory to generate and render the course. No internet connection is needed once the files/dependencies are available, but the local network and host must remain available for page loads.

Alternatively, place the built HTML on an **HTTPS static host** as `index.html` and visit its URL. No application backend is needed for manual play. Only publish the built file and intended release documents, not the source/dependency directory. Hosting is a separate choice; no site is deployed by these instructions.

The app has no service worker or installable PWA package. A browser bookmark/home-screen shortcut is not a guarantee of offline reopening. iOS/Android local-file preview tools may not execute the full app; the served-browser route avoids relying on them.

## Mouse, touch and controllers

Mouse/keyboard and on-screen controls are available without device drivers specific to Fairway. Basic controls are Space to shoot, arrow keys to aim/change power, Q/E to select clubs, V for free flight, and Escape to close a panel/end a flyover. Full controls are in README.md.

For a controller, connect it through the operating system by USB or Bluetooth, focus the app and press a button. Fairway reads the first controller the browser exposes with the standard mapping. The [browser Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API) and operating system determine which controllers are exposed; physical models have not been verified here.

For controller testing, prefer localhost on the same computer or a trusted HTTPS site. A plain HTTP LAN URL is not a secure context and some browser features may be restricted; [MDN explains the localhost/HTTPS distinction](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts). Use touch/mouse on the LAN route if the controller is unavailable. Do not disable browser security to enable it.

## Optional launch-monitor bridge: desktop only

Skip this section for manual play. The source package includes a Node bridge; the portable HTML alone cannot listen for raw TCP shots. Monitor-specific connector software and vendor requirements are separate, and physical device testing remains deferred. Windows, macOS and Linux can run the Node bridge when their connector software supports that OS; this is not a promise that every connector supports every OS.

From the source folder, after `npm ci` and `npm run build`:

```sh
npm run bridge
```

1. On **the same computer**, open **http://127.0.0.1:1922/**.
2. In **Connect monitor**, connect to **ws://127.0.0.1:1922** and enable **Arm monitor for live shots**.
3. Configure the device’s existing Open Connect v1 connector to send to **127.0.0.1, TCP port 1921**. Select the club/aim in Fairway.
4. Keep the bridge terminal running. Stop it with **Ctrl+C**. Only one browser can control the bridge at a time.

### When a connector will not talk

Run the bridge with per-message logging. This works in any shell:

```sh
npm run bridge:debug
```

It prints every raw payload in, every reply code out, device connects and disconnects, browser arm state, and — the useful one — each shot **decoded into the units a person reads**:

```
device connected from 127.0.0.1:50819 (1 open)
<- device raw {"DeviceID":"Probe","Units":"Meters","BallData":{"Speed":244,"BackSpin":3400,...}}
   shot #2 from Probe: 151.6 mph 8.0° launch 0.0° dir 3408 rpm axis -4.0°
-> device 503 Simulator not ready; arm monitor and finish current shot.
```

Wrong units and swapped spin fields both look correct in the raw JSON and only show up on the decoded line. A rejected message prints the reason beside the payload that caused it, and note that a **501 closes the socket** — a connector that reconnects in a loop is usually hitting one.

`FAIRWAY_LOG=debug` does the same thing. `npm run bridge:debug` is preferred because the environment-variable prefix form is bash syntax and PowerShell rejects it.

To play from a phone or tablet on your own network, bind the browser-facing server to your LAN address as well:

```sh
FAIRWAY_HTTP_HOST=192.168.1.50 npm run bridge
```

PowerShell:

```powershell
$env:FAIRWAY_HTTP_HOST = "192.168.1.50"; npm run bridge
```

Then open `http://192.168.1.50:1922` on the phone. The bridge accepts browsers on loopback and on the private ranges 10.x, 172.16–172.31.x and 192.168.x, and refuses everything else. **It is not authenticated**: anything on your network that can reach that port can drive the simulator, so keep it off networks you do not control. Only one browser holds the bridge at a time — a second tab is refused until the first closes. A public HTTPS-hosted copy is also not the documented bridge client. No direct proprietary Bluetooth, USB-driver integration or vendor applications are included.

If the connector requires a different port, use its configurable high-numbered port when possible. Example using TCP 1923 and HTTP/WebSocket 1924:

macOS/Linux:

```sh
FAIRWAY_TCP_PORT=1923 FAIRWAY_HTTP_PORT=1924 npm run bridge
```

Windows PowerShell:

```powershell
$env:FAIRWAY_TCP_PORT = "1923"
$env:FAIRWAY_HTTP_PORT = "1924"
npm run bridge
```

Windows Command Prompt:

```bat
set FAIRWAY_TCP_PORT=1923
set FAIRWAY_HTTP_PORT=1924
npm run bridge
```

Use `http://127.0.0.1:1924/`, `ws://127.0.0.1:1924` and connector TCP port 1923 for that example. PowerShell/Command Prompt variables last for that terminal session; open a fresh terminal to return to defaults. Port 921 may need OS-specific privileged-port configuration on macOS/Linux; do not assume it will work just by changing the number.

For a connector on another computer, README.md explains **FAIRWAY_TCP_HOST**. Bind only the connector-facing TCP listener to the desktop’s trusted LAN address, configure the remote connector to use that address, and keep the Fairway browser on the bridge computer. TCP Open Connect has no authentication or encryption; keep it off public networks. This guide does not change the bridge’s browser-origin restrictions.

## Saves, upgrades and removal

- Automatic round saves belong to the browser profile and app address. `file:`, `localhost`, `127.0.0.1`, another port, and another device do not share one save.
- Before transferring/upgrading, use **Players and round → Export saved round**. Copy the JSON to the new device and choose **Import saved round** there. Last-shot replay is session-only. Arranged UI layout is stored separately and is not transferred by round export.
- Keep a copy of the old HTML and save when upgrading. Generator changes can alter a seed’s terrain; exact old geometry is not currently versioned in saves.
- To remove Fairway, stop any running server and delete the extracted app/source folders. Browser site data can be cleared separately after exporting anything you want to keep. Node/Python are shared tools and need not be removed.

## Troubleshooting and first-run check

| Symptom | What to check |
| --- | --- |
| Blank scene or graphics error | Use a current browser, enable hardware acceleration where available, and update OS/GPU drivers. Confirm WebGL 2 works. Try the built app via localhost rather than a file preview. |
| Browser reloads or becomes very slow | Start with nine holes and fewer trees/waterways/houses; close other heavy tabs and lower the display resolution if needed. Generation is synchronous and may take several seconds. |
| `npm`/`node` not found | Install Node with npm, reopen the terminal and check PATH/version. |
| `package.json` missing | Change into the extracted source folder, not the portable folder or its parent. |
| Unsupported Node/engine error | Use a maintained Node release at least 22.12; rerun `npm ci` with that runtime. |
| Missing native dependency after copying files | Install dependencies on the destination OS/architecture with `npm ci`; do not reuse another system’s `node_modules`. |
| Dependency download/certificate failure | Check access to the lockfile’s registry through your normal network/proxy. Keep TLS verification and package integrity checks enabled. |
| Port already in use | Stop your previous server or choose a free port and update the URL/connector settings. |
| Phone cannot connect | Check host IP, same LAN, host awake, preview still running, private-network firewall access and guest-network isolation. Use the host IP, not localhost. |
| Controller missing | Focus the page, press a controller button, check OS pairing/standard mapping and try localhost/HTTPS. |
| Bridge connected but no shots | Check separate device status, connector destination/port, armed state and that no flight, tour or hole-selection state is blocking shots. See README.md for connector details. |
| Apparent missing save | Return to the same browser/profile/address or import an exported JSON; private browsing and cleared site data do not retain ordinary saves reliably. |

For a first run, generate a nine-hole course, take a manual shot, check live shot distance, run a hole flyover and return to the ball. Export a round, reload the same address, and verify that the round is retained or can be imported. These checks should be repeated on each new device/browser; building successfully does not verify its graphics or input hardware.

## Sharing a build

Fairway’s own source and documentation use the MIT license in `LICENSE`; third-party terms are in `THIRD_PARTY_NOTICES.txt`. The portable HTML embeds both in **Help → Open source & credits**. Preserve these notices when sharing. Optional donations are permitted by the reviewed software licenses; a donation account or payment service is not included. See [DISTRIBUTION_REVIEW.md](DISTRIBUTION_REVIEW.md) for scope and outstanding checks.

To refresh release downloads, run `npm run release`. It rebuilds first so it cannot package a stale build, then cuts and verifies both archives. It needs Python 3.9 or newer and finds it whether the command is `python3`, `python` or `py`; if none is installed it says so and stops, and `npm run build` on its own has already produced the playable file. It creates `Fairway-portable.zip`, `Fairway-source.zip` and `RELEASE_SHA256.txt`, and checks their contents. This packaging step is optional for players and separate from the Node build. The source ZIP includes the script.
