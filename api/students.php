<?php
/**
 * Students routes: GET /, GET /:id, POST /, PUT /:id, DELETE /:id
 *
 * Expected URI after prefix stripping: /students, /students/123
 */

$method = $_SERVER['REQUEST_METHOD'];
// $API_URI is already stripped of /Biniyam_PHP/api/v1 prefix by index.php
$subPath = preg_replace('#^/students#', '', $API_URI) ?: '/';

$id = null;
if (preg_match('#^/(\d+)$#', $subPath, $m)) {
    $id = $m[1];
}

switch (true) {
    case ($method === 'GET' && $subPath === '/'):
        studentsList();
        break;
    case ($method === 'GET' && $id !== null):
        studentsGet($id);
        break;
    case ($method === 'POST' && $subPath === '/'):
        studentsCreate();
        break;
    case ($method === 'PUT' && $id !== null):
        studentsUpdate($id);
        break;
    case ($method === 'DELETE' && $id !== null):
        studentsDelete($id);
        break;
    default:
        errorResponse('Route not found', 404);
        break;
}

// ──────────────────────────────────────────────
//  Handlers
// ──────────────────────────────────────────────

function studentsList(): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $db     = Database::getConnection();
    $params = getQueryParams();

    $page  = max(1, (int)($params['page'] ?? 1));
    $limit = min(100, max(1, (int)($params['limit'] ?? 20)));
    $search = $params['search'] ?? '';
    $skip  = ($page - 1) * $limit;

    $where = [];
    $binds = [];

    if ($search) {
        $where[] = '(first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ?)';
        $binds[] = "%$search%";
        $binds[] = "%$search%";
        $binds[] = "%$search%";
        $binds[] = "%$search%";
    }

    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $countStmt = $db->prepare("SELECT COUNT(*) as cnt FROM students $whereSql");
    $countStmt->execute($binds);
    $total = (int)$countStmt->fetch()['cnt'];

    $binds[] = $skip;
    $binds[] = $limit;
    $stmt = $db->prepare("SELECT * FROM students $whereSql ORDER BY created_at DESC LIMIT ?, ?");
    $stmt->execute($binds);
    $students = $stmt->fetchAll();

    foreach ($students as &$s) {
        $s['id'] = (int)$s['id'];
    }

    successResponse([
        'data' => $students,
        'pagination' => [
            'page'  => $page,
            'limit' => $limit,
            'total' => $total,
            'pages' => (int)ceil($total / $limit),
        ],
    ]);
}

function studentsGet(string $id): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $db   = Database::getConnection();
    $stmt = $db->prepare("SELECT * FROM students WHERE id = ?");
    $stmt->execute([$id]);
    $student = $stmt->fetch();

    if (!$student) {
        errorResponse('Student not found', 404);
        return;
    }

    $student['id'] = (int)$student['id'];

    // Also fetch registrations
    $regStmt = $db->prepare("
        SELECT r.*, GROUP_CONCAT(p.title) as program_titles
        FROM registrations r
        JOIN registration_programs rp ON r.id = rp.registration_id
        JOIN programs p ON rp.program_id = p.id
        WHERE r.student_id = ?
        GROUP BY r.id
        ORDER BY r.created_at DESC
    ");
    $regStmt->execute([$id]);
    $registrations = $regStmt->fetchAll();

    successResponse([
        'data' => array_merge($student, ['registrations' => $registrations]),
    ]);
}

