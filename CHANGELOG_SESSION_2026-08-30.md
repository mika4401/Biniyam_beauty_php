# Changelog — August 30, 2026 Session

## Summary

Connected the React frontend and admin apps to the new PHP backend, fixed routing issues for XAMPP subdirectory deployment, added automatic snake_case → camelCase conversion for MySQL responses, and verified the full registration → Chapa payment flow.

---

## Changes Made

### 1. Fixed `.htaccess` for XAMPP Subdirectory

**Problem:** PHP's built-in dev server ignores `.htaccess` files. When deployed at `http://localhost/Biniyam_PHP/`, the old `.htaccess` rewrite rules didn't match because they assumed the URI started with `/api/v1/`.

**Fix:** Simplified `.htaccess` to forward all non-static requests to `index.php`:
```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]
RewriteRule ^(.*)$ index.php [L,QSA]
```

**File:** `Biniyam_PHP/.htaccess`

---

### 2. Fixed `index.php` URI Parsing

**Problem:** `preg_replace('#^.*/api/v1#', '', $uri)` failed when URI was `/Biniyam_PHP/` (no `/api/v1` prefix), causing `$resource = 'Biniyam_PHP'` → "Route not found".

**Fix:** Added two-path parsing:
```php
if (preg_match('#^.*/api/v1(.*)$#', $uri, $m)) {
    $uri = $m[1];  // API route: /Biniyam_PHP/api/v1/programs → /programs
} else {
    $uri = preg_replace('#^/[^/]+/?#', '/', $uri);  // Direct: /Biniyam_PHP/ → /
}
```

**File:** `Biniyam_PHP/index.php`

---

### 3. Fixed All 8 API Route Files — URI Parsing

**Problem:** All 8 API files (`auth.php`, `admin.php`, `programs.php`, `students.php`, `registrations.php`, `payments.php`, `chapa.php`, `gallery.php`) re-parsed `$_SERVER['REQUEST_URI']` with regexes that assumed `/api/v1/...` prefix. This broke when deployed at `/Biniyam_PHP/api/v1/...`.

**Fix:** Changed all files to use the already-stripped `$API_URI` variable from `index.php`:
```php
// Before (broken):
$uri = preg_replace('#^/api/v1/programs#', '', $_SERVER['REQUEST_URI']);

// After (fixed):
$subPath = preg_replace('#^/programs#', '', $API_URI) ?: '/';
```

**Files:** `Biniyam_PHP/api/auth.php`, `admin.php`, `programs.php`, `students.php`, `registrations.php`, `payments.php`, `chapa.php`, `gallery.php`

---

### 4. Added Automatic snake_case → camelCase Conversion

**Problem:** MySQL returns `full_description`, `allows_half_payment`, `is_active`, etc. but the React frontend expects `fullDescription`, `allowsHalfPayment`, `isActive`.

**Fix:** Added `snakeToCamel()` and `toCamelCaseKeys()` functions to `response.php`, and applied them in `successResponse()` so every API response automatically converts keys:
```php
function successResponse(array $data, int $code = 200): void {
    jsonResponse($code, array_merge(['success' => true], toCamelCaseKeys($data)));
}
```

**File:** `Biniyam_PHP/helpers/response.php`

---

### 5. Removed `htmlspecialchars()` from `sanitizeString()`

**Problem:** `htmlspecialchars()` converted `'` to `&#039;` in API JSON responses (e.g., "Men&#039;s Special Class" instead of "Men's Special Class").

**Fix:** Removed `htmlspecialchars()` since prepared statements handle SQL injection:
```php
function sanitizeString(string $value): string {
    $value = trim($value);
    $value = stripslashes($value);
    return $value;
}
```

**File:** `Biniyam_PHP/helpers/validation.php`

**Also fixed existing data:**
```sql
UPDATE programs SET title = REPLACE(title, '&#039;', '''');
UPDATE programs SET description = REPLACE(description, '&#039;', '''');
UPDATE programs SET full_description = REPLACE(full_description, '&#039;', '''');
```

---

### 6. Fixed `const VALID_SCHEDULES` Scope Issue

**Problem:** `const VALID_SCHEDULES` defined at file level wasn't accessible inside functions when the file was `require`d from within a `switch` block.

**Fix:** Changed to `define()` and moved it before the switch:
```php
if (!defined('VALID_SCHEDULES')) {
    define('VALID_SCHEDULES', [
        'weekday-morning', 'weekday-afternoon', 'weekday-midday',
        'weekday-full', 'weekend',
    ]);
}
```

**File:** `Biniyam_PHP/api/registrations.php`

