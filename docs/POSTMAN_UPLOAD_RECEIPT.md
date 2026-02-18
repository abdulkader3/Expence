# Upload Receipt - Postman Testing Guide

## Overview

This endpoint allows you to upload receipt images (JPEG/PNG) and optionally link them to a transaction.

---

## Endpoint Details

| Attribute        | Value                           |
| ---------------- | ------------------------------- |
| **Method**       | POST                            |
| **Path**         | `{{base_url}}/uploads/receipts` |
| **Auth**         | Bearer Token                    |
| **Content-Type** | multipart/form-data             |
| **Response**     | 201 Created                     |

---

## Headers

| Header        | Value                     |
| ------------- | ------------------------- |
| Authorization | Bearer `{{access_token}}` |

---

## Form Data

| Field          | Type   | Required | Description                                |
| -------------- | ------ | -------- | ------------------------------------------ |
| file           | File   | Yes      | Image file (JPEG/PNG), max 8MB             |
| transaction_id | string | No       | Optional transaction ID to link receipt to |

---

## Response (201 Created)

```json
{
  "receipt_id": "uuid",
  "url": "https://res.cloudinary.com/.../receipt.jpg",
  "thumbnail_url": "https://res.cloudinary.com/.../receipt_thumb.jpg"
}
```

### Response Fields

| Field         | Type   | Description                       |
| ------------- | ------ | --------------------------------- |
| receipt_id    | string | Unique ID of the uploaded receipt |
| url           | string | Full URL of the uploaded receipt  |
| thumbnail_url | string | Thumbnail URL (if available)      |

---

## Error Responses

### 400 Bad Request - No File

```json
{
  "success": false,
  "message": "No file uploaded"
}
```

### 400 Bad Request - Invalid File Type

```json
{
  "success": false,
  "message": "Invalid file type. Only JPEG and PNG images are allowed."
}
```

### 413 Payload Too Large

```json
{
  "success": false,
  "message": "File too large. Maximum size is 8MB"
}
```

### 401 Unauthorized

```json
{
  "success": false,
  "message": "Invalid token or token expired"
}
```

### 404 Not Found (if transaction_id provided)

```json
{
  "success": false,
  "message": "Transaction not found"
}
```

---

## Testing Steps

### Step 1: Get an Access Token

1. Use the login endpoint to get an access token
2. Save the token as `{{access_token}}` in Postman

### Step 2: Upload a Receipt (Basic)

1. Create a new POST request
2. URL: `{{base_url}}/uploads/receipts`
3. Add Authorization header: `Bearer {{access_token}}`
4. Go to Body tab
5. Select "form-data"
6. Add a key named "file"
7. Change type from "Text" to "File"
8. Select a JPEG or PNG image (under 8MB)
9. Send the request
10. Verify response status is 201
11. Verify receipt_id, url, and thumbnail_url are returned

### Step 3: Upload Receipt Linked to Transaction

1. First create a transaction (or use an existing transaction ID)
2. Copy the transaction ID as `{{transaction_id}}`
3. Create a new POST request to `/uploads/receipts`
4. Add the file as before
5. Add another key "transaction_id" with value `{{transaction_id}}`
6. Send the request
7. Verify the receipt is linked to the transaction

### Step 4: Test File Size Limit

1. Try uploading a file larger than 8MB
2. **Expected**: 413 error "File too large. Maximum size is 8MB"

### Step 5: Test Invalid File Type

1. Try uploading a non-image file (e.g., PDF, TXT)
2. **Expected**: 400 error "Invalid file type. Only JPEG and PNG images are allowed."

---

## Test Cases

### Test Case 1: Upload Valid JPEG Image

- Upload a JPEG image under 8MB
- **Expected**: 201 + receipt_id, url, thumbnail_url

### Test Case 2: Upload Valid PNG Image

- Upload a PNG image under 8MB
- **Expected**: 201 + receipt_id, url, thumbnail_url

### Test Case 3: Upload Without File

- Send request without file field
- **Expected**: 400 "No file uploaded"

### Test Case 4: File Too Large (>8MB)

- Upload a file larger than 8MB
- **Expected**: 413 "File too large. Maximum size is 8MB"

### Test Case 5: Invalid File Type

- Upload a non-image file (PDF, TXT, etc.)
- **Expected**: 400 "Invalid file type. Only JPEG and PNG images are allowed."

### Test Case 6: Link Receipt to Transaction

- Upload with valid transaction_id
- **Expected**: Receipt linked to transaction, receipt_id stored in transaction

### Test Case 7: Invalid Transaction ID

- Upload with invalid transaction_id format
- **Expected**: 400 "Invalid transaction ID format"

### Test Case 8: Non-Existent Transaction

- Upload with transaction_id that doesn't exist
- **Expected**: 404 "Transaction not found"

---

## Important Notes

1. **Supported Formats**: Only JPEG and PNG images are accepted

2. **File Size Limit**: Maximum 8MB per file

3. **Auto Link**: If transaction_id is provided, the receipt is automatically linked to that transaction

4. **Storage**: Receipts are stored in Cloudinary and metadata in MongoDB

5. **Thumbnail**: Cloudinary automatically generates thumbnails for images
