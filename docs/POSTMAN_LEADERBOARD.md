# Get Leaderboard - Postman Testing Guide

## Overview

This endpoint returns a leaderboard of partners sorted by total_contributed in descending order.

---

## Endpoint Details

| Attribute    | Value                               |
| ------------ | ----------------------------------- |
| **Method**   | GET                                 |
| **Path**     | `{{base_url}}/partners/leaderboard` |
| **Auth**     | Bearer Token                        |
| **Response** | 200 OK                              |

---

## Headers

| Header        | Value                     |
| ------------- | ------------------------- |
| Authorization | Bearer `{{access_token}}` |

---

## Query Parameters

| Parameter                   | Type    | Required | Default | Description                               |
| --------------------------- | ------- | -------- | ------- | ----------------------------------------- |
| limit                       | number  | No       | 10      | Number of partners to return              |
| include_recent_transactions | boolean | No       | false   | Include recent 5 transactions per partner |

---

## Response (200 OK)

```json
{
  "data": [
    {
      "partner_id": "uuid",
      "name": "John Doe",
      "avatar_url": "https://res.cloudinary.com/.../avatar.jpg",
      "total_contributed": 11500,
      "rank": 1,
      "top_contributor": true,
      "last_contribution_at": "2024-01-15T10:30:00.000Z"
    },
    {
      "partner_id": "uuid",
      "name": "Jane Smith",
      "avatar_url": "https://res.cloudinary.com/.../avatar.jpg",
      "total_contributed": 10000,
      "rank": 2,
      "top_contributor": false,
      "last_contribution_at": "2024-01-14T09:00:00.000Z"
    }
  ],
  "meta": {
    "as_of": "2024-01-15T12:00:00.000Z"
  }
}
```

### Response Fields

| Field                       | Type    | Description                                     |
| --------------------------- | ------- | ----------------------------------------------- |
| data                        | array   | Array of partner leaderboard entries            |
| data[].partner_id           | string  | Unique partner ID                               |
| data[].name                 | string  | Partner's name                                  |
| data[].avatar_url           | string  | Partner's avatar URL                            |
| data[].total_contributed    | number  | Total amount contributed                        |
| data[].rank                 | number  | Leaderboard rank (1 = highest)                  |
| data[].top_contributor      | boolean | true only for rank 1                            |
| data[].last_contribution_at | string  | ISO date of last contribution                   |
| data[].recent_transactions  | array   | (optional) Recent 5 transactions                |
| meta.as_of                  | string  | ISO timestamp of when leaderboard was generated |

---

## Error Responses

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

### Step 2: Get Basic Leaderboard

1. Create a new GET request
2. URL: `{{base_url}}/partners/leaderboard`
3. Add Authorization header: `Bearer {{access_token}}`
4. Send the request
5. Verify response status is 200
6. Verify partners are sorted by total_contributed (highest first)
7. Verify rank numbers are correct (1, 2, 3...)
8. Verify top_contributor is true only for rank 1

### Step 3: Test Custom Limit

1. Add query param: `?limit=5`
2. Send the request
3. Verify only 5 partners are returned

### Step 4: Include Recent Transactions

1. Add query param: `?include_recent_transactions=true`
2. Send the request
3. Verify each partner has recent_transactions array
4. Verify max 5 transactions per partner

### Step 5: Test Tie-Breaker

1. Create partners with equal contributions
2. Get leaderboard
3. Verify the one with most recent contribution comes first

---

## Test Cases

### Test Case 1: Basic Leaderboard

- Call endpoint without params
- **Expected**: 200 + partners sorted by total_contributed descending
- **Default limit**: 10 partners

### Test Case 2: Custom Limit

- Call with `?limit=3`
- **Expected**: Only 3 partners returned

### Test Case 3: Include Recent Transactions

- Call with `?include_recent_transactions=true`
- **Expected**: Each partner includes recent_transactions array (max 5)

### Test Case 4: Rank Assignment

- Verify ranks are sequential (1, 2, 3...)
- **Expected**: Ranks are correctly assigned

### Test Case 5: Top Contributor Flag

- Verify only rank 1 has top_contributor: true
- **Expected**: top_contributor is true only for the highest contributor

### Test Case 6: Tie-Breaker by Date

- Create partners with same total_contributed
- **Expected**: Partner with most recent contribution ranks higher

### Test Case 7: Empty Leaderboard

- Call when no partners exist
- **Expected**: 200 + empty data array

---

## Important Notes

1. **Sorting**: Primary sort by total_contributed (descending), secondary sort by last_contribution_at (descending)

2. **Ranking**: Ranks are assigned sequentially based on position after sorting

3. **Top Contributor**: Only the #1 ranked partner has top_contributor: true

4. **Tie-Breaker**: When totals are equal, the partner with the most recent contribution appears first

5. **Recent Transactions**: When included, returns up to 5 most recent contribution transactions per partner
