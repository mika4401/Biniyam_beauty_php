# 📄 Documentation: `api/admin.php` — Admin Profile Management

## What Does This File Do?

This file handles admin-related routes:
- `POST /admin` — Create a new admin user
- `GET /admin/profile` — Get the currently logged-in admin's profile

---

## Routes & Handlers

### `POST /admin` — Create New Admin

```php
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
```

**Line-by-line:**
- Read the admin details from the request body.
- Validate that all required fields are present.

---

```php
    $db = Database::getConnection();

    $stmt = $db->prepare("SELECT id FROM admins WHERE email = ?");
    $stmt->execute([strtolower(trim($email))]);
    if ($stmt->fetch()) {
        errorResponse('An admin with that email already exists', 409);
        return;
    }
```

**Line-by-line:**
- Check if an admin with this email already exists.
- If yes → return 409 Conflict error.

---

```php
    $stmt = $db->query("SELECT COUNT(*) as cnt FROM admins");
    $count = $stmt->fetch()['cnt'];
    if ($count > 0) {
        $admin = AuthMiddleware::authenticate();
        if (!$admin) {
            errorResponse('Only authenticated admins can create new admin accounts', 403);
            return;
        }
    }
```

**Line-by-line:**
- Check how many admins exist.
- If there are already admins (count > 0), require authentication to create a new one.
- This prevents unauthorized people from creating admin accounts.
- Exception: If there are NO admins (fresh install), allow unauthenticated creation.

---

```php
    $validRoles = ['SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER', 'FINANCE_MANAGER'];
    if (!in_array($role, $validRoles)) {
        $role = 'ADMIN';
    }

    $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);

    $stmt = $db->prepare("INSERT INTO admins (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)");
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
```

**Line-by-line:**
- Validate the role (must be one of the valid roles, default to ADMIN).
- Hash the password (never store plain text!).
- Insert the new admin into the database.
- Return the new admin's info with 201 Created status.

---

### `GET /admin/profile` — Get Current Admin Profile

```php
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
```

**Line-by-line:**
- Require authentication.
- Fetch the admin's details from the database.
- Return formatted admin info.

---

## 🎯 Summary

| Route | Auth Required? | What It Does |
|-------|---------------|-------------|
| `POST /admin` | Yes (if admins exist) | Create a new admin account |
| `GET /admin/profile` | Yes | Get the logged-in admin's profile |
