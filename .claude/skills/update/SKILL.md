---
name: update
description: Pull the latest code from the private biodata repo's `release` branch into this working directory. Idempotent — does nothing if already up to date. Preserves the user's `data/`, `data_parquet/`, `query-result/`, and `.claude/settings.local.json`. Triggered by `/update`.
---

# update — pull the latest code without git

You (Claude) are walking a non-technical user through a code update.
They opened Claude Code in this repo and typed `/update`. Your job is
to fetch the latest commits from the `release` branch on GitHub and
apply them to this working directory **with zero questions** — the
client never sees git.

The flow has four phases. Each phase is idempotent. Tell the user
what's happening *before* each long-running step.

## Phase 1 — Preflight

Confirm this directory is a git checkout. The zip the client
unzipped includes a `.git/` directory; if it's missing, the only
recovery is to unzip a fresh copy.

```bash
[ -d .git ] && echo "git ok" || echo "MISSING_GIT"
```

If you see `MISSING_GIT`, stop and tell the user: *"This folder is
missing its `.git/` directory, which `/update` needs. Please unzip
a fresh copy of the biodata folder and try again."* Do not attempt
recovery.

## Phase 2 — Fetch and diff

Fetch the remote and compute what's new. The remote URL has a
read-only PAT baked in, so this works without prompting.

```bash
git fetch origin --quiet
HEAD_BEFORE=$(git rev-parse HEAD)
HEAD_AFTER=$(git rev-parse origin/release)
echo "before=$HEAD_BEFORE"
echo "after=$HEAD_AFTER"
```

If `HEAD_BEFORE == HEAD_AFTER`, print *"Already on the latest
release ($HEAD_BEFORE)."* and stop. Do not run later phases.

Otherwise, show the user the pending commits so they know what's
coming in:

```bash
git log --oneline --no-decorate "$HEAD_BEFORE..$HEAD_AFTER"
```

Capture the current `package.json` hash before applying so we know
whether to run `npm install` afterwards:

```bash
PKG_OLD=$(shasum src/package.json | awk '{print $1}')
echo "pkg_old=$PKG_OLD"
```

## Phase 3 — Apply

Hard-reset to `origin/release`. This is intentional rather than
`pull --ff-only`: if the user has accidentally edited a tracked
file in their editor, we want `/update` to win. Files matched by
`.gitignore` (the client's `data/`, `data_parquet/`,
`query-result/`, `src/node_modules/`,
`.claude/settings.local.json`) are not touched by `git reset
--hard`.

Tell the user *"Applying update…"* before running:

```bash
git reset --hard origin/release
```

## Phase 4 — Conditional `npm install`

If `src/package.json` changed in this update, dependencies may need
to be refreshed. Only reinstall when it actually changed.

```bash
PKG_NEW=$(shasum src/package.json | awk '{print $1}')
if [ "$PKG_OLD" != "$PKG_NEW" ]; then
  echo "package.json changed — installing dependencies"
  npm --prefix src install
else
  echo "package.json unchanged — skipping npm install"
fi
```

Stream the `npm install` output so the user sees progress.

## Final report

When all four phases are clean, print a one-paragraph summary:

- New short SHA (`git rev-parse --short HEAD`)
- Number of commits applied (`git rev-list --count
  "$HEAD_BEFORE..$HEAD_AFTER"`)
- A literal next-step hint: *"Try `/search …` to query the dataset,
  or `/setup` if anything looks off."*

## Failure handling

- **`git fetch` fails (network, auth)**: surface the error verbatim
  and stop. Do not modify the working tree. Suggest the user check
  their internet and retry.
- **`.git/` missing**: handled in Phase 1, tell the user to unzip a
  fresh copy.
- **`git reset --hard` fails (extremely rare, e.g. disk full)**:
  surface the error and stop. The repo will be in a partially
  updated state at worst — re-running `/update` retries cleanly.
- **`npm install` fails**: code is already updated; only the
  dependency refresh failed. Surface the error and suggest the
  user re-run `/update` after fixing whatever npm complained about
  (commonly a stale `node_modules/` — `rm -rf src/node_modules &&
  /update` resolves it).

Don't silently retry. If a phase fails, stop and let the user
choose.
