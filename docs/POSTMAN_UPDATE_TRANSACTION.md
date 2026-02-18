# Update Transaction - Postman Testing Guide

## Endpoint Overview

| Method | Endpoint                                | Description          |
| ------ | --------------------------------------- | -------------------- |
| PATCH  | `/api/v1/transactions/{transaction_id}` | Update a transaction |

---

## Authentication

This endpoint uses **automatic cookie-based authentication**.

1. Login at `/api/v1/auth/login` with email/password
2. Server sets cookies automatically
3. Call the endpoint - cookies are sent automatically

---

## Path Parameters

| Parameter      | Type   | Required | Description                        |
| -------------- | ------ | -------- | ---------------------------------- |
| transaction_id | string | Yes      | The transaction's unique ID (UUID) |

---

## Request Body

| Field        | Type   | Required | Description                                |
| ------------ | ------ | -------- | ------------------------------------------ |
| amount       | number | No       | New amount                                 |
| category     | string | No       | New category                               |
| context      | string | No       | New context/description                    |
| date         | string | No       | Transaction date (ISO 8601)                |
| receipt_id   | string | No       | Receipt reference ID                       |
| recorded_for | string | No       | Reassign to different partner (partner ID) |

---

## Behavior

This endpoint uses **Audit-Friendly Approach (B)**:

- When amount changes, an **adjustment transaction** is created
- Original transaction is marked with "(adjusted)" in description
- Partner totals are updated atomically via transactions

---

## Test Cases

### 1. Update Transaction Amount

**Request:**

```
PATCH /api/v1/transactions/507f1f77bcf86cd799439011
Content-Type: application/json

{
  "amount": 1500
}
```

**Response (200):**

```json
{
  "transaction": {
    "id": "507f1f77bcf86cd799439011",
    "recorded_for": "partner_uuid",
    "recorded_for_name": "John Doe",
    "recorded_by": "user_uuid",
    "amount": 1500,
    "currency": "BDT",
    "type": "contribution",
    "category": "Equipment",
    "context": "Ring light",
    "date": "2026-02-15T10:30:00.000Z",
    "created_at": "2026-02-15T10:30:00.000Z"
  },
  "partner_total": 6500
}
```

An adjustment transaction of +500 is created automatically.

---

### 2. Update Category and Context

**Request:**

```
PATCH /api/v1/transactions/507f1f77bcf86cd799439011
Content-Type: application/json

{
  "category": "Travel",
  "context": "Flight tickets"
}
```

---

### 3. Reassign to Different Partner

**Request:**

```
PATCH /api/v1/transactions/507f1f77bcf86cd799439011
Content-Type: application/json

{
  "recorded_for": "new_partner_uuid"
}
```

- Old partner's total decreases
- New partner's total increases

---

### 4. Update Date

**Request:**

```
PATCH /api/v1/transactions/507f1f77bcf86cd799439011
Content-Type: application/json

{
  "date": "2026-01-15T00:00:00.000Z"
}
```

---

### 5. Transaction Not Found (Should Fail)

**Request:**

```
PATCH /api/v1/transactions/invalid_id
Content-Type: application/json

{
  "amount": 1000
}
```

**Response (404):**

```json
{
  "success": false,
  "message": "Transaction not found"
}
```

---

### 6. Without Login (Should Fail)

**Request:**

```
PATCH /api/v1/transactions/507f1f77bcf86cd799439011
Content-Type: application/json

{
  "amount": 1000
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
   - Method: PATCH
   - URL: `{{baseUrl}}/api/v1/transactions/{transaction_id}`
   - Body: raw JSON

---

## Notes

- Uses **audit-friendly approach**: creates adjustment transactions instead of direct edits
- When amount changes, an adjustment transaction is created with type "adjustment"
- Partner totals are updated atomically using MongoDB transactions
- If recorded_for changes, both old and new partner totals are updated
- Only `contribution` type transactions can be edited
