<?php
/**
 * Payments routes (admin only):
 *   GET /stats/summary → getPaymentStats
 *   GET /              → listPayments
 *   GET /:id           → getPayment
 *   POST /             → createPayment
 *   PUT /:id           → updatePayment
 *   DELETE /:id        → deletePayment
 */

$method = $_SERVER['REQUEST_METHOD'];
// $API_URI is already stripped of /Biniyam_PHP/api/v1 prefix by index.php
$subPath = preg_replace('#^/payments#', '', $API_URI) ?: '/';

$segments = array_values(array_filter(explode('/', $subPath)));
$seg0 = $segments[0] ?? '';
$seg1 = $segments[1] ?? '';

switch (true) {
    case ($method === 'GET' && $seg0 === 'stats' && $seg1 === 'summary'):
        paymentsStats();
        break;
    case ($method === 'GET' && $seg0 === ''):
        paymentsList();
        break;
    case ($method === 'GET' && $seg0 !== ''):
        paymentsGet($seg0);
        break;
    case ($method === 'POST' && $seg0 === ''):
        paymentsCreate();
        break;
    case ($method === 'PUT' && $seg0 !== ''):
        paymentsUpdate($seg0);
        break;
    case ($method === 'DELETE' && $seg0 !== ''):
        paymentsDelete($seg0);
        break;
    default:
        errorResponse('Route not found', 404);
        break;
}

// ──────────────────────────────────────────────
//  Handlers
// ──────────────────────────────────────────────

function paymentsStats(): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $db = Database::getConnection();

    $totalCollected = (int)$db->query("SELECT COALESCE(SUM(amount), 0) as t FROM payments WHERE status = 'Completed'")->fetch()['t'];
    $pendingCount   = (int)$db->query("SELECT COUNT(*) as t FROM payments WHERE status = 'Pending'")->fetch()['t'];

    $byMethod = $db->query("
        SELECT method as _id, COUNT(*) as count, SUM(amount) as total
        FROM payments WHERE status IN ('Completed', 'Pending')
        GROUP BY method
    ")->fetchAll();

    $byStatus = $db->query("
        SELECT status as _id, COUNT(*) as count
        FROM payments GROUP BY status
    ")->fetchAll();

    successResponse([
        'data' => [
            'totalCollected' => $totalCollected,
            'pendingCount'   => $pendingCount,
            'byMethod'       => $byMethod,
            'byStatus'       => $byStatus,
        ],
    ]);
}

function paymentsList(): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $db     = Database::getConnection();
    $params = getQueryParams();

    $page  = max(1, (int)($params['page'] ?? 1));
    $limit = min(100, max(1, (int)($params['limit'] ?? 20)));
    $skip  = ($page - 1) * $limit;

    $where = [];
    $binds = [];

    if (!empty($params['status'])) {
        $where[] = 'p.status = ?';
        $binds[] = $params['status'];
    }
    if (!empty($params['method'])) {
        $where[] = 'p.method = ?';
        $binds[] = $params['method'];
    }
    if (!empty($params['registration'])) {
        $where[] = 'p.registration_id = ?';
        $binds[] = $params['registration'];
    }

    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $countStmt = $db->prepare("SELECT COUNT(*) as cnt FROM payments p $whereSql");
    $countStmt->execute($binds);
    $total = (int)$countStmt->fetch()['cnt'];

    $binds[] = $skip;
    $binds[] = $limit;
    $stmt = $db->prepare("
        SELECT p.*, r.status as reg_status, s.first_name, s.last_name, s.email
        FROM payments p
        JOIN registrations r ON p.registration_id = r.id
        JOIN students s ON r.student_id = s.id
        $whereSql
        ORDER BY p.created_at DESC
        LIMIT ?, ?
    ");
    $stmt->execute($binds);
    $payments = $stmt->fetchAll();

    foreach ($payments as &$p) {
        $p['id'] = (int)$p['id'];
        $p['amount'] = (int)$p['amount'];
    }

    successResponse([
        'data' => $payments,
        'pagination' => [
            'page'  => $page,
            'limit' => $limit,
            'total' => $total,
            'pages' => (int)ceil($total / $limit),
        ],
    ]);
}

function paymentsGet(string $id): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $db   = Database::getConnection();
    $stmt = $db->prepare("
        SELECT p.*, r.status as reg_status, s.first_name, s.last_name, s.email
        FROM payments p
        JOIN registrations r ON p.registration_id = r.id
        JOIN students s ON r.student_id = s.id
        WHERE p.id = ?
    ");
    $stmt->execute([$id]);
    $payment = $stmt->fetch();

    if (!$payment) {
        errorResponse('Payment not found', 404);
        return;
    }

    $payment['id'] = (int)$payment['id'];
    $payment['amount'] = (int)$payment['amount'];

    successResponse(['data' => $payment]);
}

function paymentsCreate(): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $body = getJsonBody();
    $errors = validateRequired($body, ['registration', 'amount', 'method']);
    if ($errors) {
        errorResponse(implode(' ', $errors));
        return;
    }

    $db = Database::getConnection();
    $stmt = $db->prepare("SELECT id FROM registrations WHERE id = ?");
    $stmt->execute([$body['registration']]);
    if (!$stmt->fetch()) {
        errorResponse('Registration not found', 404);
        return;
    }

    $validMethods = ['Cash', 'Bank Transfer', 'Mobile Money', 'Card'];
    $method = in_array($body['method'], $validMethods) ? $body['method'] : 'Card';

    $db->prepare("
        INSERT INTO payments (registration_id, amount, currency, method, status, transaction_reference, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ")->execute([
        $body['registration'],
        (int)$body['amount'],
        $body['currency'] ?? 'ETB',
        $method,
        $body['status'] ?? 'Pending',
        $body['transactionReference'] ?? null,
        $body['notes'] ?? null,
    ]);

    $newId = $db->lastInsertId();
    $stmt = $db->prepare("SELECT * FROM payments WHERE id = ?");
    $stmt->execute([$newId]);
    $payment = $stmt->fetch();
    $payment['id'] = (int)$payment['id'];

    successResponse(['data' => $payment], 201);
}

