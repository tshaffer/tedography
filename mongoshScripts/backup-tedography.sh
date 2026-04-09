#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${MONGODB_URI:-}" ]]; then
  echo "ERROR: MONGODB_URI is not set"
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: MONGODB_URI='mongodb+srv://...' $0 /path/to/output-dir"
  exit 1
fi

OUTPUT_DIR="$1"

if [[ ! -d "$OUTPUT_DIR" ]]; then
  echo "ERROR: Output dir does not exist: $OUTPUT_DIR"
  exit 1
fi

TEDOGRAPHY_MEDIA_ASSETS_CHUNK_SIZE="${TEDOGRAPHY_MEDIA_ASSETS_CHUNK_SIZE:-500}"

if ! [[ "$TEDOGRAPHY_MEDIA_ASSETS_CHUNK_SIZE" =~ ^[0-9]+$ ]]; then
  echo "ERROR: TEDOGRAPHY_MEDIA_ASSETS_CHUNK_SIZE must be an integer"
  exit 1
fi

EXPORT_COLLECTIONS=(
  albumTreeNodes
  faceDetections
  faceMatchReviews
  imageAnalyses
  people
  personFaceExamples
)

echo "Backing up Tedography to: $OUTPUT_DIR"

echo "Exporting non-chunked collections..."
for COLLECTION in "${EXPORT_COLLECTIONS[@]}"; do
  echo "  - $COLLECTION"
  mongoexport \
    --uri "$MONGODB_URI" \
    --collection "$COLLECTION" \
    --jsonFormat=canonical \
    --out "$OUTPUT_DIR/${COLLECTION}.json"
done

MEDIA_ASSETS_DIR="$OUTPUT_DIR/mediaAssets"
mkdir -p "$MEDIA_ASSETS_DIR"

DOC_COUNT_RAW=$(mongosh "$MONGODB_URI" --quiet --eval 'print(db.mediaAssets.countDocuments({}))')
DOC_COUNT=$(echo "$DOC_COUNT_RAW" | tr -d '[:space:]')

if ! [[ "$DOC_COUNT" =~ ^[0-9]+$ ]]; then
  echo "ERROR: Unable to determine mediaAssets count (got: $DOC_COUNT_RAW)"
  exit 1
fi

echo "Exporting mediaAssets in chunks (count=$DOC_COUNT, chunkSize=$TEDOGRAPHY_MEDIA_ASSETS_CHUNK_SIZE)..."

CHUNK_INDEX=0
SKIP=0
SORT_SPEC='{ _id: 1 }'

while [[ "$SKIP" -lt "$DOC_COUNT" ]]; do
  CHUNK_INDEX=$((CHUNK_INDEX + 1))
  CHUNK_FILE=$(printf "%s/mediaAssets-%06d.json" "$MEDIA_ASSETS_DIR" "$CHUNK_INDEX")
  echo "  - chunk $CHUNK_INDEX (skip=$SKIP, limit=$TEDOGRAPHY_MEDIA_ASSETS_CHUNK_SIZE)"
  mongoexport \
    --uri "$MONGODB_URI" \
    --collection "mediaAssets" \
    --sort "$SORT_SPEC" \
    --skip "$SKIP" \
    --limit "$TEDOGRAPHY_MEDIA_ASSETS_CHUNK_SIZE" \
    --jsonFormat=canonical \
    --out "$CHUNK_FILE"
  SKIP=$((SKIP + TEDOGRAPHY_MEDIA_ASSETS_CHUNK_SIZE))
done

EXPORTED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
cat <<MANIFEST > "$MEDIA_ASSETS_DIR/manifest.json"
{
  "collection": "mediaAssets",
  "chunkSize": $TEDOGRAPHY_MEDIA_ASSETS_CHUNK_SIZE,
  "docCount": $DOC_COUNT,
  "exportedAt": "$EXPORTED_AT",
  "sort": { "_id": 1 }
}
MANIFEST

echo "Backup complete."