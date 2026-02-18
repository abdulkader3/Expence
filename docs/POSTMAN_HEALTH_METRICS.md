# Health & Metrics - Postman Testing Guide

## Overview

Internal endpoint for service health monitoring and CI checks.

## Base URL

```
http://localhost:5000/health
```

## Authentication

None required (internal use only)

---

## GET /health

### Description

Returns service status including uptime, database connectivity, queue status, and version.

### Request

- **Method:** GET
- **URL:** `http://localhost:5000/health`

### Response (200 OK)

```json
{
  "status": "ok",
  "uptime": 12345,
  "db": "ok",
  "queue": {
    "pending": 0
  },
  "version": "1.2.3"
}
```

### Response Fields

| Field         | Type    | Description                                                |
| ------------- | ------- | ---------------------------------------------------------- |
| status        | string  | Service status: "ok"                                       |
| uptime        | integer | Server uptime in seconds                                   |
| db            | string  | Database connection: "ok", "connecting", or "disconnected" |
| queue.pending | integer | Number of pending queue items (currently always 0)         |
| version       | string  | Application version from package.json                      |

---

## Postman Setup

### Add Request

1. Open Postman
2. Click "Add Request"
3. Name: `Health Check`
4. Method: GET
5. URL: `http://localhost:5000/health`
6. Click "Send"

### Expected Response

```json
{
  "status": "ok",
  "uptime": <seconds>,
  "db": "ok",
  "queue": {
    "pending": 0
  },
  "version": "1.0.0"
}
```

---

## Testing Scenarios

### Test 1: Basic Health Check

```
GET /health
```

**Expected:** 200 OK with JSON containing status, uptime, db, queue, version

### Test 2: Verify Database Status

- When MongoDB connected: `"db": "ok"`
- When MongoDB connecting: `"db": "connecting"`
- When MongoDB disconnected: `"db": "disconnected"`

### Test 3: Verify Uptime

- `uptime` should be a positive integer
- Value increases over time

### Test 4: CI/CD Integration

Use in scripts or monitoring tools:

```bash
curl -s http://localhost:5000/health | jq '.status'
# Should output: "ok"
```
