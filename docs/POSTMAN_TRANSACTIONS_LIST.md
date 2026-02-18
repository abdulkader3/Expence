# Transactions List - Postman Testing Guide

## Endpoint Overview

| Method | Endpoint               | Description                            |
| ------ | ---------------------- | -------------------------------------- |
| GET    | `/api/v1/transactions` | Get paginated list of all transactions |

---

## Authentication

This endpoint uses **automatic cookie-based authentication**.

1. Login at `/api/v1/auth/login` with email/password
2. Server sets cookies automatically
3. Call the endpoint - cookies are sent automatically

---

## Query Parameters

| Parameter    | Type   | Required | Default   | Description                        |
| ------------ | ------ | -------- | --------- | ---------------------------------- |
| recorded_for | string | No       | -         | Filter by partner ID               |
| recorded_by  | string | No       | -         | Filter by user ID who recorded     |
| date_from    | string | No       | -         | Start date (ISO 8601)              |
| date_to      | string | No       | -         | End date (ISO 8601)                |
| category     | string | No       | -         | Filter by category                 |
| q            | string | No       | -         | Text search on context/description |
| page         | number | No       | 1         | Page number                        |
| per_page     | number | No       | 10        | Results per page                   |
| sort_by      | string | No       | date_desc | Sort: `date_desc` or `date_asc`    |

---

## Headers (CSV Export)

| Header | Value      | Description                    |
| ------ | ---------- | ------------------------------ |
| Accept | `text/csv` | Get CSV export instead of JSON |

---

## Test Cases

### 1. Get All Transactions (No Filters)

**Request:**

```
GET /api/v1/transactions
```

**Response (200):**

```json
{
  "data": [
    {
      "id": "txn_uuid",
      "recorded_for": "partner_uuid",
      "recorded_for_name": "John Doe",
      "recorded_by": "user_uuid",
      "amount": 1000,
      "currency": "BDT",
      "type": "contribution",
      "category": "Equipment",
      "context": "Ring light",
      "date": "2026-02-15T10:30:00.000Z",
      "created_at": "2026-02-15T10:30:00.000Z"
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "per_page": 10
  }
}
```

---

### 2. Filter by Partner

**Request:**

```
GET /api/v1/transactions?recorded_for=partner_uuid_here
```

---

### 3. Filter by Date Range

**Request:**

```
GET /api/v1/transactions?date_from=2026-01-01&date_to=2026-06-30
```

---

### 4. Filter by Category

**Request:**

```
GET /api/v1/transactions?category=Equipment
```

---

### 5. Text Search

**Request:**

```
GET /api/v1/transactions?q=ring
```

Searches in context and description fields.

---

### 6. Combine Multiple Filters

**Request:**

```
GET /api/v1/transactions?recorded_for=partner_uuid&date_from=2026-01-01&date_to=2026-12-31&category=Travel&q=flight&page=1&per_page=20
```

---

### 7. Pagination

**Request:**

```
GET /api/v1/transactions?page=2&per_page=5
```

---

### 8. Sort Ascending by Date

**Request:**

```
GET /api/v1/transactions?sort_by=date_asc
```

---

### 9. CSV Export

**Request:**

```
GET /api/v1/transactions?date_from=2026-01-01
Accept: text/csv
```

**Response:**

```
ID,Partner,Amount,Currency,Category,Context,Date,Recorded By,Created At
txn_uuid,John Doe,1000,BDT,Equipment,Ring light,2026-02-15T10:30:00.000Z,Admin User,2026-02-15T10:30:00.000Z
```

Returns a downloadable CSV file.

---

### 10. Without Login (Should Fail)

**Request:**

```
GET /api/v1/transactions
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
   - URL: `{{baseUrl}}/api/v1/transactions`
3. **Add query params** as needed in the "Params" tab
4. **For CSV export**: Add header `Accept` = `text/csv`

---

## Notes

- Default sort is newest first (`date_desc`)
- Results include partner name via population
- CSV export includes all filtered results (no pagination)
- Text search (`q`) is case-insensitive
