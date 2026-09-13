# 📄 Documentation: Helper Files (`helpers/`)

These 3 files contain utility functions used by every other file in the project. They're like the tools in a toolbox — every carpenter needs a hammer, screwdriver, and measuring tape.

---

## 1. `helpers/response.php` — Send JSON Responses

This file contains functions to send responses back to the frontend. Every API request ends with one of these.

### `jsonResponse(int $code, array $data)`

```php
function jsonResponse(int $code, array $data): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
```

**What it does:**
- Sets the HTTP status code (200 = OK, 400 = Bad Request, 401 = Unauthorized, 404 = Not Found).
- Converts the PHP array to JSON text and sends it to the browser.
- `JSON_UNESCAPED_UNICODE` means "don't escape special characters" — this allows Amharic text to be sent correctly.
- `exit` stops the script immediately — nothing else runs after this.

**Analogy:** This is like writing a letter and mailing it. You put the response code (like a return address) and the data (the letter content) in the envelope.

---

### `successResponse(array $data, int $code = 200)`

```php
function successResponse(array $data, int $code = 200): void {
    $converted = toCamelCaseKeys($data);
    $converted = addIdAliases($converted);
    jsonResponse($code, array_merge(['success' => true], $converted));
}
```

**What it does:**
- Takes the data and wraps it in a success response.
- **`toCamelCaseKeys($data)`**: Converts all snake_case keys from MySQL to camelCase for JavaScript. Example: `first_name` → `firstName`, `created_at` → `createdAt`.
- **`addIdAliases($converted)`**: Adds `_id` as a string copy of `id` wherever `id` exists. The admin frontend was built for MongoDB (which uses `_id`), so we need both.
- Sends JSON like: `{"success": true, "data": [...], "pagination": {...}}`

**Why camelCase?** MySQL uses snake_case (`first_name`), but JavaScript uses camelCase (`firstName`). We convert to match the frontend's expectations.

**Why _id?** MongoDB uses `_id` as the primary key. The admin frontend references `program._id`, `student._id`, etc. Since we migrated from MongoDB to MySQL, we add `_id` to keep the frontend working.

---

### `errorResponse(string $message, int $code = 400)`

```php
function errorResponse(string $message, int $code = 400): void {
    jsonResponse($code, ['success' => false, 'message' => $message]);
}
```

**What it does:**
- Sends an error response like: `{"success": false, "message": "Invalid credentials"}`

---

### `toCamelCaseKeys(mixed $data)`

```php
function toCamelCaseKeys(mixed $data): mixed {
    if (is_array($data)) {
        $result = [];
        foreach ($data as $key => $value) {
            $result[snakeToCamel($key)] = toCamelCaseKeys($value);
        }
        return $result;
    }
    return $data;
}
```

**What it does:**
- Goes through every key in the array and converts it from snake_case to camelCase.
- Uses `snakeToCamel()` which does: `first_name` → `ucwords` → `FirstName` → `str_replace _` → `FirstName` → `lcfirst` → `firstName`.
- Works recursively — if there are nested arrays (like student inside registration), it converts those too.

---

### `addIdAliases(mixed $data)`

```php
function addIdAliases(mixed $data): mixed {
    if (is_array($data)) {
        $result = [];
        foreach ($data as $key => $value) {
            $result[$key] = addIdAliases($value);
        }
        if (array_key_exists('id', $result) && !array_key_exists('_id', $result)) {
            $result['_id'] = (string)$result['id'];
        }
        return $result;
    }
    return $data;
}
```

**What it does:**
- Goes through every array in the response.
- If an array has an `id` key but no `_id` key, it adds `_id` as a string copy.
- Example: `{"id": 5}` → `{"id": 5, "_id": "5"}`.
- Works recursively on nested arrays (student objects inside registrations, etc.).

---

### `formatProgram(array $p)`

```php
function formatProgram(array $p): array {
    $p['id'] = (int)$p['id'];
    $p['price'] = (int)$p['price'];
    $p['is_active'] = (bool)$p['is_active'];
    $p['allows_half_payment'] = (bool)$p['allows_half_payment'];
    if (is_string($p['included'] ?? null)) {
        $p['included'] = json_decode($p['included'], true) ?? [];
    }
    if (is_string($p['included_am'] ?? null)) {
        $p['included_am'] = json_decode($p['included_am'], true);
    }
    return $p;
}
```

**What it does:**
- Cleans up a program row from MySQL:
  - Converts `id` and `price` to integers (MySQL returns them as strings).
  - Converts `is_active` and `allows_half_payment` to booleans (true/false instead of 1/0).
  - Decodes `included` from JSON string to PHP array (MySQL stores JSON as text).
  - Same for `included_am` (Amharic version).

---

### Other Helpers

- **`getJsonBody()`**: Reads the raw request body (JSON sent by the frontend) and decodes it into a PHP array.
- **`getAuthToken()`**: Extracts the JWT token from the `Authorization: Bearer xxx` header.
- **`getQueryParams()`**: Returns all URL query parameters (like `?page=1&limit=10`).
- **`snakeToCamel(string)`**: Converts `first_name` → `firstName`.
- **`getRouteId(uri, prefix)`**: Extracts the ID from a URL like `/registrations/123` → `"123"`.
- **`getSubResource(uri, prefix)`**: Extracts the sub-resource like `/registrations/123/payments` → `"payments"`.

---

## 2. `helpers/jwt.php` — JWT Token Creation & Verification

### What is JWT?

JWT (JSON Web Token) is a way to prove "I am who I say I am" without sending a password every time. It's like a concert wristband — you show it once at the door, and security lets you in for the rest of the night.

