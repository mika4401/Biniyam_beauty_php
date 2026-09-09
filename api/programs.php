<?php
/**
 * Programs routes: GET /, GET /:id, POST /, PUT /:id, DELETE /:id
 *
 * Expected URI after prefix stripping: /programs, /programs/123
 */

$method = $_SERVER['REQUEST_METHOD'];
// $API_URI is already stripped of /Biniyam_PHP/api/v1 prefix by index.php
$subPath = preg_replace('#^/programs#', '', $API_URI) ?: '/';

// Extract ID if present: /programs/123 → id = "123"
$id = null;
if (preg_match('#^/(\d+)$#', $subPath, $m)) {
    $id = $m[1];
}

switch (true) {
    case ($method === 'GET' && $subPath === '/'):
        programsList();
        break;
    case ($method === 'GET' && $id !== null):
        programsGet($id);
        break;
    case ($method === 'POST' && $subPath === '/'):
        programsCreate();
        break;
    case ($method === 'PUT' && $id !== null):
        programsUpdate($id);
        break;
    case ($method === 'DELETE' && $id !== null):
        programsDelete($id);
        break;
    default:
        errorResponse('Route not found', 404);
        break;
}

// ──────────────────────────────────────────────
//  Handlers
// ──────────────────────────────────────────────

