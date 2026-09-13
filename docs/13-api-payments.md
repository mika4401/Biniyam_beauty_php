# 📄 Documentation: `api/payments.php` — Payment Records (Admin Only)

## What Does This File Do?

This file handles direct payment management for admins. All routes require authentication.

---

## Routes Overview

| Route | What It Does |
|-------|-------------|
| `GET /payments/stats/summary` | Get payment statistics |
| `GET /payments` | List all payments (paginated) |
| `GET /payments/:id` | Get a single payment |
| `POST /payments` | Create a new payment record |
| `PUT /payments/:id` | Update a payment |
| `DELETE /payments/:id` | Delete a payment |

---

## Key Handlers

### `GET /payments/stats/summary` — Payment Statistics

```php
function paymentsStats(): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $db = Database::getConnection();

    $totalCollected = (int)$db->query("SELECT COALESCE(SUM(amount), 0) as t FROM payments WHERE status = 'Completed'")->fetch()['t'];
    $pendingCount   = (int)$db->query("SELECT COUNT(*) as t FROM payments WHERE status = 'Pending'")->fetch()['t'];
```

**What it does:**
- Calculates total money collected from completed payments.
- Counts pending payments.
- Groups payments by method (Card, Cash, Mobile Money).
- Groups payments by status (Completed, Pending, Failed).
- Returns all this for the admin payment dashboard.

---

### `POST /payments` — Create Payment

```php
function paymentsCreate(): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $body = getJsonBody();
    $errors = validateRequired($body, ['registration', 'amount', 'method']);
```

**What it does:**
- Validate required fields: registration ID, amount, payment method.
- Check the registration exists.
- Validate the payment method (Cash, Bank Transfer, Mobile Money, Card).
- Insert the payment record.

---

### `PUT /payments/:id` — Update Payment

```php
function paymentsUpdate(string $id): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $body = getJsonBody();
    $db   = Database::getConnection();

    // ... update fields ...

    // Sync registration if completed
    if (($body['status'] ?? '') === 'Completed' && ($payment['payment_type'] ?? '') !== 'Half') {
        $db->prepare("UPDATE registrations SET status = 'Paid' WHERE id = ?")->execute([$payment['registration_id']]);
    }
```

**What it does:**
- Update payment fields (amount, method, status, notes).
- **Important**: If the payment status is changed to "Completed" and it's not a half payment, automatically update the registration status to "Paid".

---

### `DELETE /payments/:id` — Delete Payment

```php
function paymentsDelete(string $id): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $db   = Database::getConnection();
    $stmt = $db->prepare("DELETE FROM payments WHERE id = ?");
    $stmt->execute([$id]);
```

**What it does:**
- Permanently deletes a payment record.
- Uses hard delete (not soft delete) because payment records should be removable.

---

## 🎯 Summary

| Route | What It Does |
|-------|-------------|
| `GET /payments/stats/summary` | Payment statistics for dashboard |
| `GET /payments` | List all payments (filterable by status, method) |
| `GET /payments/:id` | Get a single payment with student/registration info |
| `POST /payments` | Create a manual payment record |
| `PUT /payments/:id` | Update payment (auto-updates registration if completed) |
| `DELETE /payments/:id` | Delete a payment record |