function studentsCreate(): void {
    $body = getJsonBody();
    $errors = validateRequired($body, ['firstName', 'lastName', 'email', 'phone']);
    if ($errors) {
        errorResponse(implode(' ', $errors));
        return;
    }

    if (!validateEmail($body['email'])) {
        errorResponse('Invalid email address');
        return;
    }

    $db = Database::getConnection();

    // Check uniqueness
    $stmt = $db->prepare("SELECT id FROM students WHERE email = ?");
    $stmt->execute([strtolower(trim($body['email']))]);
    if ($stmt->fetch()) {
        errorResponse('A student with this email already exists', 409);
        return;
    }

    $stmt = $db->prepare("
        INSERT INTO students (first_name, last_name, email, phone, national_id_image,
            education_level, field_of_study, address, date_of_birth, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        sanitizeString($body['firstName']),
        sanitizeString($body['lastName']),
        strtolower(trim($body['email'])),
        sanitizeString($body['phone']),
        $body['nationalIdImage'] ?? null,
        $body['educationLevel'] ?? null,
        isset($body['fieldOfStudy']) ? sanitizeString($body['fieldOfStudy']) : null,
        isset($body['address']) ? sanitizeString($body['address']) : null,
        $body['dateOfBirth'] ?? null,
        isset($body['notes']) ? sanitizeString($body['notes']) : null,
    ]);

    $newId = $db->lastInsertId();
    $stmt = $db->prepare("SELECT * FROM students WHERE id = ?");
    $stmt->execute([$newId]);
    $student = $stmt->fetch();
    $student['id'] = (int)$student['id'];

    successResponse(['data' => $student], 201);
}

function studentsUpdate(string $id): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $body = getJsonBody();
    $db   = Database::getConnection();

    $stmt = $db->prepare("SELECT id FROM students WHERE id = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        errorResponse('Student not found', 404);
        return;
    }

    $sets  = [];
    $binds = [];
    $columnMap = [
        'firstName' => 'first_name', 'lastName' => 'last_name',
        'email' => 'email', 'phone' => 'phone',
        'nationalIdImage' => 'national_id_image', 'educationLevel' => 'education_level',
        'fieldOfStudy' => 'field_of_study', 'address' => 'address',
        'dateOfBirth' => 'date_of_birth', 'notes' => 'notes',
    ];

    foreach ($columnMap as $field => $column) {
        if (array_key_exists($field, $body)) {
            $sets[]  = "$column = ?";
            $value   = $body[$field];
            $binds[] = in_array($field, ['firstName', 'lastName', 'address', 'fieldOfStudy', 'notes'])
                ? sanitizeString($value)
                : ($field === 'email' ? strtolower(trim($value)) : $value);
        }
    }

    if (empty($sets)) {
        errorResponse('No fields to update');
        return;
    }

    $binds[] = $id;
    $stmt = $db->prepare("UPDATE students SET " . implode(', ', $sets) . " WHERE id = ?");
    $stmt->execute($binds);

    $stmt = $db->prepare("SELECT * FROM students WHERE id = ?");
    $stmt->execute([$id]);
    $student = $stmt->fetch();
    $student['id'] = (int)$student['id'];

    successResponse(['data' => $student]);
}

function studentsDelete(string $id): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $db = Database::getConnection();

    // Check for active registrations
    $stmt = $db->prepare("
        SELECT COUNT(*) as cnt FROM registrations
        WHERE student_id = ? AND status IN ('Pending', 'Confirmed', 'Paid')
    ");
    $stmt->execute([$id]);
    $active = (int)$stmt->fetch()['cnt'];

    if ($active > 0) {
        errorResponse("Cannot delete student with $active active registration(s). Cancel registrations first.", 409);
        return;
    }

    // Delete associated registrations and payments
    $stmt = $db->prepare("DELETE FROM payments WHERE registration_id IN (SELECT id FROM registrations WHERE student_id = ?)");
    $stmt->execute([$id]);

    $stmt = $db->prepare("DELETE FROM registration_programs WHERE registration_id IN (SELECT id FROM registrations WHERE student_id = ?)");
    $stmt->execute([$id]);

    $stmt = $db->prepare("DELETE FROM registrations WHERE student_id = ?");
    $stmt->execute([$id]);

    $stmt = $db->prepare("DELETE FROM students WHERE id = ?");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        errorResponse('Student not found', 404);
        return;
    }

    successResponse(['message' => 'Student deleted successfully']);
}
