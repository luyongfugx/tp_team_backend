# Anonymous AI report links

`POST /api/ai-report/share/publish` accepts `{report_id, owner_token, revision, language, document, pages}` without a login/session header. `owner_token` is a device-held 32-byte capability encoded as 64 lowercase hex characters; it must never appear in the public URL. `pages` contains base64 JPEGs exported by the same native renderer used for the confirmed report. The JSON document retains editable structure, comparison roles, text styles and photo order. The website is a responsive, read-only HTML document with accessible report text and pixel-identical native page images; it does not independently reflow the report text.

Response: `{url, share_key, revision, published_at, provider:"team_backend"}`. The 192-bit random share key is unguessable. Same owner/report/revision is idempotent; different content at the same revision and older revisions return 409. Newer revisions update the same URL. Sharing a closed report explicitly reopens that link.

`POST /api/ai-report/share/close` accepts `{report_id, owner_token}`. It closes only the matching device capability, with an idempotent response. Both `/report/:key` and `/report/:key/pages/:index?v=:revision` return 404 once closed. Public responses are no-store and noindex; HTML disables JavaScript, third-party resources and framing. Images are validated as bounded JPEGs. Limits: 16 pages, 10 MiB per page, 24 MiB decoded total, 32 MiB request, 256K document characters. Creation is limited per origin IP and owner; no account is required.

Tables: `AIReportShare` and `AIReportSharePage`; no changes to User, teams, existing photo shares, or OCR reports. Migration `20261110090000_ai_report_shares` creates only these tables and their indexes. Existing `tp_ocr` publication receipts remain closable through the legacy endpoint; new receipts select `team_backend`.

`AI_REPORT_PUBLIC_ORIGIN` optionally configures the link origin; production defaults to `https://teamspace.timeprint.net`. The deployment must run `prisma migrate deploy` before enabling the updated clients. No COS permissions or new bucket are required. JPEGs are private DB blobs served only through the live share key.

Validation: `node --import tsx --test scripts/ai-report-share.test.ts`; integration test exercises anonymous creation, idempotence, ownership, revision conflicts, exact image bytes and revocation using synthetic data, and deletes its rows afterward.
