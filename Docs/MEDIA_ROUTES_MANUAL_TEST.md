# Media Routes Manual Test

## Verify cache headers

1. Start the API server.
2. Pick an existing asset id from `GET /api/assets`.
3. Check thumbnail headers:

```bash
curl -I http://localhost:4000/api/media/thumbnail/<assetId>
```

Expected header:

```text
Cache-Control: public, max-age=31536000, immutable
```

4. Check display headers:

```bash
curl -I http://localhost:4000/api/media/display/<assetId>
```

Expected header:

```text
Cache-Control: public, max-age=31536000, immutable
```

5. Check original headers:

```bash
curl -I http://localhost:4000/api/media/original/<assetId>
```

Expected header:

```text
Cache-Control: public, max-age=86400
```

## Basic behavior checks

1. Request media with a valid id and verify a `200` response.
2. Request media with a non-existent asset id and verify `404` is unchanged.
3. Request media where the backing file is missing and verify `404` is unchanged.
