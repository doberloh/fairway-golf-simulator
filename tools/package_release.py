"""Package the already-built app with source, notices and documentation (Python 3).

EVERY READ AND WRITE NAMES ITS ENCODING. Python takes the platform default
otherwise, which on Windows is cp1252, and the built HTML stopped being pure
ASCII the moment mesh data was embedded in it -- the packager died on byte
0x9d of a 15 MB file. The build is UTF-8; say so rather than inheriting it.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
# WHAT A CUSTOMER GETS, AND WHAT THEY DO NOT.
#
# The portable archive is the PRODUCT. It carries the game, how to open it, how
# to play it, and the notices that must travel with it -- and nothing else.
# Everything below `PORTABLE` used to ship with it: the architecture handoff,
# the open TODO list with every known defect on it, the research measurements,
# the provenance review, the dependency inventory, and AGENTS.md, which is the
# internal engineering process document including write-ups of past failures.
# None of that is anything somebody who paid for a golf game needs, and a
# defect list is an odd thing to hand over unasked.
#
# ATTRIBUTION.md IS NOT OPTIONAL in either archive. It carries the CC0
# model-pack credits and the baked-tree provenance, and the MIT notice for
# ez-tree's output has to travel with the geometry it produced.
#
# LICENSE and THIRD_PARTY_NOTICES.txt are the obligations. They are also
# embedded inside the HTML itself, under Help, so copying just the file keeps
# them -- but a licence that only exists inside the thing it licenses is a
# worse answer than one sitting beside it.
#
# THE PORTABLE ARCHIVE GETS ITS OWN README, not the repository's. The root
# README.md is a front door for a developer looking at a source tree: it links
# into `docs/`, talks about `npm ci`, and lists directories the archive does
# not contain. Handing that to somebody who unzipped a game gives them a page
# of dead links. `docs/PORTABLE_README.md` is written for the person holding
# the ZIP and says one useful thing first: double-click Fairway.html.
#
# THE PORTABLE ARCHIVE IS FLAT. Its five documents keep their own names at the
# top of the ZIP even though four of them live under `docs/` in the repository:
# somebody who unzips a game does not want to open a folder to find out how to
# start it. Each entry is (path in this repository, name inside the archive).
#
# INSTALLATION.md is NOT in it (1 October 2026). It is the build-from-source and
# developer guide -- npm, Vite, the source tree -- and handed to somebody who
# unzipped a game it was a long page about tools they do not have. Everything a
# player needs to set up is in the README, and the controls are in PLAYING.md.
# It ships in the source archive.
PORTABLE = [
    ('LICENSE', 'LICENSE'),
    ('docs/THIRD_PARTY_NOTICES.txt', 'THIRD_PARTY_NOTICES.txt'),
    ('docs/ATTRIBUTION.md', 'ATTRIBUTION.md'),
    ('docs/PORTABLE_README.md', 'README.md'),
    ('docs/PLAYING.md', 'PLAYING.md'),
]
# ONE DOWNLOAD PER PLATFORM, each carrying run_fairway_server for it (1 October
# 2026). The server used to ship as a bundle needing Node.js plus a start script
# per platform; now it is one program with nothing to install, compiled with Bun
# by tools/build-server.mjs into release/server/<platform>/. Anybody downloading
# Fairway is setting up a launch monitor, so the server is the front door: run
# it, open the link it prints. Fairway.html still opens on its own for play
# without one.
#
# The plain bundle the program was built from ships too, in server-source/: the
# LGPL obligation for the JavaScriptCore inside Bun (THIRD_PARTY_NOTICES.txt),
# and a way to run the server with Node.js for anyone who prefers it.
PLATFORMS = [
    ('Fairway-Windows.zip', 'windows', 'run_fairway_server.exe'),
    ('Fairway-macOS-AppleSilicon.zip', 'macos-apple', 'run_fairway_server'),
    ('Fairway-macOS-Intel.zip', 'macos-intel', 'run_fairway_server'),
    ('Fairway-Linux.zip', 'linux', 'run_fairway_server'),
]
SERVER_SOURCE = 'server-source/fairway-bridge.mjs'
# A program for macOS or Linux must be executable, and a ZIP only says so if the
# entry carries Unix permissions -- archive.write copies the Windows file's,
# which have no execute bit.
EXECUTABLE = {'run_fairway_server'}
OUT = ROOT / 'release'

# The source archive is for somebody who is going to READ or BUILD the thing,
# so it keeps everything the portable one drops, and it keeps the repository's
# own layout so that a path written in a document still points at the file it
# names once the ZIP is unpacked.
DOCS = [path for path, _ in PORTABLE] + [
    'docs/INSTALLATION.md',
    'README.md', 'CONTRIBUTING.md', 'AGENTS.md', 'docs/README.md',
    'docs/DISTRIBUTION_REVIEW.md', 'docs/DEPENDENCY_INVENTORY.json',
    'docs/ARCHITECTURE.md', 'docs/PROJECT_HANDOFF.md', 'docs/TODO.md',
    'docs/PROCEDURAL_GENERATION.md', 'docs/RESEARCH.md',
    'docs/LANDSCAPE_RESEARCH.md', 'docs/BALL_BEHAVIOUR_KNOBS.md',
    'docs/REFERENCES.md',
]
ROOT_SOURCE = ['package.json', 'package-lock.json', 'vite.config.js', 'index.html']
# `tools` used to ship its Python packager alone, which left the source
# archive carrying a package.json whose scripts -- bench, profile, gpu,
# assets, grove -- all pointed at files that were not in it. The .mjs tools
# ship now. Some of them still cannot RUN from the archive, because
# `vendor/` is several hundred megabytes of model packs and is in neither
# archive; that is a deliberate limit and is recorded in DISTRIBUTION_REVIEW.
# `public` holds what the build copies beside the page for a HOSTED copy -- the
# home-screen icons and the manifest -- and a source archive without it builds a
# game that installs to a phone with no icon.
DIRECTORIES = {'src': {'.js', '.css'}, 'tests': {'.mjs'}, 'bridge': {'.mjs'},
               'tools': {'.py', '.mjs', '.js'}, 'public': {'.png', '.webmanifest'}}


# WHAT COUNTS AS SOURCE IS WHAT GIT TRACKS, not whatever sits on disk.
#
# This used to glob each directory by extension, so anything lying in the
# working tree went into the archive -- three untracked scratch scripts in
# `tools/` did, turning 163 files into 166, found only because the count
# looked wrong. A release is a statement about the project, and an untracked
# file is by definition not part of it.
#
# Tracked files are packaged with their working-tree CONTENT, deliberately:
# `dist/index.html` is built from the working tree, and an archive whose
# source disagreed with the build shipped beside it would be worse.
#
# Somebody building from the source archive has no repository at all. That is
# a normal way to build this, so it falls back to the glob -- and an archive
# unpacked from a release contains only what that release shipped, so the
# glob cannot pick up strays there.
def tracked_files():
    try:
        out = subprocess.run(['git', 'ls-files', '-z'], cwd=ROOT, capture_output=True, check=True).stdout
    except (OSError, subprocess.CalledProcessError):
        return None
    return {ROOT / Path(p.decode('utf-8')) for p in out.split(bytes(1)) if p}


def main():
    html_path = ROOT / 'dist/index.html'
    html = html_path.read_text(encoding='utf-8')
    files = [ROOT / name for name in DOCS + ROOT_SOURCE]
    tracked = tracked_files()
    for directory, suffixes in DIRECTORIES.items():
        files.extend(p for p in sorted((ROOT / directory).rglob('*'))
                     if p.is_file() and p.suffix in suffixes
                     and (tracked is None or p in tracked)
                     and not any(part.startswith('.') or part == '__pycache__'
                                 for part in p.relative_to(ROOT).parts))
    if tracked is None:
        print('Not a git checkout: packaging every source file on disk.')
    for path in files:
        if not path.is_file() or path.is_symlink():
            raise SystemExit(f'Missing or symlinked release input: {path}')
    bundle_path = ROOT / 'dist/fairway-bridge.mjs'
    if not bundle_path.is_file():
        raise SystemExit('No bridge bundle in dist/. Run npm run build first.')
    bridge_inputs = [ROOT / 'bridge/server.mjs'] + [p for p in files if p.is_relative_to(ROOT / 'src')]
    if any(p.stat().st_mtime_ns > bundle_path.stat().st_mtime_ns for p in bridge_inputs):
        raise SystemExit('The bridge or the physics changed since the bridge was bundled. Run npm run build first.')
    inputs = [ROOT / n for n in ROOT_SOURCE + ['LICENSE', 'docs/THIRD_PARTY_NOTICES.txt']]
    inputs.extend(p for p in files if p.is_relative_to(ROOT / 'src'))
    if any(p.stat().st_mtime_ns > html_path.stat().st_mtime_ns for p in inputs):
        raise SystemExit('Source or licenses changed since build. Run npm run build first.')
    for marker in ['Dustin Oberloh', 'Copyright (c) 2024 bryc',
                   'Copyright (c) 2024, Mapbox', 'Lucide Icons and Contributors',
                   'Missing Deadlines (Benjamin Wrensch)', 'Apache License',
                   'Copyright (c)2014 David Hoskins', 'Copyright (c) 2014 stackgl contributors',
                   'Third-party licenses & credits']:
        if marker not in html:
            raise SystemExit(f'Missing embedded notice: {marker}')
    lock = json.loads((ROOT / 'package-lock.json').read_text(encoding='utf-8'))['packages']
    inventory = json.loads((ROOT / 'docs/DEPENDENCY_INVENTORY.json').read_text(encoding='utf-8'))['packages']
    if {p['path']: (p['version'], p['declaredLicense'], p['integrity']) for p in inventory} != {
        k: (v['version'], v.get('license', 'UNKNOWN'), v.get('integrity'))
        for k, v in lock.items() if k
    }:
        raise SystemExit('Dependency inventory is stale. Update it and review notices.')
    servers = {}
    for _, platform, program in PLATFORMS:
        path = OUT / 'server' / platform / program
        if not path.is_file():
            raise SystemExit(f'No {path.relative_to(ROOT).as_posix()}. Run npm run server first.')
        if path.stat().st_mtime_ns < bundle_path.stat().st_mtime_ns:
            raise SystemExit(f'{path.relative_to(ROOT).as_posix()} is older than the bridge bundle. Run npm run server.')
        servers[platform] = path
    common = [(html_path, 'Fairway.html')] + [(ROOT / p, n) for p, n in PORTABLE] + [(bundle_path, SERVER_SOURCE)]
    packages = {name: [(servers[platform], program)] + common for name, platform, program in PLATFORMS}
    packages['Fairway-source.zip'] = [(p, p.relative_to(ROOT).as_posix()) for p in files]
    OUT.mkdir(exist_ok=True)
    for name, entries in packages.items():
        target = OUT / name
        with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
            for path, destination in entries:
                if destination in EXECUTABLE:
                    info = zipfile.ZipInfo.from_file(path, destination)
                    info.external_attr = (0o100755 << 16)
                    info.compress_type = zipfile.ZIP_DEFLATED
                    archive.writestr(info, path.read_bytes())
                else:
                    archive.write(path, destination)
        with zipfile.ZipFile(target) as archive:
            if archive.testzip() is not None:
                raise SystemExit(f'ZIP integrity check failed: {name}')
            for path, destination in entries:
                if archive.read(destination) != path.read_bytes():
                    raise SystemExit(f'Archive contents differ: {destination}')
        print(f'{name}: {len(entries)} verified files, {target.stat().st_size:,} bytes')
    artifacts = [OUT / n for n in packages] + [html_path]
    (OUT / 'RELEASE_SHA256.txt').write_text(''.join(
        f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(ROOT).as_posix()}\n'
        for p in artifacts), encoding='utf-8', newline='\n')
    print('Wrote release/RELEASE_SHA256.txt')


if __name__ == '__main__':
    main()
