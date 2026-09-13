# 📄 Documentation: `api/registrations.php` — Student Enrollment (BIGGEST FILE!)

## What Does This File Do?

This is the **most complex file** in the entire project. It handles student enrollment into courses — the core business logic. Students register for courses, pick a schedule, choose payment type (full or half), and get linked to Chapa for payment.

---

## Routes Overview

| Route | Method | Auth | What It Does |
|-------|--------|------|-------------|
| `POST /registrations` | POST | No | Create a new registration (public) |
| `POST /registrations/bulk-create` | POST | No | Alias for create (public) |
| `POST /registrations/validate-cart` | POST | No | Validate cart before checkout (public) |
| `GET /registrations/stats/summary` | GET | Yes | Dashboard stats (admin) |
| `GET /registrations` | GET | Yes | List all registrations (admin) |
| `GET /registrations/:id` | GET | Yes | Get single registration (admin) |
| `GET /registrations/:id/payments` | GET | Yes | Get payment history (admin) |
| `PATCH /registrations/:id/payment` | PATCH | Yes | Record manual payment (admin) |
| `PATCH /registrations/:id/status` | PATCH | Yes | Update status (admin) |
| `PUT /registrations/:id` | PUT | Yes | Update registration (admin) |
| `DELETE /registrations/:id` | DELETE | Yes | Delete registration (admin) |

---

## Helper Functions (Before the Handlers)

### `resolveProgramIdentifiers(array $ids)`

```php
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
```

**What it does:**
- The frontend sends program identifiers — these can be either **numeric IDs** (like `"8"`) or **slugs** (like `"braid"`).
- This function converts everything to numeric IDs:
  - Numbers → keep as-is
  - Slugs → look up in database and convert to ID
- Returns error if any slug doesn't match an active program.

**Why?** The cart on the frontend stores slugs (from the URL), but the database needs numeric IDs. This function bridges the gap.

---

### `computeProgramTotals(array $programIds)`

```php
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
```

**What it does:**
- Given a list of program IDs, calculate:
  - **total**: Sum of all program prices
  - **halfTotal**: Half the total (for half payments)
  - **allAllowHalf**: Do ALL programs allow half payment? (If even one doesn't, half payment is blocked)
  - **programs**: The full program data
- Returns error if any program is missing or inactive.

---

### `findOrCreateStudent(array $input)`

```php
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
            }
            return ['student' => $student];
        }
    }
```

**What it does:**
1. If an `_id` is provided → find student by ID.
2. If an `email` is provided → find student by email.
   - If found → update their info if any fields changed (phone, education, etc.)
   - If not found → continue to step 3.
3. Create a new student with the provided details.

**Why?** A student might register for multiple courses. If their email already exists, we reuse the existing student record and update any changed info.

---

### `nestStudentData(array $row)`

```php
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

    unset(
        $row['first_name'], $row['last_name'], $row['email'], $row['phone'],
        $row['national_id_image'], $row['education_level'], $row['field_of_study'],
        $row['student_id'], $row['studentId']
    );

    $row['student'] = $student;
    return $row;
}
```

**What it does:**
- The MySQL query returns flat fields: `first_name`, `last_name`, `email`, etc.
- The admin frontend expects a nested `student` object: `{ student: { firstName, lastName, email } }`.
- This function:
  1. Extracts student fields into a `student` sub-object.
  2. Removes the flat student fields from the main row.
  3. Adds the `student` object to the row.

**Why?** The admin React frontend was built for MongoDB (which nests data). When we migrated to MySQL, we need to re-nest the data to keep the frontend working.

---

## Handlers (The Main Functions)

### `POST /registrations` — Create Registration

```php
function registrationsCreate(): void {
    $body = getJsonBody();
    $studentInput  = $body['student'] ?? null;
    $programIds    = $body['programs'] ?? (isset($body['program']) ? [$body['program']] : []);
    $schedule      = $body['schedule'] ?? '';
    $paymentType   = $body['paymentType'] ?? 'Full';
```

**What it does:**
1. Read student info, program IDs, schedule, and payment type from the request.
2. Validate all required fields.
3. Validate schedule is one of the allowed values.
4. Resolve program IDs (convert slugs to IDs).
5. Compute program totals and validate half payment eligibility.
6. Find or create the student.
7. Check for duplicate registrations (same student + same program).
8. Create the registration record.
9. Link programs to the registration (junction table).
10. Return the complete registration with student and program data.

---

### `POST /registrations/validate-cart` — Validate Cart

```php
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
```

**What it does:**
- Validates the cart before checkout.
- Resolves program IDs, computes totals.
- Returns program details, total price, half price, and whether half payment is allowed.
- Used by the frontend to show accurate pricing on the checkout page.

---

### `GET /registrations/stats/summary` — Dashboard Stats

```php
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

    $totalStmt = $db->query("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'Completed'");
    $stats['totalCollected'] = (int)$totalStmt->fetch()['total'];

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
```

**What it does:**
- Counts registrations by status (total, paid, half-paid, pending, confirmed, cancelled).
- Sums up all completed payments (total money collected).
- Counts how many students are in each program.
- Returns all this data for the admin dashboard cards.

---

### `GET /registrations` — List Registrations

```php
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
```

**What it does:**
- Supports filtering by status, payment type, and schedule.
- Joins with students table to get student name, email, phone.
- Attaches programs to each registration.
- Uses `nestStudentData()` to format the response for the admin frontend.

---

### `PATCH /registrations/:id/payment` — Record Manual Payment

```php
function registrationsRecordPayment(string $id): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $body  = getJsonBody();
    $requestedAmount = $body['amount'] ?? null;
    $db = Database::getConnection();
```

**What it does:**
1. Check if the registration exists.
2. Check if it's already fully paid.
3. Calculate the remaining balance.
4. If an amount was specified, validate it doesn't exceed the remaining balance.
5. Insert a new payment record (method: "Cash", status: "Completed").
6. If the total paid now equals or exceeds the total cost, mark the registration as "Paid".
7. Return the updated registration with payment history.

**Why?** When a student pays the second half in cash, the admin records it here. The system automatically checks if the student is now fully paid.

---

### `PATCH /registrations/:id/status` — Update Status

```php
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
```

**What it does:**
- Admin can manually change the registration status.
- Valid statuses: Pending, Confirmed, Paid, Cancelled.
- Returns the updated registration after changing.

---

## 🎯 Summary

This file is the heart of the application. It handles:

| Function | What It Does | Used By |
|----------|-------------|---------|
| `resolveProgramIdentifiers` | Convert slugs to IDs | Checkout page |
| `computeProgramTotals` | Calculate prices + half payment eligibility | Checkout page |
| `findOrCreateStudent` | Find existing student or create new one | Registration |
| `nestStudentData` | Nest flat MySQL data for admin frontend | All registration responses |
| `registrationsCreate` | Create new enrollment | Checkout page |
| `registrationsValidateCart` | Validate cart before checkout | Checkout page |
| `registrationsStats` | Dashboard statistics | Admin dashboard |
| `registrationsList` | List all registrations | Admin registrations page |
| `registrationsRecordPayment` | Record manual/cash payment | Admin drawer |
| `registrationsUpdateStatus` | Change registration status | Admin drawer |
