<?php
/**
 * Registrations routes:
 *   POST   /                     → createRegistration (public)
 *   POST   /bulk-create          → createRegistration (alias)
 *   POST   /validate-cart        → validateCart (public)
 *   GET    /stats/summary        → getRegistrationStats (admin)
 *   GET    /                     → listRegistrations (admin)
 *   GET    /:id                  → getRegistration (admin)
 *   GET    /:id/payments         → getRegistrationPayments (admin)
 *   PATCH  /:id/payment          → recordSecondPayment (admin)
 *   PATCH  /:id/status           → updateRegistrationStatus (admin)
 *   PUT    /:id                  → updateRegistration (admin)
 *   DELETE /:id                  → deleteRegistration (admin)
 */

$method = $_SERVER['REQUEST_METHOD'];
// $API_URI is already stripped of /Biniyam_PHP/api/v1 prefix by index.php
$subPath = preg_replace('#^/registrations#', '', $API_URI) ?: '/';

// Parse segments
$segments = array_values(array_filter(explode('/', $subPath)));
$seg0 = $segments[0] ?? '';
$seg1 = $segments[1] ?? '';
$seg2 = $segments[2] ?? '';

if (!defined('VALID_SCHEDULES')) {
    define('VALID_SCHEDULES', [
        'weekday-morning', 'weekday-afternoon', 'weekday-midday',
        'weekday-full', 'weekend',
    ]);
}

switch (true) {
    // POST /registrations or /bulk-create or /validate-cart
    case ($method === 'POST' && ($seg0 === '' || $seg0 === 'bulk-create')):
        registrationsCreate();
        break;
    case ($method === 'POST' && $seg0 === 'validate-cart'):
        registrationsValidateCart();
        break;

    // GET /stats/summary
    case ($method === 'GET' && $seg0 === 'stats' && $seg1 === 'summary'):
        registrationsStats();
        break;

    // GET /registrations (list)
    case ($method === 'GET' && $seg0 === ''):
        registrationsList();
        break;

    // GET /:id/payments
    case ($method === 'GET' && $seg0 !== '' && $seg1 === 'payments'):
        registrationsPayments($seg0);
        break;

    // GET /:id
    case ($method === 'GET' && $seg0 !== ''):
        registrationsGet($seg0);
        break;

    // PATCH /:id/payment
    case ($method === 'PATCH' && $seg0 !== '' && $seg1 === 'payment'):
        registrationsRecordPayment($seg0);
        break;

    // PATCH /:id/status
    case ($method === 'PATCH' && $seg0 !== '' && $seg1 === 'status'):
        registrationsUpdateStatus($seg0);
        break;

    // PUT /:id
    case ($method === 'PUT' && $seg0 !== ''):
        registrationsUpdate($seg0);
        break;

    // DELETE /:id
    case ($method === 'DELETE' && $seg0 !== ''):
        registrationsDelete($seg0);
        break;

    default:
        errorResponse('Route not found', 404);
        break;
}

// ──────────────────────────────────────────────
//  Helpers
function resolveProgramIdentifiers(array $ids): array {
    $db = Database::getConnection();
    $objectIds = [];
    $slugs = [];

    foreach ($ids as $id) {
        if (ctype_digit($id) && strlen($id) >= 1) {
            $objectIds[] = (int)$id;
        } else {
            $slugs[] = $id;
        }
    }

    if (!empty($slugs)) {
        $placeholders = implode(',', array_fill(0, count($slugs), '?'));
        $stmt = $db->prepare("SELECT id, slug FROM programs WHERE slug IN ($placeholders) AND is_active = 1");
        $stmt->execute($slugs);
        $slugMap = [];
        while ($row = $stmt->fetch()) {
            $slugMap[$row['slug']] = (int)$row['id'];
        }
        foreach ($slugs as $slug) {
            if (isset($slugMap[$slug])) {
                $objectIds[] = $slugMap[$slug];
            } else {
                return ['error' => "Program not found or inactive: \"$slug\""];
            }
        }
    }

    return ['ids' => $objectIds];
}

