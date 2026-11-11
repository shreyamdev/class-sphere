# Authentication APIs

Base URL: `http://localhost:5000`.

## 1. Health check

**GET** `/api/health` — public; no request body.

Example response `200`:
```json
{
  "success": true,
  "data": {
    "status": "OK",
    "service": "ClassSphere API"
  }
}
```

## 2. Register

**POST** `/api/auth/register` — public. Starts email OTP verification. The role defaults to `student` if omitted.

Request:
```json
{
  "name": "Aarav Sharma",
  "email": "aarav@example.com",
  "password": "YourStrongPassword",
  "role": "student"
}
```

Rules: name 2–80 characters; valid email; password at least 8 characters and at most 72 UTF-8 bytes; role must be `student` or `teacher`.

Response `201`:
```json
{
  "success": true,
  "message": "Registration successful. Verify your email using the OTP sent to you.",
  "data": {
    "userId": "671234567890abcdef123456",
    "name": "Aarav Sharma",
    "email": "aarav@example.com",
    "role": "student",
    "isEmailVerified": false,
    "otpExpiresInMinutes": 10
  }
}
```
`otpExpiresInMinutes` is configuration-driven; the value above is illustrative.

## 3. Verify email OTP

**POST** `/api/auth/verify-otp` — public.

Request:
```json
{
  "email": "aarav@example.com",
  "otp": "123456"
}
```

Success `200`:
```json
{
  "success": true,
  "message": "Email verified successfully. You can now log in."
}
```
OTP must be six digits. An expired/incorrect OTP returns `400`; excessive attempts can return `429`.

## 4. Resend OTP

**POST** `/api/auth/resend-otp` — public.

Request:
```json
{ "email": "aarav@example.com" }
```

Success `200`:
```json
{
  "success": true,
  "message": "A new OTP has been sent to your email.",
  "data": {
    "email": "aarav@example.com",
    "expiresInMinutes": 10,
    "resendCooldownSeconds": 60
  }
}
```
Timing values are configuration-driven/implementation constants; confirm the actual values in `src/utils/otp.js`.

## 5. Login

**POST** `/api/auth/login` — public; email must be verified.

Request (role is required and must match the role selected on the login screen):
```json
{
  "email": "aarav@example.com",
  "password": "YourStrongPassword",
  "role": "student"
}
```

If the account is stored as a different role, the API returns `403` with `code: "ROLE_MISMATCH"` and does not create a session. If role is missing or invalid, it returns `400` with `code: "LOGIN_FIELDS_INVALID"`. The role is compared to the database record; it is never updated by login.

Success `200`:
```json
{
  "success": true,
  "message": "Authentication successful.",
  "data": {
    "user": {
      "id": "671234567890abcdef123456",
      "name": "Aarav Sharma",
      "email": "aarav@example.com",
      "role": "student"
    },
    "expiresIn": "15m"
  }
}
```

The backend also sets two **HttpOnly cookies** (`classsphere_access` and `classsphere_refresh`). Tokens are not included in the JSON response and frontend JavaScript cannot read the cookies. The frontend must send requests with credentials enabled (`withCredentials: true` in Axios / `credentials: "include"` in fetch).

## 6. Google sign-in

**POST** `/api/auth/google` — public. Send the Google Identity SDK's **ID token**, not the ClassSphere access token.

Request for a new Google account:
```json
{
  "idToken": "<GOOGLE_ID_TOKEN>",
  "role": "student"
}
```
`role` is required for every Google login. For an existing account, the requested role must match the stored role; a mismatch returns `403 ROLE_MISMATCH` and no session. The backend never changes an existing account's role during login.

Success `200`:
```json
{
  "success": true,
  "message": "Google authentication successful.",
  "data": {
    "user": {
      "id": "671234567890abcdef123456",
      "name": "Aarav Sharma",
      "email": "aarav@example.com",
      "role": "student",
      "isEmailVerified": true
    },
    "expiresIn": "15m"
  }
}
```

## 7. Refresh session

**POST** `/api/auth/refresh` — public route; requires the HttpOnly refresh cookie. No request body is required.

On success, the backend rotates both cookies and returns the user information and access-token expiry. The token values remain out of the JSON response. Reusing an old refresh cookie is rejected.

## 8. Logout

**POST** `/api/auth/logout` — public route; no request body is required. The backend revokes the refresh session (when valid) and clears both cookies.

Success `200`:
```json
{
  "success": true,
  "message": "Logged out successfully."
}
```

## 9. Current user

**GET** `/api/auth/me` — protected.

The browser sends the HttpOnly access cookie automatically when credentials are enabled. Do not read a JWT from localStorage or add an `Authorization: Bearer` header.

Success `200`:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "671234567890abcdef123456",
      "name": "Aarav Sharma",
      "email": "aarav@example.com",
      "role": "student"
    }
  }
}
```
Use this endpoint to debug role/token mismatches. A teacher-only endpoint requires `data.user.role` to be `teacher`.

## Security and rate limits

- Passwords are hashed with bcrypt (12 salt rounds); raw passwords are never returned.
- OTPs are stored as hashes and have expiry/attempt/cooldown rules.
- Access token default lifetime is `15m`; refresh token default lifetime is `7d`, configurable via environment variables.
- Access and refresh JWTs are stored in HttpOnly cookies with `Secure` and `SameSite=None` in production, and are not returned in JSON.
- Browser write requests are checked against the configured frontend Origin.
- Registration, login, Google login, OTP, refresh, logout and classroom joining have rate limits. Respect `429` responses rather than retrying in a tight loop.
- In production, set `NODE_ENV=production`. Set `FRONTEND_URL` (or comma-separated `FRONTEND_URLS`) to the exact frontend origin if it differs from the default Vercel URL. Local development uses `SameSite=Lax` and does not require HTTPS.
