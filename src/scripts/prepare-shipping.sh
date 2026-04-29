#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

if [ ! -f .shipping-pat ]; then
  echo "ERROR: .shipping-pat not found at $REPO_ROOT/.shipping-pat" >&2
  echo "Create a fine-grained GitHub PAT (Contents: Read, scoped to" >&2
  echo "yuluo/biodata) and paste it as a single line into that file." >&2
  exit 1
fi

PAT="$(tr -d '[:space:]' < .shipping-pat)"
if [ -z "$PAT" ]; then
  echo "ERROR: .shipping-pat is empty." >&2
  exit 1
fi

if ! git show-ref --verify --quiet refs/heads/release; then
  echo "ERROR: local 'release' branch does not exist." >&2
  echo "Create it with: git branch release && git push -u origin release" >&2
  exit 1
fi

STAGE="$(mktemp -d -t biodata-shipping)"
trap 'rm -rf "$STAGE"' EXIT
CLONE="$STAGE/biodata"

git clone --quiet --branch release . "$CLONE"

git -C "$CLONE" remote set-url origin \
  "https://x-access-token:${PAT}@github.com/yuluo/biodata.git"

SHA="$(git -C "$CLONE" rev-parse --short HEAD)"
OUT="$REPO_ROOT/biodata-${SHA}.zip"
rm -f "$OUT"

(
  cd "$CLONE"
  zip -rq "$OUT" . \
    -x '.git/hooks/*' \
    -x 'data/*' \
    -x 'data_parquet/*' \
    -x 'query-result/*' \
    -x 'src/node_modules/*' \
    -x '*.log' \
    -x '.DS_Store' \
    -x '.claude/settings.local.json' \
    -x '.shipping-pat'
)

SIZE="$(du -h "$OUT" | awk '{print $1}')"
echo "Built $OUT ($SIZE) from release@${SHA}"
