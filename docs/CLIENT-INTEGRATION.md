# ChurchEden Backend — Client Integration Guide

Guides the **web app** and **mobile app** clients through the endpoints, auth
conventions and known limitations of the ChurchEden backend.

OpenAPI spec: [`openapi.yaml`](./openapi.yaml) · Postman collection:
[`postman-collection.json`](./postman-collection.json)

---

## 1. Environments

| Environment | Base URL | Notes |
| --- | --- | --- |
| Production | `https://api.churcheden.app/api/v1` | CORS origin `https://churcheden.app` |
| Staging | `https://staging-api.churcheden.app/api/v1` | Set `FRONTEND_URL` matching the staging origin |
| Local | `http://localhost:8080/api/v1` | `npm run dev` |

Health (no prefix): `GET https://api.churcheden.app/health` → `200 { status: "OK", date, service }`.

**Route aliasing (duplicate mounts).** Do not rely on these; they exist today but
should be treated as accidental:
- Auth is also mounted at `/auth/*` (i.e. `/auth/login`, `/auth/refresh`, ...).
- Payments are also mounted at `/api/v1/*` (i.e. `/api/v1/initialize`,
  `/api/v1/initialize/verify/:reference`, `/api/v1/subscription/cancel`).

---

## 2. Auth

### 2.1 Registration & email verification
1. `POST /auth/register` `{ email, password }` (password ≥ 8 chars) → `201`.
2. A 6-digit OTP is emailed. `POST /auth/verify-email` `{ email, otp }`.
3. `POST /auth/resend-verification` `{ email }` (rate-limited).

### 2.2 Login & token storage — **web vs mobile differ**
| Concern | Web (browser) | Mobile (app) |
| --- | --- | --- |
| Access token | HttpOnly cookie `token` | `Authorization: Bearer <accessToken>`; persist securely (Keychain/Keystore) |
| Refresh token (login) | HttpOnly cookie `refreshToken` | From the `data.refreshToken` in the login response body; persist securely |
| Refresh flow | `POST /auth/refresh` **with empty body** (server reads cookie) | `POST /auth/refresh` `{ refreshToken }` |
| Logout | `POST /auth/logout` (cookie is cleared server-side) | `POST /auth/logout` `{ refreshToken }` **and** refer to the header path below |

`POST /auth/logout` has **no auth middleware**: it revokes the *refresh* token
and, when an `Authorization: Bearer <accessToken>` header is present, also
revokes that access token. Send the header on mobile so both tokens die.

### 2.3 Google OAuth
1. `GET /auth/google/url` → `{ url }` — redirect the browser/webview there.
2. Google redirects back to `/auth/google/callback`. On success the browser is
   redirected to `${FRONTEND_URL}/auth/callback?profileComplete=<true|false>`
   with JWT cookies set. On failure: `${FRONTEND_URL}/sign-in?error=auth_failed`.
3. New Google users are auto-verified with a random password (they can never use
   the email/password path until a password reset). Existing email accounts are
   linked and verified.

### 2.4 Current user
`GET /auth/me` (Bearer) → current user payload.

### 2.5 Password reset
`POST /auth/forgot-password` `{ email }` → always succeeds (no account
enumeration). `POST /auth/reset-password` `{ token, newPassword }`. The token
is in the `forgot-password` email.

---

## 3. Onboarding (church founders)

State machine, one draft per user (Redis, 24h TTL):

```
step-1 ─► step-2 ─► step-3 ─► step-4 ─► /complete
```

| Step | Endpoint | Notes |
| --- | --- | --- |
| 1 basics | `PATCH /onboarding/church/step-1` | `firstName`, `lastName`, `churchName`, `denomination`, `congregationSize`, `foundedYear?` |
| 2 location | `PATCH /onboarding/church/step-2` | `country` (ISO alpha-2, e.g. `NG`), `city`, `address`, `phone`, `email`, `primaryLanguage`, `timeZone` |
| 3 media | `PATCH /onboarding/church/step-3` | multipart: `logo` (≤ 5 MB) + `serviceTimes` as a **JSON string** |
| 4 ministries | `PATCH /onboarding/church/step-4` | `ministryIds` + `customMinistries` |
| draft | `GET /onboarding/church/draft` | `404 DRAFT_NOT_FOUND` until step 1 is saved |
| complete | `POST /onboarding/church/complete` | Creates the church, SUPER_ADMIN membership, service times & ministries |

- Step 1 validates **all** fields (only `foundedYear` is optional), so the UI
  should re-submit the full form, not partial diffs.
- `timeZone` must be an IANA name **listed in `Intl.supportedValuesOf('timeZone')`
  of the Node runtime**. `'UTC'` (case-insensitive) is accepted and automatically
  normalized to `Etc/UTC` (which is the canonical IANA form).
- `serviceTimes[].dayOfWeek`: 0 = Sunday … 6 = Saturday; `time` is 24h `HH:MM`.
- Incomplete steps: `PATCH` errors reference the missing step, e.g.
  `DRAFT_NOT_FOUND` for `complete` without any step.

---

## 4. Member profile

| Endpoint | Notes |
| --- | --- |
| `POST /members/profile/complete` | multipart: `profilePhoto` (≤ 5 MB) + fields `fullName`, `dateOfBirth`, `gender`, `phoneNumber`, `phoneCountryCode?`, `contactEmail`, `city`, `address`, `maritalStatus`, `occupation?` |
| `GET /members/profile` | `404 PROFILE_NOT_FOUND` until completed |

