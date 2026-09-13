# 📄 Documentation: `api/programs.php` — Course Management (CRUD)

## What Does This File Do?

This file handles all course-related API routes:
- `GET /programs` — List all courses (public + admin)
- `GET /programs/:id` — Get a single course (public + admin)
- `POST /programs` — Create a new course (admin only)
- `PUT /programs/:id` — Update a course (admin only)
- `DELETE /programs/:id` — Delete/deactivate a course (admin only)

---

## Routes & Handlers

### `GET /programs` — List All Courses

```php
function programsList(): void {
    $db    = Database::getConnection();
    $admin = AuthMiddleware::optionalAuth();
    $params = getQueryParams();
```

**Line-by-line:**
- Connect to database.
- `optionalAuth()` — try to get admin info, but don't require it.
- Get URL query parameters (like `?page=1&limit=10&search=hair`).

---

```php
    $page    = max(1, (int)($params['page'] ?? 1));
    $limit   = min(100, max(1, (int)($params['limit'] ?? 20)));
    $search  = $params['search'] ?? '';
    $skip    = ($page - 1) * $limit;
```

**Line-by-line:**
- `page`: Which page of results (default: 1). Must be at least 1.
- `limit`: How many per page (default: 20). Max 100.
- `search`: Text to search for in titles/descriptions.
- `skip`: Calculate how many to skip for pagination. Page 2 with limit 10 → skip 10.

---

```php
    $where  = [];
    $binds  = [];

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
```

**Line-by-line:**
- Build the WHERE clause (filter conditions).
- **If not admin** → only show active courses (`is_active = 1`). This is the public view.
- **If admin** → show all courses (including inactive ones) if they request it.
- **If search is provided** → filter by title or description containing the search term.
- `$binds` holds the values for prepared statements (prevents SQL injection).

---

```php
    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $countStmt = $db->prepare("SELECT COUNT(*) as cnt FROM programs $whereSql");
    $countStmt->execute($binds);
    $total = (int)$countStmt->fetch()['cnt'];

    $binds[] = $skip;
    $binds[] = $limit;
    $stmt = $db->prepare("SELECT * FROM programs $whereSql ORDER BY created_at DESC LIMIT ?, ?");
    $stmt->execute($binds);
    $programs = $stmt->fetchAll();
```

**Line-by-line:**
- Join the WHERE conditions with "AND".
- Count total matching programs (for pagination info).
- Fetch the actual programs, sorted by newest first, with LIMIT for pagination.
- `fetchAll()` gets all matching rows as an array.

---

```php
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
```

**Line-by-line:**
- Clean up each program's data:
  - Convert IDs and prices to integers.
  - Convert booleans from 1/0 to true/false.
  - Decode JSON columns (MySQL stores JSON as text).
- Send back the programs + pagination info.

---

### `GET /programs/:id` — Get Single Course

```php
function programsGet(string $id): void {
    $db    = Database::getConnection();
    $admin = AuthMiddleware::optionalAuth();

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

    if (!$admin && !$program['is_active']) {
        errorResponse('Program not found', 404);
        return;
    }
```

**Line-by-line:**
- If the ID is a number → search by `id`.
- If it's text (like "braid") → search by `slug`.
- If not found → 404 error.
- If not admin AND the course is inactive → pretend it doesn't exist (404).

---

### `POST /programs` — Create New Course

```php
function programsCreate(): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $body = getJsonBody();
    $errors = validateRequired($body, ['title', 'description', 'fullDescription', 'price', 'duration']);
    if ($errors) {
        errorResponse(implode(' ', $errors));
        return;
    }
```

**Line-by-line:**
- Require authentication (admin must be logged in).
- Validate that all required fields are present.

---

```php
    $slug = strtolower(trim($body['title']));
    $slug = preg_replace('/[^\w\s-]/', '', $slug);
    $slug = preg_replace('/[\s_]+/', '-', $slug);
    $slug = preg_replace('/-+/', '-', $slug);
    $slug = trim($slug, '-');

    $stmt = $db->prepare("SELECT id FROM programs WHERE slug = ?");
    $stmt->execute([$slug]);
    if ($stmt->fetch()) {
        $slug .= '-' . substr(uniqid(), -4);
    }
```

**Line-by-line:**
- Auto-generate a URL-friendly slug from the title:
  - "Professional Makeup Artistry" → "professional-makeup-artistry"
- Remove special characters, replace spaces with hyphens, remove double hyphens.
- Check if the slug already exists. If so, append a random suffix to make it unique.

---

```php
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
```

**Line-by-line:**
- Insert the new course into the database with all fields.
- `sanitizeString()` cleans up text inputs.
- `json_encode()` converts arrays to JSON strings for MySQL.
- `created_by` is set to the current admin's ID.

---

### `PUT /programs/:id` — Update Course

```php
function programsUpdate(string $id): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $body = getJsonBody();
    $db   = Database::getConnection();

    $stmt = $db->prepare("SELECT id FROM programs WHERE id = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        errorResponse('Program not found', 404);
        return;
    }
```

**Line-by-line:**
- Require authentication.
- Check if the course exists.

---

```php
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
            $binds[] = in_array($field, [...text fields...])
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
```

**Line-by-line:**
- Only update fields that are present in the request body.
- Map camelCase field names (from frontend) to snake_case column names (in MySQL).
- Sanitize text fields, encode JSON fields, convert booleans.

---

```php
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
```

**Line-by-line:**
- If no fields to update, return error.
- Build and execute the UPDATE query.
- Fetch and return the updated program.

---

### `DELETE /programs/:id` — Soft Delete Course

```php
function programsDelete(string $id): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $db = Database::getConnection();

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
```

**Line-by-line:**
- Instead of actually deleting the course, set `is_active = 0` (soft delete).
- This hides the course from the public website but keeps it in the database.
- This is safer than hard deletion because:
  - Students might already be registered for this course
  - Historical data is preserved
  - Can be easily restored by setting `is_active = 1`

---

## 🎯 Summary

| Route | Auth | What It Does |
|-------|------|-------------|
| `GET /programs` | No (public) | List all active courses |
| `GET /programs/:id` | No (public) | Get a single course by ID or slug |
| `POST /programs` | Yes (admin) | Create a new course |
| `PUT /programs/:id` | Yes (admin) | Update course details |
| `DELETE /programs/:id` | Yes (admin) | Soft-delete (deactivate) a course |
