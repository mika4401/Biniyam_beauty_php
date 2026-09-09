<?php
/**
 * Auth middleware — JWT verification.
 * Returns the authenticated admin payload or sends an error response.
 */

require_once __DIR__ . '/../helpers/jwt.php';
require_once __DIR__ . '/../helpers/response.php';

class AuthMiddleware {

    /**
     * Require a valid JWT access token.
     * @return array|null  Admin payload on success, null on failure (response already sent).
     */
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
        $stmt = $db->prepare("SELECT id, UNIX_TIMESTAMP(password_changed_at) as pwd_changed_ts, is_active FROM admins WHERE id = ?");
        $stmt->execute([$payload['adminId']]);
        $admin = $stmt->fetch();

        if (!$admin || !$admin['is_active']) {
            errorResponse('Admin account is inactive or not found', 401);
            return null;
        }

        // Check if password was changed after token was issued
        // Uses UNIX_TIMESTAMP() from MySQL to avoid PHP/MySQL timezone mismatch
        if ($admin['pwd_changed_ts'] && isset($payload['iat'])) {
            if ((int)$payload['iat'] < (int)$admin['pwd_changed_ts']) {
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

    /**
     * Optional auth — returns admin payload if token present, null otherwise.
     * Does NOT send an error response.
     */
    public static function optionalAuth(): ?array {
        $token = getAuthToken();
        if (!$token) {
            return null;
        }

        $jwtConfig = require __DIR__ . '/../config/jwt.php';
        $payload   = jwt_decode($token, $jwtConfig['secret']);
        return $payload;
    }
}
