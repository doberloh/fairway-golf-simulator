// `npm run release` -- find a Python, run the packager, pass its verdict on.
//
// The packager is Python because it is the only part of the toolchain that is,
// and rewriting it in Node to save this file would throw away the one script
// in the project with a real verification pass in it.
//
// WHY THIS IS NOT JUST `python tools/package_release.py` IN package.json.
// The interpreter is called something different on every platform this is
// built on: `py` is the Windows launcher, Debian and its descendants removed
// plain `python` years ago and only ship `python3`, and macOS has had all
// three at various times. A script naming one of them works for whoever wrote
// it and fails for the next person.
//
// The obvious shell answer, `python3 ... || python ... || py ...`, is worse
// than useless: it cannot tell "this interpreter does not exist" from "the
// packaging FAILED", so a genuine failure -- a stale build, a missing notice,
// a dependency inventory that disagrees with the lockfile -- silently runs the
// packager again under a different name and reports whatever the last attempt
// said. The packager exists to refuse loudly. Hiding its refusal defeats it.
//
// So: probe for an interpreter first, with --version, which is cheap and
// cannot package anything. Then run the packager exactly once, under the one
// that answered, and exit with ITS code.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const SCRIPT = path.join(ROOT, 'tools', 'package_release.py');
const CANDIDATES = ['python3', 'python', 'py'];

const found = CANDIDATES.find(name => {
 // `shell: true` so Windows resolves the .exe and the py launcher shim.
 const probe = spawnSync(name, ['--version'], {stdio: 'ignore', shell: true});
 return probe.status === 0;
});

if (!found) {
 console.error('Cannot package: no Python 3 interpreter found.');
 console.error(`Tried: ${CANDIDATES.join(', ')}.`);
 console.error('');
 console.error('Python is needed ONLY for cutting the release archives.');
 console.error('`npm run build` has already produced dist/index.html, which is');
 console.error('the game, and it needs nothing but Node. Install Python 3.9 or');
 console.error('newer if you want the ZIPs and their checksums.');
 process.exit(127);
}

const run = spawnSync(found, [SCRIPT], {stdio: 'inherit', shell: true});
// A signal leaves status null. Report something non-zero rather than a
// cheerful exit, or CI will call a killed packaging run a success.
process.exit(run.status === null ? 1 : run.status);
