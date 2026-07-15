# ChurchEden Frontend ↔ Backend — Master Integration Prompt

**Default API:** `https://api.churcheden.app`  
**API base (auth):** `https://api.churcheden.app/api/v1`  
**Health:** `GET https://api.churcheden.app/health`

Copy everything below the line into Cursor Agent to wire the live Railway backend into this Vite/React frontend.

---

## PROMPT START

You are integrating the **ChurchEden-Web** frontend (React 18 + Vite 6 + TypeScript + React Router v7 + Tailwind v4) with the live **ChurchEden Backend API** at **`https://api.churcheden.app`** on Railway.

### Live URLs (verified)

| Service | URL |
|---|---|
| **Backend API (default)** | `https://api.churcheden.app` |
| **Backend API base (auth)** | `https://api.churcheden.app/api/v1` |
| Frontend (production) | `https://churcheden.app` |
| Frontend (local dev) | `http://localhost:5173` |
| Backend API (local dev) | `http://localhost:3000/api/v1` |
| Health check | `GET https://api.churcheden.app/health` → `200 {"status":"OK","service":"ChurchEden Backend API"}` |

### Environment (already set up)

- `src/env.ts` — reads `VITE_APP_URL`, `VITE_API_BASE_URL`, `VITE_APP_NAME`
- `src/lib/api.ts` — `apiUrl("/auth/login")` builds full API paths
- `.env` / `.env.production` — `VITE_API_BASE_URL=https://api.churcheden.app/api/v1`
- `.env.development` — `VITE_API_BASE_URL=http://localhost:3000/api/v1` (local only)

**Always use `apiUrl()` and `env` — never hardcode URLs.**

### CORS & credentials

Backend CORS allows `FRONTEND_URL` with `credentials: true`. All authenticated `fetch` calls must use:

```ts
fetch(apiUrl("/auth/me"), {
  credentials: "include",
  headers: { Authorization: `Bearer ${accessToken}` },
});
```

Backend also sets httpOnly cookies (`token`, `refreshToken`) on register/login. Support both Bearer header tokens (from JSON body) and cookies.

### API error shape

```json
{ "status": "error", "code": "EMAIL_NOT_VERIFIED", "message": "Please verify your email before signing in." }
```

Known auth error codes: `USER_EXISTS`, `UNAUTHORIZED`, `EMAIL_NOT_VERIFIED`, `MISSING_OTP`, `INVALID_OTP`, `OTP_EXPIRED`, `PageNotFound`.

### Auth API reference

