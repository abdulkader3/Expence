# Get Current User Profile

**Endpoint:** `GET /api/v1/users/me`

**Auth:** Cookies (accessToken, refreshToken)

---

## Test 1: Valid Token → Profile (200)

1. **Method:** GET
2. **URL:** http://localhost:3000/api/v1/users/me
3. **Cookies:** Enabled (Postman handles automatically after login)
4. **Send Request**
5. **Expected Response (200):**

```json
{
  "id": "uuid",
  "name": "string",
  "email": "string",
  "phone": "string|null",
  "company": "string|null",
  "avatar_url": "string|null",
  "roles": ["owner", "partner"],
  "created_at": "ISO8601"
}
```

---

## Test 2: Missing Token → 401

1. **Method:** GET
2. **URL:** http://localhost:3000/api/v1/users/me
3. **Cookies:** Clear cookies or use incognito
4. **Send Request**
5. **Expected Response (401):**

```json
{
  "success": false,
  "message": "unauthorized request"
}
```

---

## How it works

1. **Login:** POST `/api/v1/auth/login` with email & password
2. **Tokens:** Automatically stored in HTTP-only cookies
3. **Profile:** Just call `/api/v1/users/me` - cookies are sent automatically

No manual token copying needed!
