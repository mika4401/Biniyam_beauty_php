<?php
/**
 * Auth routes: POST /login, POST /refresh, POST /logout, POST /change-password
 *
 * Expected URI after prefix stripping: /auth/login, /auth/refresh, etc.
 */

$method = $_SERVER['REQUEST_METHOD'];
// $API_URI is already stripped of /Biniyam_PHP/api/v1 prefix by index.php (e.g. /auth/login)
$subPath = preg_replace('#^/auth#', '', $API_URI) ?: '/';

switch ("$method $subPath") {
    case 'POST /login':
        authLogin();
        break;
    case 'POST /refresh':
        authRefresh();
        break;
    case 'POST /logout':
        authLogout();
        break;
    case 'POST /change-password':
        authChangePassword();
        break;
    default:
        errorResponse('Route not found', 404);
        break;
}

// ──────────────────────────────────────────────
//  Handlers
// ──────────────────────────────────────────────

function authLogin(): void {
    $body     = getJsonBody();
    $email    = $body['email'] ?? '';
    $password = $body['password'] ?? '';

    if (!$email || !$password) {
        errorResponse('Email and password are required');
    }

    $db        = Database::getConnection();
    $jwtConfig = require __DIR__ . '/../config/jwt.php';

    // Find admin
    $stmt = $db->prepare("SELECT * FROM admins WHERE email = ? AND is_active = 1");
    $stmt->execute([strtolower(trim($email))]);
    $admin = $stmt->fetch();

    if (!$admin) {
        errorResponse('Invalid credentials', 401);
        return;
    }

    // Check lockout
    if ($admin['locked_until'] && strtotime($admin['locked_until']) > time()) {
        errorResponse('Account is locked. Please try again after 15 minutes.', 403);
        return;
    }

    // Verify password
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

    // Successful login — reset failures
    if ($admin['failed_login_attempts'] > 0 || $admin['locked_until']) {
        $stmt = $db->prepare("UPDATE admins SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?");
        $stmt->execute([$admin['id']]);
    }

    // Generate tokens
    $payload = [
        'adminId' => $admin['id'],
        'email'   => $admin['email'],
        'role'    => $admin['role'],
    ];
    $accessToken  = jwt_encode($payload, $jwtConfig['secret'], $jwtConfig['access_expiry']);
    $refreshToken = jwt_encode(array_merge($payload, ['type' => 'refresh']), $jwtConfig['secret'], $jwtConfig['refresh_expiry']);

    // Set refresh token as httpOnly cookie
    setcookie('refreshToken', $refreshToken, [
        'expires'  => time() + $jwtConfig['refresh_expiry'],
        'path'     => '/api/v1/auth/refresh',
        'httponly'  => true,
        'secure'   => false, // Set true in production with HTTPS
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

    $db = Database::getConnection();
    $stmt = $db->prepare("SELECT * FROM admins WHERE id = ? AND is_active = 1");
    $stmt->execute([$payload['adminId']]);
    $admin = $stmt->fetch();

    if (!$admin) {
        errorResponse('Admin account is inactive or not found', 401);
        return;
    }

    // Check password change — use UNIX_TIMESTAMP to avoid PHP/MySQL timezone mismatch
    $pwdTs = $admin['password_changed_at'] ? (int) strtotime($admin['password_changed_at']) : 0;
    // Better: query MySQL for the unix timestamp directly
    $tsStmt = $db->prepare("SELECT UNIX_TIMESTAMP(password_changed_at) as ts FROM admins WHERE id = ?");
    $tsStmt->execute([$payload['adminId']]);
    $tsRow = $tsStmt->fetch();
    $pwdTs = $tsRow ? (int)$tsRow['ts'] : 0;
    if ($pwdTs && isset($payload['iat'])) {
        if ((int)$payload['iat'] < $pwdTs) {
            errorResponse('Session expired due to password change. Please log in again.', 401);
            return;
        }
    }

    // Issue new tokens
    $tokenPayload = ['adminId' => $admin['id'], 'email' => $admin['email'], 'role' => $admin['role']];
    $newAccessToken  = jwt_encode($tokenPayload, $jwtConfig['secret'], $jwtConfig['access_expiry']);
    $newRefreshToken = jwt_encode(array_merge($tokenPayload, ['type' => 'refresh']), $jwtConfig['secret'], $jwtConfig['refresh_expiry']);

    setcookie('refreshToken', $newRefreshToken, [
        'expires'  => time() + $jwtConfig['refresh_expiry'],
        'path'     => '/api/v1/auth/refresh',
        'httponly'  => true,
        'secure'   => false,
        'samesite' => 'Lax',
    ]);

    successResponse([
        'accessToken'  => $newAccessToken,
        'refreshToken' => $newRefreshToken,
        'expiresIn'    => '15m',
    ]);
}

function authLogout(): void {
    setcookie('refreshToken', '', [
        'expires'  => time() - 3600,
        'path'     => '/api/v1/auth/refresh',
        'httponly'  => true,
    ]);
    successResponse(['message' => 'Logged out successfully']);
}

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

    // Issue fresh tokens so this session stays valid after the password change.
    // All previously-issued tokens (other devices/browsers) are automatically
    // invalidated because their iat < password_changed_at.
    $jwtConfig    = require __DIR__ . '/../config/jwt.php';
    $tokenPayload = ['adminId' => $admin['adminId'], 'email' => $admin['email'], 'role' => $admin['role']];
    $newAccess    = jwt_encode($tokenPayload, $jwtConfig['secret'], $jwtConfig['access_expiry']);
    $newRefresh   = jwt_encode(array_merge($tokenPayload, ['type' => 'refresh']), $jwtConfig['secret'], $jwtConfig['refresh_expiry']);

    setcookie('refreshToken', $newRefresh, [
        'expires'  => time() + $jwtConfig['refresh_expiry'],
        'path'     => '/api/v1/auth/refresh',
        'httponly'  => true,
        'secure'   => false,
        'samesite' => 'Lax',
    ]);

    successResponse([
        'message'     => 'Password changed successfully.',
        'accessToken' => $newAccess,
        'refreshToken'=> $newRefresh,
        'expiresIn'   => '15m',
    ]);
}