function paymentsUpdate(string $id): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $body = getJsonBody();
    $db   = Database::getConnection();

    $sets  = [];
    $binds = [];
    $columnMap = [
        'amount' => 'amount', 'currency' => 'currency', 'method' => 'method',
        'status' => 'status', 'transactionReference' => 'transaction_reference',
        'notes' => 'notes',
    ];

    foreach ($columnMap as $field => $col) {
        if (array_key_exists($field, $body)) {
            $sets[]  = "$col = ?";
            $binds[] = $body[$field];
        }
    }

    if (empty($sets)) {
        errorResponse('No fields to update');
        return;
    }

    $binds[] = $id;
    $stmt = $db->prepare("UPDATE payments SET " . implode(', ', $sets) . " WHERE id = ?");
    $stmt->execute($binds);

    $stmt = $db->prepare("SELECT * FROM payments WHERE id = ?");
    $stmt->execute([$id]);
    $payment = $stmt->fetch();

    if (!$payment) {
        errorResponse('Payment not found', 404);
        return;
    }

    // Sync registration if completed
    if (($body['status'] ?? '') === 'Completed' && ($payment['payment_type'] ?? '') !== 'Half') {
        $db->prepare("UPDATE registrations SET status = 'Paid' WHERE id = ?")->execute([$payment['registration_id']]);
    }

    $payment['id'] = (int)$payment['id'];
    successResponse(['data' => $payment]);
}

function paymentsDelete(string $id): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $db   = Database::getConnection();
    $stmt = $db->prepare("DELETE FROM payments WHERE id = ?");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        errorResponse('Payment not found', 404);
        return;
    }

    successResponse(['message' => 'Payment deleted successfully']);
}
