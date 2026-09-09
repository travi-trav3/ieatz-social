'use strict';
// Copies a staged tree into the website repo checkout, commits, and pushes
// to the production branch, or to a review branch with a PR while
// pages.requireReview is on. Git-connected Cloudflare Pages deploys the
// production branch on push; nothing else is needed. If pushes are refused,
// stop and report. No workaround.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function git(repo, args, opts = {}) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
}

function copyTree(src, dst) {
  const out = [];
  const walk = (rel) => {
    const abs = path.join(src, rel);
    if (fs.statSync(abs).isDirectory()) { for (const e of fs.readdirSync(abs)) walk(path.join(rel, e)); return; }
    const to = path.join(dst, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(abs, to);
    out.push(rel.split(path.sep).join('/'));
  };
  walk('');
  return out;
}

function withRetry(fn, tries = 5) {
  let delay = 2000;
  for (let i = 1; i <= tries; i++) {
    try { return fn(); } catch (e) {
      const msg = String(e.stderr || e.message || '');
      const network = /Could not resolve host|Connection (reset|refused)|timed out|RPC failed|early EOF|503|502/i.test(msg);
      if (i === tries || !network) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay);
      delay *= 2;
    }
  }
}

function openPullRequest(repo, branch, base, title, body) {
  const remote = git(repo, ['remote', 'get-url', 'origin']);
  const m = /github\.com[/:]([^/]+)\/([^/.]+)/.exec(remote);
  if (!m) throw new Error(`cannot parse GitHub owner/repo from ${remote}`);
  const [, owner, name] = m;
  try {
    const url = execFileSync('gh', ['pr', 'create', '--repo', `${owner}/${name}`, '--base', base, '--head', branch, '--title', title, '--body', body], { cwd: repo, encoding: 'utf8' }).trim();
    return { url, via: 'gh' };
  } catch (e) {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (!token) throw new Error(`gh unavailable (${e.message.split('\n')[0]}) and no GITHUB_TOKEN; push succeeded on ${branch}, open the PR by hand`);
    return fetch(`https://api.github.com/repos/${owner}/${name}/pulls`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json', 'user-agent': 'ieatz-pages' },
      body: JSON.stringify({ title, head: branch, base, body }),
    }).then(async (r) => {
      if (!r.ok) throw new Error(`GitHub API ${r.status}: ${await r.text()}`);
      const j = await r.json();
      return { url: j.html_url, via: 'api' };
    });
  }
}

// files: staged tree root. Returns {commit, branch, pr?}
async function deploy({ staging, repo, config, conceptId, runId, message }) {
  const prod = config.site.website_repo.production_branch;
  const review = config.pages.requireReview;
  const branch = review ? `${config.pages.reviewBranchPrefix}${conceptId}` : prod;

  const dirty = git(repo, ['status', '--porcelain']);
  if (dirty) throw new Error(`website repo has uncommitted changes; refusing to deploy on top of them:\n${dirty}`);
  withRetry(() => git(repo, ['fetch', 'origin', prod]));
  if (review) {
    git(repo, ['checkout', '-B', branch, `origin/${prod}`]);
  } else {
    git(repo, ['checkout', prod]);
    git(repo, ['merge', '--ff-only', `origin/${prod}`]);
  }
  const files = copyTree(staging, repo);
  git(repo, ['add', '--', ...files]);
  if (!git(repo, ['status', '--porcelain'])) return { commit: null, branch, files, note: 'nothing changed' };
  const msg = message || `Publish recipes page for ${conceptId}\n\nConcept: ${conceptId}\nRun: ${runId}\nFiles: ${files.join(', ')}`;
  git(repo, ['commit', '-m', msg]);
  const commit = git(repo, ['rev-parse', 'HEAD']);
  // A review branch is owned by the run and rebuilt from the production
  // branch on every rerun, so it is pushed with a lease. The production
  // branch is never force-pushed.
  const pushArgs = review ? ['push', '--force-with-lease', '-u', 'origin', branch] : ['push', '-u', 'origin', branch];
  withRetry(() => git(repo, pushArgs));
  const out = { commit, branch, files, pr: null };
  if (review) {
    try {
      out.pr = await openPullRequest(repo, branch, prod, `Recipes page: ${conceptId}`, `Autonomous Pinterest landing page for concept \`${conceptId}\` (run ${runId}).\n\nFiles:\n${files.map((f) => `- ${f}`).join('\n')}\n\nMerge to deploy via Cloudflare Pages. verify-live runs after merge.`);
    } catch (e) {
      // The push is the deliverable. A PR that could not be opened is a
      // note for Travis, not a page failure.
      out.pr_error = e.message.split('\n')[0];
    }
    git(repo, ['checkout', prod]);
  }
  return out;
}

module.exports = { deploy, git, copyTree, openPullRequest };
