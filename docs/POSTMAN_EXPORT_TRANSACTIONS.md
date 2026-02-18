# Export Transactions CSV - Postman Testing Guide

## Overview

This endpoint exports transactions as a CSV file with support for filtering and streaming for large datasets.

---

## Endpoint Details

| Attribute    | Value                               |
| ------------ | ----------------------------------- |
| **Method**   | GET                                 |
| **Path**     | `{{base_url}}/exports/transactions` |
| **Auth**     | Bearer Token                        |
| **Response** | 200 text/csv                        |

---

## Headers

| Header        | Value                     |
| ------------- | ------------------------- |
| Authorization | Bearer `{{access_token}}` |

---

## Query Parameters

| Parameter    | Type   | Required | Description                               |
| ------------ | ------ | -------- | ----------------------------------------- |
| recorded_for | string | No       | Filter by partner/partner ID              |
| date_from    | string | No       | Filter transactions from this date (ISO)  |
| date_to      | string | No       | Filter transactions until this date (ISO) |
| category     | string | No       | Filter by category                        |

---

## Response (200 OK)

**Content-Type**: text/csv  
**Content-Disposition**: attachment; filename="transactions_YYYYMMDD.csv"

### CSV Headers

```
id,recorded_for,recorded_by,amount,currency,category,context,date,receipt_url
```

### Example CSV Content

```
id,recorded_for,recorded_by,amount,currency,category,context,date,receipt_url
65abc123,John Doe,Admin User,5000,BDT,Monthly,Donation,2024-01-15T10:00:00.000Z,
65abc124,Jane Smith,Admin User,3000,BDT,One-time,Support,2024-01-14T09:30:00.000Z,https://cloudinary.com/...
```

---

## Error Responses

### 400 Bad Request - Invalid Partner ID

```json
{
  "success": false,
  "message": "Invalid partner ID format"
}
```

### 401 Unauthorized

```json
{
  "success": false,
  "message": "Invalid token or token expired"
}
```

---

## Testing Steps

### Step 1: Get an Access Token

1. Use the login endpoint to get an access token
2. Save the token as `{{access_token}}` in Postman

### Step 2: Export All Transactions

1. Create a new GET request
2. URL: `{{base_url}}/exports/transactions`
3. Add Authorization header: `Bearer {{access_token}}`
4. Send the request
5. Verify response status is 200
6. Verify Content-Type is "text/csv"
7. Verify Content-Disposition header contains "attachment"
8. Verify CSV has header row and data rows

### Step 3: Filter by Partner

1. Add query param: `?recorded_for=<partner_id>`
2. Send the request
3. Verify only transactions for that partner are included

### Step 4: Filter by Date Range

1. Add query params: `?date_from=2024-01-01&date_to=2024-01-31`
2. Send the request
3. Verify only transactions within the date range are included

### Step 5: Filter by Category

1. Add query param: `?category=Monthly`
2. Send the request
3. Verify only transactions with that category are included

### Step 6: Combined Filters

1. Add multiple filters: `?recorded_for=<id>&date_from=2024-01-01&category=Monthly`
2. Send the request
3. Verify only matching transactions are included

---

## Test Cases

### Test Case 1: Export All Transactions

- Call without any filters
- **Expected**: 200 + CSV with all transactions
- **Filename**: transactions_YYYYMMDD.csv

### Test Case 2: Filter by Partner

- Call with `?recorded_for=<partner_id>`
- **Expected**: Only transactions for that partner

### Test Case 3: Filter by Date Range

- Call with `?date_from=2024-01-01&date_to=2024-01-31`
- **Expected**: Only transactions in January 2024

### Test Case 4: Filter by Category

- Call with `?category=Monthly`
- **Expected**: Only Monthly category transactions

### Test Case 5: Invalid Partner ID

- Call with invalid partner ID format
- **Expected**: 400 error "Invalid partner ID format"

### Test Case 6: Empty Result

- Call with filters that match no transactions
- **Expected**: 200 + CSV with only header row

### Test Case 7: Large Dataset

- Export thousands of transactions
- **Expected**: Stream works without OOM (Out of Memory)

---

## Important Notes

1. **Streaming**: Uses MongoDB cursor for streaming - handles large datasets without loading all into memory

2. **Filename**: Automatically generated with current date format: transactions_YYYYMMDD.csv

3. **Headers**: Always includes header row: id,recorded_for,recorded_by,amount,currency,category,context,date,receipt_url

4. **Sorting**: Results sorted by transaction date (newest first)

5. **Empty Fields**: Empty fields are represented as empty strings in CSV

6. **Date Format**: Dates are in ISO 8601 format
