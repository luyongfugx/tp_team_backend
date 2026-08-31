# Photo code and COS JSON encryption APIs

## Prefetch photo codes

`POST /api/photoCode/gen`

This endpoint requires the normal app login token. The requested count can be
provided in the JSON body or query string. The JSON body takes precedence.

```json
{
  "count": 10,
  "device_id": "device-unique-id"
}
```

Response:

```json
{
  "antiFakeCodes": ["UEIAYC9PZWE9"],
  "count": 1,
  "expiresAt": "2026-11-27T08:00:00.000Z",
  "validityMonths": 3
}
```

Configuration:

- `PHOTO_CODE_DEFAULT_BATCH_SIZE`: default `10`.
- `PHOTO_CODE_MAX_BATCH_SIZE`: default `100`, hard-capped at `1000`.
- `PHOTO_CODE_VALIDITY_MONTHS`: default `3`, hard-capped at `120`.

Codes contain exactly 12 characters from the configured uppercase-letter/digit alphabet and are persisted with a
unique database constraint, owner, optional device ID, batch ID, and expiry.

## Get the COS JSON AES secret

`POST /api/workgroup/v4/oss/secret`

Request:

```json
{
  "device_id": "device-unique-id",
  "sign": "md5(device_id + embedded sign key), lowercase hex"
}
```

`deviceId` is also accepted for compatibility with older Android clients.

Response:

```json
{
  "StatusCode": 200,
  "Secret": "configured AES secret"
}
```

Configuration:

- `COS_JSON_SIGN_KEY`: the sign key embedded in the clients.
- `COS_JSON_AES_SECRET`: an independent AES key used only to encrypt JSON; its
  UTF-8 representation must be exactly 16, 24, or 32 bytes.

The endpoint does not return a Tencent Cloud `SecretId` or `SecretKey` and does
not grant COS upload permission. Direct COS upload should use restricted,
short-lived STS credentials or another existing scoped upload mechanism.

## Get a short-lived COS upload credential

`POST /api/workgroup/v4/oss/sts`

This endpoint requires the normal app login token. The client submits the
already-generated Team Space object key:

```json
{
  "bucketKey": "team",
  "objectKey": "teamspace/US/group-id/team/2026/08/27/ios_uuid.jpg",
  "access": "write"
}
```

`access` accepts `read`, `write`, or `readwrite`. The backend resolves
`bucketKey`, verifies the configured permission and path policy, and returns an
STS credential restricted to the requested operations on that exact object.
For the `team` validator it additionally checks team membership, project, or
avatar ownership. The permanent CAM key is never returned to a client.

Configuration:

- `COS_STS_DURATION_SECONDS`: defaults to `900`, clamped to `300...1800`.
- `TENCENT_COS_SECRET_ID` / `TENCENT_COS_SECRET_KEY`: server-only CAM key.
- `TENCENT_COS_BUCKETS_JSON`: map of client bucket aliases to bucket name,
  region, read/write flags, path prefixes, and optional validator.
- `TENCENT_COS_TEAM_BUCKET` / `TENCENT_COS_REGION`: backward-compatible
  single-team-bucket fallback when the JSON map is absent.

Each bucket entry may set `secretIdEnv` and `secretKeyEnv` to the names of env
variables containing a bucket/account-specific CAM key. If omitted, the global
CAM key is used.

Client rollout is controlled in Apollo's `application` namespace with
`cos_sts_enable`. Values `1` and `true` enable STS; a missing key or any other
value keeps the legacy upload credential path. Both clients temporarily accept
the older `team_space_cos_sts_enable` key as a fallback.