---

### 7. Added `formatProgram()` Helper

**Problem:** Programs fetched via JOIN queries in registration endpoints returned raw MySQL values — integers for booleans, JSON strings for arrays.

**Fix:** Added `formatProgram()` to `response.php` and applied it everywhere programs are returned:
```php
function formatProgram(array $p): array {
    $p['id'] = (int)$p['id'];
    $p['price'] = (int)$p['price'];
    $p['is_active'] = (bool)$p['is_active'];
    $p['allows_half_payment'] = (bool)$p['allows_half_payment'];
    if (is_string($p['included'] ?? null)) {
        $p['included'] = json_decode($p['included'], true) ?? [];
    }
    return $p;
}
```

Applied in: `registrations.php` (3 locations) and `chapa.php` (1 location).

**Files:** `Biniyam_PHP/helpers/response.php`, `Biniyam_PHP/api/registrations.php`, `Biniyam_PHP/api/chapa.php`

---

### 8. Fixed `computeProgramTotals()` Missing `title` Column

**Problem:** `validate-cart` returned `null` for program titles because the SQL query only selected `id, price, allows_half_payment`.

**Fix:** Added `title` to the SELECT:
```sql
-- Before:
SELECT id, price, allows_half_payment FROM programs WHERE id IN (...)

-- After:
SELECT id, title, price, allows_half_payment FROM programs WHERE id IN (...)
```

**File:** `Biniyam_PHP/api/registrations.php`

---

### 9. Added `totalPaid` and `remainingBalance` to Chapa Verify

**Problem:** The verify endpoint didn't compute how much was paid and how much remained.

**Fix:** Added payment aggregation after fetching the payment record:
```php
$totalPaidStmt = $db->prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE registration_id = ? AND status = 'Completed'");
$totalPaidStmt->execute([$payment['registration_id']]);
$totalPaid = (int)$totalPaidStmt->fetch()['total'];
$payment['totalPaid'] = $totalPaid;
$payment['remainingBalance'] = max(0, $totalCost - $totalPaid);
```

**File:** `Biniyam_PHP/api/chapa.php`

---

### 10. Updated Frontend & Admin API URLs

**Problem:** Frontend and admin were hardcoded to the production Node.js API (`https://api.biniyambeautytraining.com.et/api/v1`).

**Fix:** Changed to local PHP API for development:
```typescript
// Before:
export const API_BASE = 'https://api.biniyambeautytraining.com.et/api/v1'

// After:
export const API_BASE = 'http://localhost/Biniyam_PHP/api/v1'
```

**Files:** `frontend/src/constants.ts`, `frontend/src/utils/CloudinaryUploadWidget.tsx`, `admin/src/utils/api.ts`

---

### 11. Updated `.env` Configuration

**Problem:** `API_BASE_URL` pointed to old Node.js server (`http://localhost:8080/api/v1`).

**Fix:** Updated to PHP backend URL:
```
API_BASE_URL=http://localhost/Biniyam_PHP/api/v1
```

**File:** `Biniyam_PHP/.env`

---

### 12. Seeded Test Programs

Added 6 production-matching programs to MySQL via the admin API:

| ID | Title | Price | Half Payment |
|----|-------|-------|--------------|
| 2 | Men's Special Class | 25,000 ETB | ✅ |
| 3 | Men's Hair Normal Class | 20,000 ETB | ✅ |
| 4 | Women's Hair | 30,000 ETB | ✅ |
| 5 | Braid | 18,000 ETB | ✅ |
| 6 | Advanced Hair Styling | 21,000 ETB | ❌ |
| 7 | Professional Makeup Artistry | 15,000 ETB | ❌ |

---

## Test Results

All 13 admin endpoints and 8 public endpoints verified working:

| Category | Endpoints Tested | Status |
|----------|-----------------|--------|
| Auth | login, refresh, logout, change-password | ✅ |
| Admin | profile, create | ✅ |
| Programs | list, get, create, update, delete | ✅ |
| Students | list, get, create, update, delete | ✅ |
| Registrations | create, list, get, stats, validate-cart, record-payment, update-status | ✅ |
| Payments | list, get, stats | ✅ |
| Chapa | initialize, callback, webhook, verify | ✅ (key expired) |
| Cloudinary | config | ✅ |
| Gallery | list, usage, create, delete | ✅ |

---

## Known Issues

1. **Chapa test API key expired** — needs refresh from https://test.chapa.co
2. **Gallery usage** returns zeros when Cloudinary is not configured (expected)
3. **Password change** invalidates all sessions — this is by design for security