function computeProgramTotals(array $programIds): array {
    $db = Database::getConnection();
    $placeholders = implode(',', array_fill(0, count($programIds), '?'));
    $stmt = $db->prepare("SELECT id, title, price, allows_half_payment FROM programs WHERE id IN ($placeholders) AND is_active = 1");
    $stmt->execute($programIds);
    $programs = $stmt->fetchAll();

    if (count($programs) !== count($programIds)) {
        return ['error' => 'One or more programs not found or inactive'];
    }

    $total = array_sum(array_column($programs, 'price'));
    $allAllowHalf = !in_array(0, array_column($programs, 'allows_half_payment'));

    return [
        'total'        => $total,
        'halfTotal'    => (int)round($total / 2),
        'allAllowHalf' => $allAllowHalf,
        'programs'     => $programs,
    ];
}

function findOrCreateStudent(array $input): array {
    $db = Database::getConnection();

    if (!empty($input['_id'])) {
        $stmt = $db->prepare("SELECT * FROM students WHERE id = ?");
        $stmt->execute([(int)$input['_id']]);
        $student = $stmt->fetch();
        return $student ? ['student' => $student] : ['error' => 'Student not found'];
    }

    if (!empty($input['email'])) {
        $stmt = $db->prepare("SELECT * FROM students WHERE email = ?");
        $stmt->execute([strtolower(trim($input['email']))]);
        $student = $stmt->fetch();

        if ($student) {
            // Update if needed
            $updates = [];
            $binds   = [];
            foreach (['firstName' => 'first_name', 'lastName' => 'last_name', 'phone' => 'phone',
                       'nationalIdImage' => 'national_id_image', 'educationLevel' => 'education_level',
                       'fieldOfStudy' => 'field_of_study'] as $field => $col) {
                if (!empty($input[$field]) && $input[$field] !== $student[$col]) {
                    $updates[] = "$col = ?";
                    $binds[]   = $input[$field];
                }
            }
            if (!empty($updates)) {
                $binds[] = $student['id'];
                $db->prepare("UPDATE students SET " . implode(', ', $updates) . " WHERE id = ?")->execute($binds);
                $stmt = $db->prepare("SELECT * FROM students WHERE id = ?");
                $stmt->execute([$student['id']]);
                $student = $stmt->fetch();
            }
            return ['student' => $student];
        }
    }

    // Create new
    if (empty($input['firstName']) || empty($input['lastName']) || empty($input['email']) || empty($input['phone'])) {
        return ['error' => 'Student first name, last name, email, and phone are required'];
    }

    $stmt = $db->prepare("
        INSERT INTO students (first_name, last_name, email, phone, national_id_image, education_level, field_of_study)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        sanitizeString($input['firstName']),
        sanitizeString($input['lastName']),
        strtolower(trim($input['email'])),
        sanitizeString($input['phone']),
        $input['nationalIdImage'] ?? null,
        $input['educationLevel'] ?? null,
        isset($input['fieldOfStudy']) ? sanitizeString($input['fieldOfStudy']) : null,
    ]);

    $newId = $db->lastInsertId();
    $stmt = $db->prepare("SELECT * FROM students WHERE id = ?");
    $stmt->execute([$newId]);
    return ['student' => $stmt->fetch()];
}

/**
 * Nest flat student columns into a 'student' object.
 * PHP API returns first_name, last_name, email, phone, etc. as flat fields.
 * The admin frontend expects them inside a nested `student` object.
 */
function nestStudentData(array $row): array {
    $student = [
        '_id'             => (string)($row['student_id'] ?? $row['studentId'] ?? ''),
        'firstName'       => $row['first_name'] ?? '',
        'lastName'        => $row['last_name'] ?? '',
        'email'           => $row['email'] ?? '',
        'phone'           => $row['phone'] ?? '',
        'nationalIdImage' => $row['national_id_image'] ?? null,
        'educationLevel'  => $row['education_level'] ?? null,
        'fieldOfStudy'    => $row['field_of_study'] ?? null,
    ];

    // Remove flat student fields from the row
    unset(
        $row['first_name'], $row['last_name'], $row['email'], $row['phone'],
        $row['national_id_image'], $row['education_level'], $row['field_of_study'],
        $row['student_id'], $row['studentId']
    );

    $row['student'] = $student;
    return $row;
}

