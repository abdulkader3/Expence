# Partners List Endpoint - Postman Testing Guide

## Endpoint Overview

| Method | Endpoint           | Description                             |
| ------ | ------------------ | --------------------------------------- |
| GET    | `/api/v1/partners` | List all partners with totals, sortable |

---

## Authentication

This endpoint supports **automatic cookie-based authentication**. When you login, the server sets `accessToken` and `refreshToken` cookies. The endpoint automatically reads from these cookies.

**No manual authentication needed** - just login first and cookies will be sent automatically.

### Option 1: Cookie Authentication (Recommended)

1. Login at `/api/v1/auth/login` with email/password
2. Server sets cookies automatically
3. Call `/api/v1/partners` - cookies are sent automatically

### Option 2: Bearer Token (Alternative)

If cookies don't work, you can manually pass the token:

**Request:**

```
GET /api/v1/partners
Authorization: Bearer YOUR_ACCESS_TOKEN
```

---

## Query Parameters

| Parameter            | Type    | Required | Default             | Description                                           |
| -------------------- | ------- | -------- | ------------------- | ----------------------------------------------------- |
| sort_by              | string  | No       | `total_contributed` | Sort by: `total_contributed`, `name`, or `created_at` |
| limit                | number  | No       | 10                  | Number of results to return                           |
| offset               | number  | No       | 0                   | Number of results to skip                             |
| page                 | number  | No       | 1                   | Page number (used if offset not provided)             |
| per_page             | number  | No       | 10                  | Results per page (used if limit not provided)         |
| include_transactions | boolean | No       | false               | Include recent 5 transactions per partner             |

---

## Test Cases

### 1. Get All Partners (Default)

Returns partners sorted by total_contributed (highest first).

**Request:**

```
GET /api/v1/partners
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Expected Response (200):**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "John Doe",
      "avatar_url": "https://...",
      "total_contributed": 5000,
      "last_contribution_at": "2026-02-15T10:30:00.000Z"
    }
  ],
  "meta": {
    "total": 10,
    "page": 1,
    "per_page": 10
  }
}
```

---

### 2. Sort by Name (A-Z)

**Request:**

```
GET /api/v1/partners?sort_by=name
Authorization: Bearer YOUR_ACCESS_TOKEN
```

---

### 3. Sort by Creation Date (Newest First)

**Request:**

```
GET /api/v1/partners?sort_by=created_at
Authorization: Bearer YOUR_ACCESS_TOKEN
```

---

### 4. Pagination - Page 2 with 5 items per page

**Request:**

```
GET /api/v1/partners?page=2&per_page=5
Authorization: Bearer YOUR_ACCESS_TOKEN
```

---

### 5. Include Recent Transactions

**Request:**

```
GET /api/v1/partners?include_transactions=true
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response will include:**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "John Doe",
      "avatar_url": "https://...",
      "total_contributed": 5000,
      "last_contribution_at": "2026-02-15T10:30:00.000Z",
      "recent_transactions": [
        {
          "id": "transaction_uuid",
          "amount": 1000,
          "type": "contribution",
          "description": "Monthly donation",
          "created_at": "2026-02-15T10:30:00.000Z"
        }
      ]
    }
  ]
}
```

---

### 6. Test Without Login (Should Fail)

Make a request **without logging in first** (clear cookies):

**Request:**

```
GET /api/v1/partners
```

**Expected Response (401):**

```json
{
  "success": false,
  "message": "unauthorized request"
}
```

GET /api/v1/partners

````

**Expected Response (401):**

```json
{
  "success": false,
  "message": "unauthorized request"
}
````

---

## Postman Setup Steps

1. **Create a new Collection** (e.g., "Expence API")
2. **Login First** - Make a POST request to `/api/v1/auth/login`:
   ```
   POST /api/v1/auth/login
   Body: { "email": "your@email.com", "password": "yourpassword" }
   ```
3. **Enable Cookies in Postman**:
   - Click the cookie icon (next to the send button)
   - Or go to Settings → Cookies → Enable "Allow cookies to be set"
4. **Test the endpoint**:
   - Method: GET
   - URL: `{{baseUrl}}/api/v1/partners`
   - No Authorization header needed - cookies are sent automatically!

---

## Notes

- Default sorting: `total_contributed` DESC
- When totals are equal, ties are broken by `last_contribution_at` DESC
- `total_contributed` is the sum of all transactions where `type='contribution'`
