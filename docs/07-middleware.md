# 📄 Documentation: `middleware/AuthMiddleware.php` — The Security Guard

## What Does This File Do?

`AuthMiddleware.php` is the **security guard** of the API. Every time an admin-only endpoint is called (like viewing registrations or editing courses), this file checks:

1. Did the admin send a JWT token?
2. Is the token valid (not expired, not tampered)?
3. Does the admin still exist and is their account active?
4. Has the password been changed since the token was issued?

If all checks pass → let them in.
If any check fails → send an error and block access.

---

## Line-by-Line Explanation

### `authenticate()` — The Main Gate

```php
public static function authenticate(): ?array {
    $token = getAuthToken();
    if (!$token) {
        errorResponse('Authentication required', 401);
        return null;
    }

    $jwtConfig  = require __DIR__ . '/../config/jwt.php';
    $payload    = jwt_decode($token, $jwtConfig['secret']);

    if (!$payload) {
        errorResponse('Invalid or expired access token', 401);
        return null;
    }

    $db = Database::getConnection();
    $stmt = $db->prepare("SELECT id, password_changed_at, is_active FROM admins WHERE id = ?");
    $stmt->execute([$payload['adminId']]);
    $admin = $stmt->fetch();

    if (!$admin || !$admin['is_active']) {
        errorResponse('Admin account is inactive or not found', 401);
        return null;
    }

    if ($admin['password_changed_at'] && isset($payload['iat'])) {
        if ($payload['iat'] < strtotime($admin['password_changed_at'])) {
            errorResponse('Session expired due to password change. Please log in again.', 401);
            return null;
        }
    }

    return [
        'adminId' => $payload['adminId'],
        'email'   => $payload['email'],
        'role'    => $payload['role'],
    ];
}
```

**Step by step:**

1. **Get the token** (line 2): Extract the JWT from the `Authorization: Bearer xxx` header. If there's no token → error "Authentication required" (401).

2. **Decode the token** (lines 4-5): Use `jwt_decode()` to verify the signature and check expiry. If the token is fake or expired → error "Invalid or expired token" (401).

3. **Check the database** (lines 7-9): Look up the admin by the `adminId` from the token. Check that:
   - The admin exists in the database
   - Their account is active (`is_active = 1`)

4. **Check password change** (lines 13-17): If the admin changed their password AFTER the token was issued, the token should be invalidated. This is done by comparing:
   - Token's `iat` (issued at time)
   - Admin's `password_changed_at`
   - If `iat` is BEFORE `password_changed_at` → the token is from before the password change → invalidate it.

5. **Return admin info** (lines 19-23): If all checks pass, return the admin's ID, email, and role. This info is used by the route handlers to know who's making the request.

---

### `optionalAuth()` — The Optional Check

```php
public static function optionalAuth(): ?array {
    $token = getAuthToken();
    if (!$token) {
        return null;
    }
    $jwtConfig = require __DIR__ . '/../config/jwt.php';
    $payload   = jwt_decode($token, $jwtConfig['secret']);
    return $payload;
}
```

**What it does:**
- Same as `authenticate()`, but does NOT send an error if there's no token.
- Returns `null` if no token, or the admin info if there is one.
- Used for endpoints that work differently for logged-in vs anonymous users.

**Example:** The programs list endpoint:
- If admin is logged in → show ALL courses (including inactive ones)
- If not logged in → show only active courses

---

## 🎯 Summary

| Check | What It Does | Analogy |
|-------|-------------|---------|
| Token exists? | Is there a wristband? | Do you have a ticket? |
| Token valid? | Is the wristband genuine? | Is this ticket real or fake? |
| Admin exists? | Is this person in our system? | Are you on the guest list? |
| Account active? | Is the account still enabled? | Has your membership expired? |
| Password not changed? | Was the token issued after the last password change? | Did you change the locks since this key was made? |