- One profile per user; re-submitting upserts it.
- `phoneNumber` is **not unique** — two members may share a phone number.
- The profile's `fullName` is stored separately from the account `fullName` and
  never overwritten by Google OAuth.
- Upload errors: `413 PHOTO_TOO_LARGE` (> 5 MB).

---

## 5. Churches (directory)

| Endpoint | Notes |
| --- | --- |
| `GET /churches` | List the church directory; add `?q=<name or city>` to search. Returns `{ churches: [...] }` |
| `GET /churches/:churchId/admins` | List a church's admins (`ADMIN`/`SUPER_ADMIN`) |
| `POST /churches/:churchId/leave` | The member leaves an **approved** church (role `MEMBER`); no body |

- `leave` and `join-requests/cancel` are how a member manages their own
  membership/request without needing an admin role.

---

## 6. Join-requests

| Endpoint | Notes |
| --- | --- |
| `POST /join-requests` `{ churchId }` | Create a `ChurchMembership` with status `PENDING` |
| `GET /join-requests` | Own requests; admins add `?status=PENDING&churchId=` to list their church's pool; SUPER_ADMIN sees all churches |
| `POST /join-requests/cancel` `{ membershipId }` | The member cancels their own **pending** request (role `MEMBER`) |
| `POST /join-requests/approve` `{ membershipId }` | Requires `ADMIN`/`SUPER_ADMIN` of that church |
| `POST /join-requests/reject` `{ membershipId, rejectionReason? }` | Same role requirement |
| `POST /join-requests/ban` `{ membershipId, banReason? }` | Bans the user from that church (any further `POST /join-requests` → `403 BANNED_FROM_CHURCH`) |
| `POST /join-requests/unban` `{ membershipId }` | Reverses a ban so the user can submit a request again |

**Banning.** `ban` marks the membership `isBanned` and REJECTED, storing an
optional reason. A banned user is refused on submit with `403 BANNED_FROM_CHURCH`.
Both `ban` and `unban` require `ADMIN`/`SUPER_ADMIN` of that church. Banning is
per-church — it does not affect the user's memberships elsewhere.

**Known gap:** approve/reject do **not** currently send the applicant a
notification (email/SMS). Populate the client UI from the list response.

---

## 7. Payments (Paystack)

| Endpoint | Notes |
| --- | --- |
| `GET /payments/initialize` | Creates a pending `Transaction` + Paystack subscription checkout URL `{ data.authorizationUrl }` |
| `GET /payments/initialize/verify/:reference` | Poll after payment; use the returned `reference` |
| `GET /payments/subscription/cancel` | Cancels the active subscription |
| `POST /webhooks/paystack` | Signed webhook; **responds 200 before async work**, so poll `verify` (or DB) rather than relying on webhook timing |

- Money is in **Ghanaian cedis (GHS)**, passed to Paystack as the minor unit via
  `SUBSCRIPTION_AMOUNT_KOBO` (default `2000`, i.e. GHS 20.00). Good to read from
  `.env.example` — the exact value is environment-configurable.
- A user with an active subscription gets `409 ALREADY_PREMIUM` from `initialize`.
- **Webhook signatures:** HMAC-SHA512 of the raw request body with
  `PAYSTACK_SECRET_KEY` in the `x-paystack-signature` header. If you self-test
  with an HTTP client, send the **raw JSON string** — serializing a Buffer
  mangles the payload and breaks the signature.

---

## 8. Conventions & errors

- Envelope on success: `{ status: "success", data? }` (a few endpoints return
  the resource at top level — see OpenAPI).
- Envelope on error:
  - Client errors: `{ status: "error", code, message, details? }` (details for
    `VALIDATION_FAILED` only).
  - Uncaught errors: `{ status: "fail", error: "Internal Server Error" }` —
    `message`/`stack` are present in non-production.
- Common codes: `VALIDATION_FAILED` (400), `UNAUTHORIZED` (401),
  `MISSING_TOKEN` (401), `EMAIL_NOT_VERIFIED` (403), `PageNotFound` (404),
  `DRAFT_NOT_FOUND` (404), `TRANSACTION_NOT_FOUND` (404), `ALREADY_PREMIUM` (409),
  `EMAIL_EXISTS` (409), `BANNED_FROM_CHURCH` (403).
- **Rate limits** (`express-rate-limit`, check middleware for exact windows):
  a global API limiter applies to all `/api/v1` routes, plus per-route limiters
  on register/login/OTP-resend and password endpoints. Exceeded → `429`.
- **CORS:** `Access-Control-Allow-Origin` is a fixed value from `FRONTEND_URL`,
  `credentials: true`, allowed methods incl. `OPTIONS`.

---

## 9. Known gaps & things to verify

1. **Mobile `x-client-platform` header — unused.** The backend never reads it
   and doesn't yet store `deviceInfo` on refresh; mobile must persist tokens
   itself. Web should rely on cookies, not body refresh.
2. **`Transaction.status` is a plain string**, not an enum — normalize client-side.
3. **Payment routes use `GET`** for state-changing operations (initialize,
   verify, cancel) — matches the implementation, unusual for REST.
4. **Join approve/reject have no applicant notification** (see §5).
5. **CORS echo is a fixed origin**, not a reflection of the request `Origin`.
   Staging must set `FRONTEND_URL` to the staging frontend origin.
6. **Rate limiter state** is currently an in-memory demo (`rate-limit-redis` is
   mocked in tests) — confirm the production Redis wiring before load.
7. **`GET /payments/...` aliases at `/api/v1/*`** — do not depend on them (§1).