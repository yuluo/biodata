---
name: setup
description: One-command setup for this biodata repo. Installs Node.js (if missing), installs npm dependencies, and imports every CSV in `data/` into the partitioned Parquet dataset so `/search` works immediately afterward. Assumes CSVs are already provided under `data/`. Triggered by `/setup`.
---

# setup — get this repo ready to query

You (Claude) are walking a non-technical user through setup. They opened
Claude Code in this repo and typed `/setup`. Your job is to make
everything ready for `/search` with **zero questions** — the user has
already placed CSV files under `data/`; you just need to install
toolchain and import them.

The setup has three phases. **Each phase is idempotent** — check first,
skip if already done, only run work that's needed. Tell the user what
you're about to do *before* a long-running step so they're not staring
at a blank screen.

## Phase 1 — Node.js

Run the installer; it self-detects whether Node is missing or too old.

```bash
bash src/scripts/install_node.sh
```

- Exit 0 = Node ≥20 is on PATH. Continue.
- Non-zero = installer printed an error. Surface it to the user and stop.

On macOS the script may install Homebrew first (sudo prompt). On Linux
it installs `nvm` to `~/.nvm`. On Windows it just prints manual
instructions — if `uname` reports MINGW/CYGWIN/MSYS, tell the user to
install Node 20+ from https://nodejs.org/ and re-run `/setup`.

## Phase 2 — npm dependencies

```bash
[ -d src/node_modules ] && echo "deps present" || npm --prefix src install
```

Only run `npm install` if `src/node_modules/` is missing. Don't run on
every setup. The `--prefix src` flag points npm at `src/package.json`
without requiring you to `cd` (so subsequent shell redirects can still
reference root-relative paths like `query-result/`).

## Phase 3 — Import CSVs into Parquet

Verify CSVs are present, then import them. `build_parquet.js` reads the
glob `data/variant_mock_*.csv` by default and writes
`data_parquet/CHR=*/*.parquet` partitioned by chromosome.

```bash
CSV_COUNT=$(ls data/variant_mock_*.csv 2>/dev/null | wc -l | tr -d ' ')
echo "Found $CSV_COUNT CSVs in data/"
```

- If `CSV_COUNT == 0`, stop. Tell the user: *"No CSVs found under
  `data/`. Drop your `variant_mock_*.csv` files there and re-run
  `/setup`."*
- If `data_parquet/` is already populated, skip. Tell the user:
  *"Parquet dataset already built (N partitions), skipping import."*
- Otherwise, run the import. Stream stdout so the user sees progress:

```bash
[ -d data_parquet ] && [ -n "$(ls data_parquet 2>/dev/null)" ] \
  && echo "parquet present" \
  || npm --prefix src run build-parquet
```

`build_parquet.js` refuses to overwrite a non-empty `data_parquet/`, so
the guard is also a safety net.

The script prints a `[progress] MMmSSs  N files  XX.X MB` line every
30 seconds during the import — stream stdout to the user so they see the
heartbeat rather than a blank terminal.

## Final report

When all three phases are clean, print a one-paragraph summary that
includes:

- Node version (`node -v`)
- CSV count (`ls data/variant_mock_*.csv | wc -l`)
- Parquet partition count (`ls data_parquet | wc -l`)
- A literal next-step hint: *"Try `/search show me high-CADD variants in
  BRCA1` to query the dataset."*

## Failure handling

- **`bash` not available** (rare, e.g. plain Windows cmd): tell the user
  to open Git Bash or WSL and re-run `/setup`.
- **No internet** during Node install: surface the curl/brew error
  verbatim and suggest connecting and retrying.
- **Disk full** during the parquet build: remove the partial output
  (`rm -rf data_parquet`) and ask the user to free space before retrying.
- **No CSVs in `data/`**: stop and instruct the user to drop their
  `variant_mock_*.csv` files there, then re-run `/setup`.

Don't silently retry. If a phase fails, stop and let the user choose.
