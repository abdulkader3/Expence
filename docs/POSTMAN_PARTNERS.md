# Partner Endpoints

Base URL: `http://localhost:5000/api/v1/partners`

Auth: Bearer token (Authorization header)

---

## POST /partners - Create Partner

### Test 1: Create Partner Minimal → 201

1. **Method:** POST
2. **URL:** http://localhost:5000/api/v1/partners
3. **Headers:**
   ```
   Authorization: Bearer <access_token>
   Content-Type: application/json
   ```
4. **Body (JSON):**
   ```json
   {
     "name": "John Doe"
   }
   ```
5. **Send Request**
6. **Expected Response (201):**
   ```json
   {
     "partner": {
       "id": "uuid",
       "name": "John Doe",
       "email": null,
       "avatar_url": null,
       "notes": null,
       "total_contributed": 0,
       "created_at": "ISO8601"
     }
   }
   ```

---

### Test 2: Create Partner with All Fields → 201

1. **Method:** POST
2. **URL:** http://localhost:5000/api/v1/partners
3. **Headers:**
   ```
   Authorization: Bearer <access_token>
   ```
4. **Body (form-data):**

| Key    | Value                       |
| ------ | --------------------------- |
| name   | Jane Smith                  |
| email  | jane@example.com            |
| notes  | Business partner since 2024 |
| avatar | [Select an image file]      |

5. **Send Request**
6. **Expected Response (201):**
   ```json
   {
     "partner": {
       "id": "uuid",
       "name": "Jane Smith",
       "email": "jane@example.com",
       "avatar_url": "https://res.cloudinary.com/.../image.jpg",
       "notes": "Business partner since 2024",
       "total_contributed": 0,
       "created_at": "ISO8601"
     }
   }
   ```

---

### Test 3: Create with Initial Contribution → Partner Total Reflects Amount

1. **Method:** POST
2. **URL:** http://localhost:5000/api/v1/partners
3. **Headers:**
   ```
   Authorization: Bearer <access_token>
   Content-Type: application/json
   ```
4. **Body (JSON):**
   ```json
   {
     "name": "Bob Wilson",
     "initial_contributed": 5000
   }
   ```
5. **Send Request**
6. **Expected Response (201):**
   ```json
   {
     "partner": {
       "id": "uuid",
       "name": "Bob Wilson",
       "email": null,
       "avatar_url": null,
       "notes": null,
       "total_contributed": 5000,
       "created_at": "ISO8601"
     }
   }
   ```
   > Note: A transaction of type "contribution" is automatically created for this amount.

---

### Test 4: Missing Name → 400

1. **Method:** POST
2. **URL:** http://localhost:5000/api/v1/partners
3. **Headers:**
   ```
   Authorization: Bearer <access_token>
   Content-Type: application/json
   ```
4. **Body (JSON):**
   ```json
   {
     "email": "test@example.com"
   }
   ```
5. **Send Request**
6. **Expected Response (400):**
   ```json
   {
     "success": false,
     "message": "Validation error",
     "errors": [{ "field": "name", "message": "Name is required" }]
   }
   ```

---

### Test 5: Invalid Email → 400

1. **Method:** POST
2. **URL:** http://localhost:5000/api/v1/partners
3. **Headers:**
   ```
   Authorization: Bearer <access_token>
   Content-Type: application/json
   ```
4. **Body (JSON):**
   ```json
   {
     "name": "Test User",
     "email": "not-an-email"
   }
   ```
5. **Send Request**
6. **Expected Response (400):**
   ```json
   {
     "success": false,
     "message": "Validation error",
     "errors": [{ "field": "email", "message": "Please provide a valid email" }]
   }
   ```

---

### Test 6: Negative Initial Contribution → 400

1. **Method:** POST
2. **URL:** http://localhost:5000/api/v1/partners
3. **Headers:**
   ```
   Authorization: Bearer <access_token>
   Content-Type: application/json
   ```
4. **Body (JSON):**
   ```json
   {
     "name": "Test User",
     "initial_contributed": -100
   }
   ```
5. **Send Request**
6. **Expected Response (400):**
   ```json
   {
     "success": false,
     "message": "Validation error",
     "errors": [
       {
         "field": "initial_contributed",
         "message": "Initial contributed must be a non-negative number"
       }
     ]
   }
   ```

---

### Test 7: No Token → 401

1. **Method:** POST
2. **URL:** http://localhost:5000/api/v1/partners
3. **Headers:**
   ```
   Content-Type: application/json
   ```
4. **Body (JSON):**
   ```json
   {
     "name": "Test User"
   }
   ```
5. **Send Request**
6. **Expected Response (401):**
   ```json
   {
     "success": false,
     "message": "unauthorized request"
   }
   ```

---

## How to Test

1. **Login first:** POST `/api/v1/auth/login` with email & password
2. **Get token:** From response cookies or from login response
3. **Set Authorization header:** `Bearer <your_access_token>`
4. **Test endpoints:** Use the tests above
