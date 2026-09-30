# Public photo verification

The following application endpoints do not require login:

- `POST /api/photoCode/verify/upload`: JPEG up to 800 KB; returns a random guest upload URL.
- `POST /api/photoCode/verify/task`: submit a verification image URL.
- `POST /api/photoCode/verify/task/status`: retrieve a task by its random UUID `taskID`.
- `POST /api/photoCode/verify/task/timeout`: mark a pending task as timed out by `taskID`.
- `POST /api/photoCode/record`: query the original record by its 12-character photo code.

A valid account session is optional for associating new tasks with a user and enriching
record responses with that user's team information. Invalid or missing sessions do not
block verification. Existing clients may continue sending `guestToken`; it is not required.
Treat the unguessable task ID as an access capability: keep it private and do not add a
public task-list endpoint. Existing task IDs continue to work.

Image URLs must still use HTTPS, the configured COS verification bucket, and a safe
`verify/<namespace>/<file>.jpg` path. External hosts, signed/query URLs, path traversal,
and non-JPEG files remain rejected. OCR callback secret validation, admin authentication,
photo-code issuance authentication, and COS upload credential authorization are unchanged.

## Deployment

Run `prisma migrate deploy` before rolling out the application, then regenerate the Prisma
client as part of the normal build. Migration `20260930090000_allow_guest_photo_verification`
makes `PhotoVerificationTask.userID` nullable without rewriting or deleting existing tasks.
