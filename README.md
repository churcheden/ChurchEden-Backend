# ChurchEden Backend

Node.js/Express API for [ChurchEden](https://churcheden.com) - church management platform.

**Production API:** `https://api.churcheden.app`

## Quick start

- Local dev: `http://localhost:8080` (default `PORT=8080`, see `.env.example`)
- Production: `https://api.churcheden.app`
- Health: `GET https://api.churcheden.app/health`

```bash
npm install
# copy .env.example to .env and fill in secrets (DATABASE_URL, REDIS_*, tokens, etc.)
npm run dev
```

## API versioning

All REST endpoints are prefixed with `/api/v1`. Auth endpoints are additionally aliased at `/auth/*` (same handlers).

## Endpoints

> In the tables below, `{base}` = `https://api.churcheden.app/api/v1` in production, or `http://localhost:8080/api/v1` locally.
> `🔒` = requires `Authorization: Bearer <accessToken>`.
> Web (browser) clients receive **HttpOnly cookies** on login/refresh instead of the Bearer header and should use cookie auth.

### Auth — `{base}/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | | Create an account. Returns `requiresVerification: true` and emails an OTP. |
| POST | `/verify-email` | | Confirm the email with the OTP. Returns `accessToken`, `refreshToken`, `user`. |
| POST | `/resend-verification` | | Resend the verification OTP for an email. |
| POST | `/login` | | Sign in. Returns `accessToken`, `refreshToken`, `user`. |
| GET | `/me` | 🔒 | Get the signed-in user + their church. |
| POST | `/refresh` | | Rotate tokens. Body `{refreshToken}` (**mobile/platform clients**) or HttpOnly cookie (**web**). Returns `data.newAccessToken`, `data.newRefreshToken`. |
| POST | `/logout` | | Revoke refresh tokens. |
| POST | `/forgot-password` | | Email a password-reset token (SuperAdmin only). Body `{email}`. |
| POST | `/reset-password` | | Set a new password. Body `{token, newPassword}`. |
| GET | `/google/url` | | Returns `{ url }` to redirect the browser to Google OAuth. |
| GET | `/google` | | Redirect to Google's consent screen (passport). |
| GET | `/google/callback` | | OAuth callback — sets cookies and redirects to `FRONTEND_URL`. |
| POST | `/google/token` | | Exchange a Google ID token (`{idToken, platform?, accountType?, churchId?}`) for a token pair (mobile apps). `churchId` is required when `accountType: MEMBER` and no Member record exists yet. |

### Onboarding — `{base}/onboarding/church`

| Method | Path | Auth | Description |
|---|---|---|---|
| PATCH | `/step-1` | 🔒 | Church basics: `firstName, lastName, churchName, denomination, congregationSize, foundedYear?`. |
| PATCH | `/step-2` | 🔒 | Location & contact: `country, city, address, phone, email, primaryLanguage, timeZone`. |
| PATCH | `/step-3` | 🔒 | Multipart: `logo` (≤5MB) + `serviceTimes` JSON string (e.g. `[{"label":"Sunday Service","dayOfWeek":0,"time":"10:30"}]`). |
| PATCH | `/step-4` | 🔒 | Ministries: `ministryIds[]` + `customMinistries[]`. |
| GET | `/draft` | 🔒 | Resume a saved onboarding draft. |
| POST | `/complete` | 🔒 | Finish onboarding. Returns the created `church`. The SuperAdmin becomes the church owner. |

### Members — `{base}/members`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/profile/complete` | 🔒 | Multipart member profile: `profilePhoto?` (≤5MB) + `fullName, dateOfBirth, gender, phoneNumber, phoneCountryCode?, contactEmail, city, address, maritalStatus, occupation?`. |
| GET | `/profile` | 🔒 | Get the member's own profile. |

### Churches — `{base}/churches`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | 🔒 | List the church directory. Query param: `q` (search by name/city). Returns `{ churches: [...] }`. |
| POST | `/:churchId/leave` | 🔒 | The authenticated member leaves an **approved** church. No body. Deletes the Member record. |
| GET | `/:churchId/admins` | 🔒 | List a church's leadership. Returns `{ superAdmin, memberAdmins }`. Requires ADMIN/SUPER_ADMIN of the church. |
| DELETE | `/:churchId` | 🔒 | Delete a church (SUPER_ADMIN only). Cascades members, member profiles, service times and ministries. |

### Church Requests — `{base}/church-requests`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/` | 🔒 | Request that a church be onboarded. Body: `{churchName, city, leaderName}` plus exactly one of `phoneContact` (with optional `phoneCountryCode`) or `emailContact`. |

### Join Requests — `{base}/join-requests`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/` | 🔒 | Submit a join request. Body `{churchId}`. Creates a `Member` record (status `PENDING`) with `churchId` and the caller's email. |
| GET | `/` | 🔒 | List join requests (SuperAdmin only). Query params: `status` (`PENDING\|APPROVED\|REJECTED`). |
| POST | `/cancel` | 🔒 | The authenticated member cancels their **pending** join request. Body `{membershipId}`. Deletes the Member record. |
| POST | `/approve` | 🔒 | Approve. Body `{membershipId}`. Requires SUPER_ADMIN of the church. |
| POST | `/reject` | 🔒 | Reject. Body `{membershipId, rejectionReason?}`. Requires SUPER_ADMIN of the church. |
| POST | `/ban` | 🔒 | Ban a user from the church (stops repeat requests). Body `{membershipId, banReason}`. Requires SUPER_ADMIN. |
| POST | `/unban` | 🔒 | Lift a ban so the user can submit join requests again. Body `{membershipId}`. Requires SUPER_ADMIN. |

### Payments — `{base}/payments` (also mounted at `{base}`)

Subscriptions apply to the church (owned by a SuperAdmin), billed via Paystack.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/initialize` | 🔒 | Start a subscription payment for the SuperAdmin's church (SuperAdmin only). Returns `data.authorizationUrl`. |
| GET | `/initialize/verify/:reference` | 🔒 | Verify a payment by its transaction reference. |
| GET | `/subscription/cancel` | 🔒 | Cancel the SuperAdmin's church subscription. |
| POST | `/webhooks/paystack` | | Paystack webhook (raw JSON body for signature verification). Also reachable at `{base}/webhooks/paystack`. |

*Because payments are mounted at both `/api/v1` and `/api/v1/payments`, each of the above also works directly under `/api/v1` (e.g. `/api/v1/initialize`, `/api/v1/initialize/verify/:ref`, `/api/v1/subscription/cancel`).*

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness probe. Returns `{ status: 'OK', date }`. |

## Authentication flow

Two distinct account types exist: **SuperAdmin** (church owner/administrator) and
**Member** (a regular member of a specific church).

1. **Register** (SuperAdmin) → server emails a 6-digit OTP.
2. **Verify email** (or **Login** for returning users) → returns `accessToken` + `refreshToken`.
3. **Members** are created at join time (`POST /join-requests` with a `churchId`)
   or via Google OAuth (`POST /auth/google/token` with `accountType: MEMBER`).
4. Include `Authorization: Bearer <accessToken>` on protected endpoints. When a request returns `401`, call `/auth/refresh` to rotate, then retry once.
5. **Web** clients (SuperAdmin-only): use the HttpOnly cookies set by login/refresh (`sameSite: strict`) instead of storing tokens in JS.

## Postman

Import [`docs/postman-collection.json`](docs/postman-collection.json). Default `baseUrl` is `https://api.churcheden.app/api/v1`.

- `accessToken` / `refreshToken` are captured automatically on **Login**, **Verify email**, and **Refresh**.
- `churchId`, `membershipId`, `reference`, `resetToken` are captured where returned; set them manually when the response doesn't include them (e.g. `resetToken` is emailed to you).
- Set a local `baseUrl` environment variable to `http://localhost:8080/api/v1` for local testing.

## OpenAPI

A machine-readable spec is at [`docs/openapi.yaml`](docs/openapi.yaml). Client integration guidance is at [`docs/CLIENT-INTEGRATION.md`](docs/CLIENT-INTEGRATION.md).

## Frontend integration

- API base: `https://api.churcheden.app/api/v1`
- Master prompt: [`guidelines/MASTER-INTEGRATION-PROMPT.md`](guidelines/MASTER-INTEGRATION-PROMPT.md)

## Google OAuth redirect URI

```
https://api.churcheden.app/api/v1/auth/google/callback
```
