# Sync Offline Queue - Postman Testing Guide

## Overview

This endpoint accepts queued actions from offline clients and applies them server-side idempotently.

---

## Endpoint Details

| Attribute    | Value                     |
| ------------ | ------------------------- |
| **Method**   | POST                      |
| **Path**     | `{{base_url}}/sync/queue` |
| **Auth**     | Bearer Token              |
| **Response** | 200 OK                    |

---

## Headers

| Header        | Value                     |
| ------------- | ------------------------- |
| Content-Type  | application/json          |
| Authorization | Bearer `{{access_token}}` |

---

## Request Body

```json
{
  "device_id": "device_123",
  "queue": [
    {
      "local_id": "local_xyz",
      "action": "addContribution",
      "payload": {
        "recorded_for": "partner_id",
        "amount": 5000,
        "currency": "BDT",
        "category": "Monthly",
        "context": "Donation"
      },
      "timestamp": "2024-01-15T10:30:00.000Z",
      "idempotency_key": "unique_key_123"
    }
  ]
}
```

### Request Fields

| Field                   | Type   | Required | Description                                         |
| ----------------------- | ------ | -------- | --------------------------------------------------- |
| device_id               | string | Yes      | Unique identifier for the device                    |
| queue                   | array  | Yes      | Array of queued actions to process                  |
| queue[].local_id        | string | Yes      | Client-generated unique ID for this action          |
| queue[].action          | string | Yes      | Action type: "addContribution" or "undoTransaction" |
| queue[].payload         | object | Yes      | Action-specific payload                             |
| queue[].timestamp       | string | No       | ISO timestamp of when action was created offline    |
| queue[].idempotency_key | string | No       | Unique key to prevent duplicate processing          |

### Action: addContribution

| Payload Field | Type   | Required | Description                  |
| ------------- | ------ | -------- | ---------------------------- |
| recorded_for  | string | Yes      | Partner ID                   |
| amount        | number | Yes      | Contribution amount          |
| currency      | string | No       | Currency code (default: BDT) |
| category      | string | No       | Category of contribution     |
| context       | string | No       | Additional context           |
| receipt_id    | string | No       | Receipt ID if any            |

### Action: undoTransaction

| Payload Field  | Type   | Required | Description                   |
| -------------- | ------ | -------- | ----------------------------- |
| transaction_id | string | Yes      | ID of the transaction to undo |
| reason         | string | No       | Reason for undo               |

---

## Response (200 OK)

```json
{
  "results": [
    {
      "local_id": "local_xyz",
      "status": "ok",
      "server_id": "txn_uuid"
    }
  ],
  "summary": {
    "total": 1,
    "success": 1,
    "failed": 0
  }
}
```

### Response Fields

| Field               | Type    | Description                                |
| ------------------- | ------- | ------------------------------------------ |
| results             | array   | Array of results for each queued action    |
| results[].local_id  | string  | The local_id from the request              |
| results[].status    | string  | "ok" or "error"                            |
| results[].server_id | string  | Server-generated ID for successful actions |
| results[].error     | string  | Error message for failed actions           |
| results[].duplicate | boolean | true if action was already processed       |
| summary.total       | number  | Total items in queue                       |
| summary.success     | number  | Number of successfully processed items     |
| summary.failed      | number  | Number of failed items                     |

---

## Error Responses

### 400 Bad Request - Missing device_id

```json
{
  "success": false,
  "message": "device_id is required"
}
```

### 400 Bad Request - Invalid queue

```json
{
  "success": false,
  "message": "queue must be a non-empty array"
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

### Step 2: Sync Single Contribution

1. Create a new POST request
2. URL: `{{base_url}}/sync/queue`
3. Add Authorization header: `Bearer {{access_token}}`
4. Add Content-Type: `application/json`
5. Add request body with one addContribution action
6. Send the request
7. Verify response status is 200
8. Verify results[0].status is "ok"
9. Verify results[0].server_id contains a transaction ID

### Step 3: Sync Multiple Actions

1. Create request with multiple actions in queue
2. Include both addContribution and undoTransaction actions
3. Send the request
4. Verify each action has its own result entry

### Step 4: Test Idempotency (Replaying Queue)

1. Send the same queue again with same idempotency_key
2. Verify results show "duplicate": true
3. Verify no duplicate transactions created

### Step 5: Test Partial Failure

1. Send queue with one valid and one invalid action
2. Verify valid action succeeds
3. Verify invalid action fails with error message

### Step 6: Test Undo Transaction

1. First add a contribution to get a transaction_id
2. Send undoTransaction action in queue
3. Verify transaction is undone and totals updated

---

## Test Cases

### Test Case 1: Single Contribution Sync

- Send queue with one addContribution action
- **Expected**: 200 + status "ok" + server_id

### Test Case 2: Multiple Actions

- Send queue with 3 actions (mix of add and undo)
- **Expected**: 200 + results for each action

### Test Case 3: Duplicate Prevention

- Send same queue twice with same idempotency_key
- **Expected**: Second request returns duplicate: true, no new transactions

### Test Case 4: Partial Failure

- Send queue with 1 valid + 1 invalid action
- **Expected**: 200 + 1 success + 1 failed in summary

### Test Case 5: Invalid Partner

- Send addContribution with non-existent partner_id
- **Expected**: status "error" with "Partner not found"

### Test Case 6: Invalid Transaction for Undo

- Send undoTransaction with non-existent transaction_id
- **Expected**: status "error" with "Original transaction not found"

### Test Case 7: Missing Required Fields

- Send action without required payload fields
- **Expected**: status "error" with missing fields message

### Test Case 8: Unknown Action

- Send queue with unrecognized action type
- **Expected**: status "error" with "Unknown action" message

---

## Important Notes

1. **Idempotency**: Uses idempotency_key or local_id to prevent duplicate processing

2. **Partial Success**: Each item is processed independently - failures don't stop other items

3. **Atomicity**: Not atomic across the whole batch - individual items can succeed/fail independently

4. **Supported Actions**: Currently supports "addContribution" and "undoTransaction"

5. **Timestamps**: If timestamp provided, uses it for transaction_date; otherwise uses server time

6. **Partner Totals**: Automatically updates partner's total_contributed for both add and undo
