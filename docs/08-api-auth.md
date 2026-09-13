# 📄 Documentation: `api/auth.php` — Admin Login & Authentication

## What Does This File Do?

This file handles all authentication-related API routes:
- `POST /auth/login` — Admin logs in
- `POST /auth/refresh` — Get a new access token
- `POST /auth/logout` — Admin logs out
- `POST /auth/change-password` — Change the admin password

---

## Routes & Handlers

### `POST /auth/login` — Admin Login

```php
function authLogin(): void {
    $body     = getJsonBody();
    $email    = $body['email'] ?? '';
    $password = $body['password'] ?? '';

    if (!$email || !$password) {
        errorResponse('Email and password are required');
    }
```

**Line-by-line:**
- Read the email and password from the request body (JSON sent by the frontend).
- If either is missing, return an error.

---

```php
    $db        = Database::getConnection();
    $jwtConfig = require __DIR__ . '/../config/jwt.php';

    $stmt = $db->prepare("SELECT * FROM admins WHERE email = ? AND is_active = 1");
    $stmt->execute([strtolower(trim($email))]);
    $admin = $stmt->fetch();

    if (!$admin) {
        errorResponse('Invalid credentials', 401);
        return;
    }
```

**Line-by-line:**
- Connect to the database.
- Load JWT settings (secret key, expiry times).
- Look up the admin by email. `strtolower(trim($email))` normalizes the email (lowercase, no spaces).
- `is_active = 1` means only active accounts can log in.
- If no admin found → "Invalid credentials" (401).

---

```php
    if ($admin['locked_until'] && strtotime($admin['locked_until']) > time()) {
        errorResponse('Account is locked. Please try again after 15 minutes.', 403);
        return;
    }
```

**Line-by-line:**
- Check if the account is locked due to too many failed login attempts.
- `strtotime($admin['locked_until'])` converts the lock time to a timestamp.
- `> time()` checks if the lock is still active.
- If locked → "Account is locked" (403).

---

```php
    if (!password_verify($password, $admin['password_hash'])) {
        $attempts = $admin['failed_login_attempts'] + 1;
        $lockUntil = $attempts >= 5
            ? date('Y-m-d H:i:s', time() + 900)
            : null;

        $stmt = $db->prepare("UPDATE admins SET failed_login_attempts = ?, locked_until = ? WHERE id = ?");
        $stmt->execute([$attempts, $lockUntil, $admin['id']]);

        errorResponse('Invalid credentials', 401);
        return;
    }
```

**Line-by-line:**
- `password_verify()` checks if the password matches the stored hash. This is the reverse of `password_hash()`.
- If wrong password:
  - Increment `failed_login_attempts` by 1.
  - If attempts reach 5 → lock the account for 900 seconds (15 minutes).
  - Update the database.
  - Return "Invalid credentials" (401).

**Why?** This prevents brute force attacks — if someone tries to guess the password, after 5 wrong attempts they're locked out for 15 minutes.

---

```php
    if ($admin['failed_login_attempts'] > 0 || $admin['locked_until']) {
        $stmt = $db->prepare("UPDATE admins SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?");
        $stmt->execute([$admin['id']]);
    }
```

**Line-by-line:**
- If the login is successful, reset `failed_login_attempts` to 0 and clear the lock.
- This way, the next failed attempt starts counting from 0 again.

---

```php
    $payload = [
        'adminId' => $admin['id'],
        'email'   => $admin['email'],
        'role'    => $admin['role'],
    ];
    $accessToken  = jwt_encode($payload, $jwtConfig['secret'], $jwtConfig['access_expiry']);
    $refreshToken = jwt_encode(array_merge($payload, ['type' => 'refresh']), $jwtConfig['secret'], $jwtConfig['refresh_expiry']);

    setcookie('refreshToken', $refreshToken, [
        'expires'  => time() + $jwtConfig['refresh_expiry'],
        'path'     => '/api/v1/auth/refresh',
        'httponly'  => true,
        'secure'   => false,
        'samesite' => 'Lax',
    ]);

    successResponse([
        'accessToken'  => $accessToken,
        'refreshToken' => $refreshToken,
        'expiresIn'    => '15m',
        'admin' => [
            'id'       => $admin['id'],
            'fullName' => $admin['full_name'],
            'email'    => $admin['email'],
            'role'     => $admin['role'],
        ],
    ]);
}
```

**Line-by-line:**
- Create a payload with admin info (ID, email, role).
- Generate two tokens:
  - **Access token** (15 minutes) — sent back in the response body.
  - **Refresh token** (7 days) — sent as an httpOnly cookie AND in the response body.
- Set the refresh token as a cookie:
  - `httponly: true` — JavaScript can't read this cookie (more secure).
  - `secure: false` — set to `true` in production with HTTPS.
  - `samesite: 'Lax'` — only send with same-site requests.
- Return the tokens and admin info to the frontend.

**Why two tokens?**
- Access token: Short-lived, used for API calls. If stolen, damage is limited to 15 minutes.
- Refresh token: Long-lived, stored as httpOnly cookie. Used only to get new access tokens.

---

### `POST /auth/refresh` — Get New Access Token

