<?php
/**
 * Admin routes: POST / (create admin), GET /profile
 *
 * Expected URI after prefix stripping: /admin, /admin/profile
 */

$method = $_SERVER['REQUEST_METHOD'];
// $API_URI is already stripped of /Biniyam_PHP/api/v1 prefix by index.php (e.g. /admin/profile)
$subPath = preg_replace('#^/admin#', '', $API_URI) ?: '/';

switch ("$method $subPath") {
    case 'POST /':
        adminCreate();
        break;
    case 'GET /profile':
        adminProfile();
        break;
    default:
        errorResponse('Route not found', 404);
        break;
}

// ──────────────────────────────────────────────
//  Handlers
// ──────────────────────────────────────────────

function adminCreate(): void {
    $body = getJsonBody();
    $fullName = $body['fullName'] ?? '';
    $email    = $body['email'] ?? '';
    $password = $body['password'] ?? '';
    $role     = $body['role'] ?? 'ADMIN';

    if (!$fullName || !$email || !$password) {
        errorResponse('Full name, email, and password are required');
        return;
    }

    $db = Database::getConnection();

    // Check existing
    $stmt = $db->prepare("SELECT id FROM admins WHERE email = ?");
    $stmt->execute([strtolower(trim($email))]);
    if ($stmt->fetch()) {
        errorResponse('An admin with that email already exists', 409);
        return;
    }

    // Only allow unauthenticated creation if no admins exist (bootstrap)
    $stmt = $db->query("SELECT COUNT(*) as cnt FROM admins");
    $count = $stmt->fetch()['cnt'];
    if ($count > 0) {
        $admin = AuthMiddleware::authenticate();
        if (!$admin) {
            errorResponse('Only authenticated admins can create new admin accounts', 403);
            return;
        }
    }

    $validRoles = ['SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER', 'FINANCE_MANAGER'];
    if (!in_array($role, $validRoles)) {
        $role = 'ADMIN';
    }

    $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);

    $stmt = $db->prepare("
        INSERT INTO admins (full_name, email, password_hash, role)
        VALUES (?, ?, ?, ?)
    ");
    $stmt->execute([
        sanitizeString($fullName),
        strtolower(trim($email)),
        $passwordHash,
        $role,
    ]);

    $newId = $db->lastInsertId();

    successResponse([
        'admin' => [
            'id'        => (int)$newId,
            'fullName'  => $fullName,
            'email'     => strtolower(trim($email)),
            'role'      => $role,
            'isActive'  => true,
            'createdAt' => date('c'),
        ],
    ], 201);
}

function adminProfile(): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $db   = Database::getConnection();
    $stmt = $db->prepare("SELECT id, full_name, email, role, is_active, created_at, updated_at FROM admins WHERE id = ?");
    $stmt->execute([$admin['adminId']]);
    $row = $stmt->fetch();

    if (!$row) {
        errorResponse('Admin not found', 404);
        return;
    }

    successResponse([
        'admin' => [
            'id'        => (int)$row['id'],
            'fullName'  => $row['full_name'],
            'email'     => $row['email'],
            'role'      => $row['role'],
            'isActive'  => (bool)$row['is_active'],
            'createdAt' => $row['created_at'],
            'updatedAt' => $row['updated_at'],
        ],
    ]);
}
