#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${MONGODB_URI:-}" ]]; then
  echo "ERROR: MONGODB_URI is not set"
  exit 1
fi

BASE_DIR="${TEDOGRAPHY_BACKUP_BASE_DIR:-/Users/tedshaffer/Documents/MongoDBBackups/tedography}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="${SCRIPT_DIR}/backup-tedography.sh"

if [[ ! -x "$BACKUP_SCRIPT" ]]; then
  echo "ERROR: backup script not found or not executable: $BACKUP_SCRIPT"
  exit 1
fi

MONTH=$(date +"%m")
DAY=$(date +"%d")
INDEX=1

mkdir -p "$BASE_DIR"

while [[ -d "$BASE_DIR/backup-${MONTH}-${DAY}-${INDEX}" ]]; do
  INDEX=$((INDEX + 1))
done

TARGET_DIR="$BASE_DIR/backup-${MONTH}-${DAY}-${INDEX}"
LATEST_LINK="$BASE_DIR/latest"

TMP_DIR="$BASE_DIR/.tmp-backup-${MONTH}-${DAY}-${INDEX}-$$"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "Creating temporary export in $TMP_DIR"
mkdir -p "$TMP_DIR"

"$BACKUP_SCRIPT" "$TMP_DIR"

PREV_SNAPSHOT=""
if [[ -L "$LATEST_LINK" ]]; then
  PREV_SNAPSHOT=$(readlink "$LATEST_LINK")
  if [[ ! "$PREV_SNAPSHOT" = /* ]]; then
    PREV_SNAPSHOT="$BASE_DIR/$PREV_SNAPSHOT"
  fi
fi

mkdir -p "$TARGET_DIR"

if [[ -n "$PREV_SNAPSHOT" && -d "$PREV_SNAPSHOT" ]]; then
  echo "Creating snapshot from previous: $PREV_SNAPSHOT"
  cp -al "$PREV_SNAPSHOT/." "$TARGET_DIR/"
  rsync -a --checksum --delete "$TMP_DIR/" "$TARGET_DIR/"
else
  echo "Creating fresh snapshot"
  rsync -a --checksum --delete "$TMP_DIR/" "$TARGET_DIR/"
fi

ln -sfn "$TARGET_DIR" "$LATEST_LINK"

echo "Backup snapshot complete: $TARGET_DIR"