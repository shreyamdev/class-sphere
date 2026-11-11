# Frontend handoff: HttpOnly cookie authentication

The backend now sends ClassSphere access and refresh JWTs as HttpOnly cookies. Login and Google-login JSON responses contain user details and `expiresIn`, but **do not contain `accessToken` or `refreshToken`**.

## Required frontend changes

1. Enable credentials on the shared Axios instance:

```js
const api = axios.create({
  baseURL: `${import.meta.env.VITE_BACKEND_URL}/api`,
  withCredentials: true,
});
```

2. Stop storing or reading `accessToken` and `refreshToken` in `localStorage`/`sessionStorage`. Remove the `Authorization: Bearer ...` request-header logic.

3. After password login or Google login succeeds, use `response.data.data.user` to set the logged-in user in React state. The browser stores the HttpOnly cookies automatically.

4. On app startup, call `GET /auth/me` with the shared Axios instance to restore the current user. If it returns `401`, treat the user as logged out.

5. Refresh without a token in the request body:

```js
await api.post("/auth/refresh");
```

The backend validates the refresh cookie and sends replacement cookies. Do not read or store token values from this response.

6. Logout without a token in the request body:

```js
await api.post("/auth/logout");
```

Then clear the user from React state.

7. When a protected API call returns `401`, the Axios response interceptor can call `/auth/refresh` once and retry the original request. Avoid retry loops for `/auth/refresh`, `/auth/login`, and `/auth/google` themselves.

## Deployment note

Set `NODE_ENV=production` in the backend deployment. The production cookies use `HttpOnly`, `Secure`, and `SameSite=None` because the current frontend and backend are on different domains. The backend CORS/Origin allowlist includes the current Vercel frontend URL; set `FRONTEND_URL` or comma-separated `FRONTEND_URLS` if the frontend uses another domain.

The backend ZIP does not include the frontend source, so these frontend integration edits still need to be applied to the React app before deploying this backend change. Do not deploy only the backend change while the old frontend is still expecting JWT values in JSON/localStorage.
