"""Package the already-built app with source, notices and documentation (Python 3).

EVERY READ AND WRITE NAMES ITS ENCODING. Python takes the platform default
otherwise, which on Windows is cp1252, and the built HTML stopped being pure
ASCII the moment mesh data was embedded in it -- the packager died on byte
0x9d of a 15 MB file. The build is UTF-8; say so rather than inheriting it.
"""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
# ATTRIBUTION.md IS NOT OPTIONAL. DISTRIBUTION_REVIEW.md ships in both archives
# and points at it by name for the CC0 model-pack credits and the baked-tree
# provenance -- so an archive without it cites a document it does not contain,
# which is worse than not citing one. It was missing until 25 September 2026,
# which is the whole reason this comment exists.
#
# Working documents stay out on purpose: a night's engineering log and a
# speculative product study are not part of what somebody was handed to play.
DOCS = [
    'LICENSE', 'THIRD_PARTY_NOTICES.txt', 'ATTRIBUTION.md', 'DISTRIBUTION_REVIEW.md',
    'DEPENDENCY_INVENTORY.json', 'INSTALLATION.md', 'README.md',
    'PROJECT_HANDOFF.md', 'TODO.md', 'AGENTS.md', 'PROCEDURAL_GENERATION.md',
    'RESEARCH.md', 'LANDSCAPE_RESEARCH.md', 'BALL_BEHAVIOUR_KNOBS.md', 'REFERENCES.md',
]
ROOT_SOURCE = ['package.json', 'package-lock.json', 'vite.config.js', 'index.html']
DIRECTORIES = {'src': {'.js', '.css'}, 'tests': {'.mjs'}, 'bridge': {'.mjs'}, 'tools': {'.py'}}


def main():
    html_path = ROOT / 'dist/index.html'
    html = html_path.read_text(encoding='utf-8')
    files = [ROOT / name for name in DOCS + ROOT_SOURCE]
    for directory, suffixes in DIRECTORIES.items():
        files.extend(p for p in sorted((ROOT / directory).rglob('*'))
                     if p.is_file() and p.suffix in suffixes
                     and not any(part.startswith('.') or part == '__pycache__'
                                 for part in p.relative_to(ROOT).parts))
    for path in files:
        if not path.is_file() or path.is_symlink():
            raise SystemExit(f'Missing or symlinked release input: {path.name}')
    inputs = [ROOT / n for n in ROOT_SOURCE + ['LICENSE', 'THIRD_PARTY_NOTICES.txt']]
    inputs.extend(p for p in files if p.is_relative_to(ROOT / 'src'))
    if any(p.stat().st_mtime_ns > html_path.stat().st_mtime_ns for p in inputs):
        raise SystemExit('Source or licenses changed since build. Run npm run build first.')
    for marker in ['Fairway contributors', 'Copyright (c) 2024 bryc',
                   'Copyright (c) 2024, Mapbox', 'Lucide Icons and Contributors',
                   'Missing Deadlines (Benjamin Wrensch)', 'Apache License',
                   'Third-party licenses & credits']:
        if marker not in html:
            raise SystemExit(f'Missing embedded notice: {marker}')
    lock = json.loads((ROOT / 'package-lock.json').read_text(encoding='utf-8'))['packages']
    inventory = json.loads((ROOT / 'DEPENDENCY_INVENTORY.json').read_text(encoding='utf-8'))['packages']
    if {p['path']: (p['version'], p['declaredLicense'], p['integrity']) for p in inventory} != {
        k: (v['version'], v.get('license', 'UNKNOWN'), v.get('integrity'))
        for k, v in lock.items() if k
    }:
        raise SystemExit('Dependency inventory is stale. Update it and review notices.')
    packages = {
        'Fairway-portable.zip': [(html_path, 'Fairway.html')] + [(ROOT / n, n) for n in DOCS],
        'Fairway-source.zip': [(p, p.relative_to(ROOT).as_posix()) for p in files],
    }
    for name, entries in packages.items():
        target = ROOT / name
        with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
            for path, destination in entries:
                archive.write(path, destination)
        with zipfile.ZipFile(target) as archive:
            if archive.testzip() is not None:
                raise SystemExit(f'ZIP integrity check failed: {name}')
            for path, destination in entries:
                if archive.read(destination) != path.read_bytes():
                    raise SystemExit(f'Archive contents differ: {destination}')
        print(f'{name}: {len(entries)} verified files, {target.stat().st_size:,} bytes')
    artifacts = [ROOT / n for n in packages] + [html_path]
    (ROOT / 'RELEASE_SHA256.txt').write_text(''.join(
        f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(ROOT).as_posix()}\n'
        for p in artifacts), encoding='utf-8', newline='\n')
    print('Wrote RELEASE_SHA256.txt')


if __name__ == '__main__':
    main()
