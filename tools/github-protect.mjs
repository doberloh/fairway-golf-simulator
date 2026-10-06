// `node tools/github-protect.mjs` -- puts the GitHub repository's safety settings
// in place, and says which ones it could not. Safe to run any number of times:
// every setting is written as a whole, and a ruleset is updated in place rather
// than added twice.
//
// RUN IT AGAIN THE MOMENT THE REPOSITORY GOES PUBLIC. GitHub Free offers branch
// rules, secret scanning's push protection and private vulnerability reporting
// only on public repositories, so while it is private those report "needs the
// repository public" and everything else is applied. The day it goes public is
// the day strangers can first see it, so that is when the rules must be on.
//
// Needs the GitHub CLI, signed in as the owner (`gh auth login`).
//
// What it sets, and why (AGENTS.md, *Pushing to GitHub*, has the short form):
//
// 1. main cannot be deleted, force-pushed or rewritten -- by anyone, the owner
//    included. A history rewrite is still possible: the owner switches the
//    "main keeps its history" ruleset off on GitHub, pushes, and switches it
//    back on. Making that a deliberate step is the point; the last two
//    rewrites were asked for, and the next one should be too.
// 2. Changes reach main through a reviewed pull request: one approval, by
//    someone other than whoever pushed last, with every review comment
//    resolved and stale approvals dropped when new commits arrive. The owner
//    (the repository's admins) may bypass it, which is how the owner's own
//    merges go up today, so the existing way of working is unchanged.
// 3. Release tags (v*) cannot be deleted or moved, so a download never
//    silently changes underneath a version number.
// 4. Pull requests merge with a merge commit only, matching the `--no-ff`
//    merges AGENTS.md asks for; squash and rebase merges are switched off.
// 5. Workflows: GitHub's own actions only; the token they get is read-only and
//    cannot approve pull requests; a first-time outside contributor's pull
//    request does not run any workflow until the owner approves it, so a
//    stranger cannot use the CI to run their code.
// 6. Dependabot alerts on, so a vulnerable dependency is reported; and, once
//    public, secret scanning blocks a push that contains a password or key,
//    and people can report a security problem privately.
//
// Deliberately NOT set: required status checks. The tests workflow has never
// run on GitHub (0 runs at the time of writing), and requiring a check that
// never reports would block every pull request. Add it once it has gone green
// there. Also not set: deleting merged branches (the owner's call) and
// immutable releases (a broken zip could then only be fixed by a new version).
import {spawnSync} from 'node:child_process';

const REPO = 'doberloh/fairway';
const GH = process.env.GH || 'gh';
const ADMIN = 5; // GitHub's id for the built-in "Repository admin" role

const api = (method, path, body) => {
 const r = spawnSync(GH, ['api', '-X', method, `repos/${REPO}${path}`, ...(body ? ['--input', '-'] : [])],
  {input: body ? JSON.stringify(body) : undefined, encoding: 'utf8'});
 let data = null; try { data = JSON.parse(r.stdout); } catch {}
 return {ok: r.status === 0, data, error: (data?.message || r.stderr || '').trim()};
};
const results = [];
// GitHub says "public only" in several ways, and for private vulnerability
// reporting just answers 404, so a setting marked publicOnly that fails on a
// private repository is reported as waiting rather than failed.
let isPrivate = false;
const step = (what, r, publicOnly = false) => {
 const pending = /make this repository public|Upgrade to GitHub Pro|not allowed for private|only available for public/i.test(r.error) || (publicOnly && isPrivate);
 results.push([r.ok ? 'done' : pending ? 'needs the repository public' : 'FAILED', what, r.ok || pending ? '' : r.error]);
};

const auth = spawnSync(GH, ['auth', 'status'], {encoding: 'utf8'});
if (auth.status !== 0) { console.error('The GitHub CLI is not signed in. Run: gh auth login'); process.exit(1); }
const repo = api('GET', '');
if (!repo.ok) { console.error(`Cannot read ${REPO}: ${repo.error}`); process.exit(1); }
isPrivate = repo.data.private;
console.log(`${REPO} is ${isPrivate ? 'PRIVATE: the public-only settings will wait' : 'public'}.
`);

step('Pull requests merge with a merge commit only', api('PATCH', '', {
 allow_merge_commit: true, allow_squash_merge: false, allow_rebase_merge: false,
 allow_auto_merge: false, delete_branch_on_merge: false,
}));
step('Workflows may use GitHub\'s own actions only', api('PUT', '/actions/permissions', {enabled: true, allowed_actions: 'selected'}));
step('...and those are: actions/* and github/*', api('PUT', '/actions/permissions/selected-actions', {github_owned_allowed: true, verified_allowed: false, patterns_allowed: []}));
step('Workflow token is read-only and cannot approve pull requests', api('PUT', '/actions/permissions/workflow', {default_workflow_permissions: 'read', can_approve_pull_request_reviews: false}));
step('Outside contributors\' workflows wait for the owner\'s approval', api('PUT', '/actions/permissions/fork-pr-contributor-approval', {approval_policy: 'all_external_contributors'}), true);
step('Dependabot alerts on', api('PUT', '/vulnerability-alerts'));
step('Secret scanning, and blocking pushes that contain a secret', api('PATCH', '', {security_and_analysis: {secret_scanning: {status: 'enabled'}, secret_scanning_push_protection: {status: 'enabled'}}}), true);
step('Security problems can be reported privately', api('PUT', '/private-vulnerability-reporting'), true);

// Rulesets: found by name and updated in place, so a second run never adds a copy.
const RULESETS = [
 {name: 'main keeps its history', target: 'branch', enforcement: 'active', bypass_actors: [],
  conditions: {ref_name: {include: ['~DEFAULT_BRANCH'], exclude: []}},
  rules: [{type: 'deletion'}, {type: 'non_fast_forward'}]},
 {name: 'main changes by reviewed pull request', target: 'branch', enforcement: 'active',
  bypass_actors: [{actor_id: ADMIN, actor_type: 'RepositoryRole', bypass_mode: 'always'}],
  conditions: {ref_name: {include: ['~DEFAULT_BRANCH'], exclude: []}},
  rules: [{type: 'pull_request', parameters: {required_approving_review_count: 1, dismiss_stale_reviews_on_push: true,
   require_code_owner_review: false, require_last_push_approval: true, required_review_thread_resolution: true,
   allowed_merge_methods: ['merge']}}]},
 {name: 'release tags are permanent', target: 'tag', enforcement: 'active', bypass_actors: [],
  conditions: {ref_name: {include: ['refs/tags/v*'], exclude: []}},
  rules: [{type: 'deletion'}, {type: 'non_fast_forward'}, {type: 'update'}]},
];
const existing = api('GET', '/rulesets');
for (const set of RULESETS) {
 if (!existing.ok) { step(`Ruleset: ${set.name}`, existing); continue; }
 const found = existing.data.find(r => r.name === set.name);
 step(`Ruleset: ${set.name}`, found ? api('PUT', `/rulesets/${found.id}`, set) : api('POST', '/rulesets', set));
}

const width = Math.max(...results.map(r => r[0].length));
for (const [state, what, error] of results) console.log(`${state.padEnd(width)}  ${what}${error ? `  -- ${error}` : ''}`);
process.exit(results.some(r => r[0] === 'FAILED') ? 1 : 0);