// ──────────────────────────────────────────────
//  Handlers
// ──────────────────────────────────────────────

function registrationsCreate(): void {
    $body = getJsonBody();
    $studentInput  = $body['student'] ?? null;
    $programIds    = $body['programs'] ?? (isset($body['program']) ? [$body['program']] : []);
    $schedule      = $body['schedule'] ?? '';
    $paymentType   = $body['paymentType'] ?? 'Full';

    if (!$studentInput || empty($programIds) || !$schedule) {
        errorResponse('Student details, at least one program ID, and schedule are required');
        return;
    }

    if (!in_array($schedule, VALID_SCHEDULES)) {
        errorResponse("Invalid schedule. Must be one of: " . implode(', ', VALID_SCHEDULES));
        return;
    }

    // Resolve programs
    $resolved = resolveProgramIdentifiers($programIds);
    if (isset($resolved['error'])) {
        errorResponse($resolved['error'], 404);
        return;
    }

    // Compute totals
    $totals = computeProgramTotals($resolved['ids']);
    if (isset($totals['error'])) {
        errorResponse($totals['error'], 404);
        return;
    }

    // Validate payment type
    if (!in_array($paymentType, ['Full', 'Half'])) {
        errorResponse('Payment type must be Full or Half');
        return;
    }
    if ($paymentType === 'Half' && !$totals['allAllowHalf']) {
        errorResponse('Half payment is not available for the selected courses. Only full payment is allowed.');
        return;
    }

    // Find or create student
    $result = findOrCreateStudent($studentInput);
    if (isset($result['error'])) {
        errorResponse($result['error']);
        return;
    }
    $student = $result['student'];

    // Check for existing active registration
    $db = Database::getConnection();
    $placeholders = implode(',', array_fill(0, count($resolved['ids']), '?'));
    $checkStmt = $db->prepare("
        SELECT id FROM registrations
        WHERE student_id = ? AND status IN ('Pending', 'Confirmed', 'Paid')
        AND id IN (SELECT registration_id FROM registration_programs WHERE program_id IN ($placeholders))
    ");
    $checkBinds = array_merge([$student['id']], $resolved['ids']);
    $checkStmt->execute($checkBinds);
    if ($checkStmt->fetch()) {
        errorResponse('This student is already registered for one or more of the selected programs', 409);
        return;
    }

    // Create registration
    $stmt = $db->prepare("
        INSERT INTO registrations (student_id, schedule, status, payment_type)
        VALUES (?, ?, 'Pending', ?)
    ");
    $stmt->execute([$student['id'], $schedule, $paymentType]);
    $regId = $db->lastInsertId();

    // Insert into junction table
    $juncStmt = $db->prepare("INSERT INTO registration_programs (registration_id, program_id) VALUES (?, ?)");
    foreach ($resolved['ids'] as $pid) {
        $juncStmt->execute([$regId, $pid]);
    }

    // Fetch populated result
    $stmt = $db->prepare("
        SELECT r.*, s.first_name, s.last_name, s.email, s.phone, s.national_id_image,
               s.education_level, s.field_of_study
        FROM registrations r
        JOIN students s ON r.student_id = s.id
        WHERE r.id = ?
    ");
    $stmt->execute([$regId]);
    $registration = $stmt->fetch();

    // Fetch programs
    $progStmt = $db->prepare("
        SELECT p.* FROM programs p
        JOIN registration_programs rp ON p.id = rp.program_id
        WHERE rp.registration_id = ?
    ");
    $progStmt->execute([$regId]);
    $programs = array_map('formatProgram', $progStmt->fetchAll());

    $amount = $paymentType === 'Half' ? $totals['halfTotal'] : $totals['total'];

    successResponse([
        'data' => array_merge(nestStudentData($registration), [
            'programs'          => $programs,
            'totalAmount'       => $amount,
            'allowsHalfPayment' => $totals['allAllowHalf'],
        ]),
    ], 201);
}

function registrationsValidateCart(): void {
    $body = getJsonBody();
    $programIds = $body['programs'] ?? [];

    if (empty($programIds) || !is_array($programIds)) {
        errorResponse('At least one program ID is required');
        return;
    }

    $resolved = resolveProgramIdentifiers($programIds);
    if (isset($resolved['error'])) {
        errorResponse($resolved['error'], 404);
        return;
    }

    $totals = computeProgramTotals($resolved['ids']);
    if (isset($totals['error'])) {
        errorResponse($totals['error'], 404);
        return;
    }

    successResponse([
        'data' => [
            'programs' => array_map(fn($p) => [
                '_id'               => (int)$p['id'],
                'title'             => $p['title'],
                'price'             => (int)$p['price'],
                'allowsHalfPayment' => (bool)$p['allows_half_payment'],
            ], $totals['programs']),
            'total'        => $totals['total'],
            'halfTotal'    => $totals['halfTotal'],
            'allAllowHalf' => $totals['allAllowHalf'],
        ],
    ]);
}

function registrationsList(): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $db     = Database::getConnection();
    $params = getQueryParams();

    $page  = max(1, (int)($params['page'] ?? 1));
    $limit = min(100, max(1, (int)($params['limit'] ?? 20)));
    $skip  = ($page - 1) * $limit;

    $where = [];
    $binds = [];

    $filter = $params['filter'] ?? '';
    if ($filter === 'paidInFull') {
        $where[] = "r.status = 'Paid'";
    } elseif ($filter === 'halfPaid') {
        $where[] = "r.payment_type = 'Half' AND r.status != 'Paid'";
    }

    if (!empty($params['status'])) {
        $where[] = "r.status = ?";
        $binds[] = $params['status'];
    }

    if (!empty($params['schedule'])) {
        $where[] = "r.schedule = ?";
        $binds[] = $params['schedule'];
    }

    // Search by student name or email
    if (!empty($params['search'])) {
        $search = '%' . trim($params['search']) . '%';
        $where[] = "(s.first_name LIKE ? OR s.last_name LIKE ? OR s.email LIKE ? OR CONCAT(s.first_name, ' ', s.last_name) LIKE ?)";
        $binds[] = $search;
        $binds[] = $search;
        $binds[] = $search;
        $binds[] = $search;
    }

    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $countJoin = !empty($params['search']) ? ' JOIN students s ON r.student_id = s.id' : '';
    $countStmt = $db->prepare("SELECT COUNT(*) as cnt FROM registrations r{$countJoin} $whereSql");
    $countStmt->execute($binds);
    $total = (int)$countStmt->fetch()['cnt'];

    $binds[] = $skip;
    $binds[] = $limit;
    $stmt = $db->prepare("
        SELECT r.*, s.first_name, s.last_name, s.email, s.phone, s.national_id_image,
               s.education_level, s.field_of_study
        FROM registrations r
        JOIN students s ON r.student_id = s.id
        $whereSql
        ORDER BY r.created_at DESC
        LIMIT ?, ?
    ");
    $stmt->execute($binds);
    $registrations = $stmt->fetchAll();

    // Attach programs to each registration
    foreach ($registrations as &$reg) {
        $reg['id'] = (int)$reg['id'];
        $progStmt = $db->prepare("
            SELECT p.* FROM programs p
            JOIN registration_programs rp ON p.id = rp.program_id
            WHERE rp.registration_id = ?
        ");
        $progStmt->execute([$reg['id']]);
        $reg['programs'] = array_map('formatProgram', $progStmt->fetchAll());
        $reg = nestStudentData($reg);
    }

    successResponse([
        'data' => $registrations,
        'pagination' => [
            'page'  => $page,
            'limit' => $limit,
            'total' => $total,
            'pages' => (int)ceil($total / $limit),
        ],
    ]);
}

function registrationsGet(string $id): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $db = Database::getConnection();
    $stmt = $db->prepare("
        SELECT r.*, s.first_name, s.last_name, s.email, s.phone, s.national_id_image,
               s.education_level, s.field_of_study
        FROM registrations r
        JOIN students s ON r.student_id = s.id
        WHERE r.id = ?
    ");
    $stmt->execute([$id]);
    $registration = $stmt->fetch();

    if (!$registration) {
        errorResponse('Registration not found', 404);
        return;
    }

    $registration['id'] = (int)$registration['id'];

    $progStmt = $db->prepare("
        SELECT p.* FROM programs p
        JOIN registration_programs rp ON p.id = rp.program_id
        WHERE rp.registration_id = ?
    ");
    $progStmt->execute([$id]);
    $registration['programs'] = array_map('formatProgram', $progStmt->fetchAll());
    $registration = nestStudentData($registration);

    successResponse(['data' => $registration]);
}

function registrationsStats(): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $db = Database::getConnection();

    $stats = [];
    foreach ([
        'total'        => "SELECT COUNT(*) as cnt FROM registrations",
        'paidInFull'   => "SELECT COUNT(*) as cnt FROM registrations WHERE status = 'Paid'",
        'halfPaid'     => "SELECT COUNT(*) as cnt FROM registrations WHERE payment_type = 'Half' AND status != 'Paid'",
        'pending'      => "SELECT COUNT(*) as cnt FROM registrations WHERE status = 'Pending'",
        'confirmed'    => "SELECT COUNT(*) as cnt FROM registrations WHERE status = 'Confirmed'",
        'cancelled'    => "SELECT COUNT(*) as cnt FROM registrations WHERE status = 'Cancelled'",
    ] as $key => $sql) {
        $stats[$key] = (int)$db->query($sql)->fetch()['cnt'];
    }

    // Total collected
    $totalStmt = $db->query("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'Completed'");
    $stats['totalCollected'] = (int)$totalStmt->fetch()['total'];

    // Program counts
    $progStmt = $db->query("
        SELECT rp.program_id as _id, p.title, COUNT(*) as count
        FROM registration_programs rp
        JOIN programs p ON rp.program_id = p.id
        GROUP BY rp.program_id, p.title
        ORDER BY count DESC
    ");
    $stats['programCounts'] = $progStmt->fetchAll();

    successResponse(['data' => $stats]);
}

function registrationsPayments(string $id): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $db = Database::getConnection();
    $stmt = $db->prepare("SELECT id FROM registrations WHERE id = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        errorResponse('Registration not found', 404);
        return;
    }

    $payStmt = $db->prepare("SELECT * FROM payments WHERE registration_id = ? ORDER BY created_at DESC");
    $payStmt->execute([$id]);
    $payments = $payStmt->fetchAll();

    $totalPaid = array_sum(array_column(
        array_filter($payments, fn($p) => $p['status'] === 'Completed'),
        'amount'
    ));

    successResponse([
        'data' => [
            'payments'      => $payments,
            'totalPaid'     => $totalPaid,
            'paymentCount'  => count($payments),
        ],
    ]);
}

function registrationsRecordPayment(string $id): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $body  = getJsonBody();
    $requestedAmount = $body['amount'] ?? null;
    $db = Database::getConnection();

    $stmt = $db->prepare("SELECT r.*, GROUP_CONCAT(p.price) as prices FROM registrations r
        JOIN registration_programs rp ON r.id = rp.registration_id
        JOIN programs p ON rp.program_id = p.id
        WHERE r.id = ? GROUP BY r.id
    ");
    $stmt->execute([$id]);
    $registration = $stmt->fetch();

    if (!$registration) {
        errorResponse('Registration not found', 404);
        return;
    }

    if ($registration['status'] === 'Paid' && $registration['payment_type'] !== 'Half') {
        errorResponse('This registration is already marked as fully paid.');
        return;
    }

    $totalCost = array_sum(explode(',', $registration['prices']));

    $paidStmt = $db->prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE registration_id = ? AND status = 'Completed'");
    $paidStmt->execute([$id]);
    $alreadyPaid = (int)$paidStmt->fetch()['total'];
    $remainingBalance = $totalCost - $alreadyPaid;

    if ($requestedAmount !== null) {
        $requestedAmount = (float)$requestedAmount;
        if ($requestedAmount <= 0 || !is_finite($requestedAmount)) {
            errorResponse('Payment amount must be a positive number.');
            return;
        }
        if ($requestedAmount > $remainingBalance) {
            errorResponse("Payment amount cannot exceed the remaining balance of $remainingBalance ETB.");
            return;
        }
    }

    $amountToRecord = $requestedAmount !== null ? $requestedAmount : max(0, $remainingBalance);

    if ($remainingBalance <= 0) {
        $db->prepare("UPDATE registrations SET status = 'Paid' WHERE id = ?")->execute([$id]);
    } elseif ($amountToRecord > 0) {
        $db->prepare("
            INSERT INTO payments (registration_id, amount, currency, method, status, payment_type, notes)
            VALUES (?, ?, 'ETB', 'Cash', 'Completed', ?, ?)
        ")->execute([
            $id,
            $amountToRecord,
            $registration['payment_type'] ?? 'Full',
            "Manual payment recorded by admin ({$admin['email']}). Amount of $amountToRecord ETB.",
        ]);

        if ($alreadyPaid + $amountToRecord >= $totalCost) {
            $db->prepare("UPDATE registrations SET status = 'Paid' WHERE id = ?")->execute([$id]);
        }
    }

    $fullyPaid = ($alreadyPaid + $amountToRecord) >= $totalCost;

    // Return updated data
    $regStmt = $db->prepare("
        SELECT r.*, s.first_name, s.last_name, s.email, s.phone,
               s.national_id_image, s.education_level, s.field_of_study
        FROM registrations r JOIN students s ON r.student_id = s.id WHERE r.id = ?
    ");
    $regStmt->execute([$id]);
    $updated = nestStudentData($regStmt->fetch());

    $allPayStmt = $db->prepare("SELECT * FROM payments WHERE registration_id = ? ORDER BY created_at DESC");
    $allPayStmt->execute([$id]);
    $allPayments = $allPayStmt->fetchAll();
    $totalPaid = array_sum(array_column(array_filter($allPayments, fn($p) => $p['status'] === 'Completed'), 'amount'));

    successResponse([
        'message' => $fullyPaid
            ? 'Payment recorded successfully. Registration marked as fully paid.'
            : 'Payment recorded successfully. Registration is not fully paid yet.',
        'data' => [
            'registration'    => $updated,
            'payments'        => $allPayments,
            'totalPaid'       => $totalPaid,
            'remainingBalance' => max(0, $totalCost - $totalPaid),
        ],
    ]);
}

function registrationsUpdate(string $id): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $body = getJsonBody();
    $db   = Database::getConnection();

    $sets  = [];
    $binds = [];

    if (isset($body['schedule'])) {
        $sets[] = 'schedule = ?';
        $binds[] = $body['schedule'];
    }
    if (isset($body['paymentType'])) {
        $sets[] = 'payment_type = ?';
        $binds[] = $body['paymentType'];
    }
    if (isset($body['notes'])) {
        $sets[] = 'notes = ?';
        $binds[] = $body['notes'];
    }

    if (empty($sets)) {
        errorResponse('No fields to update');
        return;
    }

    $binds[] = $id;
    $stmt = $db->prepare("UPDATE registrations SET " . implode(', ', $sets) . " WHERE id = ?");
    $stmt->execute($binds);

    if ($stmt->rowCount() === 0) {
        errorResponse('Registration not found', 404);
        return;
    }

    registrationsGet($id);
}

function registrationsUpdateStatus(string $id): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $body   = getJsonBody();
    $status = $body['status'] ?? '';
    $valid  = ['Pending', 'Confirmed', 'Paid', 'Cancelled'];

    if (!in_array($status, $valid)) {
        errorResponse("Status must be one of: " . implode(', ', $valid));
        return;
    }

    $db   = Database::getConnection();
    $stmt = $db->prepare("UPDATE registrations SET status = ? WHERE id = ?");
    $stmt->execute([$status, $id]);

    if ($stmt->rowCount() === 0) {
        errorResponse('Registration not found', 404);
        return;
    }

    registrationsGet($id);
}

function registrationsDelete(string $id): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $db = Database::getConnection();
    $db->prepare("DELETE FROM payments WHERE registration_id = ?")->execute([$id]);
    $db->prepare("DELETE FROM registration_programs WHERE registration_id = ?")->execute([$id]);
    $stmt = $db->prepare("DELETE FROM registrations WHERE id = ?");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        errorResponse('Registration not found', 404);
        return;
    }

    successResponse(['message' => 'Registration deleted successfully']);
}
