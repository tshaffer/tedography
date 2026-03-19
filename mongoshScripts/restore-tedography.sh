#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${MONGODB_URI:-}" ]]; then
  echo "ERROR: MONGODB_URI is not set"
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: MONGODB_URI='mongodb+srv://...' $0 /path/to/backup-dir"
  exit 1
fi

BACKUP_DIR="$1"

if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "ERROR: Backup dir does not exist: $BACKUP_DIR"
  exit 1
fi

ALBUM_TREE_NODES_FILE="$BACKUP_DIR/albumTreeNodes.json"
MEDIA_ASSETS_FILE="$BACKUP_DIR/mediaAssets.json"
MEDIA_ASSETS_DIR="$BACKUP_DIR/mediaAssets"
MEDIA_ASSETS_MANIFEST="$MEDIA_ASSETS_DIR/manifest.json"

if [[ ! -f "$ALBUM_TREE_NODES_FILE" ]]; then
  echo "ERROR: Missing required file: $ALBUM_TREE_NODES_FILE"
  exit 1
fi

HAS_MEDIA_ASSETS_JSON=0
if [[ -f "$MEDIA_ASSETS_FILE" ]]; then
  HAS_MEDIA_ASSETS_JSON=1
fi

HAS_MEDIA_ASSETS_CHUNKS=0
if [[ -d "$MEDIA_ASSETS_DIR" && -f "$MEDIA_ASSETS_MANIFEST" ]]; then
  HAS_MEDIA_ASSETS_CHUNKS=1
fi

if [[ "$HAS_MEDIA_ASSETS_JSON" -eq 0 && "$HAS_MEDIA_ASSETS_CHUNKS" -eq 0 ]]; then
  echo "ERROR: Neither mediaAssets.json nor chunked mediaAssets export was found"
  exit 1
fi

echo "About to restore Tedography from: $BACKUP_DIR"
echo "Target DB URI: $MONGODB_URI"
echo
echo "This script will DROP and recreate these collections if present:"
echo "  - albumTreeNodes"
echo "  - mediaAssets"
echo

read -r -p "Type RESTORE to continue: " CONFIRM
if [[ "$CONFIRM" != "RESTORE" ]]; then
  echo "Aborted."
  exit 1
fi

echo "Dropping target collections if they exist..."
mongosh "$MONGODB_URI" --quiet --eval 'db.albumTreeNodes.drop(); db.mediaAssets.drop();'

echo "Restoring albumTreeNodes from $ALBUM_TREE_NODES_FILE"
mongoimport \
  --uri "$MONGODB_URI" \
  --collection "albumTreeNodes" \
  --file "$ALBUM_TREE_NODES_FILE"

if [[ "$HAS_MEDIA_ASSETS_CHUNKS" -eq 1 ]]; then
  echo "Restoring mediaAssets from chunked export in $MEDIA_ASSETS_DIR"

  shopt -s nullglob
  CHUNK_FILES=( "$MEDIA_ASSETS_DIR"/mediaAssets-*.json )
  shopt -u nullglob

  if [[ ${#CHUNK_FILES[@]} -eq 0 ]]; then
    echo "ERROR: Chunk manifest exists but no chunk files were found in $MEDIA_ASSETS_DIR"
    exit 1
  fi

  for CHUNK_FILE in "${CHUNK_FILES[@]}"; do
    echo "  - importing $(basename "$CHUNK_FILE")"
    mongoimport \
      --uri "$MONGODB_URI" \
      --collection "mediaAssets" \
      --file "$CHUNK_FILE"
  done
else
  echo "Restoring mediaAssets from single-file export $MEDIA_ASSETS_FILE"
  mongoimport \
    --uri "$MONGODB_URI" \
    --collection "mediaAssets" \
    --file "$MEDIA_ASSETS_FILE"
fi

echo "Restore complete."
echo
echo "Collection counts:"
mongosh "$MONGODB_URI" --quiet --eval '
print("albumTreeNodes: " + db.albumTreeNodes.countDocuments({}));
print("mediaAssets: " + db.mediaAssets.countDocuments({}));
'