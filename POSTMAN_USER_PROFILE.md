# User Profile Endpoints

Base URL: `http://localhost:5000/api/v1/users/me`

Auth: Cookies (accessToken, refreshToken) - automatically handled after login

---

## GET /users/me - Get Profile

### Test 1: Valid Token → Profile (200)

1. **Method:** GET
2. **URL:** http://localhost:5000/api/v1/users/me
3. **Send Request**
4. **Expected Response (200):**

```json
{
  "id": "uuid",
  "name": "string",
  "email": "string",
  "phone": "string|null",
  "company": "string|null",
  "avatar_url": "string|null",
  "roles": [],
  "created_at": "ISO8601"
}
```

### Test 2: Missing Token → 401

1. **Method:** GET
2. **URL:** http://localhost:5000/api/v1/users/me
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

## PATCH /users/me - Update Profile

### Test 1: Update Name → Persisted (200)

1. **Method:** PATCH
2. **URL:** http://localhost:5000/api/v1/users/me
3. **Body (JSON):**

```json
{
  "name": "John Doe"
}
```

4. **Send Request**
5. **Expected Response (200):**

```json
{
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "user@example.com",
    "phone": null,
    "company": null,
    "avatar_url": null,
    "roles": [],
    "created_at": "ISO8601"
  }
}
```

### Test 2: Update Multiple Fields (200)

1. **Method:** PATCH
2. **URL:** http://localhost:5000/api/v1/users/me
3. **Body (form-data):**

| Key     | Value       |
| ------- | ----------- |
| phone   | +1234567890 |
| company | Acme Inc    |

4. **Send Request**
5. **Expected Response (200):** User object with updated fields

### Test 3: Upload Avatar (200)

1. **Method:** PATCH
2. **URL:** http://localhost:5000/api/v1/users/me
3. **Body (form-data):**

| Key    | Value                  |
| ------ | ---------------------- |
| avatar | [Select an image file] |

4. **Send Request**
5. **Expected Response (200):**

```json
{
  "user": {
    "id": "uuid",
    "name": "string",
    "email": "user@example.com",
    "phone": null,
    "company": null,
    "avatar_url": "https://res.cloudinary.com/.../image.jpg",
    "roles": [],
    "created_at": "ISO8601"
  }
}
```

### Test 4: Attempt to Change Email → 400
  
1. **Method:** PATCH
2. **URL:** http://localhost:5000/api/v1/users/me
3. **Body (JSON):**

```json
{
  "email": "newemail@example.com"
}
```

4. **Send Request**
5. **Expected Response (400):**

```json
{
  "success": false,
  "message": "Email cannot be changed via this endpoint"
}
```

### Test 4: Attempt to Change Email → 400

1. **Method:** PATCH
2. **URL:** http://localhost:5000/api/v1/users/me
3. **Body (JSON):**

```json
{}
```

4. **Send Request**
5. **Expected Response (400):**

```json
{
  "success": false,
  "message": "No valid fields to update"
}
```

---

## How to Test

1. **Login first:** POST `/api/v1/auth/login` with email & password
2. **Tokens:** Automatically stored in cookies
3. **Test endpoints:** Just make requests - cookies sent automatically
