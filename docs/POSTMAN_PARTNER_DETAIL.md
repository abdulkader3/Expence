# Partner Detail & Ledger - Postman Testing Guide

## Endpoint Overview

| Method | Endpoint                        | Description                              |
| ------ | ------------------------------- | ---------------------------------------- |
| GET    | `/api/v1/partners/{partner_id}` | Get partner info and transactions ledger |

---

## Authentication

This endpoint uses **automatic cookie-based authentication** (same as other endpoints).

1. Login at `/api/v1/auth/login` with email/password
2. Server sets cookies automatically
3. Call the endpoint - cookies are sent automatically

---

## Path Parameters

| Parameter  | Type   | Required | Description                    |
| ---------- | ------ | -------- | ------------------------------ |
| partner_id | string | Yes      | The partner's unique ID (UUID) |

---

## Query Parameters

| Parameter | Type   | Required | Default | Description                                      |
| --------- | ------ | -------- | ------- | ------------------------------------------------ |
| from      | string | No       | -       | Start date (ISO 8601, e.g., `2026-01-01`)        |
| to        | string | No       | -       | End date (ISO 8601, e.g., `2026-12-31`)          |
| category  | string | No       | -       | Filter by category (e.g., "Equipment", "Travel") |
| search    | string | No       | -       | Search in context and description fields         |
| page      | number | No       | 1       | Page number                                      |
| per_page  | number | No       | 10      | Results per page                                 |

---

## Test Cases

### 1. Get Partner Detail (No Filters)

**Request:**

```
GET /api/v1/partners/507f1f77bcf86cd799439011
```

**Response (200):**

```json
{
  "partner": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "avatar_url": "https://...",
    "notes": "Regular contributor",
    "total_contributed": 5000
  },
  "transactions": [
    {
      "id": "transaction_uuid",
      "type": "contribution",
      "amount": 1000,
      "category": "Equipment",
      "context": "Ring light",
      "recorded_by": "user_uuid",
      "date": "2026-02-15T10:30:00.000Z",
      "receipt_url": null
    }
  ],
  "meta": {
    "total_transactions": 25
  }
}
```

---

### 2. Filter by Date Range

**Request:**

```
GET /api/v1/partners/507f1f77bcf86cd799439011?from=2026-01-01&to=2026-06-30
```

Returns only transactions created between Jan 1, 2026 and June 30, 2026.

---

### 3. Filter by Category

**Request:**

```
GET /api/v1/partners/507f1f77bcf86cd799439011?category=Equipment
```

Returns only transactions with category "Equipment".

---

### 4. Search in Context/Description

**Request:**

```
GET /api/v1/partners/507f1f77bcf86cd799439011?search=ring
```

Returns transactions where "ring" appears in context or description.

---

### 5. Pagination

**Request:**

```
GET /api/v1/partners/507f1f77bcf86cd799439011?page=2&per_page=5
```

Returns page 2 with 5 transactions per page.

---

### 6. Combine Multiple Filters

**Request:**

```
GET /api/v1/partners/507f1f77bcf86cd799439011?from=2026-01-01&to=2026-12-31&category=Travel&search=flight&page=1&per_page=10
```

---

### 7. Partner Not Found (Should Fail)

**Request:**

```
GET /api/v1/partners/invalid_id
```

**Expected Response (404):**

```json
{
  "success": false,
  "message": "Partner not found"
}
```

---

### 8. Without Login (Should Fail)

**Request:**

```
GET /api/v1/partners/507f1f77bcf86cd799439011
```

**Expected Response (401):**

```json
{
  "success": false,
  "message": "unauthorized request"
}
```

---

## Postman Setup

1. **Login first** (see Partners List documentation)
2. **Create new request**:
   - Method: GET
   - URL: `{{baseUrl}}/api/v1/partners/{partner_id}`
3. **Add query params** as needed in the "Params" tab

---

## Notes

- Transaction amounts are always returned as **positive numbers** (no negative signs)
- `recorded_by` returns the user ID who created the transaction
- Date filtering uses the transaction's `created_at` timestamp
- Search is case-insensitive and matches partial strings