```php
function authRefresh(): void {
    $refreshToken = $_COOKIE['refreshToken'] ?? getJsonBody()['refreshToken'] ?? null;

    if (!$refreshToken) {
        errorResponse('Refresh token required', 401);
        return;
    }

    $jwtConfig = require __DIR__ . '/../config/jwt.php';
    $payload   = jwt_decode($refreshToken, $jwtConfig['secret']);

    if (!$payload || ($payload['type'] ?? '') !== 'refresh') {
        errorResponse('Invalid or expired refresh token', 401);
        return;
    }
```

**Line-by-line:**
- Get the refresh token from either the cookie or the request body.
- Decode and verify it.
- Check that it's actually a refresh token (not an access token).

---

```php
    $db = Database::getConnection();
    $stmt = $db->prepare("SELECT * FROM admins WHERE id = ? AND is_active = 1");
    $stmt->execute([$payload['adminId']]);
    $admin = $stmt->fetch();

    if (!$admin) {
        errorResponse('Admin account is inactive or not found', 401);
        return;
    }

    if ($admin['password_changed_at'] && isset($payload['iat'])) {
        if ($payload['iat'] < strtotime($admin['password_changed_at'])) {
            errorResponse('Session expired due to password change. Please log in again.', 401);
            return;
        }
    }
```

**Line-by-line:**
- Same checks as `authenticate()`: verify the admin exists, is active, and password hasn't changed.

---

```php
    $tokenPayload = ['adminId' => $admin['id'], 'email' => $admin['email'], 'role' => $admin['role']];
    $newAccessToken  = jwt_encode($tokenPayload, $jwtConfig['secret'], $jwtConfig['access_expiry']);
    $newRefreshToken = jwt_encode(array_merge($tokenPayload, ['type' => 'refresh']), $jwtConfig['secret'], $jwtConfig['refresh_expiry']);

    setcookie('refreshToken', $newRefreshToken, [...]);

    successResponse([
        'accessToken'  => $newAccessToken,
        'refreshToken' => $newRefreshToken,
        'expiresIn'    => '15m',
    ]);
}
```

**Line-by-line:**
- Generate new access and refresh tokens.
- Update the refresh token cookie.
- Return the new tokens.

**Why refresh?** The frontend's access token expired. Instead of forcing the admin to log in again, we use the refresh token to get a new access token silently.

---

### `POST /auth/logout` — Admin Logout

```php
function authLogout(): void {
    setcookie('refreshToken', '', [
        'expires'  => time() - 3600,
        'path'     => '/api/v1/auth/refresh',
        'httponly'  => true,
    ]);
    successResponse(['message' => 'Logged out successfully']);
}
```

**Line-by-line:**
- Clear the refresh token cookie by setting it to empty with a past expiration date.
- Return success.

**Note:** We don't "invalidate" the access token — it will expire on its own in 15 minutes. This is normal for JWT-based auth.

---

### `POST /auth/change-password` — Change Password

```php
function authChangePassword(): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $body             = getJsonBody();
    $currentPassword  = $body['currentPassword'] ?? '';
    $newPassword      = $body['newPassword'] ?? '';
    $confirmPassword  = $body['confirmNewPassword'] ?? '';

    if (!$currentPassword || !$newPassword || !$confirmPassword) {
        errorResponse('All fields are required');
        return;
    }
    if (strlen($newPassword) < 8) {
        errorResponse('New password must be at least 8 characters.');
        return;
    }
    if ($newPassword !== $confirmPassword) {
        errorResponse('New password and confirm password do not match.');
        return;
    }
    if ($newPassword === $currentPassword) {
        errorResponse('New password must be different from current password.');
        return;
    }
```

**Line-by-line:**
- Require authentication (must be logged in).
- Read current password, new password, and confirmation.
- Validate:
  - All fields are present.
  - New password is at least 8 characters.
  - New password matches confirmation.
  - New password is different from current.

---

```php
    $db   = Database::getConnection();
    $stmt = $db->prepare("SELECT password_hash FROM admins WHERE id = ?");
    $stmt->execute([$admin['adminId']]);
    $row = $stmt->fetch();

    if (!$row || !password_verify($currentPassword, $row['password_hash'])) {
        errorResponse('Current password is incorrect.', 401);
        return;
    }

    $newHash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 10]);
    $stmt = $db->prepare("UPDATE admins SET password_hash = ?, password_changed_at = NOW() WHERE id = ?");
    $stmt->execute([$newHash, $admin['adminId']]);

    successResponse(['message' => 'Password changed successfully. You will need to log in again on other devices.']);
}
```

**Line-by-line:**
- Verify the current password is correct.
- Hash the new password.
- Save the new hash and set `password_changed_at` to now.
- This will invalidate all existing tokens (because `authenticate()` checks `password_changed_at`).

**Why `password_changed_at = NOW()`?** When the password changes, all existing tokens should be invalidated. The `authenticate()` middleware checks if the token was issued before the password change. If so, it rejects the token.

---

## 🎯 Summary

| Route | What It Does | Security Feature |
|-------|-------------|-----------------|
| `POST /auth/login` | Admin logs in | Bcrypt password verification, account lockout after 5 failures |
| `POST /auth/refresh` | Get new access token | Verifies refresh token, checks password change |
| `POST /auth/logout` | Admin logs out | Clears refresh token cookie |
| `POST /auth/change-password` | Change password | Verifies current password, invalidates all tokens |
