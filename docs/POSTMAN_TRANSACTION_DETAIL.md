# Transaction Detail - Postman Testing Guide

## Endpoint Overview

| Method | Endpoint                                | Description                    |
| ------ | --------------------------------------- | ------------------------------ |
| GET    | `/api/v1/transactions/{transaction_id}` | Get a single transaction by ID |

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

## Test Cases

### 1. Get Transaction Detail (Existing)

**Request:**

```
GET /api/v1/transactions/507f1f77bcf86cd799439011
```

**Response (200):**

```json
{
  "transaction": {
    "id": "507f1f77bcf86cd799439011",
    "recorded_for": "partner_uuid",
    "recorded_for_name": "John Doe",
    "recorded_for_email": "john@example.com",
    "recorded_by": "user_uuid",
    "recorded_by_name": "Admin User",
    "recorded_by_email": "admin@example.com",
    "amount": 1000,
    "currency": "BDT",
    "type": "contribution",
    "category": "Equipment",
    "context": "Ring light",
    "description": null,
    "receipt_url": null,
    "receipt_id": "RCP-001",
    "date": "2026-02-15T10:30:00.000Z",
    "created_at": "2026-02-15T10:30:00.000Z",
    "updated_at": "2026-02-15T10:30:00.000Z"
  }
}
```

---

### 2. Transaction Not Found (Should Fail)

**Request:**

```
GET /api/v1/transactions/invalid_id
```

**Response (404):**

```json
{
  "success": false,
  "message": "Transaction not found"
}
```

---

### 3. Without Login (Should Fail)

**Request:**

```
GET /api/v1/transactions/507f1f77bcf86cd799439011
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
   - Method: GET
   - URL: `{{baseUrl}}/api/v1/transactions/{transaction_id}`

---

## Notes

- Returns full transaction details including partner and user information
- Amount is always positive (absolute value)
- Includes all fields: category, context, description, receipt_url, receipt_id
