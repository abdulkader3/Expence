# Create Contribution - Postman Testing Guide

## Endpoint Overview

| Method | Endpoint               | Description                       |
| ------ | ---------------------- | --------------------------------- |
| POST   | `/api/v1/transactions` | Create a contribution transaction |

---

## Authentication

This endpoint uses **automatic cookie-based authentication**.

1. Login at `/api/v1/auth/login` with email/password
2. Server sets cookies automatically
3. Call the endpoint - cookies are sent automatically

---

## Headers

| Header          | Required | Description                     |
| --------------- | -------- | ------------------------------- |
| Idempotency-Key | No       | Unique key for retry protection |

---

## Request Body

| Field        | Type   | Required | Default   | Description                  |
| ------------ | ------ | -------- | --------- | ---------------------------- |
| recorded_for | string | Yes      | -         | Partner ID (UUID)            |
| recorded_by  | string | No       | auth user | User ID who recorded         |
| amount       | number | Yes      | -         | Amount (>0)                  |
| currency     | string | No       | BDT       | Currency code                |
| category     | string | No       | -         | Category (e.g., "Equipment") |
| context      | string | No       | -         | Description/context          |
| date         | string | No       | now       | Transaction date (ISO 8601)  |
| receipt_id   | string | No       | -         | Receipt reference ID         |

---

## Test Cases

### 1. Create Contribution (Basic)

**Request:**

```
POST /api/v1/transactions
Content-Type: application/json

{
  "recorded_for": "partner_uuid_here",
  "amount": 1000,
  "category": "Equipment",
  "context": "Ring light"
}
```

**Response (201):**

```json
{
  "transaction": {
    "id": "txn_uuid",
    "recorded_for": "partner_uuid",
    "recorded_by": "user_uuid",
    "amount": 1000,
    "currency": "BDT",
    "category": "Equipment",
    "context": "Ring light",
    "date": "2026-02-19T10:30:00.000Z",
    "created_at": "2026-02-19T10:30:00.000Z"
  },
  "partner_total": 6000
}
```

---

### 2. Create with All Fields

**Request:**

```
POST /api/v1/transactions
Content-Type: application/json

{
  "recorded_for": "partner_uuid_here",
  "amount": 500,
  "currency": "USD",
  "category": "Travel",
  "context": "Flight tickets",
  "date": "2026-02-15T00:00:00.000Z",
  "receipt_id": "RCP-001"
}
```

---

### 3. Idempotent Request (Retry Protection)

Send the same request twice with the same `Idempotency-Key`:

**Request 1:**

```
POST /api/v1/transactions
Idempotency-Key: unique-key-123
Content-Type: application/json

{
  "recorded_for": "partner_uuid_here",
  "amount": 250
}
```

**Response 1 (201):** Created successfully

**Request 2 (same key):**

```
POST /api/v1/transactions
Idempotency-Key: unique-key-123
Content-Type: application/json

{
  "recorded_for": "partner_uuid_here",
  "amount": 250
}
```

**Response 2 (409):** Duplicate request

```json
{
  "success": false,
  "message": "Duplicate idempotent request",
  "data": {
    "transaction": { ... },
    "partner_total": 6250
  }
}
```

---

### 4. Missing Required Field (Should Fail)

**Request:**

```
POST /api/v1/transactions
Content-Type: application/json

{
  "recorded_for": "partner_uuid_here"
}
```

**Response (400):**

```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    { "field": "amount", "message": "Amount must be a positive number" }
  ]
}
```

---

### 5. Invalid Partner (Should Fail)

**Request:**

```
POST /api/v1/transactions
Content-Type: application/json

{
  "recorded_for": "invalid_uuid",
  "amount": 100
}
```

**Response (400):**

```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    { "field": "recorded_for", "message": "Invalid partner ID format" }
  ]
}
```

---

### 6. Partner Not Found (Should Fail)

**Request:**

```
POST /api/v1/transactions
Content-Type: application/json

{
  "recorded_for": "507f1f77bcf86cd799439011",
  "amount": 100
}
```

**Response (404):**

```json
{
  "success": false,
  "message": "Partner not found"
}
```

---

### 7. Without Login (Should Fail)

**Request:**

```
POST /api/v1/transactions
Content-Type: application/json

{
  "recorded_for": "partner_uuid_here",
  "amount": 100
}
```

**Response (401):**

```json
{
  "success": false,
  "message": "unauthorized request"
}
```

---

## Postman Setup

1. **Login first** at `/api/v1/auth/login`
2. **Create new request**:
   - Method: POST
   - URL: `{{baseUrl}}/api/v1/transactions`
   - Body: raw JSON
3. **Add headers** (optional):
   - Idempotency-Key: `{{$randomUUID}}`

---

## Notes

- Amount must be **greater than 0**
- If `recorded_by` is not provided, it defaults to the authenticated user
- `partner_total` is updated atomically using `$inc`
- Idempotency key should be unique per request - reuse the same key to prevent duplicate transactions on retry
