# 📄 Documentation: `api/students.php` — Student Management (CRUD)

## What Does This File Do?

This file handles all student-related API routes. All routes require admin authentication.

---

## Routes & Handlers

### `GET /students` — List All Students

```php
function studentsList(): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;
```

**What it does:**
- Requires admin login.
- Supports pagination (`?page=1&limit=10`).
- Supports search (`?search=Abebe` — searches name, email, phone).
- Returns students sorted by newest first.

---

### `GET /students/:id` — Get Single Student with Registrations

```php
function studentsGet(string $id): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $db   = Database::getConnection();
    $stmt = $db->prepare("SELECT * FROM students WHERE id = ?");
    $stmt->execute([$id]);
    $student = $stmt->fetch();
```

**What it does:**
- Fetch the student by ID.
- Also fetch all their registrations (which courses they're enrolled in).
- Returns student data + registration history.

---

### `POST /students` — Create New Student

```php
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
```

**What it does:**
- Validate required fields: firstName, lastName, email, phone.
- Validate email format.
- Check that email is unique (no two students with same email).
- Insert new student into database.

---

### `PUT /students/:id` — Update Student

```php
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
```

**What it does:**
- Check student exists.
- Only update fields that are present in the request body.
- Map frontend field names to database column names.

---

### `DELETE /students/:id` — Delete Student

```php
function studentsDelete(string $id): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $db = Database::getConnection();

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
```

**What it does:**
- Check if the student has any active registrations.
- If yes → block deletion (must cancel registrations first).
- If no → delete the student and all their data (payments, registrations, etc.).

**Why?** We can't delete a student who's still enrolled in a course — that would break the data integrity.

---

## 🎯 Summary

| Route | What It Does |
|-------|-------------|
| `GET /students` | List all students (paginated, searchable) |
| `GET /students/:id` | Get student + their registration history |
| `POST /students` | Create a new student |
| `PUT /students/:id` | Update student details |
| `DELETE /students/:id` | Delete student (only if no active registrations) |
