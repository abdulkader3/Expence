# User Settings - Postman Testing Guide

## Overview

Endpoints for managing user preferences and settings.

## Base URL

```
http://localhost:5000/api/v1/users/me/settings
```

## Authentication

All endpoints require Bearer token authentication.

---

## GET /users/me/settings

### Description

Retrieve current user settings.

### Request

- **Method:** GET
- **Headers:**
  ```
  Authorization: Bearer <access_token>
  ```

### Response (200 OK)

```json
{
  "currency": "USD",
  "notifications": {
    "enabled": true,
    "email": true,
    "push": true
  },
  "biometric_lock_enabled": false,
  "quick_add_default_partner": null,
  "export_format": "csv"
}
```

---

## PUT /users/me/settings

### Description

Update user settings. Supports partial updates - only include fields you want to change.

### Request

- **Method:** PUT
- **Headers:**
  ```
  Authorization: Bearer <access_token>
  Content-Type: application/json
  ```

### Body Parameters

| Parameter                 | Type    | Required | Description                                      |
| ------------------------- | ------- | -------- | ------------------------------------------------ |
| currency                  | string  | No       | 3-letter ISO currency code (e.g., USD, EUR, GBP) |
| notifications             | object  | No       | Notification preferences                         |
| notifications.enabled     | boolean | No       | Enable/disable all notifications                 |
| notifications.email       | boolean | No       | Enable email notifications                       |
| notifications.push        | boolean | No       | Enable push notifications                        |
| biometric_lock_enabled    | boolean | No       | Enable biometric lock                            |
| quick_add_default_partner | string  | No       | Default partner ID for quick add                 |
| export_format             | string  | No       | Export format: csv, json, or excel               |

### Example Request - Update Currency

```json
{
  "currency": "EUR"
}
```

### Example Request - Update Multiple Settings

```json
{
  "currency": "GBP",
  "notifications": {
    "enabled": true,
    "email": false,
    "push": true
  },
  "biometric_lock_enabled": true,
  "export_format": "json"
}
```

### Response (200 OK)

```json
{
  "currency": "GBP",
  "notifications": {
    "enabled": true,
    "email": false,
    "push": true
  },
  "biometric_lock_enabled": true,
  "quick_add_default_partner": null,
  "export_format": "json"
}
```

### Error Responses

- **400 Bad Request:** Invalid fields or values
- **401 Unauthorized:** Missing or invalid token

---

## Postman Setup

### 1. Create Collection

1. Open Postman
2. Click "New Collection" → Name it "Expense API"

### 2. Add Authorization

1. In collection settings, go to **Authorization** tab
2. Type: **Bearer Token**
3. Token: `<your_access_token>`

### 3. Add Request - GET Settings

1. Click "Add Request"
2. Name: `Get User Settings`
3. Method: GET
4. URL: `{{baseUrl}}/users/me/settings`
5. Send request

### 4. Add Request - PUT Settings

1. Click "Add Request"
2. Name: `Update User Settings`
3. Method: PUT
4. URL: `{{baseUrl}}/users/me/settings`
5. Go to **Body** tab
6. Select **raw** → **JSON**
7. Enter your settings JSON
8. Send request

---

## Testing Scenarios

### Test 1: Get Default Settings

```
GET /users/me/settings
```

**Expected:** Returns default settings with currency "USD"

### Test 2: Update Currency

```
PUT /users/me/settings
Body: { "currency": "EUR" }
```

**Expected:** Currency updated to "EUR"

### Test 3: Update Multiple Settings

```
PUT /users/me/settings
Body: {
  "currency": "GBP",
  "biometric_lock_enabled": true,
  "export_format": "json"
}
```

**Expected:** All specified fields updated

### Test 4: Verify Persistence

1. Update settings
2. GET /users/me/settings
   **Expected:** Returns updated settings (not defaults)

### Test 5: Settings Affect API Behavior

- Create transaction without specifying currency → uses user's default currency
- Export transactions → uses user's export_format setting