function programsList(): void {
    $db    = Database::getConnection();
    $admin = AuthMiddleware::optionalAuth();
    $params = getQueryParams();

    $page    = max(1, (int)($params['page'] ?? 1));
    $limit   = min(100, max(1, (int)($params['limit'] ?? 20)));
    $search  = $params['search'] ?? '';
    $skip    = ($page - 1) * $limit;

    $where  = [];
    $binds  = [];

    // Non-authenticated users only see active programs
    if (!$admin) {
        $where[]  = 'is_active = 1';
    } elseif (isset($params['isActive'])) {
        $where[]  = 'is_active = ?';
        $binds[]  = $params['isActive'] === 'true' ? 1 : 0;
    }

    if ($search) {
        $where[] = '(title LIKE ? OR description LIKE ?)';
        $binds[] = "%$search%";
        $binds[] = "%$search%";
    }

    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    // Count
    $countStmt = $db->prepare("SELECT COUNT(*) as cnt FROM programs $whereSql");
    $countStmt->execute($binds);
    $total = (int)$countStmt->fetch()['cnt'];

    // Fetch
    $binds[] = $skip;
    $binds[] = $limit;
    $stmt = $db->prepare("
        SELECT * FROM programs $whereSql
        ORDER BY created_at DESC
        LIMIT ?, ?
    ");
    $stmt->execute($binds);
    $programs = $stmt->fetchAll();

    // Decode JSON columns
    foreach ($programs as &$p) {
        $p['id'] = (int)$p['id'];
        $p['price'] = (int)$p['price'];
        $p['is_active'] = (bool)$p['is_active'];
        $p['allows_half_payment'] = (bool)$p['allows_half_payment'];
        $p['included'] = json_decode($p['included'] ?? '[]', true);
        $p['included_am'] = json_decode($p['included_am'] ?? 'null', true);
    }

    successResponse([
        'data' => $programs,
        'pagination' => [
            'page'  => $page,
            'limit' => $limit,
            'total' => $total,
            'pages' => (int)ceil($total / $limit),
        ],
    ]);
}

function programsGet(string $id): void {
    $db    = Database::getConnection();
    $admin = AuthMiddleware::optionalAuth();

    // Try by ID first, then by slug
    if (ctype_digit($id)) {
        $stmt = $db->prepare("SELECT * FROM programs WHERE id = ?");
        $stmt->execute([$id]);
    } else {
        $stmt = $db->prepare("SELECT * FROM programs WHERE slug = ?");
        $stmt->execute([$id]);
    }
    $program = $stmt->fetch();

    if (!$program) {
        errorResponse('Program not found', 404);
        return;
    }

    // Hide inactive programs from non-admins
    if (!$admin && !$program['is_active']) {
        errorResponse('Program not found', 404);
        return;
    }

    $program['id'] = (int)$program['id'];
    $program['price'] = (int)$program['price'];
    $program['is_active'] = (bool)$program['is_active'];
    $program['allows_half_payment'] = (bool)$program['allows_half_payment'];
    $program['included'] = json_decode($program['included'] ?? '[]', true);
    $program['included_am'] = json_decode($program['included_am'] ?? 'null', true);

    successResponse(['data' => $program]);
}

function programsCreate(): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $body = getJsonBody();
    $errors = validateRequired($body, ['title', 'description', 'fullDescription', 'price', 'duration']);
    if ($errors) {
        errorResponse(implode(' ', $errors));
        return;
    }

    $db = Database::getConnection();

    // Auto-generate slug
    $slug = strtolower(trim($body['title']));
    $slug = preg_replace('/[^\w\s-]/', '', $slug);
    $slug = preg_replace('/[\s_]+/', '-', $slug);
    $slug = preg_replace('/-+/', '-', $slug);
    $slug = trim($slug, '-');

    // Check slug uniqueness
    $stmt = $db->prepare("SELECT id FROM programs WHERE slug = ?");
    $stmt->execute([$slug]);
    if ($stmt->fetch()) {
        $slug .= '-' . substr(uniqid(), -4);
    }

    $stmt = $db->prepare("
        INSERT INTO programs (title, slug, description, full_description, price, duration, image,
            discount, included, title_am, description_am, full_description_am, duration_am, included_am,
            allows_half_payment, is_active, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    ");
    $stmt->execute([
        sanitizeString($body['title']),
        $slug,
        sanitizeString($body['description']),
        sanitizeString($body['fullDescription']),
        (int)$body['price'],
        sanitizeString($body['duration']),
        $body['image'] ?? '',
        $body['discount'] ?? null,
        json_encode($body['included'] ?? []),
        isset($body['titleAm']) ? sanitizeString($body['titleAm']) : null,
        isset($body['descriptionAm']) ? sanitizeString($body['descriptionAm']) : null,
        isset($body['fullDescriptionAm']) ? sanitizeString($body['fullDescriptionAm']) : null,
        isset($body['durationAm']) ? sanitizeString($body['durationAm']) : null,
        isset($body['includedAm']) ? json_encode($body['includedAm']) : null,
        !empty($body['allowsHalfPayment']) ? 1 : 0,
        $admin['adminId'],
    ]);

    $newId = $db->lastInsertId();
    $stmt = $db->prepare("SELECT * FROM programs WHERE id = ?");
    $stmt->execute([$newId]);
    $program = $stmt->fetch();
    $program['id'] = (int)$program['id'];
    $program['included'] = json_decode($program['included'] ?? '[]', true);

    successResponse(['data' => $program], 201);
}

function programsUpdate(string $id): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $body = getJsonBody();
    $db   = Database::getConnection();

    // Check exists
    $stmt = $db->prepare("SELECT id FROM programs WHERE id = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        errorResponse('Program not found', 404);
        return;
    }

    $updatable = [
        'title', 'description', 'fullDescription', 'price', 'duration', 'image',
        'discount', 'included', 'titleAm', 'descriptionAm', 'fullDescriptionAm',
        'durationAm', 'includedAm', 'allowsHalfPayment', 'isActive',
    ];

    $sets   = [];
    $binds  = [];
    $columnMap = [
        'title' => 'title', 'description' => 'description', 'fullDescription' => 'full_description',
        'price' => 'price', 'duration' => 'duration', 'image' => 'image', 'discount' => 'discount',
        'titleAm' => 'title_am', 'descriptionAm' => 'description_am', 'fullDescriptionAm' => 'full_description_am',
        'durationAm' => 'duration_am',
    ];

    foreach ($updatable as $field) {
        if (!array_key_exists($field, $body)) continue;

        $column = $columnMap[$field] ?? null;
        if ($column) {
            $sets[]  = "$column = ?";
            $binds[] = in_array($field, ['title', 'description', 'fullDescription', 'duration', 'discount', 'titleAm', 'descriptionAm', 'fullDescriptionAm', 'durationAm'])
                ? sanitizeString($body[$field])
                : $body[$field];
        } elseif ($field === 'included') {
            $sets[]  = 'included = ?';
            $binds[] = json_encode($body['included']);
        } elseif ($field === 'includedAm') {
            $sets[]  = 'included_am = ?';
            $binds[] = json_encode($body['includedAm']);
        } elseif ($field === 'allowsHalfPayment') {
            $sets[]  = 'allows_half_payment = ?';
            $binds[] = !empty($body[$field]) ? 1 : 0;
        } elseif ($field === 'isActive') {
            $sets[]  = 'is_active = ?';
            $binds[] = !empty($body[$field]) ? 1 : 0;
        }
    }

    if (empty($sets)) {
        errorResponse('No fields to update');
        return;
    }

    $binds[] = $id;
    $stmt = $db->prepare("UPDATE programs SET " . implode(', ', $sets) . " WHERE id = ?");
    $stmt->execute($binds);

    $stmt = $db->prepare("SELECT * FROM programs WHERE id = ?");
    $stmt->execute([$id]);
    $program = $stmt->fetch();
    $program['id'] = (int)$program['id'];
    $program['included'] = json_decode($program['included'] ?? '[]', true);

    successResponse(['data' => $program]);
}

function programsDelete(string $id): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $db = Database::getConnection();

    // Soft-delete: set is_active = 0
    $stmt = $db->prepare("UPDATE programs SET is_active = 0 WHERE id = ?");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        errorResponse('Program not found', 404);
        return;
    }

    $stmt = $db->prepare("SELECT * FROM programs WHERE id = ?");
    $stmt->execute([$id]);
    $program = $stmt->fetch();
    $program['id'] = (int)$program['id'];

    successResponse([
        'message' => 'Program deactivated successfully',
        'data'    => $program,
    ]);
}