Base: `{VITE_API_BASE_URL}` (e.g. `https://api.churcheden.app/api/v1`)

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/register` | `{ email, password }` | Min 8 char password. Returns tokens + `requiresVerification: true` |
| POST | `/auth/verify-email` | `{ email, otp }` | 6-digit OTP from email |
| POST | `/auth/resend-verification` | — | Requires Bearer token |
| POST | `/auth/login` | `{ email, password }` | 403 `EMAIL_NOT_VERIFIED` if unverified |
| GET | `/auth/me` | — | Bearer token required |
| POST | `/auth/refresh` | `{ refreshToken? }` | Returns new token pair |
| POST | `/auth/logout` | — | Bearer token required |
| POST | `/auth/forgot-password` | `{ email }` | Silent success even if email unknown |
| POST | `/auth/reset-password` | `{ token, newPassword }` | Token from email link |
| GET | `/auth/google/url` | — | Returns `{ status: "success", url }` |
| GET | `/auth/google` | — | Browser redirect (OAuth start) |
| GET | `/auth/google/callback` | — | Server-side; redirects to frontend |

### Success response shapes

**Register (201):**
```json
{
  "status": "success",
  "message": "Account created! Check your email for the verification code.",
  "requiresVerification": true,
  "accessToken": "...",
  "refreshToken": "...",
  "user": { "id", "email", "isVerified", "createdAt", "updatedAt" }
}
```

**Login (200):**
```json
{
  "status": "success",
  "message": "Signed in successfully.",
  "accessToken": "...",
  "refreshToken": "...",
  "user": { "id", "email", "fullName", "isVerified", "loginProvider" }
}
```

### Required integration work

#### 1. API client layer (`src/lib/`)

Create:
- `src/lib/api-client.ts` — typed `fetch` wrapper with `credentials: "include"`, JSON parsing, error extraction
- `src/lib/auth-api.ts` — functions: `register`, `login`, `verifyEmail`, `logout`, `refreshTokens`, `getCurrentUser`, `getGoogleAuthUrl`
- `src/lib/auth-storage.ts` — store `accessToken` / `refreshToken` in memory + `sessionStorage` (or secure pattern); auto-refresh on 401

#### 2. Auth context (`src/app/auth/`)

Create `AuthProvider` + `useAuth` hook:
- `user`, `isAuthenticated`, `isLoading`
- `signUp(email, password)` → register → redirect to email verification step
- `signIn(email, password)` → login → redirect to dashboard
- `signOut()` → logout + clear tokens
- `signInWithGoogle()` → fetch `/auth/google/url` → `window.location.href = url`

#### 3. Wire existing onboarding screens

**`src/app/components/onboarding/steps/welcome-step.tsx`** (sign-up):
- Remove simulated `setTimeout` success
- Call `register({ email, password })` — validate `password === confirmPassword` client-side first
- On success with `requiresVerification`: navigate to `/onboarding/verify-email` with email in state/context
- Handle `USER_EXISTS` error with user-friendly message
- Wire Google button to `signInWithGoogle()`

**`src/app/components/onboarding/steps/signin-step.tsx`** (sign-in):
- Remove simulated navigation to `/dashboard`
- Call `login({ email, password })`
- Handle `EMAIL_NOT_VERIFIED` → offer link to resend OTP / verify flow
- Handle `UNAUTHORIZED` → show invalid credentials message
- Wire Google button to `signInWithGoogle()`

#### 4. New routes & screens

Add to `src/app/App.tsx` and onboarding routes:

| Route | Purpose |
|---|---|
| `/onboarding/verify-email` | 6-digit OTP input after sign-up |
| `/auth/callback` | Google OAuth return — read `accessToken` from query, store, redirect to dashboard |
| `/reset-password` | Password reset form (token from query `?token=`) |

Backend Google callback redirects to: `{FRONTEND_URL}/auth/callback?accessToken=...`
Backend password reset email links to: `{FRONTEND_URL}/reset-password/?token=...`

#### 5. Protected routes

Wrap `/dashboard` and post-onboarding routes:
- If no valid token → redirect to `/onboarding/sign-in`
- On mount, call `GET /auth/me` to hydrate user
- Auto-refresh tokens before expiry or on 401

#### 6. Onboarding context

Update `src/app/components/onboarding/onboarding-context.tsx`:
- Remove `confirmPassword` from persisted onboarding data (keep client-side validation only)
- After successful register + verify, continue to `/onboarding/church-profile`

### Design & code conventions

- Match existing Eden design system: `EdenField`, `EdenPasswordInput`, `EdenButton`, `OnboardingSplitShell`
- Use `@/` path alias
- Keep changes focused — don't refactor unrelated dashboard files
- Show loading states on submit buttons; disable during requests
- Show API error messages from `message` field
- TypeScript strict — define response/error types in `src/types/auth.ts`

### Files that currently simulate auth (replace)

- `src/app/components/onboarding/steps/welcome-step.tsx` — `setTimeout` + `navigate`
- `src/app/components/onboarding/steps/signin-step.tsx` — `navigate("/dashboard")` on submit
- `src/app/components/register-form.tsx` — unused legacy form (optional cleanup)
- `src/app/components/signin-form.tsx` — unused legacy form (optional cleanup)

### Testing checklist

1. `curl https://api.churcheden.app/health` returns 200
2. Sign up with email/password → receives OTP email → verify → can sign in
3. Sign in with wrong password → shows error
4. Sign in before verify → `EMAIL_NOT_VERIFIED` handled
5. Google OAuth → redirects through backend → lands on `/auth/callback` → dashboard
6. `GET /auth/me` returns user when authenticated
7. Logout clears session
8. Local dev: `.env.development` points to `localhost:3000`
9. Production build: env vars resolve to `churcheden.app` / `api.churcheden.app`

### Do NOT

- Hardcode API URLs
- Commit `.env` (only `.env.example`, `.env.production`, `.env.development`)
- Break existing onboarding UI styling
- Add unnecessary abstractions — one api-client, one auth context, typed API functions

## PROMPT END