A JWT looks like: `eyJhbGciOiJIUzI1NiJ9.eyJhZG1pbklkIjoxfQ.abc123xyz`

It has 3 parts separated by dots:
1. **Header** (algorithm info)
2. **Payload** (the actual data — who you are, when it expires)
3. **Signature** (proof that nobody tampered with it)

---

### `jwt_encode(array $payload, string $secret, int $expiry)`

```php
function jwt_encode(array $payload, string $secret, int $expiry): string {
    $header = base64url_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $now = time();
    $payload['iat'] = $now;
    $payload['exp'] = $now + $expiry;
    $payloadB64 = base64url_encode(json_encode($payload));
    $signingInput = "$header.$payloadB64";
    $signature = base64url_encode(hash_hmac('sha256', $signingInput, $secret, true));
    return "$signingInput.$signature";
}
```

**What it does, step by step:**
1. Creates the header: `{"alg":"HS256","typ":"JWT"}` → base64url encode it.
2. Adds `iat` (issued at) and `exp` (expires) timestamps to the payload.
3. Base64url encodes the payload.
4. Creates a signature by hashing the header + payload with the secret key using HMAC-SHA256.
5. Returns `header.payload.signature` — the complete JWT token.

**Why base64url?** It's a way to turn any data into URL-safe text (only uses letters, numbers, - and _).

**Why HMAC-SHA256?** It's a cryptographic function that creates a unique "fingerprint" of the data. If anyone changes even one character, the fingerprint changes completely. The secret key is needed to verify it.

---

### `jwt_decode(string $token, string $secret)`

```php
function jwt_decode(string $token, string $secret): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$headerB64, $payloadB64, $signatureB64] = $parts;
    $expectedSig = base64url_encode(hash_hmac('sha256', "$headerB64.$payloadB64", $secret, true));
    if (!hash_equals($expectedSig, $signatureB64)) return null;
    $data = json_decode(base64url_decode($payloadB64), true);
    if (!is_array($data) || !isset($data['exp'])) return null;
    if ($data['exp'] < time()) return null;
    return $data;
}
```

**What it does, step by step:**
1. Splits the token into 3 parts by `.`.
2. If there aren't exactly 3 parts, it's invalid → return null.
3. Recomputes the expected signature using the header + payload + secret.
4. **Compares signatures**: If someone tampered with the token, the signature won't match → return null.
5. Decodes the payload from base64url back to JSON.
6. **Checks expiry**: If the token has expired, return null.
7. If everything is valid, returns the payload data (adminId, email, role, etc.).

**Why `hash_equals`?** It compares strings in constant time, preventing "timing attacks" where hackers measure how long comparison takes to guess the signature character by character.

---

### `base64url_encode` / `base64url_decode`

```php
function base64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}
function base64url_decode(string $data): string {
    return base64_decode(strtr($data, '-_', '+/'));
}
```

**What it does:** Converts between regular base64 and URL-safe base64. Regular base64 uses `+`, `/`, and `=` which break URLs. URL-safe base64 replaces them with `-`, `_`, and removes `=`.

---

## 3. `helpers/validation.php` — Input Validation

### `sanitizeString(string $value)`

```php
function sanitizeString(string $value): string {
    $value = trim($value);
    $value = stripslashes($value);
    return $value;
}
```

**What it does:**
- `trim()` — removes spaces from the beginning and end.
- `stripslashes()` — removes backslash escape characters.
- Used to clean up user input before saving to the database.

---

### `validateEmail(string $email)`

```php
function validateEmail(string $email): bool {
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}
```

**What it does:** Checks if an email address looks valid (has @, domain, etc.). Returns true/false.

---

### `validatePhone(string $phone)`

```php
function validatePhone(string $phone): bool {
    $cleaned = preg_replace('/\D/', '', $phone);
    return strlen($cleaned) >= 9 && strlen($cleaned) <= 15;
}
```

**What it does:**
- Removes all non-digit characters (spaces, dashes, + signs).
- Checks if the remaining digits are between 9 and 15 characters long.
- Accepts Ethiopian formats: `+251912345678`, `0912345678`, `0712345678`.

---

### `validateRequired(array $data, array $fields)`

```php
function validateRequired(array $data, array $fields): array {
    $errors = [];
    foreach ($fields as $field) {
        $value = $data[$field] ?? null;
        if ($value === null || $value === '' || (is_string($value) && trim($value) === '')) {
            $errors[] = "$field is required.";
        }
    }
    return $errors;
}
```

**What it does:**
- Checks if required fields are present and not empty.
- Returns an array of error messages. If empty, all fields are valid.
- Example: `validateRequired($body, ['title', 'price'])` checks that both `title` and `price` exist and aren't empty.

---

## 🎯 Summary

| File | Key Functions | What They Do |
|------|-------------|-------------|
| `response.php` | `successResponse`, `errorResponse` | Send JSON back to the frontend |
| `response.php` | `toCamelCaseKeys` | Convert MySQL snake_case to JS camelCase |
| `response.php` | `addIdAliases` | Add `_id` for MongoDB compatibility |
| `response.php` | `formatProgram` | Clean up program data types |
| `jwt.php` | `jwt_encode` | Create a JWT token |
| `jwt.php` | `jwt_decode` | Verify and read a JWT token |
| `validation.php` | `validateEmail` | Check if email is valid |
| `validation.php` | `validatePhone` | Check if phone number is valid |
| `validation.php` | `validateRequired` | Check if required fields exist |
| `validation.php` | `sanitizeString` | Clean up user input |
