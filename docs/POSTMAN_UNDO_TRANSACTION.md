# Undo Transaction - Postman Testing Guide

## Overview

This endpoint allows you to undo a previously created transaction by creating a reversing transaction rather than deleting it (for audit purposes).

---

## Endpoint Details

| Attribute    | Value                                            |
| ------------ | ------------------------------------------------ |
| **Method**   | POST                                             |
| **Path**     | `{{base_url}}/transactions/:transaction_id/undo` |
| **Auth**     | Bearer Token                                     |
| **Response** | 201 Created                                      |

---

## Headers

| Header        | Value                     |
| ------------- | ------------------------- |
| Content-Type  | application/json          |
| Authorization | Bearer `{{access_token}}` |

---

## Request Body

| Field  | Type   | Required | Description                                 |
| ------ | ------ | -------- | ------------------------------------------- |
| reason | string | No       | Optional reason for undoing the transaction |

### Example Request Body

```json
{
  "reason": "Incorrect amount entered"
}
```

---

## Response (201 Created)

```json
{
  "undo_transaction": {
    "id": "uuid",
    "type": "undo",
    "amount": 1000,
    "related_to": "original_transaction_id"
  },
  "partner_total": 5000
}
```

### Response Fields

| Field                       | Type   | Description                                 |
| --------------------------- | ------ | ------------------------------------------- |
| undo_transaction.id         | string | ID of the new undo transaction              |
| undo_transaction.type       | string | Always "undo"                               |
| undo_transaction.amount     | number | The amount that was undone (positive value) |
| undo_transaction.related_to | string | ID of the original transaction              |
| partner_total               | number | Updated total contributed by the partner    |

---

## Error Responses

### 401 Unauthorized

```json
{
  "success": false,
  "message": "Invalid token or token expired"
}
```

### 404 Not Found

```json
{
  "success": false,
  "message": "Transaction not found"
}
```

### 400 Bad Request

```json
{
  "success": false,
  "message": "This transaction has already been undone"
}
```

---

## Testing Steps

### Step 1: Get an Access Token

1. Use the login endpoint to get an access token
2. Save the token as `{{access_token}}` in Postman

### Step 2: Create a Test Transaction

1. Create a contribution transaction first (for testing undo)
2. Copy the `id` from the response - this is your `{{transaction_id}}`

### Step 3: Undo the Transaction

1. Set up a new POST request
2. URL: `{{base_url}}/transactions/{{transaction_id}}/undo`
3. Add Authorization header: `Bearer {{access_token}}`
4. Add Content-Type: `application/json`
5. Optional: Add request body with reason
6. Send the request
7. Verify response status is 201
8. Verify partner_total decreased by the transaction amount

### Step 4: Verify the Undo

1. Get the partner details to verify total_contributed changed
2. List transactions to see both original and undo transactions

---

## Test Cases

### Test Case 1: Undo Within 5 Seconds

- Create a new transaction
- Immediately undo it
- **Expected**: Undo succeeds, totals revert correctly
- **is_reversing**: false

### Test Case 2: Undo After 5 Seconds (Simulating Sync)

- Create a new transaction
- Wait 5+ seconds
- Undo the transaction
- **Expected**: Undo succeeds with is_reversing: true
- **Note**: The undo transaction still created, totals still revert

### Test Case 3: Double Undo Prevention

- Undo a transaction that was already undone
- **Expected**: 400 error "This transaction has already been undone"

### Test Case 4: Undo Non-Existent Transaction

- Try to undo a transaction that doesn't exist
- **Expected**: 404 error "Transaction not found"

---

## Important Notes

1. **No Physical Deletion**: The original transaction is never deleted - a new undo transaction is created instead (for audit trail)

2. **Partner Total**: The partner's `total_contributed` is automatically updated when undo is created

3. **Metadata**: The undo transaction stores:

   - `related_to`: Links to original transaction
   - `is_reversing`: true if undo happened after 5 seconds (simulating post-sync undo)
   - `description`: Shows reason if provided

4. **Transaction Type**: New transaction type "undo" is added to track these reversals separately
